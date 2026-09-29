-- =============================================================================
-- HealthSupply AI · 07 · Vistas de consumo para Power BI (schema analytics)
-- -----------------------------------------------------------------------------
-- ¿Por qué vistas y no tablas directas?
--   * Power BI se conecta a UNA capa estable: si cambia el DW por dentro, la vista
--     conserva los mismos nombres de columna y el tablero no se rompe.
--   * Se exponen nombres amigables y llaves de negocio (producto_id, fecha) que
--     sirven igual si el tablero se alimenta de CSV en lugar de PostgreSQL.
--   * Cálculos por fila (valor = unidades x costo, cobertura) se hacen una sola vez aquí.
--
-- Las agregaciones "dinámicas" (que cambian con los filtros del usuario) se hacen en
-- DAX, no aquí: ver powerbi/medidas_dax.md.
-- =============================================================================

-- ------------------------------------------------------------------ Dimensiones
CREATE OR REPLACE VIEW analytics.dim_fecha AS
SELECT fecha, fecha_key, anio, trimestre, mes, nombre_mes, anio_mes, semana_anio,
       dia_semana, nombre_dia, fin_de_semana, es_historico
FROM dw.dim_fecha;

CREATE OR REPLACE VIEW analytics.dim_producto AS
SELECT p.producto_id, p.producto_nombre, p.categoria, p.unidad_medida, p.costo_unitario,
       p.lead_time_dias AS lead_time_planeado_dias, p.vida_util_dias,
       pr.proveedor_id, pr.proveedor_nombre, pr.tipo_proveedor,
       COALESCE(abc.clase_abc, 'C') AS clase_abc
FROM dw.dim_producto p
JOIN dw.dim_proveedor pr USING (proveedor_key)
LEFT JOIN ml.clasificacion_abc abc ON abc.producto_id = p.producto_id;

CREATE OR REPLACE VIEW analytics.dim_ubicacion AS
SELECT ubicacion_id, ubicacion_nombre, ciudad, departamento FROM dw.dim_ubicacion;

CREATE OR REPLACE VIEW analytics.dim_proveedor AS
SELECT proveedor_id, proveedor_nombre, tipo_proveedor FROM dw.dim_proveedor;

-- ------------------------------------------------------------------ Hechos
-- Inventario diario + cobertura con ventana móvil.
-- AVG(...) OVER (PARTITION BY serie ORDER BY fecha ROWS BETWEEN 27 PRECEDING AND CURRENT ROW)
-- = demanda promedio de los últimos 28 días de ESA serie, calculada fila por fila.
CREATE OR REPLACE VIEW analytics.fact_inventario_diario AS
SELECT
    f.fecha,
    p.producto_id,
    u.ubicacion_id,
    i.unidades_demandadas,
    i.inventario_inicial, i.entradas, i.salidas, i.inventario_final,
    i.inventario_reservado, i.inventario_disponible,
    i.demanda_insatisfecha,
    i.dia_quiebre::INT                                            AS dia_quiebre,
    i.inventario_disponible * p.costo_unitario                    AS valor_inventario_disponible,
    i.inventario_final      * p.costo_unitario                    AS valor_inventario_final,
    i.salidas               * p.costo_unitario                    AS valor_consumo,
    AVG(i.unidades_demandadas) OVER w                             AS demanda_prom_28d,
    i.inventario_disponible / NULLIF(AVG(i.unidades_demandadas) OVER w, 0) AS dias_cobertura
FROM dw.fact_inventario_diario i
JOIN dw.dim_fecha     f USING (fecha_key)
JOIN dw.dim_producto  p USING (producto_key)
JOIN dw.dim_ubicacion u USING (ubicacion_key)
WINDOW w AS (PARTITION BY i.producto_key, i.ubicacion_key ORDER BY i.fecha_key
             ROWS BETWEEN 27 PRECEDING AND CURRENT ROW);

CREATE OR REPLACE VIEW analytics.fact_compras AS
SELECT
    fp.fecha AS fecha_pedido, fr.fecha AS fecha_recepcion,
    p.producto_id, u.ubicacion_id, pr.proveedor_id,
    c.cantidad, c.costo_unitario, c.valor_compra,
    c.lead_time_real_dias,
    p.lead_time_dias                              AS lead_time_planeado_dias,
    c.lead_time_real_dias - p.lead_time_dias      AS desviacion_lead_time_dias,
    fr.fecha > (SELECT MAX(fecha) FROM dw.dim_fecha WHERE es_historico) AS en_transito
FROM dw.fact_compras c
JOIN dw.dim_fecha fp ON fp.fecha_key = c.fecha_pedido_key        -- rol 1 de la dimensión fecha
JOIN dw.dim_fecha fr ON fr.fecha_key = c.fecha_recepcion_key     -- rol 2 de la dimensión fecha
JOIN dw.dim_producto  p  USING (producto_key)
JOIN dw.dim_ubicacion u  USING (ubicacion_key)
JOIN dw.dim_proveedor pr ON pr.proveedor_key = c.proveedor_key;

-- ------------------------------------------------------------------ KPIs de inventario
-- KPI mensual por producto y ubicación (mismo cálculo que src/healthsupply/kpis.py).
CREATE OR REPLACE VIEW analytics.v_kpi_mensual AS
SELECT
    DATE_TRUNC('month', fecha)::DATE                           AS mes,
    producto_id, ubicacion_id,
    SUM(unidades_demandadas)                                   AS demanda_unidades,
    AVG(inventario_final)                                      AS inventario_promedio,
    SUM(dia_quiebre)                                           AS dias_quiebre,
    SUM(demanda_insatisfecha)                                  AS demanda_insatisfecha,
    SUM(valor_consumo)                                         AS valor_consumo,
    AVG(valor_inventario_final)                                AS valor_inventario_promedio,
    SUM(unidades_demandadas) / NULLIF(AVG(inventario_final), 0) AS rotacion_mensual,
    AVG(inventario_final) / NULLIF(AVG(unidades_demandadas), 0) AS dias_inventario,
    1 - SUM(demanda_insatisfecha)::NUMERIC / NULLIF(SUM(unidades_demandadas), 0) AS fill_rate
FROM analytics.fact_inventario_diario
GROUP BY 1, 2, 3;

-- Rotación anual por producto: costo de lo consumido / valor del inventario promedio.
CREATE OR REPLACE VIEW analytics.v_rotacion_anual AS
SELECT
    EXTRACT(YEAR FROM fecha)::INT                               AS anio,
    producto_id,
    SUM(valor_consumo)                                         AS costo_consumo,
    SUM(valor_inventario_final) / COUNT(DISTINCT fecha)        AS valor_inventario_promedio,
    SUM(valor_consumo) / NULLIF(SUM(valor_inventario_final) / COUNT(DISTINCT fecha), 0) AS rotacion_anual,
    365.0 / NULLIF(SUM(valor_consumo) / NULLIF(SUM(valor_inventario_final) / COUNT(DISTINCT fecha), 0), 0)
                                                               AS dias_inventario
FROM analytics.fact_inventario_diario
GROUP BY 1, 2;

-- ------------------------------------------------------------------ Pronóstico
CREATE OR REPLACE VIEW analytics.fact_pronostico_backtest AS
SELECT fecha, producto_id, ubicacion_id, modelo, fold, real, pronostico,
       pronostico - real        AS error,
       ABS(pronostico - real)   AS error_absoluto,
       CASE WHEN modelo IN ('RandomForest', 'HistGradientBoosting') THEN 'Machine Learning'
            ELSE 'Modelo base' END AS tipo_modelo
FROM ml.pronostico_backtest;

CREATE OR REPLACE VIEW analytics.fact_pronostico_futuro AS
SELECT fecha, producto_id, ubicacion_id, modelo, pronostico, pronostico_inf, pronostico_sup
FROM ml.pronostico_futuro;

-- Precisión por modelo y producto calculada en SQL (debe coincidir con metricas_por_producto.csv).
CREATE OR REPLACE VIEW analytics.v_precision_pronostico AS
SELECT modelo, producto_id,
       AVG(error_absoluto)                                   AS mae,
       100 * AVG(error_absoluto / NULLIF(real, 0))           AS mape,
       100 * SUM(error_absoluto) / NULLIF(SUM(real), 0)      AS wape,
       100 * SUM(error) / NULLIF(SUM(real), 0)               AS sesgo_pct
FROM analytics.fact_pronostico_backtest
GROUP BY modelo, producto_id;

CREATE OR REPLACE VIEW analytics.metricas_modelos AS
SELECT m.*, CASE WHEN modelo IN ('RandomForest', 'HistGradientBoosting') THEN 'Machine Learning'
                 ELSE 'Modelo base' END AS tipo_modelo
FROM ml.metricas_modelos m;

-- ------------------------------------------------------------------ Política, vencimiento y alertas
CREATE OR REPLACE VIEW analytics.fact_politica_inventario AS
SELECT * FROM ml.politica_inventario;

CREATE OR REPLACE VIEW analytics.fact_lotes AS
SELECT r.*,
       CASE WHEN dias_para_vencer <= 0   THEN '1. Vencido'
            WHEN dias_para_vencer <= 30  THEN '2. 0-30 días'
            WHEN dias_para_vencer <= 90  THEN '3. 31-90 días'
            WHEN dias_para_vencer <= 180 THEN '4. 91-180 días'
            ELSE '5. Más de 180 días' END                     AS rango_vencimiento,
       r.cantidad_disponible * p.costo_unitario               AS valor_disponible
FROM ml.riesgo_vencimiento_lotes r
JOIN dw.dim_producto p USING (producto_id);

CREATE OR REPLACE VIEW analytics.fact_alertas AS
SELECT *,
       CASE severidad WHEN 'CRITICA' THEN 1 WHEN 'ALTA' THEN 2 ELSE 3 END AS orden_severidad
FROM ml.alertas;

CREATE OR REPLACE VIEW analytics.calidad_datos AS
SELECT tabla, regla, dimension, severidad, estado, registros_evaluados, registros_fallidos, pct_fallidos,
       ejecucion_ts
FROM dq.v_ultima_ejecucion;

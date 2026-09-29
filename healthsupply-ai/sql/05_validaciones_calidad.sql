-- =============================================================================
-- HealthSupply AI · 05 · Validaciones de calidad de datos (DQ) en SQL
-- -----------------------------------------------------------------------------
-- Patrón usado en cada regla:
--     INSERT INTO dq.resultados (...)
--     SELECT '<tabla>', '<regla>', '<dimensión>', '<severidad>',
--            COUNT(*)                          -- registros evaluados
--            COUNT(*) FILTER (WHERE <falla>)   -- registros que incumplen
--     FROM <tabla>;
--
-- Se valida principalmente STAGING (el dato tal como llegó). El DW ya tiene
-- restricciones (CHECK/FK) que impedirían cargar datos inválidos; aquí además
-- se concilia que no se hayan perdido filas entre staging y dw.
--
-- Severidad: ERROR = dato inválido | ADVERTENCIA = situación de negocio a explicar.
-- Estas mismas reglas existen en Python (src/healthsupply/data_quality.py).
-- =============================================================================

CREATE TABLE IF NOT EXISTS dq.resultados (
    ejecucion_ts         TIMESTAMP   NOT NULL DEFAULT NOW(),
    tabla                TEXT        NOT NULL,
    regla                TEXT        NOT NULL,
    dimension            TEXT        NOT NULL,
    severidad            TEXT        NOT NULL CHECK (severidad IN ('ERROR', 'ADVERTENCIA')),
    registros_evaluados  BIGINT      NOT NULL,
    registros_fallidos   BIGINT      NOT NULL,
    estado               TEXT GENERATED ALWAYS AS
                         (CASE WHEN registros_fallidos = 0 THEN 'OK' ELSE severidad END) STORED
);

-- Cada ejecución deja su propia "foto": así se puede ver la evolución de la calidad en el tiempo.
-- Para el reporte se toma la última ejecución (ver vista dq.v_ultima_ejecucion).
-- Todo va en UNA transacción: NOW() devuelve la hora de inicio de la transacción, así
-- todas las reglas de esta corrida quedan con el mismo ejecucion_ts.
BEGIN;

-- ============================ COMPLETITUD ====================================
INSERT INTO dq.resultados (tabla, regla, dimension, severidad, registros_evaluados, registros_fallidos)
SELECT 'fact_demanda', 'sin_nulos', 'Completitud', 'ERROR', COUNT(*),
       COUNT(*) FILTER (WHERE fecha IS NULL OR producto_id IS NULL OR ubicacion_id IS NULL
                          OR unidades_demandadas IS NULL)
FROM staging.fact_demanda
UNION ALL
SELECT 'fact_inventario', 'sin_nulos', 'Completitud', 'ERROR', COUNT(*),
       COUNT(*) FILTER (WHERE fecha IS NULL OR producto_id IS NULL OR ubicacion_id IS NULL
                          OR inventario_inicial IS NULL OR entradas IS NULL OR salidas IS NULL
                          OR inventario_final IS NULL OR inventario_reservado IS NULL
                          OR inventario_disponible IS NULL)
FROM staging.fact_inventario
UNION ALL
SELECT 'fact_compras', 'sin_nulos', 'Completitud', 'ERROR', COUNT(*),
       COUNT(*) FILTER (WHERE fecha_pedido IS NULL OR fecha_recepcion IS NULL OR producto_id IS NULL
                          OR ubicacion_id IS NULL OR proveedor_id IS NULL OR cantidad IS NULL)
FROM staging.fact_compras
UNION ALL
SELECT 'fact_lotes', 'sin_nulos', 'Completitud', 'ERROR', COUNT(*),
       COUNT(*) FILTER (WHERE lote_id IS NULL OR fecha_vencimiento IS NULL OR cantidad_disponible IS NULL)
FROM staging.fact_lotes;

-- Panel completo: debe existir 1 fila por cada fecha x producto x ubicación.
-- Técnica: se construye la "grilla esperada" con CROSS JOIN y se buscan huecos con LEFT JOIN.
INSERT INTO dq.resultados (tabla, regla, dimension, severidad, registros_evaluados, registros_fallidos)
SELECT 'fact_inventario', 'panel_completo_fecha_producto_ubicacion', 'Completitud', 'ERROR',
       COUNT(*), COUNT(*) FILTER (WHERE i.fecha IS NULL)
FROM staging.dim_fecha f
CROSS JOIN staging.dim_producto p
CROSS JOIN staging.dim_ubicacion u
LEFT JOIN staging.fact_inventario i
       ON i.fecha = f.fecha AND i.producto_id = p.producto_id AND i.ubicacion_id = u.ubicacion_id;

-- ============================= UNICIDAD ======================================
INSERT INTO dq.resultados (tabla, regla, dimension, severidad, registros_evaluados, registros_fallidos)
SELECT 'fact_demanda', 'llave_unica(fecha, producto, ubicacion)', 'Unicidad', 'ERROR',
       (SELECT COUNT(*) FROM staging.fact_demanda),
       (SELECT COALESCE(SUM(n - 1), 0) FROM (SELECT COUNT(*) AS n FROM staging.fact_demanda
                                             GROUP BY fecha, producto_id, ubicacion_id HAVING COUNT(*) > 1) x)
UNION ALL
SELECT 'fact_inventario', 'llave_unica(fecha, producto, ubicacion)', 'Unicidad', 'ERROR',
       (SELECT COUNT(*) FROM staging.fact_inventario),
       (SELECT COALESCE(SUM(n - 1), 0) FROM (SELECT COUNT(*) AS n FROM staging.fact_inventario
                                             GROUP BY fecha, producto_id, ubicacion_id HAVING COUNT(*) > 1) x)
UNION ALL
SELECT 'fact_lotes', 'llave_unica(lote_id)', 'Unicidad', 'ERROR',
       COUNT(*), COUNT(*) - COUNT(DISTINCT lote_id)
FROM staging.fact_lotes
UNION ALL
SELECT 'dim_producto', 'llave_unica(producto_id)', 'Unicidad', 'ERROR',
       COUNT(*), COUNT(*) - COUNT(DISTINCT producto_id)
FROM staging.dim_producto;

-- ============================== VALIDEZ ======================================
INSERT INTO dq.resultados (tabla, regla, dimension, severidad, registros_evaluados, registros_fallidos)
SELECT 'fact_inventario', 'cantidades_no_negativas', 'Validez', 'ERROR', COUNT(*),
       COUNT(*) FILTER (WHERE LEAST(inventario_inicial, entradas, salidas, inventario_final,
                                    inventario_reservado, inventario_disponible) < 0)
FROM staging.fact_inventario
UNION ALL
SELECT 'fact_demanda', 'cantidades_no_negativas', 'Validez', 'ERROR', COUNT(*),
       COUNT(*) FILTER (WHERE unidades_demandadas < 0)
FROM staging.fact_demanda
UNION ALL
SELECT 'fact_compras', 'cantidades_positivas', 'Validez', 'ERROR', COUNT(*),
       COUNT(*) FILTER (WHERE cantidad <= 0 OR costo_unitario <= 0)
FROM staging.fact_compras
UNION ALL
-- Detección de valores atípicos con la regla de Tukey (IQR) sobre la demanda de cada serie.
-- Es ADVERTENCIA: un pico puede ser real (brote, campaña), no necesariamente un error.
SELECT 'fact_demanda', 'atipicos_iqr_por_serie', 'Validez', 'ADVERTENCIA', COUNT(*),
       COUNT(*) FILTER (WHERE d.unidades_demandadas > q.q3 + 3 * (q.q3 - q.q1))
FROM staging.fact_demanda d
JOIN (SELECT producto_id, ubicacion_id,
             PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY unidades_demandadas) AS q1,
             PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY unidades_demandadas) AS q3
      FROM staging.fact_demanda GROUP BY producto_id, ubicacion_id) q
  ON q.producto_id = d.producto_id AND q.ubicacion_id = d.ubicacion_id;

-- =========================== CONSISTENCIA ====================================
INSERT INTO dq.resultados (tabla, regla, dimension, severidad, registros_evaluados, registros_fallidos)
SELECT 'fact_inventario', 'balance_inicial_entradas_salidas_final', 'Consistencia', 'ADVERTENCIA', COUNT(*),
       COUNT(*) FILTER (WHERE inventario_inicial + entradas - salidas <> inventario_final)
FROM staging.fact_inventario
UNION ALL
SELECT 'fact_inventario', 'disponible_igual_final_menos_reservado', 'Consistencia', 'ERROR', COUNT(*),
       COUNT(*) FILTER (WHERE inventario_final - inventario_reservado <> inventario_disponible)
FROM staging.fact_inventario
UNION ALL
-- Continuidad con función de ventana LAG: el inicial de hoy = el final de ayer.
SELECT 'fact_inventario', 'continuidad_final_ayer_igual_inicial_hoy', 'Consistencia', 'ERROR',
       COUNT(*) FILTER (WHERE final_ayer IS NOT NULL),
       COUNT(*) FILTER (WHERE final_ayer IS NOT NULL AND final_ayer <> inventario_inicial)
FROM (SELECT inventario_inicial,
             LAG(inventario_final) OVER (PARTITION BY producto_id, ubicacion_id ORDER BY fecha) AS final_ayer
      FROM staging.fact_inventario) x
UNION ALL
SELECT 'fact_inventario', 'salidas_igual_demanda', 'Consistencia', 'ERROR', COUNT(*),
       COUNT(*) FILTER (WHERE i.salidas <> d.unidades_demandadas)
FROM staging.fact_inventario i
JOIN staging.fact_demanda d USING (fecha, producto_id, ubicacion_id)
UNION ALL
-- Conciliación inventario vs. compras: cada entrada debe corresponder a una recepción.
SELECT 'fact_inventario', 'entradas_conciliadas_con_compras', 'Consistencia', 'ERROR', COUNT(*),
       COUNT(*) FILTER (WHERE c.cantidad IS DISTINCT FROM i.entradas)
FROM staging.fact_inventario i
LEFT JOIN (SELECT fecha_recepcion, producto_id, ubicacion_id, SUM(cantidad) AS cantidad
           FROM staging.fact_compras GROUP BY 1, 2, 3) c
       ON c.fecha_recepcion = i.fecha AND c.producto_id = i.producto_id AND c.ubicacion_id = i.ubicacion_id
WHERE i.entradas > 0
UNION ALL
SELECT 'fact_compras', 'valor_igual_cantidad_por_costo', 'Consistencia', 'ERROR', COUNT(*),
       COUNT(*) FILTER (WHERE cantidad * costo_unitario <> valor_compra)
FROM staging.fact_compras
UNION ALL
SELECT 'fact_compras', 'recepcion_posterior_a_pedido', 'Consistencia', 'ERROR', COUNT(*),
       COUNT(*) FILTER (WHERE fecha_recepcion < fecha_pedido)
FROM staging.fact_compras
UNION ALL
SELECT 'fact_compras', 'proveedor_igual_maestro_producto', 'Consistencia', 'ADVERTENCIA', COUNT(*),
       COUNT(*) FILTER (WHERE c.proveedor_id <> p.proveedor_id)
FROM staging.fact_compras c JOIN staging.dim_producto p USING (producto_id)
UNION ALL
SELECT 'fact_lotes', 'vencimiento_posterior_a_ingreso', 'Consistencia', 'ERROR', COUNT(*),
       COUNT(*) FILTER (WHERE fecha_vencimiento <= fecha_ingreso)
FROM staging.fact_lotes
UNION ALL
SELECT 'fact_lotes', 'disponible_menor_o_igual_inicial', 'Consistencia', 'ERROR', COUNT(*),
       COUNT(*) FILTER (WHERE cantidad_disponible > cantidad_inicial)
FROM staging.fact_lotes
UNION ALL
-- Lotes vencidos que siguen con unidades disponibles: no es error del dato, es un hallazgo.
SELECT 'fact_lotes', 'lotes_vencidos_con_existencias', 'Consistencia', 'ADVERTENCIA', COUNT(*),
       COUNT(*) FILTER (WHERE fecha_vencimiento <= (SELECT MAX(fecha) FROM staging.fact_inventario)
                          AND cantidad_disponible > 0)
FROM staging.fact_lotes
UNION ALL
-- El calendario generado en dw debe coincidir con el del archivo fuente.
SELECT 'dim_fecha', 'calendario_dw_coincide_con_fuente', 'Consistencia', 'ERROR', COUNT(*),
       COUNT(*) FILTER (WHERE d.fecha_key IS NULL OR d.dia_semana <> s.dia_semana OR d.mes <> s.mes
                          OR d.fin_de_semana <> s.fin_de_semana)
FROM staging.dim_fecha s
LEFT JOIN dw.dim_fecha d ON d.fecha = s.fecha;

-- ====================== INTEGRIDAD REFERENCIAL ===============================
INSERT INTO dq.resultados (tabla, regla, dimension, severidad, registros_evaluados, registros_fallidos)
SELECT 'fact_demanda', 'fk_producto_id_existe', 'Integridad referencial', 'ERROR', COUNT(*),
       COUNT(*) FILTER (WHERE p.producto_id IS NULL)
FROM staging.fact_demanda f LEFT JOIN staging.dim_producto p USING (producto_id)
UNION ALL
SELECT 'fact_demanda', 'fk_ubicacion_id_existe', 'Integridad referencial', 'ERROR', COUNT(*),
       COUNT(*) FILTER (WHERE u.ubicacion_id IS NULL)
FROM staging.fact_demanda f LEFT JOIN staging.dim_ubicacion u USING (ubicacion_id)
UNION ALL
SELECT 'fact_compras', 'fk_proveedor_id_existe', 'Integridad referencial', 'ERROR', COUNT(*),
       COUNT(*) FILTER (WHERE p.proveedor_id IS NULL)
FROM staging.fact_compras f LEFT JOIN staging.dim_proveedor p USING (proveedor_id)
UNION ALL
SELECT 'fact_lotes', 'fk_producto_id_existe', 'Integridad referencial', 'ERROR', COUNT(*),
       COUNT(*) FILTER (WHERE p.producto_id IS NULL)
FROM staging.fact_lotes f LEFT JOIN staging.dim_producto p USING (producto_id)
UNION ALL
SELECT 'dim_producto', 'fk_proveedor_id_existe', 'Integridad referencial', 'ERROR', COUNT(*),
       COUNT(*) FILTER (WHERE pr.proveedor_id IS NULL)
FROM staging.dim_producto p LEFT JOIN staging.dim_proveedor pr USING (proveedor_id);

-- ================== CONCILIACIÓN STAGING -> DW (carga completa) ==============
INSERT INTO dq.resultados (tabla, regla, dimension, severidad, registros_evaluados, registros_fallidos)
SELECT 'dw.fact_inventario_diario', 'filas_staging_igual_dw', 'Completitud', 'ERROR',
       (SELECT COUNT(*) FROM staging.fact_inventario),
       ABS((SELECT COUNT(*) FROM staging.fact_inventario) - (SELECT COUNT(*) FROM dw.fact_inventario_diario))
UNION ALL
SELECT 'dw.fact_inventario_diario', 'suma_demanda_staging_igual_dw', 'Completitud', 'ERROR',
       (SELECT SUM(unidades_demandadas) FROM staging.fact_demanda),
       ABS((SELECT SUM(unidades_demandadas) FROM staging.fact_demanda)
         - (SELECT SUM(unidades_demandadas) FROM dw.fact_inventario_diario))
UNION ALL
SELECT 'dw.fact_compras', 'filas_staging_igual_dw', 'Completitud', 'ERROR',
       (SELECT COUNT(*) FROM staging.fact_compras),
       ABS((SELECT COUNT(*) FROM staging.fact_compras) - (SELECT COUNT(*) FROM dw.fact_compras))
UNION ALL
SELECT 'dw.fact_lote_snapshot', 'filas_staging_igual_dw', 'Completitud', 'ERROR',
       (SELECT COUNT(*) FROM staging.fact_lotes),
       ABS((SELECT COUNT(*) FROM staging.fact_lotes) - (SELECT COUNT(*) FROM dw.fact_lote_snapshot));

COMMIT;

-- Vista con el resultado de la ejecución más reciente.
CREATE OR REPLACE VIEW dq.v_ultima_ejecucion AS
SELECT *, ROUND(100.0 * registros_fallidos / NULLIF(registros_evaluados, 0), 4) AS pct_fallidos
FROM dq.resultados
WHERE ejecucion_ts = (SELECT MAX(ejecucion_ts) FROM dq.resultados);

-- Reporte: primero lo que falló.
SELECT tabla, regla, dimension, estado, registros_evaluados, registros_fallidos
FROM dq.v_ultima_ejecucion
ORDER BY CASE estado WHEN 'ERROR' THEN 0 WHEN 'ADVERTENCIA' THEN 1 ELSE 2 END, tabla, regla;

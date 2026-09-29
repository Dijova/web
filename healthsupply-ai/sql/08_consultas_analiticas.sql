-- =============================================================================
-- HealthSupply AI · 08 · Consultas analíticas de ejemplo (para practicar SQL)
-- -----------------------------------------------------------------------------
-- Cada consulta responde una pregunta de negocio y muestra una técnica de SQL.
-- Ejecutar una por una en psql, DBeaver o pgAdmin.
-- =============================================================================

-- 1) ¿Qué productos tuvieron quiebres de stock y cuántas unidades no se atendieron?
--    Técnica: agregación con filtro (HAVING).
SELECT p.producto_id, p.producto_nombre,
       SUM(i.dia_quiebre::INT)       AS dias_quiebre,
       SUM(i.demanda_insatisfecha)   AS unidades_no_atendidas
FROM dw.fact_inventario_diario i
JOIN dw.dim_producto p USING (producto_key)
GROUP BY 1, 2
HAVING SUM(i.dia_quiebre::INT) > 0
ORDER BY unidades_no_atendidas DESC;

-- 2) Crecimiento de la demanda año contra año por categoría.
--    Técnica: función de ventana LAG sobre un resultado agregado.
WITH anual AS (
    SELECT f.anio, p.categoria, SUM(i.unidades_demandadas) AS demanda
    FROM dw.fact_inventario_diario i
    JOIN dw.dim_fecha f USING (fecha_key)
    JOIN dw.dim_producto p USING (producto_key)
    GROUP BY 1, 2
)
SELECT anio, categoria, demanda,
       ROUND(100.0 * (demanda - LAG(demanda) OVER (PARTITION BY categoria ORDER BY anio))
             / LAG(demanda) OVER (PARTITION BY categoria ORDER BY anio), 1) AS crecimiento_pct
FROM anual
ORDER BY categoria, anio;

-- 3) Estacionalidad semanal: índice de cada día contra el promedio (1.00 = día promedio).
SELECT f.dia_semana, f.nombre_dia,
       ROUND(AVG(i.unidades_demandadas) / (SELECT AVG(unidades_demandadas) FROM dw.fact_inventario_diario), 2)
           AS indice_estacional
FROM dw.fact_inventario_diario i
JOIN dw.dim_fecha f USING (fecha_key)
GROUP BY 1, 2
ORDER BY 1;

-- 4) Cumplimiento de proveedores: lead time real vs. planeado.
--    Técnica: estadísticos (STDDEV, PERCENTILE_CONT) y porcentaje condicional.
SELECT pr.proveedor_nombre, pr.tipo_proveedor,
       COUNT(*)                                                   AS ordenes,
       ROUND(AVG(c.lead_time_real_dias), 1)                       AS lt_real_prom,
       ROUND(AVG(p.lead_time_dias), 1)                            AS lt_planeado_prom,
       ROUND(STDDEV(c.lead_time_real_dias), 2)                    AS lt_desv,
       PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY c.lead_time_real_dias) AS lt_p95,
       ROUND(100.0 * AVG((c.lead_time_real_dias <= p.lead_time_dias)::INT), 1) AS pct_a_tiempo
FROM dw.fact_compras c
JOIN dw.dim_proveedor pr USING (proveedor_key)
JOIN dw.dim_producto  p  ON p.producto_key = c.producto_key
GROUP BY 1, 2
ORDER BY pct_a_tiempo;

-- 5) Fotografía al cierre: cobertura actual por sede, del más crítico al más holgado.
SELECT ubicacion_id, producto_id, inventario_disponible, ROUND(demanda_prom_28d, 1) AS demanda_prom_28d,
       ROUND(dias_cobertura, 1) AS dias_cobertura
FROM analytics.fact_inventario_diario
WHERE fecha = (SELECT MAX(fecha) FROM analytics.fact_inventario_diario)
ORDER BY dias_cobertura
LIMIT 15;

-- 6) Top 3 productos por valor de consumo en cada sede.
--    Técnica: ROW_NUMBER() para rankings dentro de grupos.
SELECT * FROM (
    SELECT u.ubicacion_nombre, p.producto_nombre,
           SUM(i.salidas * p.costo_unitario) AS valor_consumo,
           ROW_NUMBER() OVER (PARTITION BY u.ubicacion_nombre
                              ORDER BY SUM(i.salidas * p.costo_unitario) DESC) AS ranking
    FROM dw.fact_inventario_diario i
    JOIN dw.dim_producto p USING (producto_key)
    JOIN dw.dim_ubicacion u USING (ubicacion_key)
    JOIN dw.dim_fecha f USING (fecha_key)
    WHERE f.anio = 2025
    GROUP BY 1, 2
) t
WHERE ranking <= 3;

-- 7) Precisión del pronóstico: ¿cuánto mejora el ML frente al mejor modelo base, por producto?
WITH w AS (
    SELECT producto_id, modelo, wape FROM analytics.v_precision_pronostico
)
SELECT ml.producto_id,
       ROUND(ml.wape, 1)                                   AS wape_ml,
       ROUND(base.wape, 1)                                 AS wape_base,
       ROUND(100 * (base.wape - ml.wape) / base.wape, 1)   AS mejora_pct
FROM w ml
JOIN w base ON base.producto_id = ml.producto_id
WHERE ml.modelo = (SELECT modelo FROM ml.metricas_modelos ORDER BY wape LIMIT 1)
  AND base.modelo = 'promedio_dia_semana_8s'
ORDER BY mejora_pct DESC;

-- 8) Capital inmovilizado por encima del stock máximo y valor en riesgo por vencimiento, por sede.
SELECT pol.ubicacion_id,
       ROUND(SUM(pol.valor_exceso) / 1e6, 1)                     AS exceso_millones_cop,
       ROUND(COALESCE(MAX(v.valor_riesgo), 0) / 1e6, 1)          AS vencimiento_millones_cop
FROM ml.politica_inventario pol
LEFT JOIN (SELECT ubicacion_id, SUM(valor_en_riesgo) AS valor_riesgo
           FROM ml.riesgo_vencimiento_lotes GROUP BY 1) v USING (ubicacion_id)
GROUP BY pol.ubicacion_id
ORDER BY exceso_millones_cop DESC;

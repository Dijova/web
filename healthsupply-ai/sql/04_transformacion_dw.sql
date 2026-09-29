-- =============================================================================
-- HealthSupply AI · 04 · Transformación staging -> dw (ETL en SQL)
-- -----------------------------------------------------------------------------
-- Orden obligatorio: primero dimensiones, después hechos (los hechos necesitan
-- las llaves sustitutas de las dimensiones).
-- Todo va en una transacción: si un paso falla, no queda el DW a medio cargar.
-- =============================================================================

BEGIN;

TRUNCATE dw.fact_lote_snapshot, dw.fact_compras, dw.fact_inventario_diario,
         dw.dim_producto, dw.dim_proveedor, dw.dim_ubicacion, dw.dim_fecha
         RESTART IDENTITY CASCADE;

-- -----------------------------------------------------------------------------
-- dim_fecha: se GENERA con generate_series (2023-2030) en lugar de copiar el CSV,
-- porque necesitamos fechas futuras (pronósticos, recepciones de 2026 y vencimientos
-- de lotes hasta 2029). Los nombres se traducen al español.
-- La validación dq compara este calendario con staging.dim_fecha.
-- -----------------------------------------------------------------------------
INSERT INTO dw.dim_fecha
SELECT
    TO_CHAR(d, 'YYYYMMDD')::INTEGER                           AS fecha_key,
    d::DATE                                                   AS fecha,
    EXTRACT(YEAR FROM d)                                      AS anio,
    EXTRACT(QUARTER FROM d)                                   AS trimestre,
    EXTRACT(MONTH FROM d)                                     AS mes,
    (ARRAY['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto',
           'Septiembre','Octubre','Noviembre','Diciembre'])[EXTRACT(MONTH FROM d)::INT] AS nombre_mes,
    TO_CHAR(d, 'YYYY-MM')                                     AS anio_mes,
    EXTRACT(WEEK FROM d)                                      AS semana_anio,
    EXTRACT(ISODOW FROM d)                                    AS dia_semana,
    (ARRAY['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'])[EXTRACT(ISODOW FROM d)::INT] AS nombre_dia,
    EXTRACT(ISODOW FROM d) IN (6, 7)                          AS fin_de_semana,
    d::DATE <= (SELECT MAX(fecha) FROM staging.fact_inventario) AS es_historico
FROM generate_series(DATE '2023-01-01', DATE '2030-12-31', INTERVAL '1 day') AS d;

-- -----------------------------------------------------------------------------
-- Dimensiones de negocio (TRIM elimina espacios accidentales del origen).
-- -----------------------------------------------------------------------------
INSERT INTO dw.dim_proveedor (proveedor_id, proveedor_nombre, tipo_proveedor)
SELECT TRIM(proveedor_id), TRIM(proveedor_nombre), TRIM(tipo_proveedor)
FROM staging.dim_proveedor
ORDER BY proveedor_id;

INSERT INTO dw.dim_ubicacion (ubicacion_id, ubicacion_nombre, ciudad, departamento)
SELECT TRIM(ubicacion_id), TRIM(ubicacion_nombre), TRIM(ciudad), TRIM(departamento)
FROM staging.dim_ubicacion
ORDER BY ubicacion_id;

INSERT INTO dw.dim_producto (producto_id, producto_nombre, categoria, unidad_medida, costo_unitario,
                             lead_time_dias, vida_util_dias, proveedor_key, proveedor_nombre)
SELECT TRIM(p.producto_id), TRIM(p.producto_nombre), TRIM(p.categoria), TRIM(p.unidad_medida),
       p.costo_unitario, p.lead_time_dias, p.vida_util_dias, pr.proveedor_key, pr.proveedor_nombre
FROM staging.dim_producto p
JOIN dw.dim_proveedor pr ON pr.proveedor_id = TRIM(p.proveedor_id)   -- INNER JOIN: un producto sin proveedor válido NO entra
ORDER BY p.producto_id;

-- -----------------------------------------------------------------------------
-- fact_inventario_diario = inventario + demanda (mismo grano) + medidas derivadas.
-- -----------------------------------------------------------------------------
INSERT INTO dw.fact_inventario_diario
SELECT
    TO_CHAR(i.fecha, 'YYYYMMDD')::INTEGER,
    p.producto_key,
    u.ubicacion_key,
    d.unidades_demandadas,
    i.inventario_inicial,
    i.entradas,
    i.salidas,
    i.inventario_final,
    i.inventario_reservado,
    i.inventario_disponible,
    GREATEST(0, i.salidas - (i.inventario_inicial + i.entradas))      AS demanda_insatisfecha,
    i.salidas > (i.inventario_inicial + i.entradas)                    AS dia_quiebre
FROM staging.fact_inventario i
JOIN staging.fact_demanda d
  ON d.fecha = i.fecha AND d.producto_id = i.producto_id AND d.ubicacion_id = i.ubicacion_id
JOIN dw.dim_producto  p ON p.producto_id  = i.producto_id
JOIN dw.dim_ubicacion u ON u.ubicacion_id = i.ubicacion_id;

INSERT INTO dw.fact_compras (fecha_pedido_key, fecha_recepcion_key, producto_key, ubicacion_key,
                             proveedor_key, cantidad, costo_unitario, valor_compra, lead_time_real_dias)
SELECT
    TO_CHAR(c.fecha_pedido, 'YYYYMMDD')::INTEGER,
    TO_CHAR(c.fecha_recepcion, 'YYYYMMDD')::INTEGER,
    p.producto_key, u.ubicacion_key, pr.proveedor_key,
    c.cantidad, c.costo_unitario, c.valor_compra,
    c.fecha_recepcion - c.fecha_pedido                                  -- DATE - DATE = días (entero)
FROM staging.fact_compras c
JOIN dw.dim_producto  p  ON p.producto_id   = c.producto_id
JOIN dw.dim_ubicacion u  ON u.ubicacion_id  = c.ubicacion_id
JOIN dw.dim_proveedor pr ON pr.proveedor_id = c.proveedor_id;

INSERT INTO dw.fact_lote_snapshot
SELECT
    l.lote_id,
    TO_CHAR(corte.fecha, 'YYYYMMDD')::INTEGER,
    p.producto_key, u.ubicacion_key,
    TO_CHAR(l.fecha_ingreso, 'YYYYMMDD')::INTEGER,
    TO_CHAR(l.fecha_vencimiento, 'YYYYMMDD')::INTEGER,
    l.cantidad_inicial, l.cantidad_disponible,
    l.fecha_vencimiento - corte.fecha
FROM staging.fact_lotes l
CROSS JOIN (SELECT MAX(fecha) AS fecha FROM staging.fact_inventario) corte   -- fecha de corte = último día con datos
JOIN dw.dim_producto  p ON p.producto_id  = l.producto_id
JOIN dw.dim_ubicacion u ON u.ubicacion_id = l.ubicacion_id;

COMMIT;

-- Conteo final por tabla del DW.
SELECT 'dim_fecha' AS tabla, COUNT(*) AS filas FROM dw.dim_fecha
UNION ALL SELECT 'dim_producto',           COUNT(*) FROM dw.dim_producto
UNION ALL SELECT 'dim_proveedor',          COUNT(*) FROM dw.dim_proveedor
UNION ALL SELECT 'dim_ubicacion',          COUNT(*) FROM dw.dim_ubicacion
UNION ALL SELECT 'fact_inventario_diario', COUNT(*) FROM dw.fact_inventario_diario
UNION ALL SELECT 'fact_compras',           COUNT(*) FROM dw.fact_compras
UNION ALL SELECT 'fact_lote_snapshot',     COUNT(*) FROM dw.fact_lote_snapshot;

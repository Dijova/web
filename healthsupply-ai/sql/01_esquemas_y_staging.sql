-- =============================================================================
-- HealthSupply AI · 01 · Esquemas y tablas de staging
-- -----------------------------------------------------------------------------
-- Arquitectura por capas (cada una es un "schema" de PostgreSQL):
--
--   staging   -> copia fiel de los CSV. Sin reglas de negocio. Se puede borrar y
--                recargar cuando llegue un archivo nuevo.
--   dw        -> modelo dimensional (estrella): dimensiones + hechos, con llaves
--                sustitutas, llaves foráneas y restricciones de calidad.
--   ml        -> resultados del pipeline de Python (pronósticos, política, alertas).
--   dq        -> resultados de las validaciones de calidad de datos.
--   analytics -> vistas listas para consumir desde Power BI.
--
-- Ejecutar (desde la carpeta healthsupply-ai/):
--   psql -d healthsupply -f sql/01_esquemas_y_staging.sql
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS dw;
CREATE SCHEMA IF NOT EXISTS ml;
CREATE SCHEMA IF NOT EXISTS dq;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Las tablas de staging replican las columnas del CSV tal cual.
-- Se usan tipos reales (DATE, INTEGER) para que un archivo con formato incorrecto
-- falle en la carga (fail fast) en vez de contaminar capas posteriores.

DROP TABLE IF EXISTS staging.dim_fecha;
CREATE TABLE staging.dim_fecha (
    fecha          DATE,
    fecha_id       INTEGER,
    anio           INTEGER,
    mes            INTEGER,
    nombre_mes     TEXT,
    trimestre      INTEGER,
    semana_anio    INTEGER,
    dia_semana     INTEGER,
    nombre_dia     TEXT,
    fin_de_semana  BOOLEAN
);

DROP TABLE IF EXISTS staging.dim_producto;
CREATE TABLE staging.dim_producto (
    producto_id      TEXT,
    producto_nombre  TEXT,
    categoria        TEXT,
    unidad_medida    TEXT,
    costo_unitario   NUMERIC(12, 2),
    lead_time_dias   INTEGER,
    vida_util_dias   INTEGER,
    proveedor_id     TEXT
);

DROP TABLE IF EXISTS staging.dim_proveedor;
CREATE TABLE staging.dim_proveedor (
    proveedor_id      TEXT,
    proveedor_nombre  TEXT,
    tipo_proveedor    TEXT
);

DROP TABLE IF EXISTS staging.dim_ubicacion;
CREATE TABLE staging.dim_ubicacion (
    ubicacion_id      TEXT,
    ubicacion_nombre  TEXT,
    ciudad            TEXT,
    departamento      TEXT
);

DROP TABLE IF EXISTS staging.fact_demanda;
CREATE TABLE staging.fact_demanda (
    fecha                DATE,
    producto_id          TEXT,
    ubicacion_id         TEXT,
    unidades_demandadas  INTEGER
);

DROP TABLE IF EXISTS staging.fact_inventario;
CREATE TABLE staging.fact_inventario (
    fecha                  DATE,
    producto_id            TEXT,
    ubicacion_id           TEXT,
    inventario_inicial     INTEGER,
    entradas               INTEGER,
    salidas                INTEGER,
    inventario_final       INTEGER,
    inventario_reservado   INTEGER,
    inventario_disponible  INTEGER
);

DROP TABLE IF EXISTS staging.fact_compras;
CREATE TABLE staging.fact_compras (
    fecha_pedido     DATE,
    fecha_recepcion  DATE,
    producto_id      TEXT,
    ubicacion_id     TEXT,
    proveedor_id     TEXT,
    cantidad         INTEGER,
    costo_unitario   NUMERIC(12, 2),
    valor_compra     NUMERIC(14, 2)
);

DROP TABLE IF EXISTS staging.fact_lotes;
CREATE TABLE staging.fact_lotes (
    lote_id              TEXT,
    producto_id          TEXT,
    ubicacion_id         TEXT,
    fecha_ingreso        DATE,
    fecha_vencimiento    DATE,
    cantidad_inicial     INTEGER,
    cantidad_disponible  INTEGER
);

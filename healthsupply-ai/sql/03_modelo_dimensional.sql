-- =============================================================================
-- HealthSupply AI · 03 · Modelo dimensional (esquema estrella) en el schema dw
-- -----------------------------------------------------------------------------
-- Conceptos:
--   * DIMENSIÓN: describe el "quién, qué, dónde, cuándo" (producto, sede, fecha...).
--   * HECHO: registra medidas numéricas de un evento a un GRANO definido.
--   * GRANO: el nivel de detalle de una fila. Ej.: "1 fila = 1 día x 1 producto x 1 sede".
--   * LLAVE SUSTITUTA (surrogate key): entero sin significado de negocio (producto_key)
--     que usa el DW internamente. La llave de negocio (producto_id = 'MED-001') se
--     conserva como atributo ÚNICO. Ventajas: joins más rápidos, independencia de los
--     códigos del sistema fuente y posibilidad de versionar dimensiones (SCD tipo 2).
--   * Las restricciones (PK, FK, CHECK, NOT NULL) son la primera línea de defensa de
--     la calidad de datos: un dato inválido simplemente no entra.
--
-- Diagrama y explicación completa: docs/03_modelo_dimensional.md
-- =============================================================================

DROP TABLE IF EXISTS dw.fact_lote_snapshot, dw.fact_compras, dw.fact_inventario_diario CASCADE;
DROP TABLE IF EXISTS dw.dim_producto, dw.dim_proveedor, dw.dim_ubicacion, dw.dim_fecha CASCADE;

-- -----------------------------------------------------------------------------
-- DIMENSIONES
-- -----------------------------------------------------------------------------

CREATE TABLE dw.dim_fecha (
    fecha_key       INTEGER     PRIMARY KEY,          -- formato AAAAMMDD (llave "inteligente" estándar para fechas)
    fecha           DATE        NOT NULL UNIQUE,
    anio            SMALLINT    NOT NULL,
    trimestre       SMALLINT    NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
    mes             SMALLINT    NOT NULL CHECK (mes BETWEEN 1 AND 12),
    nombre_mes      TEXT        NOT NULL,
    anio_mes        TEXT        NOT NULL,             -- '2025-03' útil para ejes de Power BI
    semana_anio     SMALLINT    NOT NULL,             -- semana ISO
    dia_semana      SMALLINT    NOT NULL CHECK (dia_semana BETWEEN 1 AND 7), -- 1 = lunes (ISO)
    nombre_dia      TEXT        NOT NULL,
    fin_de_semana   BOOLEAN     NOT NULL,
    es_historico    BOOLEAN     NOT NULL              -- TRUE si la fecha tiene datos reales
);

CREATE TABLE dw.dim_proveedor (
    proveedor_key     SERIAL      PRIMARY KEY,
    proveedor_id      TEXT        NOT NULL UNIQUE,
    proveedor_nombre  TEXT        NOT NULL,
    tipo_proveedor    TEXT        NOT NULL CHECK (tipo_proveedor IN ('Nacional', 'Internacional'))
);

CREATE TABLE dw.dim_ubicacion (
    ubicacion_key     SERIAL      PRIMARY KEY,
    ubicacion_id      TEXT        NOT NULL UNIQUE,
    ubicacion_nombre  TEXT        NOT NULL,
    ciudad            TEXT        NOT NULL,
    departamento      TEXT        NOT NULL
);

CREATE TABLE dw.dim_producto (
    producto_key      SERIAL         PRIMARY KEY,
    producto_id       TEXT           NOT NULL UNIQUE,
    producto_nombre   TEXT           NOT NULL,
    categoria         TEXT           NOT NULL,
    unidad_medida     TEXT           NOT NULL,
    costo_unitario    NUMERIC(12, 2) NOT NULL CHECK (costo_unitario > 0),
    lead_time_dias    SMALLINT       NOT NULL CHECK (lead_time_dias > 0),
    vida_util_dias    SMALLINT       NOT NULL CHECK (vida_util_dias > 0),
    -- Proveedor habitual. Se guarda la FK y además el nombre "desnormalizado" para que
    -- Power BI no tenga que saltar dos tablas (así el modelo sigue siendo estrella y no copo de nieve).
    proveedor_key     INTEGER        NOT NULL REFERENCES dw.dim_proveedor (proveedor_key),
    proveedor_nombre  TEXT           NOT NULL
);

-- -----------------------------------------------------------------------------
-- HECHOS
-- -----------------------------------------------------------------------------

-- Grano: 1 fila = 1 día x 1 producto x 1 ubicación.
-- fact_demanda y fact_inventario de origen tienen EXACTAMENTE el mismo grano, por eso se
-- consolidan en un solo hecho: evita un join de 82 mil x 82 mil filas en cada consulta.
CREATE TABLE dw.fact_inventario_diario (
    fecha_key              INTEGER NOT NULL REFERENCES dw.dim_fecha (fecha_key),
    producto_key           INTEGER NOT NULL REFERENCES dw.dim_producto (producto_key),
    ubicacion_key          INTEGER NOT NULL REFERENCES dw.dim_ubicacion (ubicacion_key),
    unidades_demandadas    INTEGER NOT NULL CHECK (unidades_demandadas >= 0),
    inventario_inicial     INTEGER NOT NULL CHECK (inventario_inicial >= 0),
    entradas               INTEGER NOT NULL CHECK (entradas >= 0),
    salidas                INTEGER NOT NULL CHECK (salidas >= 0),
    inventario_final       INTEGER NOT NULL CHECK (inventario_final >= 0),
    inventario_reservado   INTEGER NOT NULL CHECK (inventario_reservado >= 0),
    inventario_disponible  INTEGER NOT NULL CHECK (inventario_disponible >= 0),
    -- Medidas derivadas (se calculan una vez en la carga, no en cada reporte):
    demanda_insatisfecha   INTEGER NOT NULL CHECK (demanda_insatisfecha >= 0),
    dia_quiebre            BOOLEAN NOT NULL,
    PRIMARY KEY (fecha_key, producto_key, ubicacion_key),
    CHECK (inventario_disponible = inventario_final - inventario_reservado)
);

-- Grano: 1 fila = 1 orden de compra (línea de pedido) de un producto para una ubicación.
-- Tiene DOS fechas -> la dimensión fecha juega dos "roles" (role-playing dimension).
CREATE TABLE dw.fact_compras (
    compra_key            SERIAL         PRIMARY KEY,
    fecha_pedido_key      INTEGER        NOT NULL REFERENCES dw.dim_fecha (fecha_key),
    fecha_recepcion_key   INTEGER        NOT NULL REFERENCES dw.dim_fecha (fecha_key),
    producto_key          INTEGER        NOT NULL REFERENCES dw.dim_producto (producto_key),
    ubicacion_key         INTEGER        NOT NULL REFERENCES dw.dim_ubicacion (ubicacion_key),
    proveedor_key         INTEGER        NOT NULL REFERENCES dw.dim_proveedor (proveedor_key),
    cantidad              INTEGER        NOT NULL CHECK (cantidad > 0),
    costo_unitario        NUMERIC(12, 2) NOT NULL CHECK (costo_unitario > 0),
    valor_compra          NUMERIC(14, 2) NOT NULL,
    lead_time_real_dias   SMALLINT       NOT NULL CHECK (lead_time_real_dias >= 0),
    CHECK (valor_compra = cantidad * costo_unitario),
    UNIQUE (fecha_pedido_key, producto_key, ubicacion_key)
);

-- Grano: 1 fila = 1 lote en la fecha de corte (hecho tipo "snapshot": foto del estado).
-- lote_id es una "dimensión degenerada": un identificador que vive en el hecho sin tabla propia.
CREATE TABLE dw.fact_lote_snapshot (
    lote_id                 TEXT    PRIMARY KEY,
    fecha_corte_key         INTEGER NOT NULL REFERENCES dw.dim_fecha (fecha_key),
    producto_key            INTEGER NOT NULL REFERENCES dw.dim_producto (producto_key),
    ubicacion_key           INTEGER NOT NULL REFERENCES dw.dim_ubicacion (ubicacion_key),
    fecha_ingreso_key       INTEGER NOT NULL REFERENCES dw.dim_fecha (fecha_key),
    fecha_vencimiento_key   INTEGER NOT NULL REFERENCES dw.dim_fecha (fecha_key),
    cantidad_inicial        INTEGER NOT NULL CHECK (cantidad_inicial > 0),
    cantidad_disponible     INTEGER NOT NULL CHECK (cantidad_disponible >= 0),
    dias_para_vencer        INTEGER NOT NULL,
    CHECK (cantidad_disponible <= cantidad_inicial),
    CHECK (fecha_vencimiento_key > fecha_ingreso_key)
);

-- Índices para las consultas más comunes (filtrar por producto/ubicación y rango de fechas).
CREATE INDEX ix_inv_prod_ubi_fecha ON dw.fact_inventario_diario (producto_key, ubicacion_key, fecha_key);
CREATE INDEX ix_compras_recepcion ON dw.fact_compras (fecha_recepcion_key);

-- -----------------------------------------------------------------------------
-- DICCIONARIO DE DATOS DENTRO DE LA BASE (COMMENT ON)
-- Cualquier herramienta (DBeaver, pgAdmin, Power BI) puede leer estas descripciones.
-- El diccionario completo está en docs/04_diccionario_datos.md
-- -----------------------------------------------------------------------------
COMMENT ON TABLE dw.dim_fecha IS 'Calendario diario 2023-2030. Grano: 1 fila por día. es_historico = hay datos reales.';
COMMENT ON TABLE dw.dim_producto IS 'Catálogo de insumos médicos con costo, lead time planeado, vida útil y proveedor habitual.';
COMMENT ON TABLE dw.dim_proveedor IS 'Proveedores de insumos (nacionales e internacionales).';
COMMENT ON TABLE dw.dim_ubicacion IS 'Sedes (hospital, clínicas, centros médicos) que consumen y almacenan inventario.';
COMMENT ON TABLE dw.fact_inventario_diario IS 'Movimiento y saldo diario por producto y ubicación. Grano: día x producto x ubicación.';
COMMENT ON TABLE dw.fact_compras IS 'Órdenes de compra con fecha de pedido y de recepción. Grano: 1 orden.';
COMMENT ON TABLE dw.fact_lote_snapshot IS 'Foto de los lotes a la fecha de corte con su vencimiento. Grano: 1 lote.';

COMMENT ON COLUMN dw.fact_inventario_diario.unidades_demandadas IS 'Unidades solicitadas por los servicios asistenciales ese día.';
COMMENT ON COLUMN dw.fact_inventario_diario.inventario_disponible IS 'inventario_final - inventario_reservado: lo que realmente se puede despachar.';
COMMENT ON COLUMN dw.fact_inventario_diario.demanda_insatisfecha IS 'max(0, salidas - (inventario_inicial + entradas)). Unidades no atendidas por falta de stock.';
COMMENT ON COLUMN dw.fact_inventario_diario.dia_quiebre IS 'TRUE si hubo demanda insatisfecha ese día (quiebre de stock).';
COMMENT ON COLUMN dw.fact_compras.lead_time_real_dias IS 'Días entre la fecha de pedido y la de recepción.';
COMMENT ON COLUMN dw.fact_lote_snapshot.dias_para_vencer IS 'fecha_vencimiento - fecha_corte. Negativo = lote ya vencido.';
COMMENT ON COLUMN dw.dim_producto.lead_time_dias IS 'Lead time PLANEADO (maestro). El real se mide en fact_compras.';

-- =============================================================================
-- HealthSupply AI · 06 · Resultados del pipeline de Python -> schema ml
-- -----------------------------------------------------------------------------
-- Prerrequisito: haber ejecutado `python scripts/run_pipeline.py`, que genera los
-- CSV en data/processed/. Las columnas de cada tabla siguen EXACTAMENTE el orden
-- del CSV (\copy asigna por posición).
--
-- Estas tablas guardan llaves de negocio (producto_id, ubicacion_id, fecha); las
-- vistas de analytics (07) las unen con las dimensiones del dw.
-- =============================================================================

DROP TABLE IF EXISTS ml.pronostico_backtest, ml.pronostico_futuro, ml.metricas_modelos,
    ml.metricas_modelos_por_fold, ml.metricas_por_producto, ml.importancia_variables,
    ml.politica_inventario, ml.riesgo_vencimiento_lotes, ml.alertas, ml.clasificacion_abc CASCADE;  -- CASCADE: borra también las vistas de analytics que dependen de ellas (el script 07 las recrea)

-- Predicciones de la validación temporal: permite medir la precisión en Power BI con cualquier corte.
CREATE TABLE ml.pronostico_backtest (
    fecha         DATE    NOT NULL,
    producto_id   TEXT    NOT NULL,
    ubicacion_id  TEXT    NOT NULL,
    real          NUMERIC NOT NULL,
    pronostico    NUMERIC NOT NULL,
    modelo        TEXT    NOT NULL,
    fold          SMALLINT NOT NULL,
    PRIMARY KEY (modelo, fecha, producto_id, ubicacion_id)
);

CREATE TABLE ml.pronostico_futuro (
    fecha            DATE    NOT NULL,
    producto_id      TEXT    NOT NULL,
    ubicacion_id     TEXT    NOT NULL,
    pronostico       NUMERIC NOT NULL,
    pronostico_inf   NUMERIC NOT NULL,   -- percentil 10 (intervalo empírico)
    pronostico_sup   NUMERIC NOT NULL,   -- percentil 90
    modelo           TEXT    NOT NULL,
    PRIMARY KEY (fecha, producto_id, ubicacion_id)
);

CREATE TABLE ml.metricas_modelos (
    modelo TEXT PRIMARY KEY, mae NUMERIC, mape NUMERIC, wape NUMERIC, sesgo_pct NUMERIC, rmse NUMERIC, n INTEGER
);

CREATE TABLE ml.metricas_modelos_por_fold (
    modelo TEXT, fold SMALLINT, mae NUMERIC, mape NUMERIC, wape NUMERIC, sesgo_pct NUMERIC, rmse NUMERIC,
    n INTEGER, PRIMARY KEY (modelo, fold)
);

CREATE TABLE ml.metricas_por_producto (
    modelo TEXT, producto_id TEXT, mae NUMERIC, mape NUMERIC, wape NUMERIC, sesgo_pct NUMERIC, rmse NUMERIC,
    n INTEGER, PRIMARY KEY (modelo, producto_id)
);

CREATE TABLE ml.importancia_variables (variable TEXT PRIMARY KEY, aumento_mae NUMERIC);

CREATE TABLE ml.clasificacion_abc (
    producto_id TEXT PRIMARY KEY, unidades_12m INTEGER, valor_consumo_12m NUMERIC,
    pct_acumulado NUMERIC, clase_abc CHAR(1) CHECK (clase_abc IN ('A', 'B', 'C'))
);

CREATE TABLE ml.politica_inventario (
    fecha_corte DATE, producto_id TEXT, ubicacion_id TEXT, producto_nombre TEXT, categoria TEXT,
    clase_abc CHAR(1), nivel_servicio NUMERIC, z NUMERIC, costo_unitario NUMERIC,
    demanda_diaria_pronostico NUMERIC, sigma_error_diario NUMERIC, lead_time_prom NUMERIC,
    lead_time_desv NUMERIC, demanda_lead_time NUMERIC, stock_seguridad NUMERIC, punto_reorden NUMERIC,
    stock_maximo NUMERIC, inventario_disponible INTEGER, inventario_en_transito INTEGER,
    proxima_recepcion DATE, posicion_inventario INTEGER, dias_cobertura NUMERIC,
    dias_cobertura_posicion NUMERIC, cantidad_sugerida INTEGER, valor_pedido_sugerido NUMERIC,
    unidades_exceso INTEGER, valor_exceso NUMERIC, estado_inventario TEXT,
    PRIMARY KEY (producto_id, ubicacion_id)
);

CREATE TABLE ml.riesgo_vencimiento_lotes (
    lote_id TEXT PRIMARY KEY, producto_id TEXT, ubicacion_id TEXT, fecha_ingreso DATE,
    fecha_vencimiento DATE, cantidad_inicial INTEGER, cantidad_disponible INTEGER,
    demanda_diaria_pronostico NUMERIC, dias_para_vencer INTEGER, unidades_consumidas_proyectadas NUMERIC,
    unidades_en_riesgo INTEGER, valor_en_riesgo NUMERIC, estado_vencimiento TEXT
);

CREATE TABLE ml.alertas (
    alerta_id INTEGER PRIMARY KEY, fecha_corte DATE, producto_id TEXT, ubicacion_id TEXT,
    producto_nombre TEXT, lote_id TEXT, tipo_alerta TEXT, severidad TEXT, unidades INTEGER,
    valor NUMERIC, mensaje TEXT
);

\copy ml.pronostico_backtest        FROM 'data/processed/pronostico_backtest.csv'        WITH (FORMAT csv, HEADER true)
\copy ml.pronostico_futuro          FROM 'data/processed/pronostico_futuro.csv'          WITH (FORMAT csv, HEADER true)
\copy ml.metricas_modelos           FROM 'data/processed/metricas_modelos.csv'           WITH (FORMAT csv, HEADER true)
\copy ml.metricas_modelos_por_fold  FROM 'data/processed/metricas_modelos_por_fold.csv'  WITH (FORMAT csv, HEADER true)
\copy ml.metricas_por_producto      FROM 'data/processed/metricas_por_producto.csv'      WITH (FORMAT csv, HEADER true)
\copy ml.importancia_variables      FROM 'data/processed/importancia_variables.csv'      WITH (FORMAT csv, HEADER true)
\copy ml.clasificacion_abc          FROM 'data/processed/clasificacion_abc.csv'          WITH (FORMAT csv, HEADER true)
\copy ml.politica_inventario        FROM 'data/processed/politica_inventario.csv'        WITH (FORMAT csv, HEADER true)
\copy ml.riesgo_vencimiento_lotes   FROM 'data/processed/riesgo_vencimiento_lotes.csv'   WITH (FORMAT csv, HEADER true)
\copy ml.alertas                    FROM 'data/processed/alertas.csv'                    WITH (FORMAT csv, HEADER true)

SELECT 'pronostico_backtest' AS tabla, COUNT(*) AS filas FROM ml.pronostico_backtest
UNION ALL SELECT 'pronostico_futuro',        COUNT(*) FROM ml.pronostico_futuro
UNION ALL SELECT 'politica_inventario',      COUNT(*) FROM ml.politica_inventario
UNION ALL SELECT 'riesgo_vencimiento_lotes', COUNT(*) FROM ml.riesgo_vencimiento_lotes
UNION ALL SELECT 'alertas',                  COUNT(*) FROM ml.alertas;

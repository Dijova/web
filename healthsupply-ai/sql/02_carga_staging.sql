-- =============================================================================
-- HealthSupply AI · 02 · Carga de los CSV a staging
-- -----------------------------------------------------------------------------
-- \copy es un comando de psql (cliente): lee el archivo desde TU computador y lo
-- envía al servidor. (COPY sin barra lee desde el disco del SERVIDOR y requiere
-- permisos de superusuario). Las rutas son relativas a la carpeta desde donde
-- se ejecuta psql, por eso hay que correrlo desde healthsupply-ai/:
--
--   psql -d healthsupply -f sql/02_carga_staging.sql
-- =============================================================================

TRUNCATE staging.dim_fecha, staging.dim_producto, staging.dim_proveedor, staging.dim_ubicacion,
         staging.fact_demanda, staging.fact_inventario, staging.fact_compras, staging.fact_lotes;

\copy staging.dim_fecha       FROM 'data/raw/dim_fecha.csv'       WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy staging.dim_producto    FROM 'data/raw/dim_producto.csv'    WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy staging.dim_proveedor   FROM 'data/raw/dim_proveedor.csv'   WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy staging.dim_ubicacion   FROM 'data/raw/dim_ubicacion.csv'   WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy staging.fact_demanda    FROM 'data/raw/fact_demanda.csv'    WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy staging.fact_inventario FROM 'data/raw/fact_inventario.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy staging.fact_compras    FROM 'data/raw/fact_compras.csv'    WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy staging.fact_lotes      FROM 'data/raw/fact_lotes.csv'      WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

-- Verificación rápida: cuántas filas quedaron en cada tabla.
SELECT 'dim_fecha' AS tabla, COUNT(*) AS filas FROM staging.dim_fecha
UNION ALL SELECT 'dim_producto',    COUNT(*) FROM staging.dim_producto
UNION ALL SELECT 'dim_proveedor',   COUNT(*) FROM staging.dim_proveedor
UNION ALL SELECT 'dim_ubicacion',   COUNT(*) FROM staging.dim_ubicacion
UNION ALL SELECT 'fact_demanda',    COUNT(*) FROM staging.fact_demanda
UNION ALL SELECT 'fact_inventario', COUNT(*) FROM staging.fact_inventario
UNION ALL SELECT 'fact_compras',    COUNT(*) FROM staging.fact_compras
UNION ALL SELECT 'fact_lotes',      COUNT(*) FROM staging.fact_lotes;

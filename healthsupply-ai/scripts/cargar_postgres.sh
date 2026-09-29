#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Carga completa a PostgreSQL: staging -> dw -> validaciones -> resultados ML -> vistas.
#
# Uso (desde la carpeta healthsupply-ai/):
#     bash scripts/cargar_postgres.sh                 # base "healthsupply" local
#     PGHOST=localhost PGUSER=postgres PGPASSWORD=*** bash scripts/cargar_postgres.sh
#
# psql lee la conexión de las variables de entorno estándar: PGHOST, PGPORT,
# PGUSER, PGPASSWORD y PGDATABASE.
# -----------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

export PGDATABASE="${PGDATABASE:-healthsupply}"

# Crea la base si no existe (se conecta a la base "postgres" para poder crearla).
if ! psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '${PGDATABASE}'" | grep -q 1; then
    echo ">> Creando base de datos ${PGDATABASE}"
    psql -d postgres -c "CREATE DATABASE ${PGDATABASE}"
fi

if [ ! -f data/processed/politica_inventario.csv ]; then
    echo "ERROR: primero ejecuta 'python scripts/run_pipeline.py' para generar data/processed/." >&2
    exit 1
fi

for archivo in sql/0[1-7]_*.sql; do
    echo ">> Ejecutando ${archivo}"
    psql -v ON_ERROR_STOP=1 -q -f "${archivo}"
done

echo ">> Listo. Vistas disponibles para Power BI:"
psql -tAc "SELECT table_name FROM information_schema.views WHERE table_schema = 'analytics' ORDER BY 1"

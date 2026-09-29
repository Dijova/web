# 08 · Guía de ejecución (de cero a tablero)

## 0. Requisitos

| Herramienta | Versión probada | Para qué |
|---|---|---|
| Python | 3.11 (funciona con 3.10+) | Pipeline, modelos, notebooks |
| PostgreSQL | 16 (funciona con 13+) | Modelo dimensional y vistas |
| Power BI Desktop | Última versión (Windows) | Tablero |
| Git | cualquiera | Versionar y publicar en GitHub |

## 1. Clonar e instalar

```bash
git clone https://github.com/Dijova/healthsupply-ai.git
cd healthsupply-ai

python -m venv .venv
# Windows:            .venv\Scripts\activate
# macOS / Linux:      source .venv/bin/activate

pip install -r requirements.txt
```

**¿Por qué un entorno virtual?** Aísla las librerías del proyecto: otro proyecto con otra versión de
pandas no se rompe.

## 2. Ejecutar el pipeline de Python (~2 minutos)

```bash
python scripts/run_pipeline.py
```

Salida esperada (resumen):
```
[2] Validaciones de calidad de datos
  46 reglas evaluadas -> OK: 44, ADVERTENCIA: 2, ERROR: 0
[4] Backtesting: modelos base vs. Machine Learning
                modelo  MAE  MAPE  WAPE  Sesgo_pct
          RandomForest 2.52 11.33 10.88       0.82
  HistGradientBoosting 2.62 11.84 11.35       1.50
promedio_dia_semana_8s 3.34 15.58 14.43       2.42
...
[7] Política de inventario ...   {'SOBRESTOCK': 75}
```

Genera `data/processed/*.csv` y `reports/figures/*.png`. Si ya existen, se sobrescriben
(los resultados son reproducibles gracias a `RANDOM_STATE = 42`).

## 3. Correr las pruebas

```bash
pytest -q          # 10 pruebas: métricas, fuga de información, fórmulas, FEFO, calidad
```

## 4. Explorar los notebooks

```bash
jupyter lab notebooks/
```
Orden sugerido: `01_exploracion_y_calidad` → `02_pronostico_demanda` → `03_politica_inventario_y_alertas`.
Ya vienen ejecutados (se ven en GitHub), pero conviene correrlos y modificarlos para aprender.

## 5. Cargar PostgreSQL

### Instalar PostgreSQL
- **Windows / macOS**: instalador de https://www.postgresql.org/download/ (incluye pgAdmin). Anota la contraseña del usuario `postgres`. Agrega `C:\Program Files\PostgreSQL\16\bin` al PATH para usar `psql`.
- **Ubuntu**: `sudo apt install postgresql` y `sudo -u postgres createuser -s $USER`.

### Opción A: script automático (macOS / Linux / Git Bash en Windows)
```bash
export PGHOST=localhost PGUSER=postgres PGPASSWORD=tu_clave   # si aplica
bash scripts/cargar_postgres.sh
```

### Opción B: paso a paso con psql (cualquier sistema; ejecutar desde `healthsupply-ai/`)
```bash
psql -U postgres -c "CREATE DATABASE healthsupply"
psql -U postgres -d healthsupply -f sql/01_esquemas_y_staging.sql
psql -U postgres -d healthsupply -f sql/02_carga_staging.sql
psql -U postgres -d healthsupply -f sql/03_modelo_dimensional.sql
psql -U postgres -d healthsupply -f sql/04_transformacion_dw.sql
psql -U postgres -d healthsupply -f sql/05_validaciones_calidad.sql
psql -U postgres -d healthsupply -f sql/06_resultados_ml.sql
psql -U postgres -d healthsupply -f sql/07_vistas_analytics.sql
psql -U postgres -d healthsupply -f sql/08_consultas_analiticas.sql   # opcional: consultas de práctica
```

> Si usas pgAdmin o DBeaver en vez de psql: los comandos `\copy` son exclusivos de psql. En esas
> herramientas usa el asistente de *Import* sobre las tablas de `staging` y `ml`, o ejecuta solo los
> archivos 02 y 06 desde psql.

Verificación rápida:
```sql
SELECT * FROM dq.v_ultima_ejecucion WHERE estado <> 'OK';   -- 2 advertencias esperadas
SELECT COUNT(*) FROM dw.fact_inventario_diario;              -- 82200
SELECT * FROM analytics.metricas_modelos ORDER BY wape;      -- RandomForest primero
```

## 6. Construir el tablero de Power BI
Sigue [07_tablero_power_bi.md](07_tablero_power_bi.md). Sin PostgreSQL: `python scripts/exportar_powerbi.py` y usa el modo CSV.

## 7. Publicar en GitHub (portafolio)

El proyecto vive en https://github.com/Dijova/healthsupply-ai. Para mantenerlo como portafolio:

1. Sube los cambios (`git add . && git commit -m "..." && git push`).
2. Agrega capturas del tablero en `reports/figures/powerbi_*.png` y enlázalas en el README.
3. En la descripción del repo usa: *"Analítica predictiva para inventarios en salud: pronóstico de demanda (scikit-learn), stock de seguridad y punto de reorden, modelo dimensional en PostgreSQL y tablero en Power BI."*
4. Agrega *topics*: `data-science`, `forecasting`, `inventory-management`, `postgresql`, `power-bi`, `scikit-learn`, `healthcare`.

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| `ModuleNotFoundError: healthsupply` en el notebook | Jupyter se abrió desde otra carpeta | Abre Jupyter desde `healthsupply-ai/` o `notebooks/` |
| `\copy: could not open file "data/raw/..."` | psql no se ejecutó desde `healthsupply-ai/` | `cd healthsupply-ai` y repite |
| `ERROR: primero ejecuta run_pipeline.py` | Faltan los CSV de `data/processed` | Ejecuta el paso 2 |
| Tildes raras en Power BI (Ã³) | Codificación incorrecta | En Power Query elige *Origen de archivo: 65001 UTF-8* |
| `password authentication failed` | Credenciales de PostgreSQL | Define `PGUSER` y `PGPASSWORD` o usa `-U postgres -W` |
| El pipeline se detiene en el paso 2 | Una regla de calidad dio `ERROR` | Revisa `data/processed/reporte_calidad_datos.csv` |

# 09 · Roadmap: PySpark y LLM (próximas fases)

La versión 1.0 cubre Python, SQL, Power BI y scikit-learn. Estas dos extensiones están **diseñadas
pero no implementadas**; se agregan al título del proyecto solo cuando existan en el repositorio.

## Fase 2 · PySpark: escalar el pipeline

**¿Cuándo tiene sentido?** Con 75 series y 82 mil filas, pandas es más rápido y simple que Spark.
Spark se justifica cuando los datos no caben en memoria: por ejemplo, una red nacional con 5.000
insumos × 300 sedes × 5 años ≈ 2.700 millones de filas.

Plan de implementación (`src/healthsupply_spark/`):

1. **Ingesta** a Parquet particionado por fecha: `spark.read.csv(...).write.partitionBy("anio", "mes").parquet(...)`.
2. **Calidad de datos** con las mismas reglas usando agregaciones de Spark (`F.sum(F.when(cond, 1))`).
3. **Features** con funciones de ventana: `F.lag("y", 28).over(Window.partitionBy("producto_id", "ubicacion_id").orderBy("fecha"))` — equivalente directo de `groupby().shift()`.
4. **Entrenamiento distribuido por serie** con `groupBy(...).applyInPandas(entrenar_y_pronosticar, schema)`: cada ejecutor corre scikit-learn sobre un grupo de series (patrón *many models*).
5. **Escritura** de resultados a PostgreSQL vía JDBC o a un lakehouse (Delta Lake).

Criterio de éxito: mismos resultados que la versión pandas (prueba de paridad) sobre este dataset.

## Fase 3 · LLM: explicar y consultar en lenguaje natural

Dos casos de uso concretos, con salvaguardas:

1. **Resumen ejecutivo automático de alertas.** Se envía al LLM la tabla `alertas` + `politica_inventario`
   (datos estructurados, no el razonamiento) y se le pide un resumen para el jefe de farmacia:
   *"3 prioridades de la semana y por qué"*. El LLM **no calcula** nada: solo redacta a partir de
   números ya validados por el pipeline.
2. **Preguntas en lenguaje natural sobre el DW** (*text-to-SQL*): "¿qué sede tiene más valor en riesgo
   de vencimiento?" → el LLM genera SQL **solo sobre las vistas `analytics`** con un usuario de
   **solo lectura**, se valida la consulta antes de ejecutarla y se muestra el SQL al usuario.

Buenas prácticas previstas: usar un modelo actual vía API (p. ej. Claude), plantillas de *prompt* versionadas
en el repo, respuestas con cita de las filas usadas, evaluación con un conjunto de preguntas de prueba
y nunca enviar datos de pacientes (este proyecto solo maneja inventario).

## Otras mejoras
- Orquestación (Airflow / Prefect) y ejecución programada mensual.
- Seguimiento de experimentos (MLflow) y monitoreo del WAPE en producción.
- Optimización de pedidos multi-sede (traslados entre sedes) con programación lineal (PuLP / OR-Tools).
- CI en GitHub Actions: `pytest` + `ruff` en cada *push*.

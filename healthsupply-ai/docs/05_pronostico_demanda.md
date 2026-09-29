# 05 · Pronóstico de demanda

Código: [`src/healthsupply/forecasting.py`](../src/healthsupply/forecasting.py) ·
[`src/healthsupply/metrics.py`](../src/healthsupply/metrics.py) ·
Notebook: [`notebooks/02_pronostico_demanda.ipynb`](../notebooks/02_pronostico_demanda.ipynb)

## 1. Planteamiento

| Decisión | Elección | Por qué |
|---|---|---|
| ¿Qué se pronostica? | Unidades demandadas por **día**, producto y sede | Es el grano de los datos y permite agregar a semana/mes sin perder el patrón semanal |
| ¿Cuántas series? | 15 × 5 = **75** | Una por producto-sede: el reabastecimiento se decide por sede |
| ¿Hasta cuándo? | **28 días** | 4 semanas completas y > lead time máximo (20 días) |
| ¿Un modelo por serie o uno global? | **Global** (uno para las 75) | Aprende patrones compartidos, tiene 75× más datos para entrenar y es más simple de mantener |

## 2. Modelos base (*baselines*)

Un modelo base es una regla sencilla que cualquier analista podría aplicar en Excel. **Sin baseline
no se puede afirmar que el ML "funciona"**: un WAPE de 11 % solo es bueno si la alternativa simple
es peor.

| Modelo | Regla | Captura |
|---|---|---|
| `media_movil_28` | Promedio de los últimos 28 días, igual para todos los días futuros | Nivel |
| `naive_estacional` | Repite la última semana observada (lunes ← último lunes...) | Nivel + patrón semanal (con ruido) |
| `promedio_dia_semana_8s` | Promedio de los últimos 8 lunes, 8 martes, … | Nivel + patrón semanal (suavizado) |

## 3. Modelos de Machine Learning

Ambos son ensambles de árboles de decisión de scikit-learn:

- **RandomForestRegressor**: promedia 300 árboles entrenados con muestras y variables aleatorias.
  Robusto, poco sensible a hiperparámetros. `min_samples_leaf=10` evita memorizar ruido.
- **HistGradientBoostingRegressor**: construye árboles en secuencia, cada uno corrige los errores
  del anterior. Se usa **pérdida Poisson** porque la demanda es un conteo no negativo, y se declaran
  `producto_cod` y `ubicacion_cod` como variables **categóricas** nativas.

### Variables (features)

| Grupo | Variables | Intuición |
|---|---|---|
| Calendario | `dia_semana`, `mes`, `dia_mes`, `semana_anio`, `dia_anio`, `fin_de_semana` | Estacionalidad semanal y anual |
| Rezagos | `lag_28`, `lag_35`, `lag_42`, `lag_49` | Demanda del mismo día de la semana hace 4-7 semanas |
| Rezago anual | `lag_364` | Mismo día (de la semana) del año pasado → anticipa diciembre |
| Resumen semanal | `prom_dia_semana_4s` = promedio de los 4 rezagos anteriores | Nivel reciente + patrón semanal |
| Ventanas móviles | `media_movil_7/28/91`, `desv_movil_28` (vistas desde hace 28 días) | Nivel, tendencia y volatilidad |
| Identidad | `producto_cod`, `ubicacion_cod` | Nivel propio de cada serie |

### La regla más importante: nada de fuga de información (*data leakage*)

Al pronosticar el día **t + 28** desde el origen **t**, el dato más reciente disponible es el del
día **t**. Por eso **todas** las variables de rezago usan información de hace **28 días o más**.
Si se usara `lag_1` (ayer), el modelo parecería excelente en el laboratorio y fallaría en
producción, porque para los días 2 a 28 del horizonte "ayer" todavía no ha ocurrido.

Esta estrategia se llama **pronóstico directo**: un único modelo genera los 28 días a la vez, sin
retroalimentar sus propias predicciones (estrategia recursiva, que acumula errores). Hay una prueba
unitaria (`test_features_no_usan_informacion_del_futuro`) que lo verifica.

## 4. Validación temporal (backtesting con origen móvil)

Un `train_test_split` aleatorio **no sirve** en series de tiempo: mezclaría días de diciembre en el
entrenamiento para "pronosticar" noviembre. Se simula el uso real, 4 veces:

```
            ene-2023 ............................................. dic-2025
fold 1  [=================== entrena ===================][ test 28d ]
fold 2  [====================== entrena ======================][ test 28d ]
fold 3  [========================= entrena =========================][ test 28d ]
fold 4  [============================ entrena ============================][ test 28d ]
```

| Fold | Entrena hasta | Evalúa |
|---|---|---|
| 1 | 2025-09-10 | 2025-09-11 → 2025-10-08 |
| 2 | 2025-10-08 | 2025-10-09 → 2025-11-05 |
| 3 | 2025-11-05 | 2025-11-06 → 2025-12-03 |
| 4 | 2025-12-03 | 2025-12-04 → 2025-12-31 |

Total evaluado: 112 días × 75 series = **8.400 pronósticos por modelo**, todos fuera de muestra.
Los modelos de ML se **reentrenan** en cada fold (ventana expansiva).

## 5. Métricas

| Métrica | Fórmula | Unidad | Lectura |
|---|---|---|---|
| **MAE** | promedio(\|y − ŷ\|) | unidades | "Nos equivocamos ±2,5 unidades por día en promedio" |
| **MAPE** | promedio(\|y − ŷ\| / y) × 100 | % | Error relativo promedio. Castiga los días de baja demanda (dividir por 2 unidades infla el %) |
| **WAPE** | Σ\|y − ŷ\| / Σy × 100 | % | Error relativo **ponderado por volumen**. Robusto; es la métrica de **selección** |
| **Sesgo** | Σ(ŷ − y) / Σy × 100 | % | + sobrepronóstico (sobrestock), − subpronóstico (quiebre). Ideal ≈ 0 |
| **RMSE** | √promedio((y − ŷ)²) | unidades | Penaliza más los errores grandes |

¿Por qué WAPE para elegir y no MAPE? Porque un error de 2 unidades en un producto que vende 3 al
día pesa lo mismo en MAPE que un error de 30 en uno que vende 45. El WAPE refleja el impacto real
en el inventario total.

## 6. Resultados

![Comparación de modelos](../reports/figures/03_comparacion_modelos.png)

### Diario (8.400 pronósticos por modelo)
| Modelo | Tipo | MAE | MAPE | WAPE | Sesgo |
|---|---|---:|---:|---:|---:|
| **RandomForest** | ML | **2,52** | **11,3 %** | **10,9 %** | +0,8 % |
| HistGradientBoosting | ML | 2,62 | 11,8 % | 11,3 % | +1,5 % |
| promedio_dia_semana_8s | Base | 3,34 | 15,6 % | 14,4 % | +2,4 % |
| naive_estacional | Base | 3,72 | 17,4 % | 16,1 % | +3,2 % |
| media_movil_28 | Base | 5,16 | 26,6 % | 22,3 % | +3,6 % |

**El RandomForest reduce el WAPE 24,6 % frente al mejor modelo base** (14,4 % → 10,9 %) y tiene el
menor sesgo.

### Por fold (WAPE %)
| Modelo | Fold 1 (sep-oct) | Fold 2 (oct-nov) | Fold 3 (nov-dic) | Fold 4 (dic) |
|---|---:|---:|---:|---:|
| RandomForest | 10,0 | 10,7 | 12,0 | 10,6 |
| HistGradientBoosting | 10,0 | 11,0 | 13,1 | 11,2 |
| promedio_dia_semana_8s | 10,5 | 11,3 | 12,6 | **25,3** |
| naive_estacional | 13,1 | 14,3 | 15,5 | 22,5 |
| media_movil_28 | 21,0 | 20,4 | 20,4 | 28,7 |

En meses "normales" el mejor baseline está cerca del ML. La diferencia aparece en **diciembre**:
los baselines copian el nivel alto de noviembre y no saben que la demanda cae; el ML lo anticipa
gracias a `lag_364` y al calendario. **El valor del ML está en los cambios de régimen**, que es
justo cuando más cuesta equivocarse.

### Semanal (suma de 7 días)
| Modelo | WAPE semanal |
|---|---:|
| RandomForest | 5,5 % |
| HistGradientBoosting | 6,5 % |
| naive_estacional | 8,9 % |
| promedio_dia_semana_8s | 10,4 % |
| media_movil_28 | 11,1 % |

Al agregar a semanas los errores diarios se compensan: el total semanal (lo que importa para
reabastecer) se pronostica con ~5,5 % de error.

### Ejemplo visual
![Pronóstico ejemplo](../reports/figures/04_pronostico_ejemplo.png)

### Importancia de variables (permutación, último fold)
| Variable | Aumento del MAE al desordenarla |
|---|---:|
| prom_dia_semana_4s | 4,44 |
| media_movil_91 | 0,78 |
| lag_49 | 0,57 |
| lag_364 | 0,32 |
| lag_42 | 0,22 |

El modelo se apoya en el nivel reciente por día de la semana, el nivel trimestral y el
comportamiento del año anterior. Las variables de calendario aportan poco por separado porque su
información ya está contenida en los rezagos semanales.

## 7. Pronóstico final e intervalo de predicción

1. Se elige el modelo con menor WAPE (automático en `run_pipeline.py`).
2. Se **reentrena con toda la historia** (hasta el 31-dic-2025).
3. Se pronostican los 28 días de enero 2026 → `pronostico_futuro.csv`.
4. **Intervalo 80 %**: a cada pronóstico se le suman los percentiles 10 y 90 de los errores que ese
   modelo tuvo en el backtest **de esa misma serie**. Es un método empírico: no asume normalidad y
   refleja el desempeño real observado.

## 8. Limitaciones y mejoras posibles

- Datos sintéticos; en la vida real habría faltantes, cambios de catálogo y eventos (brotes, campañas).
- La demanda de 2023 en días de quiebre está **censurada** (se registró lo pedido, pero en la vida
  real muchas veces solo se registra lo despachado). Con datos reales habría que corregirla.
- Variables externas no incluidas: festivos colombianos, programación de cirugías, epidemiología.
- Ajuste de hiperparámetros con búsqueda sistemática (p. ej. `TimeSeriesSplit` + `RandomizedSearchCV`).
- Modelos adicionales: LightGBM, pronóstico jerárquico (reconciliar sede ↔ total), modelos probabilísticos (regresión cuantílica).
- Operación: reentrenar mensualmente y monitorear el WAPE; si se degrada, alertar (*model drift*).

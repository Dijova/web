# 04 · Diccionario de datos

Convenciones: **PK** = llave primaria · **FK** = llave foránea · **UK** = única · "Origen" indica
de dónde sale la columna (CSV crudo, cálculo del ETL o del pipeline de Python).
Moneda: pesos colombianos (COP). Unidades: la unidad de medida de cada producto.

---

## A. Datos de origen (`data/raw/` → `staging`)

### `dim_fecha` — calendario (1 fila por día, 2023-2025)
| Columna | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| fecha | DATE | Día calendario | 2025-03-10 |
| fecha_id | INTEGER | Fecha como número AAAAMMDD | 20250310 |
| anio, mes, trimestre | INTEGER | Componentes de la fecha | 2025, 3, 1 |
| nombre_mes | TEXT | Nombre del mes (en inglés en el origen; el DW lo traduce) | March |
| semana_anio | INTEGER | Semana ISO del año | 11 |
| dia_semana | INTEGER | 1 = lunes … 7 = domingo (ISO) | 1 |
| nombre_dia | TEXT | Nombre del día (en inglés en el origen) | Monday |
| fin_de_semana | BOOLEAN | TRUE si es sábado o domingo | False |

### `dim_producto` — catálogo de insumos (15 filas)
| Columna | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| producto_id | TEXT, PK | Código del insumo | MED-001 |
| producto_nombre | TEXT | Nombre comercial | Guantes de nitrilo talla M |
| categoria | TEXT | Protección, Dispositivos, Curación, Laboratorio, Soluciones, Antisépticos | Protección |
| unidad_medida | TEXT | Presentación en que se cuenta el inventario | Caja x 100 |
| costo_unitario | NUMERIC | Costo por unidad de medida (COP) | 450 |
| lead_time_dias | INTEGER | Tiempo de reposición **planeado** (días) | 12 |
| vida_util_dias | INTEGER | Vida útil desde fabricación (días) | 1095 |
| proveedor_id | TEXT, FK | Proveedor habitual | PROV-001 |

### `dim_proveedor` (5 filas)
| Columna | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| proveedor_id | TEXT, PK | Código del proveedor | PROV-003 |
| proveedor_nombre | TEXT | Razón social | HealthCare Logistics |
| tipo_proveedor | TEXT | Nacional / Internacional | Internacional |

### `dim_ubicacion` (5 filas)
| Columna | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| ubicacion_id | TEXT, PK | Código de la sede | LOC-001 |
| ubicacion_nombre | TEXT | Nombre de la sede | Hospital Central |
| ciudad | TEXT | Municipio | Medellín |
| departamento | TEXT | Departamento | Antioquia |

### `fact_demanda` (82.200 filas; grano día × producto × sede)
| Columna | Tipo | Descripción |
|---|---|---|
| fecha | DATE, PK | Día de la demanda |
| producto_id | TEXT, PK/FK | Insumo |
| ubicacion_id | TEXT, PK/FK | Sede |
| unidades_demandadas | INTEGER | Unidades solicitadas por los servicios ese día (≥ 0) |

### `fact_inventario` (82.200 filas; grano día × producto × sede)
| Columna | Tipo | Descripción | Regla |
|---|---|---|---|
| fecha, producto_id, ubicacion_id | PK | Llave compuesta | |
| inventario_inicial | INTEGER | Existencias al abrir el día | = inventario_final del día anterior |
| entradas | INTEGER | Unidades recibidas ese día | = compras con esa fecha_recepcion |
| salidas | INTEGER | Unidades despachadas/solicitadas | = unidades_demandadas |
| inventario_final | INTEGER | Existencias al cerrar el día | inicial + entradas − salidas (mínimo 0) |
| inventario_reservado | INTEGER | Unidades comprometidas (no despachables) | |
| inventario_disponible | INTEGER | Lo que se puede despachar | final − reservado |

### `fact_compras` (3.000 filas; grano 1 orden)
| Columna | Tipo | Descripción |
|---|---|---|
| fecha_pedido | DATE | Día en que se colocó la orden (cada 28 días) |
| fecha_recepcion | DATE | Día en que llegó a la sede (hasta 2026-01-18: hay 75 órdenes en tránsito al corte) |
| producto_id, ubicacion_id, proveedor_id | TEXT, FK | Qué, dónde y a quién |
| cantidad | INTEGER | Unidades pedidas (> 0) |
| costo_unitario | NUMERIC | Costo pagado por unidad (COP) |
| valor_compra | NUMERIC | cantidad × costo_unitario |

### `fact_lotes` (225 filas; grano 1 lote, foto al corte)
| Columna | Tipo | Descripción |
|---|---|---|
| lote_id | TEXT, PK | Identificador del lote |
| producto_id, ubicacion_id | TEXT, FK | Insumo y sede donde está el lote |
| fecha_ingreso | DATE | Entrada del lote a la sede |
| fecha_vencimiento | DATE | Fecha de caducidad |
| cantidad_inicial | INTEGER | Unidades con que ingresó |
| cantidad_disponible | INTEGER | Unidades que quedan (≤ cantidad_inicial) |

---

## B. Data warehouse (`dw`)

Solo se listan las columnas **nuevas o transformadas** respecto al origen.

| Tabla | Columna | Tipo | Descripción / cálculo | Origen |
|---|---|---|---|---|
| dim_fecha | fecha_key | INTEGER, PK | AAAAMMDD | ETL |
| dim_fecha | anio_mes | TEXT | '2025-03', útil como eje | ETL |
| dim_fecha | nombre_mes, nombre_dia | TEXT | Traducidos al español | ETL |
| dim_fecha | es_historico | BOOLEAN | TRUE si la fecha ≤ último día con datos | ETL |
| dim_producto | producto_key | SERIAL, PK | Llave sustituta | ETL |
| dim_producto | proveedor_key, proveedor_nombre | INT FK, TEXT | Proveedor habitual (FK + nombre desnormalizado) | ETL |
| dim_ubicacion / dim_proveedor | *_key | SERIAL, PK | Llaves sustitutas | ETL |
| fact_inventario_diario | unidades_demandadas | INTEGER | Traída de fact_demanda (mismo grano) | Origen |
| fact_inventario_diario | demanda_insatisfecha | INTEGER | max(0, salidas − (inicial + entradas)) | ETL |
| fact_inventario_diario | dia_quiebre | BOOLEAN | demanda_insatisfecha > 0 | ETL |
| fact_compras | compra_key | SERIAL, PK | Llave sustituta de la orden | ETL |
| fact_compras | fecha_pedido_key, fecha_recepcion_key | INTEGER, FK | Dimensión fecha con dos roles | ETL |
| fact_compras | lead_time_real_dias | SMALLINT | fecha_recepcion − fecha_pedido | ETL |
| fact_lote_snapshot | fecha_corte_key | INTEGER, FK | Día de la foto (31-dic-2025) | ETL |
| fact_lote_snapshot | dias_para_vencer | INTEGER | fecha_vencimiento − fecha_corte (negativo = vencido) | ETL |

## C. Calidad de datos (`dq.resultados`)
| Columna | Descripción |
|---|---|
| ejecucion_ts | Momento de la ejecución (todas las reglas de una corrida comparten el valor) |
| tabla, regla, dimension | Qué se validó y en qué dimensión de calidad |
| severidad | ERROR o ADVERTENCIA |
| registros_evaluados, registros_fallidos | Evidencia cuantitativa |
| estado | Columna generada: OK si no hay fallidos, si no la severidad |

---

## D. Resultados del pipeline de Python (`data/processed/` → `ml`)

### `pronostico_backtest` — predicciones de la validación temporal (42.000 filas)
| Columna | Descripción |
|---|---|
| fecha, producto_id, ubicacion_id | Día y serie evaluada |
| y → `real` en SQL | Demanda real |
| yhat → `pronostico` en SQL | Pronóstico hecho **sin** conocer ese periodo |
| modelo | naive_estacional, media_movil_28, promedio_dia_semana_8s, RandomForest, HistGradientBoosting |
| fold | 1 a 4 (ventana de validación) |

### `pronostico_futuro` — próximos 28 días (2.100 filas = 28 días × 75 series)
| Columna | Descripción |
|---|---|
| yhat (`pronostico`) | Demanda esperada |
| yhat_inf / yhat_sup | Intervalo de predicción empírico 80 % (percentiles 10 y 90 del error del backtest) |
| modelo | Modelo ganador que lo generó |

### `metricas_modelos`, `metricas_modelos_por_fold`, `metricas_modelos_semanal`, `metricas_por_producto`
| Columna | Descripción |
|---|---|
| MAE | Error absoluto medio (unidades) |
| MAPE | Error porcentual absoluto medio (%) |
| WAPE | Σ\|error\| / Σreal (%) — métrica de selección |
| Sesgo_pct | Σ(pronóstico − real) / Σreal (%); + = sobrepronóstico |
| RMSE | Raíz del error cuadrático medio (unidades) |
| n | Observaciones evaluadas |

### `importancia_variables`
| Columna | Descripción |
|---|---|
| variable | Variable de entrada del modelo |
| aumento_mae | Cuánto empeora el MAE al desordenar esa variable (importancia por permutación) |

### `clasificacion_abc`
| Columna | Descripción |
|---|---|
| unidades_12m, valor_consumo_12m | Consumo de los últimos 365 días |
| pct_acumulado | % acumulado del valor (orden descendente) |
| clase_abc | A (≤ 80 %), B (≤ 95 %), C (resto) |

### `politica_inventario` — 1 fila por producto × sede a la fecha de corte
| Columna | Descripción / fórmula |
|---|---|
| clase_abc, nivel_servicio, z | Clase, nivel de servicio objetivo y su factor z de la normal |
| demanda_diaria_pronostico (d) | Promedio del pronóstico de los próximos 28 días |
| sigma_error_diario (σe) | Desviación del error diario del modelo en el backtest |
| lead_time_prom (LT), lead_time_desv (σLT) | Lead time real de las compras |
| demanda_lead_time | d × LT |
| stock_seguridad (SS) | ⌈ z · √(LT·σe² + d²·σLT²) ⌉ |
| punto_reorden (ROP) | ⌈ d·LT + SS ⌉ |
| stock_maximo (S) | ⌈ d·(LT + 28) + SS ⌉ |
| inventario_disponible | Disponible al 31-dic-2025 |
| inventario_en_transito | Unidades pedidas no recibidas al corte |
| proxima_recepcion | Fecha de llegada del próximo pedido en tránsito |
| posicion_inventario | disponible + en tránsito |
| dias_cobertura | disponible / d |
| dias_cobertura_posicion | posición / d |
| cantidad_sugerida | S − posición si posición ≤ ROP; si no, 0 |
| valor_pedido_sugerido | cantidad_sugerida × costo |
| unidades_exceso, valor_exceso | max(0, disponible − S) y su valor |
| estado_inventario | RIESGO_QUIEBRE (disp. ≤ SS) › REORDENAR (posición ≤ ROP) › SOBRESTOCK (disp. > S) › OK |

### `riesgo_vencimiento_lotes` — 1 fila por lote
| Columna | Descripción |
|---|---|
| dias_para_vencer | fecha_vencimiento − fecha de corte |
| unidades_consumidas_proyectadas | Unidades que se consumirán antes de vencer (simulación FEFO al ritmo d) |
| unidades_en_riesgo, valor_en_riesgo | Lo que quedaría sin consumir al vencer, y su valor |
| estado_vencimiento | VENCIDO · RIESGO_ALTO (≤ 90 días y con unidades en riesgo) · RIESGO_PROYECTADO (> 90 días con riesgo) · VENCE_PRONTO_ROTA_A_TIEMPO · OK |

### `alertas` — centro de alertas
| Columna | Descripción |
|---|---|
| alerta_id | Consecutivo ordenado por severidad y valor |
| tipo_alerta | QUIEBRE, REORDEN, SOBRESTOCK, VENCIMIENTO |
| severidad | CRITICA, ALTA, MEDIA |
| lote_id | Solo para alertas de vencimiento |
| unidades, valor | Unidades a pedir / en exceso / en riesgo, y su valor en COP |
| mensaje | Texto accionable para el usuario |

### `kpis_mensuales` — 1 fila por mes × producto × sede
| Columna | Descripción |
|---|---|
| demanda_unidades, entradas_unidades | Totales del mes |
| inventario_promedio | Promedio del inventario final diario |
| dias_quiebre, demanda_insatisfecha | Quiebres del mes |
| rotacion_mensual | demanda / inventario promedio |
| dias_inventario | inventario promedio / demanda diaria promedio |
| fill_rate | 1 − insatisfecha / demanda |
| valor_demanda, valor_inventario_promedio | En COP |

### `reporte_calidad_datos`
Mismas columnas que `dq.resultados` más `pct_fallidos` y `descripcion` (explicación de la regla).

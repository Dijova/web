# 10 · Glosario

| Término | Definición |
|---|---|
| **ABC (clasificación)** | Agrupación de productos por su peso en el valor consumido (Pareto): A = pocos productos con mucho valor. |
| **Backtesting** | Simular el pronóstico en el pasado, como si se hubiera hecho en ese momento, para medir su precisión real. |
| **Baseline (modelo base)** | Regla simple de referencia contra la que se compara un modelo más complejo. |
| **Cobertura (días de)** | Días que dura el inventario al ritmo de demanda actual. |
| **Data leakage (fuga de información)** | Usar en el entrenamiento información que no estaría disponible al pronosticar. Infla las métricas. |
| **Dimensión** | Tabla descriptiva del modelo dimensional (producto, sede, fecha). |
| **Dimensión degenerada** | Identificador que vive en la tabla de hechos sin tabla propia (`lote_id`). |
| **DOH (days on hand)** | Días de inventario = 365 / rotación anual. |
| **ETL** | *Extract, Transform, Load*: extraer, transformar y cargar datos. |
| **FEFO** | *First Expired, First Out*: despachar primero lo que vence primero. |
| **Fill rate** | % de la demanda que se atendió con el inventario disponible. |
| **Fold** | Cada una de las ventanas de validación en el backtesting. |
| **Grano** | Nivel de detalle de una fila en una tabla de hechos. |
| **Hecho** | Tabla con medidas numéricas de un evento (demanda, compras). |
| **Horizonte** | Cuántos periodos hacia adelante se pronostica (28 días). |
| **Lag (rezago)** | Valor de la variable k periodos atrás (`lag_28` = hace 28 días). |
| **Lead time** | Tiempo entre colocar un pedido y recibirlo. |
| **MAE / MAPE / WAPE / RMSE / Sesgo** | Métricas de error del pronóstico; ver [05](05_pronostico_demanda.md#5-métricas). |
| **Modelo global** | Un único modelo entrenado con todas las series a la vez. |
| **Nivel de servicio** | Probabilidad objetivo de no quebrar stock durante el lead time. |
| **Periodo de revisión (R)** | Cada cuánto se revisa el inventario y se decide pedir (28 días). |
| **Posición de inventario** | Disponible + en tránsito (lo que tengo + lo que ya viene). |
| **Punto de reorden (ROP)** | Nivel de inventario que dispara un pedido: demanda del lead time + SS. |
| **Quiebre de stock** | Falta de inventario para atender la demanda. |
| **Rotación** | Veces que el inventario se consume y repone en un periodo. |
| **SCD tipo 2** | Técnica para guardar el histórico de cambios de una dimensión creando nuevas filas. |
| **Snapshot** | Tabla de hechos que guarda la "foto" de un estado en una fecha. |
| **Sobrestock** | Inventario por encima del máximo recomendado. |
| **Staging** | Capa donde se copian los datos crudos antes de transformarlos. |
| **Stock de seguridad (SS)** | Inventario extra para absorber la incertidumbre de demanda y lead time. |
| **Stock máximo (S)** | Nivel al que se repone el inventario en cada pedido. |
| **Surrogate key (llave sustituta)** | Llave entera generada por el DW, sin significado de negocio. |
| **z (factor de servicio)** | Número de desviaciones estándar de la normal que corresponde al nivel de servicio. |

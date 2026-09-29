# Medidas DAX del tablero HealthSupply AI

Crea una tabla vacía llamada **`_Medidas`** (Inicio → Especificar datos → Cargar) y agrega ahí
todas las medidas (Modelado → Nueva medida). Tenerlas en una tabla aparte las mantiene ordenadas.
Organízalas en carpetas de visualización (panel Propiedades → *Display folder*) con los nombres de
las secciones de este documento.

> **Conceptos DAX clave que aparecen aquí**
> - `SUM`, `AVERAGE`, `DIVIDE`: agregaciones básicas (`DIVIDE` evita errores de división entre cero).
> - `CALCULATE(expresión, filtros)`: evalúa la expresión cambiando el contexto de filtro. Es la función más importante de DAX.
> - **Medidas semiaditivas**: el inventario es un *saldo*, no se puede sumar a lo largo del tiempo (sumar el saldo de 31 días no tiene sentido). Por eso se toma el valor del **último día** o el **promedio diario**.
> - `VAR ... RETURN`: variables para legibilidad y para no calcular dos veces lo mismo.
> - `USERELATIONSHIP`: activa una relación inactiva solo dentro de una medida (dimensión fecha con dos roles).

---

## 1. Inventario y cobertura (tabla `fact_inventario_diario`)

```dax
Demanda (u) =
SUM ( fact_inventario_diario[unidades_demandadas] )

Ultima Fecha con Datos =
CALCULATE ( MAX ( fact_inventario_diario[fecha] ) )

-- Saldo al cierre del periodo filtrado (semiaditiva: último día, no suma de días)
Inventario Disponible Cierre (u) =
VAR UltimaFecha = [Ultima Fecha con Datos]
RETURN
    CALCULATE (
        SUM ( fact_inventario_diario[inventario_disponible] ),
        dim_fecha[fecha] = UltimaFecha
    )

Valor Inventario Cierre =
VAR UltimaFecha = [Ultima Fecha con Datos]
RETURN
    CALCULATE (
        SUM ( fact_inventario_diario[valor_inventario_disponible] ),
        dim_fecha[fecha] = UltimaFecha
    )

-- Demanda diaria promedio de los 28 días que terminan en el cierre del periodo
Demanda Diaria 28d (u) =
VAR UltimaFecha = [Ultima Fecha con Datos]
RETURN
    CALCULATE (
        DIVIDE ( SUM ( fact_inventario_diario[unidades_demandadas] ), 28 ),
        DATESINPERIOD ( dim_fecha[fecha], UltimaFecha, -28, DAY )
    )

Dias de Cobertura =
DIVIDE ( [Inventario Disponible Cierre (u)], [Demanda Diaria 28d (u)] )

-- Promedio de los saldos diarios (para rotación)
Inventario Promedio (u) =
AVERAGEX (
    VALUES ( dim_fecha[fecha] ),
    CALCULATE ( SUM ( fact_inventario_diario[inventario_final] ) )
)

Valor Inventario Promedio =
AVERAGEX (
    VALUES ( dim_fecha[fecha] ),
    CALCULATE ( SUM ( fact_inventario_diario[valor_inventario_final] ) )
)
```

## 2. Rotación y servicio

```dax
Costo del Consumo =
SUM ( fact_inventario_diario[valor_consumo] )

-- Veces que el inventario "se renueva" en el periodo filtrado
Rotacion (periodo) =
DIVIDE ( [Costo del Consumo], [Valor Inventario Promedio] )

-- Llevada a 1 año para comparar periodos de distinta duración
Rotacion Anualizada =
VAR Dias = CALCULATE ( DISTINCTCOUNT ( fact_inventario_diario[fecha] ) )
RETURN
    [Rotacion (periodo)] * DIVIDE ( 365, Dias )

Dias de Inventario (DOH) =
DIVIDE ( 365, [Rotacion Anualizada] )

Dias de Quiebre =
SUM ( fact_inventario_diario[dia_quiebre] )

Demanda Insatisfecha (u) =
SUM ( fact_inventario_diario[demanda_insatisfecha] )

Fill Rate =
1 - DIVIDE ( [Demanda Insatisfecha (u)], [Demanda (u)] )
```

## 3. Precisión del pronóstico (tabla `fact_pronostico_backtest`)

```dax
Real (u) =
SUM ( fact_pronostico_backtest[real] )

Pronostico (u) =
SUM ( fact_pronostico_backtest[pronostico] )

MAE =
AVERAGE ( fact_pronostico_backtest[error_absoluto] )

MAPE =
AVERAGEX (
    fact_pronostico_backtest,
    DIVIDE ( fact_pronostico_backtest[error_absoluto], fact_pronostico_backtest[real] )
)

WAPE =
DIVIDE (
    SUM ( fact_pronostico_backtest[error_absoluto] ),
    SUM ( fact_pronostico_backtest[real] )
)

Precision (1 - WAPE) =
1 - [WAPE]

Sesgo % =
DIVIDE ( SUM ( fact_pronostico_backtest[error] ), SUM ( fact_pronostico_backtest[real] ) )

-- Compara el modelo ganador contra el mejor modelo base, respetando los demás filtros
Mejora vs Modelo Base =
VAR WapeML =
    CALCULATE ( [WAPE], fact_pronostico_backtest[modelo] = "RandomForest" )
VAR WapeBase =
    CALCULATE ( [WAPE], fact_pronostico_backtest[modelo] = "promedio_dia_semana_8s" )
RETURN
    DIVIDE ( WapeBase - WapeML, WapeBase )

-- Pronóstico futuro (tabla fact_pronostico_futuro)
Pronostico Futuro (u) =
SUM ( fact_pronostico_futuro[pronostico] )

Pronostico Limite Inferior (u) =
SUM ( fact_pronostico_futuro[pronostico_inf] )

Pronostico Limite Superior (u) =
SUM ( fact_pronostico_futuro[pronostico_sup] )
```

> Si cambia el modelo ganador en una ejecución futura, actualiza el nombre en `Mejora vs Modelo Base`
> (o toma el nombre de `metricas_modelos` con `TOPN(1, ..., [wape], ASC)` como ejercicio).

## 4. Política de inventario (tabla `fact_politica_inventario`)

```dax
Stock de Seguridad (u) =
SUM ( fact_politica_inventario[stock_seguridad] )

Punto de Reorden (u) =
SUM ( fact_politica_inventario[punto_reorden] )

Stock Maximo (u) =
SUM ( fact_politica_inventario[stock_maximo] )

Cantidad Sugerida (u) =
SUM ( fact_politica_inventario[cantidad_sugerida] )

Valor Pedido Sugerido =
SUM ( fact_politica_inventario[valor_pedido_sugerido] )

Valor en Sobrestock =
SUM ( fact_politica_inventario[valor_exceso] )

Cobertura Actual vs Politica (dias) =
DIVIDE (
    SUM ( fact_politica_inventario[inventario_disponible] ),
    SUM ( fact_politica_inventario[demanda_diaria_pronostico] )
)

Cobertura Maxima Politica (dias) =
DIVIDE (
    SUM ( fact_politica_inventario[stock_maximo] ),
    SUM ( fact_politica_inventario[demanda_diaria_pronostico] )
)

Series en Sobrestock =
CALCULATE (
    COUNTROWS ( fact_politica_inventario ),
    fact_politica_inventario[estado_inventario] = "SOBRESTOCK"
)

Series por Reordenar =
CALCULATE (
    COUNTROWS ( fact_politica_inventario ),
    fact_politica_inventario[estado_inventario] IN { "REORDENAR", "RIESGO_QUIEBRE" }
)
```

## 5. Riesgo de vencimiento (tabla `fact_lotes`)

```dax
Valor en Riesgo de Vencimiento =
SUM ( fact_lotes[valor_en_riesgo] )

Unidades en Riesgo =
SUM ( fact_lotes[unidades_en_riesgo] )

Lotes Vencidos =
CALCULATE ( COUNTROWS ( fact_lotes ), fact_lotes[estado_vencimiento] = "VENCIDO" )

Lotes en Riesgo (no vencidos) =
CALCULATE (
    COUNTROWS ( fact_lotes ),
    fact_lotes[estado_vencimiento] IN { "RIESGO_ALTO", "RIESGO_PROYECTADO" }
)

% Valor en Riesgo =
DIVIDE ( [Valor en Riesgo de Vencimiento], SUM ( fact_lotes[valor_disponible] ) )
```

## 6. Alertas y compras

```dax
Alertas =
COUNTROWS ( fact_alertas )

Alertas Criticas =
CALCULATE ( COUNTROWS ( fact_alertas ), fact_alertas[severidad] = "CRITICA" )

Lead Time Real Promedio (dias) =
AVERAGE ( fact_compras[lead_time_real_dias] )

% Entregas a Tiempo =
DIVIDE (
    COUNTROWS ( FILTER ( fact_compras,
        fact_compras[lead_time_real_dias] <= fact_compras[lead_time_planeado_dias] ) ),
    COUNTROWS ( fact_compras )
)

-- La relación activa es por fecha de pedido; esta medida usa la fecha de recepción
Compras Recibidas (valor) =
CALCULATE (
    SUM ( fact_compras[valor_compra] ),
    USERELATIONSHIP ( fact_compras[fecha_recepcion], dim_fecha[fecha] )
)
```

## 7. Calidad de datos (tabla `calidad_datos`)

```dax
Reglas Evaluadas =
COUNTROWS ( calidad_datos )

% Reglas OK =
DIVIDE (
    CALCULATE ( COUNTROWS ( calidad_datos ), calidad_datos[estado] = "OK" ),
    [Reglas Evaluadas]
)
```

## Formatos recomendados

| Medida | Formato |
|---|---|
| Valores en COP | Moneda, 0 decimales; en tarjetas usar "Millones" |
| WAPE, MAPE, Sesgo %, Fill Rate, % Reglas OK, Mejora vs Modelo Base | Porcentaje, 1 decimal |
| Días de cobertura, DOH, lead time | Número, 0-1 decimales |
| Rotación | Número, 2 decimales, sufijo "x" |

# 01 · Contexto de negocio y objetivos

## El problema

Una red de salud en Antioquia (1 hospital, 2 clínicas y 2 centros médicos) gestiona 15 insumos
médicos de alta rotación: guantes, jeringas, catéteres, gasas, tubos de laboratorio, solución
salina, etc. Hoy las compras se hacen por costumbre: **un pedido cada 28 días** con cantidades
decididas "a ojo".

Eso produce los dos errores clásicos de inventario:

| Error | Consecuencia en salud | Consecuencia financiera |
|---|---|---|
| **Quiebre de stock** (faltan insumos) | Se cancelan procedimientos, riesgo para el paciente | Compras urgentes más caras |
| **Sobrestock** (sobran insumos) | Lotes que **vencen** y deben destruirse | Capital inmovilizado, costo de almacenamiento |

Los datos muestran exactamente esta oscilación: en 2023 hubo **46 días de quiebre**; después se
compró de más y en 2025 la cobertura llegó a **~130 días** con **71 lotes vencidos** en bodega.

## Preguntas de negocio que responde el proyecto

1. ¿Cuánto se va a demandar de cada insumo en cada sede las próximas 4 semanas?
2. ¿Qué tan confiable es ese pronóstico? ¿Mejora frente a un método simple?
3. ¿Cuánto **stock de seguridad** necesito para un nivel de servicio objetivo?
4. ¿**Cuándo** debo pedir (punto de reorden) y **cuánto**?
5. ¿Qué productos están en riesgo de **quiebre**, en **sobrestock** o en riesgo de **vencimiento**?
6. ¿Cómo evolucionan la **cobertura**, la **rotación** y la **precisión del pronóstico**?

## Alcance del proyecto (lo que se construye)

| Componente | Herramienta | Entregable |
|---|---|---|
| Calidad de datos | Python + SQL | 46 reglas en Python, 34 en SQL, reporte con evidencia |
| Modelo dimensional | PostgreSQL | Esquema estrella + diccionario de datos |
| Pronóstico de demanda | Python, scikit-learn | Backtesting, 3 modelos base vs. 2 de ML, métricas MAE/MAPE/WAPE |
| Política de inventario | Python | ABC, stock de seguridad, punto de reorden, stock máximo, cantidad sugerida |
| Alertas | Python + SQL | Quiebre, reorden, sobrestock y vencimiento (FEFO) |
| Tablero | Power BI | Cobertura, rotación, riesgo de vencimiento, precisión del pronóstico |

## KPIs y su definición

| KPI | Fórmula | Pregunta que responde |
|---|---|---|
| **Días de cobertura** | inventario disponible / demanda diaria promedio | ¿Cuántos días aguanto sin recibir nada? |
| **Rotación** | costo de lo consumido / valor del inventario promedio | ¿Cuántas veces al año "renuevo" el inventario? |
| **Días de inventario (DOH)** | 365 / rotación anual | Versión en días de la rotación |
| **Fill rate** (nivel de servicio real) | 1 − demanda insatisfecha / demanda total | ¿Qué % de lo pedido pude entregar? |
| **Días de quiebre** | días con demanda insatisfecha > 0 | ¿Cuántas veces me quedé sin stock? |
| **Valor en riesgo de vencimiento** | unidades que no alcanzarán a consumirse antes de vencer × costo | ¿Cuánto dinero voy a perder por vencimientos? |
| **Valor de sobrestock** | (disponible − stock máximo) × costo | ¿Cuánto capital sobra en bodega? |
| **MAE / MAPE / WAPE / Sesgo** | ver [05_pronostico_demanda.md](05_pronostico_demanda.md) | ¿Qué tan bueno es el pronóstico? |

## Supuestos principales

- **Fecha de corte** ("hoy"): 31-dic-2025, último día con datos.
- **Horizonte de pronóstico**: 28 días (4 semanas completas, cubre el lead time máximo de 20 días).
- **Periodo de revisión**: 28 días (el ritmo de pedidos observado en `fact_compras`).
- **Niveles de servicio** por clase ABC: A = 98 %, B = 95 %, C = 90 %.
- Los datos son **sintéticos**: sirven para aprender el método completo; las cifras no representan una institución real.

Todos estos supuestos están centralizados en [`src/healthsupply/config.py`](../src/healthsupply/config.py).

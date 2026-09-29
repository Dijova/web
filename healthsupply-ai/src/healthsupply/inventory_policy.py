"""
Política de inventario: clasificación ABC, stock de seguridad, punto de reorden
y cantidad sugerida de pedido.

Fórmulas (explicadas paso a paso en docs/06_politica_inventario.md)
--------------------------------------------------------------------
    d      = demanda diaria esperada (promedio del pronóstico de los próximos 28 días)
    sigma_e = desviación estándar del ERROR diario del pronóstico (del backtest)
    LT     = lead time promedio real (días entre pedido y recepción)
    sigma_LT = desviación estándar del lead time real
    z      = valor de la normal estándar para el nivel de servicio (p. ej. 95 % -> 1.645)

    Stock de seguridad   SS  = z * raíz( LT * sigma_e^2  +  d^2 * sigma_LT^2 )
    Punto de reorden     ROP = d * LT + SS
    Stock máximo         S   = d * (LT + R) + SS          (R = periodo de revisión)
    Posición de inventario   = disponible + en tránsito (pedido colocado, aún no recibido)
    Cantidad sugerida        = S - posición, solo si posición <= ROP

¿Por qué usar el error del pronóstico (sigma_e) y no la desviación de la demanda?
Porque el stock de seguridad protege contra lo que NO sabemos. Si el modelo ya
anticipa que los lunes se vende más, esa variación no es incertidumbre. Un mejor
pronóstico -> menor sigma_e -> menos stock de seguridad -> menos capital inmovilizado.
Ese es el vínculo directo entre la precisión del modelo y el dinero.
"""

from __future__ import annotations

from statistics import NormalDist

import numpy as np
import pandas as pd

from .config import (CORTE_ABC_A, CORTE_ABC_B, FACTOR_SOBRESTOCK, FECHA_CORTE,
                     NIVEL_SERVICIO_ABC, PERIODO_REVISION_DIAS)

LLAVES = ["producto_id", "ubicacion_id"]


def clasificacion_abc(demanda: pd.DataFrame, productos: pd.DataFrame,
                      fecha_corte=FECHA_CORTE) -> pd.DataFrame:
    """
    ABC por valor consumido en los últimos 365 días (principio de Pareto):
    A = productos que suman el primer 80 % del valor, B = hasta 95 %, C = el resto.
    """
    ultimo_anio = demanda[demanda["fecha"] > fecha_corte - pd.Timedelta(days=365)]
    valor = (ultimo_anio.groupby("producto_id")["unidades_demandadas"].sum().rename("unidades_12m")
             .reset_index().merge(productos[["producto_id", "costo_unitario"]], on="producto_id"))
    valor["valor_consumo_12m"] = valor["unidades_12m"] * valor["costo_unitario"]
    valor = valor.sort_values("valor_consumo_12m", ascending=False)
    valor["pct_acumulado"] = valor["valor_consumo_12m"].cumsum() / valor["valor_consumo_12m"].sum()
    # Se evalúa el % acumulado ANTES de sumar el producto: el que cruza el 80 % aún es A.
    previo = valor["pct_acumulado"] - valor["valor_consumo_12m"] / valor["valor_consumo_12m"].sum()
    valor["clase_abc"] = np.select([previo < CORTE_ABC_A, previo < CORTE_ABC_B], ["A", "B"], "C")
    return valor[["producto_id", "unidades_12m", "valor_consumo_12m", "pct_acumulado", "clase_abc"]]


def estadisticas_lead_time(compras: pd.DataFrame) -> pd.DataFrame:
    """Lead time real por producto (promedio y desviación) a partir de las compras recibidas."""
    lt = compras.assign(lt=(compras["fecha_recepcion"] - compras["fecha_pedido"]).dt.days)
    return (lt.groupby("producto_id")["lt"].agg(lead_time_prom="mean", lead_time_desv="std")
            .reset_index())


def inventario_en_transito(compras: pd.DataFrame, fecha_corte=FECHA_CORTE) -> pd.DataFrame:
    """Unidades pedidas en o antes del corte que aún no se han recibido."""
    abiertas = compras[(compras["fecha_pedido"] <= fecha_corte) & (compras["fecha_recepcion"] > fecha_corte)]
    return (abiertas.groupby(LLAVES).agg(inventario_en_transito=("cantidad", "sum"),
                                         proxima_recepcion=("fecha_recepcion", "min"))
            .reset_index())


def calcular_politica(pronostico: pd.DataFrame, errores_backtest: pd.DataFrame,
                      inventario: pd.DataFrame, compras: pd.DataFrame, demanda: pd.DataFrame,
                      productos: pd.DataFrame, fecha_corte=FECHA_CORTE) -> pd.DataFrame:
    """
    Calcula la política de inventario para cada producto x ubicación a la fecha de corte.

    - `pronostico`: salida de `pronosticar_futuro` (fecha, producto_id, ubicacion_id, yhat).
    - `errores_backtest`: filas del backtest del modelo ganador (y, yhat).
    """
    d = pronostico.groupby(LLAVES)["yhat"].mean().rename("demanda_diaria_pronostico").reset_index()
    sigma = (errores_backtest.assign(e=errores_backtest["y"] - errores_backtest["yhat"])
             .groupby(LLAVES)["e"].std().rename("sigma_error_diario").reset_index())
    foto = inventario[inventario["fecha"] == fecha_corte][[*LLAVES, "inventario_disponible"]]

    p = (d.merge(sigma, on=LLAVES)
         .merge(foto, on=LLAVES)
         .merge(inventario_en_transito(compras, fecha_corte), on=LLAVES, how="left")
         .merge(productos[["producto_id", "producto_nombre", "categoria", "costo_unitario"]], on="producto_id")
         .merge(estadisticas_lead_time(compras), on="producto_id")
         .merge(clasificacion_abc(demanda, productos, fecha_corte)[["producto_id", "clase_abc"]],
                on="producto_id"))
    p["inventario_en_transito"] = p["inventario_en_transito"].fillna(0).astype(int)

    # Paso 1: nivel de servicio y factor z de la distribución normal.
    p["nivel_servicio"] = p["clase_abc"].map(NIVEL_SERVICIO_ABC)
    p["z"] = p["nivel_servicio"].apply(NormalDist().inv_cdf)

    # Paso 2: stock de seguridad (incertidumbre de demanda + incertidumbre de lead time).
    dd, lt = p["demanda_diaria_pronostico"], p["lead_time_prom"]
    p["demanda_lead_time"] = dd * lt
    p["stock_seguridad"] = np.ceil(p["z"] * np.sqrt(lt * p["sigma_error_diario"] ** 2
                                                   + dd ** 2 * p["lead_time_desv"] ** 2))

    # Paso 3: punto de reorden y stock máximo.
    p["punto_reorden"] = np.ceil(p["demanda_lead_time"] + p["stock_seguridad"])
    p["stock_maximo"] = np.ceil(dd * (lt + PERIODO_REVISION_DIAS) + p["stock_seguridad"])

    # Paso 4: situación actual.
    p["posicion_inventario"] = p["inventario_disponible"] + p["inventario_en_transito"]
    p["dias_cobertura"] = p["inventario_disponible"] / dd
    p["dias_cobertura_posicion"] = p["posicion_inventario"] / dd

    # Paso 5: ¿hay que pedir? ¿cuánto?
    pedir = p["posicion_inventario"] <= p["punto_reorden"]
    p["cantidad_sugerida"] = np.where(pedir, p["stock_maximo"] - p["posicion_inventario"], 0).astype(int)
    p["valor_pedido_sugerido"] = p["cantidad_sugerida"] * p["costo_unitario"]

    # Paso 6: capital inmovilizado por encima del stock máximo.
    exceso = (p["inventario_disponible"] - p["stock_maximo"]).clip(lower=0)
    p["unidades_exceso"] = exceso.astype(int)
    p["valor_exceso"] = exceso * p["costo_unitario"]

    # Paso 7: estado del inventario (una sola etiqueta, en orden de prioridad).
    p["estado_inventario"] = np.select(
        [p["inventario_disponible"] <= p["stock_seguridad"],
         pedir,
         p["inventario_disponible"] > p["stock_maximo"] * FACTOR_SOBRESTOCK],
        ["RIESGO_QUIEBRE", "REORDENAR", "SOBRESTOCK"], "OK")
    p["fecha_corte"] = fecha_corte

    columnas = ["fecha_corte", *LLAVES, "producto_nombre", "categoria", "clase_abc", "nivel_servicio", "z",
                "costo_unitario", "demanda_diaria_pronostico", "sigma_error_diario", "lead_time_prom",
                "lead_time_desv", "demanda_lead_time", "stock_seguridad", "punto_reorden", "stock_maximo",
                "inventario_disponible", "inventario_en_transito", "proxima_recepcion", "posicion_inventario",
                "dias_cobertura", "dias_cobertura_posicion", "cantidad_sugerida", "valor_pedido_sugerido",
                "unidades_exceso", "valor_exceso", "estado_inventario"]
    return p[columnas].sort_values(LLAVES).reset_index(drop=True)

"""
KPIs históricos de inventario (los mismos que calcula la vista SQL `analytics.v_kpi_mensual`).

Definiciones
------------
- **Inventario promedio**: promedio del inventario final diario del mes.
- **Rotación** (veces en el periodo) = unidades consumidas / inventario promedio.
  Alta rotación = el inventario "se renueva" rápido. Baja rotación = capital quieto.
- **Días de inventario (DOH, days on hand)** = inventario promedio / demanda diaria promedio.
  Es la cobertura: cuántos días duraría el stock si no llegara nada más.
- **Día de quiebre**: día en que la demanda superó el stock (inventario final = 0 y
  el balance inicial + entradas - salidas quedó negativo).
- **Demanda insatisfecha**: unidades que se pidieron pero no había para entregar.
- **Nivel de servicio (fill rate)** = 1 - demanda insatisfecha / demanda total.
"""

from __future__ import annotations

import pandas as pd


def kpis_mensuales(inventario: pd.DataFrame, productos: pd.DataFrame) -> pd.DataFrame:
    inv = inventario.merge(productos[["producto_id", "costo_unitario"]], on="producto_id")
    stock_posible = inv["inventario_inicial"] + inv["entradas"]
    inv["demanda_insatisfecha"] = (inv["salidas"] - stock_posible).clip(lower=0)
    inv["dia_quiebre"] = (inv["demanda_insatisfecha"] > 0).astype(int)
    inv["mes"] = inv["fecha"].dt.to_period("M").dt.to_timestamp()

    k = (inv.groupby(["mes", "producto_id", "ubicacion_id"])
         .agg(dias=("fecha", "nunique"), demanda_unidades=("salidas", "sum"),
              inventario_promedio=("inventario_final", "mean"),
              inventario_disponible_cierre=("inventario_disponible", "last"),
              entradas_unidades=("entradas", "sum"), dias_quiebre=("dia_quiebre", "sum"),
              demanda_insatisfecha=("demanda_insatisfecha", "sum"),
              costo_unitario=("costo_unitario", "first"))
         .reset_index())
    k["demanda_diaria_prom"] = k["demanda_unidades"] / k["dias"]
    k["rotacion_mensual"] = k["demanda_unidades"] / k["inventario_promedio"]
    k["dias_inventario"] = k["inventario_promedio"] / k["demanda_diaria_prom"]
    k["fill_rate"] = 1 - k["demanda_insatisfecha"] / k["demanda_unidades"]
    k["valor_demanda"] = k["demanda_unidades"] * k["costo_unitario"]
    k["valor_inventario_promedio"] = k["inventario_promedio"] * k["costo_unitario"]
    return k

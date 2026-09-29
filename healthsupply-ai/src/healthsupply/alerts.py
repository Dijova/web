"""
Alertas de inventario: quiebre, reorden, sobrestock y vencimiento.

Cada alerta es una fila con: tipo, severidad, producto, ubicación, (lote), unidades,
valor en riesgo y un mensaje legible. Esta tabla alimenta la página de alertas
del tablero de Power BI.

Riesgo de vencimiento con lógica FEFO
-------------------------------------
FEFO = *First Expired, First Out*: en salud se despacha primero lo que vence primero.
Para cada producto x ubicación se ordenan los lotes por fecha de vencimiento y se
simula el consumo al ritmo de la demanda pronosticada:

    lote 1 (vence en 40 días, 300 u) -> con 5 u/día se consumen 200 u antes de vencer
                                        -> 100 u en RIESGO de vencerse
    lote 2 (vence en 200 días, 500 u) -> empieza a consumirse el día 40
                                        -> cabe consumirlo -> sin riesgo

Así distinguimos un lote que "vence pronto" pero rota rápido (sin problema) de uno que
realmente se va a perder (hay que trasladarlo a otra sede, devolverlo o usarlo primero).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .config import DIAS_ALERTA_VENCIMIENTO, FECHA_CORTE

LLAVES = ["producto_id", "ubicacion_id"]


def riesgo_vencimiento(lotes: pd.DataFrame, demanda_diaria: pd.DataFrame, productos: pd.DataFrame,
                       fecha_corte=FECHA_CORTE) -> pd.DataFrame:
    """
    Simula consumo FEFO por lote. `demanda_diaria` tiene producto_id, ubicacion_id,
    demanda_diaria_pronostico. Devuelve una fila por lote con las unidades en riesgo.
    """
    df = (lotes.merge(demanda_diaria, on=LLAVES, how="left")
          .merge(productos[["producto_id", "costo_unitario"]], on="producto_id"))
    df["dias_para_vencer"] = (df["fecha_vencimiento"] - fecha_corte).dt.days
    df = df.sort_values([*LLAVES, "fecha_vencimiento"])

    consumidas = []
    for _, g in df.groupby(LLAVES, sort=False):
        t = 0.0  # día (desde el corte) en que se termina de consumir el lote anterior
        for dias, qty, d in zip(g["dias_para_vencer"], g["cantidad_disponible"],
                                g["demanda_diaria_pronostico"]):
            if dias <= 0 or d <= 0:          # ya vencido: no se puede consumir nada
                consumidas.append(0.0)
                continue
            ventana = max(0.0, dias - t)      # días que tiene este lote para rotar
            usado = min(qty, d * ventana)
            consumidas.append(usado)
            t += usado / d
    df["unidades_consumidas_proyectadas"] = np.floor(consumidas)
    df["unidades_en_riesgo"] = (df["cantidad_disponible"] - df["unidades_consumidas_proyectadas"]).astype(int)
    df["valor_en_riesgo"] = df["unidades_en_riesgo"] * df["costo_unitario"]

    df["estado_vencimiento"] = np.select(
        [df["dias_para_vencer"] <= 0,
         (df["dias_para_vencer"] <= DIAS_ALERTA_VENCIMIENTO) & (df["unidades_en_riesgo"] > 0),
         df["unidades_en_riesgo"] > 0,
         df["dias_para_vencer"] <= DIAS_ALERTA_VENCIMIENTO],
        ["VENCIDO", "RIESGO_ALTO", "RIESGO_PROYECTADO", "VENCE_PRONTO_ROTA_A_TIEMPO"], "OK")
    return df.drop(columns=["costo_unitario"]).reset_index(drop=True)


def generar_alertas(politica: pd.DataFrame, lotes_riesgo: pd.DataFrame) -> pd.DataFrame:
    """Une las alertas de la política de inventario y las de vencimiento en una sola tabla."""
    alertas = []
    for _, r in politica.iterrows():
        base = {"producto_id": r["producto_id"], "ubicacion_id": r["ubicacion_id"],
                "producto_nombre": r["producto_nombre"], "lote_id": None}
        if r["estado_inventario"] == "RIESGO_QUIEBRE":
            alertas.append({**base, "tipo_alerta": "QUIEBRE", "severidad": "CRITICA",
                            "unidades": int(r["cantidad_sugerida"]), "valor": r["valor_pedido_sugerido"],
                            "mensaje": f"Disponible ({r['inventario_disponible']:.0f}) por debajo del stock "
                                       f"de seguridad ({r['stock_seguridad']:.0f}); cobertura de "
                                       f"{r['dias_cobertura']:.1f} días. Pedir {r['cantidad_sugerida']} u."})
        elif r["estado_inventario"] == "REORDENAR":
            alertas.append({**base, "tipo_alerta": "REORDEN", "severidad": "ALTA",
                            "unidades": int(r["cantidad_sugerida"]), "valor": r["valor_pedido_sugerido"],
                            "mensaje": f"Posición ({r['posicion_inventario']:.0f}) <= punto de reorden "
                                       f"({r['punto_reorden']:.0f}). Pedir {r['cantidad_sugerida']} u."})
        elif r["estado_inventario"] == "SOBRESTOCK":
            alertas.append({**base, "tipo_alerta": "SOBRESTOCK", "severidad": "MEDIA",
                            "unidades": int(r["unidades_exceso"]), "valor": r["valor_exceso"],
                            "mensaje": f"{r['dias_cobertura']:.0f} días de cobertura; "
                                       f"{r['unidades_exceso']} u sobre el stock máximo "
                                       f"({r['stock_maximo']:.0f}). No pedir; evaluar traslado."})

    severidad = {"VENCIDO": "CRITICA", "RIESGO_ALTO": "ALTA", "RIESGO_PROYECTADO": "MEDIA"}
    for _, r in lotes_riesgo[lotes_riesgo["estado_vencimiento"].isin(severidad)].iterrows():
        if r["estado_vencimiento"] == "VENCIDO":
            msg = (f"Lote vencido hace {-r['dias_para_vencer']} días con {r['cantidad_disponible']} u. "
                   f"Retirar y dar de baja.")
        else:
            msg = (f"Vence en {r['dias_para_vencer']} días; al ritmo actual quedarían "
                   f"{r['unidades_en_riesgo']} u sin consumir. Priorizar despacho o trasladar.")
        alertas.append({"producto_id": r["producto_id"], "ubicacion_id": r["ubicacion_id"],
                        "producto_nombre": None, "lote_id": r["lote_id"], "tipo_alerta": "VENCIMIENTO",
                        "severidad": severidad[r["estado_vencimiento"]],
                        "unidades": int(r["unidades_en_riesgo"]), "valor": r["valor_en_riesgo"],
                        "mensaje": msg})

    out = pd.DataFrame(alertas)
    nombres = politica.drop_duplicates("producto_id").set_index("producto_id")["producto_nombre"]
    out["producto_nombre"] = out["producto_id"].map(nombres)
    orden = {"CRITICA": 0, "ALTA": 1, "MEDIA": 2}
    out = out.sort_values(["severidad", "valor"], key=lambda s: s.map(orden) if s.name == "severidad" else -s)
    out.insert(0, "alerta_id", range(1, len(out) + 1))
    out.insert(1, "fecha_corte", FECHA_CORTE)
    return out.reset_index(drop=True)

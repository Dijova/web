"""
Exporta a data/powerbi/ las mismas tablas que exponen las vistas `analytics.*` de PostgreSQL,
para construir el tablero de Power BI SIN necesidad de instalar PostgreSQL (modo CSV).

Uso (desde healthsupply-ai/, después de run_pipeline.py):

    python scripts/exportar_powerbi.py

Las columnas y nombres de archivo coinciden con las vistas de sql/07_vistas_analytics.sql,
así que las medidas DAX de powerbi/medidas_dax.md funcionan igual en ambos modos.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from healthsupply.config import DATA_PROCESSED, PROJECT_ROOT  # noqa: E402
from healthsupply.data_loading import cargar_todo  # noqa: E402

SALIDA = PROJECT_ROOT / "data" / "powerbi"
MODELOS_ML = ["RandomForest", "HistGradientBoosting"]
MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre",
         "Octubre", "Noviembre", "Diciembre"]
DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


def leer(nombre, fechas=()):
    return pd.read_csv(DATA_PROCESSED / f"{nombre}.csv", parse_dates=list(fechas))


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    t = cargar_todo()
    prod, inv = t["dim_producto"], t["fact_inventario"]
    corte = inv["fecha"].max()

    def guardar(df, nombre):
        numericas = df.select_dtypes("number").columns
        df.assign(**df[numericas].round(4)).to_csv(SALIDA / f"{nombre}.csv", index=False, date_format="%Y-%m-%d")
        print(f"  {nombre:<28} {len(df):>7,} filas")

    # --- Dimensiones
    f = pd.DataFrame({"fecha": pd.date_range("2023-01-01", "2030-12-31", freq="D")})
    f["fecha_key"] = f["fecha"].dt.strftime("%Y%m%d").astype(int)
    f["anio"], f["trimestre"], f["mes"] = f["fecha"].dt.year, f["fecha"].dt.quarter, f["fecha"].dt.month
    f["nombre_mes"] = f["mes"].map(lambda m: MESES[m - 1])
    f["anio_mes"] = f["fecha"].dt.strftime("%Y-%m")
    f["semana_anio"] = f["fecha"].dt.isocalendar().week.astype(int)
    f["dia_semana"] = f["fecha"].dt.dayofweek + 1
    f["nombre_dia"] = f["dia_semana"].map(lambda d: DIAS[d - 1])
    f["fin_de_semana"] = f["dia_semana"] >= 6
    f["es_historico"] = f["fecha"] <= corte
    guardar(f, "dim_fecha")

    abc = leer("clasificacion_abc")[["producto_id", "clase_abc"]]
    dp = (prod.rename(columns={"lead_time_dias": "lead_time_planeado_dias"})
          .merge(t["dim_proveedor"], on="proveedor_id").merge(abc, on="producto_id", how="left"))
    guardar(dp, "dim_producto")
    guardar(t["dim_ubicacion"], "dim_ubicacion")
    guardar(t["dim_proveedor"], "dim_proveedor")

    # --- Inventario diario (misma lógica que analytics.fact_inventario_diario)
    x = (inv.merge(t["fact_demanda"], on=["fecha", "producto_id", "ubicacion_id"])
         .merge(prod[["producto_id", "costo_unitario"]], on="producto_id")
         .sort_values(["producto_id", "ubicacion_id", "fecha"]))
    x["demanda_insatisfecha"] = (x["salidas"] - (x["inventario_inicial"] + x["entradas"])).clip(lower=0)
    x["dia_quiebre"] = (x["demanda_insatisfecha"] > 0).astype(int)
    x["valor_inventario_disponible"] = x["inventario_disponible"] * x["costo_unitario"]
    x["valor_inventario_final"] = x["inventario_final"] * x["costo_unitario"]
    x["valor_consumo"] = x["salidas"] * x["costo_unitario"]
    x["demanda_prom_28d"] = (x.groupby(["producto_id", "ubicacion_id"])["unidades_demandadas"]
                             .transform(lambda s: s.rolling(28, min_periods=1).mean()))
    x["dias_cobertura"] = x["inventario_disponible"] / x["demanda_prom_28d"]
    guardar(x.drop(columns=["costo_unitario"]), "fact_inventario_diario")

    # --- Compras
    c = t["fact_compras"].merge(prod[["producto_id", "lead_time_dias"]], on="producto_id")
    c["lead_time_real_dias"] = (c["fecha_recepcion"] - c["fecha_pedido"]).dt.days
    c = c.rename(columns={"lead_time_dias": "lead_time_planeado_dias"})
    c["desviacion_lead_time_dias"] = c["lead_time_real_dias"] - c["lead_time_planeado_dias"]
    c["en_transito"] = c["fecha_recepcion"] > corte
    guardar(c, "fact_compras")

    # --- Pronóstico
    bt = leer("pronostico_backtest", ["fecha"]).rename(columns={"y": "real", "yhat": "pronostico"})
    bt["error"] = bt["pronostico"] - bt["real"]
    bt["error_absoluto"] = bt["error"].abs()
    bt["tipo_modelo"] = bt["modelo"].isin(MODELOS_ML).map({True: "Machine Learning", False: "Modelo base"})
    guardar(bt, "fact_pronostico_backtest")
    fu = leer("pronostico_futuro", ["fecha"]).rename(
        columns={"yhat": "pronostico", "yhat_inf": "pronostico_inf", "yhat_sup": "pronostico_sup"})
    guardar(fu, "fact_pronostico_futuro")
    mm = leer("metricas_modelos")
    mm["tipo_modelo"] = mm["modelo"].isin(MODELOS_ML).map({True: "Machine Learning", False: "Modelo base"})
    guardar(mm, "metricas_modelos")

    # --- Política, lotes, alertas, calidad
    guardar(leer("politica_inventario"), "fact_politica_inventario")
    lotes = leer("riesgo_vencimiento_lotes").merge(prod[["producto_id", "costo_unitario"]], on="producto_id")
    lotes["rango_vencimiento"] = pd.cut(lotes["dias_para_vencer"], [-10**6, 0, 30, 90, 180, 10**6],
                                        labels=["1. Vencido", "2. 0-30 días", "3. 31-90 días",
                                                "4. 91-180 días", "5. Más de 180 días"])
    lotes["valor_disponible"] = lotes["cantidad_disponible"] * lotes.pop("costo_unitario")
    guardar(lotes, "fact_lotes")
    al = leer("alertas")
    al["orden_severidad"] = al["severidad"].map({"CRITICA": 1, "ALTA": 2, "MEDIA": 3})
    guardar(al, "fact_alertas")
    guardar(leer("reporte_calidad_datos"), "calidad_datos")
    print(f"\nArchivos listos en {SALIDA}")


if __name__ == "__main__":
    main()

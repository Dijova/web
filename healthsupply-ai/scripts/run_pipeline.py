"""
Pipeline completo de HealthSupply AI.

Ejecución (desde la carpeta healthsupply-ai/):

    python scripts/run_pipeline.py

Pasos:
    1. Carga de datos crudos (data/raw)
    2. Validaciones de calidad de datos        -> reporte_calidad_datos.csv
    3. KPIs históricos mensuales               -> kpis_mensuales.csv
    4. Backtesting de modelos (validación temporal) -> pronostico_backtest.csv, metricas_*.csv
    5. Selección del mejor modelo + pronóstico futuro -> pronostico_futuro.csv
    6. Importancia de variables del modelo ML  -> importancia_variables.csv
    7. Política de inventario (SS, ROP, máximo) -> politica_inventario.csv
    8. Riesgo de vencimiento y alertas         -> riesgo_vencimiento_lotes.csv, alertas.csv
    9. Gráficos                                -> reports/figures/*.png
   10. Resumen de la ejecución                  -> resumen_ejecucion.json
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import pandas as pd
from sklearn.inspection import permutation_importance

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from healthsupply import alerts, data_quality, figures, forecasting, inventory_policy, kpis  # noqa: E402
from healthsupply.config import DATA_PROCESSED, FECHA_CORTE, RANDOM_STATE  # noqa: E402
from healthsupply.data_loading import cargar_todo  # noqa: E402
from healthsupply.metrics import metricas_por_grupo  # noqa: E402

MODELOS_ML = ["RandomForest", "HistGradientBoosting"]


def paso(n, texto):
    print(f"\n[{n}] {texto}")


def main():
    inicio = time.time()
    DATA_PROCESSED.mkdir(parents=True, exist_ok=True)

    def guardar(df, nombre):
        numericas = df.select_dtypes("number").columns
        df.assign(**df[numericas].round(4)).to_csv(DATA_PROCESSED / nombre, index=False)

    paso(1, "Cargando datos crudos")
    t = cargar_todo()
    for nombre, df in t.items():
        print(f"  {nombre:<16} {len(df):>7,} filas")

    paso(2, "Validaciones de calidad de datos")
    dq = data_quality.ejecutar_validaciones(t)
    guardar(dq, "reporte_calidad_datos.csv")
    print(" ", data_quality.resumen(dq))
    if (dq["estado"] == data_quality.ERROR).any():
        raise SystemExit("Hay reglas con ERROR: revisar reporte_calidad_datos.csv antes de continuar.")

    paso(3, "KPIs históricos mensuales")
    k = kpis.kpis_mensuales(t["fact_inventario"], t["dim_producto"])
    guardar(k, "kpis_mensuales.csv")

    paso(4, "Backtesting: modelos base vs. Machine Learning")
    panel = forecasting.preparar_panel(t["fact_demanda"])
    bt = forecasting.backtest(panel)
    guardar(bt, "pronostico_backtest.csv")
    m_modelo = metricas_por_grupo(bt, ["modelo"]).sort_values("WAPE")
    m_fold = metricas_por_grupo(bt, ["modelo", "fold"])
    guardar(m_modelo, "metricas_modelos.csv")
    guardar(m_fold, "metricas_modelos_por_fold.csv")
    print(m_modelo[["modelo", "MAE", "MAPE", "WAPE", "Sesgo_pct"]].round(2).to_string(index=False))

    # Métricas semanales: suman 7 días antes de comparar (lo que importa para reabastecer).
    semanal = (bt.assign(semana=bt["fecha"].dt.to_period("W").dt.start_time)
               .groupby(["modelo", "fold", "semana", "producto_id", "ubicacion_id"], as_index=False)[["y", "yhat"]]
               .sum())
    guardar(metricas_por_grupo(semanal, ["modelo"]).sort_values("WAPE"), "metricas_modelos_semanal.csv")

    paso(5, "Selección del modelo y pronóstico de los próximos 28 días")
    mejor = m_modelo.iloc[0]["modelo"]
    mejor_base = m_modelo[m_modelo["modelo"].isin(forecasting.MODELOS_BASE)].iloc[0]["modelo"]
    print(f"  Mejor modelo: {mejor} | mejor modelo base: {mejor_base}")
    guardar(metricas_por_grupo(bt[bt["modelo"].isin([mejor, mejor_base])], ["modelo", "producto_id"]),
            "metricas_por_producto.csv")
    futuro, modelo = forecasting.pronosticar_futuro(panel, mejor)
    bt_mejor = bt[bt["modelo"] == mejor]
    futuro = forecasting.agregar_intervalos(futuro, bt_mejor).assign(modelo=mejor)
    guardar(futuro, "pronostico_futuro.csv")

    paso(6, "Importancia de variables (permutación sobre el último fold)")
    if mejor in MODELOS_ML:
        feats = forecasting.construir_features(panel)
        origen = forecasting.origenes_backtest(panel["fecha"].max())[-1]
        train = forecasting._entrenables(feats[feats["fecha"] <= origen])
        test = feats[feats["fecha"] > origen]
        mdl = forecasting.crear_modelos_ml()[mejor].fit(train[forecasting.FEATURES], train["y"])
        pi = permutation_importance(mdl, test[forecasting.FEATURES], test["y"], n_repeats=3,
                                    random_state=RANDOM_STATE, scoring="neg_mean_absolute_error")
        imp = (pd.DataFrame({"variable": forecasting.FEATURES, "aumento_mae": pi.importances_mean})
               .sort_values("aumento_mae", ascending=False))
        guardar(imp, "importancia_variables.csv")
        print(imp.head(6).round(3).to_string(index=False))

    paso(7, "Política de inventario: stock de seguridad, punto de reorden, stock máximo")
    politica = inventory_policy.calcular_politica(
        futuro, bt_mejor, t["fact_inventario"], t["fact_compras"], t["fact_demanda"], t["dim_producto"])
    guardar(politica, "politica_inventario.csv")
    guardar(inventory_policy.clasificacion_abc(t["fact_demanda"], t["dim_producto"]), "clasificacion_abc.csv")
    print(" ", politica["estado_inventario"].value_counts().to_dict())

    paso(8, "Riesgo de vencimiento (FEFO) y alertas")
    lotes = alerts.riesgo_vencimiento(
        t["fact_lotes"], politica[["producto_id", "ubicacion_id", "demanda_diaria_pronostico"]], t["dim_producto"])
    guardar(lotes, "riesgo_vencimiento_lotes.csv")
    al = alerts.generar_alertas(politica, lotes)
    guardar(al, "alertas.csv")
    print(al.groupby(["tipo_alerta", "severidad"]).size().to_string())

    paso(9, "Gráficos")
    figures.demanda_mensual(t["fact_demanda"])
    figures.patron_semanal(t["fact_demanda"])
    figures.comparacion_modelos(m_modelo, MODELOS_ML)
    figures.pronostico_ejemplo(panel, bt_mejor[bt_mejor["fold"] >= 3],
                               bt[(bt["modelo"] == mejor_base) & (bt["fold"] >= 3)],
                               futuro, "MED-001", "LOC-001", mejor, mejor_base)
    figures.cobertura_vs_politica(politica)
    figures.riesgo_vencimiento(lotes)

    paso(10, "Resumen")
    w = m_modelo.set_index("modelo")["WAPE"]
    resumen = {
        "fecha_corte": str(FECHA_CORTE.date()),
        "mejor_modelo": mejor, "mejor_modelo_base": mejor_base,
        "metricas_mejor": m_modelo.iloc[0][["MAE", "MAPE", "WAPE", "Sesgo_pct"]].round(2).to_dict(),
        "metricas_mejor_base": m_modelo.set_index("modelo").loc[mejor_base, ["MAE", "MAPE", "WAPE", "Sesgo_pct"]]
                               .round(2).to_dict(),
        "mejora_wape_pct": round(float((w[mejor_base] - w[mejor]) / w[mejor_base] * 100), 1),
        "reglas_calidad": dq["estado"].value_counts().to_dict(),
        "estados_inventario": politica["estado_inventario"].value_counts().to_dict(),
        "valor_exceso_cop": float(politica["valor_exceso"].sum()),
        "alertas": al.groupby("tipo_alerta").size().to_dict(),
        "valor_en_riesgo_vencimiento_cop": float(lotes["valor_en_riesgo"].sum()),
        "segundos": round(time.time() - inicio, 1),
    }
    (DATA_PROCESSED / "resumen_ejecucion.json").write_text(json.dumps(resumen, indent=2, ensure_ascii=False))
    print(json.dumps(resumen, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

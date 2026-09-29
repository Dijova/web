"""
Pronóstico de demanda diaria por producto y ubicación.

Resumen del enfoque
-------------------
1. **Unidad de pronóstico**: demanda diaria de cada combinación producto x ubicación
   (15 productos x 5 ubicaciones = 75 series de tiempo).
2. **Horizonte**: 28 días (4 semanas).
3. **Modelos base (baselines)**: reglas simples que cualquier analista podría hacer en
   Excel. Sirven de "vara de medir": un modelo de ML solo vale la pena si les gana.
     - `naive_estacional`: repite la última semana observada (mismo día de la semana).
     - `media_movil_28`: promedio de los últimos 28 días (pronóstico plano).
     - `promedio_dia_semana_8s`: promedio de los últimos 8 lunes, 8 martes, etc.
4. **Modelos de Machine Learning** (scikit-learn), un único modelo *global* entrenado con
   las 75 series a la vez (aprende patrones compartidos entre productos y sedes):
     - `RandomForest`
     - `HistGradientBoosting` (boosting de árboles con pérdida Poisson, adecuada para conteos).
5. **Validación temporal (backtesting con origen móvil)**: nunca se mezclan datos del
   futuro en el entrenamiento. Se simula 4 veces el momento de pronosticar:

       fold 1: entrena [ene-2023 .......... sep-2025) -> evalúa 28 días
       fold 2: entrena [ene-2023 ............... oct-2025) -> evalúa 28 días
       fold 3: ...
       fold 4: entrena [ene-2023 .................... dic-2025) -> evalúa últimos 28 días

   (Esto es lo contrario a un `train_test_split` aleatorio, que en series de tiempo
   "filtra" información del futuro y da métricas engañosamente buenas).

¿Por qué las variables usan rezagos (lags) >= 28 días?
------------------------------------------------------
Si hoy (origen) pronosticamos el día 28 hacia adelante, lo más reciente que conocemos de
ese día es la demanda de hace 28 días. Si usáramos `lag_1` (la demanda de ayer),
en producción no la tendríamos para los días 2..28 del horizonte. Usando solo rezagos
>= horizonte, un único modelo pronostica los 28 días de una vez (estrategia *directa*),
sin fuga de información (*data leakage*).
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor

from .config import HORIZONTE_DIAS, N_FOLDS_BACKTEST, RANDOM_STATE

LLAVES = ["producto_id", "ubicacion_id"]

# ---------------------------------------------------------------------------
# 1. Preparación del panel de datos
# ---------------------------------------------------------------------------


def preparar_panel(demanda: pd.DataFrame) -> pd.DataFrame:
    """Deja la demanda en formato largo: fecha, producto_id, ubicacion_id, y."""
    panel = demanda.rename(columns={"unidades_demandadas": "y"})[["fecha", *LLAVES, "y"]]
    panel["y"] = panel["y"].astype(float)
    return panel.sort_values([*LLAVES, "fecha"]).reset_index(drop=True)


def extender_futuro(panel: pd.DataFrame, dias: int = HORIZONTE_DIAS) -> pd.DataFrame:
    """Agrega `dias` fechas futuras (y = NaN) a cada serie para poder pronosticarlas."""
    ultima = panel["fecha"].max()
    fechas = pd.date_range(ultima + pd.Timedelta(days=1), periods=dias, freq="D")
    series = panel[LLAVES].drop_duplicates()
    futuro = series.merge(pd.DataFrame({"fecha": fechas}), how="cross")
    futuro["y"] = np.nan
    return (pd.concat([panel, futuro], ignore_index=True)
            .sort_values([*LLAVES, "fecha"]).reset_index(drop=True))


# ---------------------------------------------------------------------------
# 2. Ingeniería de variables (features)
# ---------------------------------------------------------------------------

FEATURES_CALENDARIO = ["dia_semana", "mes", "dia_mes", "semana_anio", "dia_anio", "fin_de_semana"]
FEATURES_REZAGO = ["lag_28", "lag_35", "lag_42", "lag_49", "lag_364",
                   "prom_dia_semana_4s", "media_movil_7", "media_movil_28",
                   "media_movil_91", "desv_movil_28"]
FEATURES_CATEGORICAS = ["producto_cod", "ubicacion_cod"]
FEATURES = FEATURES_CALENDARIO + FEATURES_REZAGO + FEATURES_CATEGORICAS


def construir_features(panel: pd.DataFrame, horizonte: int = HORIZONTE_DIAS) -> pd.DataFrame:
    """
    Crea las variables explicativas. Todas las de rezago usan información de
    al menos `horizonte` días atrás, así que son conocidas en el momento de pronosticar.
    """
    df = panel.copy()
    f = df["fecha"]

    # --- Calendario: capturan estacionalidad semanal y anual.
    df["dia_semana"] = f.dt.dayofweek          # 0 = lunes ... 6 = domingo
    df["mes"] = f.dt.month
    df["dia_mes"] = f.dt.day
    df["semana_anio"] = f.dt.isocalendar().week.astype(int)
    df["dia_anio"] = f.dt.dayofyear
    df["fin_de_semana"] = (df["dia_semana"] >= 5).astype(int)

    # --- Rezagos: se calculan dentro de cada serie (groupby) para no mezclar productos.
    g = df.groupby(LLAVES, sort=False)["y"]
    for lag in (28, 35, 42, 49, 364):   # 28, 35, 42, 49 = mismo día de la semana
        df[f"lag_{lag}"] = g.shift(lag)
    df["prom_dia_semana_4s"] = df[["lag_28", "lag_35", "lag_42", "lag_49"]].mean(axis=1)

    # --- Estadísticas móviles "vistas desde" hace `horizonte` días.
    desplazada = g.shift(horizonte)
    gd = desplazada.groupby([df[k] for k in LLAVES], sort=False)
    df["media_movil_7"] = gd.transform(lambda s: s.rolling(7, min_periods=7).mean())
    df["media_movil_28"] = gd.transform(lambda s: s.rolling(28, min_periods=28).mean())
    df["media_movil_91"] = gd.transform(lambda s: s.rolling(91, min_periods=91).mean())
    df["desv_movil_28"] = gd.transform(lambda s: s.rolling(28, min_periods=28).std())

    # --- Identidad de la serie como categoría (el modelo global aprende el "nivel" de cada una).
    df["producto_cod"] = df["producto_id"].str[-3:].astype(int)
    df["ubicacion_cod"] = df["ubicacion_id"].str[-3:].astype(int)
    return df


# ---------------------------------------------------------------------------
# 3. Modelos
# ---------------------------------------------------------------------------

MODELOS_BASE = ["naive_estacional", "media_movil_28", "promedio_dia_semana_8s"]


def crear_modelos_ml() -> dict:
    """Instancia los modelos de ML con hiperparámetros razonables (sin sobreajustar)."""
    return {
        "RandomForest": RandomForestRegressor(
            n_estimators=300, min_samples_leaf=10, max_features=0.5,
            n_jobs=-1, random_state=RANDOM_STATE),
        "HistGradientBoosting": HistGradientBoostingRegressor(
            loss="poisson",              # la demanda es un conteo >= 0
            learning_rate=0.05, max_iter=400, max_leaf_nodes=31,
            min_samples_leaf=40, l2_regularization=1.0,
            categorical_features=FEATURES_CATEGORICAS,
            random_state=RANDOM_STATE),
    }


def pronostico_base(historia: pd.DataFrame, fechas: pd.DatetimeIndex, metodo: str) -> pd.DataFrame:
    """
    Pronóstico de un modelo base usando SOLO la historia anterior al origen.
    Devuelve columnas: fecha, producto_id, ubicacion_id, yhat.
    """
    ultimo = historia["fecha"].max()
    series = historia[LLAVES].drop_duplicates()
    destino = series.merge(pd.DataFrame({"fecha": fechas}), how="cross")
    destino["dia_semana"] = destino["fecha"].dt.dayofweek

    if metodo == "media_movil_28":
        ventana = historia[historia["fecha"] > ultimo - pd.Timedelta(days=28)]
        nivel = ventana.groupby(LLAVES)["y"].mean().rename("yhat").reset_index()
        return destino.merge(nivel, on=LLAVES)[["fecha", *LLAVES, "yhat"]]

    dias = {"naive_estacional": 7, "promedio_dia_semana_8s": 56}[metodo]
    ventana = historia[historia["fecha"] > ultimo - pd.Timedelta(days=dias)].copy()
    ventana["dia_semana"] = ventana["fecha"].dt.dayofweek
    perfil = ventana.groupby([*LLAVES, "dia_semana"])["y"].mean().rename("yhat").reset_index()
    return destino.merge(perfil, on=[*LLAVES, "dia_semana"])[["fecha", *LLAVES, "yhat"]]


def _entrenables(df: pd.DataFrame) -> pd.DataFrame:
    """Filas con objetivo conocido y rezagos básicos disponibles (descarta el arranque)."""
    return df[df["y"].notna() & df["media_movil_91"].notna()]


# ---------------------------------------------------------------------------
# 4. Validación temporal (backtesting)
# ---------------------------------------------------------------------------


def origenes_backtest(fecha_max: pd.Timestamp, n_folds=N_FOLDS_BACKTEST, horizonte=HORIZONTE_DIAS):
    """Fechas de corte de cada fold: el último día de entrenamiento de cada uno."""
    return [fecha_max - pd.Timedelta(days=horizonte * k) for k in range(n_folds, 0, -1)]


def backtest(panel: pd.DataFrame, n_folds=N_FOLDS_BACKTEST, horizonte=HORIZONTE_DIAS,
             verbose=True) -> pd.DataFrame:
    """
    Ejecuta la validación con origen móvil para modelos base y de ML.
    Devuelve una fila por (fold, modelo, fecha, producto, ubicación) con `y` y `yhat`.
    """
    features = construir_features(panel, horizonte)
    resultados = []
    for fold, origen in enumerate(origenes_backtest(panel["fecha"].max(), n_folds, horizonte), 1):
        fechas_test = pd.date_range(origen + pd.Timedelta(days=1), periods=horizonte, freq="D")
        historia = panel[panel["fecha"] <= origen]
        real = panel[panel["fecha"].isin(fechas_test)][["fecha", *LLAVES, "y"]]

        for metodo in MODELOS_BASE:
            pred = pronostico_base(historia, fechas_test, metodo)
            resultados.append(real.merge(pred, on=["fecha", *LLAVES]).assign(modelo=metodo, fold=fold))

        train = _entrenables(features[features["fecha"] <= origen])
        test = features[features["fecha"].isin(fechas_test)]
        for nombre, modelo in crear_modelos_ml().items():
            modelo.fit(train[FEATURES], train["y"])
            pred = test[["fecha", *LLAVES, "y"]].copy()
            pred["yhat"] = np.clip(modelo.predict(test[FEATURES]), 0, None)
            resultados.append(pred.assign(modelo=nombre, fold=fold))
        if verbose:
            print(f"  fold {fold}: entrena hasta {origen.date()} | evalúa "
                  f"{fechas_test[0].date()} a {fechas_test[-1].date()}")

    return pd.concat(resultados, ignore_index=True)


# ---------------------------------------------------------------------------
# 5. Pronóstico final (producción)
# ---------------------------------------------------------------------------


def pronosticar_futuro(panel: pd.DataFrame, nombre_modelo: str, horizonte=HORIZONTE_DIAS):
    """
    Reentrena el modelo elegido con TODA la historia y pronostica los próximos
    `horizonte` días. Devuelve (pronóstico, modelo_entrenado).
    """
    extendido = extender_futuro(panel, horizonte)
    ultima = panel["fecha"].max()
    fechas = pd.date_range(ultima + pd.Timedelta(days=1), periods=horizonte, freq="D")

    if nombre_modelo in MODELOS_BASE:
        return pronostico_base(panel, fechas, nombre_modelo), None

    features = construir_features(extendido, horizonte)
    train = _entrenables(features[features["fecha"] <= ultima])
    modelo = crear_modelos_ml()[nombre_modelo]
    modelo.fit(train[FEATURES], train["y"])
    futuro = features[features["fecha"].isin(fechas)][["fecha", *LLAVES]].copy()
    futuro["yhat"] = np.clip(modelo.predict(features.loc[futuro.index, FEATURES]), 0, None)
    return futuro.reset_index(drop=True), modelo


def agregar_intervalos(pronostico: pd.DataFrame, backtest_modelo: pd.DataFrame,
                       q_inf=0.10, q_sup=0.90) -> pd.DataFrame:
    """
    Intervalo de predicción empírico: se suman al pronóstico los percentiles de los
    errores (y - yhat) observados en el backtest de cada serie. Es simple, no asume
    normalidad y es honesto: refleja cuánto se equivocó realmente el modelo.
    """
    err = backtest_modelo.assign(error=backtest_modelo["y"] - backtest_modelo["yhat"])
    q = err.groupby(LLAVES)["error"].quantile([q_inf, q_sup]).unstack()
    q.columns = ["err_inf", "err_sup"]
    out = pronostico.merge(q.reset_index(), on=LLAVES, how="left")
    out["yhat_inf"] = np.clip(out["yhat"] + out["err_inf"], 0, None)
    out["yhat_sup"] = out["yhat"] + out["err_sup"]
    return out.drop(columns=["err_inf", "err_sup"])

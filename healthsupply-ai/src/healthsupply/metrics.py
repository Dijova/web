"""
Métricas de precisión del pronóstico.

Notación: `y` = demanda real, `yhat` = pronóstico, `n` = número de observaciones.

- **MAE** (Mean Absolute Error) = promedio(|y - yhat|)
  Error promedio en *unidades*. Fácil de explicar: "nos equivocamos en ~X unidades por día".

- **MAPE** (Mean Absolute Percentage Error) = promedio(|y - yhat| / y) x 100
  Error promedio en *porcentaje*. Permite comparar productos de distinto volumen.
  Debilidad: explota cuando `y` es muy pequeño (dividir entre 2 unidades castiga
  mucho) y no está definido si y = 0. En este dataset la demanda mínima es 2,
  así que es calculable, pero conviene leerlo junto con WAPE.

- **WAPE** (Weighted Absolute Percentage Error) = suma(|y - yhat|) / suma(y) x 100
  Es "el MAE dividido por la demanda promedio". Pondera por volumen, es robusto
  a valores pequeños y es la métrica preferida en supply chain. La usamos para
  elegir el modelo ganador.

- **Sesgo** (Bias) = suma(yhat - y) / suma(y) x 100
  Positivo = sobrepronóstico (riesgo de sobrestock);
  negativo = subpronóstico (riesgo de quiebre). Un buen modelo tiene sesgo ~ 0.

- **RMSE** (Root Mean Squared Error) = raíz(promedio((y - yhat)^2))
  Castiga más los errores grandes.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def mae(y, yhat) -> float:
    y, yhat = np.asarray(y, float), np.asarray(yhat, float)
    return float(np.mean(np.abs(y - yhat)))


def mape(y, yhat) -> float:
    y, yhat = np.asarray(y, float), np.asarray(yhat, float)
    mascara = y != 0  # se excluyen ceros para evitar división entre cero
    return float(np.mean(np.abs(y[mascara] - yhat[mascara]) / y[mascara]) * 100)


def wape(y, yhat) -> float:
    y, yhat = np.asarray(y, float), np.asarray(yhat, float)
    return float(np.sum(np.abs(y - yhat)) / np.sum(y) * 100)


def sesgo(y, yhat) -> float:
    y, yhat = np.asarray(y, float), np.asarray(yhat, float)
    return float(np.sum(yhat - y) / np.sum(y) * 100)


def rmse(y, yhat) -> float:
    y, yhat = np.asarray(y, float), np.asarray(yhat, float)
    return float(np.sqrt(np.mean((y - yhat) ** 2)))


def calcular_metricas(y, yhat) -> dict[str, float]:
    """Devuelve todas las métricas en un diccionario."""
    return {"MAE": mae(y, yhat), "MAPE": mape(y, yhat), "WAPE": wape(y, yhat),
            "Sesgo_pct": sesgo(y, yhat), "RMSE": rmse(y, yhat)}


def metricas_por_grupo(df: pd.DataFrame, grupos: list[str], y="y", yhat="yhat") -> pd.DataFrame:
    """Calcula las métricas para cada combinación de las columnas `grupos`."""
    filas = []
    for llave, g in df.groupby(grupos, observed=True):
        llave = llave if isinstance(llave, tuple) else (llave,)
        filas.append({**dict(zip(grupos, llave)), **calcular_metricas(g[y], g[yhat]), "n": len(g)})
    return pd.DataFrame(filas)

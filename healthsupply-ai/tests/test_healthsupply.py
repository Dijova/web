"""
Pruebas unitarias (pytest). Ejecutar desde healthsupply-ai/:

    pytest -q

Las pruebas usan datos pequeños construidos a mano, donde el resultado correcto se
puede calcular con lápiz y papel. Así, si alguien cambia una fórmula por error,
la prueba falla y lo avisa.
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from healthsupply import alerts, data_quality, forecasting, inventory_policy, metrics  # noqa: E402
from healthsupply.data_loading import cargar_todo  # noqa: E402

# ----------------------------------------------------------------------------- métricas


def test_metricas_ejemplo_a_mano():
    y, yhat = [10, 20, 30], [12, 18, 30]
    assert metrics.mae(y, yhat) == pytest.approx(4 / 3)            # (2 + 2 + 0) / 3
    assert metrics.wape(y, yhat) == pytest.approx(4 / 60 * 100)     # 4 / 60
    assert metrics.mape(y, yhat) == pytest.approx((0.2 + 0.1 + 0) / 3 * 100)
    assert metrics.sesgo(y, yhat) == pytest.approx(0.0)             # +2 - 2 + 0
    assert metrics.rmse(y, yhat) == pytest.approx(np.sqrt(8 / 3))


def test_mape_ignora_ceros():
    assert metrics.mape([0, 10], [5, 12]) == pytest.approx(20.0)


# ----------------------------------------------------------------------------- pronóstico


def _panel_sintetico(dias=200):
    fechas = pd.date_range("2024-01-01", periods=dias, freq="D")
    return pd.DataFrame({"fecha": fechas, "producto_id": "MED-001", "ubicacion_id": "LOC-001",
                         "y": np.arange(dias, dtype=float)})


def test_features_no_usan_informacion_del_futuro():
    """Con y = número de día, lag_28 del día t debe ser exactamente t - 28."""
    f = forecasting.construir_features(_panel_sintetico())
    fila = f.iloc[150]
    assert fila["lag_28"] == 150 - 28
    # La media móvil de 7 días "vista desde hace 28 días" promedia los días 116..122.
    assert fila["media_movil_7"] == pytest.approx(np.mean(np.arange(116, 123)))


def test_baseline_media_movil_usa_solo_historia():
    panel = _panel_sintetico(60)
    fechas = pd.date_range("2024-03-01", periods=3)
    pred = forecasting.pronostico_base(panel, fechas, "media_movil_28")
    assert pred["yhat"].unique() == pytest.approx([np.mean(np.arange(32, 60))])


def test_naive_estacional_repite_ultima_semana():
    panel = _panel_sintetico(14)                       # termina el domingo 2024-01-14
    fechas = pd.date_range("2024-01-15", periods=7)    # lunes a domingo
    pred = forecasting.pronostico_base(panel, fechas, "naive_estacional").sort_values("fecha")
    assert list(pred["yhat"]) == [7, 8, 9, 10, 11, 12, 13]


def test_origenes_backtest():
    o = forecasting.origenes_backtest(pd.Timestamp("2025-12-31"), n_folds=2, horizonte=28)
    assert o == [pd.Timestamp("2025-11-05"), pd.Timestamp("2025-12-03")]


# ----------------------------------------------------------------------------- inventario


def test_formula_stock_de_seguridad():
    """Ejemplo a mano: d=10, sigma_e=4, LT=9 (desv 0), z(95%)=1.645 -> SS = 1.645*sqrt(9*16) = 19.74."""
    fechas = pd.date_range("2025-12-01", periods=31)
    ids = {"producto_id": "MED-001", "ubicacion_id": "LOC-001"}
    pronostico = pd.DataFrame({"fecha": pd.date_range("2026-01-01", periods=28), **ids, "yhat": 10.0})
    errores = pd.DataFrame({**ids, "y": [14.0, 6.0] * 50, "yhat": 10.0})     # desviación = 4 (aprox.)
    inventario = pd.DataFrame({"fecha": fechas, **ids, "inventario_disponible": 500})
    compras = pd.DataFrame({"fecha_pedido": pd.to_datetime(["2025-11-01", "2025-11-29"]),
                            "fecha_recepcion": pd.to_datetime(["2025-11-10", "2025-12-08"]),
                            **ids, "cantidad": 100})
    demanda = pd.DataFrame({"fecha": fechas, **ids, "unidades_demandadas": 10})
    productos = pd.DataFrame({"producto_id": ["MED-001"], "producto_nombre": ["X"], "categoria": ["C"],
                              "costo_unitario": [100]})
    p = inventory_policy.calcular_politica(pronostico, errores, inventario, compras, demanda, productos,
                                           fecha_corte=pd.Timestamp("2025-12-31")).iloc[0]
    sigma = np.std([14.0, 6.0] * 50, ddof=1)
    z = p["z"]
    assert p["clase_abc"] == "A" and p["nivel_servicio"] == 0.98
    assert p["stock_seguridad"] == np.ceil(z * np.sqrt(9 * sigma ** 2))
    assert p["punto_reorden"] == np.ceil(10 * 9 + p["stock_seguridad"])
    assert p["estado_inventario"] == "SOBRESTOCK"       # 500 u = 50 días > máximo (37 días + SS)


def test_fefo_riesgo_vencimiento():
    """Demanda 10 u/día. Lote A vence en 20 días (300 u): se consumen 200, quedan 100 en riesgo.
    Lote B vence en 100 días (500 u): empieza el día 20, necesita 50 días -> sin riesgo."""
    corte = pd.Timestamp("2025-12-31")
    ids = {"producto_id": "MED-001", "ubicacion_id": "LOC-001"}
    lotes = pd.DataFrame({"lote_id": ["A", "B"], **ids,
                          "fecha_ingreso": corte - pd.Timedelta(days=100),
                          "fecha_vencimiento": [corte + pd.Timedelta(days=20), corte + pd.Timedelta(days=100)],
                          "cantidad_inicial": [300, 500], "cantidad_disponible": [300, 500]})
    demanda = pd.DataFrame({**ids, "demanda_diaria_pronostico": [10.0]}, index=[0])
    productos = pd.DataFrame({"producto_id": ["MED-001"], "costo_unitario": [1000]})
    r = alerts.riesgo_vencimiento(lotes, demanda, productos, corte).set_index("lote_id")
    assert r.loc["A", "unidades_en_riesgo"] == 100
    assert r.loc["A", "estado_vencimiento"] == "RIESGO_ALTO"
    assert r.loc["B", "unidades_en_riesgo"] == 0


# ----------------------------------------------------------------------------- calidad de datos


def test_calidad_sobre_datos_reales_sin_errores():
    reporte = data_quality.ejecutar_validaciones(cargar_todo())
    assert (reporte["estado"] != data_quality.ERROR).all()


def test_calidad_detecta_datos_corruptos():
    t = cargar_todo()
    t["fact_demanda"] = pd.concat([t["fact_demanda"], t["fact_demanda"].head(3)])   # duplicados
    t["fact_compras"].loc[0, "valor_compra"] = -1                                    # valor inválido
    reporte = data_quality.ejecutar_validaciones(t).set_index(["tabla", "regla"])
    assert reporte.loc[("fact_demanda", "llave_unica(fecha, producto_id, ubicacion_id)"), "registros_fallidos"] == 3
    assert reporte.loc[("fact_compras", "cantidades_no_negativas"), "estado"] == data_quality.ERROR

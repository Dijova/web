"""
Gráficos estáticos (PNG) para el README y los documentos.

Principios aplicados (los mismos que se recomiendan para el tablero de Power BI):
- Un solo eje Y por gráfico (nunca doble eje).
- Líneas delgadas, grilla tenue, sin bordes innecesarios.
- El color comunica una sola cosa: identidad de la serie o estado (alerta).
- Los colores de estado (verde/amarillo/naranja/rojo) se reservan para alertas.
"""

from __future__ import annotations

import matplotlib

matplotlib.use("Agg")  # backend sin ventana: permite generar PNG en servidores/CI
import matplotlib.pyplot as plt
import pandas as pd

from .config import FIGURES

# Paleta categórica validada para daltonismo (orden fijo, nunca se "cicla").
AZUL, NARANJA, AQUA, AMARILLO = "#2a78d6", "#eb6834", "#1baf7a", "#eda100"
GRIS = "#898781"
TINTA, TINTA_2, GRILLA, EJE = "#0b0b0b", "#52514e", "#e1e0d9", "#c3c2b7"
ESTADO = {"OK": "#0ca30c", "SOBRESTOCK": "#fab219", "REORDENAR": "#ec835a", "RIESGO_QUIEBRE": "#d03b3b"}

plt.rcParams.update({
    "figure.facecolor": "#fcfcfb", "axes.facecolor": "#fcfcfb", "savefig.facecolor": "#fcfcfb",
    "axes.edgecolor": EJE, "axes.labelcolor": TINTA_2, "axes.titlecolor": TINTA,
    "axes.titlesize": 12, "axes.titleweight": "bold", "axes.titlelocation": "left",
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.grid": True, "grid.color": GRILLA, "grid.linewidth": 0.6,
    "xtick.color": TINTA_2, "ytick.color": TINTA_2, "font.size": 9.5,
    "legend.frameon": False, "lines.linewidth": 1.6,
})


def _guardar(fig, nombre):
    FIGURES.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(FIGURES / nombre, dpi=150)
    plt.close(fig)


def demanda_mensual(demanda: pd.DataFrame):
    m = demanda.set_index("fecha")["unidades_demandadas"].resample("MS").sum()
    fig, ax = plt.subplots(figsize=(9, 3.4))
    ax.plot(m.index, m.values / 1000, color=AZUL, marker="o", markersize=3)
    ax.set_title("Demanda total mensual (miles de unidades)")
    ax.set_ylim(0, None)
    ax.grid(axis="x", visible=False)
    _guardar(fig, "01_demanda_mensual.png")


def patron_semanal(demanda: pd.DataFrame):
    dias = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    s = demanda.groupby(demanda["fecha"].dt.dayofweek)["unidades_demandadas"].mean()
    fig, ax = plt.subplots(figsize=(6, 3.2))
    ax.bar(dias, s.values, color=AZUL, width=0.6)
    for x, v in zip(dias, s.values):
        ax.text(x, v + 0.3, f"{v:.1f}", ha="center", color=TINTA_2, fontsize=8.5)
    ax.set_title("Demanda promedio por día de la semana (u/serie)")
    ax.grid(axis="x", visible=False)
    _guardar(fig, "02_patron_semanal.png")


def comparacion_modelos(metricas: pd.DataFrame, modelos_ml: list[str]):
    m = metricas.sort_values("WAPE", ascending=False)
    colores = [AZUL if x in modelos_ml else GRIS for x in m["modelo"]]
    fig, ax = plt.subplots(figsize=(8.5, 3.4))
    ax.barh(m["modelo"], m["WAPE"], color=colores, height=0.6)
    for y, (w, mp) in enumerate(zip(m["WAPE"], m["MAPE"])):
        ax.text(w + 0.3, y, f"WAPE {w:.1f} %  ·  MAPE {mp:.1f} %", va="center", color=TINTA_2, fontsize=8.5)
    ax.set_xlim(0, m["WAPE"].max() * 1.55)
    ax.set_title("Error en validación temporal (menor es mejor)")
    ax.set_xlabel("WAPE (%)   ·   azul = Machine Learning, gris = modelo base")
    ax.grid(axis="y", visible=False)
    _guardar(fig, "03_comparacion_modelos.png")


def pronostico_ejemplo(panel, backtest_mejor, backtest_base, futuro, producto, ubicacion,
                       nombre_mejor, nombre_base):
    def sel(df):
        return df[(df["producto_id"] == producto) & (df["ubicacion_id"] == ubicacion)]

    hist = sel(panel)
    hist = hist[hist["fecha"] >= backtest_mejor["fecha"].min() - pd.Timedelta(days=42)]
    bm, bb, fu = sel(backtest_mejor), sel(backtest_base), sel(futuro)
    fig, ax = plt.subplots(figsize=(10, 3.8))
    ax.plot(hist["fecha"], hist["y"], color=TINTA_2, linewidth=1.1, label="Demanda real")
    ax.plot(bb["fecha"], bb["yhat"], color=GRIS, linestyle="--", linewidth=1.2, label=f"Base: {nombre_base}")
    ax.plot(bm["fecha"], bm["yhat"], color=AZUL, label=f"ML: {nombre_mejor} (backtest)")
    ax.fill_between(fu["fecha"], fu["yhat_inf"], fu["yhat_sup"], color=AZUL, alpha=0.15, linewidth=0,
                    label="Intervalo 80 % (futuro)")
    ax.plot(fu["fecha"], fu["yhat"], color=NARANJA, label="Pronóstico enero 2026")
    ax.axvline(fu["fecha"].min(), color=EJE, linewidth=1)
    ax.set_title(f"Pronóstico vs. real · {producto} en {ubicacion}")
    ax.set_ylim(0, None)
    ax.legend(ncol=3, loc="upper left", fontsize=8)
    _guardar(fig, "04_pronostico_ejemplo.png")


def cobertura_vs_politica(politica: pd.DataFrame):
    p = politica.groupby(["producto_id", "producto_nombre"], as_index=False).agg(
        disponible=("inventario_disponible", "sum"), demanda=("demanda_diaria_pronostico", "sum"),
        rop=("punto_reorden", "sum"), maximo=("stock_maximo", "sum"))
    p["cob_actual"] = p["disponible"] / p["demanda"]
    p["cob_rop"] = p["rop"] / p["demanda"]
    p["cob_max"] = p["maximo"] / p["demanda"]
    p = p.sort_values("cob_actual")
    etiquetas = p["producto_id"] + " " + p["producto_nombre"].str.slice(0, 27)
    fig, ax = plt.subplots(figsize=(9, 5.2))
    ax.barh(etiquetas, p["cob_actual"], color=AZUL, height=0.55, label="Cobertura actual")
    ax.scatter(p["cob_rop"], etiquetas, color=NARANJA, marker="|", s=220, linewidths=2.5,
               label="Punto de reorden", zorder=3)
    ax.scatter(p["cob_max"], etiquetas, color=TINTA, marker="|", s=220, linewidths=2.5,
               label="Stock máximo", zorder=3)
    ax.set_title("Días de cobertura al 31-dic-2025 vs. la política recomendada")
    ax.set_xlabel("días de demanda pronosticada")
    ax.legend(loc="upper center", bbox_to_anchor=(0.4, -0.12), ncol=3, fontsize=8)
    ax.grid(axis="y", visible=False)
    _guardar(fig, "05_cobertura_vs_politica.png")


def riesgo_vencimiento(lotes_riesgo: pd.DataFrame):
    r = lotes_riesgo[lotes_riesgo["unidades_en_riesgo"] > 0]
    t = (r.groupby(["producto_id", "estado_vencimiento"])["valor_en_riesgo"].sum().unstack(fill_value=0)
         / 1e6)
    t = t.loc[t.sum(axis=1).sort_values().index]
    fig, ax = plt.subplots(figsize=(8, 4.2))
    izquierda = None
    colores = {"VENCIDO": ESTADO["RIESGO_QUIEBRE"], "RIESGO_ALTO": ESTADO["REORDENAR"],
               "RIESGO_PROYECTADO": ESTADO["SOBRESTOCK"]}
    for estado in [c for c in colores if c in t.columns]:
        ax.barh(t.index, t[estado], left=izquierda, color=colores[estado], height=0.6,
                label=estado.replace("_", " ").capitalize(), edgecolor="#fcfcfb", linewidth=1)
        izquierda = t[estado] if izquierda is None else izquierda + t[estado]
    ax.set_xlim(0, t.sum(axis=1).max() * 1.08)
    ax.set_title("Valor en riesgo por vencimiento (millones COP)")
    ax.legend(loc="lower right", fontsize=8)
    ax.grid(axis="y", visible=False)
    _guardar(fig, "06_riesgo_vencimiento.png")

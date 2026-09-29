"""
Configuración central del proyecto HealthSupply AI.

¿Por qué un archivo de configuración?
-------------------------------------
Todos los "números mágicos" del proyecto (horizonte de pronóstico, niveles de
servicio, umbrales de alertas, rutas...) viven aquí. Así:

1. Se pueden cambiar en un solo lugar sin tocar la lógica.
2. Quien lee el código entiende qué supuestos de negocio se están usando.
3. Los notebooks, los scripts y las pruebas usan exactamente los mismos valores.
"""

from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
# Rutas
# ---------------------------------------------------------------------------
# PROJECT_ROOT apunta a la carpeta `healthsupply-ai/` sin importar desde dónde
# se ejecute el código (notebook, script o pytest).
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_RAW = PROJECT_ROOT / "data" / "raw"
DATA_PROCESSED = PROJECT_ROOT / "data" / "processed"
FIGURES = PROJECT_ROOT / "reports" / "figures"
SQL_DIR = PROJECT_ROOT / "sql"

# ---------------------------------------------------------------------------
# Fecha de corte ("hoy" en la simulación)
# ---------------------------------------------------------------------------
# El histórico va del 2023-01-01 al 2025-12-31. Tomamos el último día como la
# fecha en la que "estamos parados" para tomar decisiones de inventario.
FECHA_CORTE = pd.Timestamp("2025-12-31")

# ---------------------------------------------------------------------------
# Pronóstico
# ---------------------------------------------------------------------------
# Horizonte: cuántos días hacia adelante pronosticamos. 28 días = 4 semanas
# completas (conserva el patrón semanal) y cubre holgadamente el lead time
# máximo de los productos (20 días).
HORIZONTE_DIAS = 28

# Número de ventanas (folds) de validación temporal. Cada fold evalúa 28 días,
# así que 4 folds = 112 días (~ sep-dic 2025) de evaluación fuera de muestra.
N_FOLDS_BACKTEST = 4

# Semilla para reproducibilidad de los modelos de Machine Learning.
RANDOM_STATE = 42

# ---------------------------------------------------------------------------
# Política de inventario
# ---------------------------------------------------------------------------
# Nivel de servicio objetivo por clase ABC (probabilidad de NO quebrar stock
# durante el tiempo de reposición). Los productos A concentran el valor
# consumido, por eso se protegen más.
NIVEL_SERVICIO_ABC = {"A": 0.98, "B": 0.95, "C": 0.90}

# Cortes de la clasificación ABC sobre el % acumulado del valor consumido.
CORTE_ABC_A = 0.80
CORTE_ABC_B = 0.95

# Periodo de revisión (R): en los datos, los pedidos se colocan cada 28 días.
PERIODO_REVISION_DIAS = 28

# ---------------------------------------------------------------------------
# Umbrales de alertas
# ---------------------------------------------------------------------------
# Vencimiento: un lote que vence dentro de esta ventana entra a monitoreo.
DIAS_ALERTA_VENCIMIENTO = 90
# Sobrestock: el inventario disponible supera el stock máximo de la política
# multiplicado por este factor (1.0 = cualquier exceso sobre el máximo).
FACTOR_SOBRESTOCK = 1.0

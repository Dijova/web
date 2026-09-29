"""
Carga de los archivos CSV crudos (capa *raw*).

Cada función devuelve un DataFrame con los tipos de dato correctos:
fechas como `datetime64`, identificadores como texto y cantidades como enteros.
Tipar bien desde la carga evita errores silenciosos más adelante (por ejemplo,
comparar la fecha "2025-01-10" como texto contra un Timestamp).
"""

from __future__ import annotations

import pandas as pd

from .config import DATA_RAW

# Columnas que deben interpretarse como fecha en cada archivo.
_COLUMNAS_FECHA = {
    "dim_fecha": ["fecha"],
    "dim_producto": [],
    "dim_proveedor": [],
    "dim_ubicacion": [],
    "fact_demanda": ["fecha"],
    "fact_inventario": ["fecha"],
    "fact_compras": ["fecha_pedido", "fecha_recepcion"],
    "fact_lotes": ["fecha_ingreso", "fecha_vencimiento"],
}

TABLAS = list(_COLUMNAS_FECHA)


def cargar_tabla(nombre: str) -> pd.DataFrame:
    """Lee `data/raw/<nombre>.csv` y convierte sus columnas de fecha."""
    if nombre not in _COLUMNAS_FECHA:
        raise ValueError(f"Tabla desconocida: {nombre}. Opciones: {TABLAS}")
    return pd.read_csv(DATA_RAW / f"{nombre}.csv", parse_dates=_COLUMNAS_FECHA[nombre])


def cargar_todo() -> dict[str, pd.DataFrame]:
    """Carga las 8 tablas en un diccionario {nombre: DataFrame}."""
    return {nombre: cargar_tabla(nombre) for nombre in TABLAS}

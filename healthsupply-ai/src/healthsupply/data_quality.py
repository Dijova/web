"""
Validaciones de calidad de datos (Data Quality, DQ).

Idea clave
----------
Un modelo de pronóstico o un tablero solo es tan confiable como los datos que
lo alimentan. Antes de modelar, verificamos reglas explícitas y dejamos
evidencia (un reporte) de qué se revisó y qué se encontró.

Las reglas se agrupan en las dimensiones clásicas de calidad de datos:

- **Completitud**: ¿faltan valores o faltan filas esperadas?
- **Unicidad**: ¿hay registros duplicados para la misma llave?
- **Validez**: ¿los valores están en el dominio permitido (no negativos, fechas en rango)?
- **Consistencia**: ¿se cumplen las reglas de negocio entre columnas/tablas?
- **Integridad referencial**: ¿cada llave foránea existe en su dimensión?

Cada regla devuelve un diccionario con el resultado. Al final se arma un
DataFrame que se guarda en `data/processed/reporte_calidad_datos.csv`.
Las mismas reglas están escritas en SQL (`sql/05_validaciones_calidad.sql`)
para ejecutarse dentro de PostgreSQL.
"""

from __future__ import annotations

import pandas as pd

# Severidad cuando la regla falla:
#   ERROR       -> el dato es inválido; hay que corregirlo antes de usarlo.
#   ADVERTENCIA -> el dato es válido pero revela una situación de negocio a explicar.
ERROR = "ERROR"
ADVERTENCIA = "ADVERTENCIA"


def _resultado(tabla, regla, dimension, severidad, evaluados, fallidos, descripcion):
    """Empaqueta el resultado de una regla en un formato uniforme."""
    fallidos = int(fallidos)
    return {
        "tabla": tabla,
        "regla": regla,
        "dimension": dimension,
        "severidad": severidad,
        "registros_evaluados": int(evaluados),
        "registros_fallidos": fallidos,
        "pct_fallidos": round(100 * fallidos / evaluados, 4) if evaluados else 0.0,
        "estado": "OK" if fallidos == 0 else severidad,
        "descripcion": descripcion,
    }


def ejecutar_validaciones(t: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Ejecuta todas las reglas sobre el diccionario de tablas de `cargar_todo()`."""
    r = []
    dem, inv = t["fact_demanda"], t["fact_inventario"]
    com, lot = t["fact_compras"], t["fact_lotes"]
    prod, ubi = t["dim_producto"], t["dim_ubicacion"]
    prov, fec = t["dim_proveedor"], t["dim_fecha"]

    # ------------------------------------------------------------------ Completitud
    for nombre, df in t.items():
        r.append(_resultado(nombre, "sin_valores_nulos", "Completitud", ERROR,
                            df.size, df.isna().sum().sum(),
                            "Ninguna celda de la tabla debe estar vacía."))

    # Todas las combinaciones fecha x producto x ubicación deben existir (panel completo).
    esperado = len(fec) * len(prod) * len(ubi)
    for nombre, df in [("fact_demanda", dem), ("fact_inventario", inv)]:
        r.append(_resultado(nombre, "panel_completo_fecha_producto_ubicacion", "Completitud",
                            ERROR, esperado, esperado - len(df),
                            "Debe existir un registro por cada día, producto y ubicación."))

    # El calendario no debe tener huecos entre la primera y la última fecha.
    rango = pd.date_range(fec["fecha"].min(), fec["fecha"].max(), freq="D")
    r.append(_resultado("dim_fecha", "calendario_sin_huecos", "Completitud", ERROR,
                        len(rango), len(rango.difference(fec["fecha"])),
                        "La dimensión fecha debe contener todos los días del rango."))

    # -------------------------------------------------------------------- Unicidad
    llaves = {
        "dim_fecha": ["fecha"],
        "dim_producto": ["producto_id"],
        "dim_proveedor": ["proveedor_id"],
        "dim_ubicacion": ["ubicacion_id"],
        "fact_demanda": ["fecha", "producto_id", "ubicacion_id"],
        "fact_inventario": ["fecha", "producto_id", "ubicacion_id"],
        "fact_lotes": ["lote_id"],
    }
    for nombre, cols in llaves.items():
        df = t[nombre]
        r.append(_resultado(nombre, f"llave_unica({', '.join(cols)})", "Unicidad", ERROR,
                            len(df), df.duplicated(subset=cols).sum(),
                            "La llave de negocio no debe repetirse."))

    # --------------------------------------------------------------------- Validez
    no_negativas = {
        "fact_demanda": ["unidades_demandadas"],
        "fact_inventario": ["inventario_inicial", "entradas", "salidas", "inventario_final",
                            "inventario_reservado", "inventario_disponible"],
        "fact_compras": ["cantidad", "costo_unitario", "valor_compra"],
        "fact_lotes": ["cantidad_inicial", "cantidad_disponible"],
        "dim_producto": ["costo_unitario", "lead_time_dias", "vida_util_dias"],
    }
    for nombre, cols in no_negativas.items():
        df = t[nombre]
        r.append(_resultado(nombre, "cantidades_no_negativas", "Validez", ERROR,
                            len(df), (df[cols] < 0).any(axis=1).sum(),
                            f"Columnas {cols} deben ser >= 0."))

    for nombre, df in [("fact_demanda", dem), ("fact_inventario", inv)]:
        fuera = ~df["fecha"].isin(fec["fecha"])
        r.append(_resultado(nombre, "fecha_en_calendario", "Validez", ERROR, len(df), fuera.sum(),
                            "Toda fecha de hechos debe existir en dim_fecha."))

    # ---------------------------------------------------------------- Consistencia
    # Balance de inventario: inicial + entradas - salidas = final.
    balance = inv["inventario_inicial"] + inv["entradas"] - inv["salidas"]
    r.append(_resultado("fact_inventario", "balance_inicial_entradas_salidas_final", "Consistencia",
                        ADVERTENCIA, len(inv), (balance != inv["inventario_final"]).sum(),
                        "Si falla, las salidas registradas superan el stock: son días de "
                        "QUIEBRE donde la demanda no pudo atenderse (demanda insatisfecha)."))

    r.append(_resultado("fact_inventario", "disponible_igual_final_menos_reservado", "Consistencia",
                        ERROR, len(inv),
                        (inv["inventario_final"] - inv["inventario_reservado"]
                         != inv["inventario_disponible"]).sum(),
                        "inventario_disponible = inventario_final - inventario_reservado."))

    # Continuidad: el inventario inicial de hoy es el final de ayer.
    ordenado = inv.sort_values(["producto_id", "ubicacion_id", "fecha"])
    final_ayer = ordenado.groupby(["producto_id", "ubicacion_id"])["inventario_final"].shift()
    r.append(_resultado("fact_inventario", "continuidad_final_ayer_igual_inicial_hoy",
                        "Consistencia", ERROR, final_ayer.notna().sum(),
                        (final_ayer.notna() & (final_ayer != ordenado["inventario_inicial"])).sum(),
                        "El inventario inicial de un día debe ser el final del día anterior."))

    # La salida diaria del inventario debe corresponder a la demanda del día.
    cruce = dem.merge(inv, on=["fecha", "producto_id", "ubicacion_id"], how="inner")
    r.append(_resultado("fact_inventario", "salidas_igual_demanda", "Consistencia", ERROR,
                        len(cruce), (cruce["salidas"] != cruce["unidades_demandadas"]).sum(),
                        "Las salidas del inventario deben igualar la demanda registrada."))

    r.append(_resultado("fact_compras", "valor_igual_cantidad_por_costo", "Consistencia", ERROR,
                        len(com), (com["cantidad"] * com["costo_unitario"] != com["valor_compra"]).sum(),
                        "valor_compra = cantidad x costo_unitario."))

    r.append(_resultado("fact_compras", "recepcion_posterior_a_pedido", "Consistencia", ERROR,
                        len(com), (com["fecha_recepcion"] < com["fecha_pedido"]).sum(),
                        "Un pedido no puede recibirse antes de ser colocado."))

    # Conciliación: toda entrada al inventario debe venir de una compra recibida ese día.
    recibido = (com.groupby(["fecha_recepcion", "producto_id", "ubicacion_id"])["cantidad"].sum()
                .rename("cantidad_comprada").reset_index().rename(columns={"fecha_recepcion": "fecha"}))
    entradas = inv[inv["entradas"] > 0][["fecha", "producto_id", "ubicacion_id", "entradas"]]
    conc = entradas.merge(recibido, on=["fecha", "producto_id", "ubicacion_id"], how="left")
    r.append(_resultado("fact_inventario", "entradas_conciliadas_con_compras", "Consistencia", ERROR,
                        len(conc), (conc["cantidad_comprada"].fillna(-1) != conc["entradas"]).sum(),
                        "Cada entrada al inventario debe coincidir con la cantidad recibida en compras."))

    costo = com.merge(prod[["producto_id", "costo_unitario"]], on="producto_id", suffixes=("", "_maestro"))
    r.append(_resultado("fact_compras", "costo_igual_maestro_producto", "Consistencia", ADVERTENCIA,
                        len(costo), (costo["costo_unitario"] != costo["costo_unitario_maestro"]).sum(),
                        "El costo pagado debería coincidir con el costo del maestro de productos."))

    r.append(_resultado("fact_lotes", "vencimiento_posterior_a_ingreso", "Consistencia", ERROR,
                        len(lot), (lot["fecha_vencimiento"] <= lot["fecha_ingreso"]).sum(),
                        "Un lote no puede vencer antes de ingresar."))
    r.append(_resultado("fact_lotes", "disponible_menor_o_igual_inicial", "Consistencia", ERROR,
                        len(lot), (lot["cantidad_disponible"] > lot["cantidad_inicial"]).sum(),
                        "Un lote no puede tener más unidades disponibles que las que ingresaron."))
    corte = inv["fecha"].max()
    r.append(_resultado("fact_lotes", "lotes_vencidos_con_existencias", "Consistencia", ADVERTENCIA,
                        len(lot), ((lot["fecha_vencimiento"] <= corte) & (lot["cantidad_disponible"] > 0)).sum(),
                        "Lotes ya vencidos a la fecha de corte que siguen con unidades: "
                        "no es un error del dato, es un hallazgo (hay que darlos de baja)."))

    # ------------------------------------------------------ Integridad referencial
    fks = [
        ("fact_demanda", dem, "producto_id", prod), ("fact_demanda", dem, "ubicacion_id", ubi),
        ("fact_inventario", inv, "producto_id", prod), ("fact_inventario", inv, "ubicacion_id", ubi),
        ("fact_compras", com, "producto_id", prod), ("fact_compras", com, "ubicacion_id", ubi),
        ("fact_compras", com, "proveedor_id", prov), ("fact_lotes", lot, "producto_id", prod),
        ("fact_lotes", lot, "ubicacion_id", ubi), ("dim_producto", prod, "proveedor_id", prov),
    ]
    for nombre, df, col, dim in fks:
        r.append(_resultado(nombre, f"fk_{col}_existe", "Integridad referencial", ERROR,
                            len(df), (~df[col].isin(dim[col])).sum(),
                            f"Cada {col} debe existir en su tabla dimensión."))

    return pd.DataFrame(r)


def resumen(reporte: pd.DataFrame) -> str:
    """Texto corto para imprimir en consola."""
    conteo = reporte["estado"].value_counts().to_dict()
    return (f"{len(reporte)} reglas evaluadas -> "
            f"OK: {conteo.get('OK', 0)}, ADVERTENCIA: {conteo.get(ADVERTENCIA, 0)}, "
            f"ERROR: {conteo.get(ERROR, 0)}")

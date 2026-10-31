"""pixel_art 插件 SQL 层：pixel_artworks / pixel_asset_refs。"""

import json

from db.connection import get_conn


def get_pixel_artwork(artwork_id: str):
    return get_conn().execute(
        "SELECT * FROM pixel_artworks WHERE artwork_id=?", (artwork_id,)
    ).fetchone()


def list_pixel_artworks() -> list:
    return get_conn().execute(
        "SELECT * FROM pixel_artworks ORDER BY updated_at DESC, created_at DESC"
    ).fetchall()


def add_pixel_artwork(values: tuple) -> None:
    payload = json.dumps(dict(zip(
        ("artwork_id", "name", "width", "height", "palette", "pixels", "created_at", "updated_at"),
        values)), ensure_ascii=False, default=str)
    get_conn().execute(
        "INSERT INTO pixel_artworks(artwork_id,name,width,height,palette,pixels,created_at,updated_at,raw_json,live_json) "
        "VALUES(?,?,?,?,?,?,?,?,?,?)", (*values, payload, payload),
    )
    get_conn().commit()


def update_pixel_artwork(values: tuple) -> None:
    payload = json.dumps(dict(zip(
        ("name", "width", "height", "palette", "pixels", "updated_at", "artwork_id"),
        values)), ensure_ascii=False, default=str)
    get_conn().execute(
        "UPDATE pixel_artworks SET name=?,width=?,height=?,palette=?,pixels=?,updated_at=?,live_json=? "
        "WHERE artwork_id=?", (*values[:6], payload, values[6]),
    )
    get_conn().commit()


def list_pixel_asset_refs(artwork_id: str | None = None) -> list:
    if artwork_id is None:
        rows = get_conn().execute(
            "SELECT ref_key,artwork_id FROM pixel_asset_refs"
        ).fetchall()
        return [dict(row) for row in rows]
    rows = get_conn().execute(
        "SELECT ref_key,artwork_id FROM pixel_asset_refs WHERE artwork_id=?", (artwork_id,)
    ).fetchall()
    return [dict(row) for row in rows]


def set_pixel_asset_ref(ref_key: str, artwork_id: str | None, updated_at: str) -> None:
    conn = get_conn()
    if not artwork_id:
        conn.execute("DELETE FROM pixel_asset_refs WHERE ref_key=?", (ref_key,))
    else:
        conn.execute(
            "INSERT INTO pixel_asset_refs(ref_key,artwork_id,updated_at,raw_json) VALUES(?,?,?,?) "
            "ON CONFLICT(ref_key) DO UPDATE SET artwork_id=excluded.artwork_id, "
            "updated_at=excluded.updated_at, raw_json=excluded.raw_json",
            (ref_key, artwork_id, updated_at,
             json.dumps({"ref_key": ref_key, "artwork_id": artwork_id, "updated_at": updated_at},
                        ensure_ascii=False)),
        )
    conn.commit()


def delete_pixel_artwork(artwork_id: str) -> None:
    conn = get_conn()
    conn.execute("BEGIN IMMEDIATE")
    try:
        conn.execute("DELETE FROM pixel_asset_refs WHERE artwork_id=?", (artwork_id,))
        conn.execute("DELETE FROM pixel_artworks WHERE artwork_id=?", (artwork_id,))
        conn.commit()
    except Exception:
        conn.rollback()
        raise


# ============================================================

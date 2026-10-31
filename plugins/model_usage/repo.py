"""model_usage 插件 SQL 层：model_usage_logs。"""

import json
from datetime import datetime

from db.connection import get_conn


# model_usage_logs（模型用量与消费）
# 独立记录表；本模块只读写该表，不触碰宿主共享表或插件表。
# ============================================================

_USAGE_FIELDS = (
    "called_at",
    "conversation_label",
    "turn_index",
    "feature_label",
    "model_name",
    "uncached_input_tokens",
    "cache_read_tokens",
    "cache_write_tokens",
    "output_tokens",
    "calculated_cost",
    "actual_cost",
    "price_tier",
    "currency",
    "interval_seconds",
)


def _row_to_usage(row) -> dict:
    uncached = row["uncached_input_tokens"]
    cache_read = row["cache_read_tokens"]
    cache_write = row["cache_write_tokens"]
    output = row["output_tokens"]
    return {
        "id": row["id"],
        "called_at": row["called_at"],
        "conversation_label": row["conversation_label"],
        "turn_index": row["turn_index"],
        "feature_label": row["feature_label"],
        "model_name": row["model_name"],
        "uncached_input_tokens": uncached,
        "cache_read_tokens": cache_read,
        "cache_write_tokens": cache_write,
        "output_tokens": output,
        "total_tokens": (uncached or 0) + (cache_read or 0) + (cache_write or 0) + (output or 0),
        "calculated_cost": row["calculated_cost"],
        "actual_cost": row["actual_cost"],
        "price_tier": row["price_tier"],
        "currency": row["currency"],
        "interval_seconds": row["interval_seconds"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def add_model_usage(record: dict) -> int:
    """插入一条模型调用记录，返回新记录 id。字段由 modules/model_usage.py 校验后传入。"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    values = [record.get(k) for k in _USAGE_FIELDS]
    payload = json.dumps({k: record.get(k) for k in _USAGE_FIELDS}, ensure_ascii=False, default=str)
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO model_usage_logs ("
        + ", ".join(_USAGE_FIELDS)
        + ", raw_json, live_json, created_at, updated_at) VALUES ("
        + ", ".join("?" for _ in _USAGE_FIELDS)
        + ", ?, ?, ?, ?)",
        (*values, payload, payload, now, now),
    )
    conn.commit()
    return int(cur.lastrowid)


def update_model_usage(record_id: int, record: dict) -> bool:
    """按 id 更新一条记录；记录不存在时返回 False。"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    assignments = ", ".join(f"{k}=?" for k in _USAGE_FIELDS)
    values = [record.get(k) for k in _USAGE_FIELDS]
    payload = json.dumps({k: record.get(k) for k in _USAGE_FIELDS}, ensure_ascii=False, default=str)
    conn = get_conn()
    cur = conn.execute(
        f"UPDATE model_usage_logs SET {assignments}, live_json=?, updated_at=? WHERE id=?",
        (*values, payload, now, int(record_id)),
    )
    conn.commit()
    return cur.rowcount > 0


def delete_model_usage(record_id: int) -> bool:
    """按 id 删除一条记录；记录不存在时返回 False。"""
    conn = get_conn()
    cur = conn.execute("DELETE FROM model_usage_logs WHERE id=?", (int(record_id),))
    conn.commit()
    return cur.rowcount > 0


def get_model_usage(record_id: int) -> dict | None:
    """按 id 取一条模型调用记录。"""
    row = get_conn().execute(
        "SELECT * FROM model_usage_logs WHERE id=?", (int(record_id),)
    ).fetchone()
    return _row_to_usage(row) if row else None


def list_model_usage() -> list[dict]:
    """按调用时间倒序返回全部模型调用记录（筛选与聚合在前端按同一份数据完成）。"""
    rows = get_conn().execute(
        "SELECT * FROM model_usage_logs ORDER BY called_at DESC, id DESC"
    ).fetchall()
    return [_row_to_usage(r) for r in rows]


def model_usage_suggestions() -> dict[str, list[str]]:
    """对话标签 / 功能标签 / 模型名的历史候选：去重后按最近使用时间倒序。"""
    conn = get_conn()
    out: dict[str, list[str]] = {}
    for column in ("conversation_label", "feature_label", "model_name"):
        rows = conn.execute(
            f"SELECT {column} AS value, MAX(called_at) AS latest "
            f"FROM model_usage_logs GROUP BY {column} "
            f"ORDER BY latest DESC, value COLLATE NOCASE LIMIT 100"
        ).fetchall()
        out[column] = [r["value"] for r in rows]
    return out


# ============================================================

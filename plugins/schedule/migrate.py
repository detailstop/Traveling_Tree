"""schedule 表迁移：复合主键 + live_json（保留 raw_json 原始值）。"""
from __future__ import annotations


def migrate(conn) -> None:
    row = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='schedule_tasks'"
    ).fetchone()
    if row:
        sql = str(row["sql"] or "")
        if "PRIMARY KEY (task_id, week_key, day_key)" not in sql:
            conn.execute("ALTER TABLE schedule_tasks RENAME TO schedule_tasks_old")
            conn.execute(
                """CREATE TABLE schedule_tasks (
                     task_id TEXT NOT NULL, week_key TEXT NOT NULL, day_key TEXT NOT NULL,
                     title TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',
                     done INTEGER NOT NULL DEFAULT 0, raw_json TEXT NOT NULL,
                     PRIMARY KEY (task_id, week_key, day_key)
                   )"""
            )
            conn.execute(
                """INSERT OR REPLACE INTO schedule_tasks
                   (task_id,week_key,day_key,title,note,done,raw_json)
                   SELECT task_id,week_key,day_key,title,note,done,raw_json
                   FROM schedule_tasks_old"""
            )
            conn.execute("DROP TABLE schedule_tasks_old")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_schedule_tasks_week ON schedule_tasks(week_key, day_key)")
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(schedule_assets)")}
    if "live_json" not in cols:
        conn.execute("ALTER TABLE schedule_assets ADD COLUMN live_json TEXT NOT NULL DEFAULT ''")
    conn.execute("UPDATE schedule_assets SET live_json=raw_json WHERE live_json IS NULL OR live_json=''")
    conn.commit()

-- russian 插件：学习核心五表。
-- 由 manifest.db.schema 声明；主程序 db/connection.py 扫描执行，不再写入 core.sql。

CREATE TABLE IF NOT EXISTS items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    item_type   TEXT    NOT NULL
                        CHECK(item_type IN ('daily','term','pattern')),
    russian     TEXT    NOT NULL,
    chinese     TEXT    NOT NULL,
    theme       TEXT,
    notes       TEXT,
    tag         TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    raw_json    TEXT    NOT NULL DEFAULT '',
    live_json   TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS item_stats (
    item_id         INTEGER PRIMARY KEY
                            REFERENCES items(id) ON DELETE CASCADE,
    level           TEXT    NOT NULL DEFAULT 'C'
                            CHECK(level IN ('A','B','C','LONG')),
    streak_a        INTEGER NOT NULL DEFAULT 0,
    last_review     TEXT,
    next_review     TEXT    NOT NULL,
    total_reviews   INTEGER NOT NULL DEFAULT 0,
    correct_reviews INTEGER NOT NULL DEFAULT 0,
    raw_json        TEXT    NOT NULL DEFAULT ''
    -- live_json 豁免：SRS 派生状态，可由 items + review_logs 重建
);

CREATE TABLE IF NOT EXISTS review_logs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id      INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    reviewed_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    result       INTEGER NOT NULL,
    old_level    TEXT    NOT NULL,
    new_level    TEXT    NOT NULL,
    raw_json     TEXT    NOT NULL DEFAULT '',
    live_json    TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS daily_logs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    log_date       TEXT    NOT NULL,
    daily_theme    TEXT,
    academic_theme TEXT,
    note           TEXT,
    created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
    raw_json       TEXT    NOT NULL DEFAULT '',
    live_json      TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS themes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL UNIQUE,
    category     TEXT    NOT NULL CHECK(category IN ('daily','academic')),
    default_type TEXT    NOT NULL DEFAULT 'daily'
                          CHECK(default_type IN ('daily','term','pattern')),
    raw_json     TEXT    NOT NULL DEFAULT '',
    live_json    TEXT    NOT NULL DEFAULT ''
);

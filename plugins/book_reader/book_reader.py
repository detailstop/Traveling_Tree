"""俄语书籍阅读与标注清洗。所有业务数据保存在 SQLite。"""
from __future__ import annotations

import hashlib
import json
import re
import uuid
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import config
from db.connection import get_conn


def _now(): return datetime.now(timezone.utc).isoformat(timespec="seconds")
def _id(): return str(uuid.uuid4())
def _json(value): return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
def _decode(value, fallback):
    try: return json.loads(value)
    except (TypeError, ValueError): return fallback
def _conn(): return get_conn()
def _one(sql, args=()):
    row = _conn().execute(sql, args).fetchone()
    return dict(row) if row else None
def _all(sql, args=()): return [dict(r) for r in _conn().execute(sql, args).fetchall()]


def _book(book_id):
    row = _one("SELECT * FROM reader_books WHERE book_id=?", (book_id,))
    if not row: raise LookupError("书籍不存在")
    return row


def _section(section_id):
    row = _one("SELECT * FROM reader_sections WHERE section_id=?", (section_id,))
    if not row: raise LookupError("层级不存在")
    return row


def _sentence(sentence_id):
    row = _one("SELECT * FROM reader_sentences WHERE sentence_id=?", (sentence_id,))
    if not row: raise LookupError("句子不存在")
    return row


def _tokens(text): return text.split()


def _parse_import_text(source):
    decoder=json.JSONDecoder(); n=len(source); i=0
    def skip(pos):
        while pos<n and source[pos].isspace():pos+=1
        return pos
    i=skip(i)
    if i>=n or source[i]!='[':raise ValueError("导入内容必须是 JSON 数组")
    i+=1; records=[]; fragments=[]
    while True:
        i=skip(i)
        if i<n and source[i]==']':i=skip(i+1);break
        start=i
        try:item,end=decoder.raw_decode(source,i)
        except ValueError as exc:raise ValueError(f"JSON 格式错误：{exc}") from exc
        records.append(item);fragments.append(source[start:end]);i=skip(end)
        if i<n and source[i]==',':
            i=skip(i+1)
            if i<n and source[i]==']':raise ValueError("JSON 数组末项后不能有逗号")
            continue
        if i<n and source[i]==']':i=skip(i+1);break
        raise ValueError("JSON 数组分隔符格式错误")
    if i!=n:raise ValueError("JSON 数组后存在多余内容")
    return records,fragments


def _valid_record(record):
    return (isinstance(record, dict) and isinstance(record.get("sentence_ru"), str) and bool(record["sentence_ru"].strip())
            and isinstance(record.get("translation_zh"), str) and bool(record["translation_zh"].strip()))


def _delete_placeholder(pid):
    _conn().execute("DELETE FROM reader_placeholders WHERE placeholder_id=?", (pid,)); _conn().commit()
    return True


def _word_match(surface):
    return _one("""SELECT w.word_id FROM reader_words w
      WHERE w.lemma=? OR EXISTS(SELECT 1 FROM json_each(w.inflections) i WHERE i.value=?)
      ORDER BY CASE WHEN w.lemma=? THEN 0 ELSE 1 END LIMIT 1""", (surface, surface, surface))


def _phrase_match(surface):
    return _one("SELECT phrase_id FROM reader_phrases WHERE phrase_lemma=? LIMIT 1", (surface,))


def _validate_word_mark(mark):
    if mark.get("status")!="cleaned":return True
    word=_one("SELECT lemma,translation,inflections FROM reader_words WHERE word_id=?",(mark["word_id"],)) if mark.get("word_id") else None
    if word and (mark["surface"]==word["lemma"] or mark["surface"] in _decode(word["inflections"],[])):
        mark["vocab_summary"]=" · ".join(x for x in (word["lemma"],word["translation"]) if x);return True
    _conn().execute("UPDATE reader_marks SET word_id=NULL,status='uncleaned' WHERE mark_id=?",(mark["mark_id"],))
    mark["word_id"]=None;mark["status"]="uncleaned";return False


def _validate_phrase_mark(mark):
    if mark.get("status")!="cleaned":return True
    phrase=_one("SELECT phrase_lemma,translation FROM reader_phrases WHERE phrase_id=?",(mark["phrase_id"],)) if mark.get("phrase_id") else None
    if phrase:
        mark["vocab_summary"]=" · ".join(x for x in (phrase["phrase_lemma"],phrase["translation"]) if x);return True
    _conn().execute("UPDATE reader_marks SET phrase_id=NULL,status='uncleaned' WHERE mark_id=?",(mark["mark_id"],))
    mark["phrase_id"]=None;mark["status"]="uncleaned";return False


def _validate_mark(mark):
    return _validate_word_mark(mark) if mark.get("mark_type")=="word" else _validate_phrase_mark(mark)


def _validate_cleaned_marks(book_id=None,section_id=None):
    where="m.status='cleaned'";args=[]
    if book_id:where+=" AND m.book_id=?";args.append(book_id)
    if section_id:where+=" AND s.section_id=?";args.append(section_id)
    marks=_all(f"SELECT m.* FROM reader_marks m JOIN reader_sentences s USING(sentence_id) WHERE {where}",args)
    changed=False
    for mark in marks:changed=not _validate_mark(mark) or changed
    if changed:_conn().commit()
    return changed


_MARK_END_PUNCT = ".,!?;:…)\"»”’'"

def _strip_mark_surface(surface):
    """只剥离词末常见标点；保留词首标点、词内连字符/撇号与 ё/Ё。"""
    text = str(surface or "").strip()
    cleaned = text.rstrip(_MARK_END_PUNCT)
    return cleaned or text

def _mark(book_id, sentence_id, kind, surface, indexes, source="manual"):
    linked = _word_match(surface) if kind == "word" else None
    linked_phrase = _phrase_match(surface) if kind == "phrase" else None
    conn = _conn()
    conn.execute("""INSERT INTO reader_marks(mark_id,book_id,sentence_id,mark_type,surface,token_indexes,
      word_id,phrase_id,status,source,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
      (_id(), book_id, sentence_id, kind, surface, _json(indexes), linked["word_id"] if linked else None,
       linked_phrase["phrase_id"] if linked_phrase else None,
       "cleaned" if linked or linked_phrase else "uncleaned", source, _now()))


def _token_locations(tokens, word): return [i for i, token in enumerate(tokens) if token == word]


def _phrase_locations(tokens, phrase):
    parts = phrase.split()
    if not parts: return []
    return [[i + j for j in range(len(parts))] for i in range(len(tokens)-len(parts)+1)
            if tokens[i:i+len(parts)] == parts]


def list_books():
    return _all("""SELECT b.*, (SELECT section_id FROM reader_sections s WHERE s.book_id=b.book_id AND s.parent_id IS NULL LIMIT 1) root_section_id,
      (SELECT COUNT(*) FROM reader_sentences x WHERE x.book_id=b.book_id) sentence_count
      FROM reader_books b ORDER BY b.order_index,b.created_at""")


def create_book(data):
    name = str(data.get("name") or "").strip()
    if not name: raise ValueError("书名不能为空")
    conn = _conn(); now = _now(); book_id = _id(); root = _id()
    order = conn.execute("SELECT COALESCE(MAX(order_index),-1)+1 FROM reader_books").fetchone()[0]
    conn.execute("INSERT INTO reader_books VALUES(?,?,?,?,?)", (book_id,name,order,now,now))
    conn.execute("INSERT INTO reader_sections VALUES(?,?,?,?,?,?)", (root,book_id,None,"根目录",0,now))
    conn.commit()
    return {"book": next(b for b in list_books() if b["book_id"] == book_id)}


def get_book(book_id):
    book = _book(book_id)
    book["sections"] = _all("SELECT * FROM reader_sections WHERE book_id=? AND parent_id IS NULL ORDER BY order_index", (book_id,))
    book["root_section_id"] = book["sections"][0]["section_id"] if book["sections"] else None
    return book


def rename_book(book_id, data):
    _book(book_id); name = str(data.get("name") or "").strip()
    if not name: raise ValueError("书名不能为空")
    _conn().execute("UPDATE reader_books SET name=?,updated_at=? WHERE book_id=?", (name,_now(),book_id)); _conn().commit()
    return {"book": _book(book_id)}


def delete_book(book_id):
    _book(book_id); _conn().execute("DELETE FROM reader_books WHERE book_id=?", (book_id,)); _conn().commit()
    return {"deleted_id": book_id}


def copy_book(book_id, data):
    source=_book(book_id); conn=_conn(); selected=data.get("section_ids")
    if selected is not None and not isinstance(selected,list): raise ValueError("section_ids 必须为数组")
    if selected is None: selected=[r[0] for r in conn.execute("SELECT section_id FROM reader_sections WHERE book_id=? AND parent_id IS NULL",(book_id,))]
    if any(not _one("SELECT 1 FROM reader_sections WHERE section_id=? AND book_id=?",(sid,book_id)) for sid in selected):raise ValueError("复制范围包含其他书籍的层级")
    chosen=set(selected);selected=list(dict.fromkeys(selected))
    def selected_ancestor(sid):
        parent=_section(sid)["parent_id"]
        while parent:
            if parent in chosen:return True
            parent=_section(parent)["parent_id"]
        return False
    selected=[sid for sid in selected if not selected_ancestor(sid)]
    conn.execute("BEGIN IMMEDIATE")
    try:
        n=1
        while _one("SELECT 1 FROM reader_books WHERE book_id=?",(f"{book_id}_copy{n}",)): n+=1
        new_id=f"{book_id}_copy{n}"; now=_now(); root=_id()
        conn.execute("INSERT INTO reader_books VALUES(?,?,?,?,?)",(new_id,source["name"]+f" 副本{n}",conn.execute("SELECT COALESCE(MAX(order_index),-1)+1 FROM reader_books").fetchone()[0],now,now))
        conn.execute("INSERT INTO reader_sections VALUES(?,?,?,?,?,?)",(root,new_id,None,"根目录",0,now))
        section_map={}
        def clone_section(old_id,parent_new):
            old=_section(old_id); sid=_id(); section_map[old_id]=sid
            conn.execute("INSERT INTO reader_sections VALUES(?,?,?,?,?,?)",(sid,new_id,parent_new,old["name"],old["order_index"],now))
            for invalid in _all("SELECT * FROM reader_placeholders WHERE section_id=? ORDER BY order_index",(old_id,)):
                conn.execute("INSERT INTO reader_placeholders VALUES(?,?,?,?,?,?,?,?)",(_id(),new_id,sid,invalid["order_index"],invalid["raw_json"],invalid["error"],invalid["import_index"],now))
            for sent in _all("SELECT * FROM reader_sentences WHERE section_id=? ORDER BY order_index",(old_id,)):
                new_sent=_id(); conn.execute("INSERT INTO reader_sentences VALUES(?,?,?,?,?,?,?,?)",(new_sent,new_id,sid,sent["order_index"],sent["sentence_ru"],sent["translation_zh"],sent["tokens_json"],now))
                if data.get("copy_marks",True):
                    for mark in _all("SELECT * FROM reader_marks WHERE sentence_id=?",(sent["sentence_id"],)):
                        conn.execute("INSERT INTO reader_marks VALUES(?,?,?,?,?,?,?,?,?,?,?)",(_id(),new_id,new_sent,mark["mark_type"],mark["surface"],mark["token_indexes"],mark["word_id"],mark["phrase_id"],mark["status"],mark["source"],now))
            for child in _all("SELECT section_id FROM reader_sections WHERE parent_id=? ORDER BY order_index",(old_id,)):clone_section(child["section_id"],sid)
        for sid in selected: clone_section(sid,root)
        # Root is always preserved; selected sections are nested below it.
        conn.commit()
        return {"book":_book(new_id),"source_book_id":book_id,"section_count":len(section_map)}
    except Exception:
        conn.rollback(); raise


def reorder_books(data):
    ids = data.get("book_ids")
    if not isinstance(ids,list) or len(ids)!=len(set(ids)): raise ValueError("book_ids 必须为不重复数组")
    conn = _conn()
    for idx, book_id in enumerate(ids): conn.execute("UPDATE reader_books SET order_index=?,updated_at=? WHERE book_id=?",(idx,_now(),book_id))
    conn.commit(); return {"books":list_books()}


def add_section(book_id, data):
    _book(book_id); name = str(data.get("name") or "").strip(); parent = data.get("parent_id")
    if not name: raise ValueError("层级名称不能为空")
    if parent:
        p = _section(parent)
        if p["book_id"] != book_id: raise ValueError("父层级不属于当前书籍")
    conn = _conn(); sid = _id(); now = _now()
    order = conn.execute("SELECT COALESCE(MAX(order_index),-1)+1 FROM reader_sections WHERE book_id=? AND parent_id IS ?",(book_id,parent)).fetchone()[0]
    conn.execute("INSERT INTO reader_sections VALUES(?,?,?,?,?,?)", (sid,book_id,parent,name,order,now)); conn.commit()
    return {"section":_section(sid)}


def section_data(section_id):
    section = _section(section_id)
    section["children"] = _all("SELECT s.*, (SELECT COUNT(*) FROM reader_sentences x WHERE x.section_id=s.section_id) sentence_count FROM reader_sections s WHERE parent_id=? ORDER BY order_index",(section_id,))
    section["sentences"] = _all("SELECT * FROM reader_sentences WHERE section_id=? ORDER BY order_index",(section_id,))
    conn=_conn(); changed=False
    for sentence in section["sentences"]:
        sentence["tokens"] = _decode(sentence.pop("tokens_json"),[])
        sentence["marks"] = _all("SELECT * FROM reader_marks WHERE sentence_id=?",(sentence["sentence_id"],))
        for mark in sentence["marks"]:
            mark["token_indexes"] = _decode(mark.pop("token_indexes"),[])
            if mark["status"]=="cleaned":changed = not _validate_mark(mark) or changed
    if changed:conn.commit()
    section["placeholders"] = _all("SELECT * FROM reader_placeholders WHERE section_id=? ORDER BY order_index",(section_id,))
    section["items"] = sorted([{"kind":"sentence",**x} for x in section["sentences"]] +
                              [{"kind":"placeholder",**x} for x in section["placeholders"]],
                              key=lambda x:(x["order_index"],x["kind"]))
    return section


def book_full(book_id):
    """只读批量读取整本书：一次性返回层级树与全部句子（供通篇视图首屏使用）。"""
    book = _book(book_id)
    sections = _all("SELECT * FROM reader_sections WHERE book_id=? ORDER BY parent_id, order_index",
                    (book_id,))
    sentences = _all("SELECT * FROM reader_sentences WHERE book_id=? ORDER BY section_id, order_index",
                     (book_id,))
    marks = _all("SELECT m.* FROM reader_marks m JOIN reader_sentences s "
                 "ON s.sentence_id=m.sentence_id WHERE s.book_id=? ORDER BY m.created_at, m.mark_id",
                 (book_id,))
    placeholders = _all("SELECT * FROM reader_placeholders WHERE book_id=? "
                        "ORDER BY section_id, order_index", (book_id,))

    marks_by_sentence: dict[str, list[dict]] = {}
    for mark in marks:
        mark["token_indexes"] = _decode(mark.pop("token_indexes"), [])
        marks_by_sentence.setdefault(mark["sentence_id"], []).append(mark)
    sentences_by_section: dict[str, list[dict]] = {}
    for sentence in sentences:
        sentence["tokens"] = _decode(sentence.pop("tokens_json"), [])
        sentence["marks"] = marks_by_sentence.get(sentence["sentence_id"], [])
        sentences_by_section.setdefault(sentence["section_id"], []).append(sentence)
    placeholders_by_section: dict[str, list[dict]] = {}
    for item in placeholders:
        placeholders_by_section.setdefault(item["section_id"], []).append(item)

    by_id = {row["section_id"]: row for row in sections}
    children: dict[str | None, list[dict]] = {}
    for row in sections:
        children.setdefault(row["parent_id"], []).append(row)
    for rows in children.values():
        rows.sort(key=lambda x: (x["order_index"], x["section_id"]))

    order: list[str] = []
    built: dict[str, dict] = {}
    def build(row):
        section = dict(row)
        section["children"] = [build(child) for child in children.get(row["section_id"], [])]
        section["sentences"] = sentences_by_section.get(row["section_id"], [])
        section["placeholders"] = placeholders_by_section.get(row["section_id"], [])
        section["items"] = sorted(
            [{"kind": "sentence", **x} for x in section["sentences"]] +
            [{"kind": "placeholder", **x} for x in section["placeholders"]],
            key=lambda x: (x["order_index"], x["kind"]))
        built[row["section_id"]] = section
        order.append(row["section_id"])
        return section

    roots = [build(row) for row in children.get(None, [])]
    book["root_section_id"] = roots[0]["section_id"] if roots else None
    return {"book": book, "sections": roots, "order": order,
            "section_count": len(sections), "sentence_count": len(sentences)}


def import_json(section_id, data):
    section = _section(section_id); raw = data.get("content")
    if isinstance(raw,str):
        records,fragments = _parse_import_text(raw)
        source = raw
    else:
        records = raw; source = _json(raw);fragments=[_json(item) for item in records] if isinstance(records,list) else []
    if not isinstance(records,list): raise ValueError("导入内容必须是 JSON 数组")
    digest = hashlib.sha256(source.encode("utf-8")).hexdigest()
    conn = _conn()
    duplicate = conn.execute("SELECT batch_id FROM reader_import_batches WHERE book_id=? AND section_id=? AND content_hash=? ORDER BY created_at DESC LIMIT 1",(section["book_id"],section_id,digest)).fetchone()
    if duplicate and not data.get("allow_duplicate"):
        return {"duplicate_suspected":True,"message":"疑似重复导入，请确认是否继续。","previous_batch_id":duplicate[0]}
    now=_now(); batch_id=_id()
    conn.execute("INSERT INTO reader_import_batches VALUES(?,?,?,?,?)",(batch_id,section["book_id"],section_id,digest,now))
    order=data.get("order_index")
    if order is None:
        order=conn.execute("SELECT COALESCE(MAX(order_index),-1)+1 FROM (SELECT order_index FROM reader_sentences WHERE section_id=? UNION ALL SELECT order_index FROM reader_placeholders WHERE section_id=?)",(section_id,section_id)).fetchone()[0]
    good=bad=0; warnings=[]; sentence_ids=[]
    for ix, record in enumerate(records,1):
        reason=None
        if not isinstance(record,dict): reason="数组元素不是 JSON 对象"
        elif "sentence_ru" not in record or "translation_zh" not in record: reason="缺少 sentence_ru 或 translation_zh"
        elif not isinstance(record["sentence_ru"],str) or not isinstance(record["translation_zh"],str): reason="sentence_ru 与 translation_zh 必须为字符串"
        elif not record["sentence_ru"].strip() or not record["translation_zh"].strip(): reason="sentence_ru 与 translation_zh 去除空白后不能为空"
        if reason:
            conn.execute("INSERT INTO reader_placeholders VALUES(?,?,?,?,?,?,?,?)",(_id(),section["book_id"],section_id,order,fragments[ix-1],reason,ix,now)); order+=1; bad+=1; continue
        if "key_words" in record and not isinstance(record["key_words"],list): warnings.append(f"第 {ix} 条 key_words 不是数组，已忽略")
        if "key_phrases" in record and not isinstance(record["key_phrases"],list): warnings.append(f"第 {ix} 条 key_phrases 不是数组，已忽略")
        sentence_id=_id(); ru=record["sentence_ru"].strip(); tokens=_tokens(ru)
        conn.execute("INSERT INTO reader_sentences VALUES(?,?,?,?,?,?,?,?)",(sentence_id,section["book_id"],section_id,order,ru,record["translation_zh"].strip(),_json(tokens),now)); order+=1
        sentence_ids.append(sentence_id)
        for word in record.get("key_words",[]) if isinstance(record.get("key_words",[]),list) else []:
            if isinstance(word,str):
                for indexes in _token_locations(tokens,word): _mark(section["book_id"],sentence_id,"word",word,[indexes],"import")
        for phrase in record.get("key_phrases",[]) if isinstance(record.get("key_phrases",[]),list) else []:
            if isinstance(phrase,str):
                for indexes in _phrase_locations(tokens,phrase): _mark(section["book_id"],sentence_id,"phrase",phrase,indexes,"import")
        good+=1
    conn.commit()
    return {"batch_id":batch_id,"imported":good,"placeholders":bad,"warnings":warnings,"sentence_ids":sentence_ids}


def _record_error(record):
    """试验阅读屏的记录校验：返回错误文案，合法返回 None。"""
    if not isinstance(record, dict):
        return "数组元素不是 JSON 对象"
    ru, zh = record.get("sentence_ru"), record.get("translation_zh")
    if ru is None or zh is None:
        return "缺少 sentence_ru 或 translation_zh"
    if not isinstance(ru, str) or not isinstance(zh, str):
        return "sentence_ru 与 translation_zh 必须为字符串"
    if not ru.strip() or not zh.strip():
        return "sentence_ru 与 translation_zh 去除空白后不能为空"
    for field in ("key_words", "key_phrases"):
        if field in record:
            value = record[field]
            if not isinstance(value, list) or any(not isinstance(x, str) for x in value):
                return f"{field} 必须为字符串数组"
    return None


def _trim_punct(token):
    return token.strip(".,!?;:—–…«»\"'()[]{}")


def _word_hits(tokens, word):
    """整词匹配（大小写敏感）：优先完全相同的 token，其次忽略首尾标点的 token。"""
    hits = [i for i, token in enumerate(tokens) if token == word]
    if hits:
        return hits
    return [i for i, token in enumerate(tokens) if _trim_punct(token) == word]


def _phrase_hits(tokens, phrase):
    parts = phrase.split()
    if not parts:
        return []
    out = []
    for i in range(len(tokens) - len(parts) + 1):
        if [token for token in tokens[i:i + len(parts)]] == parts:
            out.append(list(range(i, i + len(parts))))
        elif [_trim_punct(token) for token in tokens[i:i + len(parts)]] == parts:
            out.append(list(range(i, i + len(parts))))
    return out


def append_sentences(section_id, data):
    """俄汉双语阅读屏：纯追加记录（不查重、不覆盖、不为非法项建占位）。

    与 import_json 的区别：这是一次性全量校验 —— 只要有任意一条非法就整批拒绝，
    避免把「用户已确认的合法项」之外的东西写进库。
    """
    section = _section(section_id)
    records = data.get("records")
    if not isinstance(records, list):
        raise ValueError("records 必须为 JSON 数组")
    if not records:
        return {"imported": 0, "sentence_ids": []}
    errors = []
    for ix, record in enumerate(records, 1):
        reason = _record_error(record)
        if reason:
            errors.append(f"第 {ix} 条：{reason}")
    if errors:
        raise ValueError("存在非法记录，整批未导入 —— " + "；".join(errors[:5]))
    conn = _conn()
    order = conn.execute(
        "SELECT COALESCE(MAX(order_index),-1)+1 FROM (SELECT order_index FROM reader_sentences WHERE section_id=?"
        " UNION ALL SELECT order_index FROM reader_placeholders WHERE section_id=?)",
        (section_id, section_id)).fetchone()[0]
    now = _now()
    sentence_ids = []
    for offset, record in enumerate(records):
        ru = record["sentence_ru"].strip()
        zh = record["translation_zh"].strip()
        tokens = _tokens(ru)
        sid = _id()
        conn.execute("INSERT INTO reader_sentences VALUES(?,?,?,?,?,?,?,?)",
                     (sid, section["book_id"], section_id, order + offset, ru, zh, _json(tokens), now))
        sentence_ids.append(sid)
        for word in record.get("key_words") or []:
            if not word.strip():
                continue
            for index in _word_hits(tokens, word):
                _mark(section["book_id"], sid, "word", word, [index], "import")
        for phrase in record.get("key_phrases") or []:
            if not phrase.strip():
                continue
            for indexes in _phrase_hits(tokens, phrase):
                _mark(section["book_id"], sid, "phrase", phrase, indexes, "import")
    conn.commit()
    return {"imported": len(sentence_ids), "sentence_ids": sentence_ids}


def update_section(section_id,data):
    section=_section(section_id); conn=_conn()
    if "name" in data:
        name=str(data["name"] or "").strip()
        if not name: raise ValueError("层级名称不能为空")
        conn.execute("UPDATE reader_sections SET name=? WHERE section_id=?",(name,section_id))
    if "order_index" in data: conn.execute("UPDATE reader_sections SET order_index=? WHERE section_id=?",(int(data["order_index"]),section_id))
    if "parent_id" in data:
        parent=data["parent_id"]
        if parent:
            target=_section(parent)
            if target["book_id"]!=section["book_id"] or target["section_id"]==section_id: raise ValueError("目标层级无效")
            descendant=conn.execute("WITH RECURSIVE d(id) AS (SELECT section_id FROM reader_sections WHERE parent_id=? UNION ALL SELECT s.section_id FROM reader_sections s JOIN d ON s.parent_id=d.id) SELECT 1 FROM d WHERE id=?",(section_id,parent)).fetchone()
            if descendant: raise ValueError("不能移动到自身的子层级")
        conn.execute("UPDATE reader_sections SET parent_id=? WHERE section_id=?",(parent,section_id))
    conn.commit(); return {"section":_section(section_id)}


def delete_section(section_id,data):
    s=_section(section_id)
    if s["parent_id"] is None:raise ValueError("根层级不能删除")
    if data.get("recursive"):
        _conn().execute("DELETE FROM reader_sections WHERE section_id=?",(section_id,)); _conn().commit(); return {"deleted_id":section_id,"recursive":True}
    counts=_conn().execute("SELECT (SELECT COUNT(*) FROM reader_sections WHERE parent_id=?)+(SELECT COUNT(*) FROM reader_sentences WHERE section_id=?)+(SELECT COUNT(*) FROM reader_placeholders WHERE section_id=?)",(section_id,section_id,section_id)).fetchone()[0]
    if counts: raise ValueError("非空层级禁止直接删除；请确认连同子层级与句子一起删除")
    _conn().execute("DELETE FROM reader_sections WHERE section_id=?",(section_id,)); _conn().commit(); return {"deleted_id":section_id,"recursive":False}


def add_mark(sentence_id,data):
    s=_sentence(sentence_id); kind=data.get("mark_type"); indexes=data.get("token_indexes")
    if kind not in ("word","phrase") or not isinstance(indexes,list) or not indexes: raise ValueError("标记类型或 token_indexes 无效")
    tokens=_decode(s["tokens_json"],[])
    try: indexes=[int(i) for i in indexes]
    except (ValueError,TypeError): raise ValueError("token_indexes 必须为整数数组")
    if any(i<0 or i>=len(tokens) for i in indexes): raise ValueError("标记地址超出句子范围")
    indexes=sorted(set(indexes)); surface=_strip_mark_surface(" ".join(tokens[i] for i in indexes))
    if kind=="word" and len(indexes)!=1: raise ValueError("单词标记必须只选一个 token")
    if _one("SELECT 1 FROM reader_marks WHERE sentence_id=? AND mark_type=? AND token_indexes=?",(sentence_id,kind,_json(indexes))): raise ValueError("该位置已标记")
    _mark(s["book_id"],sentence_id,kind,surface,indexes); _conn().commit()
    return {"marks":_all("SELECT * FROM reader_marks WHERE sentence_id=?",(sentence_id,))}


def delete_mark(mark_id):
    cur=_conn().execute("DELETE FROM reader_marks WHERE mark_id=?",(mark_id,)); _conn().commit()
    if not cur.rowcount: raise LookupError("标记不存在")
    return {"deleted_id":mark_id}


def assign_mark(mark_id,data):
    mark=_one("SELECT * FROM reader_marks WHERE mark_id=?",(mark_id,))
    if not mark:raise LookupError("标记不存在")
    kind=mark["mark_type"]; column="word_id" if kind=="word" else "phrase_id"; table=_vocab(kind)
    ident=column; target=data.get(ident)
    vocab=_one(f"SELECT * FROM {table} WHERE {ident}=?",(target,))
    if not vocab:raise ValueError("指定词库条目不存在")
    if kind=="word" and mark["surface"]!=vocab["lemma"] and mark["surface"] not in _decode(vocab["inflections"],[]):
        raise ValueError("该词形不在所选元单词原形或变格列表中")
    _conn().execute(f"UPDATE reader_marks SET word_id=NULL,phrase_id=NULL,{column}=?,status='cleaned' WHERE mark_id=?",(target,mark_id));_conn().commit()
    return {"mark_id":mark_id,ident:target,"status":"cleaned"}


def reorder_sentences(section_id,data):
    _section(section_id); ids=data.get("sentence_ids")
    if not isinstance(ids,list) or len(ids)!=len(set(ids)):raise ValueError("sentence_ids 必须为不重复数组")
    conn=_conn()
    for order,sid in enumerate(ids):
        cur=conn.execute("UPDATE reader_sentences SET order_index=? WHERE sentence_id=? AND section_id=?",(order,sid,section_id))
        if not cur.rowcount:raise ValueError("句子顺序包含其他层级的句子")
    conn.commit();return {"section_id":section_id}


def _vocab(kind): return "reader_words" if kind=="word" else "reader_phrases"


MEMORIZE_ROUNDS = (1, 2, 3, 4)


def _memorize_round(value, fallback=1):
    """轮次只接受整数 1–4；空值/非法值/越界值回落到 fallback（默认第 1 轮）。"""
    try:
        number = int(str(value).strip())
    except (TypeError, ValueError):
        return fallback
    return number if number in MEMORIZE_ROUNDS else fallback


_RU_LETTERS = set("АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя")


def _ru_letter_count(text):
    return sum(1 for ch in str(text or "") if ch in _RU_LETTERS)


def _validate_stress_examples(lemma, result):
    """校验清洗回填的 stress/examples；返回 (stress:int, examples:str|None)。"""
    if "stress" not in result or result.get("stress") in (None, ""):
        raise ValueError("缺少 stress（主词第几个俄语字母为重音，1 起）")
    raw = result.get("stress")
    if isinstance(raw, bool):
        raise ValueError("stress 必须为整数")
    try:
        stress = int(str(raw).strip())
    except (TypeError, ValueError):
        raise ValueError("stress 必须为整数")
    count = _ru_letter_count(lemma)
    if count <= 0:
        raise ValueError("主词不含俄语字母，无法校验 stress")
    if not (1 <= stress <= count):
        raise ValueError(f"stress 越界：主词共有 {count} 个俄语字母，收到 {stress}（应为 1–{count}）")
    if "examples" not in result or result.get("examples") in (None, ""):
        raise ValueError("缺少 examples（长度固定 3 的字符串数组）")
    examples = result.get("examples")
    if not isinstance(examples, list) or len(examples) != 3:
        raise ValueError("examples 必须为长度固定 3 的字符串数组")
    normalized = []
    for index, line in enumerate(examples, 1):
        if not isinstance(line, str) or not line.strip():
            raise ValueError(f"examples 第 {index} 条必须为非空字符串")
        if "\n" in line or "\r" in line:
            raise ValueError(f"examples 第 {index} 条不能包含换行（换行是 3 条例句的分隔符）")
        parts = line.split("||")
        if len(parts) != 2 or not parts[0].strip() or not parts[1].strip():
            raise ValueError(f"examples 第 {index} 条分隔符错误：需为「俄语||汉语」且两侧非空")
        normalized.append(line.strip())
    return stress, "\n".join(normalized)


def _storage_stress(value, fallback=None):
    if value is None or value == "":
        return fallback
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        raise ValueError("stress 必须为整数")


def _storage_examples(value, fallback=None):
    if value is None:
        return fallback
    if isinstance(value, list):
        return "\n".join(str(x).strip() for x in value if str(x).strip())
    return str(value)


def vocab_list(kind,query):
    _validate_cleaned_marks()
    table=_vocab(kind); q=(query.get("q") or "").strip(); pos=(query.get("pos") or "").strip()
    field="lemma" if kind=="word" else "phrase_lemma"
    rows=_all(f"SELECT * FROM {table} WHERE (?='' OR {field} LIKE ?) AND (?='' OR pos=?) ORDER BY lower({field})",(q,f"%{q}%",pos,pos)) if kind=="word" else _all(f"SELECT * FROM {table} WHERE (?='' OR {field} LIKE ?) ORDER BY lower({field})",(q,f"%{q}%"))
    for row in rows:
        for key in ("supplementary_notes","inflections","components"):
            if key in row: row[key]=_decode(row[key],[])
        row["memorize_round"]=_memorize_round(row.get("memorize_round"),1)
        if kind=="word":
            linked=_all("SELECT * FROM reader_marks WHERE word_id=? AND status='cleaned'",(row["word_id"],))
            for mark in linked:_validate_word_mark(mark)
        row["source_addresses"]=_source_addresses(kind,row["word_id"] if kind=="word" else row["phrase_id"])
    _conn().commit()
    def sort_key(row):
        word=row[field].lower().replace("ё","е")
        word="".join(c for c in unicodedata.normalize("NFD",word) if unicodedata.category(c)!="Mn")
        first=word[:1]
        return (0 if first and "а"<=first<="я" else 1,first,word,str(row.get("pos") or row.get("phrase_type") or "").lower())
    rows.sort(key=sort_key)
    return {"items":rows}


def _source_addresses(kind,item_id):
    column="word_id" if kind=="word" else "phrase_id"
    rows=_all(f"SELECT m.book_id,m.sentence_id,s.section_id,m.token_indexes FROM reader_marks m JOIN reader_sentences s ON s.sentence_id=m.sentence_id WHERE m.{column}=?",(item_id,))
    for r in rows:r["token_indexes"]=_decode(r["token_indexes"],[])
    return rows


def save_vocab(kind,data,item_id=None):
    table=_vocab(kind); field="lemma" if kind=="word" else "phrase_lemma"; ident="word_id" if kind=="word" else "phrase_id"
    if item_id:
        current=_one(f"SELECT * FROM {table} WHERE {ident}=?",(item_id,))
        if not current: raise LookupError("词库条目不存在")
    else: current={}
    lemma=str(data.get(field,current.get(field,"")) or "").strip()
    if not lemma:raise ValueError("词库原形不能为空")
    pos=str(data.get("pos",current.get("pos","")) or "").strip() if kind=="word" else str(data.get("phrase_type",current.get("phrase_type","")) or "").strip()
    found=_one(f"SELECT * FROM {table} WHERE {field}=? AND {'pos' if kind=='word' else 'phrase_type'}=?",(lemma,pos))
    if found and found[ident]!=item_id: item_id=found[ident]; current=found
    now=_now(); notes=data.get("supplementary_notes",_decode(current.get("supplementary_notes"),[])); inf=data.get("inflections",_decode(current.get("inflections"),[])); comp=data.get("components",_decode(current.get("components"),[]))
    if isinstance(notes,str):notes=[notes] if notes else []
    if not isinstance(notes,list) or not isinstance(inf,list) or not isinstance(comp,list):raise ValueError("补充释义、变格和组成项必须为数组")
    memorize_round=_memorize_round(data.get("memorize_round",current.get("memorize_round",1)),1)
    stress=_storage_stress(data.get("stress",current.get("stress")),current.get("stress"))
    examples=_storage_examples(data.get("examples",current.get("examples")),current.get("examples"))
    if item_id:
        _conn().execute(f"UPDATE {table} SET {field}=?,{('pos' if kind=='word' else 'phrase_type')}=?,translation=?,basic_usage=?,supplementary_notes=?,stress=?,examples=?,{'inflections=?,' if kind=='word' else 'components=?,'}memorize_round=?,updated_at=? WHERE {ident}=?",
          (lemma,pos,str(data.get("translation",current.get("translation","")) or ""),str(data.get("basic_usage",current.get("basic_usage","")) or ""),_json(notes),stress,examples,*([_json(inf)] if kind=="word" else [_json(comp)]),memorize_round,now,item_id))
    else:
        item_id=_id(); columns=("word_id,lemma,pos,translation,basic_usage,supplementary_notes,stress,examples,inflections,memorize_round,created_at,updated_at" if kind=="word" else "phrase_id,phrase_lemma,phrase_type,translation,basic_usage,supplementary_notes,stress,examples,components,memorize_round,created_at,updated_at")
        values=(item_id,lemma,pos,str(data.get("translation","") or ""),str(data.get("basic_usage","") or ""),_json(notes),stress,examples,_json(inf if kind=="word" else comp),memorize_round,now,now)
        _conn().execute(f"INSERT INTO {table}({columns}) VALUES({','.join('?' for _ in values)})",values)
    _conn().commit(); return {"item":_one(f"SELECT * FROM {table} WHERE {ident}=?",(item_id,))}


def merge_cleaned_vocab(kind,data):
    field="lemma" if kind=="word" else "phrase_lemma"
    discriminator="pos" if kind=="word" else "phrase_type"
    ident="word_id" if kind=="word" else "phrase_id"
    table=_vocab(kind); lemma=str(data[field]).strip(); kind_value=str(data.get(discriminator) or "").strip()
    existing=_one(f"SELECT * FROM {table} WHERE {field}=? AND {discriminator}=?",(lemma,kind_value))
    if not existing:return save_vocab(kind,{**data,"supplementary_notes":[data["note"]] if data.get("note") else []})["item"]
    notes=_decode(existing["supplementary_notes"],[])
    old_translation=str(existing.get("translation") or "").strip()
    old_usage=str(existing.get("basic_usage") or "").strip()
    new_translation=str(data.get("translation") or "").strip()
    new_usage=str(data.get("basic_usage") or "").strip()
    translation=new_translation or old_translation
    basic_usage=new_usage or old_usage
    # 重新回填按稳定键更新主翻译/用法；旧值进入补充区，避免覆盖后不可追溯。
    for old,new in ((old_translation,new_translation),(old_usage,new_usage)):
        if new and old and new!=old and old not in notes:notes.append(old)
    note=str(data.get("note") or "").strip()
    if note and note not in notes:notes.append(note)
    stress=_storage_stress(data.get("stress"),existing.get("stress"))
    examples=_storage_examples(data.get("examples"),existing.get("examples"))
    if kind=="word":
        inflections=_decode(existing["inflections"],[])
        inflections.extend(x for x in data.get("inflections",[]) if isinstance(x,str) and x and x not in inflections)
        _conn().execute("UPDATE reader_words SET translation=?,basic_usage=?,supplementary_notes=?,stress=?,examples=?,inflections=?,updated_at=? WHERE word_id=?",(translation,basic_usage,_json(notes),stress,examples,_json(inflections),_now(),existing[ident]))
    else:
        comps=_decode(existing["components"],[])
        comps.extend(x for x in data.get("components",[]) if x not in comps)
        _conn().execute("UPDATE reader_phrases SET translation=?,basic_usage=?,supplementary_notes=?,stress=?,examples=?,components=?,updated_at=? WHERE phrase_id=?",(translation,basic_usage,_json(notes),stress,examples,_json(comps),_now(),existing[ident]))
    _conn().commit();return _one(f"SELECT * FROM {table} WHERE {ident}=?",(existing[ident],))


def delete_vocab(kind,item_id):
    table=_vocab(kind); ident="word_id" if kind=="word" else "phrase_id"
    if not _one(f"SELECT 1 FROM {table} WHERE {ident}=?",(item_id,)):raise LookupError("词库条目不存在")
    column="word_id" if kind=="word" else "phrase_id"
    _conn().execute(f"UPDATE reader_cleaning_records SET returned_at=NULL WHERE mark_id IN (SELECT mark_id FROM reader_marks WHERE {column}=?)",(item_id,))
    _conn().execute(f"UPDATE reader_marks SET {column}=NULL,status='uncleaned' WHERE {column}=?",(item_id,))
    _conn().execute(f"DELETE FROM {table} WHERE {ident}=?",(item_id,)); _conn().commit(); return {"deleted_id":item_id}


def clear_vocab(kind):
    """全部删除（经核实回填按稳定键覆盖：保留词条，只把标记退回待清洗）。"""
    table=_vocab(kind); ident="word_id" if kind=="word" else "phrase_id"
    mark_type="word" if kind=="word" else "phrase"
    items=_all(f"SELECT * FROM {table}")
    marks=_all("SELECT * FROM reader_marks WHERE mark_type=?",(mark_type,))
    backup_dir=Path(config.DATA_DIR)/"backup"; backup_dir.mkdir(parents=True,exist_ok=True)
    backup_path=backup_dir/f"reader_vocab_{kind}_{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    backup_path.write_text(json.dumps({"kind":kind,"exported_at":_now(),"items":items,"marks":marks},ensure_ascii=False,indent=2),encoding="utf-8")
    conn=_conn()
    _conn().execute("UPDATE reader_cleaning_records SET returned_at=NULL WHERE mark_id IN (SELECT mark_id FROM reader_marks WHERE mark_type=?)",(mark_type,))
    cur=conn.execute("UPDATE reader_marks SET status='uncleaned' WHERE mark_type=? AND status='cleaned'",(mark_type,))
    conn.commit()
    return {"mode":"overwrite","kept_items":len(items),"reset_marks":cur.rowcount,"backup_file":str(backup_path)}


def translation_pairs_list():
    return {"items":_all("SELECT * FROM reader_translation_pairs ORDER BY created_at DESC,id DESC")}


def translation_pairs_import(data):
    if isinstance(data,list):items=data
    elif isinstance(data,dict):items=data.get("items")
    else:items=None
    if not isinstance(items,list):raise ValueError("请求体必须是 JSON 数组（或 {\"items\":[...]}）")
    conn=_conn(); imported=[]; errors=[]
    for index,item in enumerate(items,1):
        try:
            if not isinstance(item,dict):raise ValueError("必须是对象")
            extra=[k for k in item.keys() if k not in ("ru","zh")]
            if extra:raise ValueError("只允许 ru、zh 两个字段，发现："+ "、".join(extra))
            ru=item.get("ru"); zh=item.get("zh")
            if not isinstance(ru,str) or not ru.strip():raise ValueError("ru 必须为非空字符串")
            if not isinstance(zh,str) or not zh.strip():raise ValueError("zh 必须为非空字符串")
            pair_id=_id(); conn.execute("INSERT INTO reader_translation_pairs(id,ru,zh,created_at) VALUES(?,?,?,?)",(pair_id,ru.strip(),zh.strip(),_now()))
            imported.append(pair_id)
        except (ValueError,TypeError) as exc:
            errors.append({"index":index,"error":str(exc)})
    conn.commit();return {"imported":len(imported),"ids":imported,"errors":errors,"total":len(items)}


def translation_pair_delete(pair_id):
    cur=_conn().execute("DELETE FROM reader_translation_pairs WHERE id=?",(pair_id,))
    if not cur.rowcount:raise LookupError("互译条目不存在")
    _conn().commit();return {"deleted_id":pair_id}


def translation_pairs_clear():
    count=_conn().execute("SELECT COUNT(*) FROM reader_translation_pairs").fetchone()[0]
    _conn().execute("DELETE FROM reader_translation_pairs");_conn().commit();return {"deleted":count}


def mark_exported(data):
    """批量把词条标记为曾被选中导出（export_selected=1）。"""
    items=data.get("items") if isinstance(data,dict) else None
    if items is None and isinstance(data,dict) and data.get("ids"):
        items=[{"kind":data.get("kind","word"),"id":x} for x in data.get("ids") or []]
    if not isinstance(items,list):raise ValueError("items 必须为 [{kind,id}] 数组")
    updated=0; missing=[]; seen=set()
    for item in items:
        if not isinstance(item,dict):continue
        kind=str(item.get("kind") or "word")
        ident=str(item.get("id") or "")
        if kind not in ("word","phrase") or not ident:continue
        if (kind,ident) in seen:continue
        seen.add((kind,ident))
        table="reader_words" if kind=="word" else "reader_phrases"
        column="word_id" if kind=="word" else "phrase_id"
        cur=_conn().execute(f"UPDATE {table} SET export_selected=1 WHERE {column}=?",(ident,))
        if cur.rowcount:updated+=cur.rowcount
        else:missing.append({"kind":kind,"id":ident})
    _conn().commit();return {"updated":updated,"missing":missing}


def cleaned_vocab(query):
    """全库已清洗（有 cleaned 标记）且有释义词条；支持起始条数与 export_selected 筛选。"""
    selected=str(query.get("selected") or "all")
    rows=[]
    for kind,table,lemma_field,pos_field,id_field in (
        ("word","reader_words","lemma","pos","word_id"),
        ("phrase","reader_phrases","phrase_lemma","phrase_type","phrase_id"),
    ):
        for r in _all(f"""SELECT '{kind}' kind, {id_field} id, {lemma_field} lemma, {pos_field} pos,
            translation, stress, examples, export_selected
            FROM {table} t WHERE TRIM(COALESCE(translation,'')) <> ''
            AND EXISTS(SELECT 1 FROM reader_marks m WHERE m.{id_field}=t.{id_field} AND m.status='cleaned')"""):
            r["stress"]=int(r["stress"]) if r.get("stress") is not None else None
            r["export_selected"]=1 if int(r.get("export_selected") or 0) else 0
            rows.append(r)
    if selected in ("0","1"):
        want=int(selected);rows=[r for r in rows if r["export_selected"]==want]
    def sort_key(r):
        word=str(r.get("lemma") or "").lower().replace("ё","е")
        word="".join(c for c in unicodedata.normalize("NFD",word) if unicodedata.category(c)!="Mn")
        return (word,str(r.get("pos") or ""),r.get("kind") or "")
    rows.sort(key=sort_key)
    total=len(rows)
    def num(value,fallback):
        try:return int(str(value).strip())
        except (TypeError,ValueError):return fallback
    start=num(query.get("start"),1);end=num(query.get("end"),total)
    start=max(1,start);end=min(total,end)
    if start>end:start=1;end=0
    items=rows[start-1:end] if end>=start else []
    return {"items":items,"total":total,"start":start,"end":end,"selected":selected}


def export_cleaning(data):
    scope=data.get("scope","book"); book_id=data.get("book_id"); section_id=data.get("section_id")
    where="m.status='uncleaned'"; args=[]
    if scope=="book":
        if not book_id:raise ValueError("当前书范围需要 book_id")
        _book(book_id); where+=" AND m.book_id=?";args.append(book_id)
    elif scope=="section":
        if not section_id:raise ValueError("当前层级范围需要 section_id")
        _section(section_id); where+=" AND s.section_id=?";args.append(section_id)
    elif scope!="global":raise ValueError("不支持的导出范围")
    _validate_cleaned_marks(book_id=book_id if scope=="book" else None,section_id=section_id if scope=="section" else None)
    mark_ids=data.get("mark_ids")
    if mark_ids is not None and not isinstance(mark_ids,list):
        raise ValueError("mark_ids 必须为数组")
    rows=_all(f"SELECT m.*,s.sentence_ru,s.translation_zh FROM reader_marks m JOIN reader_sentences s ON s.sentence_id=m.sentence_id JOIN reader_books b ON b.book_id=m.book_id JOIN reader_sections sec ON sec.section_id=s.section_id WHERE {where} ORDER BY b.order_index,sec.order_index,s.order_index,m.created_at,m.mark_id",args)
    info=_slice_range(rows,data.get("start"),data.get("end"))
    rows=info["items"]
    if mark_ids is not None:
        picked={str(x) for x in mark_ids}
        rows=[m for m in rows if m["mark_id"] in picked]
    if not rows:
        return {"task_id":None,"exported_at":_now(),"items":[],
                "range":{"start":info["start"],"end":info["end"],"total":info["total"]},
                "range_notes":info["range_notes"]}
    task_id=_id(); now=_now(); conn=_conn()
    conn.execute("INSERT INTO reader_cleaning_tasks(task_id,scope,exported_at,range_start,range_end,range_total) VALUES(?,?,?,?,?,?)",
                 (task_id,scope,now,info["start"],info["end"],info["total"]))
    out=[]
    for mark in rows:
        indexes=_decode(mark["token_indexes"],[]); record_id=_id()
        address={"book_id":mark["book_id"],"sentence_id":mark["sentence_id"]}
        if mark["mark_type"]=="word": address["token_index"]=indexes[0]
        else: address["token_indexes"]=indexes
        item={"record_id":record_id,"mark_id":mark["mark_id"],"mark_type":mark["mark_type"],"surface":mark["surface"],"address":address,"sentence_ru":mark["sentence_ru"],"translation_zh":mark["translation_zh"]}
        conn.execute("INSERT INTO reader_cleaning_records VALUES(?,?,?,?,?,NULL)",(record_id,task_id,mark["mark_id"],_json(address),_json(item)))
        out.append(item)
    conn.commit(); return {"task_id":task_id,"exported_at":now,"items":out,
        "range":{"start":info["start"],"end":info["end"],"total":info["total"]},
        "range_notes":info["range_notes"],
        "return_contract":{
            "stress":"整数，从 1 开始，表示主词第几个俄语字母为重音；只数俄语字母（а–я、ё），忽略空格与连字符；1 ≤ stress ≤ 主词俄语字母数",
            "examples":"长度固定 3 的字符串数组，每项为「俄语||汉语」；落库时用换行符连接 3 条，每条内部保留 ||",
        }}


def import_cleaning(data):
    task_id=str(data.get("task_id") or "").strip()
    if not task_id:
        raise ValueError("旧导出包缺少 task_id，无法回填；请重新导出待清洗数据后再试")
    rows=data.get("results")
    if not isinstance(rows,list):raise ValueError("results 必须为数组")
    if not _one("SELECT 1 FROM reader_cleaning_tasks WHERE task_id=?",(task_id,)):
        raise ValueError("清洗任务不存在或已失效（可能来自旧导出包）；请重新导出待清洗数据后再试")
    conn=_conn(); done=[]; skipped=[]; errors=[]
    for result in rows:
        record_id=result.get("record_id") if isinstance(result,dict) else None
        try:
            if not isinstance(result,dict):raise ValueError("返还记录必须为对象")
            record=_one("SELECT * FROM reader_cleaning_records WHERE task_id=? AND record_id=?",(task_id,record_id))
            if not record:raise ValueError("record_id 不属于该清洗任务；请确认回填包与 task_id 对应")
            # 幂等：同一任务/记录已回填过，直接跳过，不再合并词库。
            if record.get("returned_at"):
                skipped.append({"record_id":record_id,"reason":"该记录此前已回填，已幂等跳过"})
                continue
            mark=_one("SELECT * FROM reader_marks WHERE mark_id=?",(record["mark_id"],))
            if not mark:
                raise ValueError("标记已删除或地址失效（书籍/句子可能已变）；请回到待清洗页重新导出")
            address=result.get("address")
            if not isinstance(address,dict) or address!=_decode(record["address_json"],{}):
                raise ValueError("回填地址与导出记录不一致（书籍/层级/句子可能已变）；请重新导出待清洗数据")
            if result.get("mark_type")!=mark["mark_type"] or result.get("surface")!=mark["surface"]:
                raise ValueError("标记类型或原词形不匹配（标注可能已变）；请重新导出待清洗数据")
            if mark["status"]=="cleaned":
                raise ValueError("该标记已被其他清洗任务回填；请勿重复回填，或重新导出剩余待清洗数据")
            kind=mark["mark_type"]
            if kind=="word":
                lemma=str(result.get("lemma") or "").strip()
                if not lemma:raise ValueError("缺少 lemma")
                stress,examples=_validate_stress_examples(lemma,result)
                item=merge_cleaned_vocab("word",{"lemma":lemma,"pos":result.get("pos"),"translation":result.get("translation"),"basic_usage":result.get("basic_usage"),"inflections":[mark["surface"],*(result.get("inflections") or [])],"note":result.get("note"),"stress":stress,"examples":examples})
                conn.execute("UPDATE reader_marks SET word_id=?,status='cleaned' WHERE mark_id=?",(item["word_id"],mark["mark_id"]))
            else:
                lemma=str(result.get("phrase_lemma") or "").strip()
                if not lemma:raise ValueError("缺少 phrase_lemma")
                stress,examples=_validate_stress_examples(lemma,result)
                item=merge_cleaned_vocab("phrase",{"phrase_lemma":lemma,"phrase_type":result.get("phrase_type"),"translation":result.get("translation"),"basic_usage":result.get("basic_usage"),"components":result.get("components") or [],"note":result.get("note"),"stress":stress,"examples":examples})
                conn.execute("UPDATE reader_marks SET phrase_id=?,status='cleaned' WHERE mark_id=?",(item["phrase_id"],mark["mark_id"]))
            conn.execute("UPDATE reader_cleaning_records SET returned_at=? WHERE record_id=?",(_now(),record["record_id"])); done.append(record["record_id"])
        except (ValueError,LookupError,TypeError) as exc:
            errors.append({"record_id":record_id,"error":str(exc),"hint":"请在「待清洗」页重新导出后再回填"})
            conn.execute("INSERT INTO reader_return_errors(task_id,record_id,error,payload,created_at) VALUES(?,?,?,?,?)",(task_id,record_id,str(exc),_json(result),_now()))
    conn.commit(); return {"task_id":task_id,"accepted":done,"skipped":skipped,"errors":errors}


def _parse_range_bound(value):
    """解析起止条数；空值返回 None，非法值返回 (None, True)。"""
    text = str(value if value is not None else "").strip()
    if not text:
        return None, False
    try:
        return int(text), False
    except (TypeError, ValueError):
        return None, True


def _slice_range(rows, start_raw, end_raw):
    """按 1 起、含两端的起止条数切片；越界夹取并返回提示，不改变原始顺序。"""
    total = len(rows)
    if total == 0:
        return {"items": [], "total": 0, "start": 1, "end": 0, "range_notes": []}
    start, start_bad = _parse_range_bound(start_raw)
    end, end_bad = _parse_range_bound(end_raw)
    notes = []
    if start_bad:
        notes.append("起始条数无效，已按 1 处理")
        start = 1
    if end_bad:
        notes.append("结束条数无效，已按全部处理")
        end = total
    if start is None:
        start = 1
    if end is None:
        end = total
    if start < 1:
        start = 1
        notes.append("起始条数已夹到 1")
    if end > total:
        end = total
        notes.append(f"结束条数已夹到 {total}")
    if end < 1:
        end = 0
        notes.append("结束条数小于 1，范围为空")
    if start > total:
        start = total + 1
        end = total
        notes.append(f"起始条数超过当前结果总数（{total} 条），范围为空")
    if start > end and not any("范围为空" in x for x in notes):
        notes.append("起始条数大于结束条数，范围为空")
    items = rows[start - 1:end] if end >= start else []
    return {"items": items, "total": total, "start": start, "end": end,
            "range_notes": notes}


def pending_marks(query):
    _validate_cleaned_marks(book_id=query.get("book_id"),section_id=query.get("section_id"))
    where="m.status='uncleaned'"; args=[]
    if query.get("book_id"):where+=" AND m.book_id=?";args.append(query["book_id"])
    if query.get("mark_type") in ("word","phrase"):where+=" AND m.mark_type=?";args.append(query["mark_type"])
    if query.get("section_id"):where+=" AND s.section_id=?";args.append(query["section_id"])
    items=_all(f"SELECT m.*,s.section_id,s.sentence_ru,s.translation_zh,b.name book_name,sec.name section_name FROM reader_marks m JOIN reader_sentences s ON s.sentence_id=m.sentence_id JOIN reader_books b ON b.book_id=m.book_id JOIN reader_sections sec ON sec.section_id=s.section_id WHERE {where} ORDER BY b.order_index,sec.order_index,s.order_index,m.created_at,m.mark_id",args)
    for x in items:x["token_indexes"]=_decode(x["token_indexes"],[])
    info=_slice_range(items,query.get("start"),query.get("end"))
    return {"items":info["items"],"total":info["total"],"start":info["start"],
            "end":info["end"],"range_notes":info["range_notes"]}


def export_cleaned(query):
    book_id=query.get("book_id"); args=[]; where="m.status='cleaned'"
    if book_id: _book(book_id); where+=" AND m.book_id=?";args.append(book_id)
    _validate_cleaned_marks(book_id=book_id)
    words=_all(f"SELECT DISTINCT w.* FROM reader_words w JOIN reader_marks m ON m.word_id=w.word_id WHERE {where} ORDER BY lower(w.lemma)",args)
    phrases=_all(f"SELECT DISTINCT p.* FROM reader_phrases p JOIN reader_marks m ON m.phrase_id=p.phrase_id WHERE {where} ORDER BY lower(p.phrase_lemma)",args)
    for w in words:
        w["supplementary_notes"]=_decode(w["supplementary_notes"],[]);w["inflections"]=_decode(w["inflections"],[])
        w["memorize_round"]=_memorize_round(w.get("memorize_round"),1)
        w["occurrences"]=_all("SELECT m.surface,s.sentence_ru,s.translation_zh,m.book_id,m.sentence_id,m.token_indexes FROM reader_marks m JOIN reader_sentences s USING(sentence_id) WHERE m.word_id=? AND m.status='cleaned'",(w["word_id"],))
        for o in w["occurrences"]:o["token_indexes"]=_decode(o["token_indexes"],[])
    for p in phrases:
        p["supplementary_notes"]=_decode(p["supplementary_notes"],[]);p["memorize_round"]=_memorize_round(p.get("memorize_round"),1)
        p["occurrences"]=_all("SELECT m.surface surface_text,s.sentence_ru,s.translation_zh,m.book_id,m.sentence_id,m.token_indexes FROM reader_marks m JOIN reader_sentences s USING(sentence_id) WHERE m.phrase_id=? AND m.status='cleaned'",(p["phrase_id"],))
        for o in p["occurrences"]:o["token_indexes"]=_decode(o["token_indexes"],[])
    return {"exported_at":_now(),"scope":f"书籍 {book_id}" if book_id else "全部已清洗数据","words":words,"phrases":phrases}


def definitions(query):
    """只读：返回已清洗且有释义的标记对应词条翻译，用于阅读屏浮停释义。"""
    raw=str(query.get("mark_ids") or "")
    ids=[]
    for part in raw.split(","):
        value=part.strip()
        if value and value not in ids:
            ids.append(value)
    if not ids:
        return {"items":{}}
    placeholders=",".join("?" for _ in ids)
    rows=_all(
        f"""SELECT m.mark_id,
                   CASE WHEN m.mark_type='word' THEN w.translation ELSE p.translation END AS translation
            FROM reader_marks m
            LEFT JOIN reader_words w ON w.word_id=m.word_id
            LEFT JOIN reader_phrases p ON p.phrase_id=m.phrase_id
            WHERE m.status='cleaned' AND m.mark_id IN ({placeholders})""",
        ids)
    items={}
    for row in rows:
        text=str(row.get("translation") or "").strip()
        if text:
            items[row["mark_id"]]=text
    return {"items":items}


def api(method,path,query,data):
    try:
        if method=="GET" and path=="/api/reader/visual-settings":
            from plugins.pixel_art import service
            return service.get_visual_settings(query.get("key") or None)
        if method in ("PUT","PATCH") and path=="/api/reader/visual-settings":
            from plugins.pixel_art import service
            key=data.get("key") or query.get("key") or None
            return service.save_visual_settings(data, key)
        if method=="GET" and path=="/api/reader/assets":
            from plugins.pixel_art.backend import assets_payload
            return assets_payload()
        if method=="GET" and path=="/api/books":return {"books":list_books()}
        if method=="POST" and path=="/api/books":return create_book(data)
        if method=="POST" and path=="/api/books/reorder":return reorder_books(data)
        if (m:=re.fullmatch(r"/api/books/([^/]+)/full",path)) and method=="GET":return book_full(m.group(1))
        if (m:=re.fullmatch(r"/api/books/([^/]+)",path)):
            bid=m.group(1)
            if method=="GET":return get_book(bid)
            if method=="PATCH":return rename_book(bid,data)
            if method=="DELETE":return delete_book(bid)
        if (m:=re.fullmatch(r"/api/books/([^/]+)/copy",path)) and method=="POST":return copy_book(m.group(1),data)
        if (m:=re.fullmatch(r"/api/books/([^/]+)/sections",path)) and method=="POST":return add_section(m.group(1),data)
        if (m:=re.fullmatch(r"/api/reader/sections/([^/]+)",path)):
            if method=="GET":return section_data(m.group(1))
            if method=="PATCH":return update_section(m.group(1),data)
            if method=="DELETE":return delete_section(m.group(1),data)
        if (m:=re.fullmatch(r"/api/reader/sections/([^/]+)/import",path)) and method=="POST":return import_json(m.group(1),data)
        if (m:=re.fullmatch(r"/api/reader/sections/([^/]+)/append",path)) and method=="POST":return append_sentences(m.group(1),data)
        if (m:=re.fullmatch(r"/api/reader/sections/([^/]+)/reorder",path)) and method=="POST":return reorder_sentences(m.group(1),data)
        if (m:=re.fullmatch(r"/api/reader/sentences/([^/]+)",path)):
            sid=m.group(1)
            if method=="DELETE":
                _sentence(sid); _conn().execute("DELETE FROM reader_sentences WHERE sentence_id=?",(sid,));_conn().commit();return {"deleted_id":sid}
            if method=="PATCH":
                sentence=_sentence(sid); conn=_conn(); cleared=False
                if "section_id" in data:
                    target=_section(data["section_id"])
                    if target["book_id"]!=sentence["book_id"]:raise ValueError("目标层级不属于该书")
                    conn.execute("UPDATE reader_sentences SET section_id=? WHERE sentence_id=?",(target["section_id"],sid))
                if "order_index" in data:conn.execute("UPDATE reader_sentences SET order_index=? WHERE sentence_id=?",(int(data["order_index"]),sid))
                if "sentence_ru" in data or "translation_zh" in data:
                    ru=str(data.get("sentence_ru",sentence["sentence_ru"]) or "").strip();zh=str(data.get("translation_zh",sentence["translation_zh"]) or "").strip()
                    if not ru or not zh:raise ValueError("俄语与翻译均不能为空")
                    conn.execute("DELETE FROM reader_marks WHERE sentence_id=?",(sid,))
                    conn.execute("UPDATE reader_sentences SET sentence_ru=?,translation_zh=?,tokens_json=? WHERE sentence_id=?",(ru,zh,_json(_tokens(ru)),sid));cleared=True
                conn.commit();return {"sentence":_sentence(sid),"marks_cleared":cleared}
        if (m:=re.fullmatch(r"/api/reader/placeholders/([^/]+)",path)):
            pid=m.group(1); item=_one("SELECT * FROM reader_placeholders WHERE placeholder_id=?",(pid,))
            if not item:raise LookupError("报错占位不存在")
            if method=="DELETE":_delete_placeholder(pid);return {"deleted_id":pid}
            if method=="PATCH":
                if "content" not in data:
                    section_id=data.get("section_id",item["section_id"]);target=_section(section_id)
                    if target["book_id"]!=item["book_id"]:raise ValueError("目标层级不属于该书")
                    order=int(data.get("order_index",item["order_index"]))
                    _conn().execute("UPDATE reader_placeholders SET section_id=?,order_index=? WHERE placeholder_id=?",(section_id,order,pid));_conn().commit()
                    return {"placeholder_id":pid,"section_id":section_id,"order_index":order}
                try:record=json.loads(data.get("content") or item["raw_json"])
                except ValueError as exc:raise ValueError(f"JSON 修复内容无效：{exc}") from exc
                if not _valid_record(record):raise ValueError("修复记录仍不符合句子格式")
                section_id=item["section_id"];order=item["order_index"]
                imported=import_json(section_id,{"content":[record],"allow_duplicate":True,"order_index":order})
                if not imported["sentence_ids"]:raise ValueError("修复没有生成句子")
                _conn().execute("DELETE FROM reader_marks WHERE sentence_id=?",(imported["sentence_ids"][0],))
                _delete_placeholder(pid)
                return {**imported,"repaired":True,"order_index":order}
        if (m:=re.fullmatch(r"/api/reader/sentences/([^/]+)/marks",path)) and method=="POST":return add_mark(m.group(1),data)
        if (m:=re.fullmatch(r"/api/reader/marks/([^/]+)",path)) and method=="DELETE":return delete_mark(m.group(1))
        if (m:=re.fullmatch(r"/api/reader/marks/([^/]+)",path)) and method=="PATCH":return assign_mark(m.group(1),data)
        if method=="GET" and path=="/api/reader/pending":return pending_marks(query)
        if method=="POST" and path=="/api/reader/cleaning/export":return export_cleaning(data)
        if method=="POST" and path=="/api/reader/cleaning/return":return import_cleaning(data)
        if method=="GET" and path=="/api/reader/definitions":return definitions(query)
        if method=="GET" and path=="/api/reader/export-cleaned":return export_cleaned(query)
        if method=="GET" and path=="/api/reader/translation-pairs":return translation_pairs_list()
        if method=="POST" and path=="/api/reader/translation-pairs/import":return translation_pairs_import(data)
        if method=="DELETE" and path=="/api/reader/translation-pairs":return translation_pairs_clear()
        if (m:=re.fullmatch(r"/api/reader/translation-pairs/([^/]+)",path)) and method=="DELETE":return translation_pair_delete(m.group(1))
        if method=="POST" and path=="/api/reader/vocabulary/words/clear":return clear_vocab("word")
        if method=="POST" and path=="/api/reader/vocabulary/phrases/clear":return clear_vocab("phrase")
        if method=="GET" and path=="/api/reader/vocabulary/cleaned":return cleaned_vocab(query)
        if method=="POST" and path=="/api/reader/vocabulary/mark-exported":return mark_exported(data)
        if method=="GET" and path=="/api/reader/vocabulary/words":return vocab_list("word",query)
        if method=="GET" and path=="/api/reader/vocabulary/phrases":return vocab_list("phrase",query)
        if method=="POST" and path=="/api/reader/vocabulary/words":return save_vocab("word",data)
        if method=="POST" and path=="/api/reader/vocabulary/phrases":return save_vocab("phrase",data)
        if (m:=re.fullmatch(r"/api/reader/vocabulary/(words|phrases)/([^/]+)",path)):
            kind="word" if m.group(1)=="words" else "phrase"
            if method=="PATCH":return save_vocab(kind,data,m.group(2))
            if method=="DELETE":return delete_vocab(kind,m.group(2))
        raise LookupError(f"未找到书籍阅读接口：{method} {path}")
    except LookupError as exc:
        raise

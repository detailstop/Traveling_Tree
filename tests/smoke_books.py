"""俄语书籍阅读 API 冒烟测试（临时 SQLite 数据库）。"""
from __future__ import annotations
import json, sys, tempfile, threading, time, urllib.error, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
TMP=Path(tempfile.mkdtemp(prefix="rt_books_test_"))
import config
config.DATA_DIR=TMP; config.DB_PATH=TMP/"books.db"
from ui.web.server import Handler, ThreadingHTTPServer, _bootstrap_db

PORT=8897; BASE=f"http://127.0.0.1:{PORT}"
def req(method,path,body=None):
    data=json.dumps(body,ensure_ascii=False).encode() if body is not None else None
    request=urllib.request.Request(BASE+path,data=data,method=method,headers={"Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(request,timeout=15) as r:return r.status,json.loads(r.read().decode())
    except urllib.error.HTTPError as e:return e.code,json.loads(e.read().decode())

def main():
    _bootstrap_db(); server=ThreadingHTTPServer(("127.0.0.1",PORT),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();time.sleep(.15)
    checks=[]
    def check(name,ok):checks.append(bool(ok));print(("PASS " if ok else "FAIL ")+name)
    status,created=req("POST","/api/plugin/book_reader/books",{"name":"阅读测试"});book=created.get("book",{});bid=book.get("book_id");root=book.get("root_section_id")
    check("create book and root section",status==200 and bid and root)
    _,sec=req("POST",f"/api/plugin/book_reader/books/{bid}/sections",{"name":"第一章","parent_id":root});sid=sec["section"]["section_id"]
    content=json.dumps([{"sentence_ru":"Я читаю книгу.","translation_zh":"我在读书。","key_words":["книгу."],"key_phrases":["читаю книгу."]},{"sentence_ru":"","translation_zh":"无效"},"bad"],ensure_ascii=False,indent=2)
    status,imported=req("POST",f"/api/plugin/book_reader/reader/sections/{sid}/import",{"content":content});check("import valid sentences with invalid placeholders",status==200 and imported["imported"]==1 and imported["placeholders"]==2)
    _,view=req("GET",f"/api/plugin/book_reader/reader/sections/{sid}");sentence=view["sentences"][0];mark=sentence["marks"][0]
    check("tokenize and locate imported word and phrase",len(sentence["tokens"])==3 and len(sentence["marks"])==2)
    _,duplicate=req("POST",f"/api/plugin/book_reader/reader/sections/{sid}/import",{"content":content});check("detect identical repeat import",duplicate.get("duplicate_suspected") is True)
    _,before_fix=req("GET",f"/api/plugin/book_reader/reader/sections/{sid}");placeholder=before_fix["placeholders"][0]
    _,repair=req("PATCH",f"/api/plugin/book_reader/reader/placeholders/{placeholder['placeholder_id']}",{"content":"{\"sentence_ru\":\"Ты здесь.\",\"translation_zh\":\"你在这里。\",\"key_words\":[\"Ты\"]}"})
    _,after_fix=req("GET",f"/api/plugin/book_reader/reader/sections/{sid}")
    fixed=next(x for x in after_fix["sentences"] if x["sentence_ru"]=="Ты здесь.")
    check("preserve raw invalid JSON placeholder and repair to unmarked sentence",repair.get("repaired") is True and placeholder["raw_json"].startswith("{\n") and not fixed["marks"] and fixed["order_index"]==1)
    _,task=req("POST","/api/plugin/book_reader/reader/cleaning/export",{"scope":"book","book_id":bid});record=next(x for x in task["items"] if x["mark_type"]=="word")
    status,returned=req("POST","/api/plugin/book_reader/reader/cleaning/return",{"task_id":task["task_id"],"results":[{"record_id":record["record_id"],"mark_type":"word","address":record["address"],"surface":record["surface"],"lemma":"книга","pos":"noun","translation":"书","basic_usage":"名词","inflections":["книги"],"stress":3,"examples":["Книга лежит здесь.||书在这里。","Я читаю книгу.||我在读这本书。","Это моя книга.||这是我的书。"]}]})
    check("return cleaning data links vocabulary",status==200 and len(returned["accepted"])==1 and not returned["errors"])
    _,words=req("GET","/api/plugin/book_reader/reader/vocabulary/words?q=%D0%BA%D0%BD%D0%B8%D0%B3%D0%B0");check("global word library exposes source addresses",len(words["items"])==1 and bool(words["items"][0]["source_addresses"]))
    _,pending=req("GET","/api/plugin/book_reader/reader/pending");check("uncleaned panel lists remaining phrase mark",len(pending["items"])==1 and pending["items"][0]["mark_type"]=="phrase")
    _,exported=req("GET","/api/plugin/book_reader/reader/export-cleaned");check("export cleaned study data",len(exported["words"])==1 and exported["words"][0]["occurrences"])
    _,copy=req("POST",f"/api/plugin/book_reader/books/{bid}/copy",{"section_ids":[sid],"copy_marks":True});copy_id=copy["book"]["book_id"]
    check("copy selected section with new sentence addresses",copy["section_count"]==1 and copy_id==f"{bid}_copy1")
    status,deleted=req("DELETE",f"/api/plugin/book_reader/books/{bid}");_,remaining=req("GET","/api/plugin/book_reader/reader/vocabulary/words")
    check("delete book preserves global vocabulary and other book sources",status==200 and deleted["deleted_id"]==bid and len(remaining["items"])==1 and len(remaining["items"][0]["source_addresses"])==1 and remaining["items"][0]["source_addresses"][0]["book_id"]==copy_id)
    server.shutdown();server.server_close();print(f"RESULT: {sum(checks)}/{len(checks)} PASS");return 0 if all(checks) else 1
if __name__=="__main__":raise SystemExit(main())

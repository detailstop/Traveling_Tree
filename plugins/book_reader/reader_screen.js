'use strict';
/* ============================================================================
   俄汉双语阅读屏 · 俄语书籍阅读内部功能
   ----------------------------------------------------------------------------
   · 作为书籍阅读内部的全屏视图使用，不再提供首页独立入口；
   · 三个阅读层级：通读级（俄汉逐句交替行，不再分段）/ 句子级 / 单句级；
   · 会话内状态：位置记忆、手动段首、删除与撤销栈、导入批次、视觉设置、
     汉语遮挡、关键词高亮、短语折叠 —— 全部只存在于这个 JS 对象里，
     退出 / 刷新即丢弃，不改动任何原始导入数据；
   · 不提供导出，不包含朗读与读屏软件兼容。
   ============================================================================ */
(function () {
  const SCREEN_VISUAL_KEY = 'reader.screen.visual';
  const LEVEL_LABEL = { para: '通读级', sentence: '句子级', single: '单句级' };
  const LEVELS = [
    { id: 'para', label: '通读级' },
    { id: 'sentence', label: '句子级' },
    { id: 'single', label: '单句级' },
  ];
  const VIS_GROUPS = [
    { k: 'ru', t: '俄语行' },
    { k: 'zh', t: '汉语行' },
    { k: 'kw', t: '关键词 / 短语行' },
    { k: 'mask', t: '汉语遮挡条' },
  ];

  const defaultVisual = () => ({
    ru: { font: 'Georgia, "Times New Roman", "Noto Serif", serif', size: 21, lh: 1.7, color: '#241c22', bg: '' },
    zh: { font: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif', size: 15, lh: 1.65, color: '#6b5b63', bg: '' },
    kw: { font: '"Microsoft YaHei", sans-serif', size: 12.5, lh: 1.5, color: '#b4576f', bg: '#ffe6ee' },
    mask: { font: 'inherit', size: 15, lh: 1.6, color: '#d9d2e3', opacity: 88, bg: '' },
    singleHidden: true,
  });

  const S = {
    mounted: false,
    loading: false,
    error: '',
    needCreate: false,
    needContext: false,
    embedded: false,
    context: null,
    books: [],
    sectionTree: [],
    sectionTreeBookId: '',
    emptyBookId: '',
    emptySectionId: '',
    book: null,
    section: null,
    rootId: '',
    autoDrilled: false,
    records: [],
    definitions: {},
    batches: [],
    deleted: new Set(),
    undo: [],
    masked: new Set(),
    tokenSel: new Map(),
    level: 'para',
    pos: { para: null, sentence: null, single: null },
    anchor: null,
    singleId: null,
    singleShown: false,
    origin: null,
    highlight: true,
    phraseOpen: { para: false, sentence: true, single: true },
    visual: defaultVisual(),
    dialog: null,
    preview: null,
    importText: '',
    scrollT: 0,
    suppressScroll: 0,
    restoringBm: false,
  };

  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));
  const esc2 = s => (typeof esc === 'function' ? esc(String(s == null ? '' : s)) : String(s == null ? '' : s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const uniq = arr => Array.from(new Set(arr));
  const cssId = id => (window.CSS && CSS.escape ? CSS.escape(String(id)) : String(id).replace(/["\\]/g, '\\$&'));

  async function req(path, opts = {}) {
    const o = { method: opts.method || 'GET', headers: {} };
    if (opts.body !== undefined) {
      o.headers['Content-Type'] = 'application/json';
      o.body = JSON.stringify(opts.body);
    }
    const res = await fetch(path, o);
    let data = null;
    try { data = await res.json(); } catch (e) { /* 非 JSON */ }
    if (!res.ok || (data && data.ok === false)) {
      throw new Error((data && data.error) || ('请求失败 ' + res.status));
    }
    return data;
  }

  /* ============================================================
     数据
     ============================================================ */
  function mapRecord(s) {
    const marks = Array.isArray(s.marks) ? s.marks : [];
    return {
      id: s.sentence_id,
      ru: s.sentence_ru,
      zh: s.translation_zh,
      tokens: Array.isArray(s.tokens) && s.tokens.length ? s.tokens : String(s.sentence_ru || '').split(/\s+/),
      words: marks.filter(m => m.mark_type === 'word'),
      phrases: marks.filter(m => m.mark_type === 'phrase'),
      batch: null,
    };
  }

  async function loadDefinitions() {
    const ids = [];
    S.records.forEach(rec => {
      [...(rec.words || []), ...(rec.phrases || [])].forEach(m => {
        if (m.mark_id && m.status === 'cleaned' && !ids.includes(m.mark_id)) ids.push(m.mark_id);
      });
    });
    if (!ids.length) { S.definitions = {}; return; }
    try {
      const data = await req('/api/plugin/book_reader/reader/definitions?mark_ids=' + encodeURIComponent(ids.join(',')));
      S.definitions = (data && data.items) || {};
    } catch (e) {
      S.definitions = {};
    }
  }

  async function loadScreenVisual() {
    try {
      const data = await req('/api/plugin/book_reader/reader/visual-settings?key=' + encodeURIComponent(SCREEN_VISUAL_KEY));
      if (data.visual) S.visual = data.visual;
    } catch (e) {
      S.visual = defaultVisual();
    }
  }

  let visualSaveTimer = 0;
  async function saveScreenVisual() {
    try {
      await req('/api/plugin/book_reader/reader/visual-settings', {
        method: 'PUT', body: { key: SCREEN_VISUAL_KEY, visual: S.visual },
      });
    } catch (e) {
      toast('视觉设置保存失败：' + (e.message || e), 'warn');
    }
  }
  function scheduleVisualSave() {
    clearTimeout(visualSaveTimer);
    visualSaveTimer = setTimeout(saveScreenVisual, 260);
  }

  async function loadSectionTree(bookId) {
    if (S.sectionTreeBookId === bookId && S.sectionTree.length) return;
    const data = await req('/api/plugin/book_reader/books/' + encodeURIComponent(bookId) + '/full');
    const out = [];
    const walk = (sec, depth) => {
      out.push({ id: sec.section_id, name: sec.name, depth });
      (sec.children || []).forEach(child => walk(child, depth + 1));
    };
    (data.sections || []).forEach(sec => walk(sec, 0));
    S.sectionTree = out;
    S.sectionTreeBookId = bookId;
  }

  async function loadData() {
    S.loading = true; S.error = ''; S.needCreate = false; S.needContext = false;
    render();
    try {
      const shelf = await req('/api/plugin/book_reader/books');
      S.books = shelf.books || [];
      if (!S.context || !S.context.bookId) {
        S.book = null; S.section = null;
        S.emptyBookId = S.emptyBookId || (S.books[0] ? S.books[0].book_id : '');
        if (S.emptyBookId) {
          try { await loadSectionTree(S.emptyBookId); } catch (e) { S.sectionTree = []; }
        }
        S.emptySectionId = S.emptySectionId || (S.sectionTree[0] ? S.sectionTree[0].id : '');
        S.loading = false; S.needContext = true;
        render();
        return;
      }
      const book = S.books.find(b => b.book_id === S.context.bookId);
      if (!book) throw new Error('找不到当前书籍，请返回书籍阅读重新进入');
      S.book = book;
      S.rootId = book.root_section_id;
      await loadSectionTree(book.book_id);
      let sectionId = S.context.sectionId;
      if (!sectionId || !S.sectionTree.some(x => x.id === sectionId)) sectionId = book.root_section_id;
      S.deleted = new Set(); S.undo = []; S.masked = new Set(); S.tokenSel = new Map();
      S.batches = []; S.level = 'para'; S.pos = { para: null, sentence: null, single: null };
      S.anchor = null; S.singleId = null; S.origin = null;
      let sec = await req('/api/plugin/book_reader/reader/sections/' + encodeURIComponent(sectionId));
      S.autoDrilled = false;
      if (!(sec.sentences || []).length && (sec.children || []).length) {
        let cur = sec;
        while (cur && !(cur.sentences || []).length && (cur.children || []).length) {
          cur = await req('/api/plugin/book_reader/reader/sections/' + encodeURIComponent(cur.children[0].section_id));
        }
        if ((cur.sentences || []).length) { sec = cur; S.autoDrilled = true; }
      }
      applySection(sec);
      await loadDefinitions();
      const bm = readReaderBookmark();
      let targetIndex = Number.isInteger(S.context.sentenceIndex)
        ? clamp(S.context.sentenceIndex, 0, Math.max(0, S.records.length - 1)) : null;
      if (bm && S.records.length) {
        const byId = bm.id ? S.records.findIndex(r => r.id === bm.id) : -1;
        const byIndex = Number.isInteger(bm.index) ? clamp(bm.index, 0, S.records.length - 1) : -1;
        targetIndex = byId >= 0 ? byId : (byIndex >= 0 ? byIndex : targetIndex);
      }
      if (targetIndex !== null && S.records.length) {
        const target = S.records[targetIndex];
        if (target) {
          S.level = 'sentence';
          S.pos.sentence = target.id;
          S.anchor = target.id;
        }
      }
      S.loading = false;
      render();
      if (targetIndex !== null && S.anchor) setTimeout(() => {
        S.restoringBm = true;
        scrollToId(S.anchor);
        if (bm) {
          const body = $('.rs-body');
          if (body) body.scrollTop += Number(bm.offset) || 0;
        }
        setTimeout(() => { S.restoringBm = false; }, 120);
      }, 0);
    } catch (e) {
      S.loading = false;
      S.error = e.message || '加载失败';
      render();
    }
  }

  function applySection(sec) {
    S.section = sec;
    S.records = (sec.sentences || []).map(mapRecord);
    S.pos = { para: null, sentence: null, single: null };
    S.anchor = S.records.length ? S.records[0].id : null;
    S.tokenSel = new Map();
  }

  async function reloadSection() {
    if (!S.section) return;
    const sec = await req('/api/plugin/book_reader/reader/sections/' + encodeURIComponent(S.section.section_id));
    S.section = sec;
    const prevBatch = new Map(S.records.map(r => [r.id, r.batch]));
    S.records = (sec.sentences || []).map(s => {
      const rec = mapRecord(s);
      rec.batch = prevBatch.get(rec.id) || null;
      return rec;
    });
    S.tokenSel = new Map();
    await loadDefinitions();
  }

  /* ============================================================
     可见性与位置
     ============================================================ */
  function visibleRecords() { return S.records.filter(r => !S.deleted.has(r.id)); }

  function nearestVisible(id) {
    const idx = S.records.findIndex(r => r.id === id);
    if (idx < 0) return null;
    for (let i = idx + 1; i < S.records.length; i += 1) if (!S.deleted.has(S.records[i].id)) return S.records[i].id;
    for (let i = idx - 1; i >= 0; i -= 1) if (!S.deleted.has(S.records[i].id)) return S.records[i].id;
    return null;
  }

  function capturePos() {
    if (S.level === 'single') {
      if (S.singleId) { S.pos.single = S.singleId; S.anchor = S.singleId; saveReaderBookmark(); }
      return;
    }
    const body = $('.rs-body');
    if (!body) return;
    const top = body.getBoundingClientRect().top + Math.min(160, body.clientHeight * 0.3);
    let best = null; let bestDist = Infinity;
    $$('.rs-sent[data-id]', body).forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.bottom < top - 40) return;
      const d = Math.abs(r.top - top);
      if (d < bestDist) { bestDist = d; best = el; }
    });
    if (best) { S.pos[S.level] = best.dataset.id; S.anchor = best.dataset.id; saveReaderBookmark(); }
  }

  const RS_BM_PREFIX = 'rt_reader_screen_bm_';
  function readerBmKey() {
    const book = S.context && S.context.bookId;
    const section = (S.context && S.context.sectionId) || (S.book && S.book.root_section_id) || '';
    return book && section ? RS_BM_PREFIX + book + '_' + section : '';
  }
  function readReaderBookmark() {
    const key = readerBmKey();
    if (!key) return null;
    try {
      const v = JSON.parse(localStorage.getItem(key) || 'null');
      if (!v || typeof v !== 'object') return null;
      if (!v.id && !Number.isInteger(v.index)) return null;
      return v;
    } catch (e) { return null; }
  }
  function saveReaderBookmark(manual) {
    if (S.restoringBm) return false;
    const key = readerBmKey();
    if (!key) return false;
    const id = S.level === 'single' ? S.singleId : (S.anchor || S.pos[S.level]);
    const idx = id ? S.records.findIndex(r => r.id === id) : -1;
    if (!id || idx < 0) return false;
    let offset = 0;
    const body = $('.rs-body');
    if (body) {
      const el = $('.rs-sent[data-id="' + cssId(id) + '"]', body);
      if (el) offset = Math.round(el.getBoundingClientRect().top - body.getBoundingClientRect().top);
    }
    try {
      localStorage.setItem(key, JSON.stringify({ id, index: idx, offset, at: Date.now() }));
    } catch (e) { return false; }
    if (manual) toast('书签已保存：第 ' + (idx + 1) + ' 句', 'success', 2200);
    return true;
  }

  function scrollToId(id, mode = 'center') {
    const body = $('.rs-body');
    if (!body || !id) return;
    const el = $('.rs-sent[data-id="' + cssId(id) + '"]', body);
    if (!el) return;
    S.suppressScroll = Date.now() + 420;
    el.scrollIntoView({ block: mode, behavior: 'auto' });
  }

  function resolvePos(level) {
    let id = S.pos[level];
    if (id && S.deleted.has(id)) id = nearestVisible(id);
    if (!id && S.anchor) id = S.deleted.has(S.anchor) ? nearestVisible(S.anchor) : S.anchor;
    return id;
  }

  function restorePos(level) {
    if (level === 'single') return;
    if (!visibleRecords().length) { toast('当前层级没有可见句子', 'warn'); return; }
    const id = resolvePos(level);
    if (id) { S.pos[level] = id; scrollToId(id); }
    else { const body = $('.rs-body'); if (body) body.scrollTop = 0; }
  }

  /* ============================================================
     渲染
     ============================================================ */
  function render(opts = {}) {
    const screen = $('.rs-screen');
    if (!screen) return;
    applyVisual(screen);
    screen.dataset.level = S.level;
    const body = $('.rs-body', screen);
    const keep = body ? body.scrollTop : 0;
    const top = $('.rs-top', screen);
    const quick = $('.rs-quick', screen);
    const flow = $('.rs-flow', screen);
    if (top) top.innerHTML = topHTML();
    if (quick) quick.innerHTML = quickHTML();
    if (flow) flow.innerHTML = bodyHTML();
    if (body && opts.keepScroll) body.scrollTop = keep;
    if (opts.scrollTo) scrollToId(opts.scrollTo);
  }

  function applyVisual(screen = $('.rs-screen')) {
    if (!screen) return;
    const v = S.visual;
    const st = screen.style;
    VIS_GROUPS.forEach(g => {
      const c = v[g.k];
      st.setProperty('--rs-' + g.k + '-font', c.font || 'inherit');
      st.setProperty('--rs-' + g.k + '-size', c.size + 'px');
      st.setProperty('--rs-' + g.k + '-lh', String(c.lh));
      st.setProperty('--rs-' + g.k + '-color', c.color || 'inherit');
      st.setProperty('--rs-' + g.k + '-bg', c.bg || 'transparent');
    });
    st.setProperty('--rs-mask-alpha', String(clamp(v.mask.opacity / 100, 0.05, 1)));
    st.setProperty('--rs-mask-h', Math.round(v.mask.size * 1.25) + 'px');
  }

  function topHTML() {
    const vis = visibleRecords();
    const secName = S.section ? S.section.name : '';
    const bookOpts = S.books.map(b => `<option value="${esc2(b.book_id)}" ${S.book && S.book.book_id === b.book_id ? 'selected' : ''}>${esc2(b.name)}</option>`).join('') || '<option value="">（书架为空）</option>';
    const secOpts = S.sectionTree.map(s => `<option value="${esc2(s.id)}" ${S.section && S.section.section_id === s.id ? 'selected' : ''}>${'　'.repeat(s.depth)}${esc2(s.name)}</option>`).join('') || '<option value="">（先选书籍）</option>';
    return `<div class="rs-brand"><span class="rs-logo">ЯЗ</span>
        <div class="rs-brand-t"><b>俄汉双语阅读屏</b><span>${S.book ? esc2(S.book.name) : '未选择书籍'} · ${esc2(secName || '未选择层级')}${S.autoDrilled ? '（根目录为空，自动下钻）' : ''} · 三档读法 / 遮挡 / 导入</span></div>
      </div>
      <label class="rs-pick">书籍<select id="rs-book-select" class="rs-sel" ${S.book ? '' : 'disabled'}>${bookOpts}</select></label>
      <label class="rs-pick">层级<select id="rs-section-select" class="rs-sel" ${S.book ? '' : 'disabled'}>${secOpts}</select></label>
      <div class="rs-levels">${LEVELS.map(l => `<button class="rs-lv${S.level === l.id ? ' on' : ''}" data-act="level" data-level="${l.id}">${l.label}</button>`).join('')}</div>
      <div class="rs-top-actions">
        <span class="rs-count">${vis.length} / ${S.records.length} 句</span>
        <button class="rs-tb" data-act="import"${S.section ? '' : ' disabled'}>＋ 导入 JSON</button>
        <button class="rs-tb" data-act="settings">⚙ 显示设置</button>
        <button class="rs-tb rs-exit" data-act="exit">退出阅读屏</button>
      </div>`;
  }

  function quickHTML() {
    const v = S.visual;
    const selCount = [...S.tokenSel.values()].reduce((n, set) => n + set.size, 0);
    const q = (k, label, value) => `<div class="rs-q"><span>${label}</span>
      <button data-act="quick" data-k="${k}" data-d="-1" aria-label="减小">−</button>
      <b>${value}</b>
      <button data-act="quick" data-k="${k}" data-d="1" aria-label="增大">＋</button></div>`;
    return q('ru', '俄语字号', v.ru.size)
      + q('zh', '汉语字号', v.zh.size)
      + q('lh', '行距', v.ru.lh.toFixed(2))
      + q('mask', '遮挡浓度', v.mask.opacity + '%')
      + `<button class="rs-chip" data-act="bookmark" title="按书籍+入口层级保存当前句书签；再次进入自动定位">🔖 书签</button>`
      + `<button class="rs-chip rs-chip-mask" data-act="mask-all" title="一键遮住当前层级全部汉语">全部遮住</button>`
      + `<button class="rs-chip rs-chip-mask" data-act="show-all" title="一键显示当前层级全部汉语">全部显示</button>`
      + `<button class="rs-chip${S.highlight ? ' on' : ''}" data-act="toggle-kw">关键词高亮 ${S.highlight ? '开' : '关'}</button>`
      + `<button class="rs-chip${S.phraseOpen[S.level] ? ' on' : ''}" data-act="toggle-phrases">重点词组 ${S.phraseOpen[S.level] ? '展开' : '收起'}</button>`
      + `<button class="rs-chip" data-act="mark-phrase"${selCount > 1 ? '' : ' disabled'}>标记词组${selCount ? ' · ' + selCount : ''}</button>`
      + (selCount ? `<button class="rs-chip" data-act="clear-token-sel">清除选择</button>` : '')
      + `<button class="rs-chip" data-act="undo"${S.undo.length ? '' : ' disabled'}>撤销删除${S.undo.length ? ' · ' + S.undo.length : ''}</button>`
      + (S.batches.length ? `<button class="rs-chip" data-act="batches">导入批次 · ${S.batches.length}</button>` : '');
  }

  function bodyHTML() {
    if (S.loading) return '<div class="rs-state">正在载入阅读屏…</div>';
    if (S.error) {
      return `<div class="rs-state rs-err"><p>${esc2(S.error)}</p>
        <div class="rs-row"><button class="rs-tb" data-act="reload">重试</button>
        <button class="rs-tb" data-act="exit">退出阅读屏</button></div></div>`;
    }
    if (S.needContext) {
      if (!S.books.length) {
        return '<div class="rs-state"><p>书架上还没有书籍。请先在「俄语书籍阅读」新建书籍并导入句子。</p><div class="rs-row"><button class="rs-tb" data-act="exit">退出阅读屏</button></div></div>';
      }
      const bookOpts = S.books.map(b => `<option value="${esc2(b.book_id)}" ${S.emptyBookId === b.book_id ? 'selected' : ''}>${esc2(b.name)}</option>`).join('');
      const secOpts = S.sectionTree.map(s => `<option value="${esc2(s.id)}" ${S.emptySectionId === s.id ? 'selected' : ''}>${'　'.repeat(s.depth)}${esc2(s.name)}</option>`).join('');
      return `<div class="rs-state rs-context-state">
        <p>当前没有书籍上下文。先选一本书，再选层级。</p>
        <div class="rs-row">
          <label class="rs-pick">书籍<select id="rs-empty-book" class="rs-sel">${bookOpts}</select></label>
          <label class="rs-pick">层级<select id="rs-empty-section" class="rs-sel">${secOpts || '<option value="">（该书没有层级）</option>'}</select></label>
          <button class="rs-tb" data-act="enter-context"${secOpts ? '' : ' disabled'}>进入阅读屏</button>
        </div>
        <p class="rs-hint">阅读屏仅作为「俄语书籍阅读」内部功能使用，请从书籍阅读顶栏的「俄汉双语阅读屏」带当前书 / 层级 / 句进入。</p>
      </div>`;
    }
    const vis = visibleRecords();
    if (!vis.length) {
      return `<div class="rs-state"><p>当前层级还没有句子。</p><div class="rs-row"><button class="rs-tb" data-act="import">导入 JSON</button></div></div>`;
    }
    if (S.level === 'single') return singleHTML(vis);
    if (S.level === 'sentence') return sentenceLevelHTML(vis);
    return paragraphHTML(vis);
  }

  /* ---------- 俄语高亮 ---------- */
  function ruHTML(rec) {
    const wordHits = new Set();
    const phraseHits = new Set();
    const wordDefs = new Map();
    const phraseDefs = new Map();
    rec.words.forEach(m => {
      (m.token_indexes || []).forEach(i => wordHits.add(i));
      const def = S.definitions[m.mark_id];
      if (def) (m.token_indexes || []).forEach(i => wordDefs.set(i, def));
    });
    rec.phrases.forEach(m => {
      (m.token_indexes || []).forEach(i => phraseHits.add(i));
      const def = S.definitions[m.mark_id];
      if (def) (m.token_indexes || []).forEach(i => phraseDefs.set(i, def));
    });
    const picked = S.tokenSel.get(rec.id) || new Set();
    return rec.tokens.map((t, i) => {
      const marked = S.highlight && (wordHits.has(i) || phraseHits.has(i));
      const cls = ['rs-token', marked ? 'marked' : '', phraseHits.has(i) ? 'phrase-marked' : '', picked.has(i) ? 'picked' : ''].filter(Boolean).join(' ');
      const def = phraseDefs.get(i) || wordDefs.get(i) || '';
      const tip = def ? ((phraseDefs.has(i) ? '重点词组' : '重点单词') + '：' + def) : (wordHits.has(i) || phraseHits.has(i) ? '' : '单击标记/取消单词；Shift 多选后可标记词组');
      return `<button class="${cls}" data-act="token" data-id="${esc2(rec.id)}" data-i="${i}" title="${esc2(tip)}">${esc2(t)}</button>`;
    }).join(' ');
  }

  /* ---------- 汉语（含遮挡条） ---------- */
  function maskWidth(text, min, max) {
    const n = String(text || '').length;
    return Math.max(min || 4, Math.min(max || 40, Math.ceil(n * 1.02)));
  }

  function zhHTML(rec, masked, indent) {
    const pad = indent ? `padding-left:${indent}px;` : '';
    if (masked) {
      return `<div class="rs-zh-wrap" style="${pad}"><div class="rs-maskbar" style="width:${maskWidth(rec.zh)}em" data-act="mask" data-id="${esc2(rec.id)}" title="点击显示汉语" aria-label="汉语被遮挡，点击显示"></div></div>`;
    }
    return `<div class="rs-zh-wrap" style="${pad}"><p class="rs-zh" data-act="mask" data-id="${esc2(rec.id)}" title="点击遮挡汉语">${esc2(rec.zh)}</p></div>`;
  }

  /* ---------- 关键短语 ---------- */
  function phrasesHTML(rec) {
    const seen = new Set();
    const list = rec.phrases.filter(p => {
      const key = p.mark_id || (p.surface + '|' + JSON.stringify(p.token_indexes || []));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (!list.length) return '';
    if (!S.phraseOpen[S.level]) {
      if (S.level === 'para') return '';
      return `<button class="rs-phrases-open" data-act="toggle-phrases">重点词组 ${list.length} · 展开</button>`;
    }
    return `<div class="rs-phrases"><span class="rs-phrases-h">词组</span>${list.map(p => { const def = S.definitions[p.mark_id] || ''; return `<span class="rs-phrase"${def ? ` title="重点词组：${esc2(def)}"` : ''}>${esc2(p.surface)}<button class="rs-mark-del" data-act="del-mark" data-mark="${esc2(p.mark_id || '')}" title="取消该词组标注">×</button></span>`; }).join('')}<button class="rs-phrases-t" data-act="toggle-phrases">收起</button></div>`;
  }

  function maskOf(id) { return S.masked.has(id); }

  /* ---------- 通读级（原段落级：只保留逐句交替，不再分段） ---------- */
  function paragraphHTML(vis) {
    const note = S.autoDrilled
      ? `<div class="rs-note">当前层级「${esc2(S.section ? S.section.name : '')}」由根目录为空时自动进入；导入会追加到该层级末尾。</div>`
      : '';
    const inner = vis.map(rec => paraPairHTML(rec)).join('');
    return note + `<div class="rs-flow-inner">${inner}</div>`;
  }

  function paraPairHTML(rec) {
    const masked = maskOf(rec.id);
    return `<div class="rs-sent rs-pair${masked ? ' is-masked' : ''}" data-id="${esc2(rec.id)}">
      <p class="rs-ru" data-act="open-single" data-id="${esc2(rec.id)}">${ruHTML(rec)}</p>
      ${zhHTML(rec, masked, 0)}
      ${phrasesHTML(rec)}
    </div>`;
  }

  /* ---------- 句子级 ---------- */
  function sentenceLevelHTML(vis) {
    return `<div class="rs-flow-inner rs-sentlist">${vis.map((r, i) => `<article class="rs-sent rs-block${maskOf(r.id) ? ' is-masked' : ''}" data-id="${esc2(r.id)}">
      <div class="rs-block-no">${String(i + 1).padStart(2, '0')}</div>
      <div class="rs-block-body">
        <p class="rs-ru" data-act="open-single" data-id="${esc2(r.id)}">${ruHTML(r)}</p>
        ${zhHTML(r, maskOf(r.id), 0)}
        ${phrasesHTML(r)}
        <div class="rs-block-tools">
          <button data-act="open-single" data-id="${esc2(r.id)}">单句</button>
          <button data-act="del" data-id="${esc2(r.id)}">删除</button>
        </div>
      </div>
    </article>`).join('')}</div>`;
  }

  /* ---------- 单句级 ---------- */
  function singleHTML(vis) {
    let idx = vis.findIndex(r => r.id === S.singleId);
    if (idx < 0) { idx = 0; S.singleId = vis[0].id; }
    const rec = vis[idx];
    const backLabel = S.origin ? `返回${LEVEL_LABEL[S.origin.level]}` : '';
    return `<div class="rs-single">
      <div class="rs-single-top">
        <button class="rs-tb" data-act="prev"${idx === 0 ? ' disabled' : ''}>← 上一句</button>
        <span class="rs-single-idx">${idx + 1} / ${vis.length}</span>
        <button class="rs-tb" data-act="next"${idx === vis.length - 1 ? ' disabled' : ''}>下一句 →</button>
      </div>
      <div class="rs-single-body">
        <p class="rs-ru rs-single-ru">${ruHTML(rec)}</p>
        <div class="rs-single-zh">${S.singleShown
          ? `<p class="rs-zh" data-act="mask" title="点击遮挡汉语">${esc2(rec.zh)}</p>`
          : `<div class="rs-maskbar rs-maskbar-lg" style="width:${maskWidth(rec.zh, 12, 30)}em" data-act="mask" title="点击显示汉语" aria-label="汉语被遮挡，点击显示"></div>`}</div>
        ${phrasesHTML(rec)}
      </div>
      <div class="rs-single-bot">
        <button class="rs-tb" data-act="del" data-id="${esc2(rec.id)}">删除本句</button>
        ${backLabel ? `<button class="rs-tb" data-act="back">${backLabel}</button>` : ''}
      </div>
    </div>`;
  }

  /* ============================================================
     层级与位置
     ============================================================ */
  function setLevel(level) {
    if (level === S.level) return;
    capturePos();
    if (S.level === 'single') S.origin = null;
    if (level === 'single') {
      S.origin = { level: S.level, pos: S.pos[S.level] };
      const vis = visibleRecords();
      if (!vis.length) { S.level = 'single'; S.singleId = null; render(); return; }
      let start = S.anchor && vis.some(r => r.id === S.anchor) ? S.anchor : null;
      if (!start) start = S.pos.sentence && vis.some(r => r.id === S.pos.sentence) ? S.pos.sentence : vis[0].id;
      S.level = 'single';
      S.singleId = start;
      S.anchor = start;
      S.singleShown = !S.visual.singleHidden;
      render({ scrollTo: start });
      return;
    }
    S.level = level;
    render();
    restorePos(level);
  }

  function openSingleAt(id) {
    if (window.getSelection && String(window.getSelection()).trim()) return;   // 正在选字时不触发
    const vis = visibleRecords();
    if (!vis.some(r => r.id === id)) return;
    capturePos();
    S.origin = { level: S.level === 'single' ? (S.origin ? S.origin.level : 'para') : S.level, pos: S.level === 'single' ? (S.origin ? S.origin.pos : null) : S.pos[S.level] };
    S.level = 'single';
    S.singleId = id;
    S.anchor = id;
    S.singleShown = !S.visual.singleHidden;
    render();
  }

  function leaveSingle() {
    if (!S.origin) { setLevel('para'); return; }
    const origin = S.origin;
    S.origin = null;
    S.level = origin.level;
    if (origin.pos) S.pos[origin.level] = origin.pos;
    render();
    restorePos(origin.level);
    if (!origin.pos) scrollToId(S.anchor);
  }

  function moveSingle(dir) {
    const vis = visibleRecords();
    if (!vis.length) return;
    let idx = vis.findIndex(r => r.id === S.singleId);
    if (idx < 0) idx = 0;
    idx = clamp(idx + dir, 0, vis.length - 1);
    S.singleId = vis[idx].id;
    S.anchor = S.singleId;
    S.singleShown = !S.visual.singleHidden;
    render();
  }

  /* ============================================================
     遮挡 / 删除 / 撤销
     ============================================================ */
  function toggleMask(id) {
    if (!id) return;
    if (window.getSelection && String(window.getSelection()).trim()) return;   // 选字时不误触
    if (S.masked.has(id)) S.masked.delete(id); else S.masked.add(id);
    render({ keepScroll: true });
  }

  function toggleTokenMark(sentenceId, index, shiftKey) {
    const rec = S.records.find(r => r.id === sentenceId);
    if (!rec) return;
    if (shiftKey) {
      if (S.tokenSel.size && !S.tokenSel.has(sentenceId)) S.tokenSel.clear();
      const set = S.tokenSel.get(sentenceId) || new Set();
      if (set.has(index)) set.delete(index); else set.add(index);
      if (set.size) S.tokenSel.set(sentenceId, set); else S.tokenSel.delete(sentenceId);
      render({ keepScroll: true });
      return;
    }
    S.tokenSel.clear();
    render({ keepScroll: true });
    const word = rec.words.find(m => (m.token_indexes || []).includes(index));
    if (word) {
      if (confirm('取消该重点单词标注？')) deleteMark(word.mark_id, true);
      return;
    }
    const phrase = rec.phrases.find(m => (m.token_indexes || []).includes(index));
    if (phrase) {
      toast('该词属于重点词组，请点词组标签上的 × 取消', 'info', 2800);
      return;
    }
    if (!confirm('将「' + rec.tokens[index] + '」标记为重点单词？')) return;
    addMark(sentenceId, 'word', [index]);
  }

  async function addMark(sentenceId, kind, indexes) {
    try {
      await req('/api/plugin/book_reader/reader/sentences/' + encodeURIComponent(sentenceId) + '/marks', {
        method: 'POST', body: { mark_type: kind, token_indexes: indexes },
      });
      await reloadSection();
      render({ keepScroll: true });
      toast(kind === 'word' ? '已标记重点单词' : '已标记重点词组', 'success');
    } catch (e) {
      toast('标注失败：' + (e.message || e), 'error');
    }
  }

  async function deleteMark(markId, skipConfirm = false) {
    if (!markId) return;
    if (!skipConfirm && !confirm('取消该重点标注？')) return;
    try {
      await req('/api/plugin/book_reader/reader/marks/' + encodeURIComponent(markId), { method: 'DELETE' });
      await reloadSection();
      render({ keepScroll: true });
      toast('已取消标注', 'success');
    } catch (e) {
      toast('取消标注失败：' + (e.message || e), 'error');
    }
  }

  async function markPhrase() {
    const entries = [...S.tokenSel].filter(([, set]) => set.size >= 2);
    if (!entries.length) { toast('请先 Shift 多选同一句的至少两个词', 'info'); return; }
    const [sentenceId, set] = entries[0];
    await addMark(sentenceId, 'phrase', [...set].sort((a, b) => a - b));
  }

  /* 一键全部遮住 / 全部显示汉语（单句级只作用于当前句） */
  function setAllMasked(hidden) {
    if (S.level === 'single') {
      S.singleShown = !hidden;
      render();
      toast(hidden ? '已遮住当前句汉语' : '已显示当前句汉语', 'info', 1400);
      return;
    }
    const vis = visibleRecords();
    if (!vis.length) return;
    vis.forEach(rec => { if (hidden) S.masked.add(rec.id); else S.masked.delete(rec.id); });
    render({ keepScroll: true });
    toast(hidden ? `已遮住 ${vis.length} 句汉语` : `已显示 ${vis.length} 句汉语`, 'info', 1600);
  }

  function deleteIds(ids, label) {
    const fresh = ids.filter(id => id && !S.deleted.has(id));
    if (!fresh.length) { toast('这些句子已经删过了', 'warn'); return false; }
    fresh.forEach(id => S.deleted.add(id));
    S.undo.push({ ids: fresh, label });
    if (S.level === 'single') {
      const vis = visibleRecords();
      if (!vis.length) S.singleId = null;
      else if (S.deleted.has(S.singleId)) S.singleId = nearestVisible(S.singleId) || vis[0].id;
    }
    render({ keepScroll: true });
    toast(label + '（仅本次会话隐藏，不改原文；可撤销）', 'success', 3600);
    return true;
  }

  function undoDelete() {
    const op = S.undo.pop();
    if (!op) { toast('撤销栈为空，没有可撤销的删除', 'warn'); return; }
    op.ids.forEach(id => S.deleted.delete(id));
    render({ keepScroll: true });
    toast('已撤销：' + op.label, 'success');
  }

  /* ============================================================
     视觉
     ============================================================ */
  function quickAdjust(k, d) {
    const v = S.visual;
    if (k === 'ru') v.ru.size = clamp(v.ru.size + d, 12, 40);
    else if (k === 'zh') v.zh.size = clamp(v.zh.size + d, 10, 32);
    else if (k === 'lh') { v.ru.lh = clamp(+ (v.ru.lh + d * 0.05).toFixed(2), 1.15, 2.6); v.zh.lh = clamp(+ (v.zh.lh + d * 0.05).toFixed(2), 1.15, 2.6); }
    else if (k === 'mask') v.mask.opacity = clamp(v.mask.opacity + d * 5, 20, 100);
    render({ keepScroll: true });
    scheduleVisualSave();
  }

  function setVisual(path, value) {
    const [k, f] = path.split('.');
    if (k === 'singleHidden') { S.visual.singleHidden = !!value; return; }
    if (!S.visual[k] || !(f in S.visual[k])) return;
    S.visual[k][f] = value;
  }

  /* ============================================================
     导入（校验 → 预览 → 仅导入合法项 / 取消整批）
     ============================================================ */
  function recordError(rec) {
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return '数组元素不是 JSON 对象';
    const ru = rec.sentence_ru;
    const zh = rec.translation_zh;
    if (ru === undefined || zh === undefined) return '缺少 sentence_ru 或 translation_zh';
    if (typeof ru !== 'string' || typeof zh !== 'string') return 'sentence_ru 与 translation_zh 必须为字符串';
    if (!ru.trim() || !zh.trim()) return 'sentence_ru 与 translation_zh 去除空白后不能为空';
    for (const f of ['key_words', 'key_phrases']) {
      if (f in rec) {
        const v = rec[f];
        if (!Array.isArray(v) || v.some(x => typeof x !== 'string')) return f + ' 必须为字符串数组';
      }
    }
    return '';
  }

  function validateImport(text) {
    let data;
    try { data = JSON.parse(text); }
    catch (e) { return { error: 'JSON 解析失败：' + e.message }; }
    if (Array.isArray(data) === false) return { error: '顶层必须是 JSON 数组（当前是 ' + (data === null ? 'null' : typeof data) + '）' };
    if (!data.length) return { empty: true, total: 0 };
    const valid = []; const invalid = [];
    data.forEach((rec, i) => {
      const reason = recordError(rec);
      if (reason) invalid.push({ index: i + 1, reason });
      else valid.push(rec);
    });
    return { total: data.length, valid, invalid };
  }

  function previewHTML() {
    const p = S.preview;
    if (!p) return '';
    if (p.error) return `<div class="rs-pv err">${esc2(p.error)}</div>`;
    if (p.empty) return `<div class="rs-pv">空数组：没有可导入的记录（不进入追加）。</div>`;
    const first = p.valid[0];
    const last = p.valid[p.valid.length - 1];
    return `<div class="rs-pv">
      <div class="rs-pv-stat"><span class="ok">合法 ${p.valid.length} 条</span><span class="${p.invalid.length ? 'bad' : 'dim'}">非法 ${p.invalid.length} 条</span><span class="dim">共 ${p.total} 条</span></div>
      ${p.invalid.length ? `<ol class="rs-pv-list">${p.invalid.slice(0, 8).map(x => `<li>第 ${x.index} 条：${esc2(x.reason)}</li>`).join('')}</ol>${p.invalid.length > 8 ? `<p class="rs-dim">…另有 ${p.invalid.length - 8} 条非法未列出</p>` : ''}` : ''}
      ${first ? `<div class="rs-pv-ex"><b>首条</b><div class="rs-pv-ru">${esc2(first.sentence_ru)}</div><div class="rs-pv-zh">${esc2(first.translation_zh)}</div>
        ${last && p.valid.length > 1 ? `<b>末条</b><div class="rs-pv-ru">${esc2(last.sentence_ru)}</div><div class="rs-pv-zh">${esc2(last.translation_zh)}</div>` : ''}</div>` : ''}
    </div>`;
  }

  function openImport() {
    S.dialog = 'import';
    S.preview = null;
    renderDialog();
  }

  async function doImport() {
    if (!S.preview || !S.preview.valid || !S.preview.valid.length) return;
    const records = S.preview.valid.map(rec => ({
      sentence_ru: rec.sentence_ru,
      translation_zh: rec.translation_zh,
      key_words: (rec.key_words || []).filter(x => x && x.trim()),
      key_phrases: (rec.key_phrases || []).filter(x => x && x.trim()),
    }));
    const btn = $('.rs-sheet [data-act="do-import"]');
    if (btn) { btn.disabled = true; btn.textContent = '正在导入…'; }
    try {
      const res = await req('/api/plugin/book_reader/reader/sections/' + encodeURIComponent(S.section.section_id) + '/append', {
        method: 'POST', body: { records },
      });
      await reloadSection();
      const batch = { id: 'b' + Date.now(), ids: res.sentence_ids || [], at: new Date(), count: res.imported || 0 };
      S.batches.push(batch);
      batch.ids.forEach(id => { const rec = S.records.find(x => x.id === id); if (rec) rec.batch = batch.id; });
      S.dialog = null;
      S.preview = null;
      S.importText = '';
      renderDialog();
      render({ scrollTo: batch.ids[0] });
      toast('已追加 ' + batch.count + ' 句到「' + (S.section ? S.section.name : '') + '」', 'success');
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = '仅导入合法项'; }
      toast('导入失败：' + (e.message || ''), 'error');
    }
  }

  /* ============================================================
     弹层
     ============================================================ */
  function renderDialog() {
    const layer = $('.rs-layer');
    if (!layer) return;
    if (!S.dialog) { layer.innerHTML = ''; return; }
    const body = S.dialog === 'settings' ? settingsHTML()
      : S.dialog === 'import' ? importHTML()
        : S.dialog === 'batches' ? batchesHTML() : '';
    layer.innerHTML = `<div class="rs-dim" data-act="close-dialog"></div>${body}`;
  }

  function closeDialog() {
    S.dialog = null;
    S.preview = null;
    renderDialog();
  }

  function settingsHTML() {
    const v = S.visual;
    return `<div class="rs-sheet rs-drawer">
      <div class="rs-sheet-h"><h3>显示设置</h3><button class="rs-x2" data-act="close-dialog" aria-label="关闭">✕</button></div>
      <p class="rs-hint">四类内容各自独立生效；设置保存在本机数据库，退出或刷新后仍保持。</p>
      ${VIS_GROUPS.map(g => {
        const c = v[g.k];
        return `<section class="rs-group">
          <h4>${g.t}</h4>
          <label class="rs-f">字体<input class="rs-inp" data-vis="${g.k}.font" value="${esc2(c.font || '')}"></label>
          <div class="rs-frow">
            <label class="rs-f">字号<input class="rs-inp" type="number" min="8" max="48" step="0.5" data-vis="${g.k}.size" value="${c.size}"></label>
            <label class="rs-f">行距<input class="rs-inp" type="number" min="1" max="3" step="0.05" data-vis="${g.k}.lh" value="${c.lh}"></label>
          </div>
          <div class="rs-frow">
            <label class="rs-f">颜色<input type="color" data-vis="${g.k}.color" value="${esc2(c.color)}"></label>
            <label class="rs-f">背景<span class="rs-bgwrap"><input type="color" data-vis="${g.k}.bg" value="${esc2(c.bg || '#fbf8f4')}"><button class="rs-mini" data-act="bg-clear" data-k="${g.k}">透明</button></span></label>
          </div>
          ${g.k === 'mask' ? `<label class="rs-f">遮挡浓度<input type="range" min="20" max="100" step="1" data-vis="mask.opacity" value="${c.opacity}"><b class="rs-b">${c.opacity}%</b></label>` : ''}
        </section>`;
      }).join('')}
      <label class="rs-check"><input type="checkbox" data-vis="singleHidden"${v.singleHidden ? ' checked' : ''}> 单句级进入时默认遮蔽汉语</label>
      <div class="rs-row rs-sheet-bot"><button class="rs-tb" data-act="reset-visual">恢复默认</button><button class="rs-primary" data-act="close-dialog">完成</button></div>
    </div>`;
  }

  function importHTML() {
    const p = S.preview;
    return `<div class="rs-sheet">
      <div class="rs-sheet-h"><h3>导入 JSON</h3><button class="rs-x2" data-act="close-dialog" aria-label="关闭">✕</button></div>
      <p class="rs-hint">追加到当前层级「${esc2(S.section ? S.section.name : '')}」末尾 · 不查重 / 不覆盖 / 不替换现有内容。</p>
      <textarea id="rs-import-text" class="rs-inp rs-ta" rows="8" placeholder='${esc2('[{"sentence_ru":"Я читаю книгу.","translation_zh":"我在读书。","key_words":["книгу"]}]')}'>${esc2(S.importText)}</textarea>
      <div class="rs-row"><input type="file" id="rs-import-file" accept=".json,application/json"><button class="rs-tb" data-act="preview">校验并预览</button></div>
      <div id="rs-preview">${previewHTML()}</div>
      <div class="rs-row rs-sheet-bot">
        <button class="rs-primary" data-act="do-import"${p && p.valid && p.valid.length ? '' : ' disabled'}>仅导入合法项${p && p.valid ? '（' + p.valid.length + ' 条）' : ''}</button>
        <button class="rs-tb" data-act="close-dialog">取消整批</button>
      </div>
    </div>`;
  }

  function batchesHTML() {
    return `<div class="rs-sheet rs-sheet-sm">
      <div class="rs-sheet-h"><h3>本次会话的导入批次</h3><button class="rs-x2" data-act="close-dialog" aria-label="关闭">✕</button></div>
      ${S.batches.length ? `<ul class="rs-batches">${S.batches.map(b => {
        const alive = b.ids.filter(id => !S.deleted.has(id)).length;
        return `<li><span class="rs-b-time">${b.at.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
          <span class="rs-b-count">${alive} / ${b.ids.length} 句可见</span>
          <button class="rs-mini" data-act="del-batch" data-batch="${esc2(b.id)}"${alive ? '' : ' disabled'}>删除整批</button></li>`;
      }).join('')}</ul>` : '<p class="rs-dim">本次会话还没有导入过内容。</p>'}
      <p class="rs-hint">删除只作用于当前显示层，可连续撤销；原始数据不变。</p>
    </div>`;
  }

  /* ============================================================
     事件
     ============================================================ */
  function onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const id = el.dataset.id;
    if (act === 'exit') { e.preventDefault(); exitScreen(); return; }
    if (act === 'bookmark') {
      capturePos();
      if (!saveReaderBookmark(true)) toast('当前没有可保存的句子', 'warn', 2200);
      return;
    }
    if (act === 'level') { setLevel(el.dataset.level); return; }
    if (act === 'quick') { quickAdjust(el.dataset.k, Number(el.dataset.d)); return; }
    if (act === 'mask-all') { setAllMasked(true); return; }
    if (act === 'show-all') { setAllMasked(false); return; }
    if (act === 'mask') {
      if (S.level === 'single') { S.singleShown = !S.singleShown; render(); }
      else toggleMask(id);
      return;
    }
    if (act === 'token') { toggleTokenMark(el.dataset.id, Number(el.dataset.i), e.shiftKey); return; }
    if (act === 'del-mark') { deleteMark(el.dataset.mark); return; }
    if (act === 'mark-phrase') { markPhrase(); return; }
    if (act === 'clear-token-sel') { S.tokenSel.clear(); render({ keepScroll: true }); return; }
    if (act === 'open-single') { openSingleAt(id); return; }
    if (act === 'prev') { moveSingle(-1); return; }
    if (act === 'next') { moveSingle(1); return; }
    if (act === 'back') { leaveSingle(); return; }
    if (act === 'del') { deleteIds([id], '已删除 1 句'); return; }
    if (act === 'undo') { undoDelete(); return; }
    if (act === 'toggle-kw') { S.highlight = !S.highlight; render({ keepScroll: true }); return; }
    if (act === 'toggle-phrases') { S.phraseOpen[S.level] = !S.phraseOpen[S.level]; render({ keepScroll: true }); return; }
    if (act === 'import') { openImport(); return; }
    if (act === 'settings') { S.dialog = 'settings'; renderDialog(); return; }
    if (act === 'batches') { S.dialog = 'batches'; renderDialog(); return; }
    if (act === 'del-batch') {
      const b = S.batches.find(x => x.id === el.dataset.batch);
      if (b) { deleteIds(b.ids, '已删除批次（' + b.ids.length + ' 句）'); S.dialog = 'batches'; renderDialog(); }
      return;
    }
    if (act === 'close-dialog') { closeDialog(); return; }
    if (act === 'preview') { runPreview(); return; }
    if (act === 'do-import') { doImport(); return; }
    if (act === 'reset-visual') { S.visual = defaultVisual(); applyVisual(); render({ keepScroll: true }); renderDialog(); scheduleVisualSave(); toast('显示设置已恢复默认', 'success'); return; }
    if (act === 'bg-clear') { setVisual(el.dataset.k + '.bg', ''); applyVisual(); render({ keepScroll: true }); renderDialog(); scheduleVisualSave(); return; }
    if (act === 'reload') { loadData(); return; }
    if (act === 'enter-context') {
      const bookId = ($('#rs-empty-book') && $('#rs-empty-book').value) || S.emptyBookId;
      const sectionId = ($('#rs-empty-section') && $('#rs-empty-section').value) || S.emptySectionId;
      if (!bookId || !sectionId) { toast('请先选择书籍与层级', 'warn'); return; }
      S.context = { bookId, sectionId };
      loadData();
      return;
    }
  }

  function runPreview() {
    const ta = $('#rs-import-text');
    S.importText = ta ? ta.value : S.importText;
    S.preview = validateImport(S.importText);
    const box = $('#rs-preview');
    if (box) box.innerHTML = previewHTML();
    const btn = $('.rs-sheet [data-act="do-import"]');
    if (btn) {
      const n = S.preview && S.preview.valid ? S.preview.valid.length : 0;
      btn.disabled = !n;
      btn.textContent = '仅导入合法项' + (S.preview && S.preview.valid ? '（' + n + ' 条）' : '');
    }
  }

  let inputTimer = 0;
  function onInput(e) {
    if (e.target.id === 'rs-import-text') { S.importText = e.target.value; return; }
    const path = e.target.dataset && e.target.dataset.vis;
    if (!path) return;
    const raw = e.target.type === 'checkbox' ? e.target.checked
      : (e.target.type === 'number' || e.target.type === 'range') ? Number(e.target.value) : e.target.value;
    setVisual(path, raw);
    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => {
      applyVisual();
      render({ keepScroll: true });
      scheduleVisualSave();
      const b = e.target.closest('.rs-group') && e.target.parentElement.querySelector('.rs-b');
      if (b) b.textContent = S.visual.mask.opacity + '%';
    }, 90);
  }

  async function onChange(e) {
    if (e.target.id === 'rs-import-file' && e.target.files && e.target.files[0]) {
      e.target.files[0].text().then(text => {
        S.importText = text;
        const ta = $('#rs-import-text');
        if (ta) ta.value = text;
        runPreview();
      });
      return;
    }
    if (e.target.id === 'rs-empty-book') {
      S.emptyBookId = e.target.value;
      S.emptySectionId = '';
      try { await loadSectionTree(S.emptyBookId); } catch (err) { S.sectionTree = []; toast('层级读取失败：' + err.message, 'error'); }
      S.emptySectionId = S.sectionTree[0] ? S.sectionTree[0].id : '';
      render();
      return;
    }
    if (e.target.id === 'rs-empty-section') {
      S.emptySectionId = e.target.value;
      return;
    }
    if (e.target.id === 'rs-book-select') {
      const bookId = e.target.value;
      if (!bookId) return;
      if (!S.book) {
        S.emptyBookId = bookId; S.emptySectionId = '';
        try { await loadSectionTree(bookId); } catch (err) { S.sectionTree = []; }
        S.emptySectionId = S.sectionTree[0] ? S.sectionTree[0].id : '';
        render();
        return;
      }
      S.context = { bookId, sectionId: '' };
      await loadData();
      return;
    }
    if (e.target.id === 'rs-section-select') {
      const sectionId = e.target.value;
      if (!sectionId || !S.book) return;
      S.context = { bookId: S.book.book_id, sectionId };
      await loadData();
    }
  }

  function onScroll() {
    if (Date.now() < S.suppressScroll) return;
    clearTimeout(S.scrollT);
    S.scrollT = setTimeout(capturePos, 140);
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      if (S.dialog) { closeDialog(); e.preventDefault(); return; }
      if (S.tokenSel.size) { S.tokenSel.clear(); render({ keepScroll: true }); e.preventDefault(); return; }
      if (S.level === 'single' && S.origin) { leaveSingle(); e.preventDefault(); }
      return;
    }
    if (S.level === 'single' && !S.dialog) {
      if (e.key === 'ArrowRight') { moveSingle(1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { moveSingle(-1); e.preventDefault(); }
    }
  }

  /* ============================================================
     生命周期
     ============================================================ */
  function resetSession() {
    S.book = null; S.section = null; S.rootId = ''; S.records = []; S.definitions = {}; S.batches = [];
    S.context = null; S.needContext = false; S.embedded = false;
    S.sectionTree = []; S.sectionTreeBookId = ''; S.emptyBookId = ''; S.emptySectionId = '';
    S.deleted = new Set(); S.undo = []; S.masked = new Set(); S.tokenSel = new Map();
    S.level = 'para'; S.pos = { para: null, sentence: null, single: null };
    S.anchor = null; S.singleId = null; S.singleShown = false; S.origin = null;
    S.highlight = true; S.phraseOpen = { para: false, sentence: true, single: true };
    S.visual = defaultVisual(); S.dialog = null; S.preview = null; S.importText = '';
    S.error = ''; S.needCreate = false; S.loading = true; S.autoDrilled = false;
    S.restoringBm = false;
    const layer = $('.rs-layer'); if (layer) layer.innerHTML = '';
  }

  function mount() {
    if ($('.rs-screen')) return;
    const el = document.createElement('div');
    el.className = 'rs-screen';
    el.innerHTML = '<header class="rs-top"></header><div class="rs-quick"></div><div class="rs-body"><div class="rs-flow"></div></div><div class="rs-layer"></div>';
    document.body.appendChild(el);
    document.body.classList.add('rs-open');
    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    el.addEventListener('change', onChange);
    $('.rs-body', el).addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('keydown', onKey);
    applyVisual(el);
    render();
  }

  function exitScreen() {
    capturePos();
    saveReaderBookmark();
    const screen = $('.rs-screen');
    if (screen) screen.remove();
    document.body.classList.remove('rs-open');
    document.removeEventListener('keydown', onKey);
    resetSession();
  }

  async function enterScreen(context) {
    resetSession();
    S.embedded = !!(context && context.bookId);
    if (context && context.bookId) {
      S.context = {
        bookId: context.bookId,
        sectionId: context.sectionId || '',
        sentenceIndex: Number.isInteger(context.sentenceIndex) ? context.sentenceIndex : null,
      };
    }
    await loadScreenVisual();
    mount();
    await loadData();
  }

  /* ============================================================
     退出与进入（仅作为俄语书籍阅读内部功能）
     ============================================================ */
  window.__readerScreen = { enter: enterScreen, exit: exitScreen };
})();

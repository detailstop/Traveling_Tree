'use strict';
/* 俄语书籍阅读：导入、阅读、标记和清洗任务管理。 */
(function () {
  let ROOT = null;
  const R = { root: null, books: [], book: null, section: null, sectionId: null, showAll: false,
    revealed: new Set(), selected: new Map(), mode: 'hierarchy', vocab: 'words', pending: [], error: '', sectionCache: new Map(),
    fullSentences: [], singleIndex: 0, selectedSentences: new Set(), selectedMarks:new Set(), scopeBookId:'', scopeSectionId:'', markFilter:'', maskColor:'#d8d3df',
    pendingStart: '', pendingEnd: '', pendingTotal: 0, pendingNotes: [], pendingRangeStart: 1, pendingRangeEnd: 0,
    visual: null, assets: {},
    bookmarkGap: 0, page: 'home', guideFrom: 'home',
    vocabView: 'manage', vocabItems: [], vocabQuery: '', vocabPos: '', vocabLetter: '',
    vocabRounds: new Set([1,2,3,4]), vocabIndex: 0, vocabFlipped: false, vocabShuffle: null,
    vocabSelected: new Set(), vocabExportSel: 'all', vocabStart: '', vocabEnd: '',
    memoLang: 'ru', memoExamplesOpen: false, translationPairs: [], translationMasked: new Set() };
  const BR_DEFAULT_VISUAL = {
    ru: { font: 'Georgia, "Times New Roman", "Noto Serif", serif', size: 21, lh: 1.7, color: '#241c22', bg: '' },
    zh: { font: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif', size: 15, lh: 1.65, color: '#6b5b63', bg: '' },
    kw: { font: '"Microsoft YaHei", sans-serif', size: 12.5, lh: 1.5, color: '#b4576f', bg: '#ffe6ee' },
    mask: { color: '#d9d2e3', opacity: 88 },
  };
  const BR_VIEW_KEY = 'rt_br_view';
  const ROUNDS = [1,2,3,4];
  const RU_ALPHABET = [...'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'];
  const $ = (s, p = R.root) => p?.querySelector(s);
  function saveBrView(page) {
    const current = page || (R.page === 'reader' ? 'home' : R.page) || 'home';
    try { localStorage.setItem(BR_VIEW_KEY, JSON.stringify({ page: current, vocab: R.vocab, guideFrom: R.guideFrom, scopeBookId: R.scopeBookId, scopeSectionId: R.scopeSectionId, markFilter: R.markFilter })); } catch (e) { /* 忽略配额 */ }
  }
  function readBrView() {
    try {
      const v = JSON.parse(localStorage.getItem(BR_VIEW_KEY) || 'null');
      if (!v || !['home', 'vocab', 'pending', 'guide', 'translation'].includes(v.page)) return null;
      return v;
    } catch (e) { return null; }
  }
  function setBrPage(page) { R.page = page; saveBrView(page); }
  const roundOf = item => { const n = Number(item && item.memorize_round); return ROUNDS.includes(n) ? n : 1; };
  const hasTranslation = item => String(item && item.translation || '').trim() !== '';
  const STRUCTURE = `导入格式：JSON 数组，每条记录包含 sentence_ru 与 translation_zh（非空字符串）；key_words 与 key_phrases 可选。示例：
[{"sentence_ru":"Я читаю книгу.","translation_zh":"我在读书。","key_words":["книгу"],"key_phrases":[]}]`;
  const RETURN_STRUCTURE = `返还格式（task_id 必填，且必须来自本次导出；旧包没有 task_id 或任务已失效会提示重新导出）：
{"task_id":"原任务ID","returned_at":"时间","results":[{"record_id":"原记录ID","mark_type":"word","address":{"book_id":"...","sentence_id":"...","token_index":0},"surface":"原词形","lemma":"原形","pos":"词性","translation":"翻译","basic_usage":"用法","inflections":[],"stress":2,"examples":["俄语句子||中文翻译","俄语句子||中文翻译","俄语句子||中文翻译"],"note":"备注"}]}
stress：整数、从 1 开始、必填；主词第几个俄语字母为重音，只数俄语字母（а–я、ё），忽略空格与连字符，且 1 ≤ stress ≤ 主词俄语字母数。
examples：长度固定 3 的字符串数组、必填；每项用 || 分隔俄语与汉语；落库时用换行符连接 3 条，每条内部保留 ||。`;
  const CLEANING_EXPORT_SPEC = `清洗任务导出结构：
{"task_id":"任务ID","exported_at":"导出时间","items":[{"record_id":"记录ID","mark_id":"标记ID","mark_type":"word|phrase","surface":"原词形","address":{"book_id":"...","sentence_id":"...","token_index":3},"sentence_ru":"俄语句子","translation_zh":"中文翻译"}]}
词组记录的 address 使用 token_indexes 数组。导出不会更改标记状态。
回填时每条必须补充 stress（整数，1 起，主词第几个俄语字母重音；只数 а–я、ё）与 examples（3 条字符串，每项「俄语||汉语」）。`;
  const CLEANED_EXPORT_SPEC = `已清洗学习数据导出结构：
{"exported_at":"导出时间","scope":"范围说明","words":[{"word_id":"...","lemma":"книга","pos":"noun","translation":"书","basic_usage":"用法","supplementary_notes":[],"inflections":[],"stress":2,"examples":"Книга лежит здесь.||书在这里。\\n...","memorize_round":1,"occurrences":[{"surface":"книгу","sentence_ru":"句子","translation_zh":"翻译","book_id":"...","sentence_id":"...","token_indexes":[2]}]}],"phrases":[{"phrase_id":"...","phrase_lemma":"词组","phrase_type":"类型","translation":"翻译","basic_usage":"用法","supplementary_notes":[],"stress":2,"examples":"...||...","memorize_round":1,"occurrences":[{"surface_text":"原词组","sentence_ru":"句子","translation_zh":"翻译","book_id":"...","sentence_id":"...","token_indexes":[1,2]}]}]}
复习算法不在本功能内。`;
  async function api(path, method = 'GET', body) {
    const res = await fetch(path, { method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(`HTTP ${res.status}：${data.error || '请求失败'}`);
    R.error='';
    return data;
  }
  function err(error) { R.error = error?.message || String(error); render(); }
  function safe(s) { return esc(String(s ?? '')); }
  function download(name, data, group) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    window.rtDownloadBlob(blob, name, group);
  }
  async function copy(value) { try { await navigator.clipboard.writeText(value); toast('已复制', 'success'); } catch (_) { err(new Error('复制失败，请检查浏览器剪贴板权限。')); } }
  const ASSET_URL_CACHE = new Map();
  function artUrl(art) {
    if (!art || !Array.isArray(art.palette) || !Array.isArray(art.pixels)) return '';
    const key = String(art.artwork_id || '') + ':' + String(art.updated_at || '');
    if (ASSET_URL_CACHE.has(key)) return ASSET_URL_CACHE.get(key);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = Number(art.width) || 1;
      canvas.height = Number(art.height) || 1;
      const ctx = canvas.getContext('2d');
      const image = ctx.createImageData(canvas.width, canvas.height);
      const colors = art.palette.map(hex => {
        const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ''));
        return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16), 255] : [0, 0, 0, 0];
      });
      art.pixels.forEach((value, i) => {
        const c = colors[value] || [0, 0, 0, 0];
        image.data[i * 4] = c[0]; image.data[i * 4 + 1] = c[1];
        image.data[i * 4 + 2] = c[2]; image.data[i * 4 + 3] = c[3];
      });
      ctx.putImageData(image, 0, 0);
      const url = canvas.toDataURL('image/png');
      ASSET_URL_CACHE.set(key, url);
      return url;
    } catch (e) { return ''; }
  }
  function iconHTML(key, fallback) {
    const url = artUrl(R.assets?.[key]);
    return url ? `<img class="br-asset-icon" src="${url}" alt="">` : `<span class="br-icon-fallback">${fallback}</span>`;
  }
  function maskWidth(text) {
    const n = Array.from(String(text || '')).length;
    return Math.max(3.2, Math.min(34, n * 0.9));
  }
  function defaultVisual() { return JSON.parse(JSON.stringify(BR_DEFAULT_VISUAL)); }
  function applyVisual(root) {
    if (!root) return;
    const v = R.visual || BR_DEFAULT_VISUAL;
    for (const k of ['ru', 'zh', 'kw']) {
      const g = v[k] || BR_DEFAULT_VISUAL[k];
      root.style.setProperty('--brf-' + k + '-font', g.font);
      root.style.setProperty('--brf-' + k + '-size', Number(g.size) + 'px');
      root.style.setProperty('--brf-' + k + '-lh', String(g.lh));
      root.style.setProperty('--brf-' + k + '-color', g.color);
      root.style.setProperty('--brf-' + k + '-bg', g.bg || 'transparent');
    }
    const mask = v.mask || BR_DEFAULT_VISUAL.mask;
    root.style.setProperty('--brf-mask-color', mask.color);
    root.style.setProperty('--brf-mask-opacity', String(Math.max(0.2, Math.min(1, Number(mask.opacity) / 100))));
    root.style.setProperty('--br-mask-color', mask.color);
  }
  async function loadVisual() {
    try {
      const data = await api('/api/plugin/book_reader/reader/visual-settings');
      R.visual = data.visual || defaultVisual();
    } catch (e) {
      R.visual = defaultVisual();
    }
    R.maskColor = (R.visual.mask && R.visual.mask.color) || '#d8d3df';
  }
  async function loadAssets() {
    try {
      const data = await api('/api/plugin/book_reader/reader/assets');
      R.assets = data.assets || {};
    } catch (e) {
      R.assets = {};
    }
  }
  async function persistVisual() {
    const data = await api('/api/plugin/book_reader/reader/visual-settings', 'PUT', { visual: R.visual });
    if (data.visual) R.visual = data.visual;
    R.maskColor = R.visual.mask.color;
    applyVisual($('.br-reader'));
    return R.visual;
  }
  function visualSettingsHTML(v) {
    const group = (key, label, g) => `<section class="br-vis-group">
      <h4>${label}</h4>
      <div class="br-vis-grid">
        <label>字体<input class="input" data-vg="${key}" data-vf="font" value="${safe(g.font)}"></label>
        <label>字号<input class="input" type="number" min="8" max="64" step="0.5" data-vg="${key}" data-vf="size" value="${Number(g.size)}"></label>
        <label>行距<input class="input" type="number" min="1" max="3.5" step="0.05" data-vg="${key}" data-vf="lh" value="${Number(g.lh)}"></label>
        <label>颜色<input type="color" data-vg="${key}" data-vf="color" value="${safe(g.color)}"></label>
        <label>背景<input class="input" data-vg="${key}" data-vf="bg" value="${safe(g.bg || '')}" placeholder="留空=透明"></label>
      </div>
    </section>`;
    return `<div class="br-vis">
      ${group('ru', '俄语行', v.ru)}
      ${group('zh', '汉语行', v.zh)}
      ${group('kw', '关键词 / 标记词', v.kw)}
      <section class="br-vis-group">
        <h4>汉语遮挡条</h4>
        <div class="br-vis-grid">
          <label>彩条颜色<input type="color" data-vg="mask" data-vf="color" value="${safe(v.mask.color)}"></label>
          <label>浓度 <span class="br-vis-val">${Number(v.mask.opacity)}%</span><input type="range" min="20" max="100" step="1" data-vg="mask" data-vf="opacity" value="${Number(v.mask.opacity)}"></label>
        </div>
      </section>
      <p class="br-vis-note">设置全局保存到本机数据库，刷新或重开书籍仍生效；汉语显示/隐藏仍按原逻辑逐句点击。</p>
    </div>`;
  }
  async function openVisualSettings() {
    const body = document.createElement('div');
    body.innerHTML = visualSettingsHTML(R.visual || defaultVisual());
    const read = () => {
      const next = JSON.parse(JSON.stringify(R.visual || defaultVisual()));
      for (const el of body.querySelectorAll('[data-vg]')) {
        const g = el.dataset.vg, f = el.dataset.vf;
        if (!next[g]) next[g] = {};
        next[g][f] = (el.type === 'number' || el.type === 'range') ? Number(el.value) : el.value;
      }
      return next;
    };
    body.querySelectorAll('input[type=range]').forEach(el => {
      const out = el.closest('label')?.querySelector('.br-vis-val');
      el.oninput = () => { if (out) out.textContent = el.value + '%'; };
    });
    modal({ title: '通篇视图 · 显示设置', body, actions: [
      { label: '取消', cls: 'soft', onClick: m => m.remove() },
      { label: '恢复默认', cls: 'soft', onClick: async m => {
        try {
          R.visual = defaultVisual();
          await persistVisual();
          m.remove(); render();
          toast('已恢复默认显示设置', 'success');
        } catch (e) { toast('恢复默认失败：' + e.message, 'error'); }
      } },
      { label: '保存并应用', onClick: async m => {
        try {
          R.visual = read();
          await persistVisual();
          m.remove(); render();
          toast('显示设置已保存 ✓', 'success');
        } catch (e) { toast('显示设置保存失败：' + e.message, 'error'); }
      } },
    ] });
  }
  async function loadBooks() { R.book = null; R.section = null; R.sectionId = null; R.page = 'home'; saveBrView('home'); R.books = (await api('/api/plugin/book_reader/books')).books; render(); }
  async function openBook(id) { R.book = await api(`/api/plugin/book_reader/books/${encodeURIComponent(id)}`); R.sectionId = R.book.root_section_id; R.sectionCache.clear(); R.showAll = false; R.revealed.clear(); R.page = 'reader'; saveBrView('home'); await loadSection(); }
  async function loadSection() { R.page = 'reader'; saveBrView('home'); R.section = R.sectionId ? await api(`/api/plugin/book_reader/reader/sections/${encodeURIComponent(R.sectionId)}`) : null; if(R.section)R.sectionCache.set(R.section.section_id,R.section);R.revealed.clear();R.selected.clear();R.selectedSentences.clear();if(R.section&&R.mode==='full')await loadFull();render(); }
  async function loadFull() {
    await ensureBookmarks();
    const data = await api(`/api/plugin/book_reader/books/${encodeURIComponent(R.book.book_id)}/full`);
    R.sectionCache.clear();
    const visit = section => {
      R.sectionCache.set(section.section_id, section);
      (section.children || []).forEach(visit);
    };
    (data.sections || []).forEach(visit);
    const all = [];
    const collect = section => {
      all.push(...(section.sentences || []));
      (section.children || []).forEach(collect);
    };
    (data.sections || []).forEach(collect);
    R.fullSentences = all;
  }
  async function allSections(bookId) {
    const data = await api(`/api/plugin/book_reader/books/${encodeURIComponent(bookId)}/full`);
    const out = [];
    const visit = (row, depth) => {
      out.push({ id: row.section_id, name: `${'　'.repeat(depth)}${row.name}` });
      (row.children || []).forEach(child => visit(child, depth + 1));
    };
    (data.sections || []).forEach(root => visit(root, 0));
    return out;
  }
  function readerScreenContext() {
    if (!R.book) return null;
    let sectionId = R.sectionId;
    let sentenceIndex = 0;
    if (R.mode === 'full' && R.fullSentences.length) {
      const gap = Math.min(Math.max(0, R.bookmarkGap || 0), R.fullSentences.length - 1);
      const target = R.fullSentences[gap];
      sectionId = target.section_id;
      const rows = R.fullSentences.filter(x => x.section_id === sectionId);
      sentenceIndex = Math.max(0, rows.findIndex(x => x.sentence_id === target.sentence_id));
    } else if (R.mode === 'single') {
      const rows = R.section?.sentences || [];
      const target = rows[R.singleIndex];
      if (target) {
        sectionId = target.section_id;
        sentenceIndex = rows.filter(x => x.section_id === sectionId).findIndex(x => x.sentence_id === target.sentence_id);
      }
    }
    return { bookId: R.book.book_id, sectionId, sentenceIndex: Math.max(0, sentenceIndex) };
  }
  async function openReaderScreen() {
    try {
      if (!window.__readerScreen) {
        await import('./reader_screen.js');
      }
      if (!window.__readerScreen || typeof window.__readerScreen.enter !== 'function') {
        throw new Error('阅读屏组件未加载');
      }
      const context = readerScreenContext();
      if (!context) throw new Error('请先打开一本书');
      window.__readerScreen.enter(context);
    } catch (e) {
      toast('打开俄汉双语阅读屏失败：' + (e && e.message ? e.message : e), 'error');
    }
  }
  async function loadVocab() { R.book = null; R.vocab = R.vocab || 'words'; await renderVocab(); }
  function brMenuHTML(id, label, items) {
    return `<div class="br-menu" data-brmenu="${id}">
      <button class="btn soft br-menu-toggle" data-a="br-menu" data-menu="${id}" aria-haspopup="true" aria-expanded="false">${label} ▾</button>
      <div class="br-menu-pop" data-brmenu-panel="${id}" hidden>${items}</div>
    </div>`;
  }
  function closeBrMenus() {
    if (!R.root) return;
    R.root.querySelectorAll('.br-menu-pop').forEach(p => { p.hidden = true; });
    R.root.querySelectorAll('.br-menu-toggle').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  function toggleBrMenu(id) {
    if (!R.root) return;
    R.root.querySelectorAll('.br-menu-pop').forEach(p => {
      p.hidden = !(p.dataset.brmenuPanel === id && p.hidden);
    });
    R.root.querySelectorAll('.br-menu-toggle').forEach(b => {
      b.setAttribute('aria-expanded', String(b.dataset.menu === id && !b.parentElement.querySelector('.br-menu-pop').hidden));
    });
  }
  function shell(content) {
    R.root.innerHTML = `<div class="br-reader" style="--br-mask-color:${safe(R.maskColor)}"><header class="br-head"><div><h2>俄语书籍阅读</h2></div><nav class="br-nav">
      <button class="btn soft" data-a="home">首页</button>
      ${brMenuHTML('data', '数据', `<button class="br-menu-item" data-a="pending">待清洗</button><button class="br-menu-item" data-a="export-cleaned">导出已清洗</button><button class="br-menu-item" data-a="copy-cleaning-spec">复制清洗任务结构与说明</button><button class="br-menu-item" data-a="copy-cleaned-spec">复制导出结构与说明</button><button class="br-menu-item" data-a="guide">导入格式与说明</button>`)}
      ${brMenuHTML('learn', '学习', `<button class="br-menu-item" data-a="vocab-words">单词库</button><button class="br-menu-item" data-a="vocab-phrases">词组库</button><button class="br-menu-item" data-a="translation-pairs">俄汉互译</button>`)}
    </nav></header>${R.error ? `<div class="br-error" role="alert"><span>${safe(R.error)}</span><button data-a="close-error">关闭</button></div>` : ''}${content}</div>`;
    applyVisual($('.br-reader'));
  }
  function bookList() {
    shell(`<section class="br-panel"><h3>我的书籍</h3><form data-f="new-book" class="br-inline"><input class="input" name="name" required placeholder="书名"><button class="btn">新建书籍</button></form>
      <div class="br-book-list">${R.books.map((b,i)=>`<article class="br-book"><button class="btn soft" data-a="open-book" data-id="${safe(b.book_id)}">📖 ${safe(b.name)} <small>${b.sentence_count} 句</small></button><div><button class="btn soft sm" data-a="rename-book" data-id="${safe(b.book_id)}">重命名</button><button class="btn soft sm" data-a="copy-book" data-id="${safe(b.book_id)}">设置副本</button><button class="btn danger sm" data-a="delete-book" data-id="${safe(b.book_id)}">删除</button><button class="btn soft sm" data-a="book-up" data-index="${i}">↑</button><button class="btn soft sm" data-a="book-down" data-index="${i}">↓</button></div></article>`).join('') || '<p class="br-muted">还没有书籍，请先新建。</p>'}</div></section>`);
  }
  function guideView() {
    R.page='guide';R.book=null;R.section=null;R.sectionId=null;saveBrView('guide');
    shell(`<section class="br-panel"><div class="br-toolbar"><h3>导入格式与说明</h3><button class="btn soft" data-a="guide-back">← 返回</button><button class="btn soft sm" data-a="copy-import-spec">复制说明</button></div><pre class="br-guide-pre">${safe(STRUCTURE)}</pre></section>`);
  }
  function sentenceHtml(s, index) {
    const tokens=sentenceTokens(s);
    const revealed=R.showAll||R.revealed.has(s.sentence_id);
    return `<article class="br-sentence" data-sentence="${s.sentence_id}" draggable="true" data-order="${s.order_index}" data-section="${s.section_id}"><div class="br-ru">${tokens}<span class="br-sentence-actions"><button class="btn soft sm" data-a="edit-sentence" data-id="${s.sentence_id}">编辑</button><button class="btn soft sm" data-a="copy-ru" data-id="${s.sentence_id}">复制俄语</button><button class="btn soft sm" data-a="copy-zh" data-id="${s.sentence_id}">复制翻译</button><button class="btn danger sm" data-a="delete-sentence" data-id="${s.sentence_id}">删除</button></span></div><div class="br-translation ${revealed?'shown':'masked'}" data-a="translation" data-id="${s.sentence_id}">${safe(s.translation_zh)}</div><div class="br-mark-list">${s.marks.map(m=>`<span class="br-mark">${m.mark_type==='word'?'词':'组'} ${safe(m.surface)} · ${m.status==='cleaned'?'已清洗':'未清洗'} <button data-a="delete-mark" data-id="${m.mark_id}" aria-label="取消标记">×</button></span>`).join('')}</div></article>`;
  }
  function fullActionsHTML(s) {
    return `<button class="br-icon-btn" data-a="edit-sentence" data-id="${s.sentence_id}" title="编辑句子" aria-label="编辑句子">${iconHTML('icon.edit','✎')}</button>` +
      `<button class="br-icon-btn" data-a="copy-ru" data-id="${s.sentence_id}" title="复制俄语" aria-label="复制俄语">${iconHTML('icon.copy_ru','RU')}</button>` +
      `<button class="br-icon-btn" data-a="copy-zh" data-id="${s.sentence_id}" title="复制翻译" aria-label="复制翻译">${iconHTML('icon.copy_zh','中')}</button>` +
      `<button class="br-icon-btn danger" data-a="delete-sentence" data-id="${s.sentence_id}" title="删除句子" aria-label="删除句子">${iconHTML('icon.delete','🗑')}</button>`;
  }
  function fullPairHTML(s) {
    const revealed = R.showAll || R.revealed.has(s.sentence_id);
    const zh = s.translation_zh || '';
    const inner = revealed
      ? safe(zh)
      : `<span class="br-full-maskbar" style="width:${maskWidth(zh)}em" aria-hidden="true"></span>`;
    const keywords = [...new Set((s.marks || []).map(m => m.surface).filter(Boolean))];
    return `<article class="br-full-pair br-sentence" data-sentence="${s.sentence_id}" draggable="true" data-order="${s.order_index}" data-section="${s.section_id}">
      <div class="br-full-ru">${sentenceTokens(s)}</div>
      <div class="br-full-zh-wrap"><div class="br-translation br-full-zh ${revealed ? 'shown' : 'masked'}" data-a="translation" data-id="${s.sentence_id}" title="${revealed ? '点击遮蔽汉语' : '点击显示汉语'}">${inner}</div></div>
      ${keywords.length ? `<div class="br-full-kw">${keywords.map(x => `<span class="br-full-kw-item">${safe(x)}</span>`).join('')}</div>` : ''}
      <span class="br-sentence-actions br-full-actions">${fullActionsHTML(s)}</span>
    </article>`;
  }
  function sentenceTokens(s) {
    const marked = new Map(), counts=new Map();
    s.marks.forEach(m => {if(m.source==='import')counts.set(m.surface,(counts.get(m.surface)||0)+1);m.token_indexes.forEach(i => { const a=marked.get(i)||[];a.push(m);marked.set(i,a); });});
    return s.tokens.map((t,i)=>{const marks=marked.get(i)||[];const fade=marks.find(m=>m.source==='import');const alpha=fade?Math.max(.15,1/(counts.get(fade.surface)||1)):1;const title=marks.map(m=>[m.surface,m.status==='cleaned'?'已清洗':'未清洗',m.vocab_summary].filter(Boolean).join(' · ')).join('\n')||'单击标记单词；Shift 多选后右击标记词组';return `<button class="br-token ${marks.length?'marked':''} ${R.selected.get(s.sentence_id)?.has(i)?'picked':''}" style="--br-alpha:${alpha}" data-a="token" data-sid="${s.sentence_id}" data-i="${i}" title="${safe(title)}">${safe(t)}</button>`}).join(' ');
  }
  function readerView() {
    if (!R.book) return bookList();
    const sec=R.section;
    const path=[]; let current=sec;
    while(current){path.unshift(current);current=current.parent_id?findSection(current.parent_id):null;}
    shell(`<div class="br-toolbar"><button class="btn soft" data-a="home">← 书籍列表</button><h3>${safe(R.book.name)}</h3><button class="btn soft" data-a="rename-book" data-id="${safe(R.book.book_id)}">重命名</button><button class="btn soft" data-a="copy-book" data-id="${safe(R.book.book_id)}">设置副本</button><button class="btn danger" data-a="delete-book" data-id="${safe(R.book.book_id)}">删除书籍</button></div>
      <div class="br-breadcrumb">${path.map((x,i)=>`<button class="btn soft sm" data-a="go-section" data-id="${x.section_id}">${safe(x.name)}</button>${i<path.length-1?' / ':''}`).join('')}</div>
      <section class="br-panel"><div class="br-toolbar"><h3>${safe(sec?.name||'请选择层级')}</h3><button class="btn" data-a="add-section">新建子层级</button><button class="btn soft" data-a="rename-section" ${sec?.parent_id?'':'disabled'}>重命名层级</button><button class="btn danger" data-a="delete-section" ${sec?.parent_id?'':'disabled'}>删除层级</button></div>
      <div class="br-view-controls"><label>阅读视图 <select class="input" data-a="mode"><option value="hierarchy" ${R.mode==='hierarchy'?'selected':''}>层级视图</option><option value="full" ${R.mode==='full'?'selected':''}>通篇视图</option><option value="single" ${R.mode==='single'?'selected':''}>单句视图</option><option value="line" ${R.mode==='line'?'selected':''}>每句一行</option></select></label><button class="btn soft" data-a="open-reader-screen" title="三档读法 + 汉语遮挡 + 导入；书籍阅读内部阅读屏">📖 俄汉双语阅读屏</button><button class="btn soft" data-a="toggle-all">${R.showAll?'全部遮蔽翻译':'全部显示翻译'}</button><label class="br-color-control">遮蔽色 <input type="color" data-a="mask-color" value="${safe((R.visual?.mask?.color)||R.maskColor)}" aria-label="自定义翻译遮蔽色"></label><button class="btn soft" data-a="visual-settings">${iconHTML('icon.settings','⚙')} 显示设置</button><button class="btn soft" data-a="move-sentence">移动选中句子</button><button class="btn danger" data-a="delete-selected-sentences">批量删除选中句子</button></div>
      <form data-f="new-section" class="br-inline"><input class="input" id="br-new-section" name="name" required placeholder="层级名称"><button class="btn">添加层级</button></form>
      <div class="br-children">${(sec?.children||[]).map((c,i)=>`<span class="br-child-wrap"><button class="br-child" data-a="go-section" data-id="${c.section_id}">📁 ${safe(c.name)} <small>${c.sentence_count} 句</small></button><button class="btn soft sm" data-a="section-order" data-id="${c.section_id}" data-order="${i-1}">↑</button><button class="btn soft sm" data-a="section-order" data-id="${c.section_id}" data-order="${i+1}">↓</button></span>`).join('')}</div>
      <details class="br-import"><summary>导入 JSON 到当前层级</summary><textarea class="input" id="br-import-data" rows="6" placeholder='[{"sentence_ru":"...","translation_zh":"..."}]'></textarea><div class="br-inline"><input type="file" id="br-import-file" accept=".json,application/json"><button class="btn" data-a="import-json">导入追加</button><button class="btn soft" data-a="copy-import-spec">复制当前数据结构与说明</button></div></details>
      <div class="br-sentences">${renderSentenceCollection(sec)}</div></section>`);
    mountBookmark();
  }
  function renderSentenceCollection(sec) {
    if(!sec)return '<p class="br-muted">请选择层级。</p>';
    const source=R.mode==='full'?R.fullSentences:sec.sentences;
    if(!source?.length)return '<p class="br-muted">当前层级暂无句子。</p>';
    if(R.mode==='single'){
      R.singleIndex=Math.max(0,Math.min(R.singleIndex,source.length-1));
      return `<div class="br-single-controls"><button class="btn soft" data-a="single-prev" ${R.singleIndex===0?'disabled':''}>上一句</button><span>${R.singleIndex+1} / ${source.length}</span><button class="btn soft" data-a="single-next" ${R.singleIndex===source.length-1?'disabled':''}>下一句</button></div>${sentenceHtml(source[R.singleIndex],R.singleIndex)}`;
    }
    if(R.mode==='full')return `<div class="br-bm-bar"><span class="br-bm-tip">🔖 拖动书签，可移动到任意两句之间（含最后一句之后）</span><button class="btn soft sm" data-a="visual-settings" style="margin-left:auto;">${iconHTML('icon.settings','⚙')} 显示设置</button></div><div class="br-full-reading">${source.map(fullPairHTML).join('')}</div>`;
    const placeholders=R.mode==='full'?[]:sec.placeholders;
    const entries=[...source.map(s=>({kind:'sentence',row:s})),...placeholders.map(p=>({kind:'placeholder',row:p}))].sort((a,b)=>a.row.order_index-b.row.order_index);
    return entries.map((entry,i)=>entry.kind==='sentence'?`<div class="br-sentence-wrap ${R.mode==='line'?'line':''}"><label class="br-select-sentence"><input type="checkbox" data-a="select-sentence" data-id="${entry.row.sentence_id}" ${R.selectedSentences.has(entry.row.sentence_id)?'checked':''}>选中</label>${sentenceHtml(entry.row,i)}</div>`:`<article class="br-placeholder" draggable="true" data-placeholder="${entry.row.placeholder_id}" data-order="${entry.row.order_index}" data-section="${entry.row.section_id}"><b>导入错误 · 第 ${entry.row.import_index} 条</b><p>${safe(entry.row.error)}</p><details><summary>查看原始 JSON</summary><pre>${safe(entry.row.raw_json)}</pre></details><button class="btn soft sm" data-a="repair-placeholder" data-id="${entry.row.placeholder_id}">编辑修复</button><button class="btn danger sm" data-a="delete-placeholder" data-id="${entry.row.placeholder_id}">删除占位</button></article>`).join('');
  }
  function findSection(id) { return R.sectionCache.get(id)||null; }
  function getSentence(id) {
    return (R.fullSentences||[]).find(x => x.sentence_id === id)
      || (R.section?.sentences||[]).find(x => x.sentence_id === id)
      || null;
  }
  function letterMatch(item) {
    if (!R.vocabLetter) return true;
    const c=(item.lemma||item.phrase_lemma||'').trim().charAt(0).toLocaleUpperCase('ru-RU');
    return R.vocabLetter==='其他' ? !RU_ALPHABET.includes(c) : c===R.vocabLetter||R.vocabLetter==='Е'&&c==='Ё';
  }
  function memorizeItems() {
    const rounds=R.vocabRounds instanceof Set ? R.vocabRounds : new Set(ROUNDS);
    const items=(R.vocabItems||[]).filter(hasTranslation).filter(x => rounds.has(roundOf(x)));
    if (Array.isArray(R.vocabShuffle) && R.vocabShuffle.length) {
      const rank=new Map(R.vocabShuffle.map((id,i)=>[id,i]));
      items.sort((a,b)=>(rank.has(vocabKey(a))?rank.get(vocabKey(a)):1e9)-(rank.has(vocabKey(b))?rank.get(vocabKey(b)):1e9));
    }
    return items;
  }
  function vocabKey(item) { return item?(item.word_id||item.phrase_id||''):''; }
  function nearestVocabIndex(oldItems, oldIndex, newItems) {
    const old=oldItems[oldIndex];
    if(!old)return 0;
    const oldKey=vocabKey(old);
    const exact=newItems.findIndex(x=>vocabKey(x)===oldKey);
    if(exact>=0)return exact;
    for(let d=1;d<=Math.max(oldItems.length,newItems.length);d++){
      const forward=oldItems[oldIndex+d];
      if(forward){const i=newItems.findIndex(x=>vocabKey(x)===vocabKey(forward));if(i>=0)return i;}
      const backward=oldItems[oldIndex-d];
      if(backward){const i=newItems.findIndex(x=>vocabKey(x)===vocabKey(backward));if(i>=0)return i;}
    }
    return 0;
  }
  function shuffleVocab() {
    const eligible=(R.vocabItems||[]).filter(hasTranslation);
    if(!eligible.length){toast('暂无可打乱词条','warn');return;}
    const anchorIndex=R.vocabIndex;                 // B1：以当前卡片位置为锚点，不跟随原单词迁移
    const keys=eligible.map(vocabKey);
    for(let i=keys.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[keys[i],keys[j]]=[keys[j],keys[i]];}
    R.vocabShuffle=keys;
    const items=memorizeItems();
    R.vocabIndex=Math.max(0,Math.min(items.length-1,anchorIndex));
    R.vocabFlipped=false;
    paintVocab();
    toast('已打乱本次背诵顺序（不保存）','success');
  }
  function viewSwitchHTML() {
    return `<span class="br-view-switch"><button class="btn soft sm ${R.vocabView!=='memorize'?'on':''}" data-a="vocab-view" data-view="manage">管理视图</button><button class="btn soft sm ${R.vocabView==='memorize'?'on':''}" data-a="vocab-view" data-view="memorize">背诵视图</button></span>`;
  }
  function roundBadge(n) { return `<span class="br-round-badge">第 ${n} 轮</span>`; }
  function stressHTML(text, stress) {
    const idx = Number(stress);
    if (!idx || idx < 1) return safe(text);
    let count = 0;
    return Array.from(String(text ?? '')).map(ch => {
      if (/[А-Яа-яЁё]/.test(ch)) {
        count += 1;
        if (count === idx) return `<span class="br-stress">${safe(ch)}</span>`;
      }
      return safe(ch);
    }).join('');
  }
  function memoExamples(item) {
    const raw = item && item.examples;
    const lines = Array.isArray(raw) ? raw : String(raw || '').split('\n');
    return lines.map(x => String(x || '').trim()).filter(Boolean).map(line => {
      const cut = line.indexOf('||');
      return cut >= 0 ? { ru: line.slice(0, cut).trim(), zh: line.slice(cut + 2).trim() } : { ru: line, zh: '' };
    });
  }
  function memoFormGroups(forms) {
    const items = (forms || []).map(x => String(x == null ? '' : x).trim()).filter(Boolean);
    if (!items.length) return [];
    const labeled = [];
    let allLabeled = true;
    for (const item of items) {
      const hit = item.match(/^([^:：=]{1,16})[:：=](.+)$/);
      if (!hit) { allLabeled = false; break; }
      labeled.push({ label: hit[1].trim(), items: [hit[2].trim()] });
    }
    if (allLabeled && labeled.length) return labeled;
    return Array.from({ length: Math.ceil(items.length / 6) }, (_, i) => ({
      label: `第 ${i + 1} 组`, items: items.slice(i * 6, i * 6 + 6),
    }));
  }
  function openMemoForms() {
    const item = memorizeItems()[R.vocabIndex];
    if (!item) return;
    const title = R.vocab === 'words' ? '词形变化' : '组成项';
    const groups = memoFormGroups(item.inflections || item.components || []);
    const mask = document.createElement('div');
    mask.className = 'br-form-mask';
    mask.innerHTML = `<div class="br-form-modal" role="dialog" aria-label="${title}">
      <div class="br-form-head"><b>${title}</b><button class="mini-btn" data-form-close>✕ 关闭</button></div>
      ${groups.length ? groups.map(g => `<section class="br-form-group"><h4>${safe(g.label)}</h4><div class="br-form-chips">${g.items.map(x => `<span>${safe(x)}</span>`).join('')}</div></section>`).join('') : `<p class="br-muted">暂无${title}。</p>`}
    </div>`;
    document.body.appendChild(mask);
    const close = () => { mask.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    mask.addEventListener('mousedown', e => { if (e.target === mask) close(); });
    mask.querySelector('[data-form-close]').onclick = close;
  }
  function manageCardHTML(item) {
    const kind=R.vocab, id=item.word_id||item.phrase_id, name=item.lemma||item.phrase_lemma;
    const pos=item.pos||item.phrase_type||'', forms=item.inflections||item.components||[], notes=item.supplementary_notes||[];
    const sources=item.source_addresses||[];
    const sourceBtns=sources.map(a=>`<button class="btn soft sm" data-a="jump-address" data-book="${safe(a.book_id)}" data-section="${safe(a.section_id)}">打开来源</button>`).join('');
    return `<article class="br-vocab-item"><div class="br-vocab-item-head"><div class="br-vocab-title"><b>${safe(name)}</b>${pos?`<span class="br-vocab-pos">${safe(pos)}</span>`:''}${item.export_selected?'<span class="br-exported">已导出</span>':''}</div><div class="br-vocab-item-tools"><label class="br-vocab-select"><input type="checkbox" data-a="vocab-select" data-id="${safe(id)}" ${R.vocabSelected.has(id)?'checked':''}> 选中</label>${roundBadge(roundOf(item))}</div></div>
      <p class="br-vocab-translation ${hasTranslation(item)?'':'empty'}">${safe(item.translation||'暂无释义')}</p>
      ${!String(item.examples||'').trim()?`<p class="br-vocab-missing">无例句/重音：点「编辑」补全，或重新标注后清洗回填。</p>`:''}
      <div class="br-vocab-detail"><p><span>用法</span>${safe(item.basic_usage||'暂无')}</p><p><span>${kind==='words'?'词形':'组成'}</span>${forms.length?forms.map(x=>safe(x)).join('、'):'暂无'}</p><p><span>补充</span>${notes.length?notes.map(x=>safe(x)).join('；'):'暂无'}</p></div>
      <div class="br-vocab-item-foot"><div class="br-vocab-actions">${sourceBtns}<button class="btn soft sm" data-a="edit-vocab" data-id="${safe(id)}">编辑</button><button class="btn danger sm" data-a="delete-vocab" data-id="${safe(id)}">删除</button></div></div></article>`;
  }
  function memoCardHTML(item) {
    const kind=R.vocab, name=item.lemma||item.phrase_lemma, pos=item.pos||item.phrase_type||'';
    const forms=item.inflections||item.components||[], notes=item.supplementary_notes||[];
    const n=roundOf(item), examples=memoExamples(item), lang=R.memoLang==='zh'?'zh':'ru';
    const front=lang==='zh'?safe(item.translation||'暂无释义'):stressHTML(name,item.stress);
    const formLabel=kind==='words'?'词形变化':'组成项';
    return `<div class="br-memo-card ${R.vocabFlipped?'flipped':''}" data-a="vocab-card" tabindex="0" role="button" aria-label="点击翻面">
      <div class="br-memo-front"><span class="br-memo-kicker">${lang==='zh'?'汉语释义':'俄语主词'} · 第 ${n} 轮</span><h2 class="${lang==='zh'?'zh':''}">${front}</h2></div>
      <div class="br-memo-back"><div class="br-memo-back-head"><h3>${stressHTML(name,item.stress)}${pos?`<small class="br-memo-pos">${safe(pos)}</small>`:''}</h3>
        <div class="br-memo-head-actions">${roundBadge(n)}<button class="btn soft sm" data-a="memo-forms">${formLabel}</button></div></div>
        <div class="br-memo-blocks">
          <section class="br-memo-block"><h4>释义</h4><p>${safe(item.translation||'暂无')}</p></section>
          <section class="br-memo-block"><h4>用法</h4><p>${safe(item.basic_usage||'暂无')}</p></section>
          <section class="br-memo-block br-memo-examples-block"><div class="br-memo-block-head"><h4>例句</h4><button class="btn soft sm" data-a="memo-examples">${R.memoExamplesOpen?'收起':'展开'}${examples.length?`（${examples.length}）`:''}</button></div>
            ${R.memoExamplesOpen ? (examples.length ? `<ol class="br-memo-examples">${examples.map(x=>`<li><div class="br-example-ru">${safe(x.ru)}</div><div class="br-example-zh">${safe(x.zh)}</div></li>`).join('')}</ol>` : '<p class="br-muted">暂无例句。</p>') : ''}
          </section>
          ${notes.length?`<div class="br-memo-notes"><span>补充</span>${notes.map(x=>safe(x)).join('；')}</div>`:''}
        </div>
        <div class="br-memo-rounds"><span>背诵轮次</span>${ROUNDS.map(x=>`<button class="btn soft sm ${x===n?'active':''}" data-a="vocab-round" data-round="${x}">第${x}轮</button>`).join('')}</div></div></div>`;
  }
  function vocabFiltered() {
    return (R.vocabItems || []).filter(letterMatch).filter(x => {
      if (R.vocabExportSel === '1') return !!x.export_selected;
      if (R.vocabExportSel === '0') return !x.export_selected;
      return true;
    });
  }
  function vocabExportRange() {
    const filtered = vocabFiltered();
    const total = filtered.length;
    let start = parseInt(R.vocabStart, 10);
    let end = parseInt(R.vocabEnd, 10);
    if (!Number.isFinite(start)) start = 1;
    if (!Number.isFinite(end)) end = total;
    const notes = [];
    if (start < 1) { start = 1; notes.push('起始条数已夹到 1'); }
    if (end > total) { end = total; notes.push('结束条数已夹到 ' + total); }
    if (end < 1) { end = 0; notes.push('结束条数小于 1，导出范围为空'); }
    if (start > total) { start = total + 1; end = total; notes.push('起始条数超过当前筛选结果（共 ' + total + ' 条），导出范围为空'); }
    if (start > end) notes.push('起始条数大于结束条数，导出范围为空');
    const range = end >= start ? filtered.slice(start - 1, end) : [];
    const picked = range.filter(x => R.vocabSelected.has(vocabKey(x)));
    return { filtered, total, start, end, range, picked, items: picked.length ? picked : range, notes };
  }
  async function exportSelectedVocab() {
    const info = vocabExportRange();
    if (info.notes.length) toast(info.notes[0], 'warn', 4200);
    const items = info.items;
    if (!items.length) { toast('当前筛选/范围没有可导出词条', 'warn'); return; }
    const words = items.map(x => x.lemma || x.phrase_lemma).filter(Boolean);
    if (words.length !== items.length) { toast('存在缺少原形的词条，已中止导出', 'warn'); return; }
    try {
      download(`vocab-${R.vocab}-selected-${new Date().toISOString().slice(0, 10)}.json`, words, 'reader_vocab');
    } catch (e) {
      toast('导出失败：' + (e && e.message ? e.message : e), 'error');
      return;
    }
    try {
      await api('/api/plugin/book_reader/reader/vocabulary/mark-exported', 'POST', {
        items: items.map(x => ({ kind: R.vocab === 'words' ? 'word' : 'phrase', id: vocabKey(x) })),
      });
      items.forEach(x => { x.export_selected = 1; });
      toast(`已导出 ${words.length} 个${R.vocab === 'words' ? '单词' : '词组'}，并标记为已选中 ✓`, 'success');
      await renderVocab();
    } catch (e) {
      toast('文件已下载，但 export_selected 标记失败：' + (e && e.message ? e.message : e), 'warn', 5200);
    }
  }
  function paintVocab() {
    const kind=R.vocab, view=R.vocabView==='memorize'?'memorize':'manage';
    if(view==='manage') {
      const items=vocabFiltered();
      const exp=vocabExportRange();
      shell(`<section class="br-panel"><div class="br-toolbar"><h3>${kind==='words'?'全局单词库':'全局词组库'}</h3>${viewSwitchHTML()}<input class="input" id="br-vocab-query" placeholder="搜索词条" value="${safe(R.vocabQuery)}">${kind==='words'?`<input class="input" id="br-vocab-pos" placeholder="词性筛选" value="${safe(R.vocabPos||'')}">`:''}<button class="btn" data-a="vocab-search">搜索</button><button class="btn" data-a="add-vocab">新建</button><button class="btn soft sm" data-a="export-selected-vocab" ${exp.total?'':'disabled'} title="按当前筛选/起始条数导出；若勾选了词条则只导出勾选项">导出选中（${exp.items.length}）</button><button class="btn danger sm" data-a="clear-vocab">全部删除</button><button class="btn soft" data-a="home">返回书籍</button></div>
        <div class="br-export-filter">
          <label>是否被选中过 <select class="input" data-a="vocab-export-sel" style="width:120px;"><option value="all" ${R.vocabExportSel==='all'?'selected':''}>全部</option><option value="0" ${R.vocabExportSel==='0'?'selected':''}>仅未选中过</option><option value="1" ${R.vocabExportSel==='1'?'selected':''}>仅选中过</option></select></label>
          <label>起始条数 <input class="input" data-a="vocab-export-start" type="number" min="1" value="${safe(R.vocabStart)}" style="width:74px;"> 到 <input class="input" data-a="vocab-export-end" type="number" min="1" value="${safe(R.vocabEnd)}" style="width:74px;"></label>
          <span class="br-muted">当前筛选 ${exp.total} 条 · 导出范围 ${exp.start}–${exp.end}（${exp.items.length} 条）</span>
        </div>
        <div class="fin-note" style="margin:0 0 6px;">按当前筛选与起始条数导出 JSON 数组；手动勾选时只导出范围内的勾选项。填入提示词 {{单词数据}}，外部句对到「学习 → 俄汉互译」导入。</div>
        <div class="br-letter-index">${[...RU_ALPHABET,'其他'].map(letter=>`<button class="btn soft sm ${R.vocabLetter===letter?'selected':''}" data-a="vocab-letter" data-letter="${letter}">${letter}</button>`).join('')}</div><div class="br-vocab-count">共 ${items.length} 条 · 可背诵 ${items.filter(hasTranslation).length} 条</div><div class="br-vocab-list">${items.map(manageCardHTML).join('')||'<p class="br-muted">暂无词库条目。</p>'}</div></section>`);
      return;
    }
    const items=memorizeItems();
    R.vocabIndex=Math.max(0,Math.min(items.length-1,R.vocabIndex||0));
    const item=items[R.vocabIndex];
    const rounds=R.vocabRounds instanceof Set ? R.vocabRounds : new Set(ROUNDS);
    const anyEligible=(R.vocabItems||[]).some(hasTranslation);
    const emptyText=anyEligible?'当前轮次筛选下没有可背诵条目。':'暂无可背诵条目：仅显示有释义词条（请先完成清洗回填或补全释义）。';
    shell(`<section class="br-panel br-memo-panel"><div class="br-toolbar"><h3>${kind==='words'?'全局单词库':'全局词组库'} · 背诵视图</h3>${viewSwitchHTML()}<button class="btn soft" data-a="home">返回书籍</button></div>
      <div class="br-memo-filter"><span>轮次</span>${ROUNDS.map(x=>`<label class="br-round-check"><input type="checkbox" data-a="vocab-round-filter" data-round="${x}" ${rounds.has(x)?'checked':''}>第${x}轮</label>`).join('')}<button class="btn soft sm" data-a="vocab-rounds-all">全选</button><button class="btn soft sm" data-a="vocab-rounds-none">清空</button><button class="btn soft sm" data-a="vocab-shuffle">🔀 打乱顺序</button><span class="br-memo-lang"><button class="btn soft sm ${R.memoLang==='ru'?'on':''}" data-a="memo-lang" data-lang="ru">显示俄语</button><button class="btn soft sm ${R.memoLang==='zh'?'on':''}" data-a="memo-lang" data-lang="zh">显示汉语</button></span></div>
      ${item?memoCardHTML(item):`<div class="br-memo-empty"><b>${emptyText}</b><p>切换轮次筛选或返回管理视图补全释义。</p></div>`}
      ${items.length?`<div class="br-memo-nav"><button class="btn soft" data-a="vocab-prev" ${R.vocabIndex===0?'disabled':''}>← 上一张</button><span>${R.vocabIndex+1} / ${items.length}</span><button class="btn soft" data-a="vocab-next" ${R.vocabIndex===items.length-1?'disabled':''}>下一张 →</button></div>`:''}</section>`);
  }
  async function renderVocab() {
    R.page='vocab'; saveBrView('vocab');
    const kind=R.vocab;
    R.vocabQuery=$('#br-vocab-query')?.value??R.vocabQuery??'';
    if(kind==='words')R.vocabPos=$('#br-vocab-pos')?.value??R.vocabPos??'';
    const qp=new URLSearchParams();if(R.vocabQuery)qp.set('q',R.vocabQuery);if(kind==='words'&&R.vocabPos)qp.set('pos',R.vocabPos);
    R.vocabItems=(await api(`/api/plugin/book_reader/reader/vocabulary/${kind}?${qp}`)).items||[];
    paintVocab();
  }
  function switchVocabView(view) {
    R.vocabView=view==='memorize'?'memorize':'manage';
    R.vocabShuffle=null;
    R.memoExamplesOpen=false;
    if(R.vocabView==='memorize'){R.vocabIndex=0;R.vocabFlipped=false;}
    paintVocab();
  }
  function flipVocabCard() {
    if(R.vocabView!=='memorize')return;
    R.vocabFlipped=!R.vocabFlipped;
    const card=$('.br-memo-card');
    if(card){card.classList.toggle('flipped',R.vocabFlipped);card.focus({preventScroll:true});}
  }
  function moveVocab(delta) {
    const items=memorizeItems();
    if(!items.length)return;
    R.vocabIndex=Math.max(0,Math.min(items.length-1,R.vocabIndex+delta));
    R.vocabFlipped=false;
    R.memoExamplesOpen=false;
    paintVocab();
  }
  async function setVocabRound(round) {
    const oldItems=memorizeItems(), oldIndex=R.vocabIndex, item=oldItems[oldIndex];
    if(!item)return;
    const id=vocabKey(item);
    await api(`/api/plugin/book_reader/reader/vocabulary/${R.vocab}/${encodeURIComponent(id)}`,'PATCH',{memorize_round:round});
    item.memorize_round=round;
    const items=memorizeItems();
    R.vocabIndex=nearestVocabIndex(oldItems,oldIndex,items);
    R.vocabFlipped=false;
    R.memoExamplesOpen=false;
    paintVocab();
    toast(`已标为第 ${round} 轮`,'success');
  }
  async function clearVocab() {
    if (!R.vocabItems.length) { toast('当前词库为空', 'info'); return; }
    const label = R.vocab === 'words' ? '单词' : '词组';
    if (!confirm(`确认全部删除${label}库？\n经核实新 task_id 回填按稳定键（原形+${R.vocab === 'words' ? '词性' : '类型'}）覆盖已有词条，因此将保留 ${R.vocabItems.length} 条词条，仅把对应已清洗标记退回待清洗。`)) return;
    download(`vocab-${R.vocab}-backup-${new Date().toISOString().slice(0, 10)}.json`, {
      exported_at: new Date().toISOString(), kind: R.vocab, items: R.vocabItems,
    }, 'reader_vocab');
    const out = await api(`/api/plugin/book_reader/reader/vocabulary/${R.vocab}/clear`, 'POST', {});
    toast(`已退回 ${out.reset_marks} 条标记待清洗；词条保留 ${out.kept_items} 条`, 'success', 4600);
    await renderVocab();
  }
  async function translationView(keepError = false) {
    const kept = R.error;
    R.page = 'translation'; R.book = null; saveBrView('translation');
    R.translationPairs = (await api('/api/plugin/book_reader/reader/translation-pairs')).items || [];
    if (keepError) R.error = kept;
    const valid = new Set(R.translationPairs.map(x => x.id));
    R.translationMasked = new Set([...R.translationMasked].filter(k => valid.has(k.split(':')[0])));
    const rows = R.translationPairs.map(p => {
      const cell = (side, text) => `<button class="br-translation-cell ${R.translationMasked.has(p.id + ':' + side) ? 'masked' : ''}" data-a="translation-toggle" data-id="${safe(p.id)}" data-side="${side}" title="点击切换遮蔽">${safe(text)}</button>`;
      return `<article class="br-translation-row">${cell('ru', p.ru)}${cell('zh', p.zh)}<button class="mini-btn" data-a="translation-delete" data-id="${safe(p.id)}">删除</button></article>`;
    }).join('');
    shell(`<section class="br-panel"><div class="br-toolbar"><h3>俄汉互译知识库（${R.translationPairs.length} 条）</h3><button class="btn soft" data-a="home">返回书籍</button><button class="btn danger sm" data-a="translation-clear" ${R.translationPairs.length ? '' : 'disabled'}>全部清空</button></div>
      <div class="fin-note" style="margin:0 0 8px;">导入 JSON 数组，每项仅 {"ru":"...","zh":"..."}；点击俄语或汉语可遮蔽自测，再次点击恢复；不做判分。</div>
      <textarea class="input" id="br-translation-import" rows="4" placeholder='[{"ru":"Привет!","zh":"你好！"}]'></textarea>
      <div class="br-inline"><input type="file" id="br-translation-file" accept=".json,application/json"><button class="btn" data-a="translation-import">导入 JSON 数组</button></div>
      <div class="br-translation-list">${rows || '<p class="br-muted">暂无互译条目，请粘贴提示词生成的 JSON 数组后导入。</p>'}</div></section>`);
  }
  async function translationImport() {
    const raw = $('#br-translation-import')?.value || '';
    let items;
    try { items = JSON.parse(raw); }
    catch (e) { R.error = '互译导入 JSON 解析失败：' + e.message; await translationView(true); return; }
    if (!Array.isArray(items)) { R.error = '互译导入内容必须是 JSON 数组'; await translationView(true); return; }
    const out = await api('/api/plugin/book_reader/reader/translation-pairs/import', 'POST', items);
    if ((out.errors || []).length) {
      R.error = `互译导入：成功 ${out.imported} 条，失败 ${out.errors.length} 条。\n` + out.errors.map(e => `· 第 ${e.index} 条：${e.error}`).join('\n');
      toast(`导入 ${out.imported} 条，${out.errors.length} 条未入库`, 'warn', 4600);
    } else {
      R.error = '';
      toast(`已导入 ${out.imported} 条互译`, 'success');
    }
    await translationView(!!(out.errors || []).length);
  }
  async function pendingView(keepError = false) {
    const keptError = R.error;
    if(R.book){R.scopeBookId=R.book.book_id;R.scopeSectionId='';} // 待清洗页只暴露书籍筛选；默认看全书，避免从根层级进入时漏掉叶子层级标注
    R.book=null;R.page='pending';saveBrView('pending');
    const params=new URLSearchParams();
    if(R.markFilter)params.set('mark_type',R.markFilter);
    if(R.scopeBookId)params.set('book_id',R.scopeBookId);
    if(R.scopeSectionId)params.set('section_id',R.scopeSectionId);
    if(R.pendingStart)params.set('start',R.pendingStart);
    if(R.pendingEnd)params.set('end',R.pendingEnd);
    const pendingData=await api('/api/plugin/book_reader/reader/pending?'+params);
    R.pending=pendingData.items||[];
    R.pendingTotal=Number(pendingData.total)||0;
    R.pendingNotes=Array.isArray(pendingData.range_notes)?pendingData.range_notes:[];
    R.pendingRangeStart=Number(pendingData.start)||1;
    R.pendingRangeEnd=pendingData.end===null||pendingData.end===undefined?R.pendingTotal:Number(pendingData.end);
    if(keepError) R.error=keptError;
    const groups=new Map();for(const item of R.pending){const key=item.book_name+' / '+item.section_name;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
    const rangeText=R.pendingTotal?`当前范围 ${R.pendingRangeStart}–${R.pendingRangeEnd} 条 · 共 ${R.pendingTotal} 条`:'当前筛选结果为空';
    const rangeNote=R.pendingNotes.length?`<div class="br-muted" style="color:#a76a12;">${safe(R.pendingNotes.join('；'))}</div>`:'';
    shell(`<section class="br-panel"><div class="br-toolbar"><h3>待清洗标记（${R.pending.length} / ${R.pendingTotal}）</h3><button class="btn" data-a="export-pending">导出所选/当前范围</button><button class="btn soft" data-a="copy-return-spec">复制返还结构与说明</button><button class="btn soft" data-a="home">书籍</button></div><div class="br-inline"><label>书籍 <select class="input" data-a="pending-book"><option value="">全部书籍</option>${R.books.map(x=>`<option value="${safe(x.book_id)}" ${R.scopeBookId===x.book_id?'selected':''}>${safe(x.name)}</option>`).join('')}</select></label><label>类型 <select class="input" data-a="pending-type"><option value="">全部类型</option><option value="word" ${R.markFilter==='word'?'selected':''}>单词</option><option value="phrase" ${R.markFilter==='phrase'?'selected':''}>词组</option></select></label><label>起始 <input class="input" data-a="pending-start" type="number" min="1" value="${safe(R.pendingStart)}" placeholder="1" style="width:74px;"> 到 <input class="input" data-a="pending-end" type="number" min="1" value="${safe(R.pendingEnd)}" placeholder="全部" style="width:74px;"></label><button class="btn soft" data-a="filter-pending">筛选</button><input type="checkbox" data-a="select-all-marks">全选</div><div class="br-muted" style="margin:-3px 0 7px;">${rangeText} · 1 起含两端；留空结束条数=全量${R.pendingNotes.length?' · 已夹取/提示见下':''}</div>${rangeNote}<div class="br-inline"><input class="input" type="file" id="br-return-file" accept=".json,application/json"><button class="btn" data-a="return-file">导入返还文件</button></div><textarea class="input" id="br-return-data" rows="6" placeholder="也可粘贴返还 JSON"></textarea><button class="btn" data-a="return-paste">回填粘贴内容</button><div class="br-pending-list">${[...groups].map(([group,items])=>`<section><h4>${safe(group)}</h4>${items.map(x=>`<article class="br-vocab"><input type="checkbox" data-a="select-mark" data-id="${x.mark_id}" ${R.selectedMarks.has(x.mark_id)?'checked':''}><button class="btn soft sm" data-a="jump-mark" data-book="${safe(x.book_id)}" data-section="${safe(x.section_id)}">${safe(x.surface)} (${x.mark_type})</button><p>${safe(x.sentence_ru)}</p><small>${safe(x.translation_zh)}</small></article>`).join('')}</section>`).join('')||'<p class="br-muted">当前范围没有待清洗标记。</p>'}</div></section>`);
  }
  async function render() {
    try { if (R.book) readerView(); else bookList(); }
    catch (e) { err(e); }
  }
  async function refresh() { if(R.book){R.book=await api(`/api/plugin/book_reader/books/${encodeURIComponent(R.book.book_id)}`);await loadSection();} else await loadBooks(); }
  async function onClick(event) {
    const b=event.target.closest('[data-a]');if(!b||!R.root.contains(b))return;
    if(b.dataset.a==='br-menu'){toggleBrMenu(b.dataset.menu);return;}
    closeBrMenus();
    const id=b.dataset.id;
    try {
      switch(b.dataset.a){
        case 'home':R.vocabShuffle=null;await loadBooks();break;
        case 'close-error':R.error='';if(R.page==='guide')guideView();else if(R.page==='vocab')await renderVocab();else if(R.page==='pending')await pendingView();else render();break;
        case 'guide':{const from=['home','vocab','pending'].includes(R.page)?R.page:'home';R.guideFrom=from;R.page='guide';saveBrView('guide');guideView();break;}
        case 'guide-back':{if(R.guideFrom==='vocab'){R.page='vocab';await renderVocab();}else if(R.guideFrom==='pending'){R.page='pending';await pendingView();}else{await loadBooks();}break;}
        case 'open-book':await openBook(id);break;
        case 'go-section':R.sectionId=id;await loadSection();break;
        case 'section-order':{const rows=R.section.children;const from=rows.findIndex(x=>x.section_id===id);const to=Math.max(0,Math.min(rows.length-1,Number(b.dataset.order)));if(from!==to){await api(`/api/plugin/book_reader/reader/sections/${rows[from].section_id}`,'PATCH',{order_index:to});await api(`/api/plugin/book_reader/reader/sections/${rows[to].section_id}`,'PATCH',{order_index:from});await loadSection();}break;}
        case 'add-section':$('#br-new-section')?.focus();break;
        case 'rename-book':{const book=R.books.find(x=>x.book_id===id)||R.book;const name=prompt('输入书名',book?.name||'');if(name?.trim()){await api(`/api/plugin/book_reader/books/${encodeURIComponent(id)}`,'PATCH',{name});await loadBooks();}break;}
        case 'delete-book':if(confirm('确认删除本书及其所有层级和句子？全局词库条目会保留并显示无来源。')){await api(`/api/plugin/book_reader/books/${encodeURIComponent(id)}`,'DELETE');await loadBooks();}break;
        case 'copy-book':{const sections=await allSections(id);const ids=prompt(`复制范围：留空复制全书；或输入要复制的章节序号（逗号分隔）。\n${sections.map((x,i)=>`${i+1}. ${x.name}`).join('\n')}`);const copyMarks=confirm('是否复制标记及其词库关联？');const payload={copy_marks:copyMarks};if(ids?.trim()){const numbers=ids.split(',').map(x=>Number(x.trim()));if(numbers.some(n=>!Number.isInteger(n)||n<1||n>sections.length))throw new Error('章节序号无效');payload.section_ids=numbers.map(n=>sections[n-1].id);}await api(`/api/plugin/book_reader/books/${encodeURIComponent(id)}/copy`,'POST',payload);await loadBooks();break;}
        case 'book-up':case 'book-down':{const i=Number(b.dataset.index),j=i+(b.dataset.a==='book-up'?-1:1);if(j>=0&&j<R.books.length){const ids=R.books.map(x=>x.book_id);[ids[i],ids[j]]=[ids[j],ids[i]];await api('/api/plugin/book_reader/books/reorder','POST',{book_ids:ids});await loadBooks();}break;}
        case 'rename-section':{const n=prompt('层级名称',R.section?.name);if(n?.trim()){await api(`/api/plugin/book_reader/reader/sections/${R.sectionId}`,'PATCH',{name:n});await loadSection();}break;}
        case 'delete-section':{const hasContent=R.section.children.length||R.section.sentences.length||R.section.placeholders.length;const message=hasContent?'该层级非空。确认连同全部子层级、句子和错误占位一起删除？':'确认删除这个空层级？';if(confirm(message)){await api(`/api/plugin/book_reader/reader/sections/${R.sectionId}`,'DELETE',{recursive:Boolean(hasContent)});R.sectionId=R.section.parent_id||R.book.root_section_id;await loadSection();}break;}
         case 'toggle-all':R.showAll=!R.showAll;render();break;
        case 'open-reader-screen':await openReaderScreen();break;
        case 'visual-settings':await openVisualSettings();break;
        case 'token':{const sid=b.dataset.sid,i=Number(b.dataset.i);if(event.shiftKey){const set=R.selected.get(sid)||new Set();set.has(i)?set.delete(i):set.add(i);R.selected.set(sid,set);render();}else if(confirm('将该词标记为重点单词？')){await api(`/api/plugin/book_reader/reader/sentences/${sid}/marks`,'POST',{mark_type:'word',token_indexes:[i]});await loadSection();}break;}
        case 'delete-mark':if(confirm('取消该重点标记？')){await api(`/api/plugin/book_reader/reader/marks/${id}`,'DELETE');await loadSection();}break;
        case 'translation':if(event.target.closest('.br-translation')){R.revealed.has(id)?R.revealed.delete(id):R.revealed.add(id);render();}break;
        case 'single-prev':R.singleIndex=Math.max(0,R.singleIndex-1);render();break;
        case 'single-next':R.singleIndex=Math.min((R.mode==='full'?R.fullSentences:R.section.sentences).length-1,R.singleIndex+1);render();break;
        case 'move-sentence':{const ids=[...R.selectedSentences];if(!ids.length){toast('请先勾选要移动的句子','info');break;}const sections=await allSections(R.book.book_id);const selection=prompt(`输入目标层级序号：\n${sections.map((x,i)=>`${i+1}. ${x.name}`).join('\n')}`);const destination=sections[Number(selection)-1]?.id;if(destination){for(const sid of ids)await api(`/api/plugin/book_reader/reader/sentences/${sid}`,'PATCH',{section_id:destination});await loadSection();}break;}
        case 'delete-selected-sentences':{const ids=[...R.selectedSentences];if(ids.length&&confirm(`确认删除选中的 ${ids.length} 条句子及其标记？`)){for(const sid of ids)await api(`/api/plugin/book_reader/reader/sentences/${sid}`,'DELETE');await loadSection();}break;}
        case 'token-context':break;
        case 'edit-sentence':{const s=getSentence(id);if(!s){toast('找不到该句子，请刷新后重试','error');break;}if(confirm('编辑将清空该句全部标记与清洗关联，继续？')){const ru=prompt('俄语句子',s.sentence_ru);if(ru===null)break;const zh=prompt('中文翻译',s.translation_zh);if(zh===null)break;await api(`/api/plugin/book_reader/reader/sentences/${id}`,'PATCH',{sentence_ru:ru,translation_zh:zh});await loadSection();}break;}
        case 'delete-sentence':if(confirm('删除该句及其全部标记？')){await api(`/api/plugin/book_reader/reader/sentences/${id}`,'DELETE');await loadSection();}break;
        case 'copy-ru':case 'copy-zh':{const s=getSentence(id);if(!s){toast('找不到该句子，请刷新后重试','error');break;}await copy(b.dataset.a==='copy-ru'?s.sentence_ru:s.translation_zh);break;}
        case 'delete-placeholder':if(confirm('删除报错占位？')){await api(`/api/plugin/book_reader/reader/placeholders/${id}`,'DELETE');await loadSection();}break;
        case 'repair-placeholder':{const raw=R.section.placeholders.find(x=>x.placeholder_id===id)?.raw_json;const text=prompt('编辑 JSON 并修复',raw);if(text!==null){await api(`/api/plugin/book_reader/reader/placeholders/${id}`,'PATCH',{content:text});await loadSection();}break;}
        case 'import-json':await importJson();break;
        case 'copy-import-spec':await copy(STRUCTURE+(R.book?`\n当前书籍：${R.book.name}\n当前层级：${R.section?.name||''}；导入内容将追加到此层级。`:''));break;
        case 'pending':await pendingView();break;
        case 'filter-pending':R.scopeBookId=$('[data-a="pending-book"]')?.value||'';R.markFilter=$('[data-a="pending-type"]')?.value||'';R.pendingStart=$('[data-a="pending-start"]')?.value||'';R.pendingEnd=$('[data-a="pending-end"]')?.value||'';R.scopeSectionId='';await pendingView();break;
        case 'jump-mark':await openBook(b.dataset.book);R.sectionId=b.dataset.section;await loadSection();break;
        case 'export-pending':{const selected=[...R.selectedMarks];const scope=R.scopeSectionId?'section':R.scopeBookId?'book':'global';const task=await api('/api/plugin/book_reader/reader/cleaning/export','POST',{scope,book_id:R.scopeBookId||undefined,section_id:R.scopeSectionId||undefined,start:R.pendingStart||undefined,end:R.pendingEnd||undefined,mark_ids:selected.length?selected:undefined});if(!task.task_id){toast('当前筛选/范围没有待导出的标记','info');break;}download(`cleaning-${task.task_id}.json`,task,'reader_cleaning');break;}
        case 'return-paste':await returnData($('#br-return-data').value);break;
        case 'return-file':{const file=$('#br-return-file').files[0];if(file)await returnData(await file.text());break;}
        case 'copy-return-spec':await copy(RETURN_STRUCTURE+(R.scopeBookId?`\n当前书籍范围：${R.books.find(x=>x.book_id===R.scopeBookId)?.name||R.scopeBookId}`:'\n当前范围：全局'));break;
        case 'copy-cleaning-spec':await copy(CLEANING_EXPORT_SPEC+(R.scopeBookId?`\n当前书籍范围：${R.books.find(x=>x.book_id===R.scopeBookId)?.name||R.scopeBookId}`:'\n当前范围：全局')+(R.scopeSectionId?`\n当前层级：${R.section?.name||R.scopeSectionId}`:''));break;
        case 'vocab-words':R.vocab='words';R.vocabView='manage';R.vocabIndex=0;R.vocabFlipped=false;R.vocabShuffle=null;R.vocabSelected.clear();R.vocabExportSel='all';R.vocabStart='';R.vocabEnd='';await renderVocab();break;
        case 'vocab-phrases':R.vocab='phrases';R.vocabView='manage';R.vocabIndex=0;R.vocabFlipped=false;R.vocabShuffle=null;R.vocabSelected.clear();R.vocabExportSel='all';R.vocabStart='';R.vocabEnd='';await renderVocab();break;
        case 'vocab-search':R.vocabQuery=$('#br-vocab-query')?.value||'';R.vocabPos=$('#br-vocab-pos')?.value||'';await renderVocab();break;
        case 'export-selected-vocab':exportSelectedVocab();break;
        case 'vocab-letter':R.vocabLetter=b.dataset.letter;paintVocab();break;
        case 'vocab-view':switchVocabView(b.dataset.view);break;
        case 'vocab-card':flipVocabCard();break;
        case 'vocab-prev':moveVocab(-1);break;
        case 'vocab-next':moveVocab(1);break;
        case 'vocab-round':await setVocabRound(Number(b.dataset.round));break;
        case 'vocab-shuffle':shuffleVocab();break;
        case 'memo-lang':R.memoLang=b.dataset.lang==='zh'?'zh':'ru';paintVocab();break;
        case 'memo-examples':R.memoExamplesOpen=!R.memoExamplesOpen;paintVocab();break;
        case 'memo-forms':openMemoForms();break;
        case 'clear-vocab':await clearVocab();break;
        case 'translation-pairs':await translationView();break;
        case 'translation-import':await translationImport();break;
        case 'translation-toggle':{const key=id+':'+b.dataset.side;if(R.translationMasked.has(key))R.translationMasked.delete(key);else R.translationMasked.add(key);b.classList.toggle('masked',R.translationMasked.has(key));break;}
        case 'translation-delete':if(confirm('确认删除这条俄汉互译？')){await api(`/api/plugin/book_reader/reader/translation-pairs/${encodeURIComponent(id)}`,'DELETE');await translationView();}break;
        case 'translation-clear':if(confirm('确认清空全部俄汉互译条目？此操作不可撤销。')){await api('/api/plugin/book_reader/reader/translation-pairs','DELETE');R.translationMasked.clear();await translationView();}break;
        case 'vocab-rounds-all':{const oldItems=memorizeItems(),oldIndex=R.vocabIndex;R.vocabRounds=new Set(ROUNDS);const items=memorizeItems();R.vocabIndex=nearestVocabIndex(oldItems,oldIndex,items);R.vocabFlipped=false;paintVocab();break;}
        case 'vocab-rounds-none':{const oldItems=memorizeItems(),oldIndex=R.vocabIndex;R.vocabRounds=new Set();const items=memorizeItems();R.vocabIndex=nearestVocabIndex(oldItems,oldIndex,items);R.vocabFlipped=false;paintVocab();break;}
        case 'jump-address':await openBook(b.dataset.book);R.sectionId=b.dataset.section;await loadSection();break;
        case 'add-vocab':await editVocab();break;
        case 'edit-vocab':await editVocab(id);break;
        case 'delete-vocab':if(confirm('删除此词库条目？关联标记将退回未清洗。')){await api(`/api/plugin/book_reader/reader/vocabulary/${R.vocab}/${id}`,'DELETE');await renderVocab();}break;
        case 'export-cleaned':{const q=R.book?`?book_id=${encodeURIComponent(R.book.book_id)}`:'';download('cleaned-reading-data.json',await api('/api/plugin/book_reader/reader/export-cleaned'+q),'reader_cleaned');break;}
        case 'copy-cleaned-spec':await copy(CLEANED_EXPORT_SPEC+(R.book?`\n当前书籍范围：${R.book.name}`:'\n当前范围：全部已清洗数据'));break;
      }
    } catch(e){err(e);}
  }
  function findRoot() { let sec=R.section;while(sec?.parent_id)sec=findSection(sec.parent_id);return sec?.section_id||R.book?.root_section_id; }
  async function importJson() {
    const content=$('#br-import-data').value;if(!content.trim())throw new Error('请粘贴 JSON 数组或选择文件');
    let result=await api(`/api/plugin/book_reader/reader/sections/${R.sectionId}/import`,'POST',{content});
    if(result.duplicate_suspected&&confirm(result.message))result=await api(`/api/plugin/book_reader/reader/sections/${R.sectionId}/import`,'POST',{content,allow_duplicate:true});
    toast(`导入完成：${result.imported||0} 条句子，${result.placeholders||0} 条错误占位`,'success');await loadSection();
    if(result.warnings?.length)toast(result.warnings.join('；'),'info');
  }
  async function returnData(raw) {
    let data;
    try { data=JSON.parse(raw); }
    catch(e){ R.error='返还 JSON 解析失败：'+e.message+'\n请检查文件内容，或回到「待清洗」页重新导出。'; await pendingView(true); return; }
    try {
      const out=await api('/api/plugin/book_reader/reader/cleaning/return','POST',data);
      const skipped=(out.skipped||[]).length;
      toast(`回填 ${out.accepted.length} 条${skipped?`，跳过 ${skipped} 条`:''}，错误 ${out.errors.length} 条`, out.errors.length?'warn':'success');
      if(out.errors.length){
        R.error=`回填未完全成功：接受 ${out.accepted.length}，跳过 ${skipped}，失败 ${out.errors.length}。\n`
          + out.errors.map(e=>`· ${e.record_id||'未知记录'}：${e.error}${e.hint?`（${e.hint}）`:''}`).join('\n')
          + '\n请用上方「导出所选/当前范围」重新导出待清洗数据后再回填。';
      } else { R.error=''; }
      await pendingView(out.errors.length>0);
    } catch(e) {
      R.error=e.message+'\n请回到「待清洗」页重新导出后再回填；旧导出包没有 task_id 时不会自动补建。';
      await pendingView(true);
    }
  }
  async function editVocab(id) {
    const all=id?(await api(`/api/plugin/book_reader/reader/vocabulary/${R.vocab}`)).items:[];const existing=all.find(x=>(x.word_id||x.phrase_id)===id);
    const name=prompt(R.vocab==='words'?'元单词原形':'元词组', existing?.lemma||existing?.phrase_lemma||'');if(name===null)return;
    const translation=prompt('主翻译',existing?.translation||'')??existing?.translation??'';const usage=prompt('基本用法',existing?.basic_usage||'')??existing?.basic_usage??'';
    const notes=JSON.parse(prompt('补充释义/用法 JSON 数组',JSON.stringify(existing?.supplementary_notes||[]))||'[]');
    const stressRaw=prompt('重音（主词第几个俄语字母，1 起；留空=不标）',existing?.stress??'');
    if(stressRaw===null)return;
    const stress=stressRaw.trim()===''?null:Number(stressRaw);
    if(stress!==null&&(!Number.isInteger(stress)||stress<1)){toast('重音必须为 1 起的整数（或留空）','warn');return;}
    const examplesRaw=prompt('例句 JSON 数组（3 项，每项“俄语||汉语”；留空=不填）',JSON.stringify(memoExamples(existing).map(x=>`${x.ru}||${x.zh}`)));
    if(examplesRaw===null)return;
    let examples=null;
    if(examplesRaw.trim()){
      try{examples=JSON.parse(examplesRaw);if(!Array.isArray(examples)||examples.some(x=>typeof x!=='string'))throw new Error('需为字符串数组');}
      catch(e){toast('例句 JSON 解析失败：'+e.message,'warn');return;}
    }
    const body=R.vocab==='words'?{lemma:name,translation,basic_usage:usage,pos:prompt('词性（可空）',existing?.pos||'')??'',inflections:JSON.parse(prompt('变格/变位列表 JSON',JSON.stringify(existing?.inflections||[]))||'[]'),supplementary_notes:notes,stress,examples}:{phrase_lemma:name,translation,basic_usage:usage,phrase_type:prompt('词组类型（可空）',existing?.phrase_type||'')??'',components:JSON.parse(prompt('组成项 JSON',JSON.stringify(existing?.components||[]))||'[]'),supplementary_notes:notes,stress,examples};
    await api(id?`/api/plugin/book_reader/reader/vocabulary/${R.vocab}/${id}`:`/api/plugin/book_reader/reader/vocabulary/${R.vocab}`,id?'PATCH':'POST',body);await renderVocab();
  }
  async function tokenContext(token) {
    const sid=token.dataset.sid,index=Number(token.dataset.i),chosen=[...(R.selected.get(sid)||new Set([index]))];
    if(chosen.length>1){if(confirm('将选中的词组成重点词组？')){await api(`/api/plugin/book_reader/reader/sentences/${sid}/marks`,'POST',{mark_type:'phrase',token_indexes:chosen});R.selected.delete(sid);await loadSection();}return;}
    const sentence=getSentence(sid),mark=sentence?.marks.find(x=>x.token_indexes.includes(index));
    if(!mark){if(confirm(`将“${sentence?.tokens[index]}”标记为重点单词？`)){await api(`/api/plugin/book_reader/reader/sentences/${sid}/marks`,'POST',{mark_type:'word',token_indexes:[index]});await loadSection();}return;}
    const action=prompt(`${mark.surface}${mark.vocab_summary?`\n${mark.vocab_summary}`:''}\n1 查看词库摘要  2 取消标记  3 重新指定词库条目`);
    if(action==='1'){alert(mark.vocab_summary||'该标记尚未关联词库条目。');return;}
    if(action==='2'){await api(`/api/plugin/book_reader/reader/marks/${mark.mark_id}`,'DELETE');await loadSection();return;}
    if(action==='3'){
      const kind=mark.mark_type==='word'?'words':'phrases',items=(await api(`/api/plugin/book_reader/reader/vocabulary/${kind}`)).items;
      const options=items.map((x,i)=>`${i+1}. ${x.lemma||x.phrase_lemma} ${x.pos||x.phrase_type||''} — ${x.translation}`).join('\n');
      const n=Number(prompt(`输入要关联的词库条目序号：\n${options}`));if(Number.isInteger(n)&&items[n-1]){await api(`/api/plugin/book_reader/reader/marks/${mark.mark_id}`,'PATCH',{[mark.mark_type==='word'?'word_id':'phrase_id']:items[n-1][mark.mark_type==='word'?'word_id':'phrase_id']});await loadSection();}
    }
  }
  function onSubmit(e) {
    const form=e.target;if(!form.matches('[data-f]'))return;e.preventDefault();const data=new FormData(form);
    (async()=>{try{if(form.dataset.f==='new-book'){await api('/api/plugin/book_reader/books','POST',{name:data.get('name')});await loadBooks();}
      if(form.dataset.f==='new-section'){const name=data.get('name');await api(`/api/plugin/book_reader/books/${encodeURIComponent(R.book.book_id)}/sections`,'POST',{name,parent_id:R.sectionId});await loadSection();}}
    catch(ex){err(ex);}})();
  }

  /* ---------- 通篇视图 · 像素书签 ----------
     默认停在第 1 句之前；拖动只能在句与句之间（gap = 位于该句之前），
     位置按书籍记在 SQLite，删/改句子后按句 id 复原，找不到则回到开头。 */
  const BM_SVG = '<svg viewBox="0 0 13 17" width="26" height="34" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="0" width="9" height="1" fill="#4a1f2c"/><rect x="2" y="1" width="1" height="16" fill="#4a1f2c"/><rect x="3" y="1" width="7" height="1" fill="#ffb3c6"/><rect x="10" y="1" width="1" height="16" fill="#4a1f2c"/><rect x="3" y="2" width="6" height="1" fill="#e0587a"/><rect x="9" y="2" width="1" height="11" fill="#b93d5c"/><rect x="3" y="3" width="1" height="11" fill="#e0587a"/><rect x="4" y="3" width="1" height="4" fill="#fff3f6"/><rect x="5" y="3" width="4" height="1" fill="#e0587a"/><rect x="5" y="4" width="2" height="1" fill="#e0587a"/><rect x="7" y="4" width="1" height="3" fill="#ffd166"/><rect x="8" y="4" width="1" height="1" fill="#e0587a"/><rect x="5" y="5" width="1" height="7" fill="#e0587a"/><rect x="6" y="5" width="1" height="1" fill="#ffd166"/><rect x="8" y="5" width="1" height="1" fill="#ffd166"/><rect x="6" y="6" width="1" height="5" fill="#e0587a"/><rect x="8" y="6" width="1" height="7" fill="#e0587a"/><rect x="4" y="7" width="1" height="6" fill="#e0587a"/><rect x="7" y="7" width="1" height="5" fill="#e0587a"/><rect x="6" y="11" width="1" height="1" fill="#4a1f2c"/><rect x="5" y="12" width="1" height="1" fill="#4a1f2c"/><rect x="7" y="12" width="1" height="1" fill="#4a1f2c"/><rect x="4" y="13" width="1" height="1" fill="#4a1f2c"/><rect x="8" y="13" width="1" height="1" fill="#4a1f2c"/><rect x="9" y="13" width="1" height="1" fill="#e0587a"/><rect x="3" y="14" width="1" height="3" fill="#4a1f2c"/><rect x="9" y="14" width="1" height="3" fill="#4a1f2c"/></svg>';

  let BOOKMARKS = null;
  async function ensureBookmarks() {
    if (BOOKMARKS) return;
    try { const d = await api('/api/plugin/book_reader/state'); BOOKMARKS = (d && d.items) || {}; }
    catch (e) { BOOKMARKS = {}; }
  }
  function bmSentences() {
    const host = $('.br-full-reading');
    if (!host) return { host: null, els: [] };
    return { host, els: Array.from(host.querySelectorAll('.br-full-pair')) };
  }
  function bmLoadGap() {
    const n = bmSentences().els.length || R.fullSentences.length;
    if (!n) return 0;
    const saved = (BOOKMARKS && R.book) ? BOOKMARKS[R.book.book_id] : null;
    if (saved && saved.after) return Math.max(0, Math.min(n, Number(saved.index) || n));
    if (saved && saved.id) {
      const idx = R.fullSentences.findIndex(x => x.sentence_id === saved.id);
      if (idx >= 0) return idx;
    }
    if (saved && Number.isInteger(saved.index)) return Math.max(0, Math.min(n, saved.index));
    return 0;
  }
  function bmSave(gap) {
    const n = R.fullSentences.length;
    if (!R.book || !n) return;
    const mark = gap >= n
      ? { id: R.fullSentences[n - 1].sentence_id, index: n, after: true }
      : { id: R.fullSentences[gap].sentence_id, index: gap };
    BOOKMARKS = BOOKMARKS || {};
    BOOKMARKS[R.book.book_id] = mark;
    api('/api/plugin/book_reader/state', {
      method: 'PUT', body: { book_id: R.book.book_id, bookmark: mark },
    }).catch(() => {});
  }
  function bmPosition() {
    const bm = $('.br-bm');
    if (!bm) return;
    const { host, els } = bmSentences();
    if (!host || !els.length) { bm.hidden = true; return; }
    const n = els.length;
    R.bookmarkGap = Math.max(0, Math.min(n, R.bookmarkGap || 0));
    const base = host.getBoundingClientRect();
    bm.hidden = false;
    bm.style.left = '2px';
    if (R.bookmarkGap >= n) {
      const last = els[n - 1].getBoundingClientRect();
      bm.style.top = Math.round(last.bottom - base.top + 6) + 'px';
      host.classList.add('br-bm-after');
      return;
    }
    host.classList.remove('br-bm-after');
    const rect = els[R.bookmarkGap].getBoundingClientRect();
    if (!rect.width) { bm.hidden = true; return; }
    bm.style.top = Math.round(rect.top - base.top + 4) + 'px';
  }
  function mountBookmark() {
    if (R.mode !== 'full' || !R.book) return;
    const { host, els } = bmSentences();
    if (!host || !els.length) return;
    R.bookmarkGap = bmLoadGap();
    let bm = $('.br-bm');
    if (!bm) {
      bm = document.createElement('button');
      bm.type = 'button';
      bm.className = 'br-bm';
      bm.dataset.bookmark = '1';
      bm.title = '书签：拖动可移动到任意两句之间（含最后一句之后）';
      bm.setAttribute('aria-label', '阅读书签，可拖动');
      const bmArt = artUrl(R.assets?.bookmark);
      bm.innerHTML = bmArt ? `<img class="br-bm-art" src="${bmArt}" alt="">` : BM_SVG;
      host.appendChild(bm);
      bm.addEventListener('pointerdown', bmStartDrag);
    }
    bmPosition();
  }
  let bmDrag = null;
  function bmStartDrag(event) {
    if (event.button && event.button !== 0) return;
    event.preventDefault();
    const bm = event.currentTarget;
    try { bm.setPointerCapture(event.pointerId); } catch (e) { /* 合成事件没有真实指针 */ }
    bmDrag = { x: event.clientX, y: event.clientY, gap: R.bookmarkGap, moved: false, target: R.bookmarkGap };
    bm.classList.add('dragging');
    bm.addEventListener('pointermove', bmMove);
    bm.addEventListener('pointerup', bmEnd);
    bm.addEventListener('pointercancel', bmEnd);
  }
  function bmMove(event) {
    if (!bmDrag) return;
    const bm = event.currentTarget;
    const dx = event.clientX - bmDrag.x;
    const dy = event.clientY - bmDrag.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) bmDrag.moved = true;
    bm.style.transform = `translate(${dx}px, ${dy}px)`;
    const gap = bmNearestGap(event.clientY);
    if (gap !== bmDrag.target) {
      bmDrag.target = gap;
      const { host, els } = bmSentences();
      els.forEach((el, i) => el.classList.toggle('br-bm-target', i === gap));
      if (host) host.classList.toggle('br-bm-after', gap >= els.length);
    }
  }
  function bmEnd(event) {
    if (!bmDrag) return;
    const bm = event.currentTarget;
    bm.classList.remove('dragging');
    bm.style.transform = '';
    bm.removeEventListener('pointermove', bmMove);
    bm.removeEventListener('pointerup', bmEnd);
    bm.removeEventListener('pointercancel', bmEnd);
    try { bm.releasePointerCapture(event.pointerId); } catch (e) { /* ignore */ }
    const { moved, target } = bmDrag;
    bmDrag = null;
    bmSentences().els.forEach(el => el.classList.remove('br-bm-target'));
    if (moved) {
      R.bookmarkGap = target;
      bmSave(target);
      bmPosition();
      const after = target >= R.fullSentences.length;
      toast(after ? '书签已移到最后一句之后' : '书签已移到第 ' + (target + 1) + ' 句之前', 'success', 1600);
    } else {
      bmPosition();
    }
  }
  function bmNearestGap(y) {
    const { els } = bmSentences();
    const n = els.length;
    if (!n) return 0;
    for (let i = 0; i < n; i += 1) {
      const r = els[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return n;
  }
  let bmResizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(bmResizeTimer);
    bmResizeTimer = setTimeout(() => { if (R.mode === 'full') bmPosition(); }, 120);
  });

  async function initBookReader() {
    try {
      R.books=(await api('/api/plugin/book_reader/books')).books||[];
      await Promise.all([loadVisual(), loadAssets()]);      const saved=readBrView();
      if(saved&&saved.page==='vocab'){
        R.vocab=saved.vocab==='phrases'?'phrases':'words';
        R.guideFrom=['home','vocab','pending'].includes(saved.guideFrom)?saved.guideFrom:'home';
        R.book=null;await renderVocab();return;
      }
      if(saved&&saved.page==='pending'){
        R.guideFrom=['home','vocab','pending'].includes(saved.guideFrom)?saved.guideFrom:'home';
        R.scopeBookId=saved.scopeBookId||'';R.scopeSectionId=saved.scopeSectionId||'';R.markFilter=saved.markFilter||'';
        R.book=null;await pendingView();return;
      }
      if(saved&&saved.page==='guide'){
        R.guideFrom=['home','vocab','pending'].includes(saved.guideFrom)?saved.guideFrom:'home';
        R.scopeBookId=saved.scopeBookId||'';R.scopeSectionId=saved.scopeSectionId||'';R.markFilter=saved.markFilter||'';
        R.book=null;guideView();return;
      }
      if(saved&&saved.page==='translation'){
        R.book=null;await translationView();return;
      }
      R.page='home';R.book=null;render();
    } catch(e) {
      R.page='home';err(e);
    }
  }

  function renderTool(container) {
  ROOT = container;
    R.root=ROOT;if(!R.root)return;
    R.vocabShuffle=null;
    if(!R.root.dataset.bookReaderBound){
      R.root.dataset.bookReaderBound='1';R.root.addEventListener('click',onClick);R.root.addEventListener('submit',onSubmit);
      if(!document.documentElement.dataset.brMenuBound){
        document.documentElement.dataset.brMenuBound='1';
        document.addEventListener('click',e=>{if(!e.target.closest('.br-menu'))closeBrMenus();});
        document.addEventListener('keydown',e=>{if(e.key==='Escape')closeBrMenus();});
      }
      R.root.addEventListener('change',async e=>{
        if(e.target.dataset.a==='mask-color'){R.visual=R.visual||defaultVisual();R.visual.mask.color=e.target.value;R.maskColor=e.target.value;applyVisual($('.br-reader'));persistVisual().catch(ex=>toast('遮蔽色保存失败：'+ex.message,'warn'));}
        if(e.target.id==='br-import-file'&&e.target.files[0])$('#br-import-data').value=await e.target.files[0].text();
        if(e.target.id==='br-return-file'&&e.target.files[0])$('#br-return-data').value=await e.target.files[0].text();
        if(e.target.id==='br-translation-file'&&e.target.files[0])$('#br-translation-import').value=await e.target.files[0].text();
        if(e.target.dataset.a==='mode'){R.mode=e.target.value;R.singleIndex=0;R.revealed.clear();if(R.mode==='full')await loadFull();render();}
        if(e.target.dataset.a==='select-sentence')e.target.checked?R.selectedSentences.add(e.target.dataset.id):R.selectedSentences.delete(e.target.dataset.id);
        if(e.target.dataset.a==='select-mark')e.target.checked?R.selectedMarks.add(e.target.dataset.id):R.selectedMarks.delete(e.target.dataset.id);
        if(e.target.dataset.a==='select-all-marks'){e.target.checked?R.pending.forEach(x=>R.selectedMarks.add(x.mark_id)):R.pending.forEach(x=>R.selectedMarks.delete(x.mark_id));render();}
        if(e.target.dataset.a==='pending-book'||e.target.dataset.a==='pending-type'){if(e.target.dataset.a==='pending-book'){R.scopeBookId=e.target.value;R.scopeSectionId='';}else R.markFilter=e.target.value;await pendingView();}
        if(e.target.dataset.a==='vocab-export-sel'){R.vocabExportSel=e.target.value;paintVocab();return;}
        if(e.target.dataset.a==='vocab-export-start'){R.vocabStart=e.target.value;paintVocab();return;}
        if(e.target.dataset.a==='vocab-export-end'){R.vocabEnd=e.target.value;paintVocab();return;}
        if(e.target.dataset.a==='vocab-select'){const id=e.target.dataset.id;if(e.target.checked)R.vocabSelected.add(id);else R.vocabSelected.delete(id);paintVocab();return;}
        if(e.target.dataset.a==='vocab-round-filter'){const n=Number(e.target.dataset.round);if(!ROUNDS.includes(n))return;const oldItems=memorizeItems(),oldIndex=R.vocabIndex;if(e.target.checked)R.vocabRounds.add(n);else R.vocabRounds.delete(n);const items=memorizeItems();R.vocabIndex=nearestVocabIndex(oldItems,oldIndex,items);R.vocabFlipped=false;paintVocab();}
      });
      R.root.addEventListener('input',e=>{if(e.target.id==='br-vocab-query'){clearTimeout(R.searchTimer);R.searchTimer=setTimeout(()=>renderVocab().catch(err),250);}});
      R.root.addEventListener('keydown',e=>{
        if(R.vocabView!=='memorize')return;
        if(e.target.closest('input,textarea,select,button,a'))return;
        if(e.key===' '||e.key==='Spacebar'){e.preventDefault();flipVocabCard();}
        else if(e.key==='ArrowLeft'){e.preventDefault();moveVocab(-1);}
        else if(e.key==='ArrowRight'){e.preventDefault();moveVocab(1);}
      });
      R.root.addEventListener('contextmenu',async e=>{
        const token=e.target.closest('.br-token');if(token){e.preventDefault();try{await tokenContext(token);}catch(ex){err(ex);}return;}
        const invalid=e.target.closest('.br-placeholder');if(invalid){e.preventDefault();const action=prompt('报错占位操作：1 查看原因与原始 JSON，2 编辑修复，3 删除，4 移动到其他层级');if(action==='1')alert(`${invalid.querySelector('p')?.textContent||''}\n${invalid.querySelector('pre')?.textContent||''}`);if(action==='2')invalid.querySelector('[data-a="repair-placeholder"]')?.click();if(action==='3')invalid.querySelector('[data-a="delete-placeholder"]')?.click();if(action==='4'){const sections=await allSections(R.book.book_id);const choice=prompt(`输入目标层级序号：\n${sections.map((x,i)=>`${i+1}. ${x.name}`).join('\n')}`);const destination=sections[Number(choice)-1]?.id;if(destination){try{await api(`/api/plugin/book_reader/reader/placeholders/${invalid.dataset.placeholder}`,'PATCH',{section_id:destination});await loadSection();}catch(ex){err(ex);}}}return;}
        const row=e.target.closest('.br-sentence');if(row){e.preventDefault();const action=prompt('句子操作：1 编辑，2 删除，3 移动到层级');if(action==='1')R.root.querySelector(`[data-a="edit-sentence"][data-id="${row.dataset.sentence}"]`)?.click();if(action==='2')R.root.querySelector(`[data-a="delete-sentence"][data-id="${row.dataset.sentence}"]`)?.click();if(action==='3'){const sections=await allSections(R.book.book_id);const choice=prompt(`输入目标层级序号：\n${sections.map((x,i)=>`${i+1}. ${x.name}`).join('\n')}`);const destination=sections[Number(choice)-1]?.id;if(destination){try{await api(`/api/plugin/book_reader/reader/sentences/${row.dataset.sentence}`,'PATCH',{section_id:destination});await loadSection();}catch(ex){err(ex);}}}}
      });
      R.root.addEventListener('dragstart',e=>{const row=e.target.closest('.br-sentence,.br-placeholder');if(row)e.dataTransfer.setData('text/plain',row.dataset.sentence?`sentence:${row.dataset.sentence}`:`placeholder:${row.dataset.placeholder}`);});
      R.root.addEventListener('dragover',e=>{if(e.target.closest('.br-sentence,.br-placeholder'))e.preventDefault();});
      R.root.addEventListener('drop',async e=>{const target=e.target.closest('.br-sentence,.br-placeholder'),value=e.dataTransfer.getData('text/plain');if(!target||!value)return;e.preventDefault();try{const [kind,id]=value.split(':');const targetSentence=target.closest('.br-sentence'),targetSection=target.dataset.section||targetSentence?.dataset.section,targetOrder=Number(target.dataset.order);if(kind==='placeholder'){if(id===target.dataset.placeholder)return;await api(`/api/plugin/book_reader/reader/placeholders/${id}`,'PATCH',{section_id:targetSection,order_index:targetOrder});}else{const source=(R.section?.sentences||[]).concat(R.fullSentences||[]).find(x=>x.sentence_id===id);if(!source||id===target.dataset.sentence)return;if(targetSentence&&source.section_id===targetSection){const rows=(R.mode==='full'?R.fullSentences:R.section.sentences).filter(x=>x.section_id===source.section_id);const ids=rows.map(x=>x.sentence_id),from=ids.indexOf(id),to=ids.indexOf(target.dataset.sentence);ids.splice(to,0,ids.splice(from,1)[0]);await api(`/api/plugin/book_reader/reader/sections/${source.section_id}/reorder`,'POST',{sentence_ids:ids});}else await api(`/api/plugin/book_reader/reader/sentences/${id}`,'PATCH',{section_id:targetSection,order_index:targetOrder});}await loadSection();}catch(ex){err(ex);}});
    }
    initBookReader().catch(err);
  }
  window.__toolRenderers['book-reader']=renderTool;
})();

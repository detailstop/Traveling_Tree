/* CSS 动效组件库（css_exp）：iframe 托管 AWA UI 静态产物 + 收藏当前组件 + 我的收藏。
   文档用宿主静态路由（/plugins/css_exp/static/app/...）加载；页面内资源走
   /api/plugin/css_exp/app/... 兜底（子资源不受 Content-Disposition 影响）。
   同源读取 iframe DOM：外部项目为可信 MIT 开源代码，未做严格沙箱隔离（见 README）。 */
(function () {
  'use strict';

  const TOOL_ID = 'css_exp';
  const API = '/api/plugin/css_exp';
  const APP_API = API + '/app/';
  const APP_STATIC = '/plugins/css_exp/static/app/';
  const HOME_URL = APP_STATIC + 'index.html';
  const INTERACTIVE = ['buttons', 'inputs', 'checkboxes', 'switches'];

  const S = { view: 'browse', items: [], current: { type: '', slug: '' } };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function toastSafe(msg, kind) {
    try { toast(msg, kind); } catch (e) { /* 宿主 toast 不可用时忽略 */ }
  }

  function parseLocation(href) {
    let pathname = '';
    try {
      pathname = new URL(String(href || ''), location.origin).pathname;
    } catch (e) {
      return { type: '', slug: '' };
    }
    let path = '';
    if (pathname.indexOf(APP_STATIC) === 0) path = pathname.slice(APP_STATIC.length);
    else if (pathname.indexOf(APP_API) === 0) path = pathname.slice(APP_API.length);
    else return { type: '', slug: '' };
    const parts = path.split('/').filter(Boolean);
    if (parts.length && parts[parts.length - 1] === 'index.html') parts.pop();
    // 只接受「分类」或「分类/组件」两层；_next 等内部路径不当作详情页
    if (!parts.length || parts.length > 2 || parts[0].charAt(0) === '_') {
      return { type: '', slug: '' };
    }
    return { type: parts[0], slug: parts[1] || '' };
  }

  function appPathToStatic(rest) {
    let target = String(rest || '');
    if (!target || target.endsWith('/')) target += 'index.html';
    else if (!/\.[A-Za-z0-9]+$/.test(target)) target += '/index.html';
    return APP_STATIC + target;
  }

  function toStatic(url) {
    const s = String(url || '');
    if (s.indexOf(APP_API) === 0) return appPathToStatic(s.slice(APP_API.length));
    return s;
  }

  function frameEl() { return document.getElementById('cx-frame'); }

  function currentHref() {
    const frame = frameEl();
    if (!frame) return '';
    try { return frame.contentWindow.location.href || ''; } catch (e) { return ''; }
  }

  function updateStatus() {
    const href = currentHref();
    const cur = parseLocation(href);
    S.current = cur;
    const status = document.getElementById('cx-status');
    if (status) {
      if (cur.slug) status.textContent = '组件：' + cur.slug + ' · 分类：' + cur.type;
      else if (cur.type) status.textContent = '分类：' + cur.type;
      else status.textContent = '首页';
    }
    const btn = document.getElementById('cx-capture');
    if (btn) {
      btn.disabled = !cur.slug;
      btn.title = cur.slug ? '把当前组件的标题/作者/CSS/HTML 收藏到本机库'
        : '请进入组件详情页后再收藏';
    }
  }

  /* 拦截 iframe 内点击：链接统一走宿主静态路由，避免二进制响应被浏览器当成下载；
     卡片（div onClick + router.push）改为整页导航，保持与外部项目一致的浏览路径。 */
  function onDocClick(ev) {
    const target = ev.target;
    if (!target || !target.closest) return;
    const anchor = target.closest('a[href]');
    if (anchor) {
      const href = anchor.getAttribute('href') || '';
      if (href.indexOf(APP_API) === 0) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        const frame = frameEl();
        if (frame) frame.src = appPathToStatic(href.slice(APP_API.length));
      }
      return;
    }
    const card = target.closest('[class*="card__wrap"]');
    if (!card) return;
    const slugEl = card.querySelector('[id]');
    if (!slugEl || !slugEl.id) return;
    const inPreview = slugEl.contains(target);
    const type = S.current.type;
    if (inPreview && INTERACTIVE.indexOf(type) >= 0) return; // 交互类组件保留内部点击
    if (!type) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
    const frame = frameEl();
    if (frame) frame.src = APP_STATIC + type + '/' + slugEl.id + '/index.html';
  }

  function bindFrame() {
    const frame = frameEl();
    if (!frame) return;
    let doc = null;
    try { doc = frame.contentDocument; } catch (e) { return; }
    if (!doc) return;
    if (doc.__cxBound === true) return;
    doc.__cxBound = true;
    doc.addEventListener('click', onDocClick, true);
  }

  function onFrameLoad() {
    bindFrame();
    updateStatus();
  }

  async function capture() {
    const frame = frameEl();
    const cur = S.current;
    if (!cur.slug) { toastSafe('请进入组件详情页后再收藏', 'warn'); return; }
    let doc = null;
    try { doc = frame && frame.contentDocument; } catch (e) { doc = null; }
    if (!doc) { toastSafe('无法读取 iframe 内容，请刷新后重试', 'warn'); return; }
    const cssEl = doc.querySelector('pre.language-css');
    const htmlEl = doc.querySelector('pre.language-html');
    if (!cssEl || !htmlEl) {
      toastSafe('未找到 CSS/HTML 代码块（外部页面结构可能已变化）', 'warn');
      return;
    }
    const css = cssEl.textContent || '';
    const html = htmlEl.textContent || '';
    if (!css.trim() || !html.trim()) {
      toastSafe('抓到的代码为空，已取消收藏', 'warn');
      return;
    }
    let madeBy = '';
    let title = cur.slug;
    const titleEl = doc.querySelector('article [class*="content__title"]');
    if (titleEl) {
      const raw = (titleEl.textContent || '').replace(/\s+/g, ' ').trim();
      const at = raw.lastIndexOf(' @ ');
      if (at > 0) {
        madeBy = raw.slice(0, at).trim();
        title = raw.slice(at + 3).trim() || title;
      } else if (raw) {
        title = raw;
      }
    }
    const payload = {
      title: title,
      category: cur.type,
      made_by: madeBy,
      css: css,
      html: html,
      source_url: APP_API + cur.type + '/' + cur.slug + '/',
    };
    try {
      await api(API + '/favorites', { body: payload });
      toastSafe('已收藏「' + title + '」', 'success');
      if (S.view === 'mine') loadList();
    } catch (e) {
      const code = e && e.message;
      if (code === 'FAVORITE_DUPLICATE') toastSafe('该组件已收藏', 'warn');
      else toastSafe('收藏失败：' + (code || '未知错误'), 'warn');
    }
  }

  async function loadList() {
    try {
      const r = await api(API + '/favorites?t=' + Date.now());
      S.items = (r && r.items) || [];
    } catch (e) {
      S.items = [];
      toastSafe('收藏列表加载失败：' + (e && e.message), 'warn');
    }
    drawList();
  }

  function drawList() {
    const box = document.getElementById('cx-list');
    const count = document.getElementById('cx-count');
    if (count) count.textContent = S.items.length ? S.items.length + ' 条' : '';
    if (!box) return;
    if (!S.items.length) {
      box.innerHTML = '<div class="cx-empty">还没有收藏。进入组件详情页后点「⭐ 收藏当前组件」。</div>';
      return;
    }
    box.innerHTML = S.items.map(it => `<div class="cx-fav" data-id="${esc(it.id)}">
      <div class="cx-fav-main">
        <b>${esc(it.title)}</b>
        <span class="cx-tag">${esc(it.category)}</span>
        ${it.made_by ? `<span class="cx-by">@${esc(it.made_by)}</span>` : ''}
        <span class="cx-time">${esc(String(it.created_at || '').slice(0, 19).replace('T', ' '))}</span>
      </div>
      <div class="cx-fav-ops">
        <button class="btn sm soft" data-preview="${esc(it.id)}">预览</button>
        <a class="btn sm soft" href="${esc(toStatic(it.source_url))}" target="_blank" rel="noopener">打开来源</a>
        <button class="btn sm soft" data-del="${esc(it.id)}">删除</button>
      </div>
    </div>`).join('');
    box.querySelectorAll('[data-preview]').forEach(btn => {
      btn.onclick = () => preview(btn.dataset.preview);
    });
    box.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = () => remove(btn.dataset.del);
    });
  }

  function preview(id) {
    const item = S.items.find(x => x.id === id);
    if (!item) return;
    const overlay = document.createElement('div');
    overlay.className = 'cx-overlay';
    overlay.innerHTML = `<div class="cx-preview">
      <div class="cx-preview-head"><b>${esc(item.title)}</b>
        <span class="cx-tag">${esc(item.category)}</span>
        ${item.made_by ? `<span class="cx-by">@${esc(item.made_by)}</span>` : ''}
        <button class="mini-btn" data-close="1" title="关闭">✕</button></div>
      <iframe class="cx-preview-frame" sandbox="allow-scripts" title="收藏预览"></iframe>
    </div>`;
    const frame = overlay.querySelector('iframe');
    frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8">'
      + '<style>html,body{margin:0;min-height:100%;}body{display:flex;align-items:center;'
      + 'justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;'
      + 'background:#fff;}</style>'
      + '<style>' + item.css + '</style></head><body>' + item.html + '</body></html>';
    overlay.querySelector('[data-close]').onclick = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  async function remove(id) {
    const item = S.items.find(x => x.id === id);
    if (!window.confirm('删除收藏「' + ((item && item.title) || id) + '」？')) return;
    try {
      await api(API + '/favorites/' + encodeURIComponent(id), { method: 'DELETE' });
      toastSafe('已删除', 'success');
      await loadList();
    } catch (e) {
      toastSafe('删除失败：' + (e && e.message), 'warn');
    }
  }

  function showView(view) {
    S.view = view === 'mine' ? 'mine' : 'browse';
    const frame = frameEl();
    const mine = document.getElementById('cx-mine-view');
    if (frame) frame.hidden = S.view !== 'browse';
    if (mine) mine.hidden = S.view !== 'mine';
    if (S.view === 'mine') loadList();
  }

  function render() {
    const box = document.querySelector('#tool-view');
    if (!box) return;
    box.innerHTML = `<div class="cx-shell">
      <div class="cx-bar">
        <span class="cx-brand"><span class="st-emoji">🎨</span>CSS 动效组件库</span>
        <span class="cx-status" id="cx-status">加载中…</span>
        <span class="cx-ops">
          <button class="btn sm soft" id="cx-refresh">🔄 刷新</button>
          <button class="btn sm" id="cx-capture" disabled title="请进入组件详情页后再收藏">⭐ 收藏当前组件</button>
          <button class="btn sm soft" id="cx-mine-btn">📚 我的收藏</button>
        </span>
      </div>
      <div class="cx-body">
        <iframe id="cx-frame" class="cx-frame" title="AWA UI 组件库"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          src="${HOME_URL}"></iframe>
        <div class="cx-mine" id="cx-mine-view" hidden>
          <div class="cx-mine-head"><b>我的收藏</b><span class="cx-count" id="cx-count"></span></div>
          <div class="cx-list" id="cx-list"></div>
        </div>
      </div>
    </div>`;

    frameEl().addEventListener('load', onFrameLoad);
    document.getElementById('cx-refresh').onclick = () => {
      showView('browse');
      frameEl().src = HOME_URL;
      updateStatus();
    };
    document.getElementById('cx-capture').onclick = capture;
    document.getElementById('cx-mine-btn').onclick = () => {
      showView(S.view === 'mine' ? 'browse' : 'mine');
    };
    updateStatus();
    bindFrame();
  }

  window.__toolRenderers = window.__toolRenderers || {};
  window.__toolRenderers['css-exp'] = render;
  window.__toolRenderers[TOOL_ID] = render;
})();

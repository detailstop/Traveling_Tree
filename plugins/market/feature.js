/* 插件市场：本地包浏览/搜索/过滤/安装/卸载。无框架，挂到 window.__toolRenderers.market。 */
(function () {
  'use strict';
  let STATE = { items: [], search: '', kind: '', expanded: null, busy: false };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
  function fmtSize(n) {
    const v = Number(n) || 0;
    if (!v) return '—';
    if (v < 1024) return v + ' B';
    if (v < 1024 * 1024) return (v / 1024).toFixed(1) + ' KB';
    return (v / 1024 / 1024).toFixed(1) + ' MB';
  }
  function kinds(items) {
    const set = new Set(items.map(x => x.kind || 'functional'));
    return Array.from(set).sort();
  }
  function filtered() {
    const q = STATE.search.trim().toLowerCase();
    return STATE.items.filter(it => {
      if (STATE.kind && (it.kind || 'functional') !== STATE.kind) return false;
      if (!q) return true;
      return [it.id, it.name, it.desc].join(' ').toLowerCase().includes(q);
    });
  }

  async function loadList() {
    const r = await api('/api/plugin/market/list');
    STATE.items = r.plugins || [];
  }

  function cardHTML(it) {
    const installed = !!it.installed;
    const preset = !!it.preset;
    const expanded = STATE.expanded === it.id;
    const status = preset ? '<span class="mk-badge preset">预置</span>'
      : installed ? '<span class="mk-badge on">已安装</span>'
      : '<span class="mk-badge off">未安装</span>';
    let actions = '';
    if (!installed && it.package) {
      actions = `<button class="btn sm" data-install="${esc(it.id)}" ${STATE.busy ? 'disabled' : ''}>安装</button>`;
    } else if (installed && !preset) {
      actions = `<button class="btn soft sm" data-uninstall="${esc(it.id)}" ${STATE.busy ? 'disabled' : ''}>卸载</button>`;
    } else if (preset) {
      actions = `<span class="mk-hint">内置，不可卸载</span>`;
    } else if (!installed && !it.package) {
      actions = `<span class="mk-hint">无本地包</span>`;
    }
    return `<div class="mk-card${expanded ? ' open' : ''}" data-id="${esc(it.id)}">
      <div class="mk-head" data-toggle="${esc(it.id)}">
        <span class="mk-icon">${esc(it.icon || '🧩')}</span>
        <span class="mk-title"><b>${esc(it.name)}</b><i>${esc(it.desc)}</i></span>
        <span class="mk-meta">${status}<span class="mk-kind">${esc(it.kind || 'functional')}</span></span>
      </div>
      <div class="mk-actions">${actions}</div>
      ${expanded ? `<div class="mk-detail">
        <div class="mk-desc">${esc(it.desc || '（无简介）')}</div>
        <div class="mk-grid">
          <span>版本</span><b>${esc(it.version || '—')}</b>
          <span>包大小</span><b>${fmtSize(it.size)}</b>
          <span>SHA256</span><b class="mono">${esc((it.sha256 || '').slice(0, 8) || '—')}</b>
          <span>来源</span><b>${esc(it.source || 'local')}</b>
        </div>
        ${(!preset && installed) ? `<label class="mk-danger"><input type="checkbox" data-deldata="${esc(it.id)}"> 同时删除私有数据目录（默认保留）</label>` : ''}
      </div>` : ''}
    </div>`;
  }

  function render(container) {
    const host = container || document.querySelector('#nav-view');
    if (!host) return;
    host.innerHTML = `<div class="mk-wrap">
      <div class="mk-toolbar">
        <input id="mk-search" class="mk-search" placeholder="搜索插件名称 / 简介 / id" value="${esc(STATE.search)}">
        <select id="mk-kind" class="mk-kind-sel"><option value="">全部类型</option></select>
        <span id="mk-count" class="mk-count"></span>
      </div>
      <div id="mk-grid" class="mk-grid"></div>
    </div>`;
    const draw = () => {
      const list = filtered();
      const sel = host.querySelector('#mk-kind');
      const cur = STATE.kind;
      sel.innerHTML = '<option value="">全部类型</option>' + kinds(STATE.items)
        .map(k => `<option value="${esc(k)}"${k === cur ? ' selected' : ''}>${esc(k)}</option>`).join('');
      host.querySelector('#mk-count').textContent = `${list.length} / ${STATE.items.length}`;
      const grid = host.querySelector('#mk-grid');
      grid.innerHTML = list.length ? list.map(cardHTML).join('')
        : '<div class="mk-empty">没有匹配的插件</div>';
      bind();
    };
    const refresh = async () => {
      try { await loadList(); draw(); }
      catch (e) { toast('市场加载失败：' + e.message, 'error'); }
    };
    function bind() {
      host.querySelectorAll('[data-toggle]').forEach(el => {
        el.onclick = () => {
          const id = el.dataset.toggle;
          STATE.expanded = STATE.expanded === id ? null : id;
          draw();
        };
      });
      host.querySelectorAll('[data-install]').forEach(el => {
        el.onclick = async () => {
          STATE.busy = true; draw();
          try {
            const r = await api('/api/plugin/market/install', { body: { id: el.dataset.install } });
            if (!r.ok) throw new Error(r.message || r.error);
            toast(r.message || '安装完成', 'success');
          } catch (e) { toast('安装失败：' + e.message, 'error'); }
          STATE.busy = false; await refresh();
        };
      });
      host.querySelectorAll('[data-uninstall]').forEach(el => {
        el.onclick = async () => {
          const id = el.dataset.uninstall;
          const box = host.querySelector(`[data-deldata="${id}"]`);
          const del = !!(box && box.checked);
          if (del && !window.confirm('将备份并删除 data/plugins/' + id + '/，确认继续？')) return;
          if (!window.confirm('卸载 ' + id + '？重启服务后生效。')) return;
          STATE.busy = true; draw();
          try {
            const r = await api('/api/plugin/market/uninstall', { body: { id, delete_data: del } });
            if (!r.ok) throw new Error(r.message || r.error);
            toast(r.message || '卸载完成', 'success');
          } catch (e) { toast('卸载失败：' + e.message, 'error'); }
          STATE.busy = false; await refresh();
        };
      });
    }
    host.querySelector('#mk-search').oninput = e => { STATE.search = e.target.value; draw(); };
    host.querySelector('#mk-kind').onchange = e => { STATE.kind = e.target.value; draw(); };
    refresh();
  }

  window.__toolRenderers = window.__toolRenderers || {};
  window.__toolRenderers.market = render;
})();

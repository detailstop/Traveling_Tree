'use strict';
/* 按需加载的功能模块：urlarch（网址归档） */
(function () {
let uaState = null;
// 单组折叠状态：只存在页面会话内存（刷新后恢复默认展开），不写 localStorage。
const uaCollapsedGroups = new Set();
const UA_DEFAULT_GROUP = 'ungrouped';
function uaDefaultGroup() {
  return { id: UA_DEFAULT_GROUP, name: '未分组', type: 'normal', order: 0 };
}
function uaNewGroupId() {
  return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
async function uaFetch() {
  let raw = null;
  try { const d = await api('/api/plugin/urlarch/state'); raw = d && d.state; } catch (e) { raw = null; }
  // 旧数组格式：仅内存兼容为默认组，不在本版做迁移备份（当前通常无旧数据）。
  if (Array.isArray(raw)) {
    return {
      groups: [uaDefaultGroup()],
      items: raw.filter(x => x && x.url).map(x => ({
        title: String(x.title || ''), url: String(x.url || ''), note: String(x.note || ''),
        ts: String(x.ts || new Date().toISOString()), groupId: UA_DEFAULT_GROUP,
      })),
      launchInterval: 5,
    };
  }
  const empty = { groups: [uaDefaultGroup()], items: [], launchInterval: 5 };
  if (!raw || !Array.isArray(raw.groups) || !Array.isArray(raw.items)) return empty;
  const groups = raw.groups.filter(g => g && typeof g.id === 'string' && typeof g.name === 'string')
    .map((g, i) => ({
      id: g.id,
      name: String(g.name || '未命名').trim() || '未命名',
      type: g.type === 'functional' ? 'functional' : 'normal',
      order: Number.isFinite(Number(g.order)) ? Number(g.order) : i,
    }));
  if (!groups.some(g => g.id === UA_DEFAULT_GROUP)) groups.unshift(uaDefaultGroup());
  groups.sort((a, b) => a.order - b.order);
  const ids = new Set(groups.map(g => g.id));
  const items = raw.items.filter(x => x && x.url).map(x => ({
    title: String(x.title || ''), url: String(x.url || ''), note: String(x.note || ''),
    ts: String(x.ts || new Date().toISOString()),
    groupId: ids.has(x.groupId) ? x.groupId : UA_DEFAULT_GROUP,
  }));
  const interval = raw.launchInterval;
  // 0 = 同时打开；旧数据缺省/非法值（含 null、空串、字符串）仍回退 5。
  const launchInterval = typeof interval === 'number' && Number.isInteger(interval)
    && interval >= 0 && interval <= 30 ? interval : 5;
  return { groups, items, launchInterval };
}
function uaLoad() { return uaState; }
function uaSave(state) {
  uaState = state;
  api('/api/plugin/urlarch/state', { method: 'PUT', body: { state } }).catch(() => {});
}

async function renderUrlArchTool() {
  const box = $('#tool-view');
  try { uaState = await uaFetch(); }
  catch (e) { box.innerHTML = emptyHTML('⚠️', '网址库加载失败', esc(e.message)); return; }
  box.innerHTML = `
    <div class="gcard" style="margin-bottom:14px;">
      <div class="section-title"><span class="st-emoji">🔖</span>网址归档
        <span style="font-size:12px;color:var(--text-dim);font-weight:400;">本地归档 · 组别 · 拖拽 · 导出 JSON · 爬虫后续接入</span>
        <button class="btn sm" id="ua-export" style="margin-left:auto;">📤 导出 JSON</button>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
        <input class="input" id="ua-title" placeholder="标题，如：国家统计局 PMI 数据页" style="flex:2;min-width:160px;">
        <input class="input" id="ua-url" placeholder="网址 https://…" style="flex:3;min-width:220px;">
        <input class="input" id="ua-note" placeholder="备注（可选）" style="flex:2;min-width:140px;">
        <select class="input" id="ua-group" style="flex:1;min-width:120px;"></select>
        <button class="btn" id="ua-add">＋ 归档</button>
      </div>
      <div class="ua-group-create">
        <input class="input" id="ua-newgroup" placeholder="新组别名" style="flex:2;min-width:160px;">
        <select class="input" id="ua-newtype" style="flex:1;min-width:120px;"><option value="normal">普通组</option><option value="functional">功能性组</option></select>
        <button class="btn soft" id="ua-addgroup">＋ 新建组别</button>
      </div>
      <div style="font-size:12px;color:var(--text-dim);margin-top:6px;">共 <span id="ua-count">0</span> 条 · 数据保存在本机 SQLite · 功能性组可一键启动组内全部网址</div>
      <div class="ua-global-row">
        <label>⏱ 一键启动间隔 <input class="input" id="ua-interval" type="number" min="0" max="30" step="1" value="5" style="width:68px;padding:5px 7px;"> 秒</label>
        <span>0 = 同一批同时尝试打开；1–30 = 首个立即、其余每隔 n 秒；仅接受 0–30 的整数</span>
      </div>
    </div>
    <div class="gcard">
      <div class="section-title"><span class="st-emoji">📚</span>归档列表</div>
      <div id="ua-list" style="min-height:40px;"></div>
    </div>`;
  const listBox = $('#ua-list');
  let blocked = {};
  const uaLaunching = {};
  // 折叠只切换内存 Set + 现有 DOM 的 class，不整表重绘（避免丢输入焦点与拖拽态）。
  const applyGroupCollapse = () => {
    listBox.querySelectorAll('.ua-group').forEach(sec => {
      const folded = uaCollapsedGroups.has(sec.dataset.gid);
      sec.classList.toggle('collapsed', folded);
      const caret = sec.querySelector('.ua-caret');
      if (!caret) return;
      caret.setAttribute('aria-expanded', folded ? 'false' : 'true');
      caret.setAttribute('aria-label', folded ? '展开组别' : '收起组别');
      caret.title = folded ? '展开' : '收起';
    });
  };
  const toggleGroupCollapse = gid => {
    if (!gid) return;
    if (uaCollapsedGroups.has(gid)) uaCollapsedGroups.delete(gid);
    else uaCollapsedGroups.add(gid);
    applyGroupCollapse();
  };
  const draw = () => {
    const state = uaLoad();
    $('#ua-count').textContent = state.items.length;
    const iv = $('#ua-interval');
    if (iv && document.activeElement !== iv) iv.value = state.launchInterval;
    const sel = $('#ua-group');
    if (sel) {
      const cur = sel.value;
      sel.innerHTML = state.groups.map(g => `<option value="${esc(g.id)}">${esc(g.name)}${g.type === 'functional' ? ' · 功能性' : ''}</option>`).join('');
      if (state.groups.some(g => g.id === cur)) sel.value = cur;
    }
    if (!state.items.length) {
      listBox.innerHTML = state.groups.map(g => uaGroupHTML(state, g, [], blocked)).join('');
    } else {
      listBox.innerHTML = state.groups.map(g => {
        const rows = state.items.map((it, idx) => ({ it, idx })).filter(x => x.it.groupId === g.id);
        return uaGroupHTML(state, g, rows, blocked);
      }).join('');
    }
    applyGroupCollapse();
    bindList();
  };
  const uaGroupHTML = (state, g, rows, blockedMap) => {
    const folded = uaCollapsedGroups.has(g.id);
    const items = rows.map(({ it, idx }) => `
      <div class="ua-item" draggable="true" data-idx="${idx}">
        <a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer" draggable="false">${esc(it.title || it.url)}</a>
        <span class="ua-item-url">${esc(it.url)}${it.note ? ' · ' + esc(it.note) : ''}</span>
        <span class="ua-item-ts">${esc((it.ts || '').slice(5, 16))}</span>
        <button class="btn sm soft" data-delitem="${idx}" title="删除">✕</button>
      </div>`).join('');
    const bl = (blockedMap && blockedMap[g.id]) || [];
    const blHTML = bl.length ? `<div class="ua-blocked"><b>以下网址被浏览器拦截，请逐个点击；将网址加入浏览器白名单后通常不再拦截：</b>${bl.map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title || x.url)}${x.title ? ' · ' + esc(x.url) : ''}</a>`).join('')}</div>` : '';
    const launching = uaLaunching[g.id];
    const launchBtn = launching
      ? `<button class="btn sm soft" data-launch="${esc(g.id)}" disabled>启动中 ${launching.done}/${launching.total}…</button>`
      : `<button class="btn sm soft" data-launch="${esc(g.id)}">▶ 一键启动</button>`;
    return `<section class="ua-group${folded ? ' collapsed' : ''}" data-gid="${esc(g.id)}">
      <div class="ua-group-head" data-grouphead="${esc(g.id)}">
        <button type="button" class="ua-caret" data-group-toggle="${esc(g.id)}" aria-expanded="${folded ? 'false' : 'true'}" aria-label="${folded ? '展开组别' : '收起组别'}" title="${folded ? '展开' : '收起'}">▾</button>
        <b>${esc(g.name)}</b><span class="ua-type ${g.type}">${g.type === 'functional' ? '功能性' : '普通'}</span>
        <span class="ua-count">${rows.length} 条</span>
        ${g.type === 'functional' ? `${launchBtn}<span class="ua-whitelist">可把本站加入浏览器弹窗白名单；加入后通常不再拦截</span>` : ''}
        <span class="ua-group-ops">
          <button class="mini-btn" data-rename="${esc(g.id)}" title="重命名">✏️</button>
          <button class="mini-btn danger" data-delgroup="${esc(g.id)}" title="删除空组" ${g.id === UA_DEFAULT_GROUP ? 'disabled' : ''}>🗑️</button>
        </span>
      </div>
      <div class="ua-items" data-drop="${esc(g.id)}">${items || '<div class="ua-empty">拖拽网址到此组…</div>'}</div>
      ${blHTML}
    </section>`;
  };
  const bindList = () => {
    listBox.querySelectorAll('[data-group-toggle]').forEach(btn => btn.onclick = e => {
      e.stopPropagation();
      toggleGroupCollapse(btn.dataset.groupToggle);
    });
    // 点标题栏任意空白处也可切换；组内按钮/链接保持原行为。
    listBox.querySelectorAll('[data-grouphead]').forEach(head => head.onclick = e => {
      if (e.target.closest('button,a,input,select,textarea,label')) return;
      toggleGroupCollapse(head.dataset.grouphead);
    });
    listBox.querySelectorAll('[data-delitem]').forEach(btn => btn.onclick = () => {
      const state = uaLoad();
      state.items.splice(Number(btn.dataset.delitem), 1);
      uaSave(state); draw();
    });
    listBox.querySelectorAll('[data-rename]').forEach(btn => btn.onclick = () => {
      const state = uaLoad();
      const g = state.groups.find(x => x.id === btn.dataset.rename);
      if (!g) return;
      const name = prompt('重命名组别', g.name);
      if (name === null) return;
      const text = String(name).trim();
      if (!text) { toast('组别名不能为空', 'warn'); return; }
      g.name = text; uaSave(state); draw();
    });
    listBox.querySelectorAll('[data-delgroup]').forEach(btn => btn.onclick = () => {
      const state = uaLoad();
      const gid = btn.dataset.delgroup;
      const g = state.groups.find(x => x.id === gid);
      if (!g) return;
      if (gid === UA_DEFAULT_GROUP) { toast('默认「未分组」不可删除', 'warn'); return; }
      if (state.items.some(x => x.groupId === gid)) { toast('仅能删除空组；请先移走或删除组内网址', 'warn'); return; }
      if (!confirm(`删除空组「${g.name}」？`)) return;
      state.groups = state.groups.filter(x => x.id !== gid);
      uaSave(state); draw();
    });
    listBox.querySelectorAll('[data-launch]').forEach(btn => btn.onclick = () => launchGroup(btn.dataset.launch));
    listBox.querySelectorAll('.ua-item[draggable]').forEach(row => {
      row.ondragstart = e => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', row.dataset.idx);
      };
    });
    listBox.querySelectorAll('[data-drop]').forEach(zone => {
      zone.ondragover = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; zone.classList.add('dragover'); };
      zone.ondragleave = () => zone.classList.remove('dragover');
      zone.ondrop = e => {
        e.preventDefault(); zone.classList.remove('dragover');
        const idx = Number(e.dataTransfer.getData('text/plain'));
        if (!Number.isInteger(idx)) return;
        const state = uaLoad();
        if (!state.items[idx]) return;
        const gid = zone.dataset.drop;
        if (state.items[idx].groupId === gid) return;
        state.items[idx].groupId = gid;
        uaSave(state); draw();
        toast('已移动到「' + (state.groups.find(g => g.id === gid) || {}).name + '」✓', 'success');
      };
    });
  };
  const launchGroup = gid => {
    if (uaLaunching[gid]) { toast('该组正在按间隔启动中，请稍候…', 'info'); return; }
    const state = uaLoad();
    const g = state.groups.find(x => x.id === gid);
    if (!g || g.type !== 'functional') return;
    const items = state.items.filter(x => x.groupId === gid);
    if (!items.length) { toast('该功能性组暂无网址', 'warn'); return; }
    const rawInterval = Number(state.launchInterval);
    const interval = Number.isInteger(rawInterval) && rawInterval >= 0 && rawInterval <= 30 ? rawInterval : 5;
    let i = 0, opened = 0;
    const blockedItems = [];
    uaLaunching[gid] = { done: 0, total: items.length };
    draw();
    const updateBtn = () => {
      const btn = listBox.querySelector(`[data-launch="${gid}"]`);
      if (btn && uaLaunching[gid]) btn.textContent = `启动中 ${uaLaunching[gid].done}/${uaLaunching[gid].total}…`;
    };
    const finish = () => {
      delete uaLaunching[gid];
      if (blockedItems.length) {
        blocked = { ...blocked, [gid]: blockedItems };
        toast(`已成功打开 ${opened} 个，其余被浏览器拦截；可加入白名单后重试`, 'warn', 5200);
      } else {
        delete blocked[gid];
        toast(`已打开 ${opened} 个网址`, 'success');
      }
      draw();
    };
    const openOne = () => {
      const it = items[i];
      let w = null;
      try { w = window.open(it.url, '_blank'); } catch (e) { w = null; }
      if (w) {
        opened += 1;
        try { w.opener = null; } catch (e) { /* 忽略 */ }
      } else {
        blockedItems.push(it);
      }
      i += 1;
      if (uaLaunching[gid]) uaLaunching[gid].done = i;
      updateBtn();
    };
    const step = () => {
      if (!uaLaunching[gid]) return;
      openOne();
      if (i >= items.length) { finish(); return; }
      setTimeout(step, interval * 1000);
    };
    if (interval === 0) {
      // 0 秒：仍在本次点击的同步栈内连续调用 window.open，全部尝试，无定时器。
      while (i < items.length) openOne();
      finish();
    } else {
      step();
    }
  };
  const add = () => {
    const t = $('#ua-title').value.trim(), u = $('#ua-url').value.trim(), n = $('#ua-note').value.trim();
    if (!u) { toast('请填写网址', 'warn'); return; }
    const state = uaLoad();
    const gid = $('#ua-group').value || UA_DEFAULT_GROUP;
    state.items.push({ title: t, url: u, note: n, ts: new Date().toISOString(), groupId: state.groups.some(g => g.id === gid) ? gid : UA_DEFAULT_GROUP });
    uaSave(state);
    $('#ua-title').value = ''; $('#ua-url').value = ''; $('#ua-note').value = '';
    draw(); toast('已归档 ✓', 'success');
  };
  const addGroup = () => {
    const name = $('#ua-newgroup').value.trim();
    if (!name) { toast('请输入组别名', 'warn'); return; }
    const state = uaLoad();
    if (state.groups.some(g => g.name === name)) { toast('组别名已存在', 'warn'); return; }
    const maxOrder = state.groups.reduce((m, g) => Math.max(m, Number(g.order) || 0), 0);
    const type = $('#ua-newtype').value === 'functional' ? 'functional' : 'normal';
    state.groups.push({ id: uaNewGroupId(), name, type, order: maxOrder + 1 });
    uaSave(state);
    $('#ua-newgroup').value = '';
    draw(); toast(`已新建${type === 'functional' ? '功能性' : '普通'}组「${name}」✓`, 'success');
  };
  $('#ua-add').onclick = add;
  $('#ua-addgroup').onclick = addGroup;
  const intervalEl = $('#ua-interval');
  if (intervalEl) intervalEl.onchange = () => {
    const raw = String(intervalEl.value || '').trim();
    let n = raw === '' ? NaN : Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 30) {
      n = 5;
      toast('启动间隔需为 0–30 的整数，已回退为默认 5 秒', 'warn');
    }
    const state = uaLoad();
    state.launchInterval = n;
    uaSave(state);
    intervalEl.value = n;
    draw();
  };
  $('#ua-title').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#ua-url').focus(); } };
  $('#ua-url').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
  $('#ua-export').onclick = () => {
    const state = uaLoad();
    if (!state.items.length) { toast('暂无归档数据', 'warn'); return; }
    const rows = state.items.map(x => ({ title: x.title, url: x.url, note: x.note, ts: x.ts }));
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    window.rtDownloadBlob(blob, 'url_archive.json');
  };
  draw();
}

window.__toolRenderers.urlarch = renderUrlArchTool;
})();

'use strict';
/* 按需加载的功能模块：urlarch（网址归档） */
(function () {
let uaState = null;
// 单组折叠状态：只存在页面会话内存（刷新后恢复默认展开），不写 localStorage。
const uaCollapsedGroups = new Set();

/* ---------------- R4：软件快捷入口（点击启动，非键盘热键） ----------------
   白名单存 urlarch_shortcuts；页面内点击卡片 → POST /launch（只传 id）。
   这是页面内入口，不是操作系统桌面快捷方式，也不注册任何键盘监听。 */
const UA_ERR_TEXT = {
  SHORTCUT_NOT_FOUND: '白名单中找不到该软件（可能已被删除）',
  PATH_INVALID: '可执行路径无效或文件不存在',
  PATH_EXT_BLOCKED: '该扩展名（.bat/.lnk/.ps1 等）被禁止，请登记可执行程序本体',
  ARGS_INVALID: '参数不合法（后端仍校验历史 args，需 JSON 字符串数组且不含 ; && | 等字符）',
  NAME_INVALID: '名称不合法（1–64 字符）',
  GROUP_NOT_FOUND: '组别不存在（可能已被删除）',
  GROUP_NAME_INVALID: '组名不合法（1–64 字符）',
  GROUP_NAME_CONFLICT: '组名已存在，请换一个',
  SORT_ORDER_INVALID: '排序值不合法（需 -10000~10000 的整数）',
  INVALID_REQUEST: '请求缺少必要字段',
  LAUNCH_FAILED: '启动失败：进程创建被拒绝或系统报错',
  INTERNAL_ERROR: '后端内部错误，未启动',
  METHOD_NOT_ALLOWED: '请求方式不被支持',
  not_found: '接口不存在',
};
let uaShortcuts = [];
let uaShortcutGroups = [];
// 软件入口组别的折叠状态：仅页面会话内存（刷新恢复默认展开），多组互不影响。
const uaCollapsedShortcutGroups = new Set();
// 拖拽状态：仅内存；拖动结束后短暂抑制点击，避免“拖动结束误触发启动”。
let uaDraggingShortcutId = '';
let uaSuppressRowClickUntil = 0;
function uaShortcutHint(code) {
  return UA_ERR_TEXT[code] || ('操作失败：' + (code || '未知错误'));
}
async function uaFetchShortcuts() {
  try {
    // 加时间戳绕过宿主 api() 的 GET 缓存，保证 PATCH 后拿到服务端真实状态。
    const d = await api('/api/plugin/urlarch/shortcuts?t=' + Date.now());
    return Array.isArray(d && d.items) ? d.items : [];
  } catch (e) {
    return [];
  }
}
async function uaFetchShortcutGroups() {
  try {
    const d = await api('/api/plugin/urlarch/shortcut-groups?t=' + Date.now());
    return Array.isArray(d && d.items) ? d.items : [];
  } catch (e) {
    return [];
  }
}
// 宿主的 api() 在有 body 时会强制 POST，PATCH 只能直连 fetch；错误码仍按同一约定抛出。
async function uaPatch(path, body) {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* 非 JSON */ }
  if (!res.ok || (data && data.ok === false)) {
    throw new Error((data && data.error) || ('请求失败 ' + res.status));
  }
  return data;
}

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
    </div>
    <div class="gcard" id="ua-shortcut-card" style="margin-top:14px;">
      <div class="section-title"><span class="st-emoji">🚀</span>软件快捷入口
        <span style="font-size:12px;color:var(--text-dim);font-weight:400;">按组展示 · 点击列表行启动 · 白名单注册制 · 仅本机</span>
      </div>
      <div id="ua-sc-groups" class="ua-sg-list"></div>
      <div class="ua-sc-form">
        <input class="input" id="ua-sc-name" placeholder="名称，如：记事本" style="flex:2;min-width:120px;">
        <input class="input" id="ua-sc-path" placeholder="可执行文件绝对路径，如 C:/Program Files/App/app.exe" style="flex:3;min-width:220px;">
        <select class="input" id="ua-sc-group" style="flex:1;min-width:130px;"></select>
        <button class="btn" id="ua-sc-add">＋ 添加软件</button>
      </div>
      <div class="ua-sc-form">
        <input class="input" id="ua-sc-newgroup" placeholder="新建组名，如：写作工具" style="flex:2;min-width:160px;">
        <button class="btn soft" id="ua-sc-addgroup">＋ 新建组</button>
      </div>
      <div class="ua-sc-hint">只启动白名单内已登记的软件：点击列表行后请求 <code>POST /api/plugin/urlarch/launch</code>，入参只有 id；路径与参数由后端从白名单读取并再次校验，前端不能传路径或命令。这是页面内入口，不是系统桌面快捷方式，也不注册键盘快捷键。组别收起/展开只存页面会话内存，刷新恢复默认展开。</div>
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
  const launchShortcut = async id => {
    const item = uaShortcuts.find(x => x.id === id);
    try {
      const d = await api('/api/plugin/urlarch/launch', { method: 'POST', body: { id } });
      toast(`已启动「${(item && item.name) || (d && d.name) || '软件'}」`, 'success', 2400);
    } catch (err) {
      toast(uaShortcutHint(err && err.message), 'warn', 4600);
    }
  };
  const shortcutRowHTML = item => `
    <div class="ua-sc-row" data-sc-launch="${esc(item.id)}" draggable="true" role="button" tabindex="0" title="点击启动 ${esc(item.name)}；可拖到其他组">
      <span class="ua-sc-name">${esc(item.name)}</span>
      <span class="ua-sc-path">${esc(item.path)}</span>
      <button class="mini-btn danger ua-sc-del" data-sc-del="${esc(item.id)}" title="从白名单删除（不卸载软件）">✕</button>
    </div>`;
  const applyShortcutCollapse = () => {
    const box = $('#ua-sc-groups');
    if (!box) return;
    box.querySelectorAll('.ua-sg').forEach(sec => {
      const folded = uaCollapsedShortcutGroups.has(sec.dataset.sgid || '');
      sec.classList.toggle('collapsed', folded);
      const caret = sec.querySelector('.ua-caret');
      if (!caret) return;
      caret.setAttribute('aria-expanded', folded ? 'false' : 'true');
      caret.setAttribute('aria-label', folded ? '展开组别' : '收起组别');
      caret.title = folded ? '展开' : '收起';
    });
  };
  const toggleShortcutGroup = gid => {
    const key = gid || '';
    if (uaCollapsedShortcutGroups.has(key)) uaCollapsedShortcutGroups.delete(key);
    else uaCollapsedShortcutGroups.add(key);
    applyShortcutCollapse();
  };
  const renderShortcuts = () => {
    const box = $('#ua-sc-groups');
    if (!box) return;
    const groups = [{ id: '', name: '未分组', sort_order: -1 }, ...uaShortcutGroups];
    const sel = $('#ua-sc-group');
    if (sel) {
      const cur = sel.value;
      sel.innerHTML = groups.map(g => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('');
      if (groups.some(g => g.id === cur)) sel.value = cur;
    }
    box.innerHTML = groups.map((g, idx) => {
      const rows = uaShortcuts.filter(x => (x.group_id || '') === g.id);
      const folded = uaCollapsedShortcutGroups.has(g.id);
      const ops = g.id
        ? `<span class="ua-group-ops">
             <button class="mini-btn" data-sg-rename="${esc(g.id)}" title="重命名组">✏️</button>
             <button class="mini-btn" data-sg-up="${esc(g.id)}" title="上移" ${idx <= 1 ? 'disabled' : ''}>↑</button>
             <button class="mini-btn" data-sg-down="${esc(g.id)}" title="下移" ${idx >= groups.length - 1 ? 'disabled' : ''}>↓</button>
             <button class="mini-btn danger" data-sg-del="${esc(g.id)}" title="删除组（组内软件移到未分组）">🗑️</button>
           </span>`
        : '';
      return `<section class="ua-group ua-sg${folded ? ' collapsed' : ''}" data-sgid="${esc(g.id)}">
        <div class="ua-group-head" data-sghead="${esc(g.id)}">
          <button type="button" class="ua-caret" data-sg-toggle="${esc(g.id)}" aria-expanded="${folded ? 'false' : 'true'}" aria-label="${folded ? '展开组别' : '收起组别'}" title="${folded ? '展开' : '收起'}">▾</button>
          <b>${esc(g.name)}</b>
          <span class="ua-count">${rows.length} 项</span>
          ${ops}
        </div>
        <div class="ua-items ua-sg-items">${rows.map(shortcutRowHTML).join('') || '<div class="ua-empty">该组暂无软件</div>'}</div>
      </section>`;
    }).join('');
    box.querySelectorAll('[data-sg-toggle]').forEach(btn => btn.onclick = e => {
      e.stopPropagation();
      toggleShortcutGroup(btn.dataset.sgToggle);
    });
    // 点组标题栏空白处也可切换；组内按钮保持原行为。
    box.querySelectorAll('[data-sghead]').forEach(head => head.onclick = e => {
      if (e.target.closest('button,a,input,select,textarea,label')) return;
      toggleShortcutGroup(head.dataset.sghead);
    });
    box.querySelectorAll('[data-sg-rename]').forEach(btn => btn.onclick = () => renameShortcutGroup(btn.dataset.sgRename));
    box.querySelectorAll('[data-sg-up]').forEach(btn => btn.onclick = () => moveShortcutGroup(btn.dataset.sgUp, -1));
    box.querySelectorAll('[data-sg-down]').forEach(btn => btn.onclick = () => moveShortcutGroup(btn.dataset.sgDown, 1));
    box.querySelectorAll('[data-sg-del]').forEach(btn => btn.onclick = () => removeShortcutGroup(btn.dataset.sgDel));
    box.querySelectorAll('[data-sc-launch]').forEach(row => {
      row.onclick = e => {
        if (e.target.closest('[data-sc-del]')) return;
        if (Date.now() < uaSuppressRowClickUntil) return; // 拖动结束不触发启动
        launchShortcut(row.dataset.scLaunch);
      };
      // 回车/空格等同点击（可访问性），不是全局键盘快捷键。
      row.onkeydown = e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          launchShortcut(row.dataset.scLaunch);
        }
      };
      row.ondragstart = e => {
        uaDraggingShortcutId = row.dataset.scLaunch;
        row.classList.add('dragging');
        try {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', row.dataset.scLaunch);
        } catch (err) { /* 某些环境无 dataTransfer */ }
      };
      row.ondragend = () => {
        uaDraggingShortcutId = '';
        uaSuppressRowClickUntil = Date.now() + 400;
        row.classList.remove('dragging');
        box.querySelectorAll('.ua-sg.dragover').forEach(s => s.classList.remove('dragover'));
      };
    });
    // 组容器作为放置目标（「未分组」同样合法）
    box.querySelectorAll('.ua-sg').forEach(sec => {
      sec.ondragover = e => {
        if (!uaDraggingShortcutId) return;
        e.preventDefault();
        try { e.dataTransfer.dropEffect = 'move'; } catch (err) { /* 忽略 */ }
        sec.classList.add('dragover');
      };
      sec.ondragleave = e => {
        if (e.relatedTarget && sec.contains(e.relatedTarget)) return;
        sec.classList.remove('dragover');
      };
      sec.ondrop = e => {
        e.preventDefault();
        sec.classList.remove('dragover');
        const sid = uaDraggingShortcutId || (e.dataTransfer && e.dataTransfer.getData('text/plain')) || '';
        uaDraggingShortcutId = '';
        uaSuppressRowClickUntil = Date.now() + 400;
        const target = sec.dataset.sgid || '';
        const item = uaShortcuts.find(x => x.id === sid);
        if (!item || (item.group_id || '') === target) return;
        moveShortcutToGroup(sid, target);
      };
    });
    box.querySelectorAll('[data-sc-del]').forEach(btn => btn.onclick = () => removeShortcut(btn.dataset.scDel));
  };
  const moveShortcutToGroup = async (id, groupId) => {
    try {
      await uaPatch('/api/plugin/urlarch/shortcuts/' + encodeURIComponent(id),
        { group_id: groupId });
      uaShortcuts = await uaFetchShortcuts();
      renderShortcuts();
      toast(groupId ? '已移到目标组 ✓' : '已移到未分组 ✓', 'success', 2200);
    } catch (err) {
      toast(uaShortcutHint(err && err.message), 'warn', 4600);
      // 失败不做乐观残留：重新拉取服务端真实状态
      uaShortcuts = await uaFetchShortcuts();
      renderShortcuts();
    }
  };
  const renameShortcutGroup = async gid => {
    const g = uaShortcutGroups.find(x => x.id === gid);
    if (!g) return;
    const input = prompt('重命名组别', g.name);
    if (input === null) return;
    const text = String(input).trim();
    if (!text) { toast('组名不能为空', 'warn'); return; }
    if (text === g.name) return;
    try {
      await uaPatch('/api/plugin/urlarch/shortcut-groups/' + encodeURIComponent(gid),
        { name: text });
      uaShortcutGroups = await uaFetchShortcutGroups();
      renderShortcuts();
      toast('组名已更新 ✓', 'success');
    } catch (err) {
      toast(uaShortcutHint(err && err.message), 'warn', 4600);
      uaShortcutGroups = await uaFetchShortcutGroups();
      renderShortcuts();
    }
  };
  const moveShortcutGroup = async (gid, dir) => {
    const ordered = uaShortcutGroups.slice();
    const i = ordered.findIndex(g => g.id === gid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ordered.length) return;
    const [moved] = ordered.splice(i, 1);
    ordered.splice(j, 0, moved);
    // 规范化 sort_order = index*10，保证顺序稳定（只提交有变化的组）
    const updates = ordered.map((g, idx) => ({ id: g.id, sort_order: idx * 10 }))
      .filter(u => {
        const cur = uaShortcutGroups.find(g => g.id === u.id);
        return !cur || cur.sort_order !== u.sort_order;
      });
    try {
      for (const u of updates) {
        await uaPatch('/api/plugin/urlarch/shortcut-groups/' + encodeURIComponent(u.id),
          { sort_order: u.sort_order });
      }
      uaShortcutGroups = await uaFetchShortcutGroups();
      renderShortcuts();
    } catch (err) {
      toast(uaShortcutHint(err && err.message), 'warn', 4600);
      uaShortcutGroups = await uaFetchShortcutGroups();
      renderShortcuts();
    }
  };
  const removeShortcut = async id => {
    if (!confirm('从白名单删除该软件？（只删登记，不卸载软件）')) return;
    try {
      await api('/api/plugin/urlarch/shortcuts/' + encodeURIComponent(id), { method: 'DELETE' });
      uaShortcuts = uaShortcuts.filter(x => x.id !== id);
      renderShortcuts();
      toast('已从白名单删除 ✓', 'success');
    } catch (err) {
      toast(uaShortcutHint(err && err.message), 'warn', 4600);
    }
  };
  const removeShortcutGroup = async gid => {
    const g = uaShortcutGroups.find(x => x.id === gid);
    if (!confirm(`删除组「${(g && g.name) || ''}」？组内软件将移到未分组（不会删除软件）`)) return;
    try {
      await api('/api/plugin/urlarch/shortcut-groups/' + encodeURIComponent(gid), { method: 'DELETE' });
      uaShortcutGroups = await uaFetchShortcutGroups();
      uaShortcuts = await uaFetchShortcuts();
      renderShortcuts();
      toast('已删除组，组内软件移到未分组 ✓', 'success', 2800);
    } catch (err) {
      toast(uaShortcutHint(err && err.message), 'warn', 4600);
    }
  };
  const addShortcut = async () => {
    const name = $('#ua-sc-name').value.trim();
    const path = $('#ua-sc-path').value.trim();
    const groupId = $('#ua-sc-group').value || '';
    if (!name) { toast('请填写名称', 'warn'); return; }
    if (!path) { toast('请填写可执行文件绝对路径', 'warn'); return; }
    const payload = { name, path };
    if (groupId) payload.group_id = groupId;
    try {
      await api('/api/plugin/urlarch/shortcuts', { method: 'POST', body: payload });
      uaShortcuts = await uaFetchShortcuts();
      renderShortcuts();
      $('#ua-sc-name').value = ''; $('#ua-sc-path').value = '';
      toast('已添加快捷入口 ✓', 'success');
    } catch (err) {
      toast(uaShortcutHint(err && err.message), 'warn', 4600);
    }
  };
  const addShortcutGroup = async () => {
    const name = $('#ua-sc-newgroup').value.trim();
    if (!name) { toast('请填写组名', 'warn'); return; }
    try {
      const d = await api('/api/plugin/urlarch/shortcut-groups', { method: 'POST', body: { name } });
      uaShortcutGroups = await uaFetchShortcutGroups();
      renderShortcuts();
      if (d && d.item && d.item.id) $('#ua-sc-group').value = d.item.id;
      $('#ua-sc-newgroup').value = '';
      toast(`已新建组「${name}」✓`, 'success');
    } catch (err) {
      toast(uaShortcutHint(err && err.message), 'warn', 4600);
    }
  };
  $('#ua-sc-add').onclick = addShortcut;
  $('#ua-sc-addgroup').onclick = addShortcutGroup;
  uaShortcuts = await uaFetchShortcuts();
  uaShortcutGroups = await uaFetchShortcutGroups();
  renderShortcuts();
  draw();
}

window.__toolRenderers.urlarch = renderUrlArchTool;
})();

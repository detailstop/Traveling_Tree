'use strict';
/* ============================================================
   旅行之木 · 第二档 Web UI
   ============================================================ */

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------- API（带 10s 缓存：写操作自动失效） ---------------- */
const CACHE_TTL = 10_000;
const _cache = new Map();   // path -> {t, data}
const _pageState = {};      // 页面 -> 数据指纹；相同则跳过整页重建（切页秒开）

async function api(path, opts = {}) {
  const isRead = !opts.method && opts.body === undefined;   // 写操作统一传 body：不再误判为读
  if (isRead) {
    const hit = _cache.get(path);
    if (hit && Date.now() - hit.t < CACHE_TTL) return hit.data;
  }
  const o = { method: opts.method || 'GET', headers: {} };
  if (opts.body !== undefined) {
    o.method = 'POST';
    o.headers['Content-Type'] = 'application/json';
    o.body = JSON.stringify(opts.body);
  }
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), 15000);   // 15s 超时：防止慢请求挂起界面
  o.signal = ctl.signal;
  let res;
  try { res = await fetch(path, o); }
  catch (e) { clearTimeout(tm); throw new Error('请求超时或失败：' + path); }
  clearTimeout(tm);
  let data = null;
  try { data = await res.json(); } catch (e) { /* 非 JSON */ }
  if (!res.ok || (data && data.ok === false)) {
    throw new Error((data && data.error) || `请求失败 ${res.status}`);
  }
  if (isRead) _cache.set(path, { t: Date.now(), data });
  else _cache.clear();       // 任何写操作：全部缓存作废，下次读取必为最新
  return data;
}

/* ---------------- 全局状态 ---------------- */
const S = {
  themes: [], settings: {}, total: 0, due_count: 0, activity: { current: 0 },
  review_today: 0,
  study: { theme: '', queue: [], index: 0, stats: { know: 0, unknown: 0, skip: 0 } },
  review: { queue: [], index: 0, stats: { know: 0, unknown: 0, skip: 0 } },
  recite: null,
  kb: { sel: new Set() },
  all: { type: '', theme: '', items: [], sel: new Set() },
  sched: { weekOffset: 0 },
  cobuild: null,          // 多 AI 共建声明 + 打卡记录（/api/plugin/cobuild/data）
  cobuildExpanded: false, // 打卡记录是否展开全部
  cobuildFilter: { agent: '', kind: '' },
  cobuildGroup: false,    // 打卡记录按 Agent 折叠分组
};

const NAV = {
  study: ['今日学习', '自由遮盖 · 背诵模式'],
  plan: ['今日计划', '每日新学与复习配额'],
  tools: ['通用工具', ''],
  cobuild: ['AI共建日志', ''],
  settings: ['设置', ''],
  review: ['复习', '今日到期 · SRS 间隔复习'],
  add: ['添加条目', '手工录入与主题管理'],
  import: ['批量导入', 'AI 生成的 Markdown 表格 / 文本 / JSON'],
  kb: ['知识库', '周 → 日 → 类型 → 条目'],
  stats: ['统计', '坚持时长 · 每日学习 / 复习'],
  all: ['所有知识', '全量管理与批量调整'],
};

/* ---------------- 轻工具 ---------------- */
function toast(msg, type = 'info', ms = 2800) {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 260);
  }, ms);
}

/* ============================================================
   统一下载：可选自定义目录（File System Access API）
   - 未配置 / 不支持 / 授权失败：回退浏览器默认下载；
   - 只改变落盘位置，不改变文件名与内容。
   ============================================================ */
const RT_DL_KEY = 'rt_download_custom';
const RT_DL_DB = 'rt_download_db';
const RT_DL_STORE = 'handles';
const RT_DL_UNIFIED = 'dir';
const RT_DL_GROUP_DEFS = [
  { id: 'promptgen', name: '提示词生成器', desc: '下载替换后的 .md · 工作流/模块/专有任务 JSON', connected: true },
  { id: 'reader_vocab', name: '俄语书籍阅读 · 词库导出', desc: '词库选中导出 JSON / 清空备份', connected: true },
  { id: 'reader_cleaned', name: '俄语书籍阅读 · 导出已清洗', desc: 'cleaned-reading-data.json', connected: true },
  { id: 'reader_cleaning', name: '俄语书籍阅读 · 待清洗导出', desc: 'cleaning-<task_id>.json', connected: true },
  { id: 'pdf', name: 'PDF 工具（占位）', desc: '尚未接入分组下载', connected: false },
  { id: 'batch', name: '批量压缩（占位）', desc: '尚未接入分组下载', connected: false },
  { id: 'finance', name: '记账本（占位）', desc: '尚未接入分组下载', connected: false },
];
function rtDlSupported() { return typeof window.showDirectoryPicker === 'function'; }
function rtDlRead() {
  try {
    const v = JSON.parse(localStorage.getItem(RT_DL_KEY) || 'null');
    return v && typeof v === 'object' ? v : null;
  } catch (e) { return null; }
}
function rtDlGroupCfg(group) {
  const groups = (S && S.settings && S.settings.download_groups) || {};
  const cfg = groups[group];
  return cfg && typeof cfg === 'object' ? cfg : null;
}
function rtDlStatus(group) {
  if (group) {
    const cfg = rtDlGroupCfg(group);
    return { supported: rtDlSupported(), enabled: !!(cfg && cfg.enabled), dirName: (cfg && cfg.dir_name) || '', group: group };
  }
  const v = rtDlRead();
  return { supported: rtDlSupported(), enabled: !!(v && v.enabled), dirName: (v && v.dirName) || '' };
}
function rtDlOpenDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error('当前浏览器不支持 IndexedDB'));
    const req = indexedDB.open(RT_DL_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(RT_DL_STORE)) req.result.createObjectStore(RT_DL_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB 打开失败'));
  });
}
async function rtDlGetHandle(key = RT_DL_UNIFIED) {
  const db = await rtDlOpenDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RT_DL_STORE, 'readonly');
    const req = tx.objectStore(RT_DL_STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function rtDlSetHandle(handle, key = RT_DL_UNIFIED) {
  const db = await rtDlOpenDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RT_DL_STORE, 'readwrite');
    tx.objectStore(RT_DL_STORE).put(handle, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function rtDlClearHandle(key = RT_DL_UNIFIED) {
  const db = await rtDlOpenDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RT_DL_STORE, 'readwrite');
    tx.objectStore(RT_DL_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function rtDlEnsurePermission(handle) {
  if (!handle) return false;
  if (typeof handle.queryPermission !== 'function') return true;
  let p = await handle.queryPermission({ mode: 'readwrite' });
  if (p === 'prompt') p = await handle.requestPermission({ mode: 'readwrite' });
  return p === 'granted';
}
async function rtDlSaveGroupConfig(group, payload) {
  const r = await api('/api/settings', { body: { download_groups: { [group]: payload } } });
  if (!r || !r.ok) throw new Error((r && r.error) || '保存下载分组设置失败');
  S.settings = { ...(S.settings || {}), ...r, download_groups: r.download_groups || {} };
  return r;
}
async function rtDlPickDirectory(group) {
  if (!rtDlSupported()) throw new Error('当前浏览器不支持选择下载目录（需 Chrome / Edge）');
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  if (group) {
    const key = 'group:' + group;
    await rtDlSetHandle(handle, key);
    try {
      await rtDlSaveGroupConfig(group, { enabled: true, dir_name: handle.name || '已选择目录' });
    } catch (e) {
      try { await rtDlClearHandle(key); } catch (_) { /* 回滚失败也提示原错误 */ }
      throw e;
    }
    return handle;
  }
  await rtDlSetHandle(handle);
  localStorage.setItem(RT_DL_KEY, JSON.stringify({ enabled: true, dirName: handle.name || '已选择目录' }));
  return handle;
}
async function rtDlResetDirectory(group) {
  if (group) {
    try { await rtDlClearHandle('group:' + group); } catch (e) { /* 没有旧句柄也可 */ }
    await rtDlSaveGroupConfig(group, { enabled: false, dir_name: '' });
    return;
  }
  localStorage.removeItem(RT_DL_KEY);
  try { await rtDlClearHandle(); } catch (e) { /* 没有旧句柄也可 */ }
}
async function rtDlWriteHandle(handle, blob, filename) {
  try {
    const safe = String(filename || 'download').replace(/[\\/:*?"<>|\r\n]+/g, '_').trim() || 'download';
    const fileHandle = await handle.getFileHandle(safe, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (e) {
    console.warn('[download] 目录写入失败，回退：', e);
    return false;
  }
}
async function rtDlWrite(blob, filename, group) {
  if (group && rtDlGroupCfg(group)?.enabled) {
    try {
      const handle = await rtDlGetHandle('group:' + group);
      if (handle && await rtDlEnsurePermission(handle) && await rtDlWriteHandle(handle, blob, filename)) {
        return { dirName: rtDlGroupCfg(group)?.dir_name || handle.name || '功能目录' };
      }
    } catch (e) {
      console.warn('[download] 分组目录不可用，回退统一下载地址：', e);
    }
  }
  const status = rtDlStatus();
  if (!status.enabled) return false;
  try {
    const handle = await rtDlGetHandle();
    if (!handle || !(await rtDlEnsurePermission(handle))) return false;
    if (await rtDlWriteHandle(handle, blob, filename)) return { dirName: status.dirName || handle.name || '自定义目录' };
    return false;
  } catch (e) {
    console.warn('[download] 统一下载目录写入失败，回退浏览器下载：', e);
    return false;
  }
}
async function rtDownloadBlob(blob, filename, group) {
  const saved = await rtDlWrite(blob, filename, group);
  if (saved) {
    toast('已保存到「' + saved.dirName + '」· ' + filename, 'success', 1800);
    return true;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  return false;
}
function rtDownloadText(text, filename, mime, group) {
  return rtDownloadBlob(new Blob([text], { type: mime || 'text/plain;charset=utf-8' }), filename, group);
}
window.rtDownloadBlob = rtDownloadBlob;
window.rtDownloadText = rtDownloadText;
window.rtDlStatus = rtDlStatus;
window.rtDlPickDirectory = rtDlPickDirectory;
window.rtDlResetDirectory = rtDlResetDirectory;
window.rtDlGroupDefs = RT_DL_GROUP_DEFS;

function modal({ title, body, actions }) {
  const root = $('#modal-root');
  root.innerHTML = '';
  const mask = document.createElement('div');
  mask.className = 'mask';
  mask.innerHTML = `<div class="modal"><h3></h3><div class="m-body"></div><div class="m-actions"></div></div>`;
  const m = mask.querySelector('.modal');
  m.querySelector('h3').textContent = title;
  const mb = m.querySelector('.m-body');
  if (typeof body === 'string') mb.innerHTML = body; else mb.append(body);
  const ma = m.querySelector('.m-actions');
  (actions || []).forEach(a => {
    const b = document.createElement('button');
    b.className = 'btn ' + (a.cls || '');
    b.textContent = a.label;
    b.onclick = () => a.onClick(mask);
    ma.appendChild(b);
  });
  mask.addEventListener('mousedown', e => { if (e.target === mask) mask.remove(); });
  root.appendChild(mask);
  return { mask, body: mb };
}

function showMenu(x, y, items) {
  const root = $('#menu-root');
  root.innerHTML = '';
  const m = document.createElement('div');
  m.className = 'ctx';
  items.forEach(it => {
    if (it === '-') {
      const s = document.createElement('div'); s.className = 'sep'; m.appendChild(s); return;
    }
    const b = document.createElement('button');
    if (it.danger) b.className = 'danger';
    b.textContent = it.label;
    b.onclick = () => { m.remove(); it.onClick(); };
    m.appendChild(b);
  });
  m.style.left = Math.min(x, innerWidth - 200) + 'px';
  m.style.top = Math.min(y, innerHeight - items.length * 36 - 24) + 'px';
  root.appendChild(m);
  const h = e => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', h); } };
  setTimeout(() => document.addEventListener('mousedown', h), 0);
}

function animateNum(el, to, suffix = '') {
  const t0 = performance.now(), dur = 750;
  const step = t => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(to * e) + suffix;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------------- 背景粒子 / 彩带 ---------------- */
function initParticles() {
  const c = $('#bg-particles'), ctx = c.getContext('2d');
  let W = c.width = innerWidth, H = c.height = innerHeight;
  let rsT = 0;
  addEventListener('resize', () => {           // 防抖：resize 风暴不再逐帧重设画布
    const n = Date.now();
    if (n - rsT < 150) return;
    rsT = n;
    W = c.width = innerWidth; H = c.height = innerHeight;
  });
  const palette = ['255,111,149', '255,177,153', '186,168,222', '143,216,184', '255,209,102'];
  // 预渲染 5 色粒子 sprite：避免每帧创建径向渐变（原实现每帧 24 次渐变创建+路径+填充，是主要卡顿源）
  const SZ = 96;
  const sprites = palette.map(hue => {
    const s = document.createElement('canvas');
    s.width = s.height = SZ;
    const g = s.getContext('2d');
    const gr = g.createRadialGradient(SZ / 2, SZ / 2, 0, SZ / 2, SZ / 2, SZ / 2);
    gr.addColorStop(0, `rgba(${hue},0.5)`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, SZ, SZ);
    return s;
  });
  const ps = [];
  const N = 24;               // 减量：低端机更流畅
  for (let i = 0; i < N; i++) {
    ps.push({
      x: Math.random() * W, y: Math.random() * H,
      r: 5 + Math.random() * 22,
      vx: (Math.random() - .5) * .2, vy: (Math.random() - .5) * .2,
      si: i % palette.length, a: .03 + Math.random() * .06,
    });
  }
  let last = 0, rafId = 0;
  function tick(now) {
    rafId = 0;
    if (document.hidden) return;
    if (now - last < 33) { rafId = requestAnimationFrame(tick); return; }  // 30fps 门控
    last = now;
    ctx.clearRect(0, 0, W, H);
    for (const p of ps) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < -p.r) p.x = W + p.r; if (p.x > W + p.r) p.x = -p.r;
      if (p.y < -p.r) p.y = H + p.r; if (p.y > H + p.r) p.y = -p.r;
      ctx.globalAlpha = p.a;
      ctx.drawImage(sprites[p.si], p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      ctx.globalAlpha = 1;
    }
    rafId = requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    } else if (!rafId) {
      last = 0;
      rafId = requestAnimationFrame(tick);
    }
  });
  rafId = requestAnimationFrame(tick);
}

function confetti() {
  const c = $('#fx-canvas'), ctx = c.getContext('2d');
  c.width = innerWidth; c.height = innerHeight;
  const colors = ['#ff6f95', '#ffb199', '#8fd8b8', '#ffd166', '#b8a6e0'];
  const N = 150, parts = [];
  for (let i = 0; i < N; i++) {
    parts.push({
      x: innerWidth / 2 + (Math.random() - .5) * 180,
      y: innerHeight * .4,
      vx: (Math.random() - .5) * 9, vy: -(Math.random() * 11 + 5),
      w: 6 + Math.random() * 7, h: 4 + Math.random() * 5,
      c: colors[i % colors.length], r: Math.random() * Math.PI,
      vr: (Math.random() - .5) * .32,
    });
  }
  (function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    let live = 0;
    for (const p of parts) {
      p.vy += .27; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      if (p.y < innerHeight + 30) live++;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (live) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })();
}

/* ---------------- 语音朗读 ---------------- */
async function speakBtn(btn, text) {
  if (!text || btn.classList.contains('loading')) return;
  btn.classList.add('loading');
  const t0 = Date.now();
  const tmr = setInterval(() => {
    if (Math.round((Date.now() - t0) / 1000) >= 10) btn.classList.add('warn');
  }, 400);
  try {
    const res = await fetch('/api/plugin/tts/speak?text=' + encodeURIComponent(text));
    if (!res.ok) throw new Error('合成失败');
    const url = URL.createObjectURL(await res.blob());
    const a = new Audio(url);
    a.onended = () => URL.revokeObjectURL(url);
    await a.play();
  } catch (e) {
    toast('语音朗读失败：' + e.message, 'error');
  } finally {
    clearInterval(tmr);
    btn.classList.remove('loading', 'warn');
  }
}

/* ============================================================
   通用工具（工具箱总览 + 通用计划表；后续工具在此追加）
   ============================================================ */
const TOOLS = [
  // 全部工具卡片由 /api/plugins/list 动态提供；宿主不保留内置工具。
];

/* ---------- 插件工具（P1）：/api/plugins/list + /plugins/<id>/<feature> ---------- */
const PLUGIN_DISABLED_KEY = 'rt_plugins_disabled';
let PLUGIN_TOOLS = [];
let PLUGIN_NAV = [];
const PLUGIN_FEATURE_LOADS = new Map();
const PLUGIN_STYLE_LOADS = new Map();

/* ---------- 右栏快捷按钮 + 上下分屏（宿主视图基础设施；快捷按钮列表存宿主 settings） ---------- */
const RAIL_COLLAPSED_KEY = 'rt_quickrail_collapsed';
const RT_SPLIT = { on: false, focused: 'top', tool: { top: null, bottom: null } };
let QUICKBAR = [];

function pluginDisabledIds() {
  const raw = loadJSON(PLUGIN_DISABLED_KEY, []);
  const ids = Array.isArray(raw)
    ? raw
    : (raw && typeof raw === 'object' ? Object.keys(raw).filter(k => raw[k]) : []);
  return new Set(ids.map(String));
}
function savePluginDisabled(ids) {
  localStorage.setItem(PLUGIN_DISABLED_KEY, JSON.stringify(Array.from(ids)));
}
function allTools() {
  const disabled = pluginDisabledIds();
  return TOOLS.concat(PLUGIN_TOOLS.filter(t => !disabled.has(t.plugin_id || t.id)));
}
async function loadPlugins() {
  try {
    const d = await api('/api/plugins/list');
    const entries = [];
    const navEntries = [];
    for (const plugin of (d.plugins || [])) {
      if (!plugin || !plugin.id) continue;
      for (const entry of (plugin.entries || [])) {
        if (!entry || !entry.id || !entry.feature_url) continue;
        if (TOOLS.some(t => t.id === entry.id)) continue;
        const item = {
          ...entry,
          plugin_id: entry.plugin_id || plugin.id,
          style_url: plugin.style_url || '',
          shared_features: Array.isArray(plugin.shared_features) ? plugin.shared_features : [],
          fromPlugin: true,
          desc: entry.desc || '',
          shelf: entry.shelf || 'gen',
        };
        if (entry.nav) navEntries.push(item);
        else entries.push(item);
      }
    }
    PLUGIN_TOOLS = entries;
    PLUGIN_NAV = navEntries;
  } catch (e) {
    PLUGIN_TOOLS = [];
    PLUGIN_NAV = [];
    console.warn('插件清单加载失败：' + e.message);
  }
}
function renderNav() {
  const nav = $('#nav');
  if (!nav) return;
  $$('.nav-item[data-plugin-nav]').forEach(b => b.remove());
  PLUGIN_NAV.forEach(entry => {
    const b = document.createElement('button');
    b.className = 'nav-item';
    b.dataset.nav = 'plugin:' + entry.plugin_id;
    b.dataset.pluginNav = '1';
    b.innerHTML = `<span class="ni">${esc(entry.icon)}</span><span class="nav-label">${esc(entry.name)}</span>`;
    nav.appendChild(b);
  });
}
function loadPluginStyle(plugin) {
  const url = plugin && plugin.style_url;
  if (!url) return Promise.resolve();
  if (PLUGIN_STYLE_LOADS.has(url)) return PLUGIN_STYLE_LOADS.get(url);
  // 样式失败只降级外观，不阻断 feature 加载（manifest.style 可选）。
  const promise = new Promise(resolve => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.onload = () => resolve();
    link.onerror = () => {
      console.warn('插件样式加载失败：' + url);
      resolve();
    };
    document.head.appendChild(link);
  });
  PLUGIN_STYLE_LOADS.set(url, promise);
  return promise;
}
function loadPluginFeature(plugin) {
  const key = plugin.feature_url || `${plugin.plugin_id}/${plugin.id}`;
  if (PLUGIN_FEATURE_LOADS.has(key)) return PLUGIN_FEATURE_LOADS.get(key);
  const url = plugin.feature_url || `/plugins/${encodeURIComponent(plugin.plugin_id || plugin.id)}/${String(plugin.feature || 'feature.js')}`;
  const promise = import(url).catch(err => {
    PLUGIN_FEATURE_LOADS.delete(key);
    throw new Error('插件加载失败：' + (plugin.name || plugin.id) + '（' + ((err && err.message) || err) + '）');
  });
  PLUGIN_FEATURE_LOADS.set(key, promise);
  return promise;
}

function loadJSON(key, fb) {
  try { return JSON.parse(localStorage.getItem(key)) || fb; } catch (e) { return fb; }
}
window.$ = $;
window.esc = esc;
window.toast = toast;
window.loadJSON = loadJSON;

/* ---------------- 用户偏好：localStorage 一级缓存 + data/user_preferences.json ----------------
   启动时先同步读 localStorage（主题/折叠立即应用，避免闪烁），随后异步拉取后端配置；
   任何偏好写入先更新 localStorage，再防抖全量同步到 /api/preferences。 */
const PREF_KEYS = new Set([
  'rt_theme', 'rt_sidebar_collapsed', 'rt_plugins_disabled', 'rt_tool_shelves',
  'rt_download_custom', 'rt_cobuild_agent', 'rt_cobuild_kind',
  'rt_br_view', 'rt_mu_cards', 'rt_batch_path', 'rt_sim',
  'rt_fin_chart_prefs', 'rt_fin_settings_collapsed', 'rt_fq_dsurl_idx',
  'rt_plan_injected',
]);
const ORIGINAL_SET_ITEM = Storage.prototype.setItem;
const APP_PREFS = { version: 1, updated_at: null, values: {}, raw: {} };
window.APP_PREFS = APP_PREFS;
let prefSyncEnabled = false;
let prefSyncTimer = null;
let prefSyncBusy = false;

function prefParse(raw) {
  try { return JSON.parse(raw); } catch (e) { return raw; }
}
function prefCapture(key, raw) {
  APP_PREFS.raw[key] = raw;
  APP_PREFS.values[key] = prefParse(raw);
}
function prefInitLocal() {
  PREF_KEYS.forEach(key => {
    const raw = localStorage.getItem(key);
    if (raw !== null) prefCapture(key, raw);
  });
}
function prefPayload() {
  APP_PREFS.updated_at = new Date().toISOString();
  return {
    version: 1,
    updated_at: APP_PREFS.updated_at,
    values: APP_PREFS.values,
    raw: APP_PREFS.raw,
  };
}
async function prefSyncNow() {
  if (!prefSyncEnabled || prefSyncBusy) return;
  prefSyncBusy = true;
  try { await api('/api/preferences', { body: prefPayload() }); }
  catch (e) { /* 离线时保留本地缓存，下次修改会重试 */ }
  finally { prefSyncBusy = false; }
}
function prefQueueSync() {
  if (!prefSyncEnabled) return;
  clearTimeout(prefSyncTimer);
  prefSyncTimer = setTimeout(prefSyncNow, 700);
}
Storage.prototype.setItem = function (key, value) {
  const raw = String(value);
  const result = ORIGINAL_SET_ITEM.call(this, key, raw);
  if (this === localStorage && PREF_KEYS.has(key)) {
    prefCapture(key, raw);
    prefQueueSync();
  }
  return result;
};
function prefApplyRemote(remote) {
  const values = (remote && remote.values) || {};
  const raws = (remote && remote.raw) || {};
  PREF_KEYS.forEach(key => {
    let raw = Object.prototype.hasOwnProperty.call(raws, key) ? raws[key] : null;
    if (raw == null && Object.prototype.hasOwnProperty.call(values, key)) {
      raw = typeof values[key] === 'string' ? values[key] : JSON.stringify(values[key]);
    }
    if (raw == null) return;
    raw = String(raw);
    if (localStorage.getItem(key) !== raw) ORIGINAL_SET_ITEM.call(localStorage, key, raw);
    prefCapture(key, raw);
  });
}
async function prefSyncFromServer() {
  try {
    prefInitLocal();
    const d = await api('/api/preferences');
    const remote = d && d.preferences;
    const hasRemote = remote && ((remote.values && Object.keys(remote.values).length)
      || (remote.raw && Object.keys(remote.raw).length));
    if (!hasRemote) {
      prefSyncEnabled = true;
      if (Object.keys(APP_PREFS.values).length) await prefSyncNow();
      return;
    }
    prefApplyRemote(remote);
    applyTheme(getTheme());
    applySidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
    prefSyncEnabled = true;
    if (S.page === 'settings') switchPage('settings');
  } catch (e) {
    prefSyncEnabled = true;   // 后端暂不可用：继续用本地缓存
  }
}
prefInitLocal();
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function mondayOf(offset) {
  // offset: 0=本周, -1=上周, 1=下周…；返回该周周一的 Date
  const now = new Date();
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  mon.setDate(mon.getDate() + offset * 7);
  return mon;
}
/* ---------------- 工具架子（个性化归类） ---------------- */
const TOOL_SHELF_KEY = 'rt_tool_shelves';
function loadToolShelves() {
  let d = loadJSON(TOOL_SHELF_KEY, null);
  if (!d || !Array.isArray(d.shelves)) d = { shelves: [], placement: {}, hidden: {} };
  if (!d.placement) d.placement = {};
  if (!d.hidden) d.hidden = {};
  if (!d.ratings || typeof d.ratings !== 'object') d.ratings = {};
  if (!d.ratingFilters || typeof d.ratingFilters !== 'object') d.ratingFilters = { match: 'all', conditions: [] };
  if (!Array.isArray(d.ratingFilters.conditions)) d.ratingFilters.conditions = [];
  if (!['all', 'any'].includes(d.ratingFilters.match)) d.ratingFilters.match = 'all';
  // 「通用」固定架子（不可删除，新功能默认归入）
  if (!d.shelves.some(x => x.id === 'gen')) d.shelves.unshift({ id: 'gen', name: '通用', fixed: true });
  TOOLS.concat(PLUGIN_TOOLS).forEach(t => {
    if (d.placement[t.id] == null) d.placement[t.id] = (t.shelf && d.shelves.some(sh => sh.id === t.shelf)) ? t.shelf : 'gen';
  });
  saveToolShelves(d);
  return d;
}
function saveToolShelves(d) { localStorage.setItem(TOOL_SHELF_KEY, JSON.stringify(d)); }
function visibleTools(d) { return allTools().filter(t => !d.hidden[t.id]); }

const TOOL_RATING_FIELDS = [
  { id: 'utility', name: '实用度' },
  { id: 'completeness', name: '完善度' },
];
const TOOL_RATING_OPS = [
  ['gt', '大于'], ['eq', '等于'], ['ne', '不等于'],
  ['lt', '小于'], ['gte', '大于等于'], ['lte', '小于等于'],
];
function toolRating(d, toolId, field) {
  const n = Number(d.ratings[toolId] && d.ratings[toolId][field]);
  return Number.isInteger(n) && n >= 1 && n <= 3 ? n : 0;
}
function toolPassesRatingFilters(t, d) {
  const cs = d.ratingFilters.conditions;
  if (!cs.length) return true;
  const checks = cs.map(c => {
    const got = toolRating(d, t.id, c.field), want = Number(c.value);
    if (!got || !Number.isInteger(want) || want < 1 || want > 3) return false;
    return ({ gt: got > want, eq: got === want, ne: got !== want,
      lt: got < want, gte: got >= want, lte: got <= want })[c.op] === true;
  });
  return d.ratingFilters.match === 'any' ? checks.some(Boolean) : checks.every(Boolean);
}
function toolRatingHTML(t, d) {
  return `<div class="tc-ratings" aria-label="工具星级评定" data-rating-tool="${t.id}">
    ${TOOL_RATING_FIELDS.map(f => {
      const score = toolRating(d, t.id, f.id);
      return `<div class="tc-rating-row"><span class="tc-rating-label">${f.name}</span><span class="tc-stars" role="group" aria-label="${f.name} ${score ? score + ' 星' : '未评定'}">
        ${[1, 2, 3].map(n => `<button type="button" class="tc-star ${n <= score ? 'on' : ''}" data-rate-field="${f.id}" data-rate-value="${n}" aria-label="${n} 星" aria-pressed="${score === n}">★</button>`).join('')}
      </span>${score ? `<button type="button" class="tc-rating-clear" data-rate-clear="${f.id}" title="清除评定">清除</button>` : '<span class="tc-rating-none">未评</span>'}</div>`;
    }).join('')}
  </div>`;
}
function toolCardHTML(t) {
  const d = S.toolConf;
  return `<div class="tool-card" role="group" aria-label="${t.name} 工具卡片，可按回车打开" tabindex="0" draggable="true" data-tool="${t.id}" title="点击打开 · 拖拽到其他架子">
    <span class="tc-icon">${t.icon}</span>
    <span class="tc-name">${t.name}</span>
    <span class="tc-desc">${t.desc}</span>
    ${toolRatingHTML(t, d)}
  </div>`;
}
function shelfHTML(sh, d) {
  const available = allTools().filter(t => d.placement[t.id] === sh.id && !d.hidden[t.id]);
  const tools = available.filter(t => toolPassesRatingFilters(t, d));
  const filtering = d.ratingFilters.conditions.length > 0;
  return `
    <div class="shelf-card" data-shelf="${sh.id}">
      <div class="shelf-head">
        <span class="shelf-name">${sh.fixed ? '🔒 ' : '📦 '}${esc(sh.name)}</span>
        <span class="shelf-count">${filtering ? `${tools.length} / ${available.length}` : tools.length} 个</span>
        <span class="shelf-ops">
          <button class="mini-btn" data-op="rename" title="重命名">✏️</button>
          ${sh.fixed ? '' : '<button class="mini-btn danger" data-op="del" title="删除架子">🗑️</button>'}
        </span>
      </div>
      <div class="shelf-body">
        ${tools.length
          ? `<div class="tool-grid">${tools.map(toolCardHTML).join('')}</div>`
          : `<div class="shelf-empty">${available.length ? '当前筛选条件下没有匹配工具' : '拖拽功能到这里 ✨'}</div>`}
      </div>
    </div>`;
}
function wireShelfDrag() {
  const grid = $('#shelf-grid');
  if (!grid || grid.dataset.dragBound === '1') return;
  grid.dataset.dragBound = '1';
  grid.addEventListener('dragstart', e => {
    if (e.target.closest('.tc-ratings')) { e.preventDefault(); return; }
    const card = e.target.closest('.tool-card');
    if (!card) return;
    S.toolConf.dragId = card.dataset.tool;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.dataset.tool);
  });
  grid.addEventListener('dragend', e => {
    const card = e.target.closest('.tool-card');
    if (card) card.classList.remove('dragging');
    S.toolConf.dragId = null;
    grid.querySelectorAll('.shelf-body.drag-over').forEach(b => b.classList.remove('drag-over'));
  });
  grid.addEventListener('dragover', e => {
    const body = e.target.closest('.shelf-body');
    if (!body) return;
    e.preventDefault();
    body.classList.add('drag-over');
  });
  grid.addEventListener('dragleave', e => {
    const body = e.target.closest('.shelf-body');
    if (body && !body.contains(e.relatedTarget)) body.classList.remove('drag-over');
  });
  grid.addEventListener('drop', e => {
    const body = e.target.closest('.shelf-body');
    if (!body) return;
    e.preventDefault();
    body.classList.remove('drag-over');
    const tid = S.toolConf.dragId || e.dataTransfer.getData('text/plain');
    const shId = body.closest('.shelf-card').dataset.shelf;
    if (!tid) return;
    S.toolConf.placement[tid] = shId;
    saveToolShelves(S.toolConf);
    const shName = (S.toolConf.shelves.find(x => x.id === shId) || {}).name || '';
    renderTools();
    toast('已归入「' + shName + '」✓', 'success');
  });
}
function openAllFnsModal() {
  const d = S.toolConf;
  const disabled = pluginDisabledIds();
  const body = `
    <div class="afn-list">
      ${TOOLS.concat(PLUGIN_TOOLS).map(t => `
        <div class="afn-row">
          <span class="afn-icon">${t.icon}</span>
          <span class="afn-name">${esc(t.name)}<i>${esc(t.desc)}</i></span>
          <select class="mini-sel" data-afn="shelf" data-tool="${t.id}">
            ${d.shelves.map(sh => `<option value="${sh.id}" ${sh.id === d.placement[t.id] ? 'selected' : ''}>${esc(sh.name)}</option>`).join('')}
          </select>
          <label class="switch" title="在架子上显示 / 隐藏">
            <input type="checkbox" data-afn="hide" data-tool="${t.id}" ${d.hidden[t.id] ? '' : 'checked'}>
            <span class="slider"></span>
          </label>
          ${t.fromPlugin ? `<span style="font-size:10px;color:#9b7f8e;">插件禁用</span><label class="switch" title="禁用插件：完全不加载 feature.js"><input type="checkbox" data-afn="disable" data-tool="${t.id}" data-plugin="${t.plugin_id || t.id}" ${disabled.has(t.plugin_id || t.id) ? 'checked' : ''}><span class="slider"></span></label>` : ''}
        </div>`).join('')}
    </div>`;
  const m = modal({ title: '📌 所有功能 · 下拉调整架子 · 开关控制显示/隐藏', body, actions: [
    { label: '完成', cls: 'soft', onClick: mask => mask.remove() },
  ]});
  const list = m.body.querySelector('.afn-list');
  list.onchange = e => {
    const t = e.target.dataset.tool;
    if (e.target.dataset.afn === 'disable') {
      const pid = e.target.dataset.plugin || t;
      const ids = pluginDisabledIds();
      if (e.target.checked) ids.add(pid); else ids.delete(pid);
      savePluginDisabled(ids);
      renderTools();
      toast(e.target.checked ? '插件已禁用（不会加载）' : '插件已启用', 'success');
      return;
    }
    if (e.target.dataset.afn === 'shelf') d.placement[t] = e.target.value;
    else d.hidden[t] = !e.target.checked;
    saveToolShelves(d);
    renderTools();
    toast('已更新 ✓', 'success');
  };
}

function toolRatingFilterHTML(d) {
  const f = d.ratingFilters;
  if (!f.conditions.length) return '<div class="trf-empty">尚未添加筛选条件。未评定的工具不会匹配已启用的条件。</div>';
  return f.conditions.map((c, i) => `<div class="trf-row" data-filter-row="${i}">
    <select class="input trf-field" data-filter-key="field" data-filter-index="${i}" aria-label="评级项">
      ${TOOL_RATING_FIELDS.map(x => `<option value="${x.id}" ${c.field === x.id ? 'selected' : ''}>${x.name}</option>`).join('')}
    </select>
    <select class="input trf-op" data-filter-key="op" data-filter-index="${i}" aria-label="比较方式">
      ${TOOL_RATING_OPS.map(([v, n]) => `<option value="${v}" ${c.op === v ? 'selected' : ''}>${n}</option>`).join('')}
    </select>
    <select class="input trf-val" data-filter-key="value" data-filter-index="${i}" aria-label="星级">
      ${[1, 2, 3].map(n => `<option value="${n}" ${Number(c.value) === n ? 'selected' : ''}>${n} 星</option>`).join('')}
    </select>
    <button type="button" class="mini-btn danger" data-filter-del="${i}" title="删除条件">✕</button>
  </div>`).join('');
}
function refreshToolShelfGrid() {
  const grid = $('#shelf-grid');
  if (!grid) return;
  grid.innerHTML = S.toolConf.shelves.map(sh => shelfHTML(sh, S.toolConf)).join('');
  wireShelfDrag();
}
function addToolRatingFilter() {
  S.toolConf.ratingFilters.conditions.push({ field: 'utility', op: 'gte', value: 2 });
  saveToolShelves(S.toolConf);
  const rows = $('#tool-rating-filters');
  if (rows) rows.innerHTML = toolRatingFilterHTML(S.toolConf);
  refreshToolShelfGrid();
  updateToolFilterCount();
}
function updateToolFilterCount() {
  const el = $('#tool-filter-count');
  if (el) el.textContent = S.toolConf.ratingFilters.conditions.length || '';
}

const TOOL_FEATURE_FILES = {};
const TOOL_FEATURE_DEPENDENCIES = {};
const TOOL_FEATURE_LOADS = new Map();
window.__toolRenderers = window.__toolRenderers || {};
const APP_ASSET_BASE = new URL('.', document.currentScript.src);

function loadToolFeature(file) {
  if (TOOL_FEATURE_LOADS.has(file)) return TOOL_FEATURE_LOADS.get(file);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('features/' + file + '.js', APP_ASSET_BASE).href;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      TOOL_FEATURE_LOADS.delete(file);
      reject(new Error('功能模块加载失败：' + file));
    };
    document.head.appendChild(script);
  });
  TOOL_FEATURE_LOADS.set(file, promise);
  return promise;
}

async function loadAndRenderTool(toolId, box, paneName) {
  if (!box) return;   // 分屏两区各自独立容器，必须由调用方传入
  paneName = paneName || 'top';
  const plugin = PLUGIN_TOOLS.find(t => t.id === toolId) || null;
  const file = TOOL_FEATURE_FILES[toolId];
  if (!file && !plugin) {
    box.innerHTML = emptyHTML('🧩', '功能尚未接入', '');
    return;
  }
  box.innerHTML = '<div class="gcard" style="padding:24px;color:var(--text-dim);">正在加载功能…</div>';
  try {
    if (plugin) {
      if (pluginDisabledIds().has(plugin.plugin_id || toolId)) throw new Error('插件已禁用：' + toolId);
      // 插件可声明主程序共享前端模块（如 ai/aidebug 的 webchat.js），先加载再 import feature。
      for (const dep of (plugin.shared_features || [])) await loadToolFeature(dep);
      await loadPluginStyle(plugin);
      await loadPluginFeature(plugin);
    } else {
      for (const dep of TOOL_FEATURE_DEPENDENCIES[toolId] || []) await loadToolFeature(dep);
      await loadToolFeature(file);
    }
    if (S.page !== 'tools' || RT_SPLIT.tool[paneName] !== toolId) return;
    const render = window.__toolRenderers[toolId];
    if (typeof render !== 'function') throw new Error('功能入口未注册：' + toolId);
    // 插件契约：入口 render(container) 使用传入容器，禁止直接取 #tool-view。
    render(box);
  } catch (e) {
    if (S.page === 'tools' && RT_SPLIT.tool[paneName] === toolId) {
      box.innerHTML = emptyHTML('⚠️', '功能加载失败', esc(e.message));
    }
  }
}

/* ============================================================
   宿主视图基础设施：上下分屏 + 右栏快捷按钮
   —— 分屏/聚焦为内存态；快捷按钮列表存 data/settings.json（settings_store.quickbar）；
      右栏收缩状态只存 localStorage（仅 setItem）。
   ============================================================ */
function paneEl(name) { return document.querySelector('.tool-pane[data-pane="' + name + '"]'); }
function paneBody(name) {
  const pane = paneEl(name);
  return pane ? pane.querySelector('.tool-pane-body') : null;
}
function toolsSplitHTML() {
  return `<div class="tool-split" id="tool-split">
    <section class="tool-pane focused" data-pane="top" aria-label="上半区">
      <div class="tool-pane-head" data-head="top"></div>
      <div class="tool-pane-body"></div>
    </section>
    <section class="tool-pane" data-pane="bottom" aria-label="下半区" hidden>
      <div class="tool-pane-head" data-head="bottom"></div>
      <div class="tool-pane-body"></div>
    </section>
  </div>`;
}
function paneEmptyHTML() {
  return '<div class="pane-empty">点击右栏快捷按钮，把插件加载到当前聚焦区</div>';
}
function clearPaneHead(name) {
  const pane = paneEl(name);
  const head = pane && pane.querySelector('[data-head]');
  if (head) head.innerHTML = '';
}
function updateSplitUI() {
  const split = $('#tool-split');
  const top = paneEl('top');
  const bottom = paneEl('bottom');
  if (!split || !top || !bottom) return;
  split.classList.toggle('split', RT_SPLIT.on);
  bottom.hidden = !RT_SPLIT.on;
  top.classList.toggle('focused', RT_SPLIT.focused === 'top');
  bottom.classList.toggle('focused', RT_SPLIT.focused === 'bottom');
  const btn = $('#split-toggle');
  if (btn) {
    btn.setAttribute('aria-pressed', RT_SPLIT.on ? 'true' : 'false');
    btn.classList.toggle('on', RT_SPLIT.on);
    btn.title = RT_SPLIT.on ? '关闭分屏（下半区视图会被清空）' : '开启上下分屏';
    const lb = btn.querySelector('.rail-lb');
    if (lb) lb.textContent = RT_SPLIT.on ? '关闭分屏' : '上下分屏';
  }
  if (RT_SPLIT.on && !RT_SPLIT.tool.bottom) {
    const body = bottom.querySelector('.tool-pane-body');
    if (body && !body.querySelector('.pane-empty')) body.innerHTML = paneEmptyHTML();
    const head = bottom.querySelector('[data-head]');
    if (head) head.innerHTML = '<span class="pane-name">下区 · 空</span>';
  }
}
function focusPane(name) {
  if (!RT_SPLIT.on || RT_SPLIT.focused === name) return;
  RT_SPLIT.focused = name;
  updateSplitUI();
}
function renderToolIntoPane(name, toolId) {
  const pane = paneEl(name);
  if (!pane) return;
  const body = pane.querySelector('.tool-pane-body');
  const head = pane.querySelector('[data-head]');
  const tool = allTools().find(t => t.id === toolId) || {};
  RT_SPLIT.tool[name] = toolId;
  if (head) {
    head.innerHTML = name === 'top'
      ? `<button class="btn soft sm" data-pane-back="top">← 返回工具</button><span class="pane-name">${esc(tool.name || toolId)}</span>`
      : `<span class="pane-name">下区 · ${esc(tool.name || toolId)}</span><button class="btn soft sm" data-pane-clear="bottom">清空</button>`;
    const back = head.querySelector('[data-pane-back]');
    if (back) back.onclick = () => goToolsHub();
    const clear = head.querySelector('[data-pane-clear]');
    if (clear) clear.onclick = () => clearBottomPane(true);
  }
  body.innerHTML = '<div class="gcard" style="padding:24px;color:var(--text-dim);">正在加载功能…</div>';
  loadAndRenderTool(toolId, body, name);
}
function clearBottomPane(notify) {
  const body = paneBody('bottom');
  if (body) body.innerHTML = paneEmptyHTML();
  clearPaneHead('bottom');
  RT_SPLIT.tool.bottom = null;
  updateSplitUI();
  if (notify) toast('已清空下半区视图', 'info');
}
function closeSplit() {
  RT_SPLIT.on = false;
  RT_SPLIT.focused = 'top';
  RT_SPLIT.tool.bottom = null;
  const body = paneBody('bottom');
  if (body) body.innerHTML = '';
  clearPaneHead('bottom');
  updateSplitUI();
  toast('已关闭分屏，保留上半区', 'info');
}
function toggleSplit() {
  if (RT_SPLIT.on) { closeSplit(); return; }
  RT_SPLIT.on = true;
  RT_SPLIT.focused = 'top';
  updateSplitUI();
  toast('已开启上下分屏：点下半区空白可切换聚焦区', 'success');
}
function openToolInFocused(toolId) {
  const tool = allTools().find(t => t.id === toolId);
  if (!tool) { toast('该插件已不存在或已被禁用', 'warn'); return; }
  if (!RT_SPLIT.on) {
    S.tool = toolId;
    renderTools();
    return;
  }
  const target = RT_SPLIT.focused === 'bottom' ? 'bottom' : 'top';
  const other = target === 'top' ? 'bottom' : 'top';
  if (RT_SPLIT.tool[target] === toolId) { toast('该插件已在当前聚焦区', 'info'); return; }
  if (RT_SPLIT.tool[other] === toolId) { toast('同一插件不能同时占用上下区', 'warn'); return; }
  if (target === 'top') S.tool = toolId;
  renderToolIntoPane(target, toolId);
}

/* ---------- 右栏收缩（localStorage 纯 UI 偏好，只 setItem） ---------- */
function applyRailCollapsed(collapsed) {
  const app = document.querySelector('.app');
  if (app) app.classList.toggle('rail-collapsed', !!collapsed);
  const btn = $('#rail-toggle');
  if (btn) {
    btn.title = collapsed ? '展开快捷栏' : '收起快捷栏';
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    btn.textContent = collapsed ? '⟨' : '⟩';
  }
}
function toggleRail() {
  const collapsed = !document.querySelector('.app')?.classList.contains('rail-collapsed');
  applyRailCollapsed(collapsed);
  localStorage.setItem(RAIL_COLLAPSED_KEY, collapsed ? '1' : '0');
}

/* ---------- 快捷按钮（settings.json → quickbar.pinned） ---------- */
function normalizeQuickbar(raw) {
  const src = raw && Array.isArray(raw.pinned) ? raw.pinned : [];
  const out = [];
  const seen = new Set();
  src.forEach((it, i) => {
    const id = String((typeof it === 'string' ? it : (it && it.id)) || '').trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    const n = Number(it && it.order);
    out.push({ id, order: Number.isFinite(n) ? n : i });
  });
  return out.sort((a, b) => a.order - b.order).map((it, i) => ({ id: it.id, order: i }));
}
async function loadQuickbar() {
  try {
    const r = await api('/api/settings/quickbar');
    QUICKBAR = normalizeQuickbar(r && r.quickbar);
  } catch (e) {
    QUICKBAR = [];
    console.warn('快捷按钮加载失败：' + e.message);
  }
  renderQuickbar();
}
async function saveQuickbar() {
  try {
    const r = await api('/api/settings/quickbar', { body: { pinned: QUICKBAR } });
    QUICKBAR = normalizeQuickbar(r && r.quickbar);
    renderQuickbar();
    return true;
  } catch (e) {
    toast('快捷按钮保存失败：' + e.message, 'error');
    return false;
  }
}
function renderQuickbar() {
  const list = $('#quick-list');
  if (!list) return;
  if (!QUICKBAR.length) {
    list.innerHTML = '<div class="quick-empty">点 ＋ 添加快捷按钮</div>';
    return;
  }
  const tools = allTools();
  list.innerHTML = QUICKBAR.map(it => {
    const tool = tools.find(t => t.id === it.id) || null;
    const label = tool ? tool.name : it.id;
    return `<div class="quick-item ${tool ? '' : 'missing'}" data-quick="${esc(it.id)}">
      <button class="quick-open" data-quick-open="${esc(it.id)}" title="${tool ? '加载到当前聚焦区' : '该插件已不存在或已禁用'}">
        <span class="quick-ico">${tool ? tool.icon : '❔'}</span><span class="quick-name">${esc(label)}</span>
      </button>
      <button class="quick-del" data-quick-del="${esc(it.id)}" title="移除快捷按钮">✕</button>
    </div>`;
  }).join('');
}
function openQuickAdd() {
  const used = new Set(QUICKBAR.map(x => x.id));
  const body = `<div class="qf-list">${allTools().map(t => `
    <div class="qf-row">
      <span class="qf-ico">${t.icon}</span>
      <span class="qf-name">${esc(t.name)}<i>${esc(t.desc || '')}</i></span>
      <button class="btn sm ${used.has(t.id) ? 'soft' : ''}" data-qf-add="${esc(t.id)}" ${used.has(t.id) ? 'disabled' : ''}>${used.has(t.id) ? '已添加' : '＋ 添加'}</button>
    </div>`).join('')}</div>`;
  const m = modal({ title: '＋ 添加快捷按钮', body, actions: [
    { label: '完成', cls: 'soft', onClick: mask => mask.remove() },
  ] });
  m.body.onclick = async e => {
    const b = e.target.closest('[data-qf-add]');
    if (!b || b.disabled) return;
    const id = b.dataset.qfAdd;
    if (QUICKBAR.some(x => x.id === id)) return;
    QUICKBAR.push({ id, order: QUICKBAR.length });
    b.disabled = true;
    b.textContent = '已添加';
    if (await saveQuickbar()) toast('已添加快捷按钮', 'success');
  };
}
function wireRail() {
  const rail = $('#quickrail');
  if (!rail || rail.dataset.wired === '1') return;
  rail.dataset.wired = '1';
  $('#rail-toggle').onclick = e => { e.stopPropagation(); toggleRail(); };
  rail.addEventListener('click', e => {
    if (!document.querySelector('.app')?.classList.contains('rail-collapsed')) return;
    if (e.target.closest('#rail-toggle')) return;
    toggleRail();
  });
  $('#split-toggle').onclick = () => toggleSplit();
  $('#quick-add').onclick = () => openQuickAdd();
  $('#quick-list').onclick = e => {
    const del = e.target.closest('[data-quick-del]');
    if (del) {
      const id = del.dataset.quickDel;
      QUICKBAR = QUICKBAR.filter(x => x.id !== id).map((x, i) => ({ id: x.id, order: i }));
      saveQuickbar().then(() => toast('已移除快捷按钮', 'info'));
      renderQuickbar();
      return;
    }
    const open = e.target.closest('[data-quick-open]');
    if (open) openToolInFocused(open.dataset.quickOpen);
  };
}
function wirePaneFocus() {
  document.addEventListener('pointerdown', e => {
    const pane = e.target.closest && e.target.closest('.tool-pane');
    if (!pane) return;
    const name = pane.dataset.pane;
    if (name === 'bottom' && !RT_SPLIT.on) return;
    const body = pane.querySelector('.tool-pane-body');
    // 只有“非交互空白处”（区背景/空态提示）才切换聚焦；按钮、输入框、卡片都不抢聚焦。
    const blank = e.target === body || e.target === pane || e.target.classList.contains('pane-empty');
    if (blank) focusPane(name);
  }, true);
}

/* ============================================================
   多 AI 共建：声明 + 打卡记录（首页顶部）
   —— 规则正文由后端 modules/cobuild.py 提供，记录写入 data/ai_cobuild.json，
      并同步镜像到 docs/多AI共建日志.md；前端只负责展示与提交。
   ============================================================ */
function cobuildPageHTML() {
  return `<div class="page-back"><button class="btn soft sm" id="cb-back">← 返回首页</button></div>
    <div class="gcard cb-card" id="cobuild-card">
    <div class="section-title"><span class="st-emoji">🤝</span>AI共建日志
      <span class="cb-hint">关于多 AI 共建的声明 · 打卡记录</span>
      <span class="cb-tools"><button class="btn soft sm" id="cb-checkin">✍️ 打卡</button></span>
    </div>
    <div id="cobuild-body"><div class="cb-loading">正在读取共建声明与打卡记录…</div></div>
  </div>`;
}

function settingsPageHTML() {
  const st = window.rtDlStatus ? window.rtDlStatus() : { supported: false, enabled: false, dirName: '' };
  return `<div class="page-back"><button class="btn soft sm" id="set-back">← 返回首页</button></div>
    <div class="gcard settings-card">
      <div class="section-title"><span class="st-emoji">⚙️</span>设置</div>
      <section class="settings-section">
        <h3>外观主题</h3>
        <p class="settings-desc">切换界面配色，选择后立即生效并在本机保持。</p>
        <div class="settings-row"><button class="btn soft" id="set-theme">🎨 外观主题</button></div>
      </section>
      <section class="settings-section">
        <h3>语音</h3>
        <p class="settings-desc">清理本机生成的语音缓存文件，不影响词库与学习数据。</p>
        <div class="settings-row"><button class="btn soft" id="set-clear-cache">🗑️ 清除语音缓存</button></div>
      </section>
      <section class="settings-section">
        <h3>下载</h3>
        <p class="settings-desc">当前保存位置：<b>${st.enabled ? '自定义目录「' + esc(st.dirName || '已选择目录') + '」' : '浏览器默认下载'}</b></p>
        <div class="settings-row">
          <button class="btn" id="dl-pick" ${st.supported ? '' : 'disabled'}>选择下载目录</button>
          <button class="btn soft" id="dl-reset">恢复浏览器默认下载</button>
        </div>
        <p class="settings-note">自定义目录使用浏览器 File System Access API（需 Chrome / Edge 并在弹窗中授权）。未设置、浏览器不支持或授权失败时会回退浏览器默认下载；不会改变文件名与文件内容。</p>
      </section>
      <section class="settings-section">
        <h3>通用下载地址（本地路径）</h3>
        <p class="settings-desc">供市场「开发插件」等后端写盘使用；必须是已存在的绝对路径，未设置或不可写时后端明确报错。该路径仅用于插件服务端写盘；浏览器下载仍走浏览器/统一下载句柄，与该项相互独立。</p>
        <div class="settings-row">
          <input id="set-download-dir" class="mk-search" style="max-width:420px" placeholder="例如 D:\\Downloads" value="${esc((S.settings && S.settings.download_dir) || '')}">
          <button class="btn sm" id="set-download-dir-save">保存路径</button>
        </div>
      </section>
      <section class="settings-section">
        <h3>按功能分组下载地址</h3>
        <p class="settings-desc">为已接入的功能单独指定目录；未配置、权限失效或浏览器不支持时回退上方统一下载地址。分组配置存后端 <code>data/settings.json</code>，目录授权句柄仍由浏览器 IndexedDB 保存。</p>
        <div class="dl-group-list">
          ${(window.rtDlGroupDefs || []).map(g => {
            const gs = window.rtDlStatus ? window.rtDlStatus(g.id) : { enabled: false, dirName: '' };
            const status = g.connected
              ? (gs.enabled ? '独立目录「' + esc(gs.dirName || '已选择目录') + '」' : '未配置 · 使用统一地址')
              : '未接入 · 占位';
            return `<div class="dl-group-row">
              <div class="dl-group-main"><b>${esc(g.name)}</b><span>${esc(g.desc)}</span><small>${status}</small></div>
              <div class="dl-group-actions">${g.connected
                ? `<button class="btn soft sm" data-dl-group-pick="${esc(g.id)}" ${st.supported ? '' : 'disabled'}>选择目录</button>
                   <button class="btn soft sm" data-dl-group-reset="${esc(g.id)}" ${gs.enabled ? '' : 'disabled'}>回退统一</button>`
                : '<span class="settings-note">预留占位</span>'}</div>
            </div>`;
          }).join('')}
        </div>
      </section>
    </div>`;
}

function cbTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return esc(String(iso || ''));
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function cobuildRowHTML(c) {
  const files = Array.isArray(c.files) ? c.files : [];
  return `<div class="cb-row${c.void ? ' void' : ''}">
    <span class="cb-time" title="${esc(c.time || '')}">${cbTime(c.time)}</span>
    <span class="cb-kind k-${esc(c.kind || 'other')}">${esc(c.kind_label || c.kind || '其他')}</span>
    <span class="cb-agent">${esc(c.agent)}</span>
    <div class="cb-main">
      <div class="cb-action">${esc(c.action)}</div>
      ${files.length ? `<div class="cb-files">${files.map(f => `<code>${esc(f)}</code>`).join('')}</div>` : ''}
      ${c.note ? `<div class="cb-note">备注：${esc(c.note)}</div>` : ''}
      ${c.void ? `<div class="cb-void">已作废${c.void_reason ? '：' + esc(c.void_reason) : ''}</div>` : ''}
    </div>
    ${c.void ? '<span></span>' : `<button class="mini-btn cb-void-btn" data-cb-void="${esc(c.id)}" title="标记作废（原记录保留）">作废</button>`}
  </div>`;
}

function renderCobuildBody() {
  const box = $('#cobuild-body');
  const d = S.cobuild;
  if (!box || !d || !d.ok) return;
  const all = (d.checkins || []).slice().sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')));
  const kinds = d.kinds || [];
  const agents = [...new Set(all.map(c => c.agent).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const f = S.cobuildFilter || { agent: '', kind: '' };
  const filtered = all.filter(c => (!f.agent || c.agent === f.agent) && (!f.kind || c.kind === f.kind));
  const agentCounts = new Map();
  all.forEach(c => { if (c.agent) agentCounts.set(c.agent, (agentCounts.get(c.agent) || 0) + 1); });
  const hasFilter = !!(f.agent || f.kind);
  const shown = S.cobuildExpanded || hasFilter ? filtered : filtered.slice(0, 4);
  const groups = new Map();
  filtered.forEach(c => { const key = c.agent || '（未署名）'; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(c); });
  const filteredEmpty = '<div class="cb-empty">当前筛选条件下没有打卡记录。</div>';
  box.innerHTML = `
    <details class="cb-rules-wrap" open>
      <summary>关于多 AI 共建的声明</summary>
      <p class="cb-lead">本项目由多个 AI（不同模型、不同会话）<b>轮流接手</b>维护。
        为了让每一次改动都能被追溯、被交接，这里立下基本规则；<b>下方打卡记录就是履约凭证，只增不删</b>。</p>
      <ol class="cb-rules">${(d.rules || []).map(r => `<li><b>${esc(r.title)}</b><span>${esc(r.detail)}</span></li>`).join('')}</ol>
    </details>
    <div class="cb-filters">
      <label>Agent<select class="input" id="cb-filter-agent"><option value="">全部 Agent</option>${agents.map(a => `<option value="${esc(a)}" ${f.agent === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}</select></label>
      <label>类型<select class="input" id="cb-filter-kind"><option value="">全部类型</option>${kinds.map(k => `<option value="${esc(k.id)}" ${f.kind === k.id ? 'selected' : ''}>${esc(k.label)}</option>`).join('')}</select></label>
      <button class="btn soft sm ${S.cobuildGroup ? 'on' : ''}" id="cb-group-toggle">${S.cobuildGroup ? '收起 Agent 分组' : '按 Agent 分组'}</button>
      <span class="cb-count">显示 ${filtered.length} / ${all.length} 条${d.latest ? ' · 最近 ' + cbTime(d.latest) : ''}</span>
    </div>
    <div class="cb-agent-stats"><span>Agent 统计</span>${[...agentCounts].map(([a, n]) => `<button class="cb-agent-chip ${f.agent === a ? 'on' : ''}" data-cb-agent="${esc(a)}" title="按此 Agent 筛选">${esc(a)} <b>${n}</b></button>`).join('') || '<span class="cb-count">暂无记录</span>'}</div>
    <div class="cb-log-head">
      <b>📌 打卡记录</b>
      <span class="cb-count">共 ${Number(d.count) || all.length} 次</span>
      <span class="cb-spacer"></span>
      ${!S.cobuildGroup && !hasFilter && filtered.length > 4 ? `<button class="btn soft sm" id="cb-expand">${S.cobuildExpanded ? '收起' : '查看全部 ' + filtered.length + ' 条'}</button>` : ''}
    </div>
    ${S.cobuildGroup
      ? (groups.size
        ? [...groups].map(([agent, rows]) => `<details class="cb-group" open><summary><b>${esc(agent)}</b><span>${rows.length} 条</span></summary><div class="cb-log">${rows.map(cobuildRowHTML).join('')}</div></details>`).join('')
        : filteredEmpty)
      : (shown.length
        ? `<div class="cb-log">${shown.map(cobuildRowHTML).join('')}</div>`
        : (all.length ? filteredEmpty : '<div class="cb-empty">还没有打卡记录。第一位改完代码的 AI，请点右上角「✍️ 打卡」。</div>'))}
    <div class="cb-foot">记录同步写入 <code>${esc(d.log_file || 'docs/多AI共建日志.md')}</code>，不开服务也能查阅；数据源 <code>${esc(d.data_file || 'data/ai_cobuild.json')}</code>。</div>`;
  const ex = $('#cb-expand');
  if (ex) ex.onclick = () => { S.cobuildExpanded = !S.cobuildExpanded; renderCobuildBody(); };
  const agentSel = $('#cb-filter-agent');
  if (agentSel) agentSel.onchange = () => { S.cobuildFilter = { ...S.cobuildFilter, agent: agentSel.value }; renderCobuildBody(); };
  const kindSel = $('#cb-filter-kind');
  if (kindSel) kindSel.onchange = () => { S.cobuildFilter = { ...S.cobuildFilter, kind: kindSel.value }; renderCobuildBody(); };
  const groupBtn = $('#cb-group-toggle');
  if (groupBtn) groupBtn.onclick = () => { S.cobuildGroup = !S.cobuildGroup; renderCobuildBody(); };
  box.querySelectorAll('[data-cb-agent]').forEach(btn => {
    btn.onclick = () => {
      const agent = btn.dataset.cbAgent;
      S.cobuildFilter = { ...S.cobuildFilter, agent: S.cobuildFilter.agent === agent ? '' : agent };
      renderCobuildBody();
    };
  });
  box.onclick = async e => {
    const btn = e.target.closest('[data-cb-void]');
    if (!btn) return;
    const reason = prompt('标记此条打卡作废？原记录会保留。\n请写作废原因：');
    if (reason === null) return;
    const r = await apiPost('/api/plugin/cobuild/void', { id: btn.dataset.cbVoid, reason: reason.trim() });
    if (!r || !r.ok) return toast((r && r.error) || '操作失败', 'error');
    S.cobuild = r;
    renderCobuildBody();
    toast('已标记作废（原记录保留）', 'success');
  };
}

async function loadCobuild() {
  const box = $('#cobuild-body');
  if (!box) return;
  if (S.cobuild && S.cobuild.ok) renderCobuildBody();   // 先用缓存渲染，返回首页不闪空
  try {
    S.cobuild = await api('/api/plugin/cobuild/data');
  } catch (e) {
    box.innerHTML = `<div class="cb-error"><span>共建声明读取失败：${esc(e.message)}</span><button class="mini-btn" id="cb-retry">重试</button></div>`;
    const r = $('#cb-retry');
    if (r) r.onclick = () => loadCobuild();
    return;
  }
  renderCobuildBody();
}

function openCobuildCheckin() {
  const d = S.cobuild || {};
  const kinds = (d.kinds && d.kinds.length) ? d.kinds : [
    { id: 'feature', label: '新增功能' }, { id: 'fix', label: '修正问题' },
    { id: 'refactor', label: '重构' }, { id: 'ui', label: '界面样式' },
    { id: 'docs', label: '文档说明' }, { id: 'data', label: '数据配置' },
    { id: 'handoff', label: '交接同步' }, { id: 'other', label: '其他' }];
  const lastAgent = localStorage.getItem('rt_cobuild_agent') || '';
  const lastKind = localStorage.getItem('rt_cobuild_kind') || 'feature';
  const body = `<div class="cb-form">
    <label class="field">协作者（AI / 模型 / 会话）<input class="input" id="cb-agent" maxlength="60" placeholder="例：DeepSeek Harness · deepseek-flash" value="${esc(lastAgent)}"></label>
    <label class="field">类型<select class="input" id="cb-kind">${kinds.map(k => `<option value="${esc(k.id)}"${k.id === lastKind ? ' selected' : ''}>${esc(k.label)}</option>`).join('')}</select></label>
    <label class="field">改动内容（这次到底做了什么）<textarea class="input" id="cb-action" rows="3" maxlength="400" placeholder="例：首页新增「关于多 AI 共建的声明」与打卡记录"></textarea></label>
    <label class="field">涉及文件（逗号或换行分隔）<input class="input" id="cb-files" placeholder="ui/web/static/app.js, modules/cobuild.py"></label>
    <label class="field">备注 / 交接说明<textarea class="input" id="cb-note" rows="2" maxlength="1000" placeholder="为什么改 · 已知风险 · 下一步做什么"></textarea></label>
    <div class="cb-form-tip">时间由服务器自动生成；记录只增不删（填错可标记作废）。提交后同步写入 <code>docs/多AI共建日志.md</code>，并立即出现在首页。</div>
  </div>`;
  const m = modal({ title: '✍️ 打卡 · 记录本次改动', body, actions: [
    { label: '取消', cls: 'soft', onClick: mask => mask.remove() },
    { label: '提交打卡', onClick: mask => submitCobuild(m, mask) },
  ]});
  return m;
}

async function submitCobuild(m, mask) {
  const q = s => m.body.querySelector(s);
  const agent = (q('#cb-agent').value || '').trim();
  const action = (q('#cb-action').value || '').trim();
  if (!agent) return toast('请填写协作者', 'warn');
  if (!action) return toast('请填写改动内容', 'warn');
  const payload = {
    agent, action, kind: q('#cb-kind').value,
    files: q('#cb-files').value || '', note: (q('#cb-note').value || '').trim(),
  };
  const r = await apiPost('/api/plugin/cobuild/checkin', payload);
  if (!r || !r.ok) return toast((r && r.error) || '打卡失败', 'error');
  localStorage.setItem('rt_cobuild_agent', agent);
  localStorage.setItem('rt_cobuild_kind', payload.kind);
  S.cobuild = r;
  mask.remove();
  renderCobuildBody();
  toast('打卡成功 ✓ 本次改动已留痕', 'success');
}

function renderHubInto(body) {
  const d = S.toolConf;
  clearPaneHead('top');
  body.innerHTML = `
      <div class="gcard" style="margin-bottom:14px;">
        <div class="section-title"><span class="st-emoji">🧰</span>通用工具</div>
        <div class="tool-topbar">
          <button class="btn" id="afn-btn">📌 所有功能<span class="afn-count">${visibleTools(d).length}</span></button>
          <button class="btn soft" id="tool-filter-toggle">⭐ 评级筛选<span class="afn-count" id="tool-filter-count">${d.ratingFilters.conditions.length || ''}</span></button>
          <button class="btn soft" id="cb-open">🤝 AI共建日志</button>
          <div class="shelf-add">
            <input class="input" id="shelf-new" placeholder="新架子名" maxlength="12">
            <button class="btn soft sm" id="shelf-add">＋ 建架子</button>
          </div>
        </div>
        <div class="tool-filter-panel ${d.ratingFilters.open ? '' : 'hidden'}" id="tool-filter-panel">
          <div class="tool-filter-head"><b>组合筛选</b><span class="tool-filter-help">星级按 1–3 计算；未评定的工具不会匹配条件。</span></div>
          <div class="tool-filter-logic">
            <span>满足</span>
            <select class="input" id="tool-filter-match"><option value="all" ${d.ratingFilters.match === 'all' ? 'selected' : ''}>全部条件（AND）</option><option value="any" ${d.ratingFilters.match === 'any' ? 'selected' : ''}>任一条件（OR）</option></select>
          </div>
          <div id="tool-rating-filters">${toolRatingFilterHTML(d)}</div>
          <div class="tool-filter-actions"><button class="btn soft sm" id="tool-filter-add">＋ 添加条件</button><button class="btn sm" id="tool-filter-reset">清除全部条件</button></div>
        </div>
      </div>
      <div class="shelf-grid" id="shelf-grid">
        ${d.shelves.map(sh => shelfHTML(sh, d)).join('')}
      </div>`;
  $('#afn-btn').onclick = () => openAllFnsModal();
  $('#cb-open').onclick = () => switchPage('cobuild');
  $('#tool-filter-toggle').onclick = () => {
    d.ratingFilters.open = !d.ratingFilters.open;
    $('#tool-filter-panel').classList.toggle('hidden', !d.ratingFilters.open);
    saveToolShelves(d);
  };
  $('#tool-filter-add').onclick = addToolRatingFilter;
  $('#tool-filter-reset').onclick = () => {
    d.ratingFilters.conditions = [];
    saveToolShelves(d);
    $('#tool-rating-filters').innerHTML = toolRatingFilterHTML(d);
    refreshToolShelfGrid(); updateToolFilterCount();
  };
  $('#tool-filter-match').onchange = e => {
    d.ratingFilters.match = e.target.value; saveToolShelves(d); refreshToolShelfGrid();
  };
  $('#tool-rating-filters').onchange = e => {
    const i = Number(e.target.dataset.filterIndex), key = e.target.dataset.filterKey;
    if (!Number.isInteger(i) || !key || !d.ratingFilters.conditions[i]) return;
    d.ratingFilters.conditions[i][key] = key === 'value' ? Number(e.target.value) : e.target.value;
    saveToolShelves(d); refreshToolShelfGrid();
  };
  $('#tool-rating-filters').onclick = e => {
    const b = e.target.closest('[data-filter-del]');
    if (!b) return;
    d.ratingFilters.conditions.splice(Number(b.dataset.filterDel), 1);
    saveToolShelves(d); $('#tool-rating-filters').innerHTML = toolRatingFilterHTML(d);
    refreshToolShelfGrid(); updateToolFilterCount();
  };
  $('#shelf-add').onclick = () => {
    const name = $('#shelf-new').value.trim();
    if (!name) return toast('请输入架子名', 'warn');
    d.shelves.push({ id: 'sh' + Date.now(), name, fixed: false });
    saveToolShelves(d);
    renderTools();
    toast('架子「' + name + '」已创建 ✓', 'success');
  };
  body.onclick = e => {
    const star = e.target.closest('[data-rate-field], [data-rate-clear]');
    if (star) {
      e.preventDefault(); e.stopPropagation();
      const tid = star.closest('[data-rating-tool]').dataset.ratingTool;
      const field = star.dataset.rateField || star.dataset.rateClear;
      if (!d.ratings[tid]) d.ratings[tid] = {};
      if (star.dataset.rateClear) delete d.ratings[tid][field];
      else d.ratings[tid][field] = Number(star.dataset.rateValue);
      saveToolShelves(d); refreshToolShelfGrid();
      return;
    }
    const b = e.target.closest('.tool-card');
    if (b) openToolInFocused(b.dataset.tool);
  };
  body.onkeydown = e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.tool-card')) {
      e.preventDefault(); openToolInFocused(e.target.dataset.tool);
    }
  };
  $('#shelf-grid').onclick = e => {
    const op = e.target.closest('[data-op]');
    if (!op) return;
    const shId = op.closest('.shelf-card').dataset.shelf;
    const shelf = d.shelves.find(x => x.id === shId);
    if (op.dataset.op === 'rename') {
      const v = prompt('重命名架子：', shelf.name);
      if (v && v.trim()) { shelf.name = v.trim(); saveToolShelves(d); renderTools(); toast('已重命名 ✓', 'success'); }
    } else if (op.dataset.op === 'del') {
      if (shelf.fixed) return;
      if (!confirm(`删除架子「${shelf.name}」？其上的功能将移回「通用」。`)) return;
      d.shelves = d.shelves.filter(x => x.id !== shId);
      allTools().forEach(t => { if (d.placement[t.id] === shId) d.placement[t.id] = 'gen'; });
      saveToolShelves(d); renderTools();
      toast('架子已删除，功能移回「通用」', 'info');
    }
  };
  wireShelfDrag();
}

function renderTools() {
  const page = $('#tools-shell') || $('#page-tools');
  if (!page) return;
  if (!page.querySelector('#tool-split')) page.innerHTML = toolsSplitHTML();
  const topBody = paneBody('top');
  if (!S.tool || S.tool === 'hub') {
    S.tool = 'hub';
    S.toolConf = loadToolShelves();
    RT_SPLIT.tool.top = 'hub';
    renderHubInto(topBody);
  } else {
    RT_SPLIT.tool.top = S.tool;
    renderToolIntoPane('top', S.tool);
  }
  updateSplitUI();
}

/* ---------- 通用工具 Hub 跳转（同步标题/高亮/状态） ---------- */
function goToolsHub() {
  S.tool = 'hub';
  $('#page-title').textContent = NAV.tools[0];
  $('#top-sub').textContent = NAV.tools[1];
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.nav === 'tools'));
  S.page = 'tools';
  renderTools();
}

/* ============================================================
   全局 AI 中断机制：按下中断按钮后置位标志 → 所有 AI 流程检查点立即终止
   （不再重试、不再监听回复与状态），挂起的请求被 AbortController 中止，
   后端卡住的网页会话等待由 /api/plugin/webchat/restart 强制打断（关闭浏览器上下文）
   ============================================================ */
let FQ_ABORT = false;
const FQ_ABORT_CTLS = new Set();
const FQ_AI_POST = ['/api/plugin/webchat/chat', '/api/plugin/webchat/new', '/api/plugin/webchat/restart', '/api/plugin/finance/crawl', '/api/plugin/ai/chat'];
function fqAbortReset() { FQ_ABORT = false; }
function fqAbortCheck() { if (FQ_ABORT) { const e = new Error('⛔ 已手动中断'); e.name = 'AbortError'; throw e; } }
function fqAbortNow(msg) {
  FQ_ABORT = true;
  FQ_ABORT_CTLS.forEach(c => { try { c.abort(); } catch (e) {} });
  FQ_ABORT_CTLS.clear();
  try { fetch('/api/plugin/webchat/restart', { method: 'POST' }).catch(() => {}); } catch (e) {}
  toast('⛔ 已中断：' + (msg || 'AI 任务') + '（不再监听回复与状态）', 'warn');
}
function fqIsAiPost(url) { return FQ_AI_POST.some(x => String(url).includes(x)); }
function fqAbortBtnHTML() {
  return '<button class="btn sm fq-abort" style="font-size:12px;padding:2px 14px;background:#d2455a;color:#fff;border:none;border-radius:8px;cursor:pointer;">⛔ 中断 AI 任务</button>';
}
function fqAbortMount(host, msg) {
  /* 在宿主元素末尾注入 / 复用中断按钮（按下 → fqAbortNow：置位标志 + 中止所有挂起请求 + 后端重启浏览器打断卡住等待） */
  if (!host) return;
  if (!host.querySelector('.fq-abort')) {
    const w = document.createElement('div');
    w.style.cssText = 'text-align:right;margin-top:6px;';
    w.innerHTML = fqAbortBtnHTML();
    host.appendChild(w);
  }
  const ab = host.querySelector('.fq-abort');
  if (ab) ab.onclick = () => fqAbortNow(msg || 'AI 任务');
}

async function apiPost(url, payload) {
  if (FQ_ABORT && fqIsAiPost(url)) return { ok: false, aborted: true, error: '⛔ 已手动中断' };
  const ctl = new AbortController();
  const isAi = fqIsAiPost(url);
  if (isAi) FQ_ABORT_CTLS.add(ctl);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctl.signal,
    });
    _cache.clear();   // 写操作：全部 GET 缓存作废，下次读取必为最新（与 api() 写操作行为一致）
    try { return await r.json(); } catch (e) { return { ok: false, error: '响应解析失败' }; }
  } catch (e) {
    if (e && e.name === 'AbortError') return { ok: false, aborted: true, error: '⛔ 已手动中断' };
    return { ok: false, error: (e && e.message) || '请求失败' };
  } finally { if (isAi) FQ_ABORT_CTLS.delete(ctl); }
}

/* ============================================================
   全局
   ============================================================ */
function emptyHTML(icon, title, sub) {
  return `<div class="empty"><span class="e-icon">${icon}</span>
    <div class="e-title">${title}</div><div class="e-sub">${sub || ''}</div></div>`;
}

function switchPage(name) {
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.nav === name));
  $$('.page').forEach(p => p.classList.add('hidden'));
  if (name.startsWith('plugin:')) {
    const pid = name.slice('plugin:'.length);
    const entry = PLUGIN_NAV.find(e => e.plugin_id === pid) || null;
    const page = $('#page-plugin');
    page.classList.remove('hidden');
    page.classList.remove('page-in');
    void page.offsetWidth;
    page.classList.add('page-in');
    $('#page-title').textContent = entry ? entry.name : '插件';
    $('#top-sub').textContent = entry ? (entry.desc || '') : '';
    S.page = 'plugin';
    page.innerHTML = '<div id="nav-view"></div>';
    if (!entry) {
      page.innerHTML = emptyHTML('🧩', '插件不可用', '该导航入口已不在插件清单中');
      return;
    }
    (async () => {
      try {
        await loadPluginStyle(entry);
        await loadPluginFeature(entry);
        const render = window.__toolRenderers[entry.id];
        if (typeof render !== 'function') throw new Error('功能入口未注册：' + entry.id);
        if (S.page !== 'plugin') return;
        const host = $('#nav-view');
        if (host) render(host);
      } catch (e) {
        if (S.page === 'plugin') page.innerHTML = emptyHTML('⚠️', '插件加载失败', esc(e.message));
      }
    })();
    return;
  }
  const page = $('#page-' + name);
  page.classList.remove('hidden');
  page.classList.remove('page-in');
  void page.offsetWidth;
  page.classList.add('page-in');
  $('#page-title').textContent = NAV[name][0];
  $('#top-sub').textContent = NAV[name][1];
  S.page = name;
  if (name === 'cobuild') {
    page.innerHTML = cobuildPageHTML();
    $('#cb-back').onclick = () => switchPage('tools');
    $('#cb-checkin').onclick = openCobuildCheckin;
    loadCobuild();
    return;
  }
  if (name === 'settings') {
    page.innerHTML = settingsPageHTML();
    $('#set-back').onclick = () => switchPage('tools');
    $('#set-theme').onclick = openThemeModal;
    $('#set-clear-cache').onclick = clearVoiceCache;
    $('#set-download-dir-save').onclick = async () => {
      const value = ($('#set-download-dir').value || '').trim();
      try {
        const r = await api('/api/settings', { body: { download_dir: value } });
        if (!r || !r.ok) throw new Error((r && r.error) || '保存失败');
        S.settings = { ...(S.settings || {}), download_dir: value };
        toast('通用下载地址已保存', 'success');
      } catch (e) { toast('保存失败：' + e.message, 'error'); }
    };
    $('#dl-pick').onclick = async () => {
      try {
        await rtDlPickDirectory();
        switchPage('settings');
        toast('已设置自定义下载目录', 'success');
      } catch (e) {
        if (e && e.name !== 'AbortError') toast('选择下载目录失败：' + (e.message || e), 'error');
      }
    };
    $('#dl-reset').onclick = async () => {
      await rtDlResetDirectory();
      switchPage('settings');
      toast('已恢复浏览器默认下载', 'success');
    };
    $$('[data-dl-group-pick]').forEach(btn => {
      btn.onclick = async () => {
        const gid = btn.dataset.dlGroupPick;
        const def = (window.rtDlGroupDefs || []).find(x => x.id === gid) || {};
        try {
          await rtDlPickDirectory(gid);
          switchPage('settings');
          toast('已设置「' + (def.name || gid) + '」下载目录', 'success');
        } catch (e) {
          if (e && e.name !== 'AbortError') toast('选择分组目录失败：' + (e.message || e), 'error');
        }
      };
    });
    $$('[data-dl-group-reset]').forEach(btn => {
      btn.onclick = async () => {
        const gid = btn.dataset.dlGroupReset;
        const def = (window.rtDlGroupDefs || []).find(x => x.id === gid) || {};
        try {
          await rtDlResetDirectory(gid);
          switchPage('settings');
          toast('已回退「' + (def.name || gid) + '」到统一下载地址', 'success');
        } catch (e) {
          toast('回退分组目录失败：' + (e.message || e), 'error');
        }
      };
    });
    return;
  }
  if (name === 'tools') S.tool = 'hub';       // 每次进入工具箱回到总览
  if (name === 'tools') { renderTools(); return; }
}

/* ---------- 外观主题 ---------- */
const THEMES = [
  { id: 'pink',   name: '粉彩奶咖', c: ['#ff6f95', '#ffb199', '#fff7f1'] },
  { id: 'forest', name: '绿色森林', c: ['#2e9e6b', '#7ccb9a', '#e2f5e9'] },
  { id: 'ink',    name: '墨色山水', c: ['#3f5c6e', '#7896a8', '#e8eaf0'] },
  { id: 'galaxy', name: '橙紫星穹', c: ['#ff8a3d', '#b06bff', '#ffe3f1'] },
];
function getTheme() {
  const v = localStorage.getItem('rt_theme');
  if (!v) return 'pink';
  try { const p = JSON.parse(v); return typeof p === 'string' ? p : 'pink'; } catch (e) { return v; } // 兼容旧版裸字符串
}
function applyTheme(id) {
  if (!THEMES.some(t => t.id === id)) id = 'pink';
  document.body.dataset.theme = id;
  localStorage.setItem('rt_theme', JSON.stringify(id));
}
function openThemeModal() {
  const cur = getTheme();
  const body = `<div class="theme-grid">${THEMES.map(t => `
    <button class="theme-card${t.id === cur ? ' on' : ''}" data-theme="${t.id}">
      <span class="tc-swatch"><i style="background:${t.c[0]}"></i><i style="background:${t.c[1]}"></i><i style="background:${t.c[2]}"></i></span>
      <span class="tc-lb">${t.name}</span>
      ${t.id === cur ? '<span class="tc-ok">✓ 使用中</span>' : ''}
    </button>`).join('')}</div>`;
  const m = modal({ title: '🎨 外观主题 · 点击即切换', body, actions: [
    { label: '完成', cls: 'soft', onClick: mask => mask.remove() },
  ]});
  m.body.onclick = e => {
    const c = e.target.closest('[data-theme]');
    if (!c) return;
    applyTheme(c.dataset.theme);
    const nm = (THEMES.find(t => t.id === c.dataset.theme) || {}).name;
    toast('外观已切换：「' + nm + '」✨', 'success');
    openThemeModal();
  };
}

const SIDEBAR_COLLAPSED_KEY = 'rt_sidebar_collapsed';
function applySidebarCollapsed(collapsed) {
  const app = document.querySelector('.app');
  if (!app) return;
  app.classList.toggle('side-collapsed', !!collapsed);
  const btn = $('#side-toggle');
  if (btn) {
    btn.title = collapsed ? '展开侧栏' : '收起侧栏';
    btn.setAttribute('aria-label', btn.title);
    const icon = $('#side-toggle-icon');
    if (icon) icon.textContent = collapsed ? '»' : '«';
    const label = btn.querySelector('.side-label');
    if (label) label.textContent = collapsed ? '展开侧栏' : '收起侧栏';
  }
}
function toggleSidebar() {
  const collapsed = !document.querySelector('.app')?.classList.contains('side-collapsed');
  applySidebarCollapsed(collapsed);
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
}
async function clearVoiceCache() {
  try {
    const r = await api('/api/plugin/tts/clear-cache', { body: {} });
    toast(`已清除 ${r.count} 条语音缓存（${r.mb} MB）`, 'success');
  } catch (e) { toast(e.message, 'error'); }
}

function wireNav() {
  $('#nav').onclick = e => {
    const b = e.target.closest('.nav-item');
    if (b) switchPage(b.dataset.nav);
  };
  $('#side-toggle').onclick = toggleSidebar;
  $('#side-settings').onclick = () => switchPage('settings');
}


/* ---------------- 启动 ---------------- */
(async function boot() {
  initParticles();
  applyTheme(getTheme());
  applySidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
  wireNav();
  // 旅行之木已整合为工具：其子页面容器迁移到 body 顶层（影子容器），
  // 由旅行之木工具内部动态挂载/归还，避免被工具页重绘销毁
  ['study', 'plan', 'review', 'add', 'import', 'kb', 'stats', 'all'].forEach(n => {
    const el = document.getElementById('page-' + n);
    if (el && el.parentNode && el.parentNode !== document.body) document.body.appendChild(el);
  });
  try {
    S.settings = await api('/api/settings');   // 宿主设置（下载分组）；学习设置由插件加载
    await loadPlugins();
    renderNav();
    applyRailCollapsed(localStorage.getItem(RAIL_COLLAPSED_KEY) === '1');
    wireRail();
    wirePaneFocus();
    switchPage('tools');   // 主界面 = 通用工具
    loadQuickbar();        // 快捷按钮列表来自宿主 settings.json（异步，不阻塞首屏）
    prefSyncFromServer();  // 本地先渲染，后端配置异步对齐
    // 页面数据由对应页面首次打开时按需请求，避免首屏后的请求突发和数据库排队。
  } catch (e) {
    document.body.innerHTML = `<div style="display:grid;place-items:center;height:100vh;font-size:16px;color:#b04a5a;">
      <div>无法连接本地服务：${esc(e.message)}<br><span style="font-size:13px;color:#a08496;">请先运行 python main.py 启动服务</span></div></div>`;
  }
})();

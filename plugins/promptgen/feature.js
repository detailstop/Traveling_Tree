'use strict';
/* 按需加载的功能模块：promptgen */
(function () {
  let ROOT = null;
/* ============================================================
   提示词生成器 · 四界面体系（按设计文档阶段 0–7）
   工作流提示词：完整实现
   模块化提示词 / 专有任务提示词：后续里程碑接入（占位）
   拓展与调试区：占位（暂未开放）
   ============================================================ */
const PG_SCHEMA = 5;
const PG_SCHEMA_V3 = 3;
const PG_SCHEMA_V4 = 4;
const PG_DEFAULT_GROUP = 'default';
const PG_TABS = [
  { id: 'home', name: '首页' },
  { id: 'flow', name: '工作流提示词' },
  { id: 'mod', name: '模块化提示词' },
  { id: 'task', name: '专有任务提示词' },
  { id: 'dbg', name: '拓展与调试区' },
];
let PG = null;
let pgBooksCache = null;
function pgDefaultGroup() { return { id: PG_DEFAULT_GROUP, name: '默认组别', order: 0 }; }
function pgDefaultInternalSource() {
  return { project: 'russian_reader', api: 'pending_cleaning' };
}
function pgNormalizeV3(raw) {
  raw.flowGroups = Array.isArray(raw.flowGroups) ? raw.flowGroups : [];
  const seen = new Set();
  raw.flowGroups = raw.flowGroups.filter(g => {
    if (!g || typeof g !== 'object' || !g.id || seen.has(g.id)) return false;
    seen.add(g.id); return true;
  }).map((g, i) => ({
    id: String(g.id),
    name: String(g.name || '未命名组别'),
    order: Number.isFinite(Number(g.order)) ? Number(g.order) : i + 1,
  }));
  let def = raw.flowGroups.find(g => g.id === PG_DEFAULT_GROUP);
  if (!def) { def = pgDefaultGroup(); raw.flowGroups.unshift(def); }
  def.order = 0;
  const groupIds = new Set(raw.flowGroups.map(g => g.id));
  (raw.flows || []).forEach(f => {
    if (!f.groupId || !groupIds.has(f.groupId)) f.groupId = PG_DEFAULT_GROUP;
    (f.versions || []).forEach(v => {
      if (!Array.isArray(v.vars)) v.vars = [];
      v.vars.forEach(x => {
        if (typeof x.allowInternalFetch !== 'boolean') x.allowInternalFetch = false;
        if (!('internalSource' in x)) x.internalSource = null;
      });
    });
  });
  raw.schema = PG_SCHEMA_V3;
  return raw;
}
function pgNormalizeV4(raw) {
  (raw.flows || []).forEach(f => {
    (f.versions || []).forEach(v => {
      if (!Array.isArray(v.vars)) v.vars = [];
      v.vars.forEach(x => {
        if (typeof x.allowInternalFetch !== 'boolean') x.allowInternalFetch = false;
        if (!Array.isArray(x.bgSelectedIds)) x.bgSelectedIds = [];
        x.bgSelectedIds = x.bgSelectedIds.filter(id => typeof id === 'string' && id);
        if (!('internalSource' in x)) x.internalSource = null;
        if (x.internalSource && typeof x.internalSource === 'object') {
          if (!Array.isArray(x.internalSource.bgSelectedIds)) {
            x.internalSource.bgSelectedIds = x.bgSelectedIds.slice();
          } else {
            x.internalSource.bgSelectedIds = x.internalSource.bgSelectedIds.filter(id => typeof id === 'string' && id);
            x.bgSelectedIds = x.internalSource.bgSelectedIds.slice();
          }
        }
      });
    });
  });
  raw.schema = PG_SCHEMA_V4;
  return raw;
}
function pgNormalizeV5(raw, resetLocations = false) {
  (raw.flows || []).forEach(f => {
    if (resetLocations || !f.varLocations || typeof f.varLocations !== 'object' || Array.isArray(f.varLocations)) {
      f.varLocations = {};
    } else {
      Object.keys(f.varLocations).forEach(name => {
        const loc = f.varLocations[name];
        if (!loc || typeof loc !== 'object') { delete f.varLocations[name]; return; }
        f.varLocations[name] = {
          project: String(loc.project || ''),
          api: String(loc.api || ''),
          bookId: String(loc.bookId || ''),
          type: String(loc.type || ''),
          allSelected: !!loc.allSelected,
          bgSelectedIds: Array.isArray(loc.bgSelectedIds) ? loc.bgSelectedIds.filter(id => typeof id === 'string' && id) : [],
          start: String(loc.start || ''),
          end: String(loc.end || ''),
          selected: ['all', '0', '1'].includes(String(loc.selected || '')) ? String(loc.selected) : 'all',
        };
      });
    }
    (f.versions || []).forEach(v => {
      if (!Array.isArray(v.vars)) v.vars = [];
      v.vars.forEach(x => {
        delete x.bgSelectedIds;
        if (x.internalSource && typeof x.internalSource === 'object') {
          const src = x.internalSource;
          x.internalSource = { project: src.project, api: src.api };
        }
      });
    });
  });
  raw.schema = PG_SCHEMA;
  return raw;
}
function pgMigrateV1ToV2(raw) {
  /* v1 → v2：工作流只保留最新一版并重置为 v1；
     正文取旧版最新版本的结果（prompt），为空时以旧版正文模板（template）兜底；清空 runs。 */
  let fallback = 0;
  (raw.flows || []).forEach(f => {
    const versions = Array.isArray(f.versions) ? f.versions : [];
    const latest = versions.length ? versions[versions.length - 1] : null;
    const hasPrompt = !!(latest && (latest.prompt || '').trim());
    const body = latest ? (hasPrompt ? latest.prompt : (latest.template || '')) : '';
    if (latest && !hasPrompt && (latest.template || '').trim()) fallback += 1;
    f.versions = [{
      v: 1,
      time: (latest && latest.time) || new Date().toISOString(),
      note: (latest && latest.note) || '',
      body,
      vars: (latest && Array.isArray(latest.vars)) ? latest.vars : [],
    }];
    delete f.runs;
    raw.flowV[f.id] = 1;
  });
  raw.schema = 2;
  return fallback;
}
function pgMigrate(raw) {
  const fromSchema = Number(raw.schema) || 1;
  let fallback = 0;
  if (fromSchema < 2) fallback = pgMigrateV1ToV2(raw);
  pgNormalizeV3(raw);
  pgNormalizeV4(raw);
  pgNormalizeV5(raw, true);
  raw.migrateInfo = {
    at: new Date().toISOString(), fromSchema, toSchema: PG_SCHEMA,
    total: (raw.flows || []).length, fallback, groups: (raw.flowGroups || []).length,
  };
  return raw;
}
async function pgLoad() {
  try {
    const d = await api('/api/plugin/promptgen/state');
    const raw = d && d.state;
    if (raw && Array.isArray(raw.flows) && Array.isArray(raw.modules) && Array.isArray(raw.tasks)) {
      if (!Array.isArray(raw.connections)) raw.connections = [];
      if (!Array.isArray(raw.refs)) raw.refs = [];
      if (!raw.flowV || typeof raw.flowV !== 'object') raw.flowV = {};
      if (raw.schema === PG_SCHEMA) return pgNormalizeV5(pgNormalizeV4(pgNormalizeV3(raw)), false);
      return pgMigrate(raw);
    }
  } catch (e) { /* 后端暂不可用时回退空状态 */ }
  return { schema: PG_SCHEMA, stay: 'home', flows: [], flowGroups: [pgDefaultGroup()],
    modules: [], tasks: [], connections: [], refs: [], lastUrl: '', flowV: {}, modV: {}, taskV: {} };
}
let pgSaveChain = Promise.resolve();
function pgSave() {
  if (!PG) return;
  const snapshot = JSON.parse(JSON.stringify(PG));
  pgSaveChain = pgSaveChain
    .then(() => api('/api/plugin/promptgen/state', { method: 'PUT', body: { state: snapshot } }))
    .catch(() => { /* 下一轮保存会重试；不阻塞 UI */ });
}
function pgUid() { return 'pg' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function pgFmt(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')} ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
}
function pgNextV(map, id) { map[id] = (map[id] || 0) + 1; return map[id]; }

async function renderPromptGenTool(container) {
  ROOT = container;
  const box = ROOT;
  if (!PG) {
    box.innerHTML = '<div class="gcard" style="padding:24px;color:var(--text-dim);">正在读取提示词资产…</div>';
    PG = await pgLoad();
  }
  box.innerHTML = `
    <div id="pg-homebar" style="margin-bottom:10px;" hidden>
      <button class="btn sm" data-pg-home>← 返回首页</button>
    </div>
    <div id="pg-body"></div>`;
  if (!box.dataset.pgHomeBound) {
    box.dataset.pgHomeBound = '1';
    box.addEventListener('click', e => {
      if (e.target.closest('[data-pg-home]')) { e.preventDefault(); pgGo('home'); }
    });
  }
  pgGo(PG.stay && PG_TABS.some(t => t.id === PG.stay) ? PG.stay : 'home');
}
function pgGo(view) {
  PG.stay = view; pgSave();
  const bar = $('#pg-homebar');
  if (bar) bar.hidden = view === 'home';
  const body = $('#pg-body');
  if (!body) return;
  if (view === 'home') pgRenderHome(body);
  else if (view === 'flow') pgRenderFlow(body);
  else if (view === 'mod') pgRenderMod(body);
  else if (view === 'task') pgRenderTask(body);
  else pgRenderDbg(body);
}

/* ---------- 首页（四个功能区入口） ---------- */
function pgRenderHome(body) {
  body.innerHTML = `
    <div class="gcard" style="min-height:300px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;">
      <div class="section-title" style="margin-bottom:18px;"><span class="st-emoji">📝</span>提示词生成器</div>
      <div style="font-size:13px;color:var(--text-dim);margin-bottom:18px;">选择要进入的界面</div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(180px,1fr));gap:10px;width:min(560px,100%);">
        ${PG_TABS.filter(t => t.id !== 'home').map(t =>
          `<a href="javascript:void 0" data-pg-go="${t.id}" style="display:block;padding:16px 18px;text-align:center;color:var(--text-2);text-decoration:none;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.55);font-size:15px;">${t.name}</a>`).join('')}
      </div>
    </div>`;
  body.querySelectorAll('[data-pg-go]').forEach(a => a.onclick = () => pgGo(a.dataset.pgGo));
}

/* ---------- 工作流提示词（工作区正文 → 保存版本） ---------- */
const PG_FLOW_SCHEMA = 2;
function pgStamp() { return new Date().toISOString(); }
function pgFlowNew() {
  return { id: pgUid(), name: '', desc: '', archived: false, created: pgStamp(), updated: pgStamp(), groupId: PG_DEFAULT_GROUP,
    varLocations: {},
    versions: [{ v: 1, time: pgStamp(), note: '初始版本', body: '', vars: [] }] };
}
function pgFlowCur(f) { return (f && f.versions && f.versions.length) ? f.versions[f.versions.length - 1] : { v: 0, note: '', body: '', vars: [] }; }
function pgFlowFind(id) { return PG.flows.find(x => x.id === id); }
function pgFlowGroupsSorted() {
  return (PG.flowGroups || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.name).localeCompare(String(b.name)));
}
function pgGroupFind(id) { return (PG.flowGroups || []).find(g => g.id === id); }
function pgGroupName(id) { return (pgGroupFind(id) || {}).name || '默认组别'; }
async function pgLoadBooksCache() {
  if (pgBooksCache !== null) return pgBooksCache;
  try {
    const res = await fetch('/api/plugin/book_reader/books');
    const data = await res.json();
    pgBooksCache = (!res.ok || data.ok === false) ? [] : (data.books || []);
  } catch (e) {
    pgBooksCache = [];
  }
  return pgBooksCache;
}
function pgFlowNextV(f) {
  const maxV = f.versions.reduce((m, v) => Math.max(m, +v.v || 0), 0);
  const next = Math.max((PG.flowV[f.id] || 0) + 1, maxV + 1);
  PG.flowV[f.id] = next;
  return next;
}
/* 工作区草稿只存在内存：刷新/离开后回到最后保存的版本 */
const pgFlowDrafts = {};
function pgFlowDraftBody(f, v) {
  const d = pgFlowDrafts[f.id];
  if (d && d.v === v) return d.body;
  const ver = f.versions.find(x => x.v === v);
  return ver ? (ver.body || '') : '';
}
function pgFlowSetDraft(f, v, body) { pgFlowDrafts[f.id] = { v, body }; }
function pgFlowDropDraft(f) { delete pgFlowDrafts[f.id]; }

function pgFlowValidate(body, vars) {
  const errs = [];
  const names = new Set();
  vars.forEach(v => {
    const n = (v.name || '').trim();
    if (!n) return;
    if (names.has(n)) errs.push('变量名重复：' + n);
    names.add(n);
  });
  const re = /\{\{\s*([^}]+?)\s*\}\}/g;
  let m;
  while ((m = re.exec(body || ''))) {
    const n = m[1].trim();
    if (!names.has(n)) errs.push('模板引用了未声明变量：{{' + n + '}}');
  }
  return errs;
}
function pgFlowCheckValues(vars, values) {
  const errs = [];
  vars.forEach(v => {
    if (v.allowInternalFetch) return;
    const raw = values[v.name] !== undefined && values[v.name] !== null ? String(values[v.name]) : '';
    const val = raw.trim();
    if (v.required && !val) errs.push('必填变量未填写：' + v.name);
    if (v.type === 'number' && val && isNaN(Number(val))) errs.push('数字类型校验失败：' + v.name + '（需为数字）');
  });
  return errs;
}
function pgFlowExport(f) {
  const data = JSON.stringify({
    schema: PG_FLOW_SCHEMA, type: 'workflow', id: f.id, name: f.name, desc: f.desc,
    created: f.created, updated: f.updated, archived: f.archived,
    versions: f.versions.map(v => ({ v: v.v, time: v.time, note: v.note || '', name: v.name || '', body: v.body || '', vars: v.vars || [] })),
  }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  window.rtDownloadBlob(blob, '工作流-' + (f.name || '未命名') + '-v' + pgFlowCur(f).v + '.json', 'promptgen');
}
/* 按变量生成的 Markdown 只走浏览器/自定义目录下载（不落后端、不调用 webchat）。 */
function pgDownloadMarkdown(filename, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  window.rtDownloadBlob(blob, filename, 'promptgen');
}
function pgFileNamePart(name) {
  return String(name || '未命名').replace(/[\\/:*?"<>|\r\n]+/g, '_').trim() || '未命名';
}
function pgRenderFlow(body) {
  const q = { s: '', arch: 'all', sort: 'recent' };
  const draw = () => {
    let list = PG.flows.slice();
    if (q.s) { const k = q.s.toLowerCase(); list = list.filter(f => (f.name + ' ' + (f.desc || '') + ' ' + pgFlowCur(f).vars.map(v => v.name).join(' ')).toLowerCase().includes(k)); }
    if (q.arch === 'arch') list = list.filter(f => f.archived);
    else if (q.arch === 'active') list = list.filter(f => !f.archived);
    if (q.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else list.sort((a, b) => new Date(b.updated) - new Date(a.updated));
    const groups = pgFlowGroupsSorted();
    const groupIds = new Set(groups.map(g => g.id));
    PG.flows.forEach(f => { if (!groupIds.has(f.groupId)) f.groupId = PG_DEFAULT_GROUP; });
    const info = PG.migrateInfo;
    const cardHTML = f => {
      const cur = pgFlowCur(f);
      return `<div class="gcard pg-flow-card" data-pgf="${f.id}" draggable="true" title="拖拽到其他组别" style="cursor:grab;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-weight:700;">${esc(f.name || '未命名')}</span>
          <span class="tag">v${cur.v}</span>
          ${f.archived ? '<span class="tag" style="color:var(--text-dim);">已归档</span>' : ''}
          <span style="font-size:12px;color:var(--text-dim);">变量 ${cur.vars.length} · 版本 ${f.versions.length} · ${pgFmt(f.updated)}</span>
          <button class="btn sm" data-pgfout="${f.id}" style="margin-left:auto;color:#2e6be6;">📋 按变量生成</button>
        </div>
        ${f.desc ? `<div style="font-size:12px;color:var(--text-dim);margin-top:4px;">${esc(f.desc)}</div>` : ''}
      </div>`;
    };
    body.innerHTML = `
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">📋</span>工作流提示词
          <span style="font-size:12px;color:var(--text-dim);font-weight:400;">工作区正文 · 显式变量 · 保存成版本</span>
          <button class="btn sm" id="pgf-new" style="margin-left:auto;">＋ 新建工作流</button></div>
        ${info ? `<div style="font-size:11.5px;color:var(--text-dim);margin-top:6px;">${info.fromSchema === 1 ? `已迁移 ${info.total} 个工作流为单版本${info.fallback ? `（其中 ${info.fallback} 个以原正文模板兜底）` : ''}；` : `已升级到 schema ${info.toSchema || 5}：${info.total} 个工作流归入组别，旧变量默认关闭内部获取；精确定位已清空，版本快照仅保留来源/接口；`}迁移前原始数据已保存在数据库 raw_json 兜底字段。</div>` : ''}
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center;">
          <input class="input" id="pgf-s" placeholder="搜索名称 / 用途 / 变量名…" value="${esc(q.s)}" style="flex:2;min-width:180px;">
          <select class="input" id="pgf-arch" style="width:110px;">
            <option value="all" ${q.arch === 'all' ? 'selected' : ''}>全部</option>
            <option value="active" ${q.arch === 'active' ? 'selected' : ''}>未归档</option>
            <option value="arch" ${q.arch === 'arch' ? 'selected' : ''}>已归档</option>
          </select>
          <select class="input" id="pgf-sort" style="width:130px;">
            <option value="recent" ${q.sort === 'recent' ? 'selected' : ''}>最近使用</option>
            <option value="created" ${q.sort === 'created' ? 'selected' : ''}>创建时间</option>
            <option value="name" ${q.sort === 'name' ? 'selected' : ''}>名称排序</option>
          </select>
          <span style="font-size:12px;color:var(--text-dim);">共 ${list.length} 个</span>
          <button class="btn soft sm" id="pgf-newgroup">＋ 新建组别</button>
        </div>
      </div>
      ${groups.map(g => {
        const items = list.filter(f => f.groupId === g.id);
        return `<section class="pg-flow-group" data-pggroup="${esc(g.id)}">
          <div class="pg-flow-group-head">
            <b>${esc(g.name)}</b><span class="tag">${items.length}</span>
            ${g.id === PG_DEFAULT_GROUP ? '<span style="font-size:11px;color:var(--text-dim);">默认组别</span>' : ''}
            <span style="margin-left:auto;display:flex;gap:5px;">
              <button class="btn soft sm" data-pggren="${esc(g.id)}">重命名</button>
              ${g.id === PG_DEFAULT_GROUP ? '' : `<button class="btn danger sm" data-pggdel="${esc(g.id)}">删除</button>`}
            </span>
          </div>
          <div class="pg-flow-group-body">${items.length ? items.map(cardHTML).join('') : '<div class="pg-flow-empty">暂无工作流；可把其他组的工作流拖到这里</div>'}</div>
        </section>`;
      }).join('')}
      ${list.length ? '' : `<div class="gcard" style="color:var(--text-dim);font-size:13px;text-align:center;padding:40px 0;">${q.s ? '无匹配结果' : '尚无工作流，点击「＋ 新建工作流」开始'}</div>`}`;
    $('#pgf-new').onclick = () => pgFlowEdit(null);
    $('#pgf-newgroup').onclick = () => {
      const name = prompt('新组别名称（如：写作 / 翻译 / 面试）', '');
      if (name === null) return;
      const n = name.trim();
      if (!n) { toast('组别名称不能为空', 'warn'); return; }
      if ((PG.flowGroups || []).some(g => g.name === n)) { toast('组别名称已存在', 'warn'); return; }
      const order = Math.max(0, ...(PG.flowGroups || []).map(g => Number(g.order) || 0)) + 1;
      PG.flowGroups.push({ id: pgUid(), name: n, order });
      pgSave(); draw(); toast('已新建组别「' + n + '」', 'success');
    };
    $('#pgf-s').oninput = () => { q.s = $('#pgf-s').value; draw(); };
    $('#pgf-arch').onchange = () => { q.arch = $('#pgf-arch').value; draw(); };
    $('#pgf-sort').onchange = () => { q.sort = $('#pgf-sort').value; draw(); };
    body.querySelectorAll('[data-pgf]').forEach(c => c.onclick = () => pgFlowDetail(c.dataset.pgf));
    body.querySelectorAll('[data-pgfout]').forEach(b => b.onclick = (e) => { e.stopPropagation(); pgFlowOutput(b.dataset.pgfout, pgFlowCur(pgFlowFind(b.dataset.pgfout)).v); });
    body.querySelectorAll('[data-pggren]').forEach(b => b.onclick = () => {
      const g = pgGroupFind(b.dataset.pggren);
      if (!g) return;
      const name = prompt('重命名组别', g.name);
      if (name === null) return;
      const n = name.trim();
      if (!n) { toast('组别名称不能为空', 'warn'); return; }
      if ((PG.flowGroups || []).some(x => x.id !== g.id && x.name === n)) { toast('组别名称已存在', 'warn'); return; }
      g.name = n; pgSave(); draw(); toast('组别已重命名', 'success');
    });
    body.querySelectorAll('[data-pggdel]').forEach(b => b.onclick = () => {
      const g = pgGroupFind(b.dataset.pggdel);
      if (!g || g.id === PG_DEFAULT_GROUP) return;
      const count = PG.flows.filter(f => f.groupId === g.id).length;
      if (!confirm(`删除组别「${g.name}」？${count ? `组内 ${count} 个工作流将移至默认组别。` : ''}`)) return;
      PG.flows.forEach(f => { if (f.groupId === g.id) { f.groupId = PG_DEFAULT_GROUP; f.updated = pgStamp(); } });
      PG.flowGroups = PG.flowGroups.filter(x => x.id !== g.id);
      pgSave(); draw(); toast('组别已删除，组内工作流已移至默认组别', 'success');
    });
    body.querySelectorAll('[data-pggroup]').forEach(sec => {
      sec.addEventListener('dragover', e => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        sec.classList.add('dragover');
      });
      sec.addEventListener('dragleave', e => {
        if (!sec.contains(e.relatedTarget)) sec.classList.remove('dragover');
      });
      sec.addEventListener('drop', e => {
        e.preventDefault(); sec.classList.remove('dragover');
        const id = e.dataTransfer ? e.dataTransfer.getData('text/plain') : '';
        const f = pgFlowFind(id);
        const target = sec.dataset.pggroup;
        if (!f || !target || f.groupId === target) return;
        f.groupId = target; f.updated = pgStamp(); pgSave(); draw();
        toast('已移动到「' + pgGroupName(target) + '」', 'success');
      });
      sec.querySelectorAll('.pg-flow-card').forEach(card => {
        card.addEventListener('dragstart', e => {
          e.dataTransfer.setData('text/plain', card.dataset.pgf);
          e.dataTransfer.effectAllowed = 'move';
          card.classList.add('pg-dragging');
        });
        card.addEventListener('dragend', () => {
          card.classList.remove('pg-dragging');
          body.querySelectorAll('.pg-flow-group.dragover').forEach(x => x.classList.remove('dragover'));
        });
      });
    });
  };
  draw();
}

function pgFlowEdit(id) {
  const isNew = !id;
  const f = isNew ? pgFlowNew() : pgFlowFind(id);
  if (!f) return;
  if (!isNew && f.archived) { toast('已归档工作流不可编辑，请先恢复', 'warn'); return; }
  const cur = pgFlowCur(f);
  const draft = {
    name: f.name, desc: f.desc,
    body: isNew ? '' : (pgFlowDraftBody(f, cur.v) || cur.body || ''),
    vars: JSON.parse(JSON.stringify(cur.vars || [])),
  };
  const body = $('#pg-body');
  const draw = () => {
    body.innerHTML = `
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">✏️</span>${isNew ? '新建工作流' : '编辑工作流'}
          <span style="font-size:12px;color:var(--text-dim);font-weight:400;">${isNew ? '' : '当前 v' + cur.v + ' · 保存后生成新版本，原版保留'}</span>
          <button class="btn sm" id="pgf-back" style="margin-left:auto;">← 返回列表</button></div>
        <div style="margin-top:10px;">
          <label style="font-size:12px;color:var(--text-dim);">名称</label>
          <input class="input" id="pgfe-name" value="${esc(draft.name)}" placeholder="如：会议纪要整理" style="width:100%;">
          <div style="margin-top:8px;"><label style="font-size:12px;color:var(--text-dim);">用途说明（可选）</label>
          <input class="input" id="pgfe-desc" value="${esc(draft.desc)}" placeholder="该工作流的用途" style="width:100%;"></div>
          <div style="margin-top:8px;"><label style="font-size:12px;color:var(--text-dim);">工作区正文（可直接编辑；{{变量名}} 占位仅可引用已声明变量）</label>
          <textarea class="input" id="pgfe-body" rows="10" placeholder="在这里编写或粘贴提示词正文，例如：你是…请完成…其中产品名称为 {{product_name}}…" style="width:100%;resize:vertical;font-family:Consolas,Menlo,monospace;font-size:12.5px;">${esc(draft.body)}</textarea></div>
          <div style="margin-top:8px;"><label style="font-size:12px;color:var(--text-dim);">变量声明（显式 · 唯一）</label>
            <div id="pgfe-vars"></div>
            <button class="btn sm" id="pgfe-addvar">＋ 添加变量</button></div>
          <div style="margin-top:12px;display:flex;gap:10px;">
            <button class="btn" id="pgfe-save">💾 ${isNew ? '创建工作流' : '保存（生成新版本）'}</button>
            ${isNew ? '' : `<button class="btn" id="pgfe-cancel">取消</button>`}
          </div>
        </div>
      </div>`;
    $('#pgf-back').onclick = () => pgRenderFlow(body);
    if ($('#pgfe-cancel')) $('#pgfe-cancel').onclick = () => pgFlowDetail(f.id);
    const varBox = $('#pgfe-vars');
    const drawVars = () => {
      varBox.innerHTML = draft.vars.map((v, i) => {
        const src = Object.assign(pgDefaultInternalSource(), v.internalSource || {});
        if (v.allowInternalFetch && !v.internalSource) v.internalSource = Object.assign({}, src);
        const valid = (src.project === 'russian_reader' && ['pending_cleaning', 'cleaned_vocab'].includes(src.api))
          || (src.project === 'bg_review' && src.api === 'bg_tree_export');
        const showApi = !!src.project;
        const apiOpts = src.project === 'russian_reader'
          ? `<option value="pending_cleaning" ${src.api === 'pending_cleaning' ? 'selected' : ''}>待清洗数据</option><option value="cleaned_vocab" ${src.api === 'cleaned_vocab' ? 'selected' : ''}>已清洗数据</option>`
          : (src.project === 'bg_review' ? `<option value="bg_tree_export" ${src.api === 'bg_tree_export' ? 'selected' : ''}>节点树框选</option>` : '');
        return `<div class="pg-var-block">
          <div class="pg-var-row">
            <input class="input" data-vn="${i}" placeholder="变量名" value="${esc(v.name)}" style="width:140px;">
            <select class="input" data-vt="${i}" style="width:100px;">
              <option value="text" ${v.type === 'text' ? 'selected' : ''}>文本</option>
              <option value="number" ${v.type === 'number' ? 'selected' : ''}>数字</option>
              <option value="option" ${v.type === 'option' ? 'selected' : ''}>选项</option>
              <option value="textarea" ${v.type === 'textarea' ? 'selected' : ''}>多行文本</option>
            </select>
            <label style="font-size:12px;color:var(--text-dim);display:flex;align-items:center;gap:3px;"><input type="checkbox" data-vr="${i}" ${v.required ? 'checked' : ''}>必填</label>
            <input class="input" data-vd="${i}" placeholder="默认值" value="${esc(v.def || '')}" style="width:100px;">
            <input class="input" data-ve="${i}" placeholder="示例值" value="${esc(v.example || '')}" style="width:110px;">
            <input class="input" data-vo="${i}" placeholder="选项（逗号分隔）" value="${esc((v.options || []).join(','))}" style="${v.type === 'option' ? 'width:140px;' : 'display:none;width:140px;'}">
            <input class="input" data-vn2="${i}" placeholder="说明（可选）" value="${esc(v.note || '')}" style="width:110px;">
            <label class="pg-internal-toggle"><input type="checkbox" data-vif="${i}" ${v.allowInternalFetch ? 'checked' : ''}>允许内部获取</label>
            <button class="btn sm" data-vdel="${i}">✕</button>
          </div>
          ${v.allowInternalFetch ? `<div class="pg-var-internal">
            <label>来源项目<select class="input" data-vip="${i}"><option value="" ${src.project === '' ? 'selected' : ''}>请选择来源项目</option><option value="russian_reader" ${src.project === 'russian_reader' ? 'selected' : ''}>俄语书籍阅读</option><option value="bg_review" ${src.project === 'bg_review' ? 'selected' : ''}>项目优化与当前综述</option></select></label>
            ${showApi ? `<label>数据接口<select class="input" data-via="${i}">${apiOpts}</select></label>` : ''}
            <div class="pg-internal-note">${valid
              ? '精确定位（书籍/类型/全选、起始条数与是否选中过，或背景库节点）在「按变量生成」弹层中选择；版本快照只保存来源与接口。'
              : (src.project ? '当前项目/接口组合非法：俄语书籍阅读只支持「待清洗数据 / 已清洗数据」，项目优化与当前综述只支持「节点树框选」。' : '请选择来源项目后，再选择该项目的合法数据接口。')}</div>
          </div>` : ''}
        </div>`;
      }).join('');
      varBox.querySelectorAll('input[data-vn]').forEach(el => el.oninput = () => { draft.vars[+el.dataset.vn].name = el.value; });
      varBox.querySelectorAll('select[data-vt]').forEach(el => el.onchange = () => { draft.vars[+el.dataset.vt].type = el.value; drawVars(); });
      varBox.querySelectorAll('input[data-vr]').forEach(el => el.onchange = () => { draft.vars[+el.dataset.vr].required = el.checked; });
      varBox.querySelectorAll('input[data-vd]').forEach(el => el.oninput = () => { draft.vars[+el.dataset.vd].def = el.value; });
      varBox.querySelectorAll('input[data-ve]').forEach(el => el.oninput = () => { draft.vars[+el.dataset.ve].example = el.value; });
      varBox.querySelectorAll('input[data-vo]').forEach(el => el.oninput = () => { draft.vars[+el.dataset.vo].options = el.value.split(/[,，]/).map(s => s.trim()).filter(Boolean); });
      varBox.querySelectorAll('input[data-vn2]').forEach(el => el.oninput = () => { draft.vars[+el.dataset.vn2].note = el.value; });
      varBox.querySelectorAll('input[data-vif]').forEach(el => el.onchange = () => {
        const v = draft.vars[+el.dataset.vif];
        v.allowInternalFetch = el.checked;
        if (el.checked) {
          v.internalSource = { project: '', api: '' };
        }
        drawVars();
      });
      varBox.querySelectorAll('select[data-vip]').forEach(el => el.onchange = () => {
        const v = draft.vars[+el.dataset.vip];
        const old = v.internalSource || {};
        const project = el.value;
        let api = '';
        if (project === 'russian_reader') api = ['pending_cleaning', 'cleaned_vocab'].includes(old.api) ? old.api : 'pending_cleaning';
        else if (project === 'bg_review') api = 'bg_tree_export';
        v.internalSource = { project, api };
        drawVars();
      });
      varBox.querySelectorAll('select[data-via]').forEach(el => el.onchange = () => {
        const v = draft.vars[+el.dataset.via];
        const old = v.internalSource || {};
        if (!old.project) { toast('请先选择来源项目', 'warn'); return; }
        const allowed = old.project === 'russian_reader' ? ['pending_cleaning', 'cleaned_vocab'] : ['bg_tree_export'];
        if (!allowed.includes(el.value)) { toast('当前来源项目不支持该数据接口', 'warn'); return; }
        v.internalSource = { project: old.project, api: el.value };
        drawVars();
      });
      varBox.querySelectorAll('button[data-vdel]').forEach(el => el.onclick = () => { draft.vars.splice(+el.dataset.vdel, 1); drawVars(); });
    };
    $('#pgfe-addvar').onclick = () => { draft.vars.push({ name: '', type: 'text', required: false, def: '', example: '', options: [], note: '', allowInternalFetch: false, internalSource: null }); drawVars(); };
    drawVars();
    $('#pgfe-save').onclick = () => {
      draft.name = $('#pgfe-name').value.trim();
      draft.desc = $('#pgfe-desc').value.trim();
      draft.body = $('#pgfe-body').value;
      if (!draft.name) { toast('请填写名称', 'warn'); return; }
      if (!draft.body.trim()) { toast('请填写工作区正文', 'warn'); return; }
      const errs = pgFlowValidate(draft.body, draft.vars);
      if (errs.length) { toast('校验失败：' + errs[0], 'warn'); return; }
      const ierrs = pgFlowCheckInternal(draft.vars);
      if (ierrs.length) { ierrs.forEach(x => toast(x, 'warn', 4200)); return; }
      const newVars = draft.vars.filter(v => v.name.trim()).map(v => {
        const src = v.internalSource
          ? { project: v.internalSource.project || '', api: v.internalSource.api || '' }
          : null;
        return {
          name: v.name.trim(), type: v.type, required: !!v.required, def: v.def || '',
          example: v.example || '', options: v.options || [], note: v.note || '',
          allowInternalFetch: !!v.allowInternalFetch,
          internalSource: src,
        };
      });
      const same = !isNew && JSON.stringify(newVars) === JSON.stringify(cur.vars || []) && draft.body === (cur.body || '') && draft.name === f.name && draft.desc === f.desc;
      if (same) { toast('内容未变化，未生成新版本', 'info'); pgFlowDetail(f.id); return; }
      if (isNew) {
        f.name = draft.name; f.desc = draft.desc; f.created = pgStamp(); f.updated = pgStamp();
        f.versions[0].body = draft.body; f.versions[0].vars = newVars;
        PG.flowV[f.id] = 1;
        PG.flows.push(f);
      } else {
        const nv = pgFlowNextV(f);
        f.versions.push({ v: nv, time: pgStamp(), note: '编辑保存', body: draft.body, vars: newVars });
        f.name = draft.name; f.desc = draft.desc; f.updated = pgStamp();
      }
      pgFlowDropDraft(f);
      pgSave();
      if (!isNew) pgRefWarnOnSave('flow', f.id, f.name || '未命名');
      toast(isNew ? '已创建工作流 v1 ✓' : '已保存 v' + pgFlowCur(f).v + '（原版保留）✓', 'success');
      pgFlowDetail(f.id);
    };
  };
  draw();
}

function pgVarInputHTML(v, val) {
  const vv = val !== undefined && val !== null ? String(val) : '';
  if (v.type === 'number') return `<input class="input" data-pgv="${esc(v.name)}" type="number" placeholder="${esc(v.example || '')}" value="${esc(vv || v.def || '')}" style="width:100%;">`;
  if (v.type === 'option') {
    const opts = (v.options || []).map(o => o.trim()).filter(Boolean);
    const sel = vv || v.def || '';
    return `<select class="input" data-pgv="${esc(v.name)}" style="width:100%;"><option value="">（请选择）</option>${opts.map(o => `<option ${o === sel ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  }
  if (v.type === 'textarea') return `<textarea class="input" data-pgv="${esc(v.name)}" rows="3" placeholder="${esc(v.example || '')}" style="width:100%;resize:vertical;">${esc(vv || v.def || '')}</textarea>`;
  return `<input class="input" data-pgv="${esc(v.name)}" placeholder="${esc(v.example || '')}" value="${esc(vv || v.def || '')}" style="width:100%;">`;
}

function pgFlowDetail(id) {
  const f = pgFlowFind(id);
  if (!f) return;
  const body = $('#pg-body');
  let selV = pgFlowCur(f).v;
  const draw = () => {
    const cur = pgFlowCur(f);
    const sel = f.versions.find(x => x.v === selV) || cur;
    const draft = pgFlowDraftBody(f, sel.v);
    const locked = !!f.archived;
    const vars = sel.vars || [];
    body.innerHTML = `
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">📄</span>${esc(f.name || '未命名')}
          <span style="font-size:12px;color:var(--text-dim);font-weight:400;">展示 v${sel.v} / 最新 v${cur.v} · ${f.archived ? '已归档（只读）' : '使用中'}</span>
          <button class="btn sm" id="pgfd-back" style="margin-left:auto;">← 返回列表</button>
          <button class="btn sm" id="pgfd-edit" ${locked ? 'disabled' : ''}>✏️ 编辑</button>
          <button class="btn sm" id="pgfd-arch">${f.archived ? '↩ 恢复' : '🗄 归档'}</button>
          <button class="btn sm" id="pgfd-exp">📤 导出 JSON</button>
          <button class="btn sm" id="pgfd-del" style="color:#e2543f;">🗑 删除</button></div>
        ${f.desc ? `<div style="font-size:12px;color:var(--text-dim);margin-top:4px;">${esc(f.desc)}</div>` : ''}
        <div style="font-size:12px;color:var(--text-dim);margin-top:4px;">创建 ${pgFmt(f.created)} · 更新 ${pgFmt(f.updated)} · 共 ${f.versions.length} 个版本</div>
      </div>
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">📝</span>工作区正文
          <span style="font-size:12px;color:var(--text-dim);font-weight:400;">可直接编辑；草稿只在当前界面，刷新会回到最后保存版本</span></div>
        <textarea class="input" id="pgfd-body" rows="14" ${locked ? 'readonly' : ''} placeholder="在这里编写提示词正文（可用 {{变量名}} 占位）" style="width:100%;margin-top:10px;resize:vertical;font-family:Consolas,Menlo,monospace;font-size:12.5px;${locked ? 'opacity:.75;' : ''}">${esc(draft)}</textarea>
        <div style="display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap;">
          <button class="btn" id="pgfd-save" ${locked ? 'disabled' : ''}>💾 保存为版本</button>
          <button class="btn soft sm" id="pgfd-copy">📋 按变量生成</button>
          <button class="btn soft sm" id="pgfd-archv" ${locked ? 'disabled' : ''}>📥 收纳到专有任务</button>
          <span style="font-size:12px;color:var(--text-dim);" id="pgfd-count">${esc(draft).length} 字</span>
          ${locked ? '<span style="font-size:12px;color:#d97706;">已归档：恢复后可编辑与保存</span>' : ''}
        </div>
        <div style="margin-top:12px;">
          <div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;">变量（当前版本快照 · 共 ${vars.length} 个）</div>
          ${vars.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;">${vars.map(v => `<span class="tag" title="${esc([v.required ? '必填' : '', v.def ? '默认 ' + v.def : '', v.example ? '示例 ' + v.example : '', (v.options || []).length ? '选项 ' + v.options.join('/') : '', v.allowInternalFetch ? '下载时从俄语书籍阅读获取待清洗数据' : ''].filter(Boolean).join(' · '))}">{{${esc(v.name)}}} · ${esc(PG_TYPE_LABEL[v.type] || v.type)}${v.required ? ' *' : ''}${v.allowInternalFetch ? ' · 内部获取' : ''}</span>`).join('')}</div>` : '<div style="font-size:12px;color:var(--text-dim);">未声明变量（正文可直接下载，不需要占位）</div>'}
        </div>
      </div>
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">🗂</span>版本记录
          <span style="font-size:12px;color:var(--text-dim);font-weight:400;">点击版本切换工作区 · 修改不覆盖原版</span></div>
        ${f.versions.slice().reverse().map(v => `
          <div data-pgver="${v.v}" style="font-size:12px;padding:7px 0;border-bottom:1px dashed var(--line);cursor:pointer;${sel.v === v.v ? 'background:var(--bg-soft);' : ''}">
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="flex:1;min-width:0;">
                <b>${esc(v.name || ('v' + v.v))}</b> <span style="color:var(--text-dim);font-size:11px;">v${v.v}</span> · ${pgFmt(v.time)} · ${esc(v.note || '')}
                <div style="font-size:11px;color:var(--text-dim);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:520px;">${esc((v.body || '').slice(0, 90))}</div>
              </div>
              <button class="btn sm" data-pgvren="${v.v}" style="flex-shrink:0;" title="重命名版本">✏️</button>
              <button class="btn sm" data-pgvdel="${v.v}" style="color:#e2543f;flex-shrink:0;">🗑 删除</button>
            </div>
          </div>`).join('')}
      </div>
      ${pgRefRender(body, 'flow', f.id, f.name || '未命名')}`;
    $('#pgfd-back').onclick = () => { pgFlowDropDraft(f); pgRenderFlow(body); };
    $('#pgfd-edit').onclick = () => { if (!locked) pgFlowEdit(f.id); };
    $('#pgfd-exp').onclick = () => pgFlowExport(f);
    $('#pgfd-del').onclick = () => pgDeleteFlow(f.id);
    $('#pgfd-arch').onclick = () => {
      const text = $('#pgfd-body').value;
      if (!f.archived && text.trim() && text !== (sel.body || '') && sel.v === cur.v) {
        const nv = pgFlowNextV(f);
        f.versions.push({ v: nv, time: pgStamp(), note: '归档前保存', body: text, vars: JSON.parse(JSON.stringify(sel.vars || [])) });
        f.updated = pgStamp();
        selV = nv;
        pgFlowDropDraft(f);
        pgSave();
      }
      if (pgRefWarnOnArchive('flow', f.id, f.name || '未命名')) { f.archived = !f.archived; f.updated = pgStamp(); pgSave(); draw(); }
    };
    $('#pgfd-body').oninput = () => {
      if (locked) return;
      pgFlowSetDraft(f, sel.v, $('#pgfd-body').value);
      const c = $('#pgfd-count');
      if (c) c.textContent = $('#pgfd-body').value.length + ' 字';
    };
    $('#pgfd-save').onclick = () => {
      if (locked) return;
      const text = $('#pgfd-body').value;
      if (!text.trim()) { toast('工作区正文为空，无法保存', 'warn'); return; }
      if (text === (sel.body || '')) { toast('与当前版本内容一致，未生成新版本', 'info'); return; }
      const nv = pgFlowNextV(f);
      f.versions.push({ v: nv, time: pgStamp(), note: '保存工作区正文', body: text, vars: JSON.parse(JSON.stringify(sel.vars || [])) });
      f.updated = pgStamp();
      selV = nv;
      pgFlowDropDraft(f);
      pgSave();
      toast('已保存为 v' + nv + '（原版保留）✓', 'success');
      draw();
    };
    $('#pgfd-copy').onclick = () => pgFlowOutput(f.id, sel.v);
    $('#pgfd-archv').onclick = () => {
      if (locked) return;
      const text = $('#pgfd-body').value.trim();
      if (!text) { toast('工作区正文为空，无可收纳', 'warn'); return; }
      PG.pendingTask = { src: 'workflow', srcId: f.id, srcName: f.name || '未命名', prompt: text, output: text, model: '工作区正文（无外部调用）', modelParams: null, review: '' };
      pgSave();
      toast('已带入收纳表单 ✓', 'success');
      pgGo('task');
    };
    body.querySelectorAll('[data-pgver]').forEach(el => el.onclick = () => {
      const v = f.versions.find(x => x.v === +el.dataset.pgver);
      if (!v) return;
      selV = v.v;
      pgFlowDropDraft(f);
      draw();
    });
    body.querySelectorAll('[data-pgvdel]').forEach(b => b.onclick = (e) => { e.stopPropagation(); pgDeleteFlowVersion(f.id, +b.dataset.pgvdel); });
    body.querySelectorAll('[data-pgvren]').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      const ver = +b.dataset.pgvren;
      const item = f.versions.find(x => x.v === ver);
      if (!item) return;
      const nn = prompt('重命名版本 v' + ver + '（留空则恢复为默认名）：', item.name || '');
      if (nn === null) return;
      item.name = nn.trim();
      f.updated = pgStamp();
      pgSave(); draw();
      toast('版本已重命名 ✓', 'success');
    });
  };
  draw();
}

function pgEmptyLocation() {
  return { project: '', api: '', bookId: '', type: '', allSelected: false, bgSelectedIds: [], start: '', end: '', selected: 'all' };
}
function pgVarLocation(f, name, source) {
  const src = source || {};
  const raw = f && f.varLocations && f.varLocations[name];
  if (!raw || typeof raw !== 'object') return pgEmptyLocation();
  if (raw.project && raw.project !== src.project) return pgEmptyLocation();
  if (raw.api && raw.api !== src.api) return pgEmptyLocation();
  return {
    project: src.project || raw.project || '',
    api: src.api || raw.api || '',
    bookId: String(raw.bookId || ''),
    type: String(raw.type || ''),
    allSelected: !!raw.allSelected,
    bgSelectedIds: Array.isArray(raw.bgSelectedIds) ? raw.bgSelectedIds.filter(id => typeof id === 'string' && id) : [],
    start: String(raw.start || ''),
    end: String(raw.end || ''),
    selected: ['all', '0', '1'].includes(String(raw.selected || '')) ? String(raw.selected) : 'all',
  };
}
function pgSaveLocation(f, name, source, patch) {
  if (!f) return;
  if (!f.varLocations || typeof f.varLocations !== 'object') f.varLocations = {};
  f.varLocations[name] = Object.assign(pgVarLocation(f, name, source), patch, {
    project: source.project || '', api: source.api || '',
  });
  pgSave();
}
function pgInternalSummary(v, loc) {
  const src = Object.assign(pgDefaultInternalSource(), v.internalSource || {});
  const l = loc || pgEmptyLocation();
  if (src.project === 'bg_review' && src.api === 'bg_tree_export') {
    return '项目优化与当前综述 · 节点树框选 · 已选 ' + (l.bgSelectedIds || []).length + ' 个节点';
  }
  if (src.project === 'russian_reader' && src.api === 'cleaned_vocab') {
    const start = l.start || '1', end = l.end || '全部';
    const sel = l.selected === '1' ? '仅选中过' : l.selected === '0' ? '仅未选中过' : '全部';
    return `已清洗数据 · 起始 ${start}–${end} 条 · ${sel}`;
  }
  if (l.allSelected) return '全部书籍 + 全部类型';
  const book = l.bookId === 'all' ? '全部书籍' : (l.bookId ? '书籍 ' + l.bookId : '未选择书籍');
  const type = l.type === 'all' ? '全部类型' : (l.type === 'word' ? '单词' : (l.type === 'phrase' ? '词组' : '未选择类型'));
  const range = (l.start || l.end) ? ` · 起始 ${l.start || '1'}–${l.end || '全部'} 条` : '';
  return book + ' · ' + type + range;
}
let pgBgTreeCache = null;
let pgBgTreeError = '';
let pgBgTreeLoading = false;
const pgBgTreeUI = { query: '', showDeprecated: false, expanded: new Set(), inited: false };
async function pgLoadBgTree(force = false) {
  if (pgBgTreeCache && !force) return pgBgTreeCache;
  if (pgBgTreeLoading) return null;
  pgBgTreeLoading = true;
  pgBgTreeError = '';
  try {
    const res = await fetch('/api/plugin/bg_library/bg/tree');
    const data = await res.json();
    if (!res.ok || !data || data.ok === false) throw new Error((data && data.error) || ('HTTP ' + res.status));
    if (!Array.isArray(data.nodes)) throw new Error('返回数据缺少 nodes');
    pgBgTreeCache = data;
    return data;
  } catch (e) {
    pgBgTreeError = e && e.message ? e.message : '背景库节点读取失败';
    return null;
  } finally {
    pgBgTreeLoading = false;
  }
}
function pgBgToggle(loc, nodeId, checked, redraw) {
  const nodes = (pgBgTreeCache && pgBgTreeCache.nodes) || [];
  const byId = new Map(nodes.map(n => [n.id, n]));
  const set = new Set(Array.isArray(loc.bgSelectedIds) ? loc.bgSelectedIds : []);
  const walk = id => {
    if (!byId.has(id)) return;
    if (checked) set.add(id); else set.delete(id);
    nodes.filter(n => n.parent_id === id).forEach(child => walk(child.id));
  };
  walk(nodeId);
  let cur = byId.get(nodeId);
  const seen = new Set();
  while (cur && cur.parent_id && !seen.has(cur.parent_id)) {
    seen.add(cur.parent_id);
    const pid = cur.parent_id;
    if (checked) set.add(pid);
    else if (!nodes.some(n => n.parent_id === pid && set.has(n.id))) set.delete(pid);
    cur = byId.get(pid);
  }
  loc.bgSelectedIds = [...set];
  if (typeof redraw === 'function') redraw();
}
function pgBgTreeHTML(loc, i, name) {
  const selected = new Set(Array.isArray(loc && loc.bgSelectedIds) ? loc.bgSelectedIds : []);
  let content;
  if (pgBgTreeError) {
    content = `<div class="pg-bg-empty">背景库节点读取失败：${esc(pgBgTreeError)}<button class="btn soft sm" data-bg-retry="${i}">重试</button></div>`;
  } else if (!pgBgTreeCache) {
    content = '<div class="pg-bg-empty">正在读取背景库节点…</div>';
  } else {
    const nodes = pgBgTreeCache.nodes || [];
    const byId = new Map(nodes.map(n => [n.id, n]));
    const children = new Map();
    nodes.forEach(n => {
      const key = n.parent_id || '';
      if (!children.has(key)) children.set(key, []);
      children.get(key).push(n);
    });
    const q = pgBgTreeUI.query.trim().toLowerCase();
    const visible = new Set();
    if (q) {
      nodes.forEach(n => {
        if ((String(n.name || '') + ' ' + String(n.path || '')).toLowerCase().includes(q)) {
          let cur = n; const seen = new Set();
          while (cur && !seen.has(cur.id)) { seen.add(cur.id); visible.add(cur.id); cur = byId.get(cur.parent_id); }
        }
      });
    } else {
      nodes.forEach(n => visible.add(n.id));
    }
    const isDeprecatedTree = n => {
      let cur = n; const seen = new Set();
      while (cur && !seen.has(cur.id)) { seen.add(cur.id); if (cur.status === 'deprecated') return true; cur = byId.get(cur.parent_id); }
      return false;
    };
    const roots = (children.get('') || []).concat(nodes.filter(n => n.parent_id && !byId.has(n.parent_id)));
    if (!pgBgTreeUI.inited) {
      roots.forEach(n => pgBgTreeUI.expanded.add(n.id));
      pgBgTreeUI.inited = true;
    }
    const renderNode = (n, depth) => {
      if (!pgBgTreeUI.showDeprecated && isDeprecatedTree(n)) return '';
      if (q && !visible.has(n.id)) return '';
      const kids = (children.get(n.id) || []).filter(c => pgBgTreeUI.showDeprecated || !isDeprecatedTree(c));
      const open = !!q || pgBgTreeUI.expanded.has(n.id);
      const arrow = kids.length
        ? `<button class="pg-bg-exp" data-bg-exp="${esc(n.id)}" ${q ? 'disabled' : ''} title="${q ? '搜索时自动展开' : (open ? '收起' : '展开')}" aria-label="${open ? '收起' : '展开'}">${open ? '▾' : '▸'}</button>`
        : '<span class="pg-bg-exp pg-bg-exp-sp"></span>';
      const kidHtml = open ? kids.map(c => renderNode(c, depth + 1)).join('') : '';
      return `<div class="pg-bg-node" style="padding-left:${depth * 13}px">
        <div class="pg-bg-row">${arrow}<label title="${esc(n.path || n.name || '')}"><input type="checkbox" data-bg-check="${esc(n.id)}" data-bg-var="${i}" data-bg-name="${esc(name || '')}" ${selected.has(n.id) ? 'checked' : ''}>
        <span class="pg-bg-name">${esc(n.name || n.path || n.id)}</span>${n.status === 'deprecated' ? '<em class="pg-bg-dep">作废</em>' : ''}</label></div>
        <span class="pg-bg-path">${esc(n.path || '')}</span></div>${kidHtml}`;
    };
    const body = roots.map(n => renderNode(n, 0)).join('') || '<div class="pg-bg-empty">没有匹配的节点</div>';
    content = `<div class="pg-bg-bar">
        <input class="input" data-bg-search="${i}" placeholder="搜索节点名称/路径" value="${esc(pgBgTreeUI.query)}">
        <button class="btn soft sm" data-bg-search-btn="${i}">搜索</button>
        <label class="pg-bg-show"><input type="checkbox" data-bg-show="${i}" ${pgBgTreeUI.showDeprecated ? 'checked' : ''}>显示作废</label>
        <button class="btn soft sm" data-bg-expand-all="${i}">全部展开</button>
        <button class="btn soft sm" data-bg-collapse-all="${i}">全部收起</button>
      </div>
      <div class="pg-bg-list">${body}</div>
      <div class="pg-bg-count">已选 ${selected.size} 个节点 · 勾选父节点会联动子节点 · 默认仅展开根节点下一层</div>`;
  }
  return `<div class="pg-bg-tree">${content}<div class="pg-internal-note">下载时调用 <code>POST /api/plugin/bg_library/bg/export {selected_ids}</code> 取回所选节点的 export 包并替换 {{变量}}；不补祖先链、不写背景库。未选节点/失败/空 nodes 会阻断下载。</div></div>`;
}
async function pgFetchPendingForVar(v, loc) {
  const src = Object.assign(pgDefaultInternalSource(), v.internalSource || {});
  if (src.project !== 'russian_reader' || src.api !== 'pending_cleaning') {
    throw new Error('变量「' + v.name + '」的内部来源配置无效');
  }
  const l = loc || pgEmptyLocation();
  if (!l.allSelected && (!l.bookId || !l.type)) {
    throw new Error('变量「' + v.name + '」未选择书籍/类型');
  }
  const bookId = l.allSelected ? 'all' : l.bookId;
  const type = l.allSelected ? 'all' : l.type;
  const params = new URLSearchParams();
  if (bookId !== 'all') params.set('book_id', bookId);
  if (type !== 'all') params.set('mark_type', type);
  if (l.start) params.set('start', l.start);
  if (l.end) params.set('end', l.end);
  const pendingUrl = '/api/plugin/book_reader/reader/pending' + (params.toString() ? '?' + params.toString() : '');
  let res, data;
  try {
    res = await fetch(pendingUrl);
    data = await res.json();
  } catch (e) {
    throw new Error('请求待清洗数据失败：' + (e && e.message ? e.message : '网络错误'));
  }
  if (!res.ok || !data || data.ok === false) {
    throw new Error((data && data.error) || ('HTTP ' + res.status));
  }
  if (!Array.isArray(data.items) || !data.items.length) {
    throw new Error('返回空数据（可能已全部清洗或筛选无结果）');
  }
  const markIds = data.items.map(x => x && x.mark_id).filter(Boolean);
  if (!markIds.length) throw new Error('待清洗数据缺少 mark_id，无法创建清洗任务');
  const payload = { scope: bookId === 'all' ? 'global' : 'book', mark_ids: markIds };
  if (bookId !== 'all') payload.book_id = bookId;
  if (l.start) payload.start = l.start;
  if (l.end) payload.end = l.end;
  let taskRes, task;
  try {
    taskRes = await fetch('/api/plugin/book_reader/reader/cleaning/export', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    task = await taskRes.json();
  } catch (e) {
    throw new Error('创建清洗任务失败：' + (e && e.message ? e.message : '网络错误'));
  }
  if (!taskRes.ok || !task || task.ok === false) {
    throw new Error((task && task.error) || ('创建清洗任务失败（HTTP ' + taskRes.status + '）'));
  }
  if (!task.task_id || !Array.isArray(task.items) || !task.items.length) {
    throw new Error('创建清洗任务失败：未返回 task_id 或 items');
  }
  return JSON.stringify({
    project: 'russian_reader', api: 'pending_cleaning',
    task_id: task.task_id, exported_at: task.exported_at || new Date().toISOString(),
    filters: { bookId, type, allSelected: !!l.allSelected, start: l.start || '', end: l.end || '' },
    items: task.items,
  }, null, 2);
}
async function pgFetchBgExportForVar(v, loc) {
  const src = Object.assign(pgDefaultInternalSource(), v.internalSource || {});
  if (src.project !== 'bg_review' || src.api !== 'bg_tree_export') {
    throw new Error('变量「' + v.name + '」的内部来源配置无效');
  }
  const ids = Array.isArray(loc && loc.bgSelectedIds) ? loc.bgSelectedIds.filter(Boolean) : [];
  if (!ids.length) throw new Error('变量「' + v.name + '」未选择背景库节点');
  let res, data;
  try {
    res = await fetch('/api/plugin/bg_library/bg/export', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected_ids: ids }),
    });
    data = await res.json();
  } catch (e) {
    throw new Error('请求背景库导出包失败：' + (e && e.message ? e.message : '网络错误'));
  }
  if (!res.ok || !data || data.ok === false) {
    throw new Error((data && data.error) || ('背景库导出失败（HTTP ' + res.status + '）'));
  }
  const pkg = data.package;
  if (!pkg || !Array.isArray(pkg.nodes) || !pkg.nodes.length) {
    throw new Error('背景库导出返回空 nodes');
  }
  return JSON.stringify(pkg, null, 2);
}
async function pgFetchCleanedForVar(v, loc) {
  const src = Object.assign(pgDefaultInternalSource(), v.internalSource || {});
  if (src.project !== 'russian_reader' || src.api !== 'cleaned_vocab') {
    throw new Error('变量「' + v.name + '」的内部来源配置无效');
  }
  const l = loc || pgEmptyLocation();
  const params = new URLSearchParams();
  if (l.start) params.set('start', l.start);
  if (l.end) params.set('end', l.end);
  params.set('selected', ['all', '0', '1'].includes(l.selected) ? l.selected : 'all');
  let res, data;
  try {
    res = await fetch('/api/plugin/book_reader/reader/vocabulary/cleaned' + (params.toString() ? '?' + params.toString() : ''));
    data = await res.json();
  } catch (e) {
    throw new Error('请求已清洗数据失败：' + (e && e.message ? e.message : '网络错误'));
  }
  if (!res.ok || !data || data.ok === false) {
    throw new Error((data && data.error) || ('HTTP ' + res.status));
  }
  if (!Array.isArray(data.items) || !data.items.length) {
    throw new Error('返回空数据（可能没有已清洗词条或筛选无结果）');
  }
  const items = data.items.filter(x => x && (x.lemma || x.phrase_lemma) && x.id);
  if (!items.length) throw new Error('已清洗数据缺少原形或唯一 id');
  return { text: JSON.stringify(items.map(x => x.lemma || x.phrase_lemma), null, 2), items };
}
async function pgMarkExported(items) {
  if (!items || !items.length) return { updated: 0 };
  let res, data;
  try {
    res = await fetch('/api/plugin/book_reader/reader/vocabulary/mark-exported', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    data = await res.json();
  } catch (e) {
    throw new Error('标记已选中失败：' + (e && e.message ? e.message : '网络错误'));
  }
  if (!res.ok || !data || data.ok === false) throw new Error((data && data.error) || ('HTTP ' + res.status));
  return data;
}
function pgFlowCheckInternal(vars) {
  const errs = [];
  (vars || []).forEach(v => {
    if (!v.allowInternalFetch) return;
    const src = v.internalSource || {};
    const ok = (src.project === 'russian_reader' && ['pending_cleaning', 'cleaned_vocab'].includes(src.api))
      || (src.project === 'bg_review' && src.api === 'bg_tree_export');
    if (!ok) errs.push('变量「' + (v.name || '未命名') + '」的内部来源组合非法（需为俄语书籍阅读/待清洗数据或已清洗数据，或项目优化与当前综述/节点树框选）');
  });
  return errs;
}
async function pgFlowOutput(id, defaultV) {
  const f = pgFlowFind(id);
  if (!f) return;
  const versions = f.versions.slice();
  if (!versions.length) { toast('该工作流还没有版本', 'warn'); return; }
  const needsBooks = versions.some(v => (v.vars || []).some(x => x.allowInternalFetch && x.internalSource && x.internalSource.project === 'russian_reader'));
  const needsBg = versions.some(v => (v.vars || []).some(x => x.allowInternalFetch && x.internalSource && x.internalSource.project === 'bg_review'));
  if (needsBooks) await pgLoadBooksCache();
  if (needsBg) await pgLoadBgTree();
  if (needsBg) { pgBgTreeUI.expanded = new Set(); pgBgTreeUI.inited = false; }
  const mask = document.createElement('div');
  mask.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;';
  const close = () => mask.remove();
  const initial = versions.find(v => v.v === defaultV) || versions[versions.length - 1];
  const drafts = new Map();
  let currentVer = initial.v;
  const captureDraft = () => {
    const box = mask.querySelector('#pgfo-vars');
    if (!box) return;
    const obj = drafts.get(currentVer) || {};
    box.querySelectorAll('[data-pgv]').forEach(el => { obj[el.dataset.pgv] = el.value; });
    drafts.set(currentVer, obj);
  };
  const drawLayer = () => {
    captureDraft();
    const panel = mask.firstElementChild;
    const scrollTop = panel ? panel.scrollTop : 0;
    const sel = mask.querySelector('#pgfo-ver');
    const v = f.versions.find(x => x.v === +(sel ? sel.value : initial.v)) || initial;
    currentVer = v.v;
    const draft = drafts.get(v.v) || {};
    const raw = v.body || '';
    const pv = mask.querySelector('#pgfo-preview');
    if (pv) pv.textContent = raw;
    const vBox = mask.querySelector('#pgfo-vars');
    const vs = v.vars || [];
    const bookOptions = bid => {
      const books = pgBooksCache || [];
      const opts = ['<option value="">请选择书籍</option>', '<option value="all"' + (bid === 'all' ? ' selected' : '') + '>全部书籍</option>'];
      books.forEach(b => opts.push(`<option value="${esc(b.book_id)}" ${bid === b.book_id ? 'selected' : ''}>${esc(b.name || b.book_id)}</option>`));
      if (bid && bid !== 'all' && !books.some(b => b.book_id === bid)) {
        opts.push(`<option value="${esc(bid)}" selected>已保存书籍（${esc(bid)}）</option>`);
      }
      return opts.join('');
    };
    const rowHead = x => `<label style="font-size:12px;color:#666;">${esc(x.name)}${x.required ? '<span style="color:#e2543f;"> *</span>' : ''}${x.note ? ' · ' + esc(x.note) : ''}${x.type === 'option' && (x.options || []).length ? '（' + esc(x.options.join(' / ')) + '）' : ''}${x.allowInternalFetch ? ' · 内部获取' : ''}</label>`;
    if (vBox) {
      const bgScrolls = [];
      vBox.querySelectorAll('.pg-bg-tree').forEach(tree => {
        const list = tree.querySelector('.pg-bg-list');
        bgScrolls.push(list ? list.scrollTop : 0);
      });
      vBox.innerHTML = vs.length ? vs.map((x, idx) => {
        const src = Object.assign(pgDefaultInternalSource(), x.internalSource || {});
        const loc = pgVarLocation(f, x.name, src);
        let body = pgVarInputHTML(x, draft[x.name]);
        if (x.allowInternalFetch) {
          if (src.project === 'bg_review' && src.api === 'bg_tree_export') {
            body = `<div class="pg-output-internal" style="margin-top:5px;">下载时自动获取：项目优化与当前综述 / 节点树框选 · ${esc(pgInternalSummary(x, loc))}<br><span>将调用 <code>POST /api/plugin/bg_library/bg/export</code> 取回所选节点 export 包并替换；未选节点、失败或空 nodes 会阻断生成。替换值不补祖先链，不能直接当作 update 包的 base。</span></div>${pgBgTreeHTML(loc, idx, x.name)}`;
          } else if (src.project === 'russian_reader' && src.api === 'pending_cleaning') {
            body = `<div class="pg-output-internal" style="margin-top:5px;">
              <div style="font-size:12px;color:#666;margin-bottom:5px;">下载时自动获取：俄语书籍阅读 / 待清洗数据 · ${esc(pgInternalSummary(x, loc))}</div>
              <div class="pg-loc-grid">
                <label>书籍<select class="input" data-loc-book="${esc(x.name)}" ${loc.allSelected ? 'disabled' : ''}>${bookOptions(loc.allSelected ? 'all' : loc.bookId)}</select></label>
                <label>类型<select class="input" data-loc-type="${esc(x.name)}" ${loc.allSelected ? 'disabled' : ''}>
                  <option value="">请选择类型</option>
                  <option value="all" ${loc.type === 'all' ? 'selected' : ''}>全部类型</option>
                  <option value="word" ${loc.type === 'word' ? 'selected' : ''}>单词</option>
                  <option value="phrase" ${loc.type === 'phrase' ? 'selected' : ''}>词组</option>
                </select></label>
                <label class="pg-internal-all"><input type="checkbox" data-loc-all="${esc(x.name)}" ${loc.allSelected ? 'checked' : ''}>全选（全部书籍 + 全部类型）</label>
                <label>起始条数 <input class="input" data-pending-start="${esc(x.name)}" type="number" min="1" value="${esc(loc.start || '')}" placeholder="1" style="width:88px;"> 到 <input class="input" data-pending-end="${esc(x.name)}" type="number" min="1" value="${esc(loc.end || '')}" placeholder="全部" style="width:88px;"></label>
              </div>
              <div class="pg-internal-note">按起止条数取待清洗数据（1 起、含两端；结束留空=全量），页面取数与清洗任务使用同一范围；会创建清洗任务并在生成内容中携带 task_id；未选择书籍/类型、未清洗数据为空或请求失败时会阻断生成。</div>
            </div>`;
          } else if (src.project === 'russian_reader' && src.api === 'cleaned_vocab') {
            const sel = ['all', '0', '1'].includes(loc.selected) ? loc.selected : 'all';
            body = `<div class="pg-output-internal" style="margin-top:5px;">
              <div style="font-size:12px;color:#666;margin-bottom:5px;">下载时自动获取：俄语书籍阅读 / 已清洗数据 · ${esc(pgInternalSummary(x, loc))}</div>
              <div class="pg-loc-grid">
                <label>起始条数 <input class="input" data-cleaned-start="${esc(x.name)}" type="number" min="1" value="${esc(loc.start || '')}" placeholder="1" style="width:88px;"> 到 <input class="input" data-cleaned-end="${esc(x.name)}" type="number" min="1" value="${esc(loc.end || '')}" placeholder="全部" style="width:88px;"></label>
                <label>是否被选中过<select class="input" data-cleaned-sel="${esc(x.name)}">
                  <option value="all" ${sel === 'all' ? 'selected' : ''}>全部</option>
                  <option value="0" ${sel === '0' ? 'selected' : ''}>仅未选中过</option>
                  <option value="1" ${sel === '1' ? 'selected' : ''}>仅选中过</option>
                </select></label>
              </div>
              <div class="pg-internal-note">按服务端已清洗词库取数（不受词库页当前筛选影响）；起始条数按当前结果顺序 1 起含两端。空结果/失败阻断下载；下载成功后同批词条标记为已选中。</div>
            </div>`;
          } else {
            body = `<div class="pg-var-internal"><div class="pg-internal-note">当前项目/接口组合非法：俄语书籍阅读只支持「待清洗数据 / 已清洗数据」，项目优化与当前综述只支持「节点树框选」。</div></div>`;
          }
        }
        return `<div style="margin-bottom:8px;">${rowHead(x)}${body}</div>`;
      }).join('') : '<div style="font-size:12px;color:#888;">该工作流未声明变量，可直接下载。</div>';
      const findVar = name => (v.vars || []).find(y => y.name === name);
      vBox.querySelectorAll('select[data-loc-book]').forEach(el => el.onchange = () => {
        const x = findVar(el.dataset.locBook); if (!x) return;
        pgSaveLocation(f, x.name, x.internalSource || {}, { bookId: el.value, allSelected: false });
        drawLayer();
      });
      vBox.querySelectorAll('select[data-loc-type]').forEach(el => el.onchange = () => {
        const x = findVar(el.dataset.locType); if (!x) return;
        pgSaveLocation(f, x.name, x.internalSource || {}, { type: el.value, allSelected: false });
        drawLayer();
      });
      vBox.querySelectorAll('input[data-loc-all]').forEach(el => el.onchange = () => {
        const x = findVar(el.dataset.locAll); if (!x) return;
        pgSaveLocation(f, x.name, x.internalSource || {}, {
          allSelected: el.checked,
          bookId: el.checked ? 'all' : '',
          type: el.checked ? 'all' : '',
        });
        drawLayer();
      });
      vBox.querySelectorAll('input[data-pending-start]').forEach(el => el.onchange = () => {
        const x = findVar(el.dataset.pendingStart); if (!x) return;
        pgSaveLocation(f, x.name, x.internalSource || {}, { start: el.value });
        drawLayer();
      });
      vBox.querySelectorAll('input[data-pending-end]').forEach(el => el.onchange = () => {
        const x = findVar(el.dataset.pendingEnd); if (!x) return;
        pgSaveLocation(f, x.name, x.internalSource || {}, { end: el.value });
        drawLayer();
      });
      vBox.querySelectorAll('input[data-cleaned-start]').forEach(el => el.onchange = () => {
        const x = findVar(el.dataset.cleanedStart); if (!x) return;
        pgSaveLocation(f, x.name, x.internalSource || {}, { start: el.value });
        drawLayer();
      });
      vBox.querySelectorAll('input[data-cleaned-end]').forEach(el => el.onchange = () => {
        const x = findVar(el.dataset.cleanedEnd); if (!x) return;
        pgSaveLocation(f, x.name, x.internalSource || {}, { end: el.value });
        drawLayer();
      });
      vBox.querySelectorAll('select[data-cleaned-sel]').forEach(el => el.onchange = () => {
        const x = findVar(el.dataset.cleanedSel); if (!x) return;
        pgSaveLocation(f, x.name, x.internalSource || {}, { selected: el.value });
        drawLayer();
      });
      vBox.querySelectorAll('input[data-bg-check]').forEach(el => el.onchange = () => {
        const x = findVar(el.dataset.bgName); if (!x) return;
        const loc = pgVarLocation(f, x.name, x.internalSource || {});
        pgBgToggle(loc, el.dataset.bgCheck, el.checked, null);
        pgSaveLocation(f, x.name, x.internalSource || {}, { bgSelectedIds: loc.bgSelectedIds });
        drawLayer();
      });
      vBox.querySelectorAll('[data-bg-search-btn]').forEach(el => el.onclick = () => {
        const i = +el.dataset.bgSearchBtn;
        const inp = vBox.querySelector(`[data-bg-search="${i}"]`);
        pgBgTreeUI.query = inp ? inp.value : '';
        drawLayer();
      });
      vBox.querySelectorAll('[data-bg-search]').forEach(el => el.onkeydown = e => {
        if (e.key === 'Enter') { e.preventDefault(); pgBgTreeUI.query = el.value; drawLayer(); }
      });
      vBox.querySelectorAll('[data-bg-show]').forEach(el => el.onchange = () => { pgBgTreeUI.showDeprecated = el.checked; drawLayer(); });
      vBox.querySelectorAll('[data-bg-retry]').forEach(el => el.onclick = () => {
        pgBgTreeError = '';
        pgLoadBgTree(true).then(() => drawLayer());
      });
      vBox.querySelectorAll('[data-bg-exp]').forEach(el => el.onclick = () => {
        const id = el.dataset.bgExp;
        if (!id) return;
        if (pgBgTreeUI.expanded.has(id)) pgBgTreeUI.expanded.delete(id); else pgBgTreeUI.expanded.add(id);
        drawLayer();
      });
      vBox.querySelectorAll('[data-bg-expand-all]').forEach(el => el.onclick = () => {
        const nodes = (pgBgTreeCache && pgBgTreeCache.nodes) || [];
        nodes.forEach(n => pgBgTreeUI.expanded.add(n.id));
        drawLayer();
      });
      vBox.querySelectorAll('[data-bg-collapse-all]').forEach(el => el.onclick = () => {
        pgBgTreeUI.expanded.clear();
        drawLayer();
      });
      vBox.querySelectorAll('.pg-bg-tree').forEach((tree, idx) => {
        const list = tree.querySelector('.pg-bg-list');
        if (list && bgScrolls[idx] != null) list.scrollTop = bgScrolls[idx];
      });
      if (panel) requestAnimationFrame(() => { if (panel.isConnected) panel.scrollTop = scrollTop; });
    }
  };
  mask.innerHTML = `
    <div style="background:#fff;width:700px;max-width:94vw;max-height:88vh;overflow:auto;border-radius:12px;padding:18px;box-sizing:border-box;color:#333;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="display:flex;align-items:center;font-weight:700;font-size:15px;margin-bottom:10px;">
        📋 按变量生成 · ${esc(f.name || '未命名')}
        <button id="pgfo-close" style="margin-left:auto;border:none;background:none;cursor:pointer;font-size:18px;color:#888;line-height:1;">✕</button>
      </div>
      <div style="font-size:12px;color:#888;margin-bottom:6px;">选择版本（共 ${versions.length} 个）</div>
      <select id="pgfo-ver" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px;box-sizing:border-box;font-size:13px;">
        ${versions.slice().reverse().map(v => `<option value="${v.v}" ${v.v === initial.v ? 'selected' : ''}>${esc(v.name || ('v' + v.v))}（v${v.v}） · ${pgFmt(v.time)} · ${esc((v.note || '').slice(0, 24))}</option>`).join('')}
      </select>
      <div style="font-size:12px;color:#888;margin-bottom:4px;">该版本正文（含 {{变量}} 占位）</div>
      <div id="pgfo-preview" style="white-space:pre-wrap;background:#f5f5f5;padding:10px;border-radius:8px;font-size:12.5px;font-family:Consolas,Menlo,monospace;max-height:200px;overflow:auto;margin-bottom:12px;"></div>
      <div style="font-size:12px;color:#888;margin-bottom:6px;">设定变量</div>
      <div id="pgfo-vars" style="margin-bottom:12px;"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button id="pgfo-gen" class="btn">⬇️ 下载替换后的 .md</button>
        <button id="pgfo-raw" class="btn sm">📋 仅复制原版（不替换变量）</button>
      </div>
    </div>`;
  $('#pg-body').appendChild(mask);
  drawLayer();
  mask.querySelector('#pgfo-close').onclick = close;
  mask.addEventListener('mousedown', e => { if (e.target === mask) close(); });
  mask.querySelector('#pgfo-ver').onchange = drawLayer;
  const genBtn = mask.querySelector('#pgfo-gen');
  genBtn.onclick = async () => {
    const v = f.versions.find(x => x.v === +mask.querySelector('#pgfo-ver').value);
    if (!v) return;
    const values = {};
    mask.querySelectorAll('[data-pgv]').forEach(el => { values[el.dataset.pgv] = el.value || ''; });
    const errs = pgFlowCheckValues(v.vars || [], values);
    if (errs.length) { errs.forEach(e => toast(e, 'warn', 3600)); return; }
    const internal = (v.vars || []).filter(x => x.allowInternalFetch && (v.body || '').indexOf('{{' + x.name + '}}') >= 0);
    const missing = [];
    for (const x of internal) {
      const loc = pgVarLocation(f, x.name, x.internalSource || {});
      const src = x.internalSource || {};
      if (src.project === 'bg_review') {
        if (!loc.bgSelectedIds.length) missing.push('变量「' + x.name + '」未选择背景库节点');
      } else {
        const start = parseInt(loc.start, 10), end = parseInt(loc.end, 10);
        if (Number.isFinite(start) && Number.isFinite(end) && start > end) missing.push('变量「' + x.name + '」起始条数不能大于结束条数');
        if (src.api === 'pending_cleaning' && !loc.allSelected && (!loc.bookId || !loc.type)) {
          missing.push('变量「' + x.name + '」未选择书籍/类型');
        }
      }
    }
    if (missing.length) { missing.forEach(m => toast(m, 'warn', 4200)); return; }
    const oldLabel = genBtn.textContent;
    genBtn.disabled = true;
    try {
      const cleanedMarks = [];
      for (const x of internal) {
        genBtn.textContent = '获取内部数据：' + x.name + '…';
        const loc = pgVarLocation(f, x.name, x.internalSource || {});
        const src = x.internalSource || {};
        if (src.project === 'bg_review') {
          values[x.name] = await pgFetchBgExportForVar(x, loc);
        } else if (src.api === 'cleaned_vocab') {
          const got = await pgFetchCleanedForVar(x, loc);
          values[x.name] = got.text;
          got.items.forEach(it => { if (it.kind && it.id) cleanedMarks.push({ kind: it.kind, id: it.id }); });
        } else {
          values[x.name] = await pgFetchPendingForVar(x, loc);
        }
      }
      let text = v.body || '';
      (v.vars || []).forEach(x => { text = text.split('{{' + x.name + '}}').join(values[x.name] !== undefined ? values[x.name] : ''); });
      if (!text.trim()) {
        toast('生成内容为空，已阻断下载', 'warn', 3600);
        return;
      }
      pgDownloadMarkdown('工作流-' + pgFileNamePart(f.name) + '-v' + v.v + '-已替换.md', text);
      if (cleanedMarks.length) {
        try { await pgMarkExported(cleanedMarks); }
        catch (e) { toast('已下载，但 export_selected 标记失败：' + (e && e.message ? e.message : e), 'warn', 5200); }
      }
      toast('已下载替换后的 .md ✓', 'success');
    } catch (e) {
      toast('生成失败，未生成文件：' + (e && e.message ? e.message : e), 'error', 6000);
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = oldLabel;
    }
  };
  mask.querySelector('#pgfo-raw').onclick = () => {
    const v = f.versions.find(x => x.v === +mask.querySelector('#pgfo-ver').value);
    if (!v) return;
    if (navigator.clipboard) navigator.clipboard.writeText(v.body || '').then(() => toast('已复制原版 ✓', 'success'));
    else toast('已复制，请手动 Ctrl+C 复制', 'info');
  };
}

/* ---------- 模块化提示词（完整实现 · 设计文档阶段 3） ---------- */
let pgModView = { v: 'list', id: null };
const PG_TYPES = ['text', 'number', 'option', 'textarea', 'json'];
const PG_TYPE_LABEL = { text: '文本', number: '数字', option: '选项', textarea: '多行文本', json: 'JSON 结构' };
function pgModNew() {
  return { id: pgUid(), name: '', desc: '', archived: false, created: pgStamp(), updated: pgStamp(),
    versions: [{ v: 1, time: pgStamp(), note: '初始版本',
      inputs: [], flow: '', outputs: [], externs: [],
      resultReq: { goal: '', success: '', fail: '', style: '', length: '', lang: '', format: 'json', forbidden: '' } }],
    runs: [] };
}
function pgModFind(id) { return PG.modules.find(m => m.id === id); }
function pgModCur(m) { return m.versions[m.versions.length - 1]; }
function pgModExport(m) {
  const data = JSON.stringify({ type: 'module', id: m.id, name: m.name, desc: m.desc, created: m.created, updated: m.updated, archived: m.archived, versions: m.versions, runs: m.runs }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  window.rtDownloadBlob(blob, '模块-' + (m.name || '未命名') + '-v' + pgModCur(m).v + '.json', 'promptgen');
}
function pgModValidate(cur) {
  const errs = [];
  const names = new Set();
  cur.inputs.forEach(i => { const n = (i.name || '').trim(); if (!n) return; if (names.has(n)) errs.push('输入名重复：' + n); names.add(n); });
  const outNames = new Set();
  cur.outputs.forEach(o => { const n = (o.name || '').trim(); if (!n) return; if (outNames.has(n)) errs.push('输出名重复：' + n); outNames.add(n); });
  const extNames = new Set();
  cur.externs.forEach(e => { const n = (e.name || '').trim(); if (!n) return; if (extNames.has(n)) errs.push('外调变量名重复：' + n); extNames.add(n); });
  const re = /\{\{\s*([^}]+?)\s*\}\}/g;
  let m;
  while ((m = re.exec(cur.flow || ''))) { const n = m[1].trim(); if (!names.has(n)) errs.push('流程模板引用未声明输入：{{' + n + '}}'); }
  const byDst = {};
  cur.externs.forEach(e => { const k = e.dstMod || '?'; (byDst[k] = byDst[k] || []).push(+(e.order || 0)); });
  Object.keys(byDst).forEach(k => { const arr = byDst[k]; if (new Set(arr).size !== arr.length) errs.push('外调变量顺序冲突（目标模块 ' + k + ' 序号重复）'); });
  return errs;
}
function pgModRefs(mid) {
  const refs = [];
  PG.connections.forEach(c => { if (c.fromMod === mid || c.toMod === mid) refs.push('对接连线（' + pgModName(c.fromMod) + ' → ' + pgModName(c.toMod) + '）'); });
  PG.modules.forEach(m => {
    if (m.id === mid) return;
    pgModCur(m).externs.forEach(e => { if (e.srcMod === mid) refs.push('外调来源（' + m.name + ' 的 ' + e.name + '）'); if (e.dstMod === mid) refs.push('外调目标（' + m.name + ' 的 ' + e.name + '）'); });
  });
  PG.refs.forEach(r => { if (r.refId === mid) refs.push('引用关系（' + pgRefKindLabel(r.fromKind) + '「' + r.fromName + '」）'); });
  return refs;
}
function pgModName(id) { const m = pgModFind(id); return m ? (m.name || '未命名') : '（已删除）'; }
function pgConnValidate(c) {
  const errs = [];
  const A = pgModFind(c.fromMod), B = pgModFind(c.toMod);
  if (!A || !B) return ['模块不存在'];
  if (c.fromMod === c.toMod) return ['不允许自连接'];
  const aCur = pgModCur(A), bCur = pgModCur(B);
  const out = aCur.outputs.find(o => o.name === c.fromOut);
  const inp = bCur.inputs.find(i => i.name === c.toIn);
  if (!out) return ['输出端口不存在：' + c.fromOut];
  if (!inp) return ['输入端口不存在：' + c.toIn];
  if (!(c.mapName || out.name === inp.name)) errs.push('名称未匹配：' + out.name + ' ≠ ' + inp.name + '（需显式映射）');
  if (out.type !== inp.type) errs.push('类型不匹配：' + PG_TYPE_LABEL[out.type] + ' ≠ ' + PG_TYPE_LABEL[inp.type]);
  if (out.constraint && inp.constraint && out.constraint.trim() !== inp.constraint.trim()) errs.push('格式约束不兼容');
  return errs;
}
function pgModMissingInputs() {
  /* 每个模块：必填输入是否有连接提供 */
  const provided = {};
  PG.connections.forEach(c => { (provided[c.toMod] = provided[c.toMod] || {}).name = true; });
  const missing = [];
  PG.modules.forEach(m => {
    if (m.archived) return;
    pgModCur(m).inputs.forEach(i => { if (i.required && !(provided[m.id] && provided[m.id][i.name])) missing.push(m.name + ' 必填输入缺失：' + i.name); });
  });
  return missing;
}
function pgModBuildPrompt(m, values, fmt) {
  const cur = pgModCur(m);
  const rq = cur.resultReq || {};
  let text = cur.flow || '';
  cur.inputs.forEach(i => {
    const raw = values[i.name] !== undefined && values[i.name] !== null ? String(values[i.name]) : '';
    text = text.split('{{' + i.name + '}}').join(raw);
  });
  const req = [];
  if (rq.goal) req.push('【目标】' + rq.goal);
  if (rq.success) req.push('【成功标准】' + rq.success);
  if (rq.fail) req.push('【失败标准】' + rq.fail);
  if (rq.style) req.push('【输出风格】' + rq.style);
  if (rq.length) req.push('【输出长度】' + rq.length);
  if (rq.lang) req.push('【输出语言】' + rq.lang);
  if (rq.forbidden) req.push('【禁止事项】' + rq.forbidden);
  const outFmt = fmt || rq.format || 'json';
  req.push('【回复格式要求】' + (outFmt === 'json' ? '请仅以合法 JSON 格式回复，不要包含任何解释、代码块标记或其他额外字符。' : '请以清晰的自然语言文本回复。'));
  if (text) text += '\n\n' + req.join('\n');
  else text = req.join('\n');
  return text;
}
function pgModCheckValues(cur, values) {
  const errs = [];
  cur.inputs.forEach(i => {
    const raw = values[i.name] !== undefined && values[i.name] !== null ? String(values[i.name]) : '';
    if (i.required && !raw.trim()) errs.push('必填输入未填写：' + i.name);
    if (i.type === 'number' && raw.trim() && isNaN(Number(raw))) errs.push('数字类型校验失败：' + i.name);
  });
  return errs;
}
function pgModCheckOutput(run, cur) {
  /* 对照生成结果要求校验输出 */
  const rq = cur.resultReq || {};
  const notes = [];
  const raw = (run.output || '').trim();
  if (rq.format === 'json' || !rq.format) {
    try { JSON.parse(raw); run.jsonOk = true; } catch (e) { run.jsonOk = false; notes.push('输出不是合法 JSON'); }
  }
  if (rq.success && raw && raw.indexOf(rq.success) < 0) notes.push('未命中成功标准关键词');
  if (rq.fail && raw && raw.indexOf(rq.fail) >= 0) notes.push('命中失败标准关键词');
  run.checkNotes = notes;
  run.ok = notes.length === 0;
  return run;
}
function pgRenderMod(body) {
  const draw = () => {
    if (pgModView.v === 'edit' || pgModView.v === 'detail') { pgModEditOrDetail(body); return; }
    if (pgModView.v === 'canvas') { pgModCanvas(body); return; }
    const q = { s: '', arch: 'all' };
    let list = PG.modules.slice();
    if (q.s) { const k = q.s.toLowerCase(); list = list.filter(m => (m.name + ' ' + (m.desc || '')).toLowerCase().includes(k)); }
    if (q.arch === 'arch') list = list.filter(m => m.archived);
    else if (q.arch === 'active') list = list.filter(m => !m.archived);
    const missing = pgModMissingInputs();
    body.innerHTML = `
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">🧩</span>模块化提示词
          <span style="font-size:12px;color:var(--text-dim);font-weight:400;">可复用 · 可对接 · 五部分元模块</span>
          <button class="btn sm" id="pgm-new" style="margin-left:auto;">＋ 新建模块</button>
          <button class="btn sm" id="pgm-canvas">🕸 对接画布（${PG.connections.length} 条连线）</button></div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center;">
          <input class="input" id="pgm-s" placeholder="搜索模块名 / 用途…" value="${esc(q.s)}" style="flex:2;min-width:180px;">
          <select class="input" id="pgm-arch" style="width:110px;">
            <option value="all" ${q.arch === 'all' ? 'selected' : ''}>全部</option>
            <option value="active" ${q.arch === 'active' ? 'selected' : ''}>未归档</option>
            <option value="arch" ${q.arch === 'arch' ? 'selected' : ''}>已归档</option>
          </select>
          <span style="font-size:12px;color:var(--text-dim);">共 ${list.length} 个模块</span>
        </div>
        ${missing.length ? `<div style="font-size:12px;color:#e2543f;margin-top:8px;">⚠ ${esc(missing[0])}${missing.length > 1 ? ' 等 ' + missing.length + ' 项' : ''}</div>` : ''}
      </div>
      ${list.length ? list.map(m => {
        const cur = pgModCur(m);
        const refs = pgModRefs(m.id);
        return `<div class="gcard" data-pgm="${m.id}" style="cursor:pointer;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-weight:700;">${esc(m.name || '未命名')}</span>
            <span class="tag">v${cur.v}</span>
            ${m.archived ? '<span class="tag" style="color:var(--text-dim);">已归档</span>' : ''}
            <span style="font-size:12px;color:var(--text-dim);">输入 ${cur.inputs.length} · 输出 ${cur.outputs.length} · 外调 ${cur.externs.length} · 测试 ${m.runs.length}</span>
            ${refs.length ? `<span style="font-size:11px;color:#d97706;">被引用 ${refs.length} 处</span>` : ''}
          </div>
          ${m.desc ? `<div style="font-size:12px;color:var(--text-dim);margin-top:4px;">${esc(m.desc)}</div>` : ''}
        </div>`;
      }).join('') : '<div class="gcard" style="color:var(--text-dim);font-size:13px;text-align:center;padding:40px 0;">尚无模块，点击「＋ 新建模块」开始</div>'}`;
    $('#pgm-new').onclick = () => { pgModView = { v: 'edit', id: null }; draw(); };
    $('#pgm-canvas').onclick = () => { pgModView = { v: 'canvas', id: null }; draw(); };
    $('#pgm-s').oninput = () => { q.s = $('#pgm-s').value; draw(); };
    $('#pgm-arch').onchange = () => { q.arch = $('#pgm-arch').value; draw(); };
    body.querySelectorAll('[data-pgm]').forEach(c => c.onclick = () => { pgModView = { v: 'detail', id: c.dataset.pgm }; draw(); });
  };
  draw();
}

function pgModEditOrDetail(body) {
  const isDetail = pgModView.v === 'detail';
  const m = pgModView.id ? pgModFind(pgModView.id) : null;
  if (pgModView.id && !m) { pgModView = { v: 'list', id: null }; pgRenderMod(body); return; }
  const isNew = !m;
  const f = isNew ? pgModNew() : m;
  const cur = pgModCur(f);
  const draft = JSON.parse(JSON.stringify(cur));
  if (isDetail) { pgModDetail(body, f); return; }
  const refs = isNew ? [] : pgModRefs(f.id);
  const typeOpt = (sel, curT) => PG_TYPES.map(t => `<option value="${t}" ${curT === t ? 'selected' : ''}>${PG_TYPE_LABEL[t]}</option>`).join('');
  const draw = () => {
    body.innerHTML = `
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">✏️</span>${isNew ? '新建模块' : '编辑模块'}
          <span style="font-size:12px;color:var(--text-dim);font-weight:400;">${isNew ? '' : '当前 v' + cur.v + ' · 保存后生成新版本'}</span>
          <button class="btn sm" id="pgme-back" style="margin-left:auto;">← 返回模块库</button></div>
        ${refs.length ? `<div style="font-size:12px;color:#d97706;margin-top:8px;">⚠ 本模块被引用：${esc(refs.join('；'))}。保存生成新版本后，引用方仍指向原版本。</div>` : ''}
        <div style="margin-top:10px;">
          <label style="font-size:12px;color:var(--text-dim);">模块名</label>
          <input class="input" id="pgme-name" value="${esc(draft.name)}" placeholder="如：周报生成模块" style="width:100%;">
          <div style="margin-top:8px;"><label style="font-size:12px;color:var(--text-dim);">用途说明（可选）</label>
          <input class="input" id="pgme-desc" value="${esc(draft.desc)}" style="width:100%;"></div>
        </div>
      </div>
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">📥</span>输入区<span style="font-size:12px;color:var(--text-dim);font-weight:400;">名称 · 类型 · 必填 · 来源 · 约束</span></div>
        <div id="pgme-inputs" style="margin-top:10px;"></div>
        <button class="btn sm" id="pgme-addin">＋ 添加输入</button>
      </div>
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">🔧</span>内部流程区<span style="font-size:12px;color:var(--text-dim);font-weight:400;">提示词正文模板 · 仅可引用已声明输入（{{输入名}}）</span></div>
        <div style="display:flex;gap:6px;margin-top:8px;">
          <button class="btn sm" data-flowtab="edit" style="${draft._flowtab !== 'ai' ? 'font-weight:700;' : ''}">直接编辑文本</button>
          <button class="btn sm" data-flowtab="ai" style="${draft._flowtab === 'ai' ? 'font-weight:700;' : ''}">AI 修改建议</button>
        </div>
        <div id="pgme-flow"></div>
      </div>
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">📤</span>输出区<span style="font-size:12px;color:var(--text-dim);font-weight:400;">名称 · 类型 · 必填 · 目标 · 约束</span></div>
        <div id="pgme-outputs" style="margin-top:10px;"></div>
        <button class="btn sm" id="pgme-addout">＋ 添加输出</button>
      </div>
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">🔗</span>内部变量外调区<span style="font-size:12px;color:var(--text-dim);font-weight:400;">非连接模块间数据传输 · 独立逻辑线 · 标注顺序</span></div>
        <div id="pgme-externs" style="margin-top:10px;"></div>
        <button class="btn sm" id="pgme-addext">＋ 添加外调变量</button>
      </div>
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">🎯</span>生成结果要求区</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">
          <div><label style="font-size:12px;color:var(--text-dim);">目标描述</label><textarea class="input" id="pgme-goal" rows="2" style="width:100%;">${esc(draft.resultReq.goal)}</textarea></div>
          <div><label style="font-size:12px;color:var(--text-dim);">成功标准</label><textarea class="input" id="pgme-succ" rows="2" style="width:100%;">${esc(draft.resultReq.success)}</textarea></div>
          <div><label style="font-size:12px;color:var(--text-dim);">失败标准</label><textarea class="input" id="pgme-fail" rows="2" style="width:100%;">${esc(draft.resultReq.fail)}</textarea></div>
          <div><label style="font-size:12px;color:var(--text-dim);">输出风格</label><textarea class="input" id="pgme-style" rows="2" style="width:100%;">${esc(draft.resultReq.style)}</textarea></div>
          <div><label style="font-size:12px;color:var(--text-dim);">输出长度</label><input class="input" id="pgme-len" value="${esc(draft.resultReq.length)}" style="width:100%;"></div>
          <div><label style="font-size:12px;color:var(--text-dim);">输出语言</label><input class="input" id="pgme-lang" value="${esc(draft.resultReq.lang)}" style="width:100%;"></div>
          <div><label style="font-size:12px;color:var(--text-dim);">输出格式</label><select class="input" id="pgme-fmt" style="width:100%;"><option value="json" ${draft.resultReq.format === 'json' ? 'selected' : ''}>JSON（默认）</option><option value="text" ${draft.resultReq.format === 'text' ? 'selected' : ''}>自由文本</option></select></div>
          <div><label style="font-size:12px;color:var(--text-dim);">禁止事项</label><textarea class="input" id="pgme-fbd" rows="2" style="width:100%;">${esc(draft.resultReq.forbidden)}</textarea></div>
        </div>
      </div>
      <div class="gcard">
        <div style="display:flex;gap:10px;">
          <button class="btn" id="pgme-save">💾 保存${isNew ? '' : '（生成新版本）'}</button>
          ${isNew ? '' : '<button class="btn" id="pgme-cancel">取消</button>'}
        </div>
      </div>`;
    $('#pgme-back').onclick = () => { pgModView = { v: 'list', id: null }; draw(); };
    if ($('#pgme-cancel')) $('#pgme-cancel').onclick = () => { pgModView = { v: 'detail', id: f.id }; draw(); };
    /* 输入区 */
    const inpBox = $('#pgme-inputs');
    const drawIn = () => {
      inpBox.innerHTML = draft.inputs.map((i, idx) => `
        <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;align-items:center;">
          <input class="input" data-in-n="${idx}" placeholder="输入名" value="${esc(i.name)}" style="width:130px;">
          <select class="input" data-in-t="${idx}" style="width:96px;">${typeOpt('', i.type)}</select>
          <label style="font-size:12px;display:flex;align-items:center;gap:3px;"><input type="checkbox" data-in-r="${idx}" ${i.required ? 'checked' : ''}>必填</label>
          <input class="input" data-in-s="${idx}" placeholder="来源（手动/上游输出/工作流变量）" value="${esc(i.source || '')}" style="width:170px;">
          <input class="input" data-in-c="${idx}" placeholder="约束（格式/范围/枚举）" value="${esc(i.constraint || '')}" style="width:170px;">
          <button class="btn sm" data-in-del="${idx}">✕</button>
        </div>`).join('');
      inpBox.querySelectorAll('input[data-in-n]').forEach(el => el.oninput = () => { draft.inputs[+el.dataset.inN].name = el.value; });
      inpBox.querySelectorAll('select[data-in-t]').forEach(el => el.onchange = () => { draft.inputs[+el.dataset.inT].type = el.value; });
      inpBox.querySelectorAll('input[data-in-r]').forEach(el => el.onchange = () => { draft.inputs[+el.dataset.inR].required = el.checked; });
      inpBox.querySelectorAll('input[data-in-s]').forEach(el => el.oninput = () => { draft.inputs[+el.dataset.inS].source = el.value; });
      inpBox.querySelectorAll('input[data-in-c]').forEach(el => el.oninput = () => { draft.inputs[+el.dataset.inC].constraint = el.value; });
      inpBox.querySelectorAll('button[data-in-del]').forEach(el => el.onclick = () => { draft.inputs.splice(+el.dataset.inDel, 1); drawIn(); });
    };
    $('#pgme-addin').onclick = () => { draft.inputs.push({ name: '', type: 'text', required: false, source: '', constraint: '' }); drawIn(); };
    drawIn();
    /* 内部流程区（双通道） */
    const flowBox = $('#pgme-flow');
    const drawFlow = () => {
      if (draft._flowtab === 'ai') {
        flowBox.innerHTML = `
          <div style="font-size:12px;color:var(--text-dim);margin-top:8px;">描述你对流程模板的修改意见，发送给 AI 一并修改（需 DeepSeek 会话）</div>
          <div style="display:flex;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap;">
            <input class="input" id="pgme-flowurl" placeholder="DeepSeek 会话链接（留空自动取默认会话）" value="${esc(PG.lastUrl || '')}" style="flex:3;min-width:200px;font-size:12.5px;">
            <button class="btn sm" id="pgme-flowdef">🪷 取默认会话</button>
            <button class="btn" id="pgme-flowsend">🤖 发送修改建议</button>
          </div>
          <textarea class="input" id="pgme-flowmsg" rows="4" placeholder="例如：把步骤改为先总结再分类，语气更简洁…" style="width:100%;margin-top:8px;resize:vertical;"></textarea>
          <div id="pgme-flowres" style="margin-top:8px;"></div>`;
        $('#pgme-flowdef').onclick = async () => {
          try { const u = await window.__webchat.getSession('base'); if (u) { PG.lastUrl = u; pgSave(); $('#pgme-flowurl').value = u; toast('已取默认会话 ✓', 'success'); } else toast('暂无可用的默认会话', 'warn'); } catch (e) { toast('读取默认会话失败', 'warn'); }
        };
        $('#pgme-flowsend').onclick = async () => {
          const msg = $('#pgme-flowmsg').value.trim();
          if (!msg) { toast('请填写修改意见', 'warn'); return; }
          let url = $('#pgme-flowurl').value.trim();
          if (!url) { try { const u = await window.__webchat.getSession('base'); if (u) { url = u; $('#pgme-flowurl').value = u; } } catch (e) {} }
          if (!url) { toast('请填写会话链接（或取默认会话）', 'warn'); return; }
          const prompt = '请修改下面这段提示词模板，仅输出修改后的完整模板文本，不要输出解释。\n\n【修改意见】\n' + msg + '\n\n【当前模板】\n' + (draft.flow || '（空）');
          const btn = $('#pgme-flowsend');
          btn.disabled = true; btn.textContent = '⏳ 发送中…';
          try {
            const r = await window.__webchat.chatPost(url, prompt, 195000, '');
            if (!r || !r.ok) { toast('发送失败：' + ((r && r.error) || '未知错误'), 'warn'); return; }
            if (r.url && r.url !== url) { PG.lastUrl = r.url; pgSave(); $('#pgme-flowurl').value = r.url; }
            const t = (r.text || '').trim().replace(/^```[a-zA-Z]*\s*|\s*```$/g, '');
            const resBox = $('#pgme-flowres');
            resBox.innerHTML = `
              <label style="font-size:12px;color:var(--text-dim);">AI 返回的模板（可再编辑）</label>
              <textarea class="input" id="pgme-flownew" rows="6" style="width:100%;resize:vertical;font-family:Consolas,Menlo,monospace;font-size:12.5px;">${esc(t)}</textarea>
              <button class="btn sm" id="pgme-flowuse" style="margin-top:6px;">✓ 采用此模板</button>`;
            $('#pgme-flowuse').onclick = () => { draft.flow = $('#pgme-flownew').value; draft._flowtab = 'edit'; drawFlow(); toast('已采用 AI 修改后的模板 ✓', 'success'); };
          } catch (e) { toast('异常：' + (e && e.message ? e.message : e), 'warn'); }
          finally { btn.disabled = false; btn.textContent = '🤖 发送修改建议'; }
        };
      } else {
        flowBox.innerHTML = `
          <textarea class="input" id="pgme-flowtxt" rows="7" placeholder="你是…请完成…其中 {{input_name}} 由上游传入…" style="width:100%;margin-top:8px;resize:vertical;font-family:Consolas,Menlo,monospace;font-size:12.5px;">${esc(draft.flow)}</textarea>`;
        $('#pgme-flowtxt').oninput = () => { draft.flow = $('#pgme-flowtxt').value; };
      }
    };
    body.querySelectorAll('[data-flowtab]').forEach(b => b.onclick = () => { draft._flowtab = b.dataset.flowtab; drawFlow(); });
    drawFlow();
    /* 输出区 */
    const outBox = $('#pgme-outputs');
    const drawOut = () => {
      outBox.innerHTML = draft.outputs.map((o, idx) => `
        <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;align-items:center;">
          <input class="input" data-out-n="${idx}" placeholder="输出名" value="${esc(o.name)}" style="width:130px;">
          <select class="input" data-out-t="${idx}" style="width:110px;">${typeOpt('', o.type)}</select>
          <label style="font-size:12px;display:flex;align-items:center;gap:3px;"><input type="checkbox" data-out-r="${idx}" ${o.required ? 'checked' : ''}>必填</label>
          <input class="input" data-out-g="${idx}" placeholder="目标（供谁消费）" value="${esc(o.target || '')}" style="width:160px;">
          <input class="input" data-out-c="${idx}" placeholder="约束" value="${esc(o.constraint || '')}" style="width:160px;">
          <button class="btn sm" data-out-del="${idx}">✕</button>
        </div>`).join('');
      outBox.querySelectorAll('input[data-out-n]').forEach(el => el.oninput = () => { draft.outputs[+el.dataset.outN].name = el.value; });
      outBox.querySelectorAll('select[data-out-t]').forEach(el => el.onchange = () => { draft.outputs[+el.dataset.outT].type = el.value; });
      outBox.querySelectorAll('input[data-out-r]').forEach(el => el.onchange = () => { draft.outputs[+el.dataset.outR].required = el.checked; });
      outBox.querySelectorAll('input[data-out-g]').forEach(el => el.oninput = () => { draft.outputs[+el.dataset.outG].target = el.value; });
      outBox.querySelectorAll('input[data-out-c]').forEach(el => el.oninput = () => { draft.outputs[+el.dataset.outC].constraint = el.value; });
      outBox.querySelectorAll('button[data-out-del]').forEach(el => el.onclick = () => { draft.outputs.splice(+el.dataset.outDel, 1); drawOut(); });
    };
    $('#pgme-addout').onclick = () => { draft.outputs.push({ name: '', type: 'text', required: false, target: '', constraint: '' }); drawOut(); };
    drawOut();
    /* 外调变量区 */
    const extBox = $('#pgme-externs');
    const modOpts = () => PG.modules.filter(x => x.id !== f.id).map(x => `<option value="${x.id}">${esc(x.name || '未命名')}</option>`).join('');
    const drawExt = () => {
      extBox.innerHTML = draft.externs.map((e, idx) => `
        <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;align-items:center;">
          <input class="input" data-ext-n="${idx}" placeholder="变量名" value="${esc(e.name)}" style="width:110px;">
          <select class="input" data-ext-s="${idx}" style="width:150px;"><option value="">来源模块</option>${modOpts()}</select>
          <select class="input" data-ext-d="${idx}" style="width:150px;"><option value="">目标模块（本模块）</option>${modOpts()}</select>
          <select class="input" data-ext-t="${idx}" style="width:96px;">${typeOpt('', e.dataType)}</select>
          <input class="input" data-ext-o="${idx}" type="number" placeholder="顺序" value="${esc(e.order || '')}" style="width:70px;">
          <label style="font-size:12px;display:flex;align-items:center;gap:3px;"><input type="checkbox" data-ext-r="${idx}" ${e.required ? 'checked' : ''}>必须</label>
          <input class="input" data-ext-f="${idx}" placeholder="默认值" value="${esc(e.def || '')}" style="width:100px;">
          <button class="btn sm" data-ext-del="${idx}">✕</button>
        </div>`).join('');
      extBox.querySelectorAll('input[data-ext-n]').forEach(el => el.oninput = () => { draft.externs[+el.dataset.extN].name = el.value; });
      extBox.querySelectorAll('select[data-ext-s]').forEach(el => el.onchange = () => { draft.externs[+el.dataset.extS].srcMod = el.value; });
      extBox.querySelectorAll('select[data-ext-d]').forEach(el => el.onchange = () => { draft.externs[+el.dataset.extD].dstMod = el.value; });
      extBox.querySelectorAll('select[data-ext-t]').forEach(el => el.onchange = () => { draft.externs[+el.dataset.extT].dataType = el.value; });
      extBox.querySelectorAll('input[data-ext-o]').forEach(el => el.oninput = () => { draft.externs[+el.dataset.extO].order = el.value; });
      extBox.querySelectorAll('input[data-ext-r]').forEach(el => el.onchange = () => { draft.externs[+el.dataset.extR].required = el.checked; });
      extBox.querySelectorAll('input[data-ext-f]').forEach(el => el.oninput = () => { draft.externs[+el.dataset.extF].def = el.value; });
      extBox.querySelectorAll('button[data-ext-del]').forEach(el => el.onclick = () => { draft.externs.splice(+el.dataset.extDel, 1); drawExt(); });
    };
    $('#pgme-addext').onclick = () => { draft.externs.push({ name: '', srcMod: '', dstMod: '', dataType: 'text', order: '', required: false, def: '' }); drawExt(); };
    drawExt();
    $('#pgme-save').onclick = () => {
      draft.name = $('#pgme-name').value.trim();
      draft.desc = $('#pgme-desc').value.trim();
      draft.resultReq = {
        goal: $('#pgme-goal').value.trim(), success: $('#pgme-succ').value.trim(), fail: $('#pgme-fail').value.trim(),
        style: $('#pgme-style').value.trim(), length: $('#pgme-len').value.trim(), lang: $('#pgme-lang').value.trim(),
        format: $('#pgme-fmt').value, forbidden: $('#pgme-fbd').value.trim(),
      };
      if (!draft.name) { toast('请填写模块名', 'warn'); return; }
      const clean = c => ({ name: c.name.trim(), type: c.type, required: !!c.required, source: c.source || '', constraint: c.constraint || '' });
      const newDraft = {
        inputs: draft.inputs.filter(i => i.name.trim()).map(clean),
        flow: draft.flow || '',
        outputs: draft.outputs.filter(o => o.name.trim()).map(o => ({ name: o.name.trim(), type: o.type, required: !!o.required, target: o.target || '', constraint: o.constraint || '' })),
        externs: draft.externs.filter(e => e.name.trim()).map(e => ({ name: e.name.trim(), srcMod: e.srcMod, dstMod: e.dstMod, dataType: e.dataType, order: e.order || '', required: !!e.required, def: e.def || '' })),
        resultReq: draft.resultReq,
      };
      const errs = pgModValidate(newDraft);
      if (errs.length) { toast('校验失败：' + errs[0], 'warn'); return; }
      const same = JSON.stringify(newDraft) === JSON.stringify(cur);
      if (!isNew && same) { toast('内容未变化，未生成新版本', 'info'); pgModView = { v: 'detail', id: f.id }; draw(); return; }
      if (isNew) {
        PG.modules.push(f);
        f.name = draft.name; f.desc = draft.desc; f.created = pgStamp(); f.updated = pgStamp();
        f.versions[0] = { v: 1, time: pgStamp(), note: '初始版本', ...newDraft };
      } else {
        const nv = pgNextV(PG.modV, f.id);
        f.versions.push({ v: nv, time: pgStamp(), note: '编辑保存', ...newDraft });
        f.name = draft.name; f.desc = draft.desc; f.updated = pgStamp();
      }
      pgSave();
      if (!isNew) pgRefWarnOnSave('module', f.id, f.name || '未命名');
      toast(isNew ? '已创建 v1 ✓' : '已保存 v' + pgModCur(f).v + '（原版保留）✓', 'success');
      pgModView = { v: 'detail', id: f.id }; draw();
    };
  };
  draw();
}

function pgModDetail(body, m) {
  const cur = pgModCur(m);
  const missing = pgModMissingInputs().filter(x => x.indexOf(m.name) === 0);
  const draw = () => {
    const lastRun = m.runs[m.runs.length - 1] || null;
    body.innerHTML = `
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">📄</span>${esc(m.name || '未命名')}
          <span style="font-size:12px;color:var(--text-dim);font-weight:400;">v${cur.v} · ${m.archived ? '已归档' : '使用中'}</span>
          <button class="btn sm" id="pgmd-back" style="margin-left:auto;">← 返回模块库</button>
          <button class="btn sm" id="pgmd-edit">✏️ 编辑</button>
          <button class="btn sm" id="pgmd-arch">${m.archived ? '↩ 恢复' : '🗄 归档'}</button>
          <button class="btn sm" id="pgmd-exp">📤 导出 JSON</button>
          <button class="btn sm" id="pgmd-del" style="color:#e2543f;">🗑 删除</button></div>
        ${m.desc ? `<div style="font-size:12px;color:var(--text-dim);margin-top:4px;">${esc(m.desc)}</div>` : ''}
        ${missing.length ? `<div style="font-size:12px;color:#e2543f;margin-top:6px;">⚠ ${esc(missing[0])}</div>` : ''}
      </div>
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">📥</span>输入
          <span style="font-size:12px;color:var(--text-dim);font-weight:400;">${cur.inputs.length} 个</span></div>
        ${cur.inputs.length ? `<table style="width:100%;font-size:12px;margin-top:8px;border-collapse:collapse;"><tr style="color:var(--text-dim);"><td style="padding:4px 6px;">名称</td><td>类型</td><td>必填</td><td>来源</td><td>约束</td></tr>${cur.inputs.map(i => `<tr><td style="padding:4px 6px;border-top:1px dashed var(--line);">${esc(i.name)}</td><td>${PG_TYPE_LABEL[i.type]}</td><td>${i.required ? '✔' : '—'}</td><td>${esc(i.source || '—')}</td><td>${esc(i.constraint || '—')}</td></tr>`).join('')}</table>` : '<div style="font-size:12px;color:var(--text-dim);margin-top:6px;">无输入</div>'}
      </div>
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">🔧</span>内部流程</div>
        <pre style="white-space:pre-wrap;font-size:12.5px;font-family:Consolas,Menlo,monospace;background:var(--bg-soft);padding:10px;border-radius:8px;margin-top:8px;">${esc(cur.flow || '（空）')}</pre>
      </div>
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">📤</span>输出
          <span style="font-size:12px;color:var(--text-dim);font-weight:400;">${cur.outputs.length} 个</span></div>
        ${cur.outputs.length ? `<table style="width:100%;font-size:12px;margin-top:8px;border-collapse:collapse;"><tr style="color:var(--text-dim);"><td style="padding:4px 6px;">名称</td><td>类型</td><td>必填</td><td>目标</td><td>约束</td></tr>${cur.outputs.map(o => `<tr><td style="padding:4px 6px;border-top:1px dashed var(--line);">${esc(o.name)}</td><td>${PG_TYPE_LABEL[o.type]}</td><td>${o.required ? '✔' : '—'}</td><td>${esc(o.target || '—')}</td><td>${esc(o.constraint || '—')}</td></tr>`).join('')}</table>` : '<div style="font-size:12px;color:var(--text-dim);margin-top:6px;">无输出</div>'}
      </div>
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">🔗</span>内部变量外调
          <span style="font-size:12px;color:var(--text-dim);font-weight:400;">${cur.externs.length} 条逻辑线</span></div>
        ${cur.externs.length ? `<table style="width:100%;font-size:12px;margin-top:8px;border-collapse:collapse;"><tr style="color:var(--text-dim);"><td style="padding:4px 6px;">变量名</td><td>来源模块</td><td>目标模块</td><td>类型</td><td>顺序</td><td>必须</td><td>默认值</td></tr>${cur.externs.map(e => `<tr><td style="padding:4px 6px;border-top:1px dashed var(--line);">${esc(e.name)}</td><td>${esc(pgModName(e.srcMod))}</td><td>${esc(pgModName(e.dstMod))}</td><td>${PG_TYPE_LABEL[e.dataType]}</td><td>${esc(e.order || '—')}</td><td>${e.required ? '✔' : '—'}</td><td>${esc(e.def || '—')}</td></tr>`).join('')}</table>` : '<div style="font-size:12px;color:var(--text-dim);margin-top:6px;">无外调变量</div>'}
      </div>
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">🎯</span>生成结果要求</div>
        <div style="font-size:12px;margin-top:8px;line-height:1.8;">
          ${[['目标描述', cur.resultReq.goal], ['成功标准', cur.resultReq.success], ['失败标准', cur.resultReq.fail], ['输出风格', cur.resultReq.style], ['输出长度', cur.resultReq.length], ['输出语言', cur.resultReq.lang], ['输出格式', cur.resultReq.format === 'json' ? 'JSON' : '自由文本'], ['禁止事项', cur.resultReq.forbidden]].filter(x => x[1]).map(x => `<div><b>${x[0]}</b>：${esc(x[1])}</div>`).join('') || '<div style="color:var(--text-dim);">未设置</div>'}
        </div>
      </div>
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">🧪</span>测试台
          <span style="font-size:12px;color:var(--text-dim);font-weight:400;">单模块试运行 · 输出对照生成结果要求校验</span>
          <button class="btn sm" id="pgmd-chain" style="margin-left:auto;">🔗 联调运行（沿下游链路）</button></div>
        <div id="pgmd-test" style="margin-top:10px;"></div>
      </div>
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">📜</span>测试记录<span style="font-size:12px;color:var(--text-dim);font-weight:400;">${m.runs.length} 次</span>
          ${m.runs.length ? '<button class="btn sm" id="pgmd-archv" style="color:#2e7d32;">📥 收纳最近测试到专有任务</button>' : ''}</div>
        ${m.runs.length ? m.runs.slice().reverse().map(r => `<div style="font-size:12px;padding:6px 0;border-bottom:1px dashed var(--line);">${pgFmt(r.time)} · ${r.chain ? '联调 ' + r.chain : '单模块'} · ${r.ok ? '✔ 通过' : '✖ ' + (r.checkNotes || []).join('；') || '未校验'}</div>`).join('') : '<div style="font-size:12px;color:var(--text-dim);padding:6px 0;">暂无测试记录</div>'}
      </div>
      <div class="gcard">
        <div class="section-title"><span class="st-emoji">🗂</span>版本记录</div>
        ${m.versions.slice().reverse().map(v => `<div style="font-size:12px;padding:6px 0;border-bottom:1px dashed var(--line);"><b>v${v.v}</b> · ${pgFmt(v.time)} · ${esc(v.note || '')} · 输入 ${v.inputs.length} / 输出 ${v.outputs.length} / 外调 ${v.externs.length}</div>`).join('')}
      </div>
      ${pgRefRender(body, 'module', m.id, m.name || '未命名')}`;
    $('#pgmd-back').onclick = () => { pgModView = { v: 'list', id: null }; pgRenderMod(body); };
    $('#pgmd-edit').onclick = () => { pgModView = { v: 'edit', id: m.id }; pgRenderMod(body); };
    $('#pgmd-arch').onclick = () => { if (pgRefWarnOnArchive('module', m.id, m.name || '未命名')) { m.archived = !m.archived; m.updated = pgStamp(); pgSave(); draw(); } };
    $('#pgmd-exp').onclick = () => pgModExport(m);
    $('#pgmd-del').onclick = () => pgDeleteModule(m.id);
    if ($('#pgmd-archv')) $('#pgmd-archv').onclick = () => {
      const lr = m.runs[m.runs.length - 1];
      if (!lr) return;
      PG.pendingTask = { src: 'module', srcId: m.id, srcName: m.name || '未命名', prompt: lr.prompt, output: lr.output, model: '网页版 DeepSeek 方案', modelParams: { url: lr.url, mode: lr.mode, chain: lr.chain }, review: '' };
      pgSave();
      toast('已带入收纳表单 ✓', 'success');
      pgGo('task');
    };
    /* 测试台 */
    const tBox = $('#pgmd-test');
    const renderTest = () => {
      tBox.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;align-items:center;">
          <input class="input" id="pgmd-url" placeholder="DeepSeek 会话链接（留空自动取默认会话）" value="${esc(PG.lastUrl || '')}" style="flex:3;min-width:200px;font-size:12.5px;">
          <button class="btn sm" id="pgmd-defurl">🪷 取默认会话</button>
        </div>
        ${cur.inputs.length ? cur.inputs.map(i => `
          <div style="margin-bottom:8px;">
            <label style="font-size:12px;color:var(--text-dim);">${esc(i.name)}${i.required ? '<span style="color:#e2543f;"> *</span>' : ''} ${esc(i.constraint || '')}</label>
            ${pgVarInputHTML(i, '')}
          </div>`).join('') : '<div style="font-size:12px;color:var(--text-dim);margin-bottom:8px;">无输入，可直接运行。</div>'}
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <button class="btn" id="pgmd-run">▶ 单模块运行（调 ds）</button>
          <span style="font-size:12px;color:var(--text-dim);" id="pgmd-runst"></span>
        </div>
        <textarea class="input" id="pgmd-out" rows="8" readonly placeholder="运行输出与校验结果将显示在这里" style="width:100%;margin-top:8px;resize:vertical;font-family:Consolas,Menlo,monospace;font-size:12px;"></textarea>`;
      $('#pgmd-defurl').onclick = async () => {
        try { const u = await window.__webchat.getSession('base'); if (u) { PG.lastUrl = u; pgSave(); $('#pgmd-url').value = u; toast('已取默认会话 ✓', 'success'); } else toast('暂无可用的默认会话', 'warn'); } catch (e) { toast('读取默认会话失败', 'warn'); }
      };
      $('#pgmd-run').onclick = async () => {
        if (m.archived) { toast('已归档模块不可运行', 'warn'); return; }
        const values = {};
        tBox.querySelectorAll('[data-pgv]').forEach(el => { values[el.dataset.pgv] = el.value; });
        const errs = pgModCheckValues(cur, values);
        if (errs.length) { toast('校验失败：' + errs[0], 'warn'); return; }
        let url = $('#pgmd-url').value.trim();
        if (!url) { try { const u = await window.__webchat.getSession('base'); if (u) { url = u; $('#pgmd-url').value = u; } } catch (e) {} }
        if (!url) { toast('请填写会话链接（或取默认会话）', 'warn'); return; }
        const prompt = pgModBuildPrompt(m, values, $('#pgmd-url') && $('#pgmd-fmt') ? undefined : undefined);
        const btn = $('#pgmd-run');
        btn.disabled = true; btn.textContent = '⏳ 调用 ds 中…（最长 195 秒）';
        const st = $('#pgmd-runst');
        try {
          const r = await window.__webchat.chatPost(url, prompt, 195000, '');
          if (r && r.aborted) { toast('已手动中断', 'warn'); return; }
          if (!r || !r.ok) { toast('调用失败：' + ((r && r.error) || '未知错误'), 'warn'); return; }
          if (r.url && r.url !== url) { PG.lastUrl = r.url; pgSave(); $('#pgmd-url').value = r.url; }
          const run = { time: pgStamp(), mode: 'single', chain: '', inputs: values, prompt, output: (r.text || '').trim(), url };
          pgModCheckOutput(run, cur);
          m.runs.push(run); m.updated = pgStamp(); pgSave();
          $('#pgmd-out').value = '【生成提示词】\n' + prompt + '\n\n【ds 回复】\n' + (run.output || '（空）') + '\n\n【校验】' + (run.ok ? '✔ 通过' : '✖ ' + (run.checkNotes || []).join('；')) + '\n【时间】' + pgFmt(run.time);
          st.textContent = run.ok ? '✔ 校验通过' : '✖ 未通过：' + (run.checkNotes || []).join('；');
        } catch (e) { toast('异常：' + (e && e.message ? e.message : e), 'warn'); }
        finally { btn.disabled = false; btn.textContent = '▶ 单模块运行（调 ds）'; }
      };
    };
    renderTest();
    $('#pgmd-chain').onclick = async () => {
      if (m.archived) { toast('已归档模块不可联调', 'warn'); return; }
      const chain = [m.id];
      let curId = m.id, guard = 0;
      while (guard++ < 6) {
        const next = PG.connections.find(c => c.fromMod === curId);
        if (!next) break;
        if (chain.includes(next.toMod)) { toast('链路存在循环，已中止', 'warn'); break; }
        chain.push(next.toMod);
        curId = next.toMod;
      }
      const steps = [];
      let url = PG.lastUrl || '';
      if (!url) { try { const u = await window.__webchat.getSession('base'); if (u) url = u; } catch (e) {} }
      if (!url) { toast('缺少 DeepSeek 会话链接（请先在测试台取默认会话）', 'warn'); return; }
      const btn = $('#pgmd-chain');
      btn.disabled = true; btn.textContent = '⏳ 联调中…';
      const st = $('#pgmd-runst');
      try {
        let upstream = null;
        for (const mid of chain) {
          const mod = pgModFind(mid);
          if (!mod) continue;
          const c = pgModCur(mod);
          const values = {};
          if (upstream && upstream.outVals) {
            const conn = PG.connections.find(x => x.fromMod === upstream.id && x.toMod === mid);
            if (conn) values[conn.toIn] = upstream.outVals[conn.fromOut] !== undefined ? upstream.outVals[conn.fromOut] : '';
          }
          const errs = pgModCheckValues(c, values);
          if (errs.length) { steps.push({ name: mod.name, note: '✖ ' + errs[0] }); break; }
          const prompt = pgModBuildPrompt(mod, values, undefined);
          const r = await window.__webchat.chatPost(url, prompt, 195000, '');
          if (!r || !r.ok) { steps.push({ name: mod.name, note: '✖ 调用失败：' + ((r && r.error) || '未知错误') }); break; }
          if (r.url && r.url !== url) { url = r.url; PG.lastUrl = url; pgSave(); }
          const run = { time: pgStamp(), mode: 'chain', chain: chain.join('→'), inputs: values, prompt, output: (r.text || '').trim(), url };
          pgModCheckOutput(run, c);
          mod.runs.push(run); mod.updated = pgStamp();
          let outVals = {};
          try { const obj = JSON.parse(run.output); c.outputs.forEach(o => { outVals[o.name] = obj[o.name] !== undefined ? obj[o.name] : ''; }); } catch (e) { outVals = {}; }
          steps.push({ name: mod.name, note: (run.ok ? '✔ 通过' : '✖ ' + (run.checkNotes || []).join('；')) + ' · 输出字段 ' + Object.keys(outVals).length + ' 个' });
          upstream = { id: mod.id, outVals };
        }
        pgSave();
        $('#pgmd-out').value = steps.map((s, i) => (i + 1) + '. ' + s.name + '：' + s.note).join('\n') + '\n\n链路：' + chain.map(id => pgModName(id)).join(' → ');
        st.textContent = '联调完成（' + chain.length + ' 跳）';
        toast('联调完成 ✓', 'success');
        draw();
      } catch (e) { toast('联调异常：' + (e && e.message ? e.message : e), 'warn'); }
      finally { btn.disabled = false; btn.textContent = '🔗 联调运行（沿下游链路）'; }
    };
  };
  draw();
}

function pgModCanvas(body) {
  const draw = () => {
    const missing = pgModMissingInputs();
    const mods = PG.modules.filter(m => !m.archived);
    body.innerHTML = `
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">🕸</span>对接画布
          <span style="font-size:12px;color:var(--text-dim);font-weight:400;">模块节点 + 连线（输入↔输出）· 外调变量走独立逻辑线区</span>
          <button class="btn sm" id="pgmc-back" style="margin-left:auto;">← 返回模块库</button></div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center;">
          <select class="input" id="pgmc-from" style="width:170px;"><option value="">（选择来源模块）</option>${mods.map(m => `<option value="${m.id}">${esc(m.name || '未命名')}</option>`).join('')}</select>
          <select class="input" id="pgmc-out" style="width:150px;"><option value="">来源输出端口</option></select>
          <span style="color:var(--text-dim);">→</span>
          <select class="input" id="pgmc-to" style="width:170px;"><option value="">（选择目标模块）</option>${mods.map(m => `<option value="${m.id}">${esc(m.name || '未命名')}</option>`).join('')}</select>
          <select class="input" id="pgmc-in" style="width:150px;"><option value="">目标输入端口</option></select>
          <button class="btn" id="pgmc-conn">🔗 建立连接</button>
        </div>
        ${missing.length ? `<div style="font-size:12px;color:#e2543f;margin-top:8px;">⚠ ${esc(missing[0])}${missing.length > 1 ? ' 等 ' + missing.length + ' 项' : ''}</div>` : ''}
      </div>
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">🧩</span>模块节点</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:10px;">
          ${mods.map(m => {
            const c = pgModCur(m);
            const missingIn = c.inputs.filter(i => i.required && !PG.connections.some(x => x.toMod === m.id && x.toIn === i.name)).map(i => i.name);
            return `<div style="border:1px solid var(--line);border-radius:10px;padding:10px;">
              <div style="font-weight:700;font-size:13px;">${esc(m.name || '未命名')} <span class="tag">v${c.v}</span></div>
              ${missingIn.length ? `<div style="font-size:11px;color:#e2543f;">⚠ 必填缺失：${esc(missingIn.join('、'))}</div>` : ''}
              <div style="font-size:12px;margin-top:6px;color:var(--text-dim);">输入端口：</div>
              ${c.inputs.length ? c.inputs.map(i => `<div style="font-size:12px;padding:2px 0;">▸ ${esc(i.name)}${i.required ? '<span style="color:#e2543f;">*</span>' : ''}（${PG_TYPE_LABEL[i.type]}）</div>`).join('') : '<div style="font-size:12px;color:var(--text-dim);">无</div>'}
              <div style="font-size:12px;margin-top:6px;color:var(--text-dim);">输出端口：</div>
              ${c.outputs.length ? c.outputs.map(o => `<div style="font-size:12px;padding:2px 0;">◂ ${esc(o.name)}（${PG_TYPE_LABEL[o.type]}）</div>`).join('') : '<div style="font-size:12px;color:var(--text-dim);">无</div>'}
            </div>`;
          }).join('') || '<div style="font-size:12px;color:var(--text-dim);">尚无模块</div>'}
        </div>
      </div>
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">🔌</span>连线与校验
          <span style="font-size:12px;color:var(--text-dim);font-weight:400;">对接五要素：名称 / 类型 / 必填 / 格式 / 顺序</span></div>
        ${PG.connections.length ? PG.connections.map(c => {
          const errs = pgConnValidate(c);
          return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px dashed var(--line);flex-wrap:wrap;">
            <span style="font-size:13px;">${esc(pgModName(c.fromMod))}.${esc(c.fromOut)} → ${esc(pgModName(c.toMod))}.${esc(c.toIn)}</span>
            <span style="font-size:12px;${errs.length ? 'color:#e2543f;' : 'color:#2e7d32;'}">${errs.length ? '✖ ' + esc(errs.join('；')) : '✔ 校验通过'}</span>
            <button class="btn sm" data-conn-del="${c.id}" style="margin-left:auto;">✕ 删除</button>
          </div>`;
        }).join('') : '<div style="font-size:12px;color:var(--text-dim);padding:8px 0;">暂无连线</div>'}
      </div>
      <div class="gcard">
        <div class="section-title"><span class="st-emoji">🧵</span>外调变量逻辑线区
          <span style="font-size:12px;color:var(--text-dim);font-weight:400;">跨模块数据传递 · 独立呈现 · 标注顺序 · 不混入模块连线</span></div>
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;align-items:center;">
          <input class="input" id="pgmc-ename" placeholder="变量名" style="width:120px;">
          <select class="input" id="pgmc-esrc" style="width:150px;"><option value="">来源模块</option>${mods.map(m => `<option value="${m.id}">${esc(m.name || '未命名')}</option>`).join('')}</select>
          <select class="input" id="pgmc-edst" style="width:150px;"><option value="">目标模块</option>${mods.map(m => `<option value="${m.id}">${esc(m.name || '未命名')}</option>`).join('')}</select>
          <input class="input" id="pgmc-eorder" type="number" placeholder="顺序" style="width:70px;">
          <button class="btn sm" id="pgmc-addext">＋ 添加逻辑线</button>
        </div>
        <div id="pgmc-extlist" style="margin-top:8px;"></div>
      </div>`;
    $('#pgmc-back').onclick = () => { pgModView = { v: 'list', id: null }; pgRenderMod(body); };
    const fillPorts = (selMod, portSel, dir) => {
      const m = pgModFind(selMod.value);
      const ports = m ? (dir === 'out' ? pgModCur(m).outputs : pgModCur(m).inputs) : [];
      portSel.innerHTML = '<option value="">' + (dir === 'out' ? '来源输出端口' : '目标输入端口') + '</option>' + ports.map(p => `<option value="${esc(p.name)}">${esc(p.name)}（${PG_TYPE_LABEL[p.type]}）</option>`).join('');
    };
    $('#pgmc-from').onchange = () => fillPorts($('#pgmc-from'), $('#pgmc-out'), 'out');
    $('#pgmc-to').onchange = () => fillPorts($('#pgmc-to'), $('#pgmc-in'), 'in');
    $('#pgmc-conn').onclick = () => {
      const fromMod = $('#pgmc-from').value, fromOut = $('#pgmc-out').value, toMod = $('#pgmc-to').value, toIn = $('#pgmc-in').value;
      if (!fromMod || !fromOut || !toMod || !toIn) { toast('请选择完整的来源与目标端口', 'warn'); return; }
      if (PG.connections.some(x => x.fromMod === fromMod && x.fromOut === fromOut && x.toMod === toMod && x.toIn === toIn)) { toast('该连线已存在', 'warn'); return; }
      const c = { id: pgUid(), fromMod, fromOut, toMod, toIn, mapName: false, created: pgStamp() };
      const errs = pgConnValidate(c);
      if (errs.length) { toast('校验失败：' + errs.join('；'), 'warn'); return; }
      PG.connections.push(c); pgSave(); toast('连线已建立并校验通过 ✓', 'success'); draw();
    };
    body.querySelectorAll('[data-conn-del]').forEach(b => b.onclick = () => {
      PG.connections = PG.connections.filter(x => x.id !== b.dataset.connDel);
      pgSave(); toast('连线已删除', 'info'); draw();
    });
    /* 外调逻辑线列表 */
    const extList = $('#pgmc-extlist');
    const allExt = [];
    PG.modules.forEach(m => pgModCur(m).externs.forEach(e => allExt.push({ mid: m.id, e })));
    extList.innerHTML = allExt.length ? allExt.map(x => `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed var(--line);font-size:12px;flex-wrap:wrap;">
        <span>${esc(pgModName(x.e.srcMod))} → <b>${esc(x.e.name)}</b> → ${esc(pgModName(x.e.dstMod))}</span>
        <span style="color:var(--text-dim);">顺序 ${esc(x.e.order || '—')} · ${PG_TYPE_LABEL[x.e.dataType]}${x.e.required ? ' · 必须' : ''}${x.e.def ? ' · 默认 ' + esc(x.e.def) : ''}</span>
        <span style="color:var(--text-dim);">（定义于模块 ${esc(pgModName(x.mid))}）</span>
      </div>`).join('') : '<div style="font-size:12px;color:var(--text-dim);padding:6px 0;">暂无外调逻辑线（在模块编辑页的「内部变量外调区」配置）</div>';
    $('#pgmc-addext').onclick = () => {
      const name = $('#pgmc-ename').value.trim();
      const srcMod = $('#pgmc-esrc').value, dstMod = $('#pgmc-edst').value, order = $('#pgmc-eorder').value.trim();
      if (!name || !srcMod || !dstMod) { toast('请填写变量名并选择来源/目标模块', 'warn'); return; }
      if (srcMod === dstMod) { toast('来源与目标不能是同一模块', 'warn'); return; }
      /* 写入目标模块的外调列表 */
      const dst = pgModFind(dstMod);
      if (!dst) return;
      const cur = pgModCur(dst);
      if (cur.externs.some(e => e.name === name)) { toast('目标模块已存在同名外调变量', 'warn'); return; }
      cur.externs.push({ name, srcMod, dstMod, dataType: 'text', order, required: false, def: '' });
      dst.updated = pgStamp(); pgSave();
      toast('逻辑线已添加（写入目标模块外调区）✓', 'success'); draw();
    };
  };
  draw();
}

/* ---------- 专有任务提示词（完整实现 · 设计文档阶段 4） ---------- */
let pgTaskView = { v: 'list', id: null };
function pgTaskNew() {
  return { id: pgUid(), name: '', desc: '', archived: false, created: pgStamp(), updated: pgStamp(),
    keywords: [], vars: [],
    versions: [], cacheStatus: 'active', cacheParams: null, releasedAt: null };
}
function pgTaskFind(id) { return PG.tasks.find(t => t.id === id); }
function pgTaskCur(t) { return t.versions[t.versions.length - 1]; }
function pgTaskExport(t) {
  const data = JSON.stringify({ type: 'task', id: t.id, name: t.name, desc: t.desc, created: t.created, updated: t.updated, archived: t.archived, keywords: t.keywords, vars: t.vars, cacheStatus: t.cacheStatus, releasedAt: t.releasedAt, versions: t.versions }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  window.rtDownloadBlob(blob, '专有任务-' + (t.name || '未命名') + '-v' + (t.versions.length ? pgTaskCur(t).v : 0) + '.json', 'promptgen');
}
function pgTaskApplyVars(prompt, vars) {
  let text = prompt || '';
  vars.forEach(v => { text = text.split('{{' + v.name + '}}').join(v.value || ''); });
  return text;
}
function pgTaskCurKeywords(t) { return t.keywords.map(k => k.kw).filter(Boolean); }
function pgRenderTask(body) {
  /* 带入源检测：从工作流/模块一键带入 */
  const pending = PG.pendingTask;
  PG.pendingTask = null; pgSave();
  if (pending) { pgTaskView = { v: 'new', pending }; }
  const draw = () => {
    if (pgTaskView.v === 'new') { pgTaskNewForm(body, pgTaskView.pending || null); return; }
    if (pgTaskView.v === 'detail') { pgTaskDetail(body, pgTaskFind(pgTaskView.id)); return; }
    const q = { s: '', tag: '', arch: 'all' };
    let list = PG.tasks.slice();
    if (q.s) { const k = q.s.toLowerCase(); list = list.filter(t => (t.name + ' ' + (t.desc || '') + ' ' + (t.keywords.map(x => x.kw).join(' ') || '') + ' ' + (t.keywords.map(x => x.tags).join(' ') || '') + ' ' + t.versions.map(v => v.prompt || '').join(' ')).toLowerCase().includes(k)); }
    if (q.tag) list = list.filter(t => t.keywords.some(k => (k.tags || '').split(/[,，]/).map(x => x.trim()).includes(q.tag)));
    if (q.arch === 'arch') list = list.filter(t => t.archived);
    else if (q.arch === 'active') list = list.filter(t => !t.archived);
    list.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
    const allTags = Array.from(new Set(PG.tasks.flatMap(t => (t.keywords || []).flatMap(k => (k.tags || '').split(/[,，]/).map(x => x.trim()).filter(Boolean)))));
    body.innerHTML = `
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">📌</span>专有任务提示词
          <span style="font-size:12px;color:var(--text-dim);font-weight:400;">闭环全文收纳 · 关键词快速替换 · 默认不再进入闭环</span>
          <button class="btn sm" id="pgt-new" style="margin-left:auto;">＋ 手动新建收纳</button></div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center;">
          <input class="input" id="pgt-s" placeholder="搜索名称 / 正文 / 关键词 / 标签…" value="${esc(q.s)}" style="flex:2;min-width:180px;">
          <select class="input" id="pgt-tag" style="width:130px;">
            <option value="">全部标签</option>
            ${allTags.map(t => `<option value="${esc(t)}" ${q.tag === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
          </select>
          <select class="input" id="pgt-arch" style="width:110px;">
            <option value="all" ${q.arch === 'all' ? 'selected' : ''}>全部</option>
            <option value="active" ${q.arch === 'active' ? 'selected' : ''}>未归档</option>
            <option value="arch" ${q.arch === 'arch' ? 'selected' : ''}>已归档</option>
          </select>
          <span style="font-size:12px;color:var(--text-dim);">共 ${list.length} 项</span>
        </div>
      </div>
      ${list.length ? list.map(t => {
        const cur = pgTaskCur(t);
        const kws = pgTaskCurKeywords(t);
        return `<div class="gcard" data-pgt="${t.id}" style="cursor:pointer;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-weight:700;">${esc(t.name || '未命名')}</span>
            <span class="tag">v${cur.v}</span>
            ${t.archived ? '<span class="tag" style="color:var(--text-dim);">已归档</span>' : ''}
            ${cur.src === 'workflow' ? '<span class="tag" style="color:#7c5cd6;">来自工作流</span>' : cur.src === 'module' ? '<span class="tag" style="color:#7c5cd6;">来自模块</span>' : ''}
            <span style="font-size:12px;color:var(--text-dim);">收纳 ${pgFmt(cur.time)}</span>
          </div>
          <div style="font-size:12px;margin-top:4px;color:var(--text-dim);flex-wrap:wrap;display:flex;gap:4px;">
            ${kws.length ? kws.map(k => `<span style="background:var(--bg-soft);padding:1px 7px;border-radius:10px;border:1px solid var(--line);">${esc(k)}</span>`).join('') : '<span>无关键词</span>'}
          </div>
        </div>`;
      }).join('') : '<div class="gcard" style="color:var(--text-dim);font-size:13px;text-align:center;padding:40px 0;">尚无专有任务。<br>可从工作流 / 模块运行结果一键带入，或点击「手动新建收纳」。</div>'}`;
    $('#pgt-new').onclick = () => { pgTaskView = { v: 'new', pending: null }; draw(); };
    $('#pgt-s').oninput = () => { q.s = $('#pgt-s').value; draw(); };
    $('#pgt-tag').onchange = () => { q.tag = $('#pgt-tag').value; draw(); };
    $('#pgt-arch').onchange = () => { q.arch = $('#pgt-arch').value; draw(); };
    body.querySelectorAll('[data-pgt]').forEach(c => c.onclick = () => { pgTaskView = { v: 'detail', id: c.dataset.pgt }; draw(); });
  };
  draw();
}

function pgTaskNewForm(body, pending) {
  const t = pgTaskNew();
  if (pending) {
    t.name = (pending.srcName ? pending.srcName : '未命名') + '（专有任务）';
    t.versions.push({ v: 1, time: pgStamp(), note: '全文收纳', src: pending.src, srcName: pending.srcName, prompt: pending.prompt || '', output: pending.output || '', model: pending.model || '', review: pending.review || '' });
    t.cacheParams = pending.modelParams || null;
    t.cacheStatus = 'active';
  }
  const draw = () => {
    body.innerHTML = `
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">📥</span>${pending ? '全文收纳（从' + (pending.src === 'workflow' ? '工作流' : '模块测试') + '带入）' : '手动新建收纳'}
          <span style="font-size:12px;color:var(--text-dim);font-weight:400;">收纳后不可自动修改 · 六项齐备才可保存</span>
          <button class="btn sm" id="pgn-back" style="margin-left:auto;">← 返回列表</button></div>
        <div style="margin-top:10px;">
          <label style="font-size:12px;color:var(--text-dim);">任务名</label>
          <input class="input" id="pgn-name" value="${esc(t.name)}" style="width:100%;">
          <div style="margin-top:8px;"><label style="font-size:12px;color:var(--text-dim);">用途说明（可选）</label>
          <input class="input" id="pgn-desc" value="${esc(t.desc)}" style="width:100%;"></div>
        </div>
      </div>
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">📄</span>收纳六项<span style="font-size:12px;color:var(--text-dim);font-weight:400;">正文 / 输出 / 模型参数 / 修改意见 / 版本号 / 时间</span></div>
        <div style="margin-top:10px;">
          <label style="font-size:12px;color:var(--text-dim);">① 完整提示词正文 *</label>
          <textarea class="input" id="pgn-prompt" rows="8" style="width:100%;resize:vertical;font-family:Consolas,Menlo,monospace;font-size:12.5px;">${esc(t.versions.length ? t.versions[0].prompt : '')}</textarea>
        </div>
        <div style="margin-top:8px;">
          <label style="font-size:12px;color:var(--text-dim);">② 最终输出结果 *</label>
          <textarea class="input" id="pgn-output" rows="6" style="width:100%;resize:vertical;font-family:Consolas,Menlo,monospace;font-size:12.5px;">${esc(t.versions.length ? t.versions[0].output : '')}</textarea>
        </div>
        <div style="margin-top:8px;">
          <label style="font-size:12px;color:var(--text-dim);">③ 使用模型与参数 *</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <input class="input" id="pgn-model" value="${esc(t.versions.length ? (t.versions[0].model || '') : '网页版 DeepSeek 方案')}" placeholder="方案标识（默认：网页版 DeepSeek 方案）" style="flex:1;min-width:150px;font-size:12.5px;">
            <input class="input" id="pgn-param" placeholder="参数快照（url 等，将入缓存区）" value="${esc(t.cacheParams ? t.cacheParams.url || '' : '')}" style="flex:2;min-width:180px;font-size:12.5px;">
          </div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:4px;">参数完整快照存入独立缓存区；释放缓存区不影响档案正文。</div>
        </div>
        <div style="margin-top:8px;">
          <label style="font-size:12px;color:var(--text-dim);">④ 关键修改意见（可选，闭环过程最终采纳的意见摘要）</label>
          <textarea class="input" id="pgn-review" rows="3" style="width:100%;resize:vertical;font-size:12.5px;">${esc(t.versions.length ? (t.versions[0].review || '') : '')}</textarea>
        </div>
        <div style="margin-top:8px;font-size:12px;color:var(--text-dim);">
          ⑤ 最终版本号：<b>v${t.versions.length ? t.versions[0].v : 1}</b>（保存时自动生成）　⑥ 收纳时间：<b>${t.versions.length ? pgFmt(t.versions[0].time) : pgFmt(pgStamp())}</b>（系统自动记录）
        </div>
      </div>
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">🏷</span>关键词与标签<span style="font-size:12px;color:var(--text-dim);font-weight:400;">用于检索 / 分类 / 标签 · 可绑定多个变量</span></div>
        <div id="pgn-kws" style="margin-top:10px;"></div>
        <button class="btn sm" id="pgn-addkw">＋ 添加关键词</button>
        <div class="section-title" style="margin-top:14px;"><span class="st-emoji">🔑</span>关键词变量<span style="font-size:12px;color:var(--text-dim);font-weight:400;">用户后期自定义 · 可替换 · 正文中以 {{变量名}} 占位</span></div>
        <div id="pgn-vars" style="margin-top:10px;"></div>
        <button class="btn sm" id="pgn-addvar">＋ 添加变量</button>
      </div>
      <div class="gcard">
        <button class="btn" id="pgn-save">💾 保存收纳（生成 v1，收纳后只读）</button>
      </div>`;
    $('#pgn-back').onclick = () => { pgTaskView = { v: 'list', id: null }; draw(); };
    /* 关键词区 */
    const kwBox = $('#pgn-kws');
    const drawKw = () => {
      kwBox.innerHTML = t.keywords.map((k, idx) => `
        <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;align-items:center;">
          <input class="input" data-kw-n="${idx}" placeholder="关键词" value="${esc(k.kw)}" style="width:150px;">
          <input class="input" data-kw-t="${idx}" placeholder="标签（逗号分隔）" value="${esc(k.tags)}" style="width:200px;">
          <select class="input" data-kw-b="${idx}" style="width:170px;">
            <option value="">绑定变量（可多选）</option>
            ${t.vars.map(v => `<option value="${esc(v.name)}">${esc(v.name)}</option>`).join('')}
          </select>
          <button class="btn sm" data-kw-del="${idx}">✕</button>
        </div>`).join('');
      kwBox.querySelectorAll('input[data-kw-n]').forEach(el => el.oninput = () => { t.keywords[+el.dataset.kwN].kw = el.value; });
      kwBox.querySelectorAll('input[data-kw-t]').forEach(el => el.oninput = () => { t.keywords[+el.dataset.kwT].tags = el.value; });
      kwBox.querySelectorAll('button[data-kw-del]').forEach(el => el.onclick = () => { t.keywords.splice(+el.dataset.kwDel, 1); drawKw(); drawVar(); });
    };
    $('#pgn-addkw').onclick = () => { t.keywords.push({ kw: '', tags: '', boundVars: [] }); drawKw(); };
    drawKw();
    /* 变量区 */
    const varBox = $('#pgn-vars');
    const drawVar = () => {
      varBox.innerHTML = t.vars.map((v, idx) => `
        <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;align-items:center;">
          <input class="input" data-var-n="${idx}" placeholder="变量名（如 topic）" value="${esc(v.name)}" style="width:160px;">
          <input class="input" data-var-v="${idx}" placeholder="当前值" value="${esc(v.value)}" style="flex:2;min-width:160px;">
          <button class="btn sm" data-var-del="${idx}">✕</button>
        </div>`).join('');
      varBox.querySelectorAll('input[data-var-n]').forEach(el => el.oninput = () => { t.vars[+el.dataset.varN].name = el.value; drawKw(); });
      varBox.querySelectorAll('input[data-var-v]').forEach(el => el.oninput = () => { t.vars[+el.dataset.varV].value = el.value; });
      varBox.querySelectorAll('button[data-var-del]').forEach(el => el.onclick = () => { t.vars.splice(+el.dataset.varDel, 1); drawVar(); drawKw(); });
    };
    $('#pgn-addvar').onclick = () => { t.vars.push({ name: '', value: '' }); drawVar(); };
    drawVar();
    $('#pgn-save').onclick = () => {
      t.name = $('#pgn-name').value.trim();
      t.desc = $('#pgn-desc').value.trim();
      const prompt = $('#pgn-prompt').value.trim();
      const output = $('#pgn-output').value.trim();
      const model = $('#pgn-model').value.trim() || '网页版 DeepSeek 方案';
      const paramUrl = $('#pgn-param').value.trim();
      if (!t.name) { toast('请填写任务名', 'warn'); return; }
      if (!prompt) { toast('完整提示词正文不能为空', 'warn'); return; }
      const missing = [];
      if (!output) missing.push('最终输出结果');
      if (!model) missing.push('使用模型与参数');
      if (missing.length) { toast('收纳缺项：' + missing.join('、'), 'warn'); return; }
      const kwNames = t.keywords.map(k => k.kw.trim()).filter(Boolean);
      const dup = kwNames.filter((k, i) => kwNames.indexOf(k) !== i);
      if (dup.length) { toast('关键词重复：' + dup[0] + '（需去重）', 'warn'); return; }
      const varNames = t.vars.map(v => v.name.trim()).filter(Boolean);
      const varDup = varNames.filter((n, i) => varNames.indexOf(n) !== i);
      if (varDup.length) { toast('变量名重复：' + varDup[0], 'warn'); return; }
      t.versions[0] = {
        v: 1, time: pgStamp(), note: '全文收纳', src: pending ? pending.src : 'manual',
        srcName: pending ? pending.srcName : '',
        prompt, output, model,
        review: $('#pgn-review').value.trim() || '',
      };
      t.cacheParams = paramUrl ? { url: paramUrl } : null;
      t.cacheStatus = 'active';
      t.keywords = t.keywords.map(k => ({ kw: k.kw.trim(), tags: k.tags.trim(), boundVars: k.boundVars || [] })).filter(k => k.kw);
      t.vars = t.vars.map(v => ({ name: v.name.trim(), value: v.value })).filter(v => v.name);
      t.created = pgStamp(); t.updated = pgStamp();
      PG.tasks.push(t); pgSave();
      if (pending && pending.srcId) pgRefAdd('task', t.id, t.name, pending.src === 'workflow' ? 'flow' : 'module', pending.srcId, 'body_source');
      toast('已收纳 ✓（v1 · 收纳后只读' + (pending && pending.srcId ? ' · 已固化引用来源' : '') + '）', 'success');
      pgTaskView = { v: 'detail', id: t.id }; draw();
    };
  };
  draw();
}

function pgTaskDetail(body, t) {
  if (!t) { pgTaskView = { v: 'list', id: null }; pgRenderTask(body); return; }
  const cur = pgTaskCur(t);
  const cacheActive = t.cacheStatus === 'active';
  const draw = () => {
    body.innerHTML = `
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">📄</span>${esc(t.name || '未命名')}
          <span style="font-size:12px;color:var(--text-dim);font-weight:400;">v${cur.v} · ${t.archived ? '已归档' : '使用中'} · 收纳后只读</span>
          <button class="btn sm" id="pgtd-back" style="margin-left:auto;">← 返回列表</button>
          <button class="btn sm" id="pgtd-copy">📋 复制正文</button>
          <button class="btn sm" id="pgtd-arch">${t.archived ? '↩ 恢复' : '🗄 归档'}</button>
          <button class="btn sm" id="pgtd-exp">📤 导出 JSON</button>
          <button class="btn sm" id="pgtd-del" style="color:#e2543f;">🗑 删除</button></div>
        ${t.desc ? `<div style="font-size:12px;color:var(--text-dim);margin-top:4px;">${esc(t.desc)}</div>` : ''}
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
          <button class="btn" id="pgtd-replace">🔄 替换变量生成新版本</button>
          <button class="btn sm" id="pgtd-saveas">📋 另存为新任务</button>
          <button class="btn sm" id="pgtd-reloop">🔁 重新进入闭环（派生新版本）</button>
        </div>
      </div>
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">📦</span>收纳内容（只读）</div>
        <div style="font-size:12px;margin-top:8px;line-height:1.8;">
          <div><b>① 完整提示词正文</b></div>
          <pre style="white-space:pre-wrap;font-family:Consolas,Menlo,monospace;font-size:12.5px;background:var(--bg-soft);padding:10px;border-radius:8px;margin-top:4px;">${esc(cur.prompt || '')}</pre>
          <div style="margin-top:8px;"><b>② 最终输出结果</b></div>
          <pre style="white-space:pre-wrap;font-family:Consolas,Menlo,monospace;font-size:12.5px;background:var(--bg-soft);padding:10px;border-radius:8px;margin-top:4px;">${esc(cur.output || '')}</pre>
          <div style="margin-top:8px;"><b>③ 使用模型与参数</b>：${esc(cur.model || '—')}　${cacheActive ? '<span style="color:#2e7d32;">✔ 快照已缓存</span>' : '<span style="color:var(--text-dim);">已释放（可重新运行生成快照）</span>'}
            <button class="btn sm" id="pgtd-cache" style="margin-left:8px;">${cacheActive ? '💾 释放缓存区' : '🔄 重新生成快照'}</button></div>
          <div style="margin-top:8px;"><b>④ 关键修改意见</b>：${esc(cur.review || '（无）')}</div>
          <div style="margin-top:8px;"><b>⑤ 最终版本号</b>：v${cur.v}　<b>⑥ 收纳时间</b>：${pgFmt(cur.time)}　<b>来源</b>：${cur.src === 'workflow' ? '工作流' + (cur.srcName ? '（' + esc(cur.srcName) + '）' : '') : cur.src === 'module' ? '模块测试' + (cur.srcName ? '（' + esc(cur.srcName) + '）' : '') : '手动新建'}</div>
        </div>
      </div>
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">🏷</span>关键词<span style="font-size:12px;color:var(--text-dim);font-weight:400;">检索 / 分类 / 标签</span></div>
        <div id="pgtd-kws" style="margin-top:10px;"></div>
        <button class="btn sm" id="pgtd-addkw">＋ 添加关键词</button>
        <div class="section-title" style="margin-top:14px;"><span class="st-emoji">🔑</span>关键词变量<span style="font-size:12px;color:var(--text-dim);font-weight:400;">修改值 → 替换变量生成新版本（不覆盖原版）</span></div>
        <div id="pgtd-vars" style="margin-top:10px;"></div>
        <button class="btn sm" id="pgtd-addvar">＋ 添加变量</button>
      </div>
      <div class="gcard" style="margin-bottom:12px;">
        <div class="section-title"><span class="st-emoji">🗂</span>版本记录<span style="font-size:12px;color:var(--text-dim);font-weight:400;">${t.versions.length} 个版本 · 修改不覆盖原版</span></div>
        ${t.versions.slice().reverse().map(v => `<div style="font-size:12px;padding:6px 0;border-bottom:1px dashed var(--line);"><b>v${v.v}</b> · ${pgFmt(v.time)} · ${esc(v.note || '')}${v.src === 'replace' ? ' · 变量替换' : v.src === 'reloop' ? ' · 重入闭环' : ''}</div>`).join('')}
      </div>
      ${pgRefRender(body, 'task', t.id, t.name || '未命名')}`;
    $('#pgtd-back').onclick = () => { pgTaskView = { v: 'list', id: null }; pgRenderTask(body); };
    $('#pgtd-copy').onclick = () => {
      if (navigator.clipboard) navigator.clipboard.writeText(cur.prompt || '').then(() => toast('已复制正文 ✓', 'success'));
      else toast('请手动选择复制', 'info');
    };
    $('#pgtd-arch').onclick = () => { if (pgRefWarnOnArchive('task', t.id, t.name || '未命名')) { t.archived = !t.archived; t.updated = pgStamp(); pgSave(); draw(); } };
    $('#pgtd-exp').onclick = () => pgTaskExport(t);
    $('#pgtd-del').onclick = () => pgDeleteTask(t.id);
    $('#pgtd-cache').onclick = async () => {
      if (cacheActive) {
        t.cacheStatus = 'released'; t.cacheParams = null; t.releasedAt = pgStamp(); t.updated = pgStamp(); pgSave();
        toast('缓存区已释放（档案正文不受影响）✓', 'info'); draw();
      } else {
        let url = PG.lastUrl || '';
        if (!url) { try { const u = await window.__webchat.getSession('base'); if (u) url = u; } catch (e) {} }
        if (!url) { toast('缺少 DeepSeek 会话链接', 'warn'); return; }
        const btn = $('#pgtd-cache');
        btn.disabled = true; btn.textContent = '⏳ 重新生成快照中…';
        try {
          const r = await window.__webchat.chatPost(url, cur.prompt, 195000, '');
          if (!r || !r.ok) { toast('运行失败：' + ((r && r.error) || '未知错误'), 'warn'); return; }
          if (r.url && r.url !== url) { PG.lastUrl = r.url; pgSave(); }
          t.cacheStatus = 'active'; t.cacheParams = { url: r.url || url }; t.releasedAt = null; t.updated = pgStamp(); pgSave();
          toast('快照已重新生成 ✓', 'success'); draw();
        } catch (e) { toast('异常：' + (e && e.message ? e.message : e), 'warn'); }
        finally { btn.disabled = false; btn.textContent = '🔄 重新生成快照'; }
      }
    };
    /* 关键词区 */
    const kwBox = $('#pgtd-kws');
    const drawKw = () => {
      kwBox.innerHTML = t.keywords.map((k, idx) => `
        <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;align-items:center;">
          <input class="input" data-kw-n="${idx}" placeholder="关键词" value="${esc(k.kw)}" style="width:150px;">
          <input class="input" data-kw-t="${idx}" placeholder="标签（逗号分隔）" value="${esc(k.tags)}" style="width:200px;">
          <input class="input" data-kw-b="${idx}" placeholder="绑定变量（逗号分隔，如 a,b）" value="${esc((k.boundVars || []).join(','))}" style="width:180px;">
          <button class="btn sm" data-kw-del="${idx}">✕</button>
        </div>`).join('');
      kwBox.querySelectorAll('input[data-kw-n]').forEach(el => el.oninput = () => { t.keywords[+el.dataset.kwN].kw = el.value; });
      kwBox.querySelectorAll('input[data-kw-t]').forEach(el => el.oninput = () => { t.keywords[+el.dataset.kwT].tags = el.value; });
      kwBox.querySelectorAll('input[data-kw-b]').forEach(el => el.oninput = () => { t.keywords[+el.dataset.kwB].boundVars = el.value.split(/[,，]/).map(x => x.trim()).filter(Boolean); });
      kwBox.querySelectorAll('button[data-kw-del]').forEach(el => el.onclick = () => { t.keywords.splice(+el.dataset.kwDel, 1); drawKw(); });
    };
    $('#pgtd-addkw').onclick = () => { t.keywords.push({ kw: '', tags: '', boundVars: [] }); drawKw(); };
    drawKw();
    /* 变量区 */
    const varBox = $('#pgtd-vars');
    const drawVar = () => {
      varBox.innerHTML = t.vars.map((v, idx) => `
        <div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;align-items:center;">
          <span style="font-size:12px;width:150px;color:var(--text-dim);">{{${esc(v.name)}}}</span>
          <input class="input" data-var-v="${idx}" placeholder="当前值" value="${esc(v.value)}" style="flex:2;min-width:160px;">
          <span style="font-size:11px;color:var(--text-dim);">命中正文 ${(cur.prompt.match(new RegExp('\\{\\{\\s*' + (v.name || '__none__').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\}\\}', 'g')) || []).length} 处</span>
          <button class="btn sm" data-var-del="${idx}">✕</button>
        </div>`).join('');
      varBox.querySelectorAll('input[data-var-v]').forEach(el => el.oninput = () => { t.vars[+el.dataset.varV].value = el.value; });
      varBox.querySelectorAll('button[data-var-del]').forEach(el => el.onclick = () => { t.vars.splice(+el.dataset.varDel, 1); drawVar(); drawKw(); });
    };
    $('#pgtd-addvar').onclick = () => { t.vars.push({ name: '', value: '' }); drawVar(); };
    drawVar();
    /* 替换变量生成新版本 */
    $('#pgtd-replace').onclick = () => {
      if (t.archived) { toast('已归档任务不可替换', 'warn'); return; }
      const used = t.vars.filter(v => v.name && cur.prompt.indexOf('{{' + v.name + '}}') >= 0);
      if (!used.length) { toast('当前版本正文未命中任何变量占位，无可替换', 'warn'); return; }
      const newPrompt = pgTaskApplyVars(cur.prompt, t.vars);
      const nv = pgNextV(PG.taskV, t.id);
      t.versions.push({ v: nv, time: pgStamp(), note: '变量替换（' + used.map(u => u.name).join('、') + '）', src: 'replace', srcName: cur.srcName, prompt: newPrompt, output: cur.output, model: cur.model, review: cur.review });
      t.updated = pgStamp(); pgSave();
      toast('已生成 v' + nv + '（原版保留）✓', 'success'); draw();
    };
    /* 另存为新任务 */
    $('#pgtd-saveas').onclick = () => {
      const name = prompt('新任务名（当前：' + t.name + '）', t.name + '（副本）');
      if (name === null) return;
      const nt = pgTaskNew();
      nt.name = (name || '').trim() || t.name + '（副本）';
      nt.desc = t.desc;
      nt.keywords = JSON.parse(JSON.stringify(t.keywords));
      nt.vars = JSON.parse(JSON.stringify(t.vars));
      nt.versions = [{ ...cur, v: 1, time: pgStamp(), note: '另存自 v' + cur.v, src: 'saveas' }];
      nt.cacheStatus = 'active'; nt.cacheParams = t.cacheParams ? { ...t.cacheParams } : null;
      PG.tasks.push(nt); pgSave();
      toast('已另存为新任务 ✓', 'success');
      pgTaskView = { v: 'detail', id: nt.id }; draw();
    };
    /* 重新进入闭环（派生） */
    $('#pgtd-reloop').onclick = async () => {
      if (t.archived) { toast('已归档任务不可重入闭环', 'warn'); return; }
      const msg = prompt('填写修改意见（将基于当前正文与输出再次生成）：', '');
      if (msg === null || !msg.trim()) return;
      let url = PG.lastUrl || '';
      if (!url) { try { const u = await window.__webchat.getSession('base'); if (u) url = u; } catch (e) {} }
      if (!url) { toast('缺少 DeepSeek 会话链接', 'warn'); return; }
      const btn = $('#pgtd-reloop');
      btn.disabled = true; btn.textContent = '⏳ 重入闭环生成中…';
      try {
        const r = await window.__webchat.chatPost(url, '请基于以下提示词正文、输出结果与修改意见，仅输出修改后的完整提示词正文，不要输出解释。\n\n【当前正文】\n' + (cur.prompt || '') + '\n\n【当前输出】\n' + (cur.output || '（无）') + '\n\n【修改意见】\n' + msg.trim(), 195000, '');
        if (!r || !r.ok) { toast('生成失败：' + ((r && r.error) || '未知错误'), 'warn'); return; }
        if (r.url && r.url !== url) { PG.lastUrl = r.url; pgSave(); }
        const newPrompt = (r.text || '').trim().replace(/^```[a-zA-Z]*\s*|\s*```$/g, '');
        if (!newPrompt) { toast('AI 未返回有效正文', 'warn'); return; }
        const confirmUse = confirm('AI 返回了新正文，是否采纳并运行获取新输出？\n\n【新正文（前 300 字）】\n' + newPrompt.slice(0, 300));
        if (!confirmUse) return;
        const r2 = await window.__webchat.chatPost(r.url || url, newPrompt, 195000, '');
        if (!r2 || !r2.ok) { toast('新正文运行失败：' + ((r2 && r2.error) || '未知错误'), 'warn'); return; }
        const nv = pgNextV(PG.taskV, t.id);
        t.versions.push({ v: nv, time: pgStamp(), note: '重入闭环：' + msg.trim().slice(0, 30), src: 'reloop', srcName: cur.srcName, prompt: newPrompt, output: (r2.text || '').trim(), model: '网页版 DeepSeek 方案', review: msg.trim() });
        t.updated = pgStamp(); pgSave();
        toast('已派生 v' + nv + '（原版保留）✓', 'success'); draw();
      } catch (e) { toast('异常：' + (e && e.message ? e.message : e), 'warn'); }
      finally { btn.disabled = false; btn.textContent = '🔁 重新进入闭环（派生新版本）'; }
    };
  };
  draw();
}

/* ---------- 四界面引用关系与数据流（设计文档阶段 6） ---------- */
function pgRefKindLabel(kind) { return kind === 'flow' ? '工作流' : kind === 'module' ? '模块' : kind === 'task' ? '专有任务' : '?'; }
function pgRefTypeLabel(t) { return t === 'input_source' ? '输入来源' : t === 'flow_embed' ? '流程嵌入' : t === 'body_source' ? '正文来源' : t === 'module_conn' ? '模块对接' : t; }
function pgRefItem(kind, id) {
  if (kind === 'flow') { const f = pgFlowFind(id); return f ? { name: f.name || '未命名', curV: pgFlowCur(f).v, exists: true, archived: f.archived } : { name: '（已删除）', curV: 0, exists: false, archived: false }; }
  if (kind === 'module') { const m = pgModFind(id); return m ? { name: m.name || '未命名', curV: pgModCur(m).v, exists: true, archived: m.archived } : { name: '（已删除）', curV: 0, exists: false, archived: false }; }
  if (kind === 'task') { const t = pgTaskFind(id); return t ? { name: t.name || '未命名', curV: pgTaskCur(t).v, exists: true, archived: t.archived } : { name: '（已删除）', curV: 0, exists: false, archived: false }; }
  return { name: '?', curV: 0, exists: false, archived: false };
}
function pgRefSnapshot(kind, id) {
  if (kind === 'flow') { const f = pgFlowFind(id); if (!f) return null; const c = pgFlowCur(f); return { v: c.v, body: c.body, vars: c.vars }; }
  if (kind === 'module') { const m = pgModFind(id); if (!m) return null; const c = pgModCur(m); return { v: c.v, flow: c.flow, inputs: c.inputs, outputs: c.outputs }; }
  if (kind === 'task') { const t = pgTaskFind(id); if (!t) return null; const c = pgTaskCur(t); return { v: c.v, prompt: c.prompt, output: c.output }; }
  return null;
}
function pgRefAdd(fromKind, fromId, fromName, refKind, refId, refType) {
  const it = pgRefItem(refKind, refId);
  if (!it.exists) { toast('被引用项不存在', 'warn'); return null; }
  const snap = pgRefSnapshot(refKind, refId);
  const dup = PG.refs.find(r => r.fromKind === fromKind && r.fromId === fromId && r.refKind === refKind && r.refId === refId && r.refType === refType);
  if (dup) { toast('该引用已存在', 'warn'); return null; }
  const r = { id: pgUid(), fromKind, fromId, fromName, refKind, refId, refName: it.name, refType, refVer: it.curV, snapshot: snap, time: pgStamp(), status: 'frozen' };
  PG.refs.push(r); pgSave();
  return r;
}
function pgRefUpgrade(id) {
  const r = PG.refs.find(x => x.id === id);
  if (!r) return;
  const snap = pgRefSnapshot(r.refKind, r.refId);
  if (!snap) { toast('被引用项不存在，无法升级', 'warn'); return; }
  r.refVer = snap.v; r.snapshot = snap; r.status = 'upgraded'; r.upgradedAt = pgStamp();
  pgSave(); toast('引用已升级到 v' + snap.v + ' ✓', 'success');
}
function pgRefStale(r) {
  const it = pgRefItem(r.refKind, r.refId);
  return it.exists && it.curV > r.refVer;
}
function pgRefOf(fromKind, fromId) { return PG.refs.filter(r => r.fromKind === fromKind && r.fromId === fromId); }
function pgRefBy(kind, id) { return PG.refs.filter(r => r.refKind === kind && r.refId === id); }
function pgRefGo(body, kind, id) {
  if (kind === 'flow') { pgGo('flow'); pgFlowDetail(id); return; }
  if (kind === 'module') { pgModView = { v: 'detail', id }; pgGo('mod'); return; }
  if (kind === 'task') { pgTaskView = { v: 'detail', id }; pgGo('task'); return; }
}
function pgRefRender(body, kind, id, selfName) {
  const out = pgRefOf(kind, id);
  const inbound = pgRefBy(kind, id);
  let html = `
    <div class="gcard" style="margin-bottom:12px;">
      <div class="section-title"><span class="st-emoji">🔁</span>引用关系
        <span style="font-size:12px;color:var(--text-dim);font-weight:400;">显式引用 · 固化快照+版本号 · 修改不覆盖原版</span>
        <button class="btn sm" id="pgref-add" style="margin-left:auto;">＋ 建立引用</button></div>
      <div id="pgref-form" style="display:none;margin-top:8px;gap:6px;flex-wrap:wrap;align-items:center;"></div>
      <div class="section-title" style="margin-top:12px;"><span class="st-emoji">📤</span>引用了谁（${out.length}）
        <span style="font-size:11px;color:var(--text-dim);font-weight:400;">上游：被引用方内容变更时仅提示，需显式升级</span></div>
      ${out.length ? out.map(r => {
        const stale = pgRefStale(r);
        const it = pgRefItem(r.refKind, r.refId);
        return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px dashed var(--line);font-size:12px;flex-wrap:wrap;">
          <span style="color:var(--text-dim);">${pgRefKindLabel(r.refKind)}</span>
          <b data-refgo="${r.refKind}|${r.refId}" style="cursor:pointer;color:#2e6be6;">${esc(r.refName)}</b>
          <span>· ${pgRefTypeLabel(r.refType)} · v${r.refVer} · ${pgFmt(r.time)}</span>
          ${stale ? `<span style="color:#d97706;">⚠ 已出新版 v${it.curV}</span><button class="btn sm" data-refup="${r.id}">↑ 升级引用</button>` : ''}
          <button class="btn sm" data-refdel="${r.id}" style="margin-left:auto;">✕</button>
        </div>`;
      }).join('') : '<div style="font-size:12px;color:var(--text-dim);padding:7px 0;">暂无引用（可引用工作流 / 模块 / 专有任务）</div>'}
      <div class="section-title" style="margin-top:12px;"><span class="st-emoji">📥</span>被谁引用（${inbound.length}）
        <span style="font-size:11px;color:var(--text-dim);font-weight:400;">下游：本项修改后将提示这些引用方</span></div>
      ${inbound.length ? inbound.map(r => `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px dashed var(--line);font-size:12px;flex-wrap:wrap;">
          <span style="color:var(--text-dim);">${pgRefKindLabel(r.fromKind)}</span>
          <b data-refgo="${r.fromKind}|${r.fromId}" style="cursor:pointer;color:#2e6be6;">${esc(r.fromName)}</b>
          <span>· ${pgRefTypeLabel(r.refType)} · 指向 v${r.refVer} · ${pgFmt(r.time)}</span>
          <button class="btn sm" data-refdel="${r.id}" style="margin-left:auto;">✕</button>
        </div>`).join('') : '<div style="font-size:12px;color:var(--text-dim);padding:7px 0;">暂无引用方</div>'}
    </div>`;
  setTimeout(() => {
    const addBtn = $('#pgref-add');
    if (!addBtn) return;
    addBtn.onclick = () => {
      const f = $('#pgref-form');
      const show = f.style.display === 'none';
      f.style.display = show ? 'flex' : 'none';
      if (show) {
        const kindOpt = (k) => {
          if (k === 'flow') return PG.flows.map(x => `<option value="${x.id}">${esc(x.name || '未命名')}${x.archived ? '（已归档）' : ''}</option>`).join('');
          if (k === 'module') return PG.modules.map(x => `<option value="${x.id}">${esc(x.name || '未命名')}${x.archived ? '（已归档）' : ''}</option>`).join('');
          if (k === 'task') return PG.tasks.map(x => `<option value="${x.id}">${esc(x.name || '未命名')}${x.archived ? '（已归档）' : ''}</option>`).join('');
          return '';
        };
        f.innerHTML = `
          <select class="input" id="pgref-kind" style="width:110px;">
            <option value="flow">工作流</option><option value="module">模块</option><option value="task">专有任务</option>
          </select>
          <select class="input" id="pgref-item" style="flex:2;min-width:170px;"><option value="">（选择被引用项）</option>${kindOpt('flow')}</select>
          <select class="input" id="pgref-type" style="width:120px;">
            <option value="input_source">输入来源</option><option value="flow_embed">流程嵌入</option><option value="body_source">正文来源</option><option value="module_conn">模块对接</option>
          </select>
          <button class="btn sm" id="pgref-ok">＋ 建立</button>`;
        $('#pgref-kind').onchange = () => { $('#pgref-item').innerHTML = '<option value="">（选择被引用项）</option>' + kindOpt($('#pgref-kind').value); };
        $('#pgref-ok').onclick = () => {
          const refKind = $('#pgref-kind').value, refId = $('#pgref-item').value, refType = $('#pgref-type').value;
          if (!refId) { toast('请选择被引用项', 'warn'); return; }
          if (refKind === kind && refId === id) { toast('不能引用自身', 'warn'); return; }
          const r = pgRefAdd(kind, id, selfName, refKind, refId, refType);
          if (r) { toast('已建立引用（快照+版本号固化）✓', 'success'); pgRefRender(body, kind, id, selfName); }
        };
      }
    };
    body.querySelectorAll('[data-refgo]').forEach(el => el.onclick = () => {
      const [k, i] = el.dataset.refgo.split('|');
      pgRefGo(body, k, i);
    });
    body.querySelectorAll('[data-refdel]').forEach(el => el.onclick = () => {
      PG.refs = PG.refs.filter(x => x.id !== el.dataset.refdel);
      pgSave(); toast('引用已删除', 'info'); pgRefRender(body, kind, id, selfName);
    });
    body.querySelectorAll('[data-refup]').forEach(el => el.onclick = () => { pgRefUpgrade(el.dataset.refup); pgRefRender(body, kind, id, selfName); });
  }, 0);
  return html;
}
function pgRefWarnOnSave(kind, id, name) {
  const by = pgRefBy(kind, id);
  if (!by.length) return;
  toast('⚠ ' + name + ' 被 ' + by.length + ' 处引用：' + by.map(r => pgRefKindLabel(r.fromKind) + '「' + r.fromName + '」').join('、') + '。已生成新版本，引用方仍指向原版本（可在引用关系区升级）。', 'warn');
}
function pgRefWarnOnArchive(kind, id, name) {
  const by = pgRefBy(kind, id);
  if (!by.length) return true;
  return confirm('⚠ ' + name + ' 被 ' + by.length + ' 处引用（' + by.map(r => pgRefKindLabel(r.fromKind) + '「' + r.fromName + '」').join('、') + '）。归档后引用快照仍可读，但将提示断链风险。确认归档？');
}
function pgRefClean(kind, id) {
  PG.refs = PG.refs.filter(r => !((r.fromKind === kind && r.fromId === id) || (r.refKind === kind && r.refId === id)));
}
function pgDeleteFlowVersion(fid, v) {
  const f = pgFlowFind(fid);
  if (!f) return;
  const ver = f.versions.find(x => x.v === v);
  if (!ver) return;
  if (f.versions.length <= 1) { toast('至少需保留一个版本，无法删除最后一个版本', 'warn'); return; }
  const used = PG.refs.filter(r => r.refKind === 'flow' && r.refId === fid && r.refVer === v);
  const msg = '将从本地数据库彻底删除版本 v' + v + '（' + (ver.note || '') + '），不可恢复：\n' +
    (used.length ? '- 引用该版本的记录 ' + used.length + ' 处（同步清理）\n' : '- 无引用记录\n') +
    '\n确认删除？';
  if (!confirm(msg)) return;
  f.versions = f.versions.filter(x => x.v !== v);
  PG.refs = PG.refs.filter(r => !(r.refKind === 'flow' && r.refId === fid && r.refVer === v));
  f.updated = pgStamp(); pgSave();
  toast('已删除 v' + v + '（引用已同步清理）✓', 'success');
  pgFlowDetail(fid);
}
function pgDeleteFlow(id) {
  const f = pgFlowFind(id);
  if (!f) return;
  const refs = pgRefBy('flow', id).length;
  const msg = '将从本地数据库彻底删除工作流「' + (f.name || '未命名') + '」的全部内容（不可恢复）：\n' +
    '- 全部 ' + f.versions.length + ' 个版本记录\n' +
    (refs ? '- 引用关系 ' + refs + ' 处（同步清理）\n' : '') +
    '\n确认彻底删除？';
  if (!confirm(msg)) return;
  pgFlowDropDraft(f);
  PG.flows = PG.flows.filter(x => x.id !== id);
  pgRefClean('flow', id);
  pgSave();
  toast('已彻底删除工作流 ✓', 'success');
  pgRenderFlow($('#pg-body'));
}
function pgDeleteModule(id) {
  const m = pgModFind(id);
  if (!m) return;
  const conns = PG.connections.filter(c => c.fromMod === id || c.toMod === id).length;
  let extRefs = 0;
  PG.modules.forEach(x => { if (x.id !== id) pgModCur(x).externs.forEach(e => { if (e.srcMod === id || e.dstMod === id) extRefs++; }); });
  const refs = pgRefBy('module', id).length;
  const msg = '将从本地数据库彻底删除模块「' + (m.name || '未命名') + '」的全部内容（不可恢复）：\n' +
    '- 全部 ' + m.versions.length + ' 个版本记录\n' +
    '- 全部 ' + m.runs.length + ' 条测试记录\n' +
    (conns ? '- 对接连线 ' + conns + ' 条（同步清理）\n' : '') +
    (extRefs ? '- 其他模块外调引用 ' + extRefs + ' 处（同步清理）\n' : '') +
    (refs ? '- 引用关系 ' + refs + ' 处（同步清理）\n' : '') +
    '\n确认彻底删除？';
  if (!confirm(msg)) return;
  PG.modules = PG.modules.filter(x => x.id !== id);
  PG.connections = PG.connections.filter(c => c.fromMod !== id && c.toMod !== id);
  PG.modules.forEach(x => { if (x.id !== id) pgModCur(x).externs = pgModCur(x).externs.filter(e => e.srcMod !== id && e.dstMod !== id); });
  pgRefClean('module', id);
  pgSave();
  toast('已彻底删除模块（关联连线/外调/引用已同步清理）✓', 'success');
  pgModView = { v: 'list', id: null };
  pgRenderMod($('#pg-body'));
}
function pgDeleteTask(id) {
  const t = pgTaskFind(id);
  if (!t) return;
  const refs = pgRefBy('task', id).length;
  const msg = '将从本地数据库彻底删除专有任务「' + (t.name || '未命名') + '」的全部内容（不可恢复）：\n' +
    '- 全部 ' + t.versions.length + ' 个版本记录\n' +
    '- 关键词 ' + t.keywords.length + ' 个 / 变量 ' + t.vars.length + ' 个\n' +
    (refs ? '- 引用关系 ' + refs + ' 处（同步清理）\n' : '') +
    '\n确认彻底删除？';
  if (!confirm(msg)) return;
  PG.tasks = PG.tasks.filter(x => x.id !== id);
  pgRefClean('task', id);
  pgSave();
  toast('已彻底删除专有任务 ✓', 'success');
  pgTaskView = { v: 'list', id: null };
  pgRenderTask($('#pg-body'));
}

/* ---------- 拓展与调试区（占位） ---------- */
function pgRenderDbg(body) {
  body.innerHTML = `
    <div class="gcard" style="min-height:260px;">
      <div class="section-title"><span class="st-emoji">🧪</span>拓展与调试区
        <span style="font-size:12px;color:var(--text-dim);font-weight:400;">后续功能的试验区</span></div>
      <div style="padding:50px 0;text-align:center;color:var(--text-dim);font-size:13px;">
        <div style="font-size:15px;font-weight:700;margin-bottom:8px;">暂未开放</div>
        该区域为后续功能的试验区，当前不接入任何数据或运行。
      </div>
    </div>`;
}


window.__toolRenderers.promptgen = renderPromptGenTool;
})();

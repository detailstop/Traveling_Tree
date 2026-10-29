'use strict';
/* ============================================================================
   项目优化与当前综述 · 功能背景信息库
   ---------------------------------------------------------------------------
   三栏：左树（勾选/半选/搜索/作废开关） · 中详情（分区折叠） · 右辅助页签（日志/关系/历史）
   数据：/api/plugin/bg_library/bg/*；节点只存出向关系，入向由后端推导；导入分 new / update 两种包。
   ============================================================================ */
(function () {
  const TYPES = { project: '项目', module: '模块', feature: '功能', flow: '流程', interface: '接口', other: '其他' };
  const STATUS = { planned: '计划', active: '在用', deprecated: '作废', broken: '异常', unknown: '未知' };
  const REL = { call: '调用', called_by: '被调用', data_input: '数据输入', data_output: '数据输出' };
  const LIST_FIELDS = [
    ['workflows', '流程'], ['interfaces', '接口'], ['data_requirements', '数据要求'],
    ['ui_rules', 'UI 规则'], ['dependencies', '依赖'], ['known_issues', '已知问题'],
    ['constraints', '约束'], ['next_steps', '下一步'], ['tags', '标签'],
  ];
  const EDIT_LISTS = LIST_FIELDS.filter(([k]) => k !== 'tags');

  const B = {
    root: null, nodes: [], byId: new Map(), children: new Map(), roots: [], incoming: {},
    selected: new Set(), expanded: new Set(), current: null,
    q: '', type: '', status: '', source: '', confidence: '', tag: '', issues: '', rel: '',
    fullText: false, onlyChecked: false, showDeprecated: false,
    tab: 'relations', open: {}, logOpen: false,
    dialog: null, importText: '', preview: null, decisions: {}, busy: false, importError: '',
    edit: null, editError: '', editReason: '', editLog: false,
    history: [], historyOnlyNode: false, histQuery: '', error: '', loaded: false,
    files: {
      open: false, loading: false, data: null, error: '', selected: '', ruleDraft: null, saving: false,
      expanded: new Set(), query: '', searchExpandedFor: '', initialized: false,
    },
    delTarget: null, delReason: '', delAck: false, delError: '', delChildren: [], delRefs: [],
    delIgnoredRefs: [], delOutgoing: [], delIgnoredOutgoing: [],
  };

  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));
  const esc2 = s => (typeof esc === 'function' ? esc(String(s == null ? '' : s)) : String(s == null ? '' : s));

  async function api(path, method = 'GET', body) {
    const res = await fetch(path, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* 非 JSON */ }
    if (!res.ok || (data && data.ok === false)) {
      const err = new Error((data && data.error) || ('请求失败 ' + res.status));
      err.payload = data || {};
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function fmt(iso) {
    if (!iso) return '—';
    const s = String(iso);
    const d = new Date(s.endsWith('Z') || /[+-]\d\d:\d\d$/.test(s) ? s : s + 'Z');
    if (isNaN(d.getTime())) return s.slice(0, 16).replace('T', ' ');
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  const relNode = id => B.byId.get(id) || null;
  const pathOf = id => (relNode(id) || {}).path || '';
  const nameOf = id => (relNode(id) || {}).name || '';

  /* ---------------- 树与勾选 ---------------- */
  function sortPath(a, b) {
    const pa = String(a.path).split('.').map(Number);
    const pb = String(b.path).split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
      const x = pa[i] || 0; const y = pb[i] || 0;
      if (x !== y) return x - y;
    }
    return 0;
  }

  function rebuild() {
    B.byId = new Map(B.nodes.map(n => [n.id, n]));
    B.children = new Map();
    B.nodes.forEach(n => {
      const key = n.parent_id || '';
      if (!B.children.has(key)) B.children.set(key, []);
      B.children.get(key).push(n);
    });
    B.children.forEach(arr => arr.sort(sortPath));
    B.roots = B.children.get('') || [];
  }

  function descendants(id) {
    const out = [];
    const walk = x => (B.children.get(x) || []).forEach(c => { out.push(c.id); walk(c.id); });
    walk(id);
    return out;
  }
  function isFull(id) {
    if (!B.selected.has(id)) return false;
    return descendants(id).every(x => B.selected.has(x));
  }
  function isPartial(id) {
    if (isFull(id)) return false;
    return descendants(id).some(x => B.selected.has(x));
  }
  function setChecked(id, on) {
    [id, ...descendants(id)].forEach(x => (on ? B.selected.add(x) : B.selected.delete(x)));
  }

  /* ---------------- 过滤 ---------------- */
  function nodeText(n, full) {
    const parts = [n.name, n.path, n.summary, ...(n.tags || [])];
    if (full) {
      [...LIST_FIELDS.map(([k]) => k), 'scope'].forEach(k => {
        const v = n[k];
        if (Array.isArray(v)) parts.push(...v);
        else if (v && typeof v === 'object') parts.push(JSON.stringify(v));
      });
      (n.relations || []).forEach(r => parts.push(r.target_path, relNode(r.target_id)?.name || ''));
    }
    return parts.join(' ').toLowerCase();
  }

  function matches(n) {
    if (!B.showDeprecated && n.status === 'deprecated' && n.id !== B.current) return false;
    if (B.onlyChecked && !B.selected.has(n.id)) return false;
    if (B.type && n.node_type !== B.type) return false;
    if (B.status && n.status !== B.status) return false;
    if (B.source && n.source !== B.source) return false;
    if (B.confidence && (n.confidence || '') !== B.confidence) return false;
    if (B.tag && !(n.tags || []).some(t => t.toLowerCase().includes(B.tag.toLowerCase()))) return false;
    if (B.issues === 'issues' && !(n.known_issues || []).length) return false;
    if (B.issues === 'next' && !(n.next_steps || []).length) return false;
    if (B.rel) {
      const q = B.rel.toLowerCase();
      const hit = (n.relations || []).some(r => (r.target_path || '').toLowerCase().includes(q)
        || (nameOf(r.target_id) || '').toLowerCase().includes(q) || r.target_id.includes(q));
      if (!hit) return false;
    }
    if (B.q) {
      const q = B.q.toLowerCase();
      if (!nodeText(n, B.fullText).includes(q)) return false;
    }
    return true;
  }

  function visible() {
    const matched = new Set(B.nodes.filter(matches).map(n => n.id));
    const vis = new Set(matched);
    matched.forEach(id => {
      let p = B.byId.get(id)?.parent_id;
      while (p) { vis.add(p); p = B.byId.get(p)?.parent_id; }
    });
    return { vis, matched };
  }
  const filtering = () => !!(B.q || B.type || B.status || B.source || B.confidence || B.tag || B.issues || B.rel || B.onlyChecked);

  /* 筛选只负责“把命中节点及其祖先展开”，之后完全尊重用户的折叠状态。
     旧实现用 filtering() 强制整棵树常开，导致筛选后三角与折叠按钮全部失效。 */
  function autoExpandFiltered() {
    if (!filtering()) return;
    const { matched } = visible();
    matched.forEach(id => {
      let p = B.byId.get(id)?.parent_id;
      const seen = new Set();
      while (p && !seen.has(p)) {
        seen.add(p);
        B.expanded.add(p);
        p = B.byId.get(p)?.parent_id;
      }
    });
  }

  /* ---------------- 渲染 ---------------- */
  function render() {
    const root = B.root;
    if (!root) return;
    const active = document.activeElement;
    const focusId = active && active.id ? active.id : '';
    const caret = focusId === 'bg-search' && active.selectionStart != null ? active.selectionStart : null;
    root.innerHTML = shellHTML();
    paintTree();
    paintDetail();
    paintSide();
    paintBar();
    paintFiles();
    renderModal();
    if (focusId) {
      const el = document.getElementById(focusId);
      if (el) {
        el.focus();
        if (caret != null) { try { el.setSelectionRange(caret, caret); } catch (e) { /* ignore */ } }
      }
    }
  }

  function shellHTML() {
    return `<div class="bg-app">
      <div class="bg-head">
        <div class="bg-title">
          <span class="bg-logo">◈</span>
          <div><h2>项目优化与当前综述</h2><p>功能背景信息库 · schema 1.0 · 树形浏览 / 勾选导出 / 优化导入 / 历史归档</p></div>
        </div>
        <div class="bg-head-actions">
          <button class="btn ${B.files.open ? '' : 'soft'}" data-a="files">📁 文件预览</button>
          <button class="btn" data-a="import">导入 JSON</button>
          <button class="btn soft" data-a="export">导出勾选</button>
          <button class="btn soft" data-a="history">历史归档</button>
        </div>
      </div>
      <div class="bg-filters">
        <input class="input bg-search" id="bg-search" data-a="search" placeholder="搜索名称 / 路径 / 标签…（勾选全字段可搜全部内容）" value="${esc2(B.q)}">
        <select class="input" data-a="f-type"><option value="">全部类型</option>${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${B.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <select class="input" data-a="f-status"><option value="">全部状态</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${B.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <select class="input" data-a="f-issues"><option value="">不限问题</option><option value="issues" ${B.issues === 'issues' ? 'selected' : ''}>有已知问题</option><option value="next" ${B.issues === 'next' ? 'selected' : ''}>有待办下一步</option></select>
        <input class="input bg-mini" id="bg-tag" data-a="f-tag" placeholder="标签" value="${esc2(B.tag)}">
        <input class="input bg-mini" id="bg-rel" data-a="f-rel" placeholder="关系目标" value="${esc2(B.rel)}">
        <label class="bg-check"><input type="checkbox" data-a="f-fulltext" ${B.fullText ? 'checked' : ''}>全字段</label>
        <label class="bg-check"><input type="checkbox" data-a="f-onlychecked" ${B.onlyChecked ? 'checked' : ''}>仅看已勾选</label>
        <label class="bg-check"><input type="checkbox" data-a="f-deprecated" ${B.showDeprecated ? 'checked' : ''}>显示作废</label>
        <button class="mini-btn" data-a="select-filtered">全选当前筛选</button>
        <button class="mini-btn" data-a="clear-selection">清空勾选</button>
        <span class="bg-sel-count" id="bg-sel-count"></span>
      </div>
      <div class="bg-errorbar" id="bg-hint" hidden></div>
      <div class="bg-grid">
        <aside class="bg-pane bg-tree">
          <div class="bg-pane-head"><b>节点树</b><span id="bg-tree-count"></span>
            <span class="bg-grow"></span>
            <button class="mini-btn" data-a="expand-all">展开</button>
            <button class="mini-btn" data-a="collapse-all">收起</button>
          </div>
          <div class="bg-tree-body" id="bg-tree-body"></div>
        </aside>
        <section class="bg-pane bg-detail" id="bg-detail"></section>
        <aside class="bg-pane bg-side">
          <div class="bg-tabs">${['relations', 'log', 'history'].map(t => `<button class="bg-tab ${B.tab === t ? 'on' : ''}" data-a="tab" data-tab="${t}">${t === 'relations' ? '关系' : t === 'log' ? '变更日志' : '历史归档'}</button>`).join('')}</div>
          <div class="bg-side-body" id="bg-side-body"></div>
        </aside>
      </div>
      <div id="bg-files-host"></div>
      <div class="bg-layer" id="bg-layer"></div>
    </div>`;
  }

  function paintBar() {
    const n = $('#bg-sel-count');
    if (n) n.textContent = `已勾选 ${B.selected.size} 个`;
    const c = $('#bg-tree-count');
    if (c) c.textContent = `${B.nodes.length} 个节点`;
    const hint = $('#bg-hint');
    if (hint) hint.textContent = B.error ? B.error : '';
    if (hint) hint.hidden = !B.error;
  }

  /* ---------------- 文件预览与说明卡片 ---------------- */
  const isDbPath = p => /\.(db|sqlite|sqlite3|db3)$/i.test(String(p || ''));
  const fileByte = n => {
    const b = Number(n) || 0;
    return b > 1024 * 1024 ? (b / 1024 / 1024).toFixed(1) + ' MB' : b > 1024 ? (b / 1024).toFixed(1) + ' KB' : b + ' B';
  };
  function firstFile(node) {
    if (!node) return '';
    if (node.type === 'file') return node.path;
    for (const c of (node.children || [])) {
      const p = firstFile(c);
      if (p) return p;
    }
    return '';
  }
  function fileCount(node) {
    if (!node) return 0;
    return node.type === 'file' ? 1 : (node.children || []).reduce((n, c) => n + fileCount(c), 0);
  }
  function fileMatches(node, q) {
    if (!q) return true;
    if (!node) return false;
    if (node.type === 'file') {
      return (String(node.path || '') + ' ' + String(node.name || '')).toLowerCase().includes(q);
    }
    return (node.children || []).some(c => fileMatches(c, q));
  }
  function fileMatchCount(node, q) {
    if (!q) return fileCount(node);
    if (!node) return 0;
    if (node.type === 'file') return fileMatches(node, q) ? 1 : 0;
    return (node.children || []).reduce((n, c) => n + fileMatchCount(c, q), 0);
  }
  function ensureFileRootExpanded(tree) {
    if (B.files.initialized) return;
    B.files.expanded.add(String((tree && tree.path) || ''));
    B.files.initialized = true;
  }
  function ensureFileSearchExpanded(tree, q) {
    if (!q) { B.files.searchExpandedFor = ''; return; }
    if (B.files.searchExpandedFor === q) return;
    B.files.searchExpandedFor = q;
    const walk = node => {
      if (!node) return false;
      if (node.type === 'file') return fileMatches(node, q);
      let hit = false;
      for (const c of (node.children || [])) {
        if (walk(c)) hit = true;
      }
      if (hit) B.files.expanded.add(String(node.path || ''));
      return hit;
    };
    walk(tree);
  }
  function fileTreeHTML(node, depth, q) {
    if (!node) return '';
    if (node.type === 'file') {
      if (q && !fileMatches(node, q)) return '';
      const sel = B.files.selected === node.path;
      return `<button type="button" class="bg-file-row ${sel ? 'on' : ''} ${node.is_db ? 'is-db' : ''}" data-file="${esc2(node.path)}" title="${esc2(node.path)}" style="padding-left:${8 + depth * 14}px">
        <span class="bg-file-icon">${node.is_db ? '🗄️' : '📄'}</span>
        <span class="bg-file-name">${esc2(node.name)}</span>
        ${node.is_db ? '<span class="bg-file-db">DB</span>' : ''}
        <span class="bg-file-size">${fileByte(node.size)}</span>
      </button>`;
    }
    if (q && !fileMatches(node, q)) return '';
    const path = String(node.path || '');
    const open = B.files.expanded.has(path);
    const count = fileCount(node);
    const childHTML = open ? (node.children || []).map(c => fileTreeHTML(c, depth + 1, q)).join('') : '';
    return `<button type="button" class="bg-file-dir-row" data-dir="${esc2(path)}" title="${esc2(path || node.name)}" style="padding-left:${8 + depth * 14}px">
      <span class="bg-file-caret">${open ? '▾' : '▸'}</span>
      <span class="bg-file-icon">📁</span>
      <span class="bg-file-name">${esc2(node.name)}</span>
      <span class="bg-file-count">${count} 个文件</span>
    </button>` + (open ? `<div class="bg-file-children">${childHTML}</div>` : '');
  }
  function noteFor(path) {
    const d = B.files.data || {};
    return (d.notes && d.notes[path]) || (d.suggestions && d.suggestions[path]) || null;
  }
  function flattenFileNodes(node, out = []) {
    if (!node) return out;
    if (node.type === 'file') out.push(node);
    else (node.children || []).forEach(c => flattenFileNodes(c, out));
    return out;
  }
  function parseNoteDetails(details) {
    const map = {
      '作用': 'purpose', '类别': 'category', '替代性': 'substitutability',
      '依赖': 'depends_on', '被依赖': 'depended_by',
      '模块化建议': 'modularization', '风险等级': 'risk_level', '备注': 'note',
    };
    const out = {};
    String(details || '').split(/\r?\n/).forEach(line => {
      const m = line.match(/^\s*([^：:]+)[：:]\s*(.*)$/);
      if (m && map[m[1].trim()]) out[map[m[1].trim()]] = m[2].trim();
    });
    return out;
  }
  function fileManifestItems() {
    const d = B.files.data || {};
    const files = flattenFileNodes(d.tree);
    return files.map(f => {
      const note = (d.notes && d.notes[f.path]) || null;
      const sug = (d.suggestions && d.suggestions[f.path]) || null;
      const parsed = note ? parseNoteDetails(note.details) : {};
      const purpose = parsed.purpose || (note ? note.details : '') || (sug ? sug.details : '') || '';
      return {
        relative_path: f.path,
        file_name: String(f.path).split('/').pop(),
        purpose,
        owner_node_path: (note && note.feature) || (sug && sug.feature) || '',
        category: parsed.category || (sug ? '未分类' : ''),
        substitutability: parsed.substitutability || '',
        depends_on: parsed.depends_on || '',
        depended_by: parsed.depended_by || '',
        modularization: parsed.modularization || '',
        risk_level: parsed.risk_level || '',
        note: parsed.note || '',
      };
    });
  }
  function exportFilesJSON() {
    if (!B.files.data) { toast('文件预览尚未加载完成', 'warn'); return; }
    const items = fileManifestItems();
    if (!items.length) { toast('当前没有可导出的文件', 'warn'); return; }
    const payload = {
      generated_at: new Date().toISOString(),
      scope: '工作区根目录 · 文件预览已有全部文件',
      items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    if (typeof window.rtDownloadBlob === 'function') {
      window.rtDownloadBlob(blob, 'files_manifest.json');
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'files_manifest.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    toast(`已导出 ${items.length} 个文件的说明 JSON`, 'success');
  }
  function fileEditorHTML(d) {
    const selected = B.files.selected || '';
    const note = noteFor(selected);
    const manual = d.notes && d.notes[selected];
    const noteSource = manual ? 'manual' : (note && note.source === 'suggested' ? 'suggested' : 'blank');
    const sourceText = noteSource === 'manual' ? '手动已保存' : noteSource === 'suggested' ? '背景库建议（保存后覆盖）' : '空白，待人工填写';
    const noteHTML = selected ? `
      <div class="bg-file-editor">
        <div class="bg-file-editor-head"><b>${esc2(selected)}</b><span class="bg-file-source ${noteSource}">${sourceText}</span></div>
        <label class="bg-field">涉及功能 / 背景节点<input class="input" id="bg-file-feature" value="${esc2(note ? note.feature : '')}" placeholder="如：旅行之木/记账本"></label>
        <label class="bg-field">细节<textarea class="input bg-textarea" id="bg-file-details" rows="4" placeholder="这个文件负责什么、关键函数、注意事项">${esc2(note ? note.details : '')}</textarea></label>
        <label class="bg-field">规则 / 约束<textarea class="input bg-textarea" id="bg-file-rules" rows="3" placeholder="修改边界、兼容/迁移规则">${esc2(note ? note.rules : '')}</textarea></label>
        <div class="bg-file-save-row"><button class="btn" data-file-save>💾 保存说明</button>
          ${noteSource === 'suggested' ? '<span class="bg-file-tip">当前显示建议值；保存后来源记为 manual。</span>' : ''}</div>
      </div>` : `<div class="bg-file-editor"><div class="bg-empty" style="padding:16px;">从左侧文件树选择一个文件，查看/编辑说明。</div></div>`;
    const isDb = isDbPath(selected);
    const rules = (d.rules || []).filter(r => r.db_path === selected);
    const rd = B.files.ruleDraft || {};
    const ruleForm = isDb ? `
      <div class="bg-db-rules">
        <div class="bg-db-rules-head"><b>🗄️ 数据库结构化规则</b><span>${esc2(selected)}</span></div>
        <div class="bg-rule-list">${rules.length ? rules.map(r => `<div class="bg-rule-row">
          <div class="bg-rule-main"><b>${esc2(r.table_name)}</b><span>关键字段：${esc2(r.key_fields || '—')}</span>
            <span>写：${esc2(r.writers || '—')} · 读：${esc2(r.readers || '—')}</span>
            <span>迁移：${esc2(r.migration_rule || '—')} · 版本：${esc2(r.version || '—')}</span>
            <span class="bg-rule-time">更新：${esc2(r.updated_at || '—')}</span></div>
          <div class="bg-rule-ops"><button class="mini-btn" data-rule-edit="${r.id}">编辑</button><button class="mini-btn danger" data-rule-del="${r.id}">删除</button></div>
        </div>`).join('') : '<div class="bg-empty" style="padding:10px;">还没有该数据库的规则，填写下方表单新增。</div>'}</div>
        <div class="bg-rule-form">
          <input type="hidden" id="bg-rule-id" value="${esc2(rd.id || '')}">
          <label class="bg-field">表名<input class="input" id="bg-rule-table" value="${esc2(rd.table_name || '')}" placeholder="如：file_notes"></label>
          <label class="bg-field">关键字段 / 含义<input class="input" id="bg-rule-fields" value="${esc2(rd.key_fields || '')}" placeholder="如：path 主键；feature 涉及功能"></label>
          <label class="bg-field">写入方<input class="input" id="bg-rule-writers" value="${esc2(rd.writers || '')}" placeholder="如：core/repository.py upsert_file_note"></label>
          <label class="bg-field">读方<input class="input" id="bg-rule-readers" value="${esc2(rd.readers || '')}" placeholder="如：modules/file_preview.py state()"></label>
          <label class="bg-field">更新 / 迁移规则<input class="input" id="bg-rule-migration" value="${esc2(rd.migration_rule || '')}" placeholder="如：db/schema.sql IF NOT EXISTS"></label>
          <label class="bg-field">版本 / 更新时间<input class="input" id="bg-rule-version" value="${esc2(rd.version || '')}" placeholder="如：schema 1.0 / 2026-10-27"></label>
          <div class="bg-file-save-row"><button class="btn" data-rule-save>💾 保存规则</button>
            ${rd.id ? '<button class="btn soft" data-rule-clear>取消编辑</button>' : ''}</div>
        </div>
      </div>` : `<div class="bg-db-rules"><div class="bg-empty" style="padding:14px;">选择 .db / .sqlite 文件后，可维护表级结构化规则。</div></div>`;
    return noteHTML + ruleForm;
  }
  function paintFileTree() {
    const d = B.files.data;
    if (!d) return;
    const tree = d.tree || { children: [] };
    const q = String(B.files.query || '').trim().toLowerCase();
    ensureFileRootExpanded(tree);
    ensureFileSearchExpanded(tree, q);
    const box = $('#bg-file-tree');
    const scrollTop = box ? box.scrollTop : 0;
    if (box) box.innerHTML = fileTreeHTML(tree, 0, q) || '<div class="bg-empty">没有匹配文件</div>';
    if (box) box.scrollTop = scrollTop;
    const cnt = $('#bg-file-search-count');
    if (cnt) cnt.textContent = q ? `匹配 ${fileMatchCount(tree, q)} 个文件` : '';
  }
  function paintFileEditor() {
    const box = $('#bg-file-editor-wrap');
    if (!box || !B.files.data) return;
    box.innerHTML = fileEditorHTML(B.files.data);
  }
  function paintFiles() {
    const host = $('#bg-files-host');
    if (!host) return;
    if (!B.files.open) { host.innerHTML = ''; return; }
    const d = B.files.data;
    const head = `<div class="bg-files-head"><div><b>📁 文件预览与说明卡片</b>
      <span class="bg-file-sub">运行期扫描工作区 · 数据库文件高亮 · 说明与规则单独存 SQLite</span></div>
      <div class="bg-files-actions"><button class="mini-btn" data-file-export>📤 导出 JSON</button><button class="mini-btn" data-file-refresh>↻ 重新扫描</button><button class="mini-btn" data-file-close>✕ 收起</button></div></div>`;
    if (B.files.loading && !d) {
      host.innerHTML = `<div class="bg-files-card">${head}<div class="bg-empty" style="padding:18px;">正在扫描文件树…</div></div>`;
      return;
    }
    if (B.files.error || !d) {
      host.innerHTML = `<div class="bg-files-card">${head}<div class="bg-errorbar">${esc2(B.files.error || '文件预览加载失败')}</div></div>`;
      return;
    }
    const ex = d.exclusions || {};
    const counts = d.counts || {};
    host.innerHTML = `<div class="bg-files-card">${head}
      <div class="bg-files-search"><input class="input" id="bg-file-search" data-file-search placeholder="筛选文件 / 路径…" value="${esc2(B.files.query || '')}"><span id="bg-file-search-count"></span></div>
      <div class="bg-files-meta">共 ${counts.files || 0} 个文件 · ${counts.dirs || 0} 个目录${counts.truncated ? ' · 已达扫描上限，结果截断' : ''} · 扫描于 ${esc2(d.scanned_at || '')}
        <span class="bg-file-exclusions">排除：${esc2((ex.dir_names || []).join(', '))}${(ex.relative_dirs || []).length ? '；' + esc2((ex.relative_dirs || []).join(', ')) : ''}${(ex.file_globs || []).length ? '；' + esc2((ex.file_globs || []).slice(0, 8).join(', ')) : ''}</span>
      </div>
      <div class="bg-files-grid">
        <aside class="bg-files-tree" id="bg-file-tree"></aside>
        <section class="bg-files-editor-wrap" id="bg-file-editor-wrap"></section>
      </div>
      <div class="bg-files-foot">接口：GET /api/plugin/bg_library/files/state · POST /api/plugin/bg_library/files/note · POST /api/plugin/bg_library/files/rule · POST /api/plugin/bg_library/files/rule/delete（供其他 Agent 读取/更新；不写源码文件）</div>
    </div>`;
    host.onclick = e => {
      const t = e.target;
      const close = t.closest('[data-file-close]');
      if (close) { B.files.open = false; render(); return; }
      const exp = t.closest('[data-file-export]');
      if (exp) { exportFilesJSON(); return; }
      const refresh = t.closest('[data-file-refresh]');
      if (refresh) { loadFiles(true); return; }
      const dir = t.closest('[data-dir]');
      if (dir) {
        const path = dir.dataset.dir || '';
        if (B.files.expanded.has(path)) B.files.expanded.delete(path);
        else B.files.expanded.add(path);
        paintFileTree();
        return;
      }
      const fileBtn = t.closest('[data-file]');
      if (fileBtn) {
        B.files.selected = fileBtn.dataset.file;
        B.files.ruleDraft = null;
        paintFileEditor();
        const treeBox = $('#bg-file-tree');
        if (treeBox) $$('.bg-file-row', treeBox).forEach(x => x.classList.toggle('on', x.dataset.file === B.files.selected));
        const wrap = $('#bg-file-editor-wrap');
        if (wrap) wrap.scrollTop = 0;
        return;
      }
      const save = t.closest('[data-file-save]');
      if (save) {
        const path = B.files.selected;
        if (!path) return;
        const feature = ($('#bg-file-feature') || {}).value || '';
        const details = ($('#bg-file-details') || {}).value || '';
        const rulesText = ($('#bg-file-rules') || {}).value || '';
        B.files.saving = true;
        api('/api/plugin/bg_library/files/note', 'POST', { path, feature, details, rules: rulesText })
          .then(r => {
            B.files.data.notes = B.files.data.notes || {};
            B.files.data.notes[path] = r.note;
            if (B.files.data.suggestions) delete B.files.data.suggestions[path];
            B.files.saving = false;
            paintFileEditor();
            toast('文件说明已保存 ✓', 'success');
          })
          .catch(err => { B.files.saving = false; toast(err.message, 'error'); });
        return;
      }
      const edit = t.closest('[data-rule-edit]');
      if (edit) {
        const r = (B.files.data.rules || []).find(x => String(x.id) === String(edit.dataset.ruleEdit));
        if (r) { B.files.ruleDraft = { ...r }; paintFileEditor(); }
        return;
      }
      const del = t.closest('[data-rule-del]');
      if (del) {
        if (!confirm('删除这条数据库规则？')) return;
        api('/api/plugin/bg_library/files/rule/delete', 'POST', { id: Number(del.dataset.ruleDel) })
          .then(r => {
            if (r.deleted) B.files.data.rules = (B.files.data.rules || []).filter(x => String(x.id) !== String(del.dataset.ruleDel));
            paintFileEditor();
            toast('规则已删除', 'success');
          })
          .catch(err => toast(err.message, 'error'));
        return;
      }
      const rs = t.closest('[data-rule-save]');
      if (rs) {
        const path = B.files.selected;
        const id = ($('#bg-rule-id') || {}).value || '';
        const body = {
          id: id ? Number(id) : undefined,
          db_path: path,
          table_name: ($('#bg-rule-table') || {}).value || '',
          key_fields: ($('#bg-rule-fields') || {}).value || '',
          writers: ($('#bg-rule-writers') || {}).value || '',
          readers: ($('#bg-rule-readers') || {}).value || '',
          migration_rule: ($('#bg-rule-migration') || {}).value || '',
          version: ($('#bg-rule-version') || {}).value || '',
        };
        api('/api/plugin/bg_library/files/rule', 'POST', body)
          .then(r => {
            B.files.data.rules = B.files.data.rules || [];
            const idx = B.files.data.rules.findIndex(x => String(x.id) === String(r.rule.id));
            if (idx >= 0) B.files.data.rules[idx] = r.rule; else B.files.data.rules.push(r.rule);
            B.files.ruleDraft = null;
            paintFileEditor();
            toast('数据库规则已保存 ✓', 'success');
          })
          .catch(err => toast(err.message, 'error'));
        return;
      }
      if (t.closest('[data-rule-clear]')) { B.files.ruleDraft = null; paintFileEditor(); }
    };
    host.oninput = e => {
      const search = e.target.closest('[data-file-search]');
      if (!search) return;
      B.files.query = search.value;
      paintFileTree();
    };
    paintFileTree();
    paintFileEditor();
  }
  function loadFiles(force = false) {
    if (B.files.loading) return;
    B.files.loading = true;
    B.files.error = '';
    paintFiles();
    api('/api/plugin/bg_library/files/state' + (force ? '?refresh=1' : ''))
      .then(d => {
        B.files.data = d;
        if (!B.files.selected) {
          B.files.selected = (d.db_files && d.db_files[0]) || firstFile(d.tree);
        }
        B.files.loading = false;
        paintFiles();
      })
      .catch(err => { B.files.loading = false; B.files.error = err.message; paintFiles(); });
  }

  function paintTree() {
    const box = $('#bg-tree-body');
    if (!box) return;
    if (!B.nodes.length) {
      box.innerHTML = `<div class="bg-empty"><b>还没有背景信息</b><p>这是一个空库。请从「提示词生成器」取背景录入模板，让 Agent 产出 <code>mode:"new"</code> 的 JSON 后导入。</p><button class="btn" data-a="import">全新导入</button></div>`;
      return;
    }
    const { vis } = visible();
    const rows = [];
    const walk = (node, depth) => {
      if (!vis.has(node.id)) return;
      rows.push(treeRow(node, depth));
      const kids = B.children.get(node.id) || [];
      const open = B.expanded.has(node.id);
      if (kids.length && open) kids.forEach(k => walk(k, depth + 1));
    };
    B.roots.forEach(r => walk(r, 0));
    box.innerHTML = rows.join('');
    $$('.bg-row input[type=checkbox]', box).forEach(cb => {
      const id = cb.dataset.id;
      cb.checked = isFull(id);
      cb.indeterminate = !cb.checked && isPartial(id);
    });
  }

  function treeRow(node, depth) {
    const kids = B.children.get(node.id) || [];
    const open = B.expanded.has(node.id);
    const q = B.q ? B.q.toLowerCase() : '';
    const name = q ? esc2(node.name).replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>') : esc2(node.name);
    return `<div class="bg-row ${B.current === node.id ? 'on' : ''} ${node.status === 'deprecated' ? 'dep' : ''}" style="--d:${depth}" data-id="${esc2(node.id)}">
      <button class="bg-caret" data-a="toggle" data-id="${esc2(node.id)}" ${kids.length ? '' : 'disabled'}>${kids.length ? (open ? '▾' : '▸') : '·'}</button>
      <input type="checkbox" data-a="check" data-id="${esc2(node.id)}" aria-label="勾选 ${esc2(node.name)}">
      <button class="bg-row-main" data-a="select" data-id="${esc2(node.id)}">
        <span class="bg-name">${name}</span>
        <span class="bg-tag t-${node.node_type}">${TYPES[node.node_type] || node.node_type}</span>
        <span class="bg-tag s-${node.status}">${STATUS[node.status] || node.status}</span>
        ${node.status === 'deprecated' ? '<span class="bg-tag dep">作废</span>' : ''}
      </button>
      ${node.status === 'deprecated' ? `<button class="bg-del" data-a="delete" data-id="${esc2(node.id)}" title="物理删除该作废节点">删除</button>` : ''}
    </div>`;
  }

  function paintDetail() {
    const box = $('#bg-detail');
    if (!box) return;
    const n = B.current ? relNode(B.current) : null;
    if (!n) {
      box.innerHTML = `<div class="bg-empty"><b>选择左侧节点查看详情</b><p>勾选节点可用于导出；节点详情按概述 / 边界 / 流程 / 接口 / 数据要求 / UI 规则 / 依赖 / 问题 / 约束 / 下一步 / 日志 / 关系 / 扩展分区展示。</p></div>`;
      return;
    }
    const empty = '<span class="bg-none">暂无</span>';
    const sec = (title, body, open = true) => `<details class="bg-sec" ${open ? 'open' : ''}><summary>${title}</summary><div class="bg-sec-body">${body}</div></details>`;
    const list = (field, items) => {
      if (!items || !items.length) return empty;
      const key = n.id + ':' + field;
      const openAll = !!B.open[key];
      const shown = openAll ? items : items.slice(0, 5);
      return `<ul class="bg-list">${shown.map(x => `<li>${esc2(x)}</li>`).join('')}</ul>`
        + (items.length > 5 ? `<button class="mini-btn" data-a="more" data-key="${esc2(key)}">${openAll ? '收起' : '展开全部（' + items.length + '）'}</button>` : '');
    };
    const scope = n.scope || { included: [], excluded: [] };
    const logs = (n.change_log || []).slice().reverse();
    const logShown = B.logOpen ? logs : logs.slice(0, 5);
    const logHTML = logs.length
      ? `<div class="bg-logs">${logShown.map(l => `<div class="bg-log"><div><b>${esc2(l.summary || '（无摘要）')}</b><span class="bg-log-meta">${fmt(l.at)} · ${esc2(l.agent || (l.agent === '' ? '导入' : '导入'))}${l.reason ? ' · ' + esc2(l.reason) : ''}</span></div>${(l.related_paths || []).length ? `<div class="bg-log-paths">${l.related_paths.map(p => `<button class="bg-link" data-a="goto-path" data-path="${esc2(p)}">${esc2(p)}</button>`).join('')}</div>` : ''}</div>`).join('')}</div>`
        + (logs.length > 5 ? `<button class="mini-btn" data-a="more-log">${B.logOpen ? '只看最近 5 条' : '展开全部（' + logs.length + '）'}</button>` : '')
      : empty;

    box.innerHTML = `<div class="bg-detail-head">
        <div class="bg-detail-title">
          <h3>${esc2(n.name)}</h3>
          <div class="bg-detail-meta">
            <span class="bg-tag t-${n.node_type}">${TYPES[n.node_type] || n.node_type}</span>
            <span class="bg-tag s-${n.status}">${STATUS[n.status] || n.status}</span>
            <span class="bg-path">${esc2(n.path)}</span>
            <span class="bg-dim">v${esc2(n.version_tag)} · ${fmt(n.updated_at)} · ${n.source === 'manual' ? '手动' : '导入'}</span>
          </div>
        </div>
        <div class="bg-detail-actions">
          <button class="btn sm" data-a="edit">手动变更</button>
          ${n.status === 'deprecated' ? '<button class="btn soft sm" data-a="restore">恢复</button>' : ''}
          <button class="btn soft sm" data-a="export-node">导出该节点</button>
        </div>
      </div>
      <div class="bg-detail-body">
        ${sec('概述', textBlock(n.summary, n.id + ':summary'))}
        ${sec('功能边界', `<div class="bg-scope"><div><b>包含</b>${list('scope.included', scope.included)}</div><div><b>不包含</b>${list('scope.excluded', scope.excluded)}</div></div>`)}
        ${sec('流程', list('workflows', n.workflows))}
        ${sec('接口', list('interfaces', n.interfaces))}
        ${sec('数据要求', list('data_requirements', n.data_requirements))}
        ${sec('UI 规则', list('ui_rules', n.ui_rules))}
        ${sec('依赖', list('dependencies', n.dependencies))}
        ${sec('已知问题', list('known_issues', n.known_issues))}
        ${sec('约束', list('constraints', n.constraints))}
        ${sec('下一步', list('next_steps', n.next_steps))}
        ${sec('变更日志', logHTML, false)}
        ${sec('关系', relationsHTML(n), false)}
        ${sec('扩展', `<pre class="bg-pre">${esc2(JSON.stringify(n.extensions || {}, null, 2))}</pre>`, false)}
      </div>`;
  }

  function textBlock(text, key) {
    const value = String(text || '').trim();
    if (!value) return '<span class="bg-none">暂无</span>';
    const open = !!B.open['text:' + key];
    const long = value.length > 240 || value.split('\n').length > 6;
    if (!long) return `<p class="bg-text">${esc2(value)}</p>`;
    return `<p class="bg-text ${open ? '' : 'clamp'}">${esc2(value)}</p><button class="mini-btn" data-a="more" data-key="text:${esc2(key)}">${open ? '收起' : '展开全文'}</button>`;
  }

  function relationsHTML(n) {
    const out = n.relations || [];
    const inc = B.incoming[n.id] || [];
    const block = (title, items) => items.length
      ? `<div class="bg-rel-group"><b>${title}</b><ul class="bg-rel-list">${items.map(r => `<li>${relLine(r)}</li>`).join('')}</ul></div>`
      : '';
    const outgoing = ['call', 'data_input', 'data_output'].map(t => block(
      REL[t] + '（出向）',
      out.filter(r => r.relation_type === t).map(r => ({ id: r.target_id, path: r.target_path, note: r.note, type: t }))));
    const incoming = ['call', 'data_input', 'data_output'].map(t => block(
      (t === 'call' ? '被调用' : t === 'data_input' ? '被谁数据输入' : '被谁数据输出') + '（入向）',
      inc.filter(r => r.relation_type === t).map(r => ({ id: r.source_id, path: r.source_path, name: r.source_name, note: r.note, type: t }))));
    const all = outgoing.join('') + incoming.join('');
    return all || '<span class="bg-none">暂无</span>';
  }

  function relLine(r) {
    const target = relNode(r.id);
    if (target) {
      return `<button class="bg-link" data-a="goto" data-id="${esc2(r.id)}">${esc2(target.name)}</button>
        <span class="bg-dim">${esc2(target.path)}${r.note ? ' · ' + esc2(r.note) : ''}</span>`;
    }
    return `<span class="bg-dangling">${esc2(r.name || r.path || r.id)}</span>
      <span class="bg-dim">${esc2(r.path || r.id)} · 目标未在当前数据中</span>`;
  }

  function paintSide() {
    $$('.bg-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === B.tab));
    const box = $('#bg-side-body');
    if (!box) return;
    const n = B.current ? relNode(B.current) : null;
    if (B.tab === 'history') {
      const items = B.historyOnlyNode && n
        ? B.history.filter(x => x.node_id === n.id || (x.changed_paths || []).some(c => c && c.id === n.id))
        : B.history;
      box.innerHTML = `<div class="bg-side-head"><b>历史归档</b><span class="bg-dim">${items.length} 条</span></div>
        <div class="bg-side-tools">
          <label class="bg-check"><input type="checkbox" data-a="hist-only" ${B.historyOnlyNode ? 'checked' : ''}>只看当前节点</label>
          <button class="mini-btn danger" data-a="clear-history">清空历史</button>
        </div>
        <div class="bg-hist-search">
          <input class="input" id="bg-hist-q" data-a="hist-q" placeholder="按节点 id / path 反查（含已删除）" value="${esc2(B.histQuery)}">
          <button class="mini-btn" data-a="hist-q-clear">清空</button>
        </div>
        ${items.length ? `<div class="bg-hist">${items.map(histHTML).join('')}</div><div class="bg-empty sm" id="bg-hist-none" hidden><b>没有匹配记录</b><p>换一个节点 id 或 path 试试。</p></div>` : '<div class="bg-empty sm"><b>暂无历史</b><p>日常优化导入、手动变更与物理删除都会归档在这里。</p></div>'}`;
      applyHistFilter();
      return;
    }
    if (!n) { box.innerHTML = '<div class="bg-empty sm">选择节点后查看。</div>'; return; }
    if (B.tab === 'log') {
      const logs = (n.change_log || []).slice().reverse();
      box.innerHTML = `<div class="bg-side-head"><b>${esc2(n.name)} · 变更日志</b><span class="bg-dim">${logs.length} 条</span></div>
        ${logs.length ? `<div class="bg-logs">${logs.map(l => `<div class="bg-log"><div><b>${esc2(l.summary || '（无摘要）')}</b><span class="bg-log-meta">${fmt(l.at)} · ${esc2(l.agent || '导入')}${l.reason ? ' · ' + esc2(l.reason) : ''}</span></div></div>`).join('')}</div>` : '<div class="bg-empty sm"><b>暂无变更日志</b><p>日志由 Agent 在导入包或手动变更时提供。</p></div>'}`;
      return;
    }
    box.innerHTML = `<div class="bg-side-head"><b>${esc2(n.name)} · 关系</b></div>${relationsHTML(n)}`;
  }

  function histHTML(h) {
    if (h.mode === 'delete' || h.deleted) {
      const snap = h.snapshot || {};
      const refs = h.references || [];
      const cascade = Number(h.cascade_count) || 1;
      const isChild = h.cascade_root && h.node_id && h.node_id !== h.cascade_root;
      const hay = [h.node_id, snap.id, snap.path, snap.name, h.summary, h.reason, h.cascade_root_path].join(' ');
      return `<article class="bg-hist-item" data-hay="${esc2(hay)}"><div class="bg-hist-top"><span class="bg-tag dele">物理删除</span><b>${esc2(h.summary)}</b><span class="bg-tag deleted">节点已删除</span>${cascade > 1 ? `<span class="bg-tag batch">批量 ${cascade} 个</span>` : ''}<span class="bg-dim">${fmt(h.at)}</span></div>
        <p class="bg-dim">原因：${esc2(h.reason || '—')}</p>
        <p class="bg-dim">原节点：${esc2(snap.name || '')} · ${esc2(snap.path || h.path || '')} · <code>${esc2(snap.id || h.node_id || '')}</code></p>
        ${isChild ? `<p class="bg-dim">随主节点 ${esc2(h.cascade_root_path || h.cascade_root)} 一并删除</p>` : ''}
        ${refs.length ? `<p class="bg-dim">删除时入向引用：${refs.map(r => `${esc2(r.source_name || '')}（${esc2(r.source_path || '')}）→ ${esc2(r.target_name || r.target_path || '')}`).join('、')}</p>` : ''}
        <details class="bg-snap"><summary>删除前完整快照</summary><pre class="bg-pre">${esc2(JSON.stringify(snap, null, 2))}</pre></details></article>`;
    }
    if (h.kind === 'manual') {
      const hay = [h.node_id, h.summary, h.reason, ...(h.diffs || []).map(d => d.field)].join(' ');
      return `<article class="bg-hist-item" data-hay="${esc2(hay)}"><div class="bg-hist-top"><span class="bg-tag manual">手动</span><b>${esc2(h.summary)}</b><span class="bg-dim">${fmt(h.at)}</span></div>
        <p class="bg-dim">原因：${esc2(h.reason || '—')}</p>
        ${(h.diffs || []).length ? `<ul class="bg-diff">${h.diffs.map(d => `<li><code>${esc2(d.field)}</code>: ${esc2(JSON.stringify(d.before))} → ${esc2(JSON.stringify(d.after))}</li>`).join('')}</ul>` : ''}</article>`;
    }
    const c = h.counts || {};
    const hay = [h.summary, ...(h.changed_paths || []).flatMap(x => [x.id, x.path])].join(' ');
    return `<article class="bg-hist-item" data-hay="${esc2(hay)}"><div class="bg-hist-top"><span class="bg-tag import">导入</span><b>${esc2(h.summary)}</b><span class="bg-dim">${fmt(h.at)}</span></div>
      <p class="bg-dim">新增 ${c.added || 0} · 更新 ${c.updated || 0} · 作废 ${c.deprecated || 0} · 跳过 ${c.skipped || 0}${c.forced ? ' · 强制覆盖 ' + c.forced : ''}</p></article>`;
  }

  function applyHistFilter() {
    const q = String(B.histQuery || '').trim().toLowerCase();
    let shown = 0;
    $$('.bg-hist-item').forEach(el => {
      const hit = !q || String(el.dataset.hay || '').toLowerCase().includes(q);
      el.hidden = !hit;
      if (hit) shown += 1;
    });
    const none = document.getElementById('bg-hist-none');
    if (none) none.hidden = !q || shown > 0;
  }

  function renderModal() {
    const layer = $('#bg-layer');
    if (!layer) return;
    if (B.dialog === 'edit' && B.edit) { layer.innerHTML = editModalHTML(); return; }
    if (B.dialog === 'import') { layer.innerHTML = importModalHTML(); return; }
    if (B.dialog === 'delete' && B.delTarget) { layer.innerHTML = deleteModalHTML(); return; }
    layer.innerHTML = '';
  }

  function deleteModalHTML() {
    const n = B.delTarget;
    const activeKids = B.delChildren.filter(x => x.status !== 'deprecated');
    const cascadeKids = B.delChildren.filter(x => x.status === 'deprecated');
    const blocked = activeKids.length > 0 || B.delRefs.length > 0 || B.delOutgoing.length > 0;
    const kidList = arr => arr.length
      ? `<ul>${arr.slice(0, 12).map(x => `<li>${esc2(x.name || '')} · ${esc2(x.path || '')} <span class="bg-dim">${esc2(x.id || '')} · ${esc2(STATUS[x.status] || x.status || '')}</span></li>`).join('')}</ul>`
      : '';
    const refList = arr => arr.length
      ? `<ul>${arr.slice(0, 12).map(x => `<li>${esc2(x.source_name || '')} · ${esc2(x.source_path || '')} → ${esc2(x.target_name || '')}（${esc2(x.target_path || x.target_id || '')}） <span class="bg-dim">${esc2(x.source_id || '')} · ${esc2(REL[x.relation_type] || x.relation_type || '')}${x.source_status ? ' · ' + esc2(STATUS[x.source_status] || x.source_status) : ''}</span></li>`).join('')}</ul>`
      : '';
    const ignoredList = arr => arr.length
      ? `<ul>${arr.slice(0, 12).map(x => `<li>${esc2(x.source_name || '')} → ${esc2(x.target_name || x.target_path || x.target_id || '')} <span class="bg-dim">${esc2(x.reason || (x.source_status === 'deprecated' ? '来源已作废' : '目标已作废'))}</span></li>`).join('')}</ul>`
      : '';
    return `<div class="bg-mask" data-a="close-delete"></div>
      <div class="bg-modal bg-delete">
        <div class="bg-modal-head"><h3>物理删除 · ${esc2(n.name)}</h3><button class="bg-x" data-a="close-delete" aria-label="关闭">✕</button></div>
        <p class="bg-hint">仅允许删除 <code>deprecated</code> 作废节点。若其子节点全部为作废，将连同整棵作废子树一并删除；删除范围内出向目标或外部入向来源若已作废/悬空则忽略，存在非作废引用时拒绝。删除前会为每个被删节点写入完整快照、原因与当时引用；<b>节点行删除后不可恢复</b>。</p>
        <div class="bg-del-node">
          <span class="bg-tag s-${n.status}">${STATUS[n.status] || n.status}</span>
          <span class="bg-path">${esc2(n.path)}</span>
          <span class="bg-dim">${esc2(n.id)}</span>
        </div>
        ${activeKids.length ? `<div class="bg-error"><b>存在未作废的子节点，请先处理子节点</b>${kidList(activeKids)}</div>` : ''}
        ${!activeKids.length && cascadeKids.length ? `<div class="bg-warn"><b>将一并删除 ${cascadeKids.length} 个已作废子节点（合计 ${cascadeKids.length + 1} 个）</b>${kidList(cascadeKids)}</div>` : ''}
        ${B.delRefs.length ? `<div class="bg-error"><b>存在非作废外部入向引用，无法删除</b>${refList(B.delRefs)}</div>` : ''}
        ${B.delOutgoing.length ? `<div class="bg-error"><b>存在指向非作废目标的出向关系，无法删除</b>${refList(B.delOutgoing)}</div>` : ''}
        ${B.delIgnoredRefs.length ? `<div class="bg-warn"><b>${B.delIgnoredRefs.length} 条入向引用来源已作废，将忽略</b>${ignoredList(B.delIgnoredRefs)}</div>` : ''}
        ${B.delIgnoredOutgoing.length ? `<div class="bg-warn"><b>${B.delIgnoredOutgoing.length} 条出向目标已作废/悬空，将忽略</b>${ignoredList(B.delIgnoredOutgoing)}</div>` : ''}
        ${blocked ? '' : `<label class="bg-field"><span>删除原因（必填）</span><textarea class="input" id="bg-del-reason" rows="3" placeholder="为什么删除这个节点（将写入历史归档）">${esc2(B.delReason)}</textarea></label>
          <label class="bg-check bg-del-ack"><input type="checkbox" data-a="del-ack" ${B.delAck ? 'checked' : ''}>我确认上述节点（含整棵作废子树）将从树中永久移除，且不可恢复</label>`}
        ${B.delError ? `<div class="bg-error">${esc2(B.delError)}</div>` : ''}
        <div class="bg-modal-actions">
          <button class="btn soft sm" data-a="close-delete">取消</button>
          <button class="btn danger sm" data-a="confirm-delete" ${blocked ? 'disabled' : ''}>${blocked ? '确认物理删除' : `确认物理删除（${cascadeKids.length + 1} 个节点）`}</button>
        </div>
      </div>`;
  }

  /* ---------------- 导入 ---------------- */
  function importModalHTML() {
    const p = B.preview;
    const counts = p && p.preview ? p.preview.counts : null;
    const items = p && p.preview ? p.preview.items || [] : [];
    const decisionsHTML = items.filter(i => ['conflict', 'deprecate', 'out_of_scope'].includes(i.kind)).map(i => {
      if (i.kind === 'conflict') {
        const v = B.decisions[i.key] || 'skip';
        return `<li class="bg-pv-item"><span class="bg-kind conflict">冲突</span><b>${esc2(i.name || i.path)}</b><span class="bg-dim">${esc2(i.reason || '')}</span>
          <select class="input bg-mini" data-a="decision" data-key="${esc2(i.key)}">
            <option value="skip" ${v === 'skip' ? 'selected' : ''}>跳过（默认）</option>
            <option value="force" ${v === 'force' ? 'selected' : ''}>强制覆盖并标记</option>
          </select></li>`;
      }
      if (i.kind === 'deprecate') {
        return `<li class="bg-pv-item"><span class="bg-kind deprecate">拟作废</span><b>${esc2(i.name || i.path)}</b><span class="bg-dim">${esc2(i.reason || '')}</span>
          <label class="bg-check"><input type="checkbox" data-a="decision" data-key="${esc2(i.key)}" ${B.decisions[i.key] === 'confirm' ? 'checked' : ''}>确认作废</label></li>`;
      }
      return `<li class="bg-pv-item"><span class="bg-kind out">范围外</span><b>${esc2(i.name || i.path)}</b><span class="bg-dim">${esc2(i.reason || '')}</span>
        <label class="bg-check"><input type="checkbox" data-a="decision" data-key="${esc2(i.key)}" ${B.decisions[i.key] === 'accept' ? 'checked' : ''}>仍然导入</label></li>`;
    }).join('');
    const plain = items.filter(i => ['new', 'update'].includes(i.kind));
    return `<div class="bg-mask" data-a="close-import"></div>
      <div class="bg-modal">
        <div class="bg-modal-head"><h3>导入背景 JSON</h3><button class="bg-x" data-a="close-import" aria-label="关闭">✕</button></div>
        <p class="bg-hint">按包内 <code>mode</code> 自动识别：<code>new</code> 全新导入（仅格式校验）· <code>update</code> 日常优化（base / current / changed_paths）。先预览，再确认写入。</p>
        <textarea class="input bg-ta" id="bg-import-text" rows="9" placeholder='{"schema_version":"1.0","mode":"new","nodes":[…]}'>${esc2(B.importText)}</textarea>
        <div class="bg-row"><input type="file" id="bg-import-file" accept=".json,application/json"><button class="btn soft sm" data-a="preview">校验并预览</button></div>
        ${B.importError ? `<div class="bg-error">${esc2(B.importError)}</div>` : ''}
        ${p && p.valid && p.preview ? `<div class="bg-preview">
            ${p.preview.schema_warning ? '<div class="bg-warn">schema_version 与 1.0 不一致，可能不兼容（不阻止导入）。</div>' : ''}
            <div class="bg-pv-counts">
              <span class="bg-c-new">新增 ${counts.new || 0}</span>
              <span class="bg-c-up">更新 ${counts.update || 0}</span>
              <span class="bg-c-conf">冲突 ${counts.conflict || 0}</span>
              <span class="bg-c-dep">拟作废 ${counts.deprecate || 0}</span>
              <span class="bg-c-out">范围外 ${counts.outOfScope || 0}</span>
              <span class="bg-c-ph">占位 ${counts.placeholder || 0}</span>
              <span class="bg-c-bad">非法 ${counts.illegal || 0}</span>
            </div>
            ${(p.preview.placeholders || []).length ? `<div class="bg-pv-plain"><b>将自动生成占位父节点</b>${p.preview.placeholders.map(x => `<span class="bg-pv-chip ph">${esc2(x.name)}</span>`).join('')}</div>` : ''}
            ${plain.length ? `<div class="bg-pv-plain"><b>新增 / 更新</b>${plain.slice(0, 12).map(i => `<span class="bg-pv-chip">${esc2(i.name || i.path)}</span>`).join('')}${plain.length > 12 ? `<span class="bg-dim">…共 ${plain.length} 项</span>` : ''}</div>` : ''}
            ${decisionsHTML ? `<ul class="bg-pv-list">${decisionsHTML}</ul>` : ''}
          </div>` : ''}
        ${p && !p.valid ? `<div class="bg-error">${esc2(p.error || '校验失败')}${(p.errors || []).length ? '<ul>' + p.errors.slice(0, 12).map(e => `<li>${esc2(e)}</li>`).join('') + '</ul>' : ''}</div>` : ''}
        <div class="bg-modal-actions">
          <button class="btn soft sm" data-a="abort-import">中止整包</button>
          <button class="btn soft sm" data-a="close-import">取消</button>
          <button class="btn sm" data-a="commit" ${p && p.valid ? '' : 'disabled'}>确认导入</button>
        </div>
      </div>`;
  }

  async function openImport() {
    B.dialog = 'import';
    B.preview = null; B.importError = ''; B.decisions = {};
    if (!B.importText) B.importText = '';
    render();
  }

  function closeImport() {
    B.dialog = null; B.preview = null; B.importError = '';
    B.importText = ''; B.decisions = {};
    render();
  }

  async function previewImport() {
    const ta = $('#bg-import-text');
    if (ta) B.importText = ta.value;
    B.importError = '';
    B.preview = null;
    B.decisions = {};
    let pkg;
    try { pkg = JSON.parse(B.importText); } catch (e) { B.importError = 'JSON 解析失败：' + e.message; render(); return; }
    if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) { B.importError = '顶层必须是 JSON 对象'; render(); return; }
    try {
      B.preview = await api('/api/plugin/bg_library/bg/import/preview', 'POST', { package: pkg });
      if (B.preview.valid && B.preview.preview) {
        (B.preview.preview.items || []).forEach(i => {
          if (i.kind === 'conflict') B.decisions[i.key] = 'skip';
        });
      }
    } catch (e) {
      B.importError = e.message;
    }
    render();
    const ta2 = $('#bg-import-text');
    if (ta2) { ta2.scrollTop = 0; }
  }

  async function commitImport() {
    if (!B.preview || !B.preview.valid) return;
    let pkg;
    try { pkg = JSON.parse(B.importText); } catch (e) { B.importError = 'JSON 解析失败'; render(); return; }
    try {
      const res = await api('/api/plugin/bg_library/bg/import/commit', 'POST', { package: pkg, decisions: B.decisions });
      B.dialog = null; B.preview = null; B.importError = ''; B.importText = ''; B.decisions = {};
      await loadTree();
      const applied = res.applied || {};
      toast('导入完成：' + (res.mode === 'new'
        ? `新增 ${res.imported} 个节点${res.placeholders ? `（含自动占位 ${res.placeholders} 个）` : ''}`
        : `新增 ${applied.added || 0} / 更新 ${applied.updated || 0} / 作废 ${applied.deprecated || 0} / 跳过 ${applied.skipped || 0}`), 'success');
      render();
    } catch (e) {
      B.importError = e.message;
      render();
    }
  }

  /* ---------------- 导出 ---------------- */
  async function doExport(ids) {
    if (!ids.length) { toast('未勾选任何节点，禁止导出', 'warn'); return; }
    try {
      const res = await api('/api/plugin/bg_library/bg/export', 'POST', { selected_ids: ids });
      const pkg = res.package;
      const stamp = new Date();
      const p = n => String(n).padStart(2, '0');
      const name = `项目优化与当前综述_${stamp.getFullYear()}${p(stamp.getMonth() + 1)}${p(stamp.getDate())}_${p(stamp.getHours())}${p(stamp.getMinutes())}.json`;
      const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json;charset=utf-8' });
      await window.rtDownloadBlob(blob, name);
      toast(`已导出 ${pkg.nodes.length} 个节点（含 ${pkg.referenced_nodes.length} 个引用节点）`, 'success');
    } catch (e) { toast('导出失败：' + e.message, 'error'); }
  }

  /* ---------------- 手动变更 ---------------- */
  function openEdit() {
    const n = B.current ? relNode(B.current) : null;
    if (!n) return;
    B.dialog = 'edit';
    B.edit = { id: n.id, node: JSON.parse(JSON.stringify(n)) };
    B.editError = ''; B.editReason = ''; B.editLog = false;
    render();
  }

  function editModalHTML() {
    const n = B.edit.node;
    const textarea = (key, label, value, rows = 2) => `<label class="bg-field"><span>${label}</span><textarea class="input" rows="${rows}" data-f="${key}">${esc2(value || '')}</textarea></label>`;
    const lines = arr => (arr || []).join('\n');
    return `<div class="bg-mask" data-a="close-edit"></div>
      <div class="bg-modal bg-edit">
        <div class="bg-modal-head"><h3>手动变更 · ${esc2(n.name)}</h3><button class="bg-x" data-a="close-edit" aria-label="关闭">✕</button></div>
        <p class="bg-hint">只读字段：id / parent_id / path / node_type / change_log / updated_at / version_tag；结构与作废恢复以外的增删改仍请走导入。</p>
        <div class="bg-form">
          <label class="bg-field"><span>变更原因（必填）</span><input class="input" id="bg-edit-reason" data-f="reason" value="${esc2(B.editReason)}" placeholder="为什么改（必填）"></label>
          <label class="bg-check"><input type="checkbox" data-a="edit-log" ${B.editLog ? 'checked' : ''}>追加到节点变更日志（手写文本）</label>
          <div id="bg-log-wrap" ${B.editLog ? '' : 'hidden'}>${textarea('log_text', '日志文本', '', 2)}</div>
          <div class="bg-error" id="bg-edit-error" ${B.editError ? '' : 'hidden'}>${esc2(B.editError)}</div>
          <div class="bg-frow">
            <label class="bg-field"><span>名称</span><input class="input" data-f="name" value="${esc2(n.name)}"></label>
            <label class="bg-field"><span>状态</span><select class="input" data-f="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${n.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          </div>
          <div class="bg-frow">
            <label class="bg-field"><span>置信度</span><select class="input" data-f="confidence"><option value="">（空）</option>${['high', 'medium', 'low', 'unknown'].map(x => `<option value="${x}" ${n.confidence === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
            ${textarea('tags', '标签（每行一条）', lines(n.tags), 2)}
          </div>
          ${textarea('summary', '概述', n.summary, 3)}
          <div class="bg-frow">
            ${textarea('scope_included', '边界 · 包含（每行一条）', lines(n.scope?.included), 2)}
            ${textarea('scope_excluded', '边界 · 不包含（每行一条）', lines(n.scope?.excluded), 2)}
          </div>
          <div class="bg-fgrid">
            ${EDIT_LISTS.map(([k, label]) => textarea(k, label + '（每行一条）', lines(n[k]), 2)).join('')}
          </div>
          <div class="bg-frow">
            <label class="bg-field"><span>关系（JSON 数组，只写出向）</span><textarea class="input" rows="3" data-f="relations">${esc2(JSON.stringify(n.relations || [], null, 1))}</textarea></label>
            <label class="bg-field"><span>扩展（JSON 对象）</span><textarea class="input" rows="3" data-f="extensions">${esc2(JSON.stringify(n.extensions || {}, null, 1))}</textarea></label>
          </div>
        </div>
        <div class="bg-modal-actions">
          <button class="btn soft sm" data-a="close-edit">取消</button>
          <button class="btn sm" data-a="save-edit">保存手动变更</button>
        </div>
      </div>`;
  }

  function collectEdit() {
    const n = B.edit.node;
    const q = key => document.querySelector(`#bg-layer [data-f="${key}"]`);
    const get = key => (q(key) ? q(key).value : '');
    const split = v => v.split('\n').map(x => x.trim()).filter(Boolean);
    const fields = {};
    const put = (key, value) => {
      const before = JSON.stringify(n[key] === undefined ? null : n[key]);
      const after = JSON.stringify(value);
      if (before !== after) fields[key] = value;
    };
    put('name', get('name').trim());
    put('status', get('status'));
    put('confidence', get('confidence'));
    put('summary', get('summary'));
    put('scope', { included: split(get('scope_included')), excluded: split(get('scope_excluded')) });
    EDIT_LISTS.forEach(([k]) => put(k, split(get(k))));
    put('tags', split(get('tags')));
    try { put('relations', JSON.parse(get('relations') || '[]')); } catch (e) { throw new Error('关系 JSON 解析失败：' + e.message); }
    try { put('extensions', JSON.parse(get('extensions') || '{}')); } catch (e) { throw new Error('扩展 JSON 解析失败：' + e.message); }
    return fields;
  }

  function setEditError(message) {
    B.editError = message || '';
    const box = document.getElementById('bg-edit-error');
    if (box) { box.textContent = B.editError; box.hidden = !B.editError; }
  }

  async function saveEdit() {
    setEditError('');
    const reasonEl = document.getElementById('bg-edit-reason');
    const reason = reasonEl ? reasonEl.value : '';
    if (!String(reason).trim()) { setEditError('必须填写变更原因'); return; }
    let fields;
    try { fields = collectEdit(); } catch (e) { setEditError(e.message); return; }
    if (!Object.keys(fields).length) { setEditError('没有实际改动'); return; }
    const logEl = document.querySelector('#bg-layer [data-f="log_text"]');
    const payload = { reason: String(reason).trim(), fields };
    if (B.editLog) {
      payload.append_log = true;
      payload.log_text = logEl ? logEl.value : '';
      if (!String(payload.log_text || '').trim()) { setEditError('已勾选追加日志，请填写日志文本'); return; }
    }
    try {
      await api('/api/plugin/bg_library/bg/nodes/' + encodeURIComponent(B.edit.id) + '/manual', 'POST', payload);
      B.edit = null;
      B.dialog = null;
      await loadTree();
      toast('手动变更已保存', 'success');
      render();
    } catch (e) { setEditError(e.message); }
  }

  async function restoreNode() {
    const n = B.current ? relNode(B.current) : null;
    if (!n) return;
    const reason = prompt('恢复节点为「在用」，请填写原因：');
    if (reason === null) return;
    if (!String(reason).trim()) { toast('必须填写原因', 'warn'); return; }
    try {
      await api('/api/plugin/bg_library/bg/nodes/' + encodeURIComponent(n.id) + '/manual', 'POST', { reason: reason.trim(), fields: { status: 'active' } });
      await loadTree();
      toast('已恢复为 active', 'success');
      render();
    } catch (e) { toast('恢复失败：' + e.message, 'error'); }
  }

  /* ---------------- 物理删除（仅作废节点；子节点全作废时级联） ---------------- */
  function openDelete(id) {
    const n = relNode(id);
    if (!n) return;
    if (n.status !== 'deprecated') { toast('只有作废节点可以物理删除', 'warn'); return; }
    const kids = descendants(id).map(relNode).filter(Boolean);
    const ids = new Set([id, ...kids.map(x => x.id)]);
    const refs = [], ignoredRefs = [];
    ids.forEach(tid => {
      (B.incoming[tid] || []).forEach(r => {
        if (ids.has(r.source_id)) return;
        const source = relNode(r.source_id);
        const item = { ...r, target_id: tid, target_path: pathOf(tid), target_name: nameOf(tid) };
        if (source && source.status === 'deprecated') ignoredRefs.push(item);
        else refs.push(item);
      });
    });
    const byPath = new Map(B.nodes.map(x => [x.path, x]));
    const outgoing = [], ignoredOutgoing = [];
    ids.forEach(tid => {
      const source = relNode(tid);
      if (!source) return;
      (source.relations || []).forEach(rel => {
        const target = relNode(rel.target_id) || byPath.get(rel.target_path || '') || null;
        const item = {
          source_id: tid, source_name: nameOf(tid), source_path: pathOf(tid),
          relation_type: rel.relation_type, note: rel.note || '',
          target_id: target ? target.id : (rel.target_id || ''),
          target_name: target ? target.name : '',
          target_path: target ? target.path : (rel.target_path || ''),
          target_status: target ? target.status : '',
        };
        if (target && ids.has(target.id)) ignoredOutgoing.push({ ...item, reason: '目标在同一删除范围内' });
        else if (!target) ignoredOutgoing.push({ ...item, reason: '目标已不存在（悬空引用）' });
        else if (target.status === 'deprecated') ignoredOutgoing.push({ ...item, reason: '目标已作废' });
        else outgoing.push(item);
      });
    });
    B.dialog = 'delete';
    B.delTarget = n;
    B.delReason = '';
    B.delAck = false;
    B.delError = '';
    B.delChildren = kids;
    B.delRefs = refs;
    B.delIgnoredRefs = ignoredRefs;
    B.delOutgoing = outgoing;
    B.delIgnoredOutgoing = ignoredOutgoing;
    render();
  }

  function closeDelete() {
    B.dialog = null;
    B.delTarget = null;
    B.delReason = '';
    B.delAck = false;
    B.delError = '';
    B.delChildren = [];
    B.delRefs = [];
    B.delIgnoredRefs = [];
    B.delOutgoing = [];
    B.delIgnoredOutgoing = [];
    render();
  }

  async function confirmDelete() {
    const n = B.delTarget;
    if (!n) return;
    if (B.delChildren.some(x => x.status !== 'deprecated')) {
      B.delError = '存在未作废的子节点，请先处理子节点'; render(); return;
    }
    if (B.delRefs.length || B.delOutgoing.length) { B.delError = '存在非作废引用，不能删除'; render(); return; }
    const reason = String(B.delReason || '').trim();
    if (!reason) { B.delError = '必须填写删除原因'; render(); return; }
    if (!B.delAck) { B.delError = '请勾选确认：删除后不可恢复'; render(); return; }
    try {
      const res = await api('/api/plugin/bg_library/bg/nodes/' + encodeURIComponent(n.id) + '/delete', 'POST', { reason });
      const name = n.name;
      const deletedIds = Array.isArray(res.deleted_ids) ? res.deleted_ids : [n.id];
      const count = Number(res.deleted_count) || deletedIds.length;
      deletedIds.forEach(x => { B.selected.delete(x); B.expanded.delete(x); });
      B.dialog = null;
      B.delTarget = null;
      B.delReason = '';
      B.delAck = false;
      B.delError = '';
      B.delChildren = [];
      B.delRefs = [];
      B.delIgnoredRefs = [];
      B.delOutgoing = [];
      B.delIgnoredOutgoing = [];
      await loadTree();
      await loadHistory();
      render();
      const ignored = (res.ignored_references || []).length + (res.ignored_outgoing || []).length;
      toast((count > 1
        ? `已物理删除「${name}」及 ${count - 1} 个作废子节点，${count} 份完整快照已写入历史归档`
        : `已物理删除「${name}」，完整快照已写入历史归档`) + (ignored ? `；已忽略 ${ignored} 条作废引用` : ''), 'success');
    } catch (e) {
      B.delError = e.message;
      if (Array.isArray(e.payload && e.payload.references)) B.delRefs = e.payload.references;
      if (Array.isArray(e.payload && e.payload.ignored_references)) B.delIgnoredRefs = e.payload.ignored_references;
      if (Array.isArray(e.payload && e.payload.outgoing)) B.delOutgoing = e.payload.outgoing;
      if (Array.isArray(e.payload && e.payload.ignored_outgoing)) B.delIgnoredOutgoing = e.payload.ignored_outgoing;
      if (Array.isArray(e.payload && e.payload.children)) B.delChildren = e.payload.children;
      render();
    }
  }

  /* ---------------- 数据加载 ---------------- */
  async function loadTree() {
    try {
      const d = await api('/api/plugin/bg_library/bg/tree');
      B.nodes = d.nodes || [];
      B.incoming = d.incoming || {};
      rebuild();
      if (!B.current || !B.byId.has(B.current)) {
        B.current = B.roots.length ? B.roots[0].id : null;
      }
      B.roots.forEach(r => B.expanded.add(r.id));
      if (B.current) B.expanded.add(B.current);
      autoExpandFiltered();
      B.error = '';
    } catch (e) {
      B.error = '加载失败：' + e.message;
    }
    B.loaded = true;
  }

  async function loadHistory() {
    try {
      const d = await api('/api/plugin/bg_library/bg/history');
      B.history = d.items || [];
    } catch (e) { B.history = []; }
  }

  /* ---------------- 事件 ---------------- */
  function onClick(e) {
    const el = e.target.closest('[data-a]');
    if (!el) return;
    const a = el.dataset.a;
    const id = el.dataset.id;
    if (a === 'toggle') {
      B.expanded.has(id) ? B.expanded.delete(id) : B.expanded.add(id);
      paintTree();
      return;
    }
    if (a === 'delete') { openDelete(id); return; }
    if (a === 'select') {
      B.current = id;
      if (!B.expanded.has(id)) B.expanded.add(id);
      paintTree(); paintDetail(); paintSide();
      return;
    }
    if (a === 'goto') {
      B.current = id;
      let p = relNode(id)?.parent_id;
      while (p) { B.expanded.add(p); p = relNode(p)?.parent_id; }
      render();
      return;
    }
    if (a === 'goto-path') {
      const target = B.nodes.find(n => n.path === el.dataset.path);
      if (!target) { toast('目标不在当前数据中', 'warn'); return; }
      B.current = target.id;
      let p = target.parent_id;
      while (p) { B.expanded.add(p); p = relNode(p)?.parent_id; }
      render();
      return;
    }
    if (a === 'more') { B.open[el.dataset.key] = !B.open[el.dataset.key]; paintDetail(); return; }
    if (a === 'more-log') { B.logOpen = !B.logOpen; paintDetail(); return; }
    if (a === 'tab') { B.tab = el.dataset.tab; if (B.tab === 'history') loadHistory().then(paintSide); paintSide(); return; }
    if (a === 'expand-all') {
      B.nodes.forEach(n => { if ((B.children.get(n.id) || []).length) B.expanded.add(n.id); });
      paintTree(); return;
    }
    if (a === 'collapse-all') { B.expanded.clear(); paintTree(); return; }
    if (a === 'select-filtered') {
      const { matched } = visible();
      matched.forEach(x => setChecked(x, true));
      paintTree(); paintBar(); return;
    }
    if (a === 'clear-selection') { B.selected.clear(); paintTree(); paintBar(); return; }
    if (a === 'files') {
      B.files.open = !B.files.open;
      render();
      if (B.files.open && !B.files.data) loadFiles();
      return;
    }
    if (a === 'import') { openImport(); return; }
    if (a === 'close-import' || a === 'abort-import') {
      const aborted = a === 'abort-import';
      closeImport();
      if (aborted) toast('已中止整包，未写入任何数据', 'info');
      return;
    }
    if (a === 'preview') { previewImport(); return; }
    if (a === 'commit') { commitImport(); return; }
    if (a === 'export') { doExport([...B.selected]); return; }
    if (a === 'export-node') { if (B.current) doExport([B.current]); return; }
    if (a === 'history') { B.tab = 'history'; loadHistory().then(() => { render(); }); return; }
    if (a === 'clear-history') {
      if (!confirm('清空全部历史归档？该操作不可撤销。')) return;
      api('/api/plugin/bg_library/bg/history/clear', 'POST', {}).then(() => { B.history = []; paintSide(); toast('历史已清空', 'success'); }).catch(err => toast(err.message, 'error'));
      return;
    }
    if (a === 'edit') { openEdit(); return; }
    if (a === 'close-edit') { B.edit = null; B.dialog = null; render(); return; }
    if (a === 'save-edit') { saveEdit(); return; }
    if (a === 'close-delete') { closeDelete(); return; }
    if (a === 'confirm-delete') { confirmDelete(); return; }
    if (a === 'hist-q-clear') {
      B.histQuery = '';
      const input = document.getElementById('bg-hist-q');
      if (input) input.value = '';
      applyHistFilter();
      return;
    }
    if (a === 'edit-log') {
      B.editLog = el.checked;
      const wrap = document.getElementById('bg-log-wrap');
      if (wrap) wrap.hidden = !el.checked;
      return;
    }
    if (a === 'restore') { restoreNode(); return; }
    if (a === 'hist-only') { B.historyOnlyNode = el.checked; paintSide(); return; }
  }

  function onChange(e) {
    const el = e.target;
    const a = el.dataset ? el.dataset.a : '';
    if (a === 'check') {
      setChecked(el.dataset.id, el.checked);
      paintTree(); paintBar();
      return;
    }
    if (a === 'f-type') { B.type = el.value; autoExpandFiltered(); render(); return; }
    if (a === 'f-status') { B.status = el.value; autoExpandFiltered(); render(); return; }
    if (a === 'f-issues') { B.issues = el.value; autoExpandFiltered(); render(); return; }
    if (a === 'f-tag') { B.tag = el.value; autoExpandFiltered(); render(); return; }
    if (a === 'f-rel') { B.rel = el.value; autoExpandFiltered(); render(); return; }
    if (a === 'f-fulltext') { B.fullText = el.checked; autoExpandFiltered(); render(); return; }
    if (a === 'f-onlychecked') { B.onlyChecked = el.checked; autoExpandFiltered(); render(); return; }
    if (a === 'f-deprecated') { B.showDeprecated = el.checked; autoExpandFiltered(); render(); return; }
    if (a === 'del-ack') { B.delAck = el.checked; return; }
    if (a === 'decision') {
      const key = el.dataset.key;
      B.decisions[key] = el.type === 'checkbox' ? (el.checked ? (key.startsWith('deprecate:') ? 'confirm' : 'accept') : '') : el.value;
      return;
    }
    if (el.id === 'bg-import-file' && el.files && el.files[0]) {
      el.files[0].text().then(text => { B.importText = text; render(); });
    }
  }

  let searchTimer = 0;
  function onInput(e) {
    const el = e.target;
    if (el.id === 'bg-import-text') { B.importText = el.value; return; }
    if (el.id === 'bg-hist-q') { B.histQuery = el.value; applyHistFilter(); return; }
    if (el.id === 'bg-del-reason') { B.delReason = el.value; return; }
    if (el.dataset && el.dataset.a === 'search') {
      B.q = el.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { autoExpandFiltered(); paintTree(); paintBar(); }, 160);
      return;
    }
    if (el.id === 'bg-tag') { B.tag = el.value; clearTimeout(searchTimer); searchTimer = setTimeout(() => { autoExpandFiltered(); paintTree(); }, 160); return; }
    if (el.id === 'bg-rel') { B.rel = el.value; clearTimeout(searchTimer); searchTimer = setTimeout(() => { autoExpandFiltered(); paintTree(); }, 160); return; }
    if (el.id === 'bg-edit-reason') { B.editReason = el.value; }
  }

  function onKey(e) {
    if (e.key !== 'Escape') return;
    if (B.dialog === 'edit') { B.edit = null; B.dialog = null; render(); return; }
    if (B.dialog === 'import') { closeImport(); return; }
    if (B.dialog === 'delete') { closeDelete(); }
  }

  /* ---------------- 入口 ---------------- */
  function renderTool() {
    const root = document.querySelector('#tool-view');
    if (!root) return;
    B.root = root;
    if (!root.dataset.bgBound) {
      root.dataset.bgBound = '1';
      root.addEventListener('click', onClick);
      root.addEventListener('change', onChange);
      root.addEventListener('input', onInput);
      root.addEventListener('keydown', onKey);
    }
    render();
    if (!B.loaded) loadTree().then(render);
  }

  window.__bgRenderers = window.__bgRenderers || {};
  window.__bgRenderers['bg-library'] = renderTool;
  window.__toolRenderers['bg-library'] = renderTool;
})();

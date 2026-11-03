'use strict';
/* 按需加载的功能模块：filejudge */
(function () {
  let ROOT = null;
/* ============================================================
   文件判官（扫描筛选 · 逐张审判 · 确认删除）
   ============================================================ */
function renderFileJudgeTool(container) {
  ROOT = container;
  const box = ROOT;
  if (!S.fj) S.fj = { mode: 'setup', files: [], idx: 0, del: [], keep: [], delKb: 0, view: 'card' };
  if (S.fj.mode === 'judge') { if (S.fj.view === 'grid') fjRenderGrid(box); else fjRenderJudge(box); }
  else if (S.fj.mode === 'tree') fjRenderTree(box);
  else fjRenderSetup(box);
}
function fjKB(kb) { return kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb.toFixed(1) + ' KB'; }
function fjBase(p) { return String(p || '').split(/[\\/]/).pop(); }
function fjRenderSetup(box) {
  box.innerHTML = `
    <div class="gcard">
      <div class="section-title"><span class="st-emoji">⚖️</span>文件判官
        <span style="font-size:12px;color:var(--text-dim);font-weight:400;">扫描当前文件夹第一层 · 逐张审判 · 退出时统一确认删除</span></div>
      <div class="fj-form">
        <div class="fj-row"><span>文件夹</span><input class="input" id="fj-path" placeholder="如 C:\\Users\\你\\Downloads" style="flex:1;"></div>
        <div class="fj-row"><span>文件类型</span><div class="fj-kinds" id="fj-kinds">
          ${[['img','🖼️ 图片'],['pdf','📄 PDF'],['doc','📃 文档'],['txt','📝 文本']].map(([v, l]) =>
            `<label class="pi-check"><input type="checkbox" value="${v}" checked> ${l}</label>`).join('')}
        </div></div>
        <div class="fj-row"><span>大小阈值</span>
          <input class="input" id="fj-size" type="number" value="0" min="0" style="width:110px;">
          <span style="color:var(--text-dim);font-size:12px;">KB</span>
          <select class="input" id="fj-cmp" style="width:110px;"><option value="gt">大于</option><option value="lt">小于</option></select>
          <span style="color:var(--text-dim);font-size:12px;">（0 = 不限大小）</span></div>
        <div style="display:flex;gap:10px;align-items:center;margin-top:6px;">
          <button class="btn sm" id="fj-start">⚖️ 开始审判</button>
          <button class="btn sm soft" id="fj-tree">📊 占用分布图</button>
        </div>
      </div>
    </div>`;
  $('#fj-start').onclick = () => {
    const path = $('#fj-path').value.trim();
    if (!path) return toast('请输入文件夹路径', 'warn');
    const types = [...$('#fj-kinds').querySelectorAll('input:checked')].map(x => x.value);
    if (!types.length) return toast('请至少选择一种文件类型', 'warn');
    const size_kb = parseFloat($('#fj-size').value) || 0;
    const cmp = $('#fj-cmp').value;
    toast('正在扫描…', 'info');
    apiPost('/api/plugin/filejudge/scan', { path, types, size_kb, cmp }).then(r => {
      if (!r || !r.ok) return toast((r && r.error) || '扫描失败', 'error');
      if (!r.count) return toast('该条件下没有匹配文件' + (r.skipped ? `（已自动略过 ${r.skipped} 个曾保留的文件）` : ''), 'warn');
      S.fj = { mode: 'judge', files: r.files, idx: 0, del: [], keep: [], delKb: 0, skipped: r.skipped || 0 };
      fjRenderJudge(ROOT);
      toast(`共 ${r.count} 个文件待审判 ✓` + (r.skipped ? `（已自动略过 ${r.skipped} 个曾保留的文件）` : ''), 'success');
    });
  };
  $('#fj-tree').onclick = () => {
    const path = $('#fj-path').value.trim();
    if (!path) return toast('请输入文件夹路径', 'warn');
    toast('正在扫描目录树…', 'info');
    apiPost('/api/plugin/filejudge/tree', { path }).then(r => {
      if (!r || !r.ok) return toast((r && r.error) || '扫描失败', 'error');
      S.fj.mode = 'tree'; S.fj.tree = r.root; S.fj.treeTrunc = !!r.truncated;
      if (!S.fj.treeView) S.fj.treeView = fjCountNodes(r.root) > 150 ? 'list' : 'chart';
      fjRenderTree(ROOT);
      toast('占用分布图已生成 ✓' + (r.truncated ? '（节点过多已截断）' : ''), 'success');
    });
  };
}
function fjSize(b) {
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB';
  if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
  if (b >= 1024) return (b / 1024).toFixed(1) + ' KB';
  return b + ' B';
}
function fjClip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }
function fjColorT(t) {
  const h = 140 - 140 * Math.min(1, Math.max(0, t));
  return `hsl(${h}, 72%, ${Math.round(46 - 14 * t)}%)`;
}
function fjShapeSVG(kind, x, y, fill) {
  const poly = pts => `<polygon points="${pts.map(([a, b]) => (x + a) + ',' + (y + b)).join(' ')}" fill="${fill}" stroke="#fff" stroke-width="1.4"></polygon>`;
  switch (kind) {
    case 'dir': return `<rect x="${x - 11}" y="${y - 11}" width="22" height="22" rx="5" fill="${fill}" stroke="#fff" stroke-width="1.4"></rect>`;
    case 'img': return `<circle cx="${x}" cy="${y}" r="10" fill="${fill}" stroke="#fff" stroke-width="1.4"></circle>`;
    case 'pdf': return `<rect x="${x - 8}" y="${y - 10}" width="16" height="20" rx="1.5" fill="${fill}" stroke="#fff" stroke-width="1.4"></rect>`;
    case 'doc': return poly([[0, -11], [9.5, 6], [-9.5, 6]]);
    case 'txt': return poly([[0, -9], [7, 0], [0, 9], [-7, 0]]);
    default: return poly([[0, -10], [9, -5], [9, 5], [0, 10], [-9, 5], [-9, -5]]);
  }
}
function fjVisibleTree(n, collapsed) {
  const folded = collapsed.has(n.path);
  const kids = folded ? [] : (n.children || []).map(c => fjVisibleTree(c, collapsed));
  const copy = { name: n.name, path: n.path, size: n.size, kind: n.kind, children: kids };
  if (folded) { copy._folded = true; copy._foldCount = (n.children || []).length; }
  return copy;
}
function fjDirPaths(n, out, isRoot) {
  if (!isRoot && n.kind === 'dir') out.push(n.path);
  (n.children || []).forEach(c => fjDirPaths(c, out, false));
  return out;
}
function fjTreeLayout(root) {
  const list = [];
  let slot = 0, maxD = 0;
  const padL = 62, padT = 44, slotW = 44, layerH = 62;
  const visit = (n, depth, parent) => {
    n._parent = parent;
    maxD = Math.max(maxD, depth);
    let x;
    if (!n.children || !n.children.length) { x = padL + slot * slotW; slot++; }
    else {
      const xs = n.children.map(c => visit(c, depth + 1, n));
      x = xs.reduce((a, b) => a + b, 0) / xs.length;
    }
    n._xy = { x, y: padT + depth * layerH };
    list.push(n);
    return x;
  };
  visit(root, 0, null);
  const W = Math.max(480, padL * 2 + Math.max(1, slot - 1) * slotW);
  const H = padT + (maxD + 1) * layerH + 24;
  return { list, W, H };
}
function fjCountNodes(n) {
  return 1 + (n.children || []).reduce((s, c) => s + fjCountNodes(c), 0);
}
function fjTypeEmoji(kind) {
  return kind === 'dir' ? '📁' : kind === 'img' ? '🖼️' : kind === 'pdf' ? '📄'
    : kind === 'doc' ? '📃' : kind === 'txt' ? '📝' : '⬡';
}
function fjReveal(path) {
  apiPost('/api/plugin/filejudge/reveal', { path }).then(r => {
    if (!r || !r.ok) return toast((r && r.error) || '定位失败', 'error');
    toast('已在资源管理器中打开 ✓', 'success');
  });
}
function fjRenderTree(box) {
  const full = S.fj.tree;
  if (!full) return;
  if (!S.fj.collapsed) S.fj.collapsed = new Set();
  const view = S.fj.treeView === 'list' ? 'list' : 'chart';
  box.innerHTML = `
    <div class="gcard">
      <div class="section-title"><span class="st-emoji">📊</span>内存占用分布图
        <span style="font-size:12px;color:var(--text-dim);font-weight:400;">${esc(full.path)} · 点击三角展开/收起文件夹 · 点击节点在资源管理器中定位</span></div>
      <div class="fj-tree-legend">
        <span>📁 文件夹</span><span>🖼️ 图片</span><span>📄 PDF</span><span>📃 文档</span><span>📝 文本</span><span>⬡ 其他</span>
        <span style="margin-left:14px;">颜色=大小：<b style="color:#34d399">小</b> → <b style="color:#fbbf24">中</b> → <b style="color:#f87171">大</b></span>
        ${S.fj.treeTrunc ? '<span style="color:#e5484d;">（节点过多已截断）</span>' : ''}
      </div>
      <div style="display:flex;gap:8px;margin:0 0 10px;flex-wrap:wrap;align-items:center;">
        <button class="btn sm ${view === 'chart' ? '' : 'soft'}" id="fj-view-chart">🌳 树图</button>
        <button class="btn sm ${view === 'list' ? '' : 'soft'}" id="fj-view-list">📋 列表</button>
        <span style="width:1px;height:18px;background:var(--line);"></span>
        <button class="btn sm soft" id="fj-tree-expand">📂 全部展开</button>
        <button class="btn sm soft" id="fj-tree-collapse">📁 全部收起</button>
        <button class="btn sm soft" id="fj-tree-back">⬅ 返回设置</button>
        <button class="btn sm soft" id="fj-tree-refresh">🔄 重新扫描</button>
      </div>
      <div id="fj-tree-body"></div>
    </div>`;
  const body = box.querySelector('#fj-tree-body');
  if (view === 'chart') fjRenderTreeChart(body); else fjRenderTreeList(body);
  const vc = $('#fj-view-chart'), vl = $('#fj-view-list');
  if (vc) vc.onclick = () => { S.fj.treeView = 'chart'; fjRenderTree(box); };
  if (vl) vl.onclick = () => { S.fj.treeView = 'list'; fjRenderTree(box); };
  $('#fj-tree-expand').onclick = () => { S.fj.collapsed = new Set(); fjRenderTree(box); toast('已全部展开 ✓', 'success'); };
  $('#fj-tree-collapse').onclick = () => { S.fj.collapsed = new Set(fjDirPaths(S.fj.tree, [], true)); fjRenderTree(box); toast('已全部收起（保留根目录）✓', 'success'); };
  $('#fj-tree-back').onclick = () => { S.fj.mode = 'setup'; renderFileJudgeTool(ROOT); };
  $('#fj-tree-refresh').onclick = () => {
    const path = (S.fj.tree && S.fj.tree.path) || '';
    if (!path) return;
    toast('重新扫描中…', 'info');
    apiPost('/api/plugin/filejudge/tree', { path }).then(r => {
      if (!r || !r.ok) return toast((r && r.error) || '扫描失败', 'error');
      S.fj.tree = r.root; S.fj.treeTrunc = !!r.truncated;
      fjRenderTree(ROOT);
      toast('已刷新 ✓', 'success');
    });
  };
}
function fjRenderTreeChart(body) {
  if (!body) return;
  const root = fjVisibleTree(S.fj.tree, S.fj.collapsed);
  const { list, W, H } = fjTreeLayout(root);
  const maxSize = Math.max(1, ...list.map(x => x.size));
  const showText = list.length <= 80;
  const lines = list.filter(x => x._parent).map(x => {
    const p = x._parent._xy, my = x._xy;
    const mid = (p.y + my.y) / 2;
    return `<path d="M ${p.x} ${p.y + 11} V ${mid} H ${my.x} V ${my.y - 11}" fill="none" stroke="rgba(var(--accent-rgb),.28)" stroke-width="1.1"></path>`;
  }).join('');
  const nodes = list.map(x => {
    const n = x, t = Math.sqrt(n.size / maxSize);
    const fill = fjColorT(t);
    const folded = !!n._folded;
    const tip = `${esc(n.name)} · ${fjSize(n.size)}${n.kind === 'dir' ? '（文件夹）' : ''}${folded ? `（已折叠，含 ${n._foldCount} 项）` : ''}`;
    const tg = (n.kind === 'dir' && (n.children.length || folded))
      ? `<g class="fj-toggle" data-toggle="${esc(n.path)}" style="cursor:pointer;">
          <title>${folded ? '点击展开' : '点击收起'}</title>
          <polygon points="${folded ? '-6,-15 -6,-21 2,-18' : '-6,-19 6,-19 0,-13'}" fill="#b18ea8" stroke="#fff" stroke-width="0.8"></polygon>
        </g>` : '';
    return `<g class="fj-node" data-path="${esc(n.path)}" transform="translate(${x._xy.x},${x._xy.y})" style="cursor:pointer;">
      <title>${tip}</title>
      ${fjShapeSVG(n.kind, 0, 0, fill)}
      ${tg}
      ${showText ? `<text y="${22}" text-anchor="middle" font-size="9.5" fill="#a08496">${esc(fjClip(n.name, 9))}</text>` : ''}
    </g>`;
  }).join('');
  body.innerHTML = `
    <div style="overflow:auto;max-height:72vh;">
      <svg viewBox="0 0 ${W} ${H}" class="fj-tree" style="min-width:${W}px;display:block;background:rgba(255,255,255,.30);border-radius:12px;">
        ${lines}${nodes}
      </svg>
    </div>`;
  const svg = body.querySelector('svg.fj-tree');
  if (svg) svg.onclick = e => {
    const tg = e.target.closest('.fj-toggle');
    if (tg) {
      const p = tg.dataset.toggle;
      if (S.fj.collapsed.has(p)) S.fj.collapsed.delete(p); else S.fj.collapsed.add(p);
      fjRenderTree(ROOT);
      return;
    }
    const g = e.target.closest('[data-path]');
    if (!g) return;
    fjReveal(g.dataset.path);
  };
}
function fjRenderTreeList(body) {
  if (!body) return;
  const root = fjVisibleTree(S.fj.tree, S.fj.collapsed);
  const rows = [];
  const visit = (n, depth) => { rows.push({ n, depth }); (n.children || []).forEach(c => visit(c, depth + 1)); };
  visit(root, 0);
  const maxSize = Math.max(1, ...rows.map(x => x.n.size));
  body.innerHTML = `
    <div style="overflow:auto;max-height:72vh;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.30);">
      ${rows.map(x => {
        const n = x.n, folded = !!n._folded;
        const t = Math.sqrt(n.size / maxSize);
        const isDir = n.kind === 'dir';
        const hasKids = n.children.length || folded;
        const tri = isDir && hasKids
          ? `<span class="fj-lt" data-toggle="${esc(n.path)}" style="display:inline-block;width:15px;text-align:center;color:#b18ea8;font-size:9px;cursor:pointer;">${folded ? '▶' : '▼'}</span>`
          : `<span style="display:inline-block;width:15px;"></span>`;
        return `<div class="fj-lrow" data-path="${esc(n.path)}" data-dir="${isDir}" style="display:flex;align-items:center;gap:8px;padding:5px 12px;padding-left:${12 + x.depth * 20}px;cursor:pointer;border-bottom:1px solid rgba(var(--accent-rgb),.05);">
          ${tri}
          <span style="width:18px;text-align:center;">${fjTypeEmoji(n.kind)}</span>
          <span style="flex:1;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(n.path)}">${esc(n.name)}${folded ? `<span class="fin-note" style="font-size:11px;"> · 含 ${n._foldCount} 项</span>` : ''}</span>
          <span style="width:18px;height:11px;border-radius:3px;background:${fjColorT(t)};flex:none;" title="占用大小"></span>
          <span style="width:76px;text-align:right;font-size:12px;color:var(--text-dim);flex:none;">${fjSize(n.size)}</span>
        </div>`;
      }).join('')}
    </div>`;
  body.onclick = e => {
    const tg = e.target.closest('[data-toggle]');
    if (tg && tg.dataset.toggle) {
      const p = tg.dataset.toggle;
      if (S.fj.collapsed.has(p)) S.fj.collapsed.delete(p); else S.fj.collapsed.add(p);
      fjRenderTree(ROOT);
      return;
    }
    const row = e.target.closest('.fj-lrow');
    if (!row) return;
    if (row.dataset.dir === 'true') {
      const p = row.dataset.path;
      if (S.fj.collapsed.has(p)) S.fj.collapsed.delete(p); else S.fj.collapsed.add(p);
      fjRenderTree(ROOT);
      return;
    }
    fjReveal(row.dataset.path);
  };
}
function fjCurrent() { return S.fj.files[S.fj.idx]; }
function fjRenderJudge(box) {
  const d = S.fj;
  const cur = fjCurrent();
  const markedDel = d.del.includes(cur.path);
  const markedKeep = d.keep.includes(cur.path);
  box.innerHTML = `
    <div class="gcard">
      <div class="section-title"><span class="st-emoji">⚖️</span>文件判官
        <span style="font-size:12px;color:var(--text-dim);font-weight:400;">第 ${d.idx + 1} / ${d.files.length} 个 · 🗑 标记删除 ${d.del.length}（${fjKB(d.delKb || 0)}） · ✅ 已保留 ${d.keep.length}</span></div>
      <div class="fj-current">
        <div class="fj-info">
          <span class="fj-name">${esc(cur.name)}</span>
          <span class="fj-meta">${cur.kind_label} · ${fjKB(cur.kb)}${markedDel ? ' · <b style="color:#e5484d">已标记删除</b>' : markedKeep ? ' · <b style="color:#30a46e">已保留</b>' : ''}</span>
        </div>
        <div class="fj-preview" id="fj-preview"><div class="empty" style="padding:26px;"><span class="e-icon">⏳</span>正在加载预览…</div></div>
      </div>
      <div class="fj-ctl">
        <button class="btn soft sm" id="fj-prev" ${d.idx === 0 ? 'disabled' : ''}>⏮ 上一张</button>
        <button class="btn soft sm" id="fj-skip">⏭ 跳过</button>
        <button class="btn sm" id="fj-keep">✅ 保留</button>
        <button class="btn sm fj-danger" id="fj-del">🗑 删除</button>
        <button class="btn soft sm" id="fj-grid">🧩 缩略图模式</button>
        <button class="btn sm" id="fj-exit" style="margin-left:auto;">🚪 退出判官</button>
      </div>
    </div>`;
  fjLoadPreview(cur, d);
  $('#fj-prev').onclick = () => { if (d.idx > 0) { d.idx--; fjRenderJudge(ROOT); } };
  $('#fj-skip').onclick = () => fjAdvance(d, null);
  $('#fj-keep').onclick = () => fjAdvance(d, 'keep');
  $('#fj-del').onclick = () => fjAdvance(d, 'del');
  $('#fj-grid').onclick = () => { S.fj.view = 'grid'; fjRenderGrid(ROOT); };
  $('#fj-exit').onclick = () => fjExit(d);
}
function fjAdvance(d, mark) {
  const cur = fjCurrent();
  if (mark === 'keep') {
    if (!d.keep.includes(cur.path)) d.keep.push(cur.path);
    if (d.del.includes(cur.path)) { d.del = d.del.filter(x => x !== cur.path); d.delKb -= cur.kb; }
    apiPost('/api/plugin/filejudge/keep', { path: cur.path }).then(r => {
      if (!r || !r.ok) toast('保留记录保存失败：后续扫描不会略过该文件', 'warn');
    });
  } else if (mark === 'del') {
    if (!d.del.includes(cur.path)) { d.del.push(cur.path); d.delKb += cur.kb; }
    d.keep = d.keep.filter(x => x !== cur.path);
  }
  if (d.idx + 1 >= d.files.length) { fjFinish(d); return; }
  d.idx++;
  fjRenderJudge(ROOT);
}
function fjReset() { S.fj = { mode: 'setup', files: [], idx: 0, del: [], keep: [], delKb: 0 }; renderFileJudgeTool(ROOT); }
function fjFinish(d) {
  if (!d.del.length) { toast('全部审判完毕，未标记删除', 'success'); fjReset(); return; }
  const names = d.del.slice(0, 6).map(fjBase).join('、') + (d.del.length > 6 ? ' 等' : '');
  if (confirm(`已审判完最后一个文件。\n\n共标记删除 ${d.del.length} 个文件（${fjKB(d.delKb || 0)}）：\n${names}\n\n是否立即删除？\n确定 = 删除 / 取消 = 丢弃标记`)) fjDoDelete(d.del, fjReset);
  else { toast('已放弃删除标记', 'info'); fjReset(); }
}
function fjExit(d) {
  if (!d.del.length) { fjReset(); return; }
  const names = d.del.slice(0, 6).map(fjBase).join('、') + (d.del.length > 6 ? ' 等' : '');
  if (confirm(`已标记删除 ${d.del.length} 个文件（${fjKB(d.delKb || 0)}）：\n${names}\n\n是否处理（立即删除）？\n确定 = 删除 / 取消 = 仅退出（丢弃标记）`)) fjDoDelete(d.del, fjReset);
  else { toast('已退出，标记未处理', 'info'); fjReset(); }
}
function fjDoDelete(paths, after) {
  toast(`正在删除 ${paths.length} 个文件…`, 'info');
  apiPost('/api/plugin/filejudge/delete', { paths }).then(r => {
    if (r && r.ok) {
      toast(`已删除 ${r.count} 个文件 ✓` + (r.errors && r.errors.length ? `（${r.errors.length} 个失败）` : ''), r.errors && r.errors.length ? 'warn' : 'success');
    } else toast((r && r.error) || '删除失败', 'error');
    if (after) after();
  });
}
function fjLoadPreview(cur, d) {
  const pv = $('#fj-preview');
  apiPost('/api/plugin/filejudge/preview', { path: cur.path }).then(r => {
    if (!pv) return;
    if (!r || !r.ok) { pv.innerHTML = `<div class="empty" style="padding:24px;"><span class="e-icon">⚠️</span>${esc((r && r.error) || '预览失败')}</div>`; return; }
    if (r.kind === 'image') pv.innerHTML = `<img src="${r.data}" class="fj-img" alt="">`;
    else pv.innerHTML = `
      <div class="fj-textcard">
        <div class="fj-text-title">${esc(r.title || cur.name)} · ${fjKB(cur.kb)}</div>
        <pre class="fj-text">${esc(r.text || '（无内容）')}</pre>
      </div>`;
  });
}


/* ============================================================
   文件判官 · 缩略图网格模式（拖拽框选 · 批量删除 · 每排 N 可调）
   ============================================================ */
function fjGridCell(f) {
  const isImg = f.kind === 'img';
  return `
    <div class="fj-cell" data-path="${esc(f.path)}">
      <div class="fj-cell-thumb" data-path="${esc(f.path)}">
        ${isImg ? '<div class="fj-thumb-ph"><span class="e-icon">🖼️</span></div>'
                : `<div class="fj-thumb-ic">${f.kind === 'pdf' ? '📄' : f.kind === 'doc' ? '📃' : '📝'}</div>`}
      </div>
      <div class="fj-cell-name" title="${esc(f.name)}">${esc(f.name)}</div>
      <div class="fj-cell-size">${f.kind_label} · ${fjKB(f.kb)}</div>
    </div>`;
}
function fjRenderGrid(box) {
  const d = S.fj;
  const cols = d.cols || 6;
  if (!d.sel) d.sel = new Set();
  d.thumbsLoaded = d.thumbsLoaded || 0;
  box.innerHTML = `
    <div class="gcard">
      <div class="section-title"><span class="st-emoji">🧩</span>缩略图判官
        <span style="font-size:12px;color:var(--text-dim);font-weight:400;">共 ${d.files.length} 个 · 已选 ${d.sel.size}</span></div>
      <div class="fj-grid-bar">
        <span style="font-size:13px;color:var(--text-dim);">每排</span>
        <select class="input" id="fj-cols" style="width:74px;">${[2, 3, 4, 5, 6, 8, 10, 12].map(v => `<option value="${v}" ${v === cols ? 'selected' : ''}>每排 ${v} 个</option>`).join('')}</select>
        <span style="font-size:12px;color:var(--text-dim);">拖拽框选 · 点击切换 · Ctrl+拖拽 减选</span>
        <button class="btn sm fj-danger" id="fj-del-sel" ${d.sel.size ? '' : 'disabled'}>🗑 删除选中（${d.sel.size}）</button>
        <button class="btn soft sm" id="fj-grid-back" style="margin-left:auto;">← 返回逐张审判</button>
      </div>
      <div class="fj-grid" id="fj-grid" style="grid-template-columns:repeat(${cols}, minmax(0, 1fr));">
        ${d.files.map(f => fjGridCell(f)).join('')}
      </div>
      <div class="fj-grid-sentinel" id="fj-grid-more"></div>
    </div>`;
  $('#fj-cols').onchange = e => { d.cols = +e.target.value; fjRenderGrid(box); };
  $('#fj-del-sel').onclick = () => fjGridDeleteSel(box);
  $('#fj-grid-back').onclick = () => { S.fj.view = 'card'; fjRenderJudge(ROOT); };
  const g = $('#fj-grid');
  g.onclick = e => {
    const cell = e.target.closest('.fj-cell');
    if (!cell) return;
    const path = cell.dataset.path;
    if (d.sel.has(path)) { d.sel.delete(path); cell.classList.remove('selected'); }
    else { d.sel.add(path); cell.classList.add('selected'); }
    fjGridUpdateBar(d);
  };
  fjGridMarquee(g, d);
  fjGridLoadMore(d);
}
function fjGridUpdateBar(d) {
  const b = $('#fj-del-sel'); if (!b) return;
  const n = d.sel ? d.sel.size : 0;
  b.disabled = !n;
  b.textContent = `🗑 删除选中（${n}）`;
  const t = ROOT.querySelector('.section-title span[style*="font-size:12px"]');
  if (t) t.textContent = `共 ${d.files.length} 个 · 已选 ${n}`;
}
function fjGridLoadMore(d) {
  const imgs = d.files.filter(f => f.kind === 'img');
  const batch = imgs.slice(d.thumbsLoaded, d.thumbsLoaded + 250);
  const sent = $('#fj-grid-more');
  if (!batch.length) { if (sent) sent.textContent = '✅ 已全部加载'; return; }
  apiPost('/api/plugin/filejudge/thumbs', { paths: batch.map(f => f.path) }).then(r => {
    if (r && r.ok) r.thumbs.forEach(t => {
      const el = document.querySelector(`.fj-cell-thumb[data-path="${CSS.escape(t.path)}"]`);
      if (!el) return;
      if (t.data) el.innerHTML = `<img src="${t.data}" alt="" loading="lazy">`;
      else if (t.err) el.innerHTML = `<div class="fj-thumb-ic" title="${esc(t.err)}">⚠️</div>`;
      else el.innerHTML = '<div class="fj-thumb-ic">🖼️</div>';
    });
    d.thumbsLoaded += batch.length;
    if (d.thumbsLoaded < imgs.length) {
      const io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) { io.disconnect(); fjGridLoadMore(d); }
      }, { rootMargin: '500px' });
      const sent2 = $('#fj-grid-more');
      if (sent2) io.observe(sent2);
    } else if (sent) sent.textContent = '✅ 已全部加载';
  });
}
function fjGridMarquee(g, d) {
  let down = null, boxEl = null;
  g.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (e.target.closest('.fj-cell')) return;   // 单击由 onclick 处理
    down = { x: e.clientX, y: e.clientY };
    boxEl = document.createElement('div');
    boxEl.className = 'fj-marquee';
    g.appendChild(boxEl);
    e.preventDefault();
  });
  g.addEventListener('mousemove', e => {
    if (!down || !boxEl) return;
    const x1 = Math.min(down.x, e.clientX), y1 = Math.min(down.y, e.clientY);
    const x2 = Math.max(down.x, e.clientX), y2 = Math.max(down.y, e.clientY);
    Object.assign(boxEl.style, { left: x1 + 'px', top: y1 + 'px', width: (x2 - x1) + 'px', height: (y2 - y1) + 'px' });
    const mr = { left: x1, top: y1, right: x2, bottom: y2 };
    const addMode = !e.ctrlKey;
    g.querySelectorAll('.fj-cell').forEach(cell => {
      const r = cell.getBoundingClientRect();
      const hit = !(r.right < mr.left || r.left > mr.right || r.bottom < mr.top || r.top > mr.bottom);
      const p = cell.dataset.path;
      if (hit) {
        if (addMode) { if (!d.sel.has(p)) { d.sel.add(p); cell.classList.add('selected'); } }
        else if (d.sel.has(p)) { d.sel.delete(p); cell.classList.remove('selected'); }
      }
    });
    fjGridUpdateBar(d);
  });
  const up = () => {
    if (boxEl) { boxEl.remove(); boxEl = null; }
    down = null;
  };
  g.addEventListener('mouseup', up);
  g.addEventListener('mouseleave', up);
}
function fjGridDeleteSel(box) {
  const d = S.fj;
  if (!d.sel || !d.sel.size) return;
  const paths = [...d.sel];
  const selFiles = d.files.filter(f => paths.includes(f.path));
  const kb = selFiles.reduce((a, f) => a + f.kb, 0);
  if (!confirm(`确定删除选中的 ${paths.length} 个文件（${fjKB(kb)}）？\n此操作不可撤销。`)) return;
  fjDoDelete(paths, () => {
    const delSet = new Set(paths);
    d.files = d.files.filter(f => !delSet.has(f.path));
    d.del = []; d.keep = []; d.delKb = 0;
    d.sel = new Set(); d.thumbsLoaded = 0;
    if (!d.files.length) { toast('已全部删除', 'success'); fjReset(); return; }
    d.idx = Math.min(d.idx, d.files.length - 1);
    fjRenderGrid(ROOT);
  });
}



window.__toolRenderers.filejudge = renderFileJudgeTool;
})();

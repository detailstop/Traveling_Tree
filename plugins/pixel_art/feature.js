'use strict';
/* 像素画与插件绘制：单帧单图层像素编辑器 + 作品库 + 通篇视图资产引用。
   数据存 SQLite（pixel_artworks / pixel_asset_refs），不调用任何 AI。 */
(function () {
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));
  const DEFAULT_PALETTE = [
    '#241c22', '#6b5b63', '#b4576f', '#e0587a', '#ffb3c6', '#ffd166',
    '#f4a261', '#2e9e6b', '#7ccb9a', '#3f63b0', '#85b7eb', '#7a4fb5',
    '#c7a3e8', '#fffdf9', '#d9d2e3', '#8a7a82',
  ];
  const REF_META = [
    { key: 'bookmark', label: '通篇视图 · 阅读书签' },
    { key: 'icon.edit', label: '通篇视图 · 编辑图标' },
    { key: 'icon.copy_ru', label: '通篇视图 · 复制俄语图标' },
    { key: 'icon.copy_zh', label: '通篇视图 · 复制翻译图标' },
    { key: 'icon.delete', label: '通篇视图 · 删除图标' },
    { key: 'icon.settings', label: '通篇视图 · 显示设置图标' },
  ];
  const AI_SPEC = `{
  "schema_version": "1.0",
  "type": "ai-pixel-art",
  "name": "作品名",
  "width": 16,
  "height": 16,
  "palette": ["#241c22", "#b4576f", "#ffd166"],
  "instructions": [
    {"op": "fill", "color": "#fffdf9"},
    {"op": "rect", "x": 4, "y": 4, "w": 8, "h": 8, "color": "#b4576f"},
    {"op": "line", "x1": 2, "y1": 2, "x2": 13, "y2": 13, "color": "#241c22"},
    {"op": "point", "x": 8, "y": 8, "color": "#ffd166"}
  ]
}`;
  const PX = {
    root: null, works: [], current: null, name: '未命名作品', width: 16, height: 16,
    palette: DEFAULT_PALETTE.slice(), pixels: [], tool: 'pencil', color: 0,
    history: [], redo: [], drawing: false, last: null, refs: {}, assets: {},
    loaded: false, status: '',
  };

  async function api(path, method = 'GET', body) {
    const res = await fetch(path, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + res.status));
    return data;
  }
  const clone = v => JSON.parse(JSON.stringify(v));
  const clampInt = (v, low, high, fallback) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? Math.max(low, Math.min(high, n)) : fallback;
  };
  const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v || 0)).toString(16).padStart(2, '0')).join('');
  function parseHex(value) {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(value || '').trim());
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
  }
  function blankPixels(w, h) { return new Array(w * h).fill(-1); }
  function ensureState() {
    PX.width = clampInt(PX.width, 1, 128, 16);
    PX.height = clampInt(PX.height, 1, 128, 16);
    if (!Array.isArray(PX.palette)) PX.palette = DEFAULT_PALETTE.slice();
    PX.palette = PX.palette.map(v => parseHex(v) ? String(v).toLowerCase() : null).filter(Boolean).slice(0, 64);
    if (!Array.isArray(PX.pixels) || PX.pixels.length !== PX.width * PX.height) {
      PX.pixels = blankPixels(PX.width, PX.height);
    }
    PX.pixels = PX.pixels.map(v => Number.isInteger(v) && v >= -1 && v < PX.palette.length ? v : -1);
    if (!Number.isInteger(PX.color) || PX.color < 0 || PX.color >= PX.palette.length) PX.color = 0;
  }
  function snapshot() {
    return { name: PX.name, width: PX.width, height: PX.height, palette: PX.palette.slice(), pixels: PX.pixels.slice() };
  }
  function pushHistory() {
    PX.history.push(snapshot());
    if (PX.history.length > 60) PX.history.shift();
    PX.redo = [];
  }
  function restore(s) {
    PX.name = s.name; PX.width = s.width; PX.height = s.height;
    PX.palette = s.palette.slice(); PX.pixels = s.pixels.slice();
    ensureState();
  }
  function artUrl(work) {
    if (!work || !Array.isArray(work.palette) || !Array.isArray(work.pixels)) return '';
    const canvas = document.createElement('canvas');
    canvas.width = clampInt(work.width, 1, 128, 1);
    canvas.height = clampInt(work.height, 1, 128, 1);
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(canvas.width, canvas.height);
    const colors = work.palette.map(parseHex);
    work.pixels.forEach((index, i) => {
      const c = colors[index];
      if (!c) return;
      img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
    });
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL('image/png');
  }
  function downloadText(name, text, mime) {
    window.rtDownloadBlob(new Blob([text], { type: mime || 'application/json;charset=utf-8' }), name);
  }
  function downloadBlob(name, blob) {
    window.rtDownloadBlob(blob, name);
  }
  function safeName() { return String(PX.name || '像素画').replace(/[\\/:*?"<>|\r\n]+/g, '_').trim() || '像素画'; }
  function pixelAt(x, y) { return PX.pixels[y * PX.width + x]; }
  function setPixel(x, y, value) {
    if (x < 0 || y < 0 || x >= PX.width || y >= PX.height) return;
    PX.pixels[y * PX.width + x] = value;
  }
  function line(a, b, paint) {
    let x0 = a.x, y0 = a.y; const x1 = b.x, y1 = b.y;
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      paint(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function floodFill(x, y, color) {
    const target = pixelAt(x, y);
    if (target === color) return;
    const queue = [[x, y]];
    const seen = new Set();
    while (queue.length) {
      const [cx, cy] = queue.pop();
      if (cx < 0 || cy < 0 || cx >= PX.width || cy >= PX.height) continue;
      const key = cy * PX.width + cx;
      if (seen.has(key)) continue;
      seen.add(key);
      if (PX.pixels[key] !== target) continue;
      PX.pixels[key] = color;
      queue.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }
  function applyTool(point, fresh) {
    if (PX.tool === 'picker') {
      const value = pixelAt(point.x, point.y);
      if (value >= 0) { PX.color = value; PX.tool = 'pencil'; toast('已取色', 'info', 1200); }
      return;
    }
    if (PX.tool === 'fill') {
      floodFill(point.x, point.y, PX.color);
      return;
    }
    const value = PX.tool === 'eraser' ? -1 : PX.color;
    if (fresh && PX.last) line(PX.last, point, (x, y) => setPixel(x, y, value));
    else setPixel(point.x, point.y, value);
  }
  function drawCanvas() {
    ensureState();
    const canvas = $('#pa-canvas');
    if (!canvas) return;
    canvas.width = PX.width;
    canvas.height = PX.height;
    const scale = Math.max(4, Math.min(24, Math.floor(520 / Math.max(PX.width, PX.height))));
    canvas.style.width = (PX.width * scale) + 'px';
    canvas.style.height = (PX.height * scale) + 'px';
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(PX.width, PX.height);
    const colors = PX.palette.map(parseHex);
    PX.pixels.forEach((index, i) => {
      const c = colors[index];
      if (!c) return;
      img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255;
    });
    ctx.putImageData(img, 0, 0);
    const wrap = $('.pa-canvas-wrap');
    if (wrap) {
      wrap.style.setProperty('--pa-w', PX.width);
      wrap.style.setProperty('--pa-h', PX.height);
      wrap.classList.toggle('pa-no-grid', scale < 7);
    }
    const grid = $('.pa-grid');
    if (grid) grid.style.backgroundSize = (100 / PX.width) + '% ' + (100 / PX.height) + '%';
  }
  function canvasPoint(event) {
    const canvas = $('#pa-canvas');
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - r.left) / (r.width / PX.width));
    const y = Math.floor((event.clientY - r.top) / (r.height / PX.height));
    if (x < 0 || y < 0 || x >= PX.width || y >= PX.height) return null;
    return { x, y };
  }

  function toolButton(id, label, icon) {
    return `<button class="btn soft sm pa-tool ${PX.tool === id ? 'on' : ''}" data-pa-tool="${id}" title="${label}">${icon}<span>${label}</span></button>`;
  }
  function renderSide() {
    return `<div class="gcard pa-side">
      <div class="section-title"><span class="st-emoji">🧰</span>工具</div>
      <div class="pa-tools">
        ${toolButton('pencil', '铅笔', '✏️')}
        ${toolButton('eraser', '橡皮擦', '🧽')}
        ${toolButton('picker', '取色', '💧')}
        ${toolButton('fill', '填充', '🪣')}
      </div>
      <div class="pa-size">
        <label>宽 <input class="input" id="pa-width" type="number" min="1" max="128" value="${PX.width}"></label>
        <label>高 <input class="input" id="pa-height" type="number" min="1" max="128" value="${PX.height}"></label>
        <button class="btn soft sm" id="pa-resize">应用尺寸</button>
      </div>
      <div class="pa-history">
        <button class="btn soft sm" id="pa-undo">↶ 撤销</button>
        <button class="btn soft sm" id="pa-redo">↷ 重做</button>
        <button class="btn danger sm" id="pa-clear">清空画布</button>
      </div>
      <div class="pa-palette-head"><b>调色板</b><span>${PX.palette.length} 色</span></div>
      <div class="pa-palette">
        ${PX.palette.map((color, i) => `<button class="pa-swatch ${PX.color === i ? 'on' : ''}" style="background:${esc(color)}" data-pa-color="${i}" title="${esc(color)}"></button>`).join('') || '<span class="pa-muted">暂无颜色</span>'}
      </div>
      <div class="pa-color-add">
        <input type="color" id="pa-new-color" value="#ffffff" aria-label="选择新颜色">
        <button class="btn soft sm" id="pa-add-color">＋ 加入调色板</button>
      </div>
      <p class="pa-muted">铅笔按住拖动可连续绘制；填充为四向连通；取色后自动切回铅笔。</p>
    </div>`;
  }
  function renderCanvas() {
    const status = PX.current ? `已保存 · ${esc(PX.current.name)}` : '未保存的新作品';
    return `<div class="gcard pa-canvas-card">
      <div class="pa-canvas-head">
        <label>作品名<input class="input" id="pa-name" maxlength="80" value="${esc(PX.name)}" placeholder="作品名"></label>
        <span class="pa-status">${status}</span>
      </div>
      <div class="pa-canvas-wrap" style="--pa-w:${PX.width};--pa-h:${PX.height};">
        <div class="pa-canvas-stage">
          <canvas id="pa-canvas" aria-label="像素画布"></canvas>
          <div class="pa-grid" aria-hidden="true"></div>
        </div>
      </div>
      <div class="pa-canvas-foot">
        <span>${PX.width} × ${PX.height} · 单帧 · 单图层</span>
        <span>当前颜色 <i class="pa-current-color" style="background:${esc(PX.palette[PX.color] || '#000')}"></i></span>
      </div>
    </div>`;
  }
  function renderLibrary() {
    return `<div class="gcard pa-panel">
      <div class="section-title"><span class="st-emoji">🗃️</span>作品库<span class="pa-count">${PX.works.length}</span></div>
      <div class="pa-works">
        ${PX.works.map(w => `<div class="pa-work ${PX.current && PX.current.artwork_id === w.artwork_id ? 'on' : ''}" data-pa-work="${esc(w.artwork_id)}">
          <img class="pa-thumb" src="${artUrl(w)}" alt="">
          <div class="pa-work-main"><b>${esc(w.name)}</b><span>${w.width}×${w.height} · ${esc(String(w.updated_at || '').slice(0, 16).replace('T', ' '))}</span></div>
          <button class="mini-btn danger" data-pa-del="${esc(w.artwork_id)}" title="删除作品">🗑</button>
        </div>`).join('') || '<div class="pa-empty">还没有作品，画点东西并保存吧。</div>'}
      </div>
    </div>`;
  }
  function renderAssets() {
    const options = key => `<option value="">默认图形</option>${PX.works.map(w => `<option value="${esc(w.artwork_id)}" ${PX.refs[key] === w.artwork_id ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}`;
    return `<div class="gcard pa-panel">
      <div class="section-title"><span class="st-emoji">🔖</span>资产通道</div>
      <p class="pa-muted">书签与通篇视图图标按作品 id 引用；作品修改后刷新阅读页即可更新。删除被引用作品会回退默认图形。</p>
      <div class="pa-refs">
        ${REF_META.map(meta => {
          const art = PX.assets[meta.key];
          return `<label class="pa-ref"><span>${esc(meta.label)}</span>
            <select class="input" data-pa-ref="${meta.key}">${options(meta.key)}</select>
            ${art ? `<img class="pa-ref-thumb" src="${artUrl(art)}" alt="">` : '<span class="pa-ref-default">默认</span>'}
          </label>`;
        }).join('')}
      </div>
    </div>`;
  }
  function renderIO() {
    return `<div class="gcard pa-panel">
      <div class="section-title"><span class="st-emoji">📦</span>导入 / 导出</div>
      <div class="pa-io-row">
        <input type="file" id="pa-file" accept=".json,.piskel,.png,application/json,image/png">
        <button class="btn soft sm" id="pa-export-json">导出 JSON</button>
        <button class="btn soft sm" id="pa-export-ai">导出 AI JSON</button>
        <button class="btn soft sm" id="pa-export-png">导出 PNG</button>
        <button class="btn soft sm" id="pa-export-piskel">导出 .piskel</button>
      </div>
      <textarea class="input pa-import-text" id="pa-import-text" rows="4" placeholder="粘贴自定义 JSON / AI JSON / .piskel 内容"></textarea>
      <div class="pa-io-row"><button class="btn sm" id="pa-import-paste">导入粘贴内容</button><span class="pa-muted">PNG 导入会按最近邻缩放并量化调色板。</span></div>
      <details class="pa-ai-spec" open>
        <summary>AI JSON 格式（复制给 AI 生成作品）<button class="btn soft sm" id="pa-copy-ai">复制格式</button></summary>
        <pre id="pa-ai-spec">${esc(AI_SPEC)}</pre>
        <p class="pa-muted">支持 fill / rect / line / point / clear 指令，按顺序执行；同时提供 pixels 时以 pixels 为准。单帧单图层，尺寸 1–128。</p>
      </details>
      <p class="pa-muted">不做 GIF、多帧、多图层；所有数据只保存在本机 SQLite。</p>
    </div>`;
  }
  function render() {
    if (!PX.root) return;
    ensureState();
    PX.root.innerHTML = `
      <div class="gcard pa-head">
        <div class="section-title"><span class="st-emoji">🎨</span>像素画与插件绘制
          <span class="pa-sub">为项目内其他功能绘制书签 / 图标等视觉资产（不是插件系统）</span>
          <span class="pa-head-actions">
            <button class="btn soft sm" id="pa-new">＋ 新建</button>
            <button class="btn sm" id="pa-save">💾 保存作品</button>
            <button class="btn danger sm" id="pa-delete" ${PX.current ? '' : 'disabled'}>删除当前</button>
          </span>
        </div>
        <div class="pa-hint">单帧单图层 · 作品库从 SQLite 读取 · 资产引用只影响通篇视图书签与图标</div>
      </div>
      <div class="pa-layout">
        ${renderSide()}
        ${renderCanvas()}
        <div class="pa-right">${renderLibrary()}${renderAssets()}${renderIO()}</div>
      </div>`;
    bind();
    drawCanvas();
  }

  function bind() {
    const name = $('#pa-name');
    if (name) name.oninput = () => { PX.name = name.value; };
    $('#pa-new').onclick = () => {
      PX.current = null; PX.name = '新作品'; PX.width = 16; PX.height = 16;
      PX.palette = DEFAULT_PALETTE.slice(); PX.pixels = blankPixels(16, 16);
      PX.history = []; PX.redo = []; PX.color = 0; PX.tool = 'pencil';
      render(); toast('已新建空白画布', 'info');
    };
    $('#pa-save').onclick = () => saveWork().catch(e => toast('保存失败：' + e.message, 'error'));
    $('#pa-delete').onclick = () => { if (PX.current) deleteWork(PX.current.artwork_id).catch(e => toast('删除失败：' + e.message, 'error')); };
    $$('[data-pa-tool]').forEach(btn => btn.onclick = () => { PX.tool = btn.dataset.paTool; render(); });
    $$('[data-pa-color]').forEach(btn => btn.onclick = () => { PX.color = Number(btn.dataset.paColor); render(); });
    $('#pa-add-color').onclick = () => {
      const value = String($('#pa-new-color').value || '').toLowerCase();
      if (!parseHex(value)) return toast('颜色格式无效', 'warn');
      if (PX.palette.includes(value)) return toast('调色板已有该颜色', 'info');
      if (PX.palette.length >= 64) return toast('调色板最多 64 色', 'warn');
      pushHistory();
      PX.palette.push(value);
      PX.color = PX.palette.length - 1;
      render();
    };
    $('#pa-undo').onclick = () => {
      if (!PX.history.length) return;
      PX.redo.push(snapshot()); restore(PX.history.pop()); render();
    };
    $('#pa-redo').onclick = () => {
      if (!PX.redo.length) return;
      PX.history.push(snapshot()); restore(PX.redo.pop()); render();
    };
    $('#pa-clear').onclick = () => {
      if (!confirm('清空当前画布？可用撤销恢复。')) return;
      pushHistory(); PX.pixels = blankPixels(PX.width, PX.height); render();
    };
    $('#pa-resize').onclick = () => {
      const w = clampInt($('#pa-width').value, 1, 128, PX.width);
      const h = clampInt($('#pa-height').value, 1, 128, PX.height);
      if (w === PX.width && h === PX.height) return;
      pushHistory();
      const next = blankPixels(w, h);
      for (let y = 0; y < Math.min(h, PX.height); y += 1) {
        for (let x = 0; x < Math.min(w, PX.width); x += 1) next[y * w + x] = PX.pixels[y * PX.width + x];
      }
      PX.width = w; PX.height = h; PX.pixels = next; render();
    };
    const canvas = $('#pa-canvas');
    canvas.addEventListener('pointerdown', e => {
      if (e.button && e.button !== 0) return;
      const point = canvasPoint(e);
      if (!point) return;
      e.preventDefault();
      pushHistory();
      PX.drawing = true;
      PX.last = point;
      applyTool(point, false);
      drawCanvas();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      if (PX.tool === 'fill' || PX.tool === 'picker') PX.drawing = false;
    });
    canvas.addEventListener('pointermove', e => {
      if (!PX.drawing) return;
      const point = canvasPoint(e);
      if (!point) return;
      if (PX.tool === 'pencil' || PX.tool === 'eraser') {
        applyTool(point, true);
        PX.last = point;
        drawCanvas();
      }
    });
    const end = () => { PX.drawing = false; PX.last = null; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', () => { if (PX.drawing) end(); });
    $$('[data-pa-work]').forEach(card => {
      card.onclick = e => {
        if (e.target.closest('[data-pa-del]')) return;
        const work = PX.works.find(w => w.artwork_id === card.dataset.paWork);
        if (!work) return;
        loadWork(work);
      };
    });
    $$('[data-pa-del]').forEach(btn => btn.onclick = async e => {
      e.stopPropagation();
      await deleteWork(btn.dataset.paDel).catch(ex => toast('删除失败：' + ex.message, 'error'));
    });
    $$('[data-pa-ref]').forEach(sel => sel.onchange = async () => {
      try {
        const data = await api('/api/plugin/pixel_art/refs/' + encodeURIComponent(sel.dataset.paRef), 'PUT', { artwork_id: sel.value });
        PX.refs = data.refs || {}; PX.assets = data.assets || {};
        render();
        toast('资产引用已更新', 'success');
      } catch (e) { toast('引用更新失败：' + e.message, 'error'); }
    });
    $('#pa-file').onchange = async e => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        if (/\.png$/i.test(file.name)) await importPngFile(file);
        else await importJsonText(await file.text());
      } catch (ex) { toast('导入失败：' + ex.message, 'error'); }
    };
    $('#pa-export-json').onclick = exportJSON;
    $('#pa-export-ai').onclick = exportAIJSON;
    $('#pa-export-png').onclick = exportPNG;
    $('#pa-export-piskel').onclick = exportPiskel;
    $('#pa-copy-ai').onclick = async () => {
      try { await navigator.clipboard.writeText(AI_SPEC); toast('AI JSON 格式已复制', 'success'); }
      catch (_) { toast('复制失败，请手动选择文本', 'warn'); }
    };
    $('#pa-import-paste').onclick = async () => {
      try { await importJsonText($('#pa-import-text').value); } catch (e) { toast('导入失败：' + e.message, 'error'); }
    };
  }

  async function loadWorks() {
    const data = await api('/api/plugin/pixel_art/works');
    PX.works = data.works || [];
  }
  async function loadAssets() {
    const data = await api('/api/plugin/pixel_art/refs');
    PX.refs = data.refs || {};
    PX.assets = data.assets || {};
  }
  function loadWork(work) {
    PX.current = work;
    PX.name = work.name;
    PX.width = work.width; PX.height = work.height;
    PX.palette = (work.palette || []).slice();
    PX.pixels = (work.pixels || []).slice();
    PX.history = []; PX.redo = []; PX.tool = 'pencil';
    ensureState();
    render();
  }
  async function saveWork() {
    ensureState();
    const name = String($('#pa-name')?.value || PX.name || '').trim();
    if (!name) throw new Error('请填写作品名');
    PX.name = name;
    const payload = { name, width: PX.width, height: PX.height, palette: PX.palette, pixels: PX.pixels };
    const data = PX.current
      ? await api('/api/plugin/pixel_art/works/' + encodeURIComponent(PX.current.artwork_id), 'PUT', payload)
      : await api('/api/plugin/pixel_art/works', 'POST', payload);
    PX.current = data.work;
    await loadWorks(); await loadAssets();
    render();
    toast(PX.current ? '作品已保存 ✓' : '作品已创建 ✓', 'success');
  }
  async function deleteWork(id) {
    if (!confirm('删除这个像素画作品？被引用的书签/图标会回退默认图形。')) return;
    const work = PX.works.find(w => w.artwork_id === id);
    const data = await api('/api/plugin/pixel_art/works/' + encodeURIComponent(id), 'DELETE');
    if (PX.current && PX.current.artwork_id === id) {
      PX.current = null; PX.name = '新作品'; PX.width = 16; PX.height = 16;
      PX.palette = DEFAULT_PALETTE.slice(); PX.pixels = blankPixels(16, 16);
      PX.history = []; PX.redo = [];
    }
    await loadWorks(); await loadAssets();
    render();
    const cleared = data.cleared_refs || [];
    const labels = cleared.map(k => (REF_META.find(x => x.key === k) || {}).label || k);
    toast('已删除' + (work ? '「' + work.name + '」' : '作品') + (labels.length ? '；已回退默认：' + labels.join('、') : ''), cleared.length ? 'warn' : 'success', 5000);
  }
  function currentData() {
    return { schema_version: '1.0', name: PX.name, width: PX.width, height: PX.height, palette: PX.palette.slice(), pixels: PX.pixels.slice() };
  }
  function exportJSON() {
    downloadText(safeName() + '.json', JSON.stringify({ ...currentData(), type: 'pixel-art', instructions: [] }, null, 2));
    toast('已导出 JSON', 'success');
  }
  function exportAIJSON() {
    downloadText(safeName() + '-AI.json', JSON.stringify({ ...currentData(), type: 'ai-pixel-art', instructions: [] }, null, 2));
    toast('已导出 AI JSON', 'success');
  }
  function exportPNG() {
    const canvas = $('#pa-canvas');
    if (!canvas) return;
    canvas.toBlob(blob => {
      if (!blob) return toast('PNG 生成失败', 'error');
      downloadBlob(safeName() + '.png', blob);
      toast('已导出 PNG', 'success');
    }, 'image/png');
  }
  function exportPiskel() {
    const canvas = $('#pa-canvas');
    if (!canvas) return;
    const frame = canvas.toDataURL('image/png');
    const data = {
      modelVersion: 2,
      piskel: {
        name: PX.name, description: '', fps: 12, height: PX.height, width: PX.width,
        layers: [{ name: 'Layer 1', opacity: 1, frameCount: 1, frames: [frame] }],
      },
    };
    downloadText(safeName() + '.piskel', JSON.stringify(data, null, 2));
    toast('已导出 .piskel', 'success');
  }

  function normalizeImportedPalette(list) {
    return (Array.isArray(list) ? list : []).map(v => parseHex(v) ? String(v).toLowerCase() : null).filter(Boolean).slice(0, 64);
  }
  function applyInstructions(width, height, palette, instructions) {
    const pixels = blankPixels(width, height);
    const colors = normalizeImportedPalette(palette);
    const indexOf = value => {
      const color = parseHex(value);
      if (!color) throw new Error('指令颜色无效：' + value);
      const hexValue = hex(color[0], color[1], color[2]);
      let index = colors.indexOf(hexValue);
      if (index < 0) {
        if (colors.length >= 64) throw new Error('调色板最多 64 色');
        colors.push(hexValue); index = colors.length - 1;
      }
      return index;
    };
    const ops = Array.isArray(instructions) ? instructions : [];
    for (const op of ops) {
      if (!op || typeof op !== 'object') continue;
      const kind = String(op.op || '');
      if (kind === 'clear') { pixels.fill(-1); continue; }
      if (kind === 'fill') { pixels.fill(indexOf(op.color)); continue; }
      if (kind === 'point') {
        const x = clampInt(op.x, 0, width - 1, -1), y = clampInt(op.y, 0, height - 1, -1);
        if (x >= 0 && y >= 0) pixels[y * width + x] = indexOf(op.color);
        continue;
      }
      if (kind === 'rect') {
        const x0 = clampInt(op.x, 0, width - 1, 0), y0 = clampInt(op.y, 0, height - 1, 0);
        const rw = clampInt(op.w, 1, width - x0, 0), rh = clampInt(op.h, 1, height - y0, 0);
        const color = indexOf(op.color);
        for (let y = y0; y < y0 + rh; y += 1) for (let x = x0; x < x0 + rw; x += 1) pixels[y * width + x] = color;
        continue;
      }
      if (kind === 'line') {
        const color = indexOf(op.color);
        line(
          { x: clampInt(op.x1, 0, width - 1, 0), y: clampInt(op.y1, 0, height - 1, 0) },
          { x: clampInt(op.x2, 0, width - 1, 0), y: clampInt(op.y2, 0, height - 1, 0) },
          (x, y) => { pixels[y * width + x] = color; });
        continue;
      }
      throw new Error('未知绘制指令：' + kind);
    }
    return { palette: colors, pixels };
  }
  function applyImported(data) {
    const width = clampInt(data.width, 1, 128, 0);
    const height = clampInt(data.height, 1, 128, 0);
    if (!width || !height) throw new Error('width / height 必须在 1–128');
    let palette = normalizeImportedPalette(data.palette);
    let pixels = null;
    if (Array.isArray(data.pixels) && data.pixels.length === width * height) {
      pixels = data.pixels.map(v => Number.isInteger(v) && v >= -1 && v < palette.length ? v : -1);
    } else if (Array.isArray(data.instructions) && data.instructions.length) {
      const result = applyInstructions(width, height, palette, data.instructions);
      palette = result.palette; pixels = result.pixels;
    } else {
      throw new Error('JSON 需要 pixels（长度 = width×height）或 instructions 绘制指令');
    }
    if (!pixels) throw new Error('没有可导入的像素或指令');
    PX.current = null;
    PX.name = String(data.name || '导入作品').slice(0, 80) || '导入作品';
    PX.width = width; PX.height = height;
    PX.palette = palette; PX.pixels = pixels;
    PX.history = []; PX.redo = []; PX.tool = 'pencil'; PX.color = 0;
    ensureState();
    render();
    toast('已导入像素画：' + PX.width + '×' + PX.height, 'success');
  }
  async function importJsonText(text) {
    const raw = String(text || '').trim();
    if (!raw) throw new Error('请先粘贴或选择文件');
    let data;
    try { data = JSON.parse(raw); } catch (e) { throw new Error('JSON 解析失败：' + e.message); }
    if (data && data.piskel) return importPiskel(data);
    applyImported(data);
  }
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = src;
    });
  }
  function quantizeImage(img, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height).data;
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const key = (r >> 3) + ',' + (g >> 3) + ',' + (b >> 3);
      const row = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
      row.n += 1; row.r += r; row.g += g; row.b += b;
      buckets.set(key, row);
    }
    const top = [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, 48);
    const palette = top.map(row => hex(Math.round(row.r / row.n), Math.round(row.g / row.n), Math.round(row.b / row.n)));
    const colors = palette.map(parseHex);
    const pixels = new Array(width * height).fill(-1);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      let best = -1, bestDist = Infinity;
      for (let j = 0; j < colors.length; j += 1) {
        const c = colors[j];
        const dr = data[i] - c[0], dg = data[i + 1] - c[1], db = data[i + 2] - c[2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) { bestDist = dist; best = j; }
      }
      pixels[i / 4] = best;
    }
    return { palette, pixels };
  }
  async function importPiskel(data) {
    const piskel = data.piskel || data;
    const layer = Array.isArray(piskel.layers) ? piskel.layers[0] : null;
    const frame = layer && Array.isArray(layer.frames) ? layer.frames[0] : null;
    if (!frame || typeof frame !== 'string') throw new Error('Piskel 中没有可读取的首帧');
    const img = await loadImage(frame);
    const width = clampInt(piskel.width || img.naturalWidth, 1, 128, 16);
    const height = clampInt(piskel.height || img.naturalHeight, 1, 128, 16);
    const q = quantizeImage(img, width, height);
    applyImported({ name: piskel.name || 'Piskel 导入', width, height, ...q });
    if ((piskel.layers || []).length > 1 || (layer.frames || []).length > 1) {
      toast('已取首个图层 / 首帧（第一版仅支持单帧单图层）', 'info', 4200);
    }
  }
  async function importPngFile(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const defW = Math.min(96, img.naturalWidth || 16);
      const defH = Math.min(96, Math.round((img.naturalHeight || 16) * (defW / Math.max(1, img.naturalWidth || 16))));
      const input = prompt('PNG 导入目标尺寸（宽x高，最近邻缩放，最大 128）', defW + 'x' + defH);
      if (input === null) return;
      const m = /^\s*(\d+)\s*[x×*]\s*(\d+)\s*$/i.exec(input);
      if (!m) throw new Error('尺寸格式应为 宽x高，例如 32x32');
      const width = clampInt(m[1], 1, 128, 16), height = clampInt(m[2], 1, 128, 16);
      const q = quantizeImage(img, width, height);
      const base = file.name.replace(/\.png$/i, '') || 'PNG 导入';
      applyImported({ name: base, width, height, ...q });
      toast('PNG 已按最近邻缩放并量化调色板', 'success', 3200);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function renderTool() {
    PX.root = document.querySelector('#tool-view');
    if (!PX.root) return;
    try {
      await Promise.all([loadWorks(), loadAssets()]);
    } catch (e) {
      toast('像素画数据读取失败：' + e.message, 'error');
    }
    if (PX.current && !PX.works.some(w => w.artwork_id === PX.current.artwork_id)) PX.current = null;
    ensureState();
    render();
  }
  window.__toolRenderers['pixel-art'] = renderTool;
})();


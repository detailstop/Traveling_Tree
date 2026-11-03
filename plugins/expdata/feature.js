'use strict';
/* 按需加载的功能模块：expdata */
(function () {
  let ROOT = null;
/* ---------- 实验数据获取（导入/粘贴图片 → 开始按钮 → A 读数 / N 重置 · 图片上点击取点） ---------- */
function expStatusHTML(E) {
  if (!E.img) return '🖼 请先导入或粘贴图片（📁 导入图片 / Ctrl+V）';
  if (E.mode === 'armed') return '⌨ 已激活：按 <b>A</b> 开始读数 · 按 <b>N</b> 重置';
  if (E.mode === 'running') return `🎯 读数中：第 ${Math.min(E.clicks.length + 1, 3)} / 3 次点击（图片上 · 按 N 重置）`;
  if (E.mode === 'done') return '✅ 完成：三个线段长度已计算（可再次点按「开始监测」或按 N 重置）';
  return '⏸ 待命：点按「开始监测」后按 A 读数';
}
function expResultHTML(E) {
  const P = E.clicks;
  const row = (i, j, d, tag) => `<div class="exp-row"><span class="exp-tag">${tag}</span><span class="exp-seg">P${i}(${P[i - 1].x.toFixed(1)}, ${P[i - 1].y.toFixed(1)}) → P${j}(${P[j - 1].x.toFixed(1)}, ${P[j - 1].y.toFixed(1)})</span><b>${d.toFixed(1)} px</b></div>`;
  return `<div class="exp-res-box">
    ${row(1, 2, E.lens[0], '①')}${row(2, 3, E.lens[1], '②')}${row(3, 1, E.lens[2], '③')}
    <div class="exp-row total"><span class="exp-tag">∑</span><span class="exp-seg">三点连线周长</span><b>${(E.lens[0] + E.lens[1] + E.lens[2]).toFixed(1)} px</b></div>
  </div>`;
}
function expImgInfo(E) {
  return E.img ? `🖼 ${esc(E.imgName)} · 原始 ${E.imgW}×${E.imgH} · 图片像素坐标（px）` : '';
}
function expPaint() {
  // 图片画布绘制：先画图，再叠加网格与标记（坐标为图片显示像素）
  const cv = document.getElementById('exp-cv');
  if (!cv) return;
  const E = S.exp || { mode: 'idle', clicks: [], imgEl: null };
  const ctx = cv.getContext('2d');
  const imgEl = E.imgEl;
  if (!imgEl || !imgEl.complete) {
    ctx.clearRect(0, 0, cv.width, cv.height);
    cv.width = 800; cv.height = 450;
    return;
  }
  const tv = ROOT;
  const maxW = Math.max(320, Math.min(940, (tv && tv.getBoundingClientRect ? tv.getBoundingClientRect().width : 940) - 24));
  const maxH = Math.max(240, innerHeight * 0.62);
  const sc = Math.min(maxW / imgEl.width, maxH / imgEl.height, 1);
  const W = Math.max(1, Math.round(imgEl.width * sc)), H = Math.max(1, Math.round(imgEl.height * sc));
  if (cv.width !== W) cv.width = W;
  if (cv.height !== H) cv.height = H;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(imgEl, 0, 0, W, H);
  if (E.mode !== 'running' && E.mode !== 'done') return;
  ctx.strokeStyle = 'rgba(148,163,184,.22)'; ctx.lineWidth = 1;
  for (let x = 0.5; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0.5; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const pts = E.clicks;
  const seg = (a, b) => {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    ctx.strokeStyle = 'rgba(99,179,237,.92)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.fillStyle = '#0ea5e9'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3;
    ctx.strokeText(d.toFixed(1), (a.x + b.x) / 2, (a.y + b.y) / 2 - 9);
    ctx.fillText(d.toFixed(1), (a.x + b.x) / 2, (a.y + b.y) / 2 - 9);
  };
  if (pts.length === 3) {
    ctx.fillStyle = 'rgba(99,179,237,.14)';
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.lineTo(pts[2].x, pts[2].y); ctx.closePath(); ctx.fill();
    seg(pts[0], pts[1]); seg(pts[1], pts[2]); seg(pts[2], pts[0]);
  } else if (pts.length === 2) seg(pts[0], pts[1]);
  const colors = ['#f87171', '#fbbf24', '#34d399'];
  pts.forEach((p, i) => {
    ctx.fillStyle = colors[i];
    ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 3;
    ctx.strokeText('P' + (i + 1), p.x + 13, p.y - 11);
    ctx.fillText('P' + (i + 1), p.x + 13, p.y - 11);
  });
}
function expLoadImg(dataUrl, name) {
  const E = S.exp;
  const im = new Image();
  im.onload = () => {
    E.img = dataUrl; E.imgName = name || '剪贴板图片';
    E.imgW = im.naturalWidth || im.width; E.imgH = im.naturalHeight || im.height;
    E.imgEl = im; E.mode = 'idle'; E.clicks = [];
    updateExpUI();
    toast('图片已载入：点「开始监测」→ 按 A 读数', 'success');
  };
  im.onerror = () => toast('图片载入失败', 'error');
  im.src = dataUrl;
}
function expReadFile(f) {
  const rd = new FileReader();
  rd.onload = e => expLoadImg(e.target.result, f.name || '');
  rd.readAsDataURL(f);
}
function copyExpResult() {
  const E = S.exp;
  if (!E || E.mode !== 'done' || E.clicks.length < 3) return toast('尚无结果可复制', 'warn');
  const P = E.clicks;
  const txt = '实验数据获取结果' + (E.img ? `（${E.imgName} · ${E.imgW}×${E.imgH}）` : '') + '\n'
    + `P1(${P[0].x.toFixed(1)}, ${P[0].y.toFixed(1)}) → P2(${P[1].x.toFixed(1)}, ${P[1].y.toFixed(1)}) = ${E.lens[0].toFixed(1)} px\n`
    + `P2(${P[1].x.toFixed(1)}, ${P[1].y.toFixed(1)}) → P3(${P[2].x.toFixed(1)}, ${P[2].y.toFixed(1)}) = ${E.lens[1].toFixed(1)} px\n`
    + `P3(${P[2].x.toFixed(1)}, ${P[2].y.toFixed(1)}) → P1(${P[0].x.toFixed(1)}, ${P[0].y.toFixed(1)}) = ${E.lens[2].toFixed(1)} px\n`
    + `周长 = ${(E.lens[0] + E.lens[1] + E.lens[2]).toFixed(1)} px`;
  const done = () => toast('结果已复制 ✓', 'success');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done).catch(() => fallbackCopy(txt, done));
  else fallbackCopy(txt, done);
}
function fallbackCopy(txt, done) {
  const ta = document.createElement('textarea');
  ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动复制', 'warn'); }
  ta.remove();
}
function updateExpUI() {
  const E = S.exp || { mode: 'idle', clicks: [], imgEl: null };
  const st = $('#exp-status'); if (st) st.innerHTML = expStatusHTML(E);
  const res = $('#exp-res'); if (res) res.innerHTML = E.mode === 'done' ? expResultHTML(E) : (E.img ? '<div class="exp-hint">在图片上依次点击 3 个点读数 · 按 <b>N</b> 随时重置</div>' : '');
  const ph = $('#exp-imgph'); if (ph) ph.style.display = E.img ? 'none' : 'grid';
  const info = $('#exp-imginfo'); if (info) info.innerHTML = expImgInfo(E);
  const go = $('#exp-start'); if (go) {
    const busy = !E.img || E.mode === 'armed' || E.mode === 'running';
    go.disabled = busy;
    go.innerHTML = !E.img ? '▶ 开始监测' : (busy ? '⏳ 已激活 · 等待按键' : '▶ 开始监测');
  }
  const cp = $('#exp-copy'); if (cp) { if (E.mode === 'done') cp.removeAttribute('disabled'); else cp.setAttribute('disabled', 'disabled'); }
  expPaint();
}
function renderExpDataTool(container) {
  ROOT = container;
  const box = ROOT;
  if (!S.exp) S.exp = { mode: 'idle', clicks: [], img: null, imgName: '', imgW: 0, imgH: 0, imgEl: null };
  const E = S.exp;
  box.innerHTML = `
    <div class="exp-wrap">
      <div class="gcard">
        <div class="section-title"><span class="st-emoji">🧪</span>实验数据获取
          <span style="font-size:12px;color:var(--text-dim);font-weight:400;">导入或 <b>Ctrl+V</b> 粘贴图片 → 「开始监测」→ <b>A</b> 读数 / <b>N</b> 重置 · 在图片上点击 3 点</span></div>
        <div class="exp-status" id="exp-status">${expStatusHTML(E)}</div>
        <div class="exp-imgbox" id="exp-imgbox">
          <canvas id="exp-cv"></canvas>
          <div class="exp-imgph" id="exp-imgph" style="display:${E.img ? 'none' : 'grid'};">📷 导入图片 或 Ctrl+V 粘贴截图<br><span style="font-size:12px;margin-top:6px;">载入后在图片上点击取点，测量三点连线长度</span></div>
        </div>
        <div class="exp-imginfo" id="exp-imginfo">${expImgInfo(E)}</div>
        <div id="exp-res" style="margin-top:10px;">${E.mode === 'done' ? expResultHTML(E) : (E.img ? '<div class="exp-hint">在图片上依次点击 3 个点读数 · 按 <b>N</b> 随时重置</div>' : '')}</div>
        <div class="exp-ctrl">
          <button class="btn sm" id="exp-import">📁 导入图片</button>
          <button class="btn sm" id="exp-start" ${E.img ? '' : 'disabled'}>▶ 开始监测</button>
          <button class="btn sm soft" id="exp-reset">🔄 重置</button>
          <button class="btn sm soft" id="exp-clear">🗑 清除图片</button>
          <button class="btn sm soft" id="exp-copy" ${E.mode !== 'done' ? 'disabled' : ''}>📋 复制结果</button>
        </div>
      </div>
    </div>`;
  updateExpUI();
  $('#exp-import').onclick = () => {
    const fi = document.createElement('input');
    fi.type = 'file'; fi.accept = 'image/*';
    fi.onchange = () => { const f = fi.files && fi.files[0]; if (f) expReadFile(f); };
    fi.click();
  };
  $('#exp-start').onclick = () => { if (!S.exp.img) return; S.exp.mode = 'idle'; S.exp.clicks = []; S.exp.mode = 'armed'; updateExpUI(); toast('已激活：按 A 开始读数 · 按 N 重置', 'info'); };
  $('#exp-reset').onclick = () => { S.exp.mode = 'idle'; S.exp.clicks = []; updateExpUI(); toast('已重置', 'info'); };
  $('#exp-clear').onclick = () => { S.exp = { mode: 'idle', clicks: [], img: null, imgName: '', imgW: 0, imgH: 0, imgEl: null }; updateExpUI(); toast('图片已清除', 'info'); };
  $('#exp-copy').onclick = copyExpResult;
  if (window.__expBound) return;
  window.__expBound = true;
  window.addEventListener('resize', () => { if (S.tool === 'expdata') expPaint(); });
  document.addEventListener('paste', e => {
    if (S.tool !== 'expdata') return;
    const items = (e.clipboardData || {}).items;
    if (!items) return;
    for (const it of items) {
      if (it.type && it.type.indexOf('image/') === 0) {
        const f = it.getAsFile && it.getAsFile();
        if (f) { e.preventDefault(); expReadFile(f); return; }
      }
    }
  });
  document.addEventListener('keydown', e => {
    if (S.tool !== 'expdata') return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.repeat) return;
    const E2 = S.exp || { mode: 'idle', clicks: [] };
    const k = e.key.toLowerCase();
    if (k === 'a') {
      if (E2.mode === 'armed') {
        E2.mode = 'running'; E2.clicks = [];
        updateExpUI();
        toast('读数中：点击第 1 个点（图片上），按 N 重置', 'info');
      }
    } else if (k === 'n') {
      if (E2.mode !== 'idle') {
        S.exp.mode = 'idle'; S.exp.clicks = [];
        updateExpUI();
        toast('已重置：需再次点按「开始监测」', 'warn');
      }
    }
  });
  document.addEventListener('click', e => {
    if (S.tool !== 'expdata') return;
    const E2 = S.exp;
    if (!E2 || E2.mode !== 'running') return;
    if (!e.target || e.target.id !== 'exp-cv') return;   // 仅图片画布内点击读数
    const cv = document.getElementById('exp-cv');
    const r = cv.getBoundingClientRect();
    E2.clicks.push({ x: e.clientX - r.left, y: e.clientY - r.top });
    updateExpUI();
    if (E2.clicks.length === 3) {
      E2.mode = 'done';
      E2.lens = [
        Math.hypot(E2.clicks[1].x - E2.clicks[0].x, E2.clicks[1].y - E2.clicks[0].y),
        Math.hypot(E2.clicks[2].x - E2.clicks[1].x, E2.clicks[2].y - E2.clicks[1].y),
        Math.hypot(E2.clicks[0].x - E2.clicks[2].x, E2.clicks[0].y - E2.clicks[2].y),
      ];
      updateExpUI();
      toast('完成：三条线段长度已计算 ✓', 'success');
    }
  });
}


window.__toolRenderers.expdata = renderExpDataTool;
})();

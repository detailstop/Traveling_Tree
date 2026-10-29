'use strict';
/* 按需加载的功能模块：batch */
(function () {
/* ============================================================
   批量压缩（按路径扫描 → 原位替换）
   ============================================================ */
const BATCH_PATH_KEY = 'rt_batch_path';

function renderBatchTool() {
  S.batch = S.batch || {
    path: localStorage.getItem(BATCH_PATH_KEY) || '',
    minKb: 200, iq: 70, plv: 1, target: 0, files: null, results: null,
  };
  const box = $('#tool-view');
  const b = S.batch;
  box.innerHTML = `
    <div class="gcard">
      <div class="section-title"><span class="st-emoji">🗜️</span>批量压缩
        <span style="font-size:12px;color:var(--text-dim);font-weight:400;">仅处理该文件夹下的文件（不含子文件夹）· 压缩后原位替换 · 建议先备份</span></div>
      <div class="batch-form">
        <div class="bff-row bff-row-wide">
          <div class="bf-field bf-path-field">
            <label class="bf-lb">文件夹路径</label>
            <input class="input bf-path" id="bf-path" value="${esc(b.path)}"
                   placeholder="如 C:\\Users\\<用户名>\\Desktop\\待压缩" spellcheck="false">
          </div>
        </div>
        <div class="bff-row">
          <div class="bf-field">
            <label class="bf-lb">大小阈值 (KB)</label>
            <input class="input bf-num" id="bf-minkb" type="number" min="0" value="${b.minKb}">
          </div>
          <div class="bf-field">
            <label class="bf-lb">图片质量</label>
            <select class="input bf-sel" id="bf-iq">
              ${[[85, '高（85）'], [70, '中（70）'], [50, '低（50）']].map(([v, lb]) =>
                `<option value="${v}" ${b.iq === v ? 'selected' : ''}>${lb}</option>`).join('')}
            </select>
          </div>
          <div class="bf-field">
            <label class="bf-lb">PDF 强度</label>
            <select class="input bf-sel" id="bf-plv">
              ${[[1, '标准（去冗余）'], [2, '强力（重编码图片）'], [0, '轻度（无损重写）']].map(([v, lb]) =>
                `<option value="${v}" ${b.plv === v ? 'selected' : ''}>${lb}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="bff-row">
          <div class="bf-field">
            <label class="bf-lb">目标压缩率 %</label>
            <input class="input bf-num" id="bf-target" type="number" min="0" max="100"
                   value="${b.target || ''}" placeholder="留空 = 按质量档">
          </div>
          <span class="bf-hint">如填 40 = 图片压到原体积 40% 以内（自动降质量 / 降分辨率，允许模糊）</span>
        </div>
        <div class="bf-act">
          <button class="btn" id="bf-scan">🔍 扫描文件夹</button>
          <button class="btn soft" id="bf-run" style="display:none;">开始压缩（0 个文件）</button>
          <div class="pdf-prog" id="bf-prog" style="display:none;">
            <div class="pp-bar"><div class="pp-fill pp-run"></div></div>
            <span class="pp-txt">处理中…</span>
          </div>
        </div>
      </div>
      <div id="bf-list"></div>
    </div>`;

  const byId = id => document.getElementById(id);
  byId('bf-path').oninput = () => { S.batch.path = byId('bf-path').value; };
  byId('bf-minkb').oninput = () => S.batch.minKb = Math.max(0, parseInt(byId('bf-minkb').value) || 0);
  byId('bf-iq').onchange = () => S.batch.iq = +byId('bf-iq').value;
  byId('bf-plv').onchange = () => S.batch.plv = +byId('bf-plv').value;
  byId('bf-target').oninput = () => S.batch.target = Math.max(0, Math.min(100, parseInt(byId('bf-target').value) || 0));

  byId('bf-scan').onclick = async () => {
    const path = S.batch.path.trim();
    if (!path) { toast('请填写文件夹路径', 'warn'); return; }
    localStorage.setItem(BATCH_PATH_KEY, path);
    S.batch.files = null; S.batch.results = null;
    batchSetBusy(true, '扫描中…');
    try {
      const r = await apiPost('/api/plugin/pdf/batch/scan', { path, min_kb: S.batch.minKb });
      if (!r.ok) throw new Error(r.error || '扫描失败');
      S.batch.files = r.files || [];
      batchRenderList();
      batchSetBusy(false);
      const btn = byId('bf-run');
      btn.style.display = '';
      btn.textContent = `开始压缩（${S.batch.files.length} 个文件）`;
      toast(`扫描到 ${S.batch.files.length} 个满足条件的文件`, 'info');
    } catch (err) {
      toast('⚠️ ' + err.message, 'warn');
      batchSetBusy(false);
    }
  };

  byId('bf-run').onclick = async () => {
    const path = S.batch.path.trim();
    if (!path || !S.batch.files || !S.batch.files.length) { toast('请先扫描文件夹', 'warn'); return; }
    if (!confirm(`将原位替换 ${S.batch.files.length} 个文件（原名不变，原文件被覆盖），确定继续？`)) return;
    batchSetBusy(true, '压缩中…');
    try {
      const r = await apiPost('/api/plugin/pdf/batch/compress',
        { path, min_kb: S.batch.minKb, img_quality: S.batch.iq, pdf_level: S.batch.plv, target_ratio: S.batch.target });
      if (!r.ok) throw new Error(r.error || '压缩失败');
      S.batch.results = r.results || [];
      batchRenderList();
      toast(`完成：压缩 ${r.done} · 跳过 ${r.skipped} · 失败 ${r.failed}`, r.failed ? 'warn' : 'success');
    } catch (err) {
      toast('⚠️ ' + err.message, 'warn');
    } finally {
      batchSetBusy(false);
    }
  };
}

function batchSetBusy(on, txt) {
  $('#bf-prog').style.display = on ? 'flex' : 'none';
  $('#bf-scan').disabled = on;
  $('#bf-run').disabled = on;
}

function batchRenderList() {
  const b = S.batch;
  const box = $('#bf-list');
  if (b.results) {
    const saved = b.results.reduce((s, r) => s + (r.ok && !r.skipped ? (r.size - r.new_size) : 0), 0);
    box.innerHTML = `
      <div class="bf-summary">✓ 压缩 ${b.results.filter(r => r.ok && !r.skipped).length} · 跳过 ${b.results.filter(r => r.skipped).length} · 失败 ${b.results.filter(r => !r.ok).length} · 共节省 ${fmtSize(saved)}</div>
      <div class="bf-table">${b.results.map(r => {
        const savedPct = r.size > 0 && r.new_size < r.size ? Math.round((1 - r.new_size / r.size) * 100) : 0;
        const cls = !r.ok ? 'bad' : r.skipped ? 'skip' : 'good';
        const mark = !r.ok ? '⚠️' : r.skipped ? '·' : '✓';
        return `<div class="bf-row ${cls}">
          <span class="br-name" title="${esc(r.error || '')}">${esc(r.name)}</span>
          <span class="br-kind">${r.kind === 'pdf' ? '📄 PDF' : '🖼️ 图片'}</span>
          <span class="br-size">${fmtSize(r.size)} → ${fmtSize(r.new_size)}</span>
          <span class="br-pct">${r.skipped ? '保留原文件' : !r.ok ? esc(r.error || '失败') : '−' + savedPct + '%'}</span>
          <span class="br-mark">${mark}</span>
        </div>`;
      }).join('')}</div>`;
  } else if (b.files) {
    box.innerHTML = `
      <div class="bf-table">${b.files.map((f, i) => `
        <div class="bf-row">
          <span class="br-no">${i + 1}</span>
          <span class="br-name">${esc(f.name)}</span>
          <span class="br-kind">${f.kind === 'pdf' ? '📄 PDF' : '🖼️ 图片'}</span>
          <span class="br-size">${fmtSize(f.size)}</span>
          <span class="br-pct">超过阈值，将压缩</span>
        </div>`).join('')}</div>`;
  } else {
    box.innerHTML = '<div class="empty" style="padding:20px;"><span class="e-icon">🗂️</span>输入路径并扫描后，此处显示待压缩文件</div>';
  }
}


window.__toolRenderers.batch = renderBatchTool;
})();

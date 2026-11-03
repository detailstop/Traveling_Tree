'use strict';
/* 按需加载的功能模块：pdf */
(function () {
  let ROOT = null;
/* ============================================================
   PDF 工具（合并 / 分割 / 压缩 / 图片转 PDF）
   ============================================================ */
const PDF_TABS = [
  ['merge', '🔗 合并'], ['split', '✂️ 分割'], ['compress', '🗜️ 压缩'], ['images', '🖼️ 图片转 PDF'],
];

function renderPDFTool(container) {
  ROOT = container;
  S.pdf = S.pdf || { tab: 'merge', cMode: 'pdf', merge: [], split: [], compress: [], compressImg: [], images: [] };
  const box = ROOT;
  box.innerHTML = `
    <div class="gcard">
      <div class="section-title"><span class="st-emoji">📄</span>PDF 工具
        <span style="font-size:12px;color:var(--text-dim);font-weight:400;">本地处理 · 文件不上传网络 · 拖拽排序 · 批量上传</span></div>
      <div class="pdf-tabs">${PDF_TABS.map(([id, lb]) =>
        `<button class="pdf-tab${S.pdf.tab === id ? ' on' : ''}" data-tab="${id}">${lb}</button>`).join('')}</div>
      <div id="pdf-body"></div>
    </div>`;
  $$('.pdf-tab').forEach(b => b.onclick = () => { S.pdf.tab = b.dataset.tab; renderPDFTool(ROOT); });
  pdfRenderTab();
}

function pdfRenderTab() {
  const body = $('#pdf-body');
  const tab = S.pdf.tab;
  if (tab === 'merge') body.innerHTML = pdfShell('合并', '拖入多个 PDF 或点击选择 · 拖动调整顺序', 'multiple', 'pdf', true, false);
  else if (tab === 'split') body.innerHTML = pdfShell('分割', '选择一个 PDF', 'single', 'pdf', false, true);
  else if (tab === 'compress') {
    const img = S.pdf.cMode === 'img';
    body.innerHTML = pdfShell('压缩', img ? '批量拖入图片 · 选择压缩质量' : '选择一个 PDF · 选择压缩强度', img ? 'multiple' : 'single', img ? 'image' : 'pdf', !img, true);
  } else body.innerHTML = pdfShell('图片转 PDF', '批量拖入图片 · 拖动调整顺序', 'multiple', 'image', true, false);
  pdfWireTab();
}

function pdfShell(title, hint, mode, accept, showDrop, showOpts) {
  const arr = S.pdf[({ merge: 'merge', split: 'split', compress: 'compress', images: 'images' })[S.pdf.tab]];
  const items = arr.map((f, i) => pdfItemHTML(f, i)).join('');
  const isImgMode = S.pdf.tab === 'compress' && S.pdf.cMode === 'img';
  return `
    <div class="pdf-zone" id="pdf-zone">
      <input type="file" id="pdf-input" class="hidden-input" ${mode === 'multiple' ? 'multiple' : ''}
             accept="${accept === 'pdf' ? '.pdf,application/pdf' : 'image/*'}" data-mode="${mode}">
      ${S.pdf.tab === 'compress' ? `
        <div class="pdf-cmode" id="pdf-cmode">
          <button class="cm-btn${isImgMode ? '' : ' on'}" data-cm="pdf">📄 压缩 PDF</button>
          <button class="cm-btn${isImgMode ? ' on' : ''}" data-cm="img">🖼️ 压缩图片</button>
        </div>` : ''}
      <div class="pdf-drop" id="pdf-drop">
        <div class="pd-icon">${accept === 'pdf' ? '📄' : '🖼️'}</div>
        <div class="pd-txt"><b>点击选择或拖拽文件到此处</b><br><span>${hint}</span></div>
      </div>
      <div class="pdf-list" id="pdf-list">${items}</div>
      <div class="pdf-opts" id="pdf-opts" style="display:${showOpts ? '' : 'none'}">
        <div class="pdf-opt-row" id="pdf-opt-split" style="display:${S.pdf.tab === 'split' ? 'flex' : 'none'}">
          <label class="po-r"><input type="radio" name="sp" value="range" ${(S.pdf.splitMode || 'range') === 'range' ? 'checked' : ''}> 页面范围</label>
          <label class="po-r"><input type="radio" name="sp" value="every" ${S.pdf.splitMode === 'every' ? 'checked' : ''}> 每 <input type="number" min="1" class="input po-num" id="sp-every" value="${S.pdf.splitEvery || 2}"> 页一份</label>
          <label class="po-r"><input type="radio" name="sp" value="each" ${S.pdf.splitMode === 'each' ? 'checked' : ''}> 每页一份</label>
          <input class="input po-range" id="sp-pages" placeholder="页面范围，如 1-3,5,7-9" value="${esc(S.pdf.splitPages || '')}" style="display:${(S.pdf.splitMode || 'range') === 'range' ? '' : 'none'}">
        </div>
        <div class="pdf-opt-row" id="pdf-opt-level" style="display:${S.pdf.tab === 'compress' && !isImgMode ? 'flex' : 'none'}">
          <label class="po-r"><input type="radio" name="lv" value="0" ${(S.pdf.cLevel || 1) === 0 ? 'checked' : ''}> 轻度（无损重写）</label>
          <label class="po-r"><input type="radio" name="lv" value="1" ${(S.pdf.cLevel || 1) === 1 ? 'checked' : ''}> 标准（去冗余）</label>
          <label class="po-r"><input type="radio" name="lv" value="2" ${S.pdf.cLevel === 2 ? 'checked' : ''}> 强力（重编码图片）</label>
        </div>
        <div class="pdf-opt-row" id="pdf-opt-q" style="display:${S.pdf.tab === 'compress' && isImgMode ? 'flex' : 'none'}">
          <span class="po-lb">图片质量：</span>
          <label class="po-r"><input type="radio" name="cq" value="85" ${(S.pdf.cQ || 70) === 85 ? 'checked' : ''}> 高（85）</label>
          <label class="po-r"><input type="radio" name="cq" value="70" ${(S.pdf.cQ || 70) === 70 ? 'checked' : ''}> 中（70）</label>
          <label class="po-r"><input type="radio" name="cq" value="50" ${S.pdf.cQ === 50 ? 'checked' : ''}> 低（50）</label>
          <span class="po-lb" style="opacity:.7">多张打包 zip · 单张直接下载</span>
        </div>
        <div class="pdf-opt-row" id="pdf-opt-paper" style="display:${S.pdf.tab === 'images' ? 'flex' : 'none'}">
          <label class="po-lb">纸张：</label>
          <select class="input po-num" id="pp-paper">
            ${['a4', 'a3', 'fit'].map(p => `<option value="${p}" ${(S.pdf.paper || 'a4') === p ? 'selected' : ''}>${p === 'a4' ? 'A4' : p === 'a3' ? 'A3' : '原图尺寸'}</option>`).join('')}
          </select>
          <label class="po-lb" style="margin-left:10px;">方向：</label>
          <select class="input po-num" id="pp-orient">
            ${['portrait', 'landscape'].map(o => `<option value="${o}" ${(S.pdf.orient || 'portrait') === o ? 'selected' : ''}>${o === 'portrait' ? '纵向' : '横向'}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="pdf-act">
        <button class="btn" id="pdf-run">${pdfRunLabel()}</button>
        <div class="pdf-prog" id="pdf-prog" style="display:none;">
          <div class="pp-bar"><div class="pp-fill" id="pp-fill"></div></div>
          <span class="pp-txt" id="pp-txt">上传中 0%</span>
        </div>
      </div>
      <div class="pdf-result" id="pdf-result" style="display:none;"></div>
    </div>`;
}

function pdfRunLabel() {
  return ({ merge: '合并 PDF →', split: '开始分割 →', compress: '开始压缩 →', images: '生成 PDF →' })[S.pdf.tab];
}

function pdfItemHTML(f, i) {
  const isImg = S.pdf.tab === 'images' || (S.pdf.tab === 'compress' && S.pdf.cMode === 'img');
  return `
    <div class="pdf-item" draggable="true" data-i="${i}">
      <span class="pi-no">${i + 1}</span>
      ${isImg ? `<img class="pi-thumb" src="${f.thumb || ''}" alt="">` : '<span class="pi-ico">📄</span>'}
      <span class="pi-name" title="${esc(f.name)}">${esc(f.name)}</span>
      <span class="pi-size">${fmtSize(f.size)}</span>
      <button class="pi-x" data-i="${i}">✕</button>
    </div>`;
}

function pdfWireTab() {
  const tab = S.pdf.tab;
  const list = $('#pdf-list');
  const zone = $('#pdf-zone');
  const input = $('#pdf-input');
  const drop = $('#pdf-drop');

  // 上传：点击 / 拖拽
  drop.onclick = () => input.click();
  input.onchange = e => { pdfAddFiles(tab, input.files); input.value = ''; };
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => {
    e.preventDefault(); drop.classList.remove('over');
    pdfAddFiles(tab, e.dataTransfer.files);
  };

  // 列表：拖拽排序 / 删除
  list.ondragstart = e => {
    const it = e.target.closest('.pdf-item');
    if (!it) return;
    S.pdf.drag = +it.dataset.i;
    e.dataTransfer.effectAllowed = 'move';
  };
  list.ondragover = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  list.ondrop = e => {
    e.preventDefault();
    const target = e.target.closest('.pdf-item');
    if (!target || S.pdf.drag === undefined) return;
    const to = +target.dataset.i;
    const arr = S.pdf[tab];
    const from = S.pdf.drag;
    if (from !== to) {
      const [it] = arr.splice(from, 1);
      arr.splice(to, 0, it);
    }
    delete S.pdf.drag;
    pdfRenderList();
  };
  list.onclick = e => {
    const x = e.target.closest('.pi-x');
    if (!x) return;
    S.pdf[tab].splice(+x.dataset.i, 1);
    pdfRenderList();
  };
  zone.addEventListener('dragover', e => { if (e.target === zone || e.target === drop) e.preventDefault(); });

  // 选项
  if (tab === 'split') {
    $$('input[name=sp]').forEach(r => r.onchange = () => {
      S.pdf.splitMode = r.value;
      $('#sp-pages').style.display = r.value === 'range' ? '' : 'none';
      if (r.value === 'every') S.pdf.splitEvery = parseInt($('#sp-every').value) || 2;
      if (r.value === 'range') S.pdf.splitPages = $('#sp-pages').value;
    });
    $('#sp-pages').oninput = () => S.pdf.splitPages = $('#sp-pages').value;
    $('#sp-every').oninput = () => S.pdf.splitEvery = parseInt($('#sp-every').value) || 2;
  } else if (tab === 'compress') {
    $$('input[name=lv]').forEach(r => r.onchange = () => S.pdf.cLevel = +r.value);
    $$('input[name=cq]').forEach(r => r.onchange = () => S.pdf.cQ = +r.value);
  } else if (tab === 'images') {
    $('#pp-paper').onchange = () => S.pdf.paper = $('#pp-paper').value;
    $('#pp-orient').onchange = () => S.pdf.orient = $('#pp-orient').value;
  }

  // 压缩模式切换（PDF / 图片）
  const cm = $('#pdf-cmode');
  if (cm) {
    Array.from(cm.querySelectorAll('.cm-btn')).forEach(b => b.onclick = () => {
      if (S.pdf.cMode === b.dataset.cm) return;
      S.pdf.cMode = b.dataset.cm;
      pdfRenderTab();
    });
  }

  // 执行
  $('#pdf-run').onclick = pdfRun;
  $('#pdf-prog').style.display = 'none';
}

function pdfRenderList() {
  const arr = S.pdf[S.pdf.tab];
  $('#pdf-list').innerHTML = arr.map((f, i) => pdfItemHTML(f, i)).join('');
  pdfWireListOnly();
}
function pdfWireListOnly() {
  const list = $('#pdf-list');
  list.ondragstart = e => {
    const it = e.target.closest('.pdf-item');
    if (!it) return;
    S.pdf.drag = +it.dataset.i;
    e.dataTransfer.effectAllowed = 'move';
  };
  list.ondragover = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  list.ondrop = e => {
    e.preventDefault();
    const target = e.target.closest('.pdf-item');
    if (!target || S.pdf.drag === undefined) return;
    const to = +target.dataset.i, from = S.pdf.drag;
    const arr = S.pdf[S.pdf.tab];
    if (from !== to) { const [it] = arr.splice(from, 1); arr.splice(to, 0, it); }
    delete S.pdf.drag;
    pdfRenderList();
  };
  list.onclick = e => {
    const x = e.target.closest('.pi-x');
    if (!x) return;
    S.pdf[S.pdf.tab].splice(+x.dataset.i, 1);
    pdfRenderList();
  };
}

function pdfAddFiles(tab, files) {
  const arr = S.pdf[tab];
  const imgOk = tab === 'images' || (tab === 'compress' && S.pdf.cMode === 'img');
  for (const f of files) {
    const ok = imgOk ? /^image\//.test(f.type) : f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    if (!ok) { toast(`已跳过：${f.name}（类型不符）`, 'warn'); continue; }
    const rec = { name: f.name, size: f.size, file: f };
    if (imgOk) rec.thumb = URL.createObjectURL(f);
    arr.push(rec);
  }
  pdfRenderList();
}

function pdfFileToB64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function pdfPost(url, payload, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.responseType = 'blob';
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.upload.onprogress = e => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total, 'upload'); };
    xhr.onload = () => {
      if (xhr.status === 200) resolve({ blob: xhr.response, headers: xhr.getAllResponseHeaders() });
      else xhr.response.text().then(t => {
        let msg = '处理失败';
        try { msg = JSON.parse(t).error || msg; } catch (e) { /* ignore */ }
        reject(new Error(msg));
      });
    };
    xhr.onerror = () => reject(new Error('网络错误'));
    xhr.send(JSON.stringify(payload));
  });
}

function parseHeader(hs, key) {
  const m = new RegExp('(?:^|\\r?\\n)' + key + ':\\s*([^\\r\\n]+)', 'i').exec(hs);
  return m ? m[1].trim() : null;
}

function pdfSetProg(show, pct, txt) {
  const prog = $('#pdf-prog');
  prog.style.display = show ? 'flex' : 'none';
  if (show) {
    $('#pp-fill').style.width = (pct * 100) + '%';
    $('#pp-txt').textContent = txt || `上传中 ${Math.round(pct * 100)}%`;
  }
}

function pdfShowResult(inner) {
  const r = $('#pdf-result');
  r.style.display = '';
  r.innerHTML = inner;
}

function pdfDownload(blob, name) {
  window.rtDownloadBlob(blob, name);
}

async function pdfRun() {
  const tab = S.pdf.tab;
  const arr = S.pdf[tab];
  if (!arr.length) { toast('请先添加文件', 'warn'); return; }
  const imgCompress = tab === 'compress' && S.pdf.cMode === 'img';
  if ((tab === 'split' || (tab === 'compress' && !imgCompress)) && arr.length > 1) {
    toast('分割 / 压缩 PDF 每次处理一个文件（已取第一个）', 'info');
  }
  const btn = $('#pdf-run');
  btn.disabled = true;
  pdfShowResult('');
  try {
    const files = await Promise.all(arr.map(async f => ({ name: f.name, data: await pdfFileToB64(f.file) })));
    let payload, url;
    if (tab === 'merge') { payload = { files }; url = '/api/plugin/pdf/pdf/merge'; }
    else if (tab === 'split') {
      const mode = S.pdf.splitMode || 'range';
      payload = { file: files[0], mode,
        pages: mode === 'range' ? (S.pdf.splitPages || '') : '',
        every: mode === 'every' ? (S.pdf.splitEvery || 2) : 2 };
      url = '/api/plugin/pdf/pdf/split';
    } else if (tab === 'compress') {
      if (imgCompress) { payload = { files, quality: S.pdf.cQ || 70 }; url = '/api/plugin/pdf/pdf/compress-images'; }
      else { payload = { file: files[0], level: S.pdf.cLevel || 1 }; url = '/api/plugin/pdf/pdf/compress'; }
    } else {
      payload = { files, paper: S.pdf.paper || 'a4', orient: S.pdf.orient || 'portrait' };
      url = '/api/plugin/pdf/pdf/images';
    }
    pdfSetProg(true, 0.02, '上传中 0%');
    const { blob, headers } = await pdfPost(url, payload, (p, phase) => {
      if (phase === 'upload') {
        pdfSetProg(true, 0.05 + p * 0.45, `上传中 ${Math.round(p * 100)}%`);
      }
    });
    pdfSetProg(true, 0.55, '处理中…');
    await new Promise(r => setTimeout(r, 120));
    pdfSetProg(false);
    if (tab === 'compress') {
      const orig = +parseHeader(headers, 'X-Orig-Size') || 0;
      const neu = +parseHeader(headers, 'X-New-Size') || 0;
      const saved = orig > 0 ? Math.round((1 - neu / orig) * 100) : 0;
      const name = imgCompress
        ? ((parseHeader(headers, 'Content-Type') || '').includes('zip') ? 'compressed_images.zip' : 'compressed.jpg')
        : 'compressed.pdf';
      pdfShowResult(`
        <div class="pr-row">压缩完成：<b>${fmtSize(orig)}</b> → <b>${fmtSize(neu)}</b>
          ${saved > 0 ? `<span class="pr-save">节省 ${saved}%</span>` : '<span class="pr-save" style="color:#b07a2d;">已接近极限，无明显可压缩空间</span>'}</div>
        <button class="btn" id="pr-dl">下载 ${name} ⬇</button>`);
      $('#pr-dl').onclick = () => pdfDownload(blob, name);
    } else {
      const name = tab === 'merge' ? 'merged.pdf' : tab === 'split'
        ? (parseHeader(headers, 'Content-Type') || '').includes('zip') ? 'split.zip' : 'split.pdf'
        : 'images.pdf';
      pdfShowResult(`<button class="btn" id="pr-dl">下载 ${name} ⬇</button>`);
      $('#pr-dl').onclick = () => pdfDownload(blob, name);
    }
    toast('处理完成 ✓', 'success');
  } catch (err) {
    pdfSetProg(false);
    pdfShowResult(`<div class="pr-err">⚠️ ${esc(err.message)}</div>`);
  } finally {
    btn.disabled = false;
  }
}

function fmtSize(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}


window.__toolRenderers.pdf = renderPDFTool;
})();

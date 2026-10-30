'use strict';
/* 按需加载的旅行之木模块 */
(function () {
/* ---------------- 闪卡（三区域 + 喇叭） ---------------- */
function flashCardHTML(item) {
  return `
  <div class="flash gcard" data-id="${item.id}">
    <button class="speak-btn" title="朗读"><span class="icon">🔊</span><span class="spinner"></span></button>
    <div class="region ru">
      <div class="r-label">句式</div><div class="r-body">${esc(item.russian)}</div>
    </div>
    <div class="region ex covered">
      <div class="r-label">例句</div><div class="r-body">${esc(item.notes || '— 暂无例句 —')}</div>
    </div>
    <div class="region zh covered">
      <div class="r-label">翻译</div><div class="r-body">${esc(item.chinese)}</div>
    </div>
  </div>`;
}

function wireCard(el, getText) {
  // 区域点击：切换遮盖
  el.addEventListener('click', e => {
    const r = e.target.closest('.region');
    if (r) r.classList.toggle('covered');
  });
  // 喇叭按钮：独立绑定朗读，并阻止冒泡以免误触区域遮盖
  const sp = el.querySelector('.speak-btn');
  if (sp) {
    sp.addEventListener('click', e => {
      e.stopPropagation();
      speakBtn(sp, getText());
    });
  }
}

/* ============================================================
   今日学习
   ============================================================ */
async function renderStudy() {
  const page = $('#page-study');
  const theme = S.study.theme;
  let d;
  try { d = await api('/api/plugin/russian/study/queue?theme=' + encodeURIComponent(theme)); }
  catch (e) { page.innerHTML = emptyHTML('⚠️', '加载失败', esc(e.message)); return; }
  const key = theme + '|' + JSON.stringify(d.queue.map(q => [q.item.id, q.item.russian, q.item.notes]));
  if (_pageState.study === key) return;      // 内容未变：直接复用已渲染页面
  _pageState.study = key;
  page.innerHTML = `
    <div class="gcard" style="margin-bottom:14px;">
      <div class="section-title"><span class="st-emoji">🎯</span>选择主题</div>
      <div class="pills" id="study-pills"></div>
    </div>
    <div class="flash-wrap gcard">
      <div class="flash-toolbar">
        <div class="flash-progress" id="study-progress"></div>
        <div>
          <button class="btn soft sm" id="study-recite">✨ 背诵模式</button>
          <button class="btn soft sm" id="study-reload">重新加载</button>
        </div>
      </div>
      <div id="study-card"></div>
      <div class="flash-nav">
        <button class="btn soft" id="study-prev">← 上一条</button>
        <div class="flash-counter" id="study-counter"></div>
        <button class="btn soft" id="study-next">下一条 →</button>
      </div>
    </div>`;
  $('#study-pills').innerHTML = S.themes.map(t =>
    `<button class="pill ${t.name === theme ? 'active' : ''}" data-t="${esc(t.name)}">${esc(t.name)}</button>`).join('');
  $('#study-pills').onclick = e => {
    const b = e.target.closest('.pill');
    if (b) { S.study.theme = b.dataset.t; renderStudy(); }
  };
  $('#study-reload').onclick = () => { delete _pageState.study; renderStudy(); };
  $('#study-recite').onclick = () => {
    if (!S.study.queue.length) return toast('今天没有可背诵的新学条目', 'error');
    openRecite(S.study.queue.map(q => q.item), 'study', '今日学习 · 背诵');
  };
  $('#study-prev').onclick = () => stepStudy(-1);
  $('#study-next').onclick = () => stepStudy(1);
  S.study.queue = d.queue; S.study.index = 0;
  S.study.stats = { know: 0, unknown: 0, skip: 0 };
  drawStudy();
}

function stepStudy(delta) {
  S.study.index = Math.max(0, Math.min(S.study.queue.length - 1, S.study.index + delta));
  drawStudy();
}

function drawStudy() {
  const q = S.study.queue;
  const box = $('#study-card');
  if (!q.length) {
    box.innerHTML = emptyHTML('🌸', '今天没有新学条目',
      '去「今日计划」选择主题刷新，或去「添加条目」「批量导入」补充内容。');
    $('#study-progress').textContent = '';
    $('#study-counter').textContent = '';
    return;
  }
  const item = q[S.study.index].item;
  box.innerHTML = flashCardHTML(item);
  wireCard(box, () => item.notes || item.russian);
  $('#study-progress').textContent =
    `[${item.type_label}] 学习进度 ${S.study.index + 1} / ${q.length}`;
  $('#study-counter').textContent = `${S.study.index + 1} / ${q.length}`;
}

/* ============================================================
   今日计划
   ============================================================ */
async function renderPlan() {
  const page = $('#page-plan');
  const theme = S.study.theme;
  let plan;
  try { plan = await api('/api/plugin/russian/plan?theme=' + encodeURIComponent(theme)); }
  catch (e) { page.innerHTML = emptyHTML('⚠️', '加载失败', esc(e.message)); return; }
  const key = theme + '|' + JSON.stringify([
    ['daily', 'term', 'pattern'].map(k => (plan.new[k] || []).map(i => i.tag || i.russian)),
    plan.due.map(d => [d.item.id, d.item.russian]),
  ]);
  if (_pageState.plan === key) return;
  _pageState.plan = key;
  page.innerHTML = `
    <div class="gcard" style="margin-bottom:14px;">
      <div class="section-title"><span class="st-emoji">🎯</span>选择主题</div>
      <div class="pills" id="plan-pills"></div>
    </div>
    <div class="plan-grid">
      <div class="plan-col">
        <div class="gcard">
          <div class="section-title"><span class="st-emoji">⚙️</span>每日配额</div>
          <div class="quota-bar">
            <div class="quota-item"><label>每日新学</label><input class="input" id="q-new" type="number" min="0" value="${S.settings.new_quota}"></div>
            <div class="quota-item"><label>每日复习</label><input class="input" id="q-review" type="number" min="0" value="${S.settings.review_quota}"></div>
            <button class="btn sm" id="q-save">保存</button>
          </div>
        </div>
        <div class="gcard">
          <div class="section-title"><span class="st-emoji">🌟</span>今日新学 · ${esc(theme)}</div>
          <div id="plan-new"><div class="empty" style="padding:30px;"><span class="e-icon">☁️</span>加载中…</div></div>
        </div>
      </div>
      <div class="plan-col">
        <div class="gcard">
          <div class="section-title"><span class="st-emoji">🔁</span>今日到期复习</div>
          <div class="due-list" id="plan-due"></div>
        </div>
      </div>
    </div>`;

  $('#plan-pills').innerHTML = S.themes.map(t =>
    `<button class="pill ${t.name === theme ? 'active' : ''}" data-t="${esc(t.name)}">${esc(t.name)}</button>`).join('');
  $('#plan-pills').onclick = e => {
    const b = e.target.closest('.pill');
    if (b) { S.study.theme = b.dataset.t; renderPlan(); }
  };
  $('#q-save').onclick = async () => {
    try {
      const v = await api('/api/plugin/russian/settings', { body: {
        new_quota: Math.max(0, parseInt($('#q-new').value) || 0),
        review_quota: Math.max(0, parseInt($('#q-review').value) || 0),
      }});
      S.settings = v;
      toast('配额已保存 ✓', 'success');
      renderPlan();
    } catch (e) { toast(e.message, 'error'); }
  };

  const types = [['daily', '日常用语', '#ff6f95'], ['term', '学术术语', '#b8a6e0'], ['pattern', '学术句式', '#58c9a0']];
  $('#plan-new').innerHTML = types.map(([key, label, color]) => {
    const items = plan.new[key] || [];
    return `<div class="type-block">
      <div class="type-head"><span class="type-dot" style="background:${color}"></span>
        <b>${label}</b><span class="type-count">${items.length} 条</span></div>
      <div class="item-chips">${items.length ? items.map(i =>
        `<span class="item-chip" title="${esc(i.chinese)}">${esc(i.tag || i.russian)}</span>`).join('')
        : '<span class="type-count">今日无</span>'}</div>
    </div>`;
  }).join('');

  const due = plan.due;
  $('#plan-due').innerHTML = due.length ? due.map((d, i) =>
    `<div class="due-row" data-i="${i}">
      <span class="lv lv-${d.stat.level}">${d.stat.level_label}</span>
      <span class="ru">${esc(d.item.russian)}</span>
      <span style="font-size:12px;color:var(--text-dim)">${esc(d.item.tag || '')}</span>
    </div>`).join('')
    : `<div class="empty" style="padding:26px;"><span class="e-icon">🎉</span>今日没有到期复习</div>`;
  $('#plan-due').onclick = e => {
    const row = e.target.closest('.due-row');
    if (!row) return;
    const d = due[+row.dataset.i];
    openRecite([d.item], 'review', '今日到期复习');
  };
}

/* ---------- 旅行之木（整合为通用工具之一） ---------- */
const RU_TABS = [
  ['study', '🎯 今日学习'], ['plan', '🗓️ 今日计划'], ['review', '🔄 复习'], ['add', '✏️ 添加条目'],
  ['import', '📥 批量导入'], ['kb', '🌳 知识库'], ['stats', '📊 统计'], ['all', '🗃️ 所有知识'],
];
let ruCur = null;
function ruHide() {
  if (!ruCur) return;
  const el = $('#page-' + ruCur);
  if (el && el.parentNode) { el.classList.add('hidden'); document.body.appendChild(el); }
  ruCur = null;
}
function ruShow(name) {
  ruHide();
  ruCur = name;
  const el = $('#page-' + name);
  if (!el) return;
  $('#ru-host').appendChild(el);
  el.classList.remove('hidden');
  $$('#ru-nav .pill').forEach(b => b.classList.toggle('active', b.dataset.ru === name));
  $('#page-title').textContent = NAV[name][0];
  $('#top-sub').textContent = NAV[name][1];
  S.page = name;
  const renderers = {
    study: renderStudy, plan: renderPlan, review: renderReview, add: renderAdd,
    import: renderImport, kb: renderKB, stats: renderStats, all: renderAll,
  };
  renderers[name]();
}
async function ruLoadThemes() {
  const d = await api('/api/plugin/russian/themes');
  S.themes = d.themes;
}

async function ruLoadBootstrap() {
  const b = await api('/api/plugin/russian/bootstrap');
  S.themes = b.themes;
  S.settings = { ...(S.settings || {}), ...b.settings };
  S.total = b.total; S.due_count = b.due_count;
  S.activity = b.activity; S.review_today = b.review_today;
  S.study.theme = (b.themes.find(t => t.name !== '默认') || b.themes[0] || {}).name || '';
  return b;
}

function ruUpdateTop(b) {
  const sub = $('#top-sub');
  if (sub) sub.textContent = `${b.today} · 共 ${b.total} 条知识 · 今日待复习 ${b.due_count} 条`;
}

async function ruRefreshTop() {
  try {
    const b = await api('/api/plugin/russian/bootstrap');
    S.total = b.total; S.due_count = b.due_count;
    S.activity = b.activity; S.review_today = b.review_today;
    ruUpdateTop(b);
  } catch (e) { /* 静默 */ }
}

async function renderRussianHub() {
  const box = $('#tool-view');
  box.innerHTML = '<div class="gcard" style="padding:24px;color:var(--text-dim);">正在加载学习核心…</div>';
  try {
    await ruLoadBootstrap();
  } catch (e) {
    box.innerHTML = emptyHTML('⚠️', '学习核心加载失败', esc(e.message));
    return;
  }
  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      <button class="btn soft sm" id="tool-back">← 返回工具</button>
      <div style="font-size:15px;font-weight:700;">🇷🇺 俄语单词背诵</div>
    </div>
    <div class="pills" id="ru-nav">${RU_TABS.map(([id, lb]) =>
      `<button class="pill" data-ru="${id}">${lb}</button>`).join('')}</div>
    <div id="ru-host" style="margin-top:14px;"></div>`;
  $('#ru-nav').onclick = e => {
    const b = e.target.closest('.pill');
    if (b) ruShow(b.dataset.ru);
  };
  ruShow('study');
}

/* ============================================================
   复习
   ============================================================ */
async function renderReview() {
  const page = $('#page-review');
  let d;
  try { d = await api('/api/plugin/russian/review/queue'); }
  catch (e) { page.innerHTML = emptyHTML('⚠️', '加载失败', esc(e.message)); return; }
  const key = JSON.stringify(d.queue.map(q => [q.item.id, q.item.russian, q.item.notes]));
  if (_pageState.review === key) return;
  _pageState.review = key;
  page.innerHTML = `
    <div class="flash-wrap gcard">
      <div class="flash-toolbar">
        <div class="flash-progress" id="review-progress"></div>
        <button class="btn soft sm" id="review-reload">重新加载</button>
      </div>
      <div id="review-card"></div>
      <div class="rate-row" id="review-rate" style="display:none;">
        <button class="rate-btn know">认识 ✓</button>
        <button class="rate-btn unknown">模糊 ✗</button>
        <button class="rate-btn skip">跳过 →</button>
      </div>
    </div>`;
  $('#review-reload').onclick = () => { delete _pageState.review; renderReview(); };
  S.review.queue = d.queue; S.review.index = 0;
  S.review.stats = { know: 0, unknown: 0, skip: 0 };
  drawReview();
}

function drawReview() {
  const q = S.review.queue;
  const box = $('#review-card');
  const rate = $('#review-rate');
  if (!q.length) {
    box.innerHTML = emptyHTML('🎉', '今日没有到期复习', '所有知识都在掌握中，去学习新内容吧！');
    $('#review-progress').textContent = '';
    rate.style.display = 'none';
    return;
  }
  const item = q[S.review.index].item;
  box.innerHTML = flashCardHTML(item);
  wireCard(box, () => item.notes || item.russian);
  $('#review-progress').textContent =
    `复习进度 ${S.review.index + 1} / ${q.length} · 认识 ${S.review.stats.know} / 模糊 ${S.review.stats.unknown}`;
  rate.style.display = 'flex';
}

async function rateReview(result) {
  const item = S.review.queue[S.review.index].item;
  const prevIndex = S.review.index;
  S.review.stats[result]++;
  const last = S.review.index + 1 >= S.review.queue.length;
  if (!last) { S.review.index++; drawReview(); }        // 乐观推进：先切下一张
  if (result !== 'skip') {
    try { await api('/api/plugin/russian/review/rate', { body: { id: item.id, result } }); }
    catch (e) {
      toast(e.message, 'error');
      S.review.stats[result]--;
      if (!last) { S.review.index = prevIndex; drawReview(); }   // 失败回退
    }
  }
  if (last) {
    confetti();
    toast(`🎉 本轮复习完成！认识 ${S.review.stats.know} · 模糊 ${S.review.stats.unknown} · 跳过 ${S.review.stats.skip}`, 'success', 4200);
    ruRefreshTop();
    renderReview();
  }
}

/* ============================================================
   添加条目
   ============================================================ */
function renderAdd() {
  const page = $('#page-add');
  page.innerHTML = `
    <div class="plan-grid">
      <div class="plan-col">
        <div class="gcard">
          <div class="section-title"><span class="st-emoji">✏️</span>新增知识点</div>
          <div class="m-body">
            <label class="field">句式（俄语）<input class="input" id="a-ru"></label>
            <label class="field">例句<input class="input" id="a-ex"></label>
            <label class="field">翻译（中文）<input class="input" id="a-zh"></label>
            <label class="field">主题
              <input class="input" id="a-theme" list="theme-datalist" placeholder="选择或输入新主题">
              <datalist id="theme-datalist">${S.themes.map(t => `<option value="${esc(t.name)}">`).join('')}</datalist>
            </label>
            <label class="field">标签（简短表述）<input class="input" id="a-tag"></label>
            <label class="field">类型
              <select class="input" id="a-type">
                <option value="daily">日常用语</option>
                <option value="term">学术术语</option>
                <option value="pattern">学术句式</option>
              </select>
            </label>
            <button class="btn" id="a-submit">添加 ✨</button>
          </div>
        </div>
      </div>
      <div class="plan-col">
        <div class="gcard">
          <div class="section-title"><span class="st-emoji">🏷️</span>主题管理</div>
          <div style="display:flex;gap:8px;margin-bottom:12px;">
            <input class="input" id="t-new" placeholder="新主题名" style="flex:1">
            <button class="btn sm" id="t-add">新增</button>
          </div>
          <div id="theme-list" style="display:flex;flex-direction:column;gap:8px;"></div>
        </div>
      </div>
    </div>`;

  $('#a-submit').onclick = async () => {
    const ru = $('#a-ru').value.trim(), zh = $('#a-zh').value.trim();
    if (!ru || !zh) return toast('句式与翻译不能为空', 'error');
    try {
      await api('/api/plugin/russian/items', { body: {
        russian: ru, chinese: zh,
        notes: $('#a-ex').value.trim(),
        theme: $('#a-theme').value.trim() || null,
        tag: $('#a-tag').value.trim() || null,
        item_type: $('#a-type').value,
      }});
      toast('已添加 ✓', 'success');
      ['a-ru', 'a-ex', 'a-zh', 'a-tag'].forEach(id => $('#' + id).value = '');
      await ruLoadThemes();
      renderAdd();
    } catch (e) { toast(e.message, 'error'); }
  };

  $('#t-add').onclick = async () => {
    const name = $('#t-new').value.trim();
    if (!name) return toast('主题名不能为空', 'error');
    try { await api('/api/plugin/russian/themes', { body: { name } }); toast('主题已新增 ✓', 'success'); await ruLoadThemes(); renderAdd(); }
    catch (e) { toast(e.message, 'error'); }
  };

  drawThemeList();
}

async function drawThemeList() {
  const box = $('#theme-list');
  box.innerHTML = S.themes.map(t => `
    <div class="theme-row" data-name="${esc(t.name)}">
      <span class="t-name">${esc(t.name)}</span>
      <span class="t-count">${t.item_count} 条</span>
      <select class="mini-sel" data-act="type">
        <option value="daily" ${t.default_type === 'daily' ? 'selected' : ''}>日常用语</option>
        <option value="term" ${t.default_type === 'term' ? 'selected' : ''}>学术术语</option>
        <option value="pattern" ${t.default_type === 'pattern' ? 'selected' : ''}>学术句式</option>
      </select>
      <button class="mini-btn" data-act="rename">改名</button>
      <button class="mini-btn danger" data-act="del">删除</button>
    </div>`).join('');

  box.onclick = async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const row = b.closest('.theme-row');
    const name = row.dataset.name;
    const act = b.dataset.act;
    if (act === 'rename') {
      const v = prompt('新主题名：', name);
      if (v && v.trim() && v.trim() !== name) {
        try { await api('/api/plugin/russian/themes/rename', { body: { old: name, new: v.trim() } }); toast('已改名 ✓', 'success'); await ruLoadThemes(); renderAdd(); }
        catch (e) { toast(e.message, 'error'); }
      }
    } else if (act === 'del') {
      if (name === '默认') return toast('默认主题不可删除', 'error');
      if (confirm(`删除主题「${name}」？其下知识点将归入「默认」。`)) {
        try { await api('/api/plugin/russian/themes/delete', { body: { name } }); toast('已删除，知识点已归入默认', 'success'); await ruLoadThemes(); renderAdd(); }
        catch (e) { toast(e.message, 'error'); }
      }
    }
  };
  box.onchange = async e => {
    const sel = e.target.closest('[data-act="type"]');
    if (!sel) return;
    const row = sel.closest('.theme-row');
    try {
      const r = await api('/api/plugin/russian/themes/type', { body: { name: row.dataset.name, item_type: sel.value } });
      toast(`已归并，影响 ${r.changed} 条知识`, 'success');
      await ruLoadThemes(); renderAdd();
    } catch (err) { toast(err.message, 'error'); }
  };
}

/* ============================================================
   批量导入
   ============================================================ */
function renderImport() {
  const page = $('#page-import');
  page.innerHTML = `
    <div class="gcard">
      <div class="section-title"><span class="st-emoji">📥</span>批量导入（AI 生成知识点）</div>
      <textarea class="input" id="imp-text" rows="14" style="width:100%;resize:vertical;line-height:1.7;"
        placeholder="粘贴 AI 生成的 Markdown 表格：&#10;| 句式 | 例句 | 翻译 | 主题 | 标签 |&#10;| --- | --- | --- | --- | --- |&#10;| Повторите, пожалуйста. | 请再说一遍。 | 课堂救场 | 请求重复 |"></textarea>
      <div style="display:flex;gap:10px;margin-top:12px;">
        <button class="btn soft" id="imp-preview">解析预览</button>
        <button class="btn" id="imp-go">一键导入 ✨</button>
      </div>
      <div id="imp-result" style="margin-top:14px;"></div>
    </div>`;

  $('#imp-preview').onclick = async () => {
    const text = $('#imp-text').value;
    if (!text.trim()) return toast('请先粘贴内容', 'error');
    try {
      const d = await api('/api/plugin/russian/import/preview', { body: { text } });
      let html = '';
      if (d.rows.length) {
        html += `<div class="table-wrap preview-scroll"><table class="grid">
          <thead><tr><th>句式</th><th>例句</th><th>翻译</th><th>主题</th><th>标签</th><th>类型</th></tr></thead>
          <tbody>${d.rows.map(r => `<tr>
            <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;">${esc(r.russian)}</td>
            <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;">${esc(r.notes || '')}</td>
            <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;">${esc(r.chinese)}</td>
            <td>${esc(r.theme || '')}</td>
            <td>${esc(r.tag || '')}</td><td>${esc(r.type_label)}</td></tr>`).join('')}
          </tbody></table></div>`;
        html += `<div style="margin-top:8px;font-size:13px;color:var(--text-dim);">识别到 ${d.rows.length} 条有效数据</div>`;
      }
      if (d.errors.length) {
        html += `<div class="err-box">${d.errors.map(esc).join('<br>')}</div>`;
      }
      if (!d.rows.length && !d.errors.length) html = emptyHTML('🤔', '未识别到有效内容', '请检查是否为支持的格式：Markdown 表格 / 管道文本 / JSON 数组。');
      $('#imp-result').innerHTML = html;
    } catch (e) { toast(e.message, 'error'); }
  };

  $('#imp-go').onclick = async () => {
    const text = $('#imp-text').value;
    if (!text.trim()) return toast('请先粘贴内容', 'error');
    try {
      const d = await api('/api/plugin/russian/import', { body: { text } });
      let msg = `✨ 成功导入 ${d.added} 条`;
      if (d.dup) msg += `，跳过重复 ${d.dup} 条`;
      toast(msg, 'success', 4000);
      let html = `<div style="font-size:14px;font-weight:600;">✅ 导入完成：新增 ${d.added} 条${d.dup ? `，重复跳过 ${d.dup} 条` : ''}</div>`;
      if (d.errors.length) html += `<div class="err-box">${d.errors.map(esc).join('<br>')}</div>`;
      $('#imp-result').innerHTML = html;
      await ruLoadThemes();
    } catch (e) { toast(e.message, 'error'); }
  };
}

/* ============================================================
   知识库（树）
   ============================================================ */
function treeNodeHTML(node, isItem) {
  if (isItem) {
    return `<li>
      <div class="node item" data-id="${node.id}">
        <span class="arrow"></span>
        <span class="tag-chip">${esc(node.tag || node.russian)}</span>
        <span style="color:var(--text-dim);font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(node.russian)}</span>
      </div></li>`;
  }
  const kids = node.days ? node.days : (node.types ? node.types : node.items);
  return `<li>
    <div class="node group ${node.days ? 'week' : node.types ? 'day' : 'type'} open" data-group="${esc(node.key || node.date || node.type)}">
      <span class="arrow">▶</span>
      <span class="${node.days ? '' : node.types ? 'day' : 'type'}">${esc(node.label)}</span>
      <span class="count">${kids.length}</span>
    </div>
    <ul class="branch ${node.days ? '' : ''}">
      ${(node.days || node.types || node.items).map(k =>
        node.days ? treeNodeHTML(k, false) : node.types ? treeNodeHTML(k, false) : treeNodeHTML(k, true)).join('')}
    </ul></li>`;
}

async function renderKB() {
  const page = $('#page-kb');
  let d;
  try { d = await api('/api/plugin/russian/tree'); }
  catch (e) { page.innerHTML = emptyHTML('⚠️', '加载失败', esc(e.message)); return; }
  const flat = [];
  const walk = n => (n.items ? n.items.forEach(i => flat.push([i.id, i.tag, i.russian])) : (n.days || n.types || []).forEach(walk));
  d.tree.forEach(walk);
  const key = JSON.stringify(flat);
  if (_pageState.kb === key) return;
  _pageState.kb = key;
  page.innerHTML = `
    <div class="gcard">
      <div class="section-title"><span class="st-emoji">🌳</span>知识库
        <span style="font-size:12px;color:var(--text-dim);font-weight:400;">拖曳框选批量选中 · 右键管理</span></div>
      <div class="tree" id="kb-tree"></div>
    </div>`;
  const tree = $('#kb-tree');
  S.kb.sel = new Set();
  tree.innerHTML = d.tree.length
    ? '<ul>' + d.tree.map(w => treeNodeHTML(w, false)).join('') + '</ul>'
    : emptyHTML('🌱', '知识库还是空的', '去「批量导入」或「添加条目」录入第一条知识吧。');
  wireTree(tree);
}

function wireTree(tree) {
  // 展开/收起
  tree.addEventListener('click', e => {
    const g = e.target.closest('.node.group');
    if (g) {
      g.classList.toggle('open');
      const ul = g.nextElementSibling;
      if (ul) ul.classList.toggle('closed', !g.classList.contains('open'));
    }
  });

  // 批量选中：拖曳框选 / 单击
  let drag = null, anchor = null;
  const finishSelection = e => {
    if (!drag) return;
    document.removeEventListener('mousemove', trackSelectionMove);
    document.removeEventListener('mouseup', finishSelection);
    const items = Array.from(tree.querySelectorAll('.node.item'));
    if (!drag.moved) {
      const id = +drag.start.dataset.id;
      if (e.ctrlKey || e.metaKey) {
        S.kb.sel.has(id) ? S.kb.sel.delete(id) : S.kb.sel.add(id);
      } else if (e.shiftKey && anchor != null) {
        const a = items.findIndex(n => +n.dataset.id === anchor);
        const b = items.findIndex(n => n === drag.start);
        if (a >= 0 && b >= 0) items.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(n => S.kb.sel.add(+n.dataset.id));
      } else {
        S.kb.sel = new Set([id]);
      }
      anchor = id;
    } else {
      const x1 = Math.min(drag.x, e.clientX), y1 = Math.min(drag.y, e.clientY);
      const x2 = Math.max(drag.x, e.clientX), y2 = Math.max(drag.y, e.clientY);
      S.kb.sel = new Set();
      items.forEach(n => {
        const r = n.getBoundingClientRect();
        if (r.bottom > y1 && r.top < y2 && r.right > x1 && r.left < x2) S.kb.sel.add(+n.dataset.id);
      });
    }
    drag = null;
    applyKBSelection(tree);
  };
  const trackSelectionMove = e => {
    if (!drag || drag.moved) return;
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 5) drag.moved = true;
  };
  tree.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const node = e.target.closest('.node.item');
    if (!node) return;
    drag = { start: node, x: e.clientX, y: e.clientY, moved: false };
    e.preventDefault();
    document.addEventListener('mousemove', trackSelectionMove);
    document.addEventListener('mouseup', finishSelection);
  });

  // 右键菜单
  tree.addEventListener('contextmenu', e => {
    e.preventDefault();
    const node = e.target.closest('.node.item');
    const group = e.target.closest('.node.group');
    if (node) {
      const id = +node.dataset.id;
      if (!S.kb.sel.has(id) && !(e.ctrlKey || e.metaKey)) S.kb.sel = new Set([id]);
      applyKBSelection(tree);
      showKBMenu(e.clientX, e.clientY, false);
    } else if (group) {
      // 全选该分组下的所有条目
      const ul = group.nextElementSibling;
      const ids = new Set();
      (ul ? ul.querySelectorAll('.node.item') : []).forEach(n => ids.add(+n.dataset.id));
      if (ids.size) {
        S.kb.sel = ids;
        applyKBSelection(tree);
        showKBMenu(e.clientX, e.clientY, true);
      }
    }
  });
}

function applyKBSelection(tree) {
  tree.querySelectorAll('.node.item').forEach(n => {
    n.classList.toggle('selected', S.kb.sel.has(+n.dataset.id));
  });
}

function showKBMenu(x, y, isGroup) {
  const sel = Array.from(S.kb.sel);
  const items = [];
  items.push({ label: `背诵选中（${sel.length} 条）✨`, onClick: () => startReciteByIds(sel) });
  items.push({ label: '批量删除', danger: true, onClick: () => kbDelete(sel) });
  items.push({ label: '调整归属（主题/类型）', onClick: () => openMoveModal(sel) });
  if (sel.length === 1) {
    items.push('-');
    items.push({ label: '编辑该条', onClick: () => editItemById(sel[0]) });
    items.push({ label: '复制俄语', onClick: () => copyRu(sel[0]) });
  }
  showMenu(x, y, items);
}

async function kbDelete(ids) {
  if (!confirm(`删除选中的 ${ids.length} 条知识？此操作不可恢复。`)) return;
  try {
    await api('/api/plugin/russian/items/delete', { body: { ids } });
    toast(`已删除 ${ids.length} 条`, 'success');
    renderKB();
  } catch (e) { toast(e.message, 'error'); }
}

function startReciteByIds(ids) {
  if (!ids.length) return;
  const items = collectAllItems().filter(it => ids.includes(it.id));
  if (!items.length) return toast('未找到对应条目', 'error');
  openRecite(items, 'custom', '知识库 · 选中背诵');
}

function collectAllItems() {
  // 树形接口里收集全部条目（懒加载缓存到全局）
  return S._allItemsCache || [];
}

async function editItemById(id) {
  const items = collectAllItems();
  const it = items.find(i => i.id === id);
  if (!it) return;
  openEditModal(it, () => { renderKB(); });
}

function copyRu(id) {
  const items = collectAllItems();
  const it = items.find(i => i.id === id);
  if (!it) return;
  navigator.clipboard && navigator.clipboard.writeText(it.russian).then(
    () => toast('俄语已复制 ✓'), () => toast('复制失败', 'error'));
}

function openMoveModal(ids) {
  const sel = Array.from(ids);
  const body = `
    <label class="field">目标主题
      <input class="input" id="mv-theme" list="mv-datalist" placeholder="选择或输入新主题">
      <datalist id="mv-datalist">${S.themes.map(t => `<option value="${esc(t.name)}">`).join('')}</datalist>
    </label>
    <label class="field">目标类型
      <select class="input" id="mv-type">
        <option value="">保持不变</option>
        <option value="daily">日常用语</option>
        <option value="term">学术术语</option>
        <option value="pattern">学术句式</option>
      </select>
    </label>`;
  const m = modal({ title: `调整归属（${sel.length} 条）`, body, actions: [
    { label: '取消', cls: 'soft', onClick: mask => mask.remove() },
    { label: '确定', onClick: async mask => {
      try {
        const r = await api('/api/plugin/russian/items/move', { body: {
          ids: sel,
          theme: $('#mv-theme').value.trim() || null,
          item_type: $('#mv-type').value || null,
        }});
        toast(`已调整 ${r.moved} 条 ✓`, 'success');
        mask.remove();
        await ruLoadThemes();
        renderKB();
      } catch (e) { toast(e.message, 'error'); }
    } },
  ]});
}

function openEditModal(item, cb) {
  const body = `
    <label class="field">句式（俄语）<input class="input" id="e-ru" value="${esc(item.russian)}"></label>
    <label class="field">例句<input class="input" id="e-ex" value="${esc(item.notes || '')}"></label>
    <label class="field">翻译（中文）<input class="input" id="e-zh" value="${esc(item.chinese)}"></label>
    <label class="field">主题<input class="input" id="e-theme" value="${esc(item.theme || '')}"></label>
    <label class="field">标签<input class="input" id="e-tag" value="${esc(item.tag || '')}"></label>
    <label class="field">类型
      <select class="input" id="e-type">
        <option value="daily" ${item.item_type === 'daily' ? 'selected' : ''}>日常用语</option>
        <option value="term" ${item.item_type === 'term' ? 'selected' : ''}>学术术语</option>
        <option value="pattern" ${item.item_type === 'pattern' ? 'selected' : ''}>学术句式</option>
      </select></label>`;
  modal({ title: '编辑知识点', body, actions: [
    { label: '取消', cls: 'soft', onClick: mask => mask.remove() },
    { label: '保存', onClick: async mask => {
      try {
        await api('/api/plugin/russian/items/' + item.id, { method: 'PUT', body: {
          russian: $('#e-ru').value.trim(),
          notes: $('#e-ex').value.trim(),
          chinese: $('#e-zh').value.trim(),
          theme: $('#e-theme').value.trim() || null,
          tag: $('#e-tag').value.trim() || null,
          item_type: $('#e-type').value,
        }});
        toast('已保存 ✓', 'success');
        mask.remove();
        await ruLoadThemes();
        cb && cb();
      } catch (e) { toast(e.message, 'error'); }
    } },
  ]});
}

/* ============================================================
   统计
   ============================================================ */
async function renderStats() {
  const page = $('#page-stats');
  let st, months;
  try { [st, months] = await Promise.all([api('/api/plugin/russian/stats'), api('/api/plugin/russian/stats/months')]); }
  catch (e) { page.innerHTML = emptyHTML('⚠️', '加载失败', esc(e.message)); return; }
  const key = JSON.stringify([st.total, st.activity, st.totals, st.by_level, st.by_type, months.months]);
  if (_pageState.stats === key) return;
  _pageState.stats = key;
  page.innerHTML = `
    <div class="metrics" id="st-metrics"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;">
      <div class="gcard">
        <div class="section-title"><span class="st-emoji">🧠</span>记忆档位分布</div>
        <div id="st-levels"></div>
      </div>
      <div class="gcard">
        <div class="section-title"><span class="st-emoji">📚</span>内容类型分布</div>
        <div id="st-types"></div>
      </div>
    </div>
    <div class="gcard" style="margin-top:14px;">
      <div class="section-title"><span class="st-emoji">📈</span>每日学习 / 复习</div>
      <div class="month-bar">
        <label style="font-size:13px;color:var(--text-dim);">月份</label>
        <select class="input" id="st-month"></select>
      </div>
      <div class="chart-box" id="st-chart"></div>
    </div>`;

  const m = S.statsMonth || months.months[months.months.length - 1];
  $('#st-month').innerHTML = months.months.map(x =>
    `<option value="${x}" ${x === m ? 'selected' : ''}>${x}</option>`).join('');
  $('#st-month').onchange = e => { S.statsMonth = e.target.value; drawMonthChart(S.statsMonth); };

  const act = st.activity;
  $('#st-metrics').innerHTML = `
    <div class="metric"><div class="m-num" id="m-total">0</div><div class="m-label">知识总数</div></div>
    <div class="metric"><div class="m-num" id="m-days">0</div><div class="m-label">累计学习天数</div></div>
    <div class="metric"><div class="m-num" id="m-cur">0</div><div class="m-label">当前连续天数</div></div>
    <div class="metric"><div class="m-num" id="m-long">0</div><div class="m-label">最长连续天数</div></div>
    <div class="metric"><div class="m-num" id="m-rev">0</div><div class="m-label">累计复习次数</div></div>
    <div class="metric"><div class="m-num" id="m-acc">0</div><div class="m-label">复习正确率</div></div>`;
  animateNum($('#m-total'), st.total);
  animateNum($('#m-days'), act.total_days);
  animateNum($('#m-cur'), act.current);
  animateNum($('#m-long'), act.longest);
  animateNum($('#m-rev'), st.totals.total_reviews);
  animateNum($('#m-acc'), st.totals.accuracy, '%');

  const levels = [['A', '熟', '#43c997'], ['B', '半熟', '#9cc968'], ['C', '生', '#f59e5b'], ['LONG', '长期', '#b8a6e0']];
  const maxL = Math.max(1, ...levels.map(([k]) => st.by_level[k] || 0));
  $('#st-levels').innerHTML = levels.map(([k, label, color]) => {
    const v = st.by_level[k] || 0;
    return `<div class="bar-row"><span class="bar-label">${label}</span>
      <div class="bar-track"><div class="bar-fill" data-w="${Math.round(v / maxL * 100)}" style="background:${color}"></div></div>
      <span class="bar-val">${v}</span></div>`;
  }).join('');
  requestAnimationFrame(() => $$('#st-levels .bar-fill').forEach(b => b.style.width = b.dataset.w + '%'));

  const types = [['daily', '日常用语', '#ff6f95'], ['term', '学术术语', '#b8a6e0'], ['pattern', '学术句式', '#58c9a0']];
  const maxT = Math.max(1, ...types.map(([k]) => st.by_type[k] || 0));
  $('#st-types').innerHTML = types.map(([k, label, color]) => {
    const v = st.by_type[k] || 0;
    return `<div class="bar-row"><span class="bar-label">${label}</span>
      <div class="bar-track"><div class="bar-fill" data-w="${Math.round(v / maxT * 100)}" style="background:${color}"></div></div>
      <span class="bar-val">${v}</span></div>`;
  }).join('');
  requestAnimationFrame(() => $$('#st-types .bar-fill').forEach(b => b.style.width = b.dataset.w + '%'));

  drawMonthChart(m);
}

async function drawMonthChart(month) {
  const box = $('#st-chart');
  box.innerHTML = '<div class="empty" style="padding:30px;"><span class="e-icon">☁️</span>加载中…</div>';
  try {
    const d = await api('/api/plugin/russian/stats/month?month=' + month);
    const days = d.days;
    if (!days.length) { box.innerHTML = emptyHTML('📅', '该月暂无学习记录', '去完成今天的学习与复习吧！'); return; }
    const W = 780, H = 260, padL = 42, padR = 14, padT = 22, padB = 34;
    const maxV = Math.max(1, ...days.map(x => Math.max(x.study, x.review)));
    const n = days.length;
    const x = i => padL + (W - padL - padR) * (n === 1 ? 0.5 : i / (n - 1));
    const y = v => padT + (H - padT - padB) * (1 - v / maxV);
    const line = (key, color) => {
      const pts = days.map((d, i) => `${x(i)},${y(d[key])}`).join(' ');
      const area = `${x(0)},${y(0)} ${pts} ${x(n - 1)},${y(0)}`;
      return `<polygon points="${area}" fill="${color}" opacity="0.12"></polygon>
              <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></polyline>`;
    };
    box.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
        ${[0, .5, 1].map(f => `<line x1="${padL}" y1="${y(maxV * f)}" x2="${W - padR}" y2="${y(maxV * f)}" stroke="rgba(255,111,149,.14)" stroke-dasharray="4 5"></line>`).join('')}
        ${line('study', '#58c9a0')}
        ${line('review', '#ff6f95')}
        ${days.map((d, i) => `<circle cx="${x(i)}" cy="${y(d.study)}" r="3.4" fill="#58c9a0"></circle><circle cx="${x(i)}" cy="${y(d.review)}" r="3.4" fill="#ff6f95"></circle>`).join('')}
        ${days.filter((_, i) => i % Math.max(1, Math.ceil(n / 12)) === 0).map((d, i) =>
          `<text x="${x(i)}" y="${H - 12}" text-anchor="middle" font-size="11" fill="#a08496">${d.date.slice(5)}</text>`).join('')}
        <text x="${padL}" y="${padT - 8}" font-size="11.5" fill="#a08496">${maxV}</text>
      </svg>
      <div class="legend">
        <span><i style="background:#58c9a0"></i>学习</span>
        <span><i style="background:#ff6f95"></i>复习</span>
        <span style="color:var(--text-dim)">${month}</span>
      </div>`;
  } catch (e) {
    box.innerHTML = emptyHTML('⚠️', '加载失败', esc(e.message));
  }
}

/* ============================================================
   所有知识
   ============================================================ */
async function renderAll() {
  const page = $('#page-all');
  const params = new URLSearchParams();
  if (S.all.type) params.set('type', S.all.type);
  if (S.all.theme) params.set('theme', S.all.theme);
  let d;
  try { d = await api('/api/plugin/russian/items?' + params.toString()); }
  catch (e) { page.innerHTML = emptyHTML('⚠️', '加载失败', esc(e.message)); return; }
  const key = S.all.type + '|' + S.all.theme + '|' +
    JSON.stringify(d.items.map(i => [i.id, i.theme, i.item_type, i.tag, i.stat && i.stat.level]));
  if (_pageState.all === key) return;
  S.all.visibleCount = 150;
  _pageState.all = key;
  page.innerHTML = `
    <div class="gcard">
      <div class="section-title"><span class="st-emoji">🗃️</span>所有知识</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px;">
        <div class="pills" id="all-pills">
          <button class="pill active" data-t="">全部</button>
          <button class="pill" data-t="daily">日常用语</button>
          <button class="pill" data-t="term">学术术语</button>
          <button class="pill" data-t="pattern">学术句式</button>
        </div>
        <select class="input" id="all-theme" style="width:170px;"></select>
        <button class="btn sm" id="all-recite">✨ 背诵模式（当前筛选）</button>
        <button class="btn soft sm" id="all-move">调整归属</button>
        <button class="btn danger sm" id="all-del">删除选中</button>
      </div>
      <div class="table-wrap"><table class="grid">
        <thead><tr>
          <th style="width:34px;"><input type="checkbox" id="all-checkall"></th>
          <th>句式</th><th>例句</th><th>翻译</th><th>类型</th><th>主题</th><th>标签</th><th>档位</th>
        </tr></thead>
        <tbody id="all-body"></tbody>
      </table></div>
      <div id="all-more" style="display:flex;justify-content:center;margin-top:10px;"></div>
    </div>`;

  $('#all-theme').innerHTML = '<option value="">全部主题</option>' +
    S.themes.map(t => `<option value="${esc(t.name)}">${esc(t.name)}</option>`).join('');

  $('#all-pills').onclick = e => {
    const b = e.target.closest('.pill');
    if (!b) return;
    $$('#all-pills .pill').forEach(p => p.classList.remove('active'));
    b.classList.add('active');
    S.all.type = b.dataset.t;
    renderAll();
  };
  $('#all-theme').value = S.all.theme;
  $('#all-theme').onchange = e => { S.all.theme = e.target.value; renderAll(); };
  $('#all-checkall').onchange = e => {
    S.all.sel = e.target.checked ? new Set(S.all.items.map(i => i.id)) : new Set();
    drawAllBody();
  };
  $('#all-recite').onclick = () => {
    if (!S.all.items.length) return toast('当前筛选下没有知识', 'error');
    openRecite(S.all.items, 'custom', `背诵 · ${S.all.type ? '类型筛选' : '全部'}`);
  };
  $('#all-del').onclick = () => {
    if (!S.all.sel.size) return toast('请先勾选要删除的条目', 'error');
    if (!confirm(`删除选中的 ${S.all.sel.size} 条知识？`)) return;
    api('/api/plugin/russian/items/delete', { body: { ids: Array.from(S.all.sel) } }).then(() => {
      toast('已删除 ✓', 'success'); ruLoadThemes(); renderAll();
    }).catch(e => toast(e.message, 'error'));
  };
  $('#all-move').onclick = () => {
    if (!S.all.sel.size) return toast('请先勾选条目', 'error');
    openMoveModal(Array.from(S.all.sel));
  };

  S.all.items = d.items;
  const itemIds = new Set(d.items.map(i => i.id));
  S.all.sel = new Set(Array.from(S.all.sel).filter(id => itemIds.has(id)));
  drawAllBody();
}

function drawAllBody() {
  const items = S.all.items;
  const body = $('#all-body');
  if (!items.length) {
    body.innerHTML = `<tr><td colspan="8">${emptyHTML('🌱', '暂无知识', '去「批量导入」或「添加条目」录入吧。')}</td></tr>`;
    $('#all-more').innerHTML = '';
    return;
  }
  const limit = Math.min(items.length, Math.max(150, S.all.visibleCount || 150));
  const shown = items.slice(0, limit);
  body.innerHTML = shown.map(it => `
    <tr data-id="${it.id}" class="${S.all.sel.has(it.id) ? 'selected' : ''}">
      <td><input type="checkbox" data-id="${it.id}" ${S.all.sel.has(it.id) ? 'checked' : ''}></td>
      <td style="max-width:230px;overflow:hidden;text-overflow:ellipsis;font-weight:600;">${esc(it.russian)}</td>
      <td style="max-width:230px;overflow:hidden;text-overflow:ellipsis;color:#7a6579;">${esc(it.notes || '')}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;">${esc(it.chinese)}</td>
      <td>${esc(it.type_label)}</td>
      <td>${esc(it.theme || '')}</td>
      <td><span class="tag-chip">${esc(it.tag || '')}</span></td>
      <td>${it.stat ? `<span class="lv lv-${it.stat.level}" style="padding:2px 9px;border-radius:999px;color:#fff;font-size:12px;">${it.stat.level_label}</span>` : ''}</td>
    </tr>`).join('');
  const more = $('#all-more');
  if (more) {
    const remaining = items.length - limit;
    more.innerHTML = remaining > 0
      ? `<button class="btn soft sm" id="all-load-more">加载更多（还有 ${remaining} 条）</button>`
      : `<span class="fin-note">已显示全部 ${items.length} 条</span>`;
    const btn = $('#all-load-more');
    if (btn) btn.onclick = () => { S.all.visibleCount = limit + 150; drawAllBody(); };
  }

  body.onclick = e => {
    const cb = e.target.closest('input[type=checkbox]');
    const tr = e.target.closest('tr');
    if (!tr) return;
    const id = +tr.dataset.id;
    if (cb) {
      cb.checked ? S.all.sel.add(id) : S.all.sel.delete(id);
    } else if (e.ctrlKey || e.metaKey) {
      S.all.sel.has(id) ? S.all.sel.delete(id) : S.all.sel.add(id);
    } else {
      S.all.sel = new Set([id]);
    }
    drawAllBody();
  };
  body.ondblclick = e => {
    const tr = e.target.closest('tr');
    if (!tr) return;
    const it = items.find(i => i.id === +tr.dataset.id);
    if (it) openEditModal(it, () => { ruLoadThemes(); renderAll(); });
  };
  body.oncontextmenu = e => {
    e.preventDefault();
    const tr = e.target.closest('tr');
    if (!tr) return;
    const it = items.find(i => i.id === +tr.dataset.id);
    if (!it) return;
    if (!S.all.sel.has(it.id)) S.all.sel = new Set([it.id]);
    drawAllBody();
    const menu = [
      { label: '编辑', onClick: () => openEditModal(it, () => { ruLoadThemes(); renderAll(); }) },
      { label: `背诵该主题（${it.theme || '默认'}）✨`, onClick: () => {
        const themed = items.filter(x => (x.theme || '默认') === (it.theme || '默认'));
        openRecite(themed, 'custom', `背诵 · ${it.theme || '默认'}`);
      } },
      { label: '调整归属', onClick: () => openMoveModal([it.id]) },
      { label: '删除', danger: true, onClick: () => {
        if (!confirm('删除该条知识？')) return;
        api('/api/plugin/russian/items/delete', { body: { ids: [it.id] } }).then(() => { toast('已删除', 'success'); ruLoadThemes(); renderAll(); }).catch(e => toast(e.message, 'error'));
      } },
    ];
    showMenu(e.clientX, e.clientY, menu);
  };
}

/* ============================================================
   背诵模式浮层
   ============================================================ */
function openRecite(items, mode, title) {
  S.recite = { queue: items, index: 0, stats: { know: 0, unknown: 0, skip: 0 }, mode, title };
  renderRecite();
}

function renderRecite() {
  const r = S.recite;
  const root = $('#recite-root');
  const item = r.queue[r.index];
  root.innerHTML = `
    <div class="recite-mask">
      <div class="recite gcard">
        <div class="recite-head">
          <div class="flash-progress">${esc(r.title)} · ${r.index + 1} / ${r.queue.length}</div>
          <button class="recite-close" id="recite-close">✕</button>
        </div>
        <div id="recite-card"></div>
        <div class="rate-row">
          <button class="rate-btn know">认识 ✓</button>
          <button class="rate-btn unknown">模糊 ✗</button>
          <button class="rate-btn skip">跳过 →</button>
        </div>
      </div>
    </div>`;
  $('#recite-card').innerHTML = flashCardHTML(item);
  wireCard($('#recite-card'), () => item.notes || item.russian);
  $('#recite-close').onclick = () => { root.innerHTML = ''; S.recite = null; };
  const rate = async result => {
    const it = r.queue[r.index];
    const prevIndex = r.index;
    r.stats[result]++;
    const last = r.index + 1 >= r.queue.length;
    if (!last) { r.index++; renderRecite(); }          // 乐观推进：先切下一张（即时反馈）
    if (result !== 'skip') {
      try { await api('/api/plugin/russian/study/rate', { body: { id: it.id, result } }); }
      catch (e) {
        toast('评级保存失败：' + e.message, 'error');
        r.stats[result]--;
        if (!last) { r.index = prevIndex; renderRecite(); }   // 失败回退上一张
      }
    }
    if (last) {
      root.innerHTML = '';
      S.recite = null;
      confetti();
      toast(`🎉「${r.title}」完成！认识 ${r.stats.know} · 模糊 ${r.stats.unknown} · 跳过 ${r.stats.skip}`, 'success', 4600);
      ruRefreshTop();
      if (r.mode === 'study') renderStudy();
      else if (r.mode === 'review') renderReview();
      else if (r.mode === 'custom') { ruLoadThemes(); if (S.page === 'kb') renderKB(); else renderAll(); }
    }
  };
  root.querySelector('.rate-btn.know').onclick = () => rate('know');
  root.querySelector('.rate-btn.unknown').onclick = () => rate('unknown');
  root.querySelector('.rate-btn.skip').onclick = () => rate('skip');
}


window.__toolRenderers.russian = renderRussianHub;
window.__learningRenderers = { study: renderStudy, plan: renderPlan, review: renderReview, add: renderAdd, import: renderImport, kb: renderKB, stats: renderStats, all: renderAll };
})();

'use strict';
/* 按需加载的功能模块：rivet */
(function () {
  let ROOT = null;
/* ============================================================
   铆钉点（长期任务打卡 · 数据统计 / 循序渐进 / 模式记录 / 强激励）
   调研 2026-10：GitHub 高星（Habitica 13.9K RPG化 / uHabits 9.6K 习惯强度衰减）
   与优秀产品（多邻国 streak+冻结+赢回 / Anchor Loop Tiny→Challenge 循序渐进
   / init.Habits 护盾 / Habitap 反完美主义周目标 / everyday 像素可视化）
   ============================================================ */
const RV_DIFF_LABEL = { tiny: '微步', easy: '轻松', standard: '标准', challenge: '挑战' };
const RV_DIFF_XP = { tiny: 1, easy: 2, standard: 3, challenge: 5 };
const RV_PRAISE = ['铆钉已钉入，纹丝不动 ✓', '又稳了一天 🔩', '坚持就是铆力 💪', '今日完成，墙又厚一层 🧱', '漂亮，继续保持！', '扎实。记录在案。'];
const RV_WEEK = ['一', '二', '三', '四', '五', '六', '日'];
const RV_MILESTONE = { 7: '七日之锚', 30: '月铆', 100: '百日铆', 365: '年轮铆' };
let RV = null;                 // 后端数据缓存
let rvHeatOpen = {};           // { habitId: true } 展开单习惯热力图

function renderRivetTool(container) {
  ROOT = container;
  const box = ROOT;
  box.innerHTML = `
    <div class="gcard" style="margin-bottom:14px;">
      <div class="section-title"><span class="st-emoji">🔩</span>铆钉点
        <span style="font-size:12px;color:var(--text-dim);font-weight:400;">长期任务打卡 · 一颗颗钉进去，直到成为习惯</span>
        <button class="btn sm" id="rv-add" style="margin-left:auto;">＋ 新增铆钉</button>
      </div>
      <div id="rv-top" style="min-height:80px;">加载中…</div>
    </div>
    <div class="gcard"><div id="rv-body" style="min-height:60px;"></div></div>
    <div class="rv-overlay" id="rv-overlay">
      <div class="rv-card" id="rv-form"></div>
    </div>`;
  $('#rv-add').onclick = () => rvOpenForm(null);
  $('#rv-overlay').onclick = e => { if (e.target === $('#rv-overlay')) rvCloseForm(); };
  rvRefresh();
}

async function rvRefresh() {
  const d = await rvLoad();
  if (!d || !d.ok) {
    $('#rv-top').innerHTML = '<div style="color:#b04a5a;">加载失败：' + esc((d && d.error) || '无响应') + '</div>';
    return;
  }
  RV = d;
  $('#rv-top').innerHTML = rvTopHTML(d);
  $('#rv-body').innerHTML = rvBodyHTML(d);
  rvWire();
}

function rvLoad() { return apiPost('/api/plugin/rivet/data', {}); }

/* ---------- 总览：等级 / 今日 / 最长连续 / 累计 + 全局热力图 + 徽章 ---------- */
function rvTopHTML(d) {
  const lv = d.level || { level: 1, xp: 0, need_next: 10, progress: 0 };
  const badges = (d.badges || []).map(b => `
    <span class="rv-badge${b.unlocked ? '' : ' lock'}" title="${b.days} 天里程碑${b.unlocked ? '' : '（未解锁）'}">
      ${b.unlocked ? '🏅' : '🔒'} ${b.name}</span>`).join('');
  return `
    <div class="metrics" style="margin-bottom:14px;">
      <div class="metric">
        <div class="m-num">Lv.${lv.level}</div>
        <div class="m-label">铆值 ${lv.xp} / ${lv.need_next}</div>
        <div style="height:5px;border-radius:3px;background:var(--accent-soft);margin-top:4px;">
          <div style="height:5px;border-radius:3px;width:${lv.progress}%;background:var(--accent);"></div></div>
      </div>
      <div class="metric"><div class="m-num">${d.today_done}</div><div class="m-label">今日钉入</div></div>
      <div class="metric"><div class="m-num">${d.longest_streak}</div><div class="m-label">最长连续</div></div>
      <div class="metric"><div class="m-num">${d.total_checkins}</div><div class="m-label">累计钉入</div></div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">${badges}</div>
    ${rvHeatHTML(d.heatmap || [], { global: true })}
    <div class="rv-legend">少 ${[0, 1, 2, 3, 4].map(i =>
      `<span class="rv-g${i}"></span>`).join('')} 多</div>`;
}

/* ---------- 习惯列表 ---------- */
function rvBodyHTML(d) {
  const list = d.habits || [];
  if (!list.length) {
    return `<div style="color:var(--text-dim);padding:10px 2px;">还没有铆钉点。点击上方「＋ 新增铆钉」创建第一个长期任务，例如「每日俄语学习」。</div>`;
  }
  return list.map(h => rvHabitCard(h, d)).join('');
}

function rvHabitCard(h, d) {
  const done = h.done_today;
  const tgt = (h.mode === 'weekly' && h.weekly_target) ? h.weekly_target : (h.mode === 'daily' ? 7 : 0);
  const wk = d.weekly.find(w => w.id === h.id);
  const weekDone = wk ? wk.done : 0;
  const weekPct = tgt ? Math.min(100, Math.round(weekDone / tgt * 100)) : 0;
  const diffColor = { tiny: 'var(--text-dim)', easy: '#8ab4f8', standard: '#f8a34c', challenge: '#e05263' }[h.difficulty] || 'var(--text-dim)';
  const wd = h.weekday || {};
  const wdBars = RV_WEEK.map((w, i) => {
    const r = (wd[i] && wd[i].rate) || 0;
    return `<span class="rv-wd" title="周${w} · 完成率 ${r}%${wd[i] ? '（' + wd[i].done + '/' + wd[i].total + '天）' : ''}"
      style="background:${r === 0 ? 'rgba(127,127,127,.12)' : `rgba(93,151,255,${0.25 + r / 100 * 0.75})`}">${w}</span>`;
  }).join('');
  const sugg = [];
  if (h.suggest_up) sugg.push(`连续 ${h.streak} 天，建议升级到「${RV_DIFF_LABEL[rvNextDiff(h.difficulty)]}」难度（+XP）`);
  if (h.suggest_down) sugg.push('近 5 日跳过较多，可考虑降到「微步」降低压力');
  const suggBar = sugg.length ? `<div class="rv-sugg">${sugg.map(s =>
    `<span>💡 ${s}</span>`).join('')}</div>` : '';
  const open = rvHeatOpen[h.id];
  return `
    <div class="rv-habit" style="border-left:4px solid ${h.color};">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:22px;">${h.icon || '🔩'}</span>
        <span style="font-weight:700;font-size:15px;">${esc(h.name)}</span>
        <span class="rv-diff" style="color:${diffColor};border-color:${diffColor}55;">${h.difficulty_label}</span>
        <span class="rv-flame" style="color:${h.streak_color};">
          🔥 ${h.streak} 天${h.streak >= 7 ? ' · 最长 ' + h.longest : ''}</span>
        <div style="margin-left:auto;display:flex;gap:6px;align-items:center;">
          <button class="btn soft sm" data-op="edit">✏️ 编辑</button>
          <button class="btn soft sm danger-soft" data-op="del">🗑</button>
        </div>
      </div>
      ${tgt ? `<div style="margin-top:6px;font-size:12px;color:var(--text-dim);">本周 ${weekDone}/${tgt}
        <span style="display:inline-block;width:120px;height:6px;border-radius:3px;background:var(--accent-soft);vertical-align:middle;">
          <span style="display:inline-block;height:6px;border-radius:3px;width:${weekPct}%;background:${h.color};"></span></span></div>` : ''}
      ${suggBar}
      <div style="display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap;">
        <button class="btn rv-btn${done ? ' done' : ''}" data-op="check" data-id="${h.id}"
          style="${done ? 'background:' + h.color + ';color:#fff;' : ''}">
          ${done ? '✓ 今日已钉' : '🔩 钉入今日'}</button>
        <button class="btn soft sm" data-op="shield" data-id="${h.id}">🛡️ 补卡（${h.shield}）</button>
        <span style="font-size:12px;color:var(--text-dim);">强度 ${h.strength}</span>
        <span style="font-size:12px;color:var(--text-dim);">周 ${h.rate_week}%</span>
        <span style="font-size:12px;color:var(--text-dim);">月 ${h.rate_month}%</span>
        <span style="font-size:12px;color:var(--text-dim);">总 ${h.rate_all}%</span>
        <span style="font-size:12px;color:var(--text-dim);">铆值 ${h.xp}</span>
      </div>
      <div style="margin-top:8px;">${wdBars}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
        <span style="font-size:12px;color:var(--text-dim);">今日备注</span>
        <input class="input rv-note" data-id="${h.id}" value="${esc(h.today_note || '')}"
          placeholder="${done ? '记一笔：状态 / 环境 / 心得…' : '先钉入今日，再写备注'}" ${done ? '' : 'disabled'}>
        <button class="btn soft sm" data-op="heat" data-id="${h.id}">${open ? '▾ 收起热力图' : '▸ 热力图'}</button>
      </div>
      ${open ? `<div style="margin-top:10px;">${rvHeatHTML(h.heatmap || [], { habit: h })}</div>` : ''}
    </div>`;
}

function rvNextDiff(cur) {
  return ['tiny', 'easy', 'standard', 'challenge'][Math.min(3, ['tiny', 'easy', 'standard', 'challenge'].indexOf(cur) + 1)];
}

/* ---------- GitHub 风格热力图（内联样式 · 不依赖外部类） ---------- */
function rvHeatHTML(heat, opts) {
  const global = opts.global;
  const color = (opts.habit && opts.habit.color) || '#4e8cff';
  const today = new Date();
  const todayK = fmtDate(today);
  const start = new Date(today);
  start.setDate(start.getDate() - (53 * 7 - 1));
  // 对齐到周一：从 start 往前推到周一
  while ((start.getDay() + 6) % 7 !== 0) start.setDate(start.getDate() - 1);
  const weeks = [];
  for (let w = new Date(start); w <= today; w.setDate(w.getDate() + 7)) {
    const wk = [];
    for (let i = 0; i < 7; i++) { const dd = new Date(w); dd.setDate(w.getDate() + i); wk.push(dd); }
    weeks.push(wk);
  }
  const countOf = {};
  (heat || []).forEach(c => { countOf[c.date] = c; });
  const gLevel = n => n <= 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4;
  const gCols = ['rgba(127,127,127,.12)', 'rgba(93,151,255,.35)', 'rgba(93,151,255,.6)', 'rgba(93,151,255,.8)', '#5d97ff'];
  const hDiffA = { tiny: .5, easy: .68, standard: .85, challenge: 1 };
  const monthCols = weeks.map(wk => {
    const m = wk.find(dd => dd.getDate() === 1);
    return m ? m.getMonth() + 1 : null;
  });
  let html = `<div class="rv-hm-scroll"><div class="rv-hm" style="grid-template-columns:26px repeat(${weeks.length},11px);">`;
  monthCols.forEach((m, i) => { if (m) html += `<div class="rv-hm-month" style="grid-column:${i + 2}">${m}月</div>`; });
  weeks.forEach((wk, i) => wk.forEach((dd, r) => {
    const k = fmtDate(dd);
    const isFuture = dd > today;
    const info = countOf[k];
    let bg, tip;
    if (global) {
      const n = isFuture ? 0 : (info ? info.count : 0);
      bg = gCols[gLevel(n)];
      tip = `${dd.getMonth() + 1}月${dd.getDate()}日 · ${n > 0 ? '完成 ' + n + ' 项' : '未打卡'}`;
    } else {
      const done = !isFuture && info && info.count > 0;
      bg = done ? color.replace('#', '') : 'rgba(127,127,127,.12)';
      if (done) {
        const a = hDiffA[info.diff] || .8;
        bg = `rgba(${parseInt(color.slice(1, 3), 16)},${parseInt(color.slice(3, 5), 16)},${parseInt(color.slice(5, 7), 16)},${a})`;
      }
      tip = `${dd.getMonth() + 1}月${dd.getDate()}日 · ${done ? '已钉入（' + (RV_DIFF_LABEL[info.diff] || '') + '）' : '未打卡'}`;
    }
    if (i === 0 && (r === 0 || r === 2 || r === 4)) {
      html += `<div class="rv-hm-dow" style="grid-column:1;grid-row:${r + 2}">${['一', '三', '五'][r === 0 ? 0 : r === 2 ? 1 : 2]}</div>`;
    }
    const hl = (!isFuture && k === todayK) ? 'outline:1.5px solid var(--accent);outline-offset:-1px;' : '';
    html += `<div class="rv-hm-cell" style="grid-column:${i + 2};grid-row:${r + 2};background:${bg};${hl}" title="${esc(tip)}"></div>`;
  }));
  html += '</div></div>';
  return html;
}

/* ---------- 事件绑定 ---------- */
function rvWire() {
  const body = $('#rv-body');
  body.onclick = async e => {
    const op = e.target.closest('[data-op]');
    if (!op) return;
    const id = op.dataset.id;
    if (op.dataset.op === 'check') {
      op.disabled = true;
      const r = await apiPost('/api/plugin/rivet/checkin', { id });
      if (r && r.ok) {
        const praise = RV_PRAISE[Math.floor(Math.random() * RV_PRAISE.length)];
        toast((r.undone ? '已撤销今日钉入' : praise) + (r.xp ? `（+${r.xp} 铆值）` : '') + (r.message ? ' ' + r.message : ''), r.undone ? 'info' : 'success');
      } else {
        toast('操作失败：' + esc((r && r.error) || '未知'), 'warn');
      }
      rvRefresh();
    } else if (op.dataset.op === 'shield') {
      if (!confirm('消耗 1 个护盾补回最近 7 天的空缺日（保连续）？当前护盾：' + (RV.habits.find(h => h.id === id) || {}).shield)) return;
      const r = await apiPost('/api/plugin/rivet/checkin', { id, use_shield: true });
      toast(r && r.ok ? (r.message || '补卡成功') : '补卡失败：' + esc((r && r.error) || ''), r && r.ok ? 'success' : 'warn');
      rvRefresh();
    } else if (op.dataset.op === 'edit') {
      rvOpenForm(RV.habits.find(h => h.id === id) || null);
    } else if (op.dataset.op === 'del') {
      const h = RV.habits.find(x => x.id === id);
      if (!confirm('删除「' + h.name + '」？其全部打卡记录将一并移除。')) return;
      const r = await apiPost('/api/plugin/rivet/habit/delete', { id });
      toast(r && r.ok ? '已删除' : '删除失败：' + esc((r && r.error) || ''), r && r.ok ? 'success' : 'warn');
      rvRefresh();
    } else if (op.dataset.op === 'heat') {
      rvHeatOpen[id] = !rvHeatOpen[id];
      rvRefresh();
    }
  };
  // 备注：change 时保存
  $$('#rv-body .rv-note').forEach(inp => {
    inp.onchange = async () => {
      const r = await apiPost('/api/plugin/rivet/note', { id: inp.dataset.id, note: inp.value });
      if (!r || !r.ok) toast('备注保存失败：' + esc((r && r.error) || ''), 'warn');
    };
  });
}

/* ---------- 新增 / 编辑表单 ---------- */
function rvOpenForm(h) {
  const ov = $('#rv-overlay');
  const mode = h ? h.mode : 'daily';
  const days = h ? (h.days || []) : [];
  const weekDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(k =>
    `<label class="rv-check"><input type="checkbox" value="${k}" ${days.includes(k) ? 'checked' : ''}> ${RV_WEEK[['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(k)]}</label>`).join('');
  $('#rv-form').innerHTML = `
    <div class="rv-card-title">${h ? '编辑铆钉' : '新增铆钉'}</div>
    <label class="rv-lb">名称</label>
    <input class="input" id="rvf-name" value="${esc(h ? h.name : '')}" placeholder="如：每日俄语学习" maxlength="30">
    <div style="display:flex;gap:10px;margin-top:8px;">
      <div style="flex:1;">
        <label class="rv-lb">图标（emoji）</label>
        <input class="input" id="rvf-icon" value="${esc(h ? h.icon : '🔩')}" maxlength="2">
      </div>
      <div style="flex:1;">
        <label class="rv-lb">主题色</label>
        <input type="color" id="rvf-color" value="${h ? h.color : '#4e8cff'}" style="width:100%;height:36px;border:1px solid var(--border);border-radius:8px;background:var(--card);">
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:8px;">
      <div style="flex:1;">
        <label class="rv-lb">模式</label>
        <select class="input" id="rvf-mode">
          <option value="daily" ${mode === 'daily' ? 'selected' : ''}>每日</option>
          <option value="weekly" ${mode === 'weekly' ? 'selected' : ''}>每周 N 次</option>
          <option value="custom" ${mode === 'custom' ? 'selected' : ''}>指定星期</option>
        </select>
      </div>
      <div style="flex:1;">
        <label class="rv-lb">每周目标次数</label>
        <input class="input" type="number" id="rvf-target" min="1" max="7" value="${h && h.weekly_target ? h.weekly_target : 5}">
      </div>
    </div>
    <div id="rvf-days" style="display:${mode === 'custom' ? 'flex' : 'none'};gap:8px;margin-top:8px;flex-wrap:wrap;">${weekDays}</div>
    <div style="display:flex;gap:10px;margin-top:8px;">
      <div style="flex:1;">
        <label class="rv-lb">难度（循序渐进）</label>
        <select class="input" id="rvf-diff">
          ${['tiny', 'easy', 'standard', 'challenge'].map(k =>
            `<option value="${k}" ${(h ? h.difficulty : 'tiny') === k ? 'selected' : ''}>${RV_DIFF_LABEL[k]} · +${RV_DIFF_XP[k]} 铆值</option>`).join('')}
        </select>
      </div>
    </div>
    <label class="rv-lb" style="margin-top:8px;">备注 / 配方（可选）</label>
    <textarea class="input rv-ta" id="rvf-note" rows="2" placeholder="例如：After 早饭后，读 10 分钟">${esc(h ? (h.note || '') : '')}</textarea>
    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="btn" id="rvf-save">${h ? '保存修改 ✓' : '创建铆钉 ✓'}</button>
      <button class="btn soft" id="rvf-cancel">取消</button>
    </div>
    <div style="font-size:12px;color:var(--text-dim);margin-top:10px;">循序：连续 7 天可升一档（微步→轻松→标准→挑战），跳过过多会提示降档 · 连续每 7 天奖励 1 护盾，护盾可补卡保连续</div>`;
  $('#rvf-mode').onchange = () => {
    $('#rvf-days').style.display = $('#rvf-mode').value === 'custom' ? 'flex' : 'none';
  };
  $('#rvf-save').onclick = async () => {
    const name = $('#rvf-name').value.trim();
    if (!name) return toast('请输入名称', 'warn');
    const days = Array.from($$('#rvf-days input:checked')).map(x => x.value);
    const r = await apiPost('/api/plugin/rivet/habit/save', {
      habit: {
        id: h ? h.id : undefined, name, icon: $('#rvf-icon').value.trim() || '🔩',
        color: $('#rvf-color').value, mode: $('#rvf-mode').value,
        weekly_target: parseInt($('#rvf-target').value) || 5,
        days, difficulty: $('#rvf-diff').value, note: $('#rvf-note').value,
      },
    });
    toast(r && r.ok ? '已保存 ✓' : '保存失败：' + esc((r && r.error) || ''), r && r.ok ? 'success' : 'warn');
    if (r && r.ok) { rvCloseForm(); rvRefresh(); }
  };
  $('#rvf-cancel').onclick = rvCloseForm;
  ov.classList.add('show');
  setTimeout(() => $('#rvf-name').focus(), 60);
}

function rvCloseForm() {
  $('#rv-overlay').classList.remove('show');
}


window.__toolRenderers.rivet = renderRivetTool;
})();

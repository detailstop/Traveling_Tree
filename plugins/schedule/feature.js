'use strict';
/* 按需加载的功能模块：schedule */
(function () {
  let ROOT = null;
const SCHEDULE_YEAR = new Date().getFullYear();
let weekStore = {};
let weekLoaded = false;
const DONE_KEY = 'rt_done_log';    // { 'YYYY-MM-DD': 当日完成条数 }
const WP_DAYS = [['mon', '周一'], ['tue', '周二'], ['wed', '周三'], ['thu', '周四'], ['fri', '周五'], ['sat', '周六'], ['sun', '周日']];

function weekRangeKey(offset) { return fmtDate(mondayOf(offset)); }
function weekDateAt(dayIdx, offset) {
  const mon = mondayOf(offset);
  const d = new Date(mon);
  d.setDate(mon.getDate() + dayIdx);
  return d;
}
function dayDateOf(dayKey, offset = S.sched.weekOffset) {
  return fmtDate(weekDateAt(WP_DAYS.findIndex(x => x[0] === dayKey), offset));
}
function normalizeWeekStore(input) {
  let st = (input && typeof input === 'object') ? input : {};
  // 迁移旧「浮动周」格式 {mon:[...], sun:[...]} → 归入上一周（旧数据属于过去，不再污染本周）
  const oldish = Object.keys(st).some(k => WP_DAYS.some(([dk]) => dk === k));
  if (oldish) {
    st = { [weekRangeKey(-1)]: st };
  }
  // 兼容 v1 字段对象 {a, b, note} → 条目数组
  // 第一遍：收集已有 id 的顺延副本「内容 → id」（保证同一条顺延链各天副本 id 一致）
  const keyOfIt = it => it.t + '\u0001' + (it.note || '');
  const rollIdMap = new Map();
  Object.keys(st).forEach(wk => {
    const pp = st[wk];
    if (pp && typeof pp === 'object') WP_DAYS.forEach(([k]) => {
      const aa = pp[k];
      if (Array.isArray(aa)) aa.forEach(it => { if (it.roll && it.id) { const kk = keyOfIt(it); if (!rollIdMap.has(kk)) rollIdMap.set(kk, it.id); } });
    });
  });
  Object.keys(st).forEach(wk => {
    const p = st[wk];
    if (p && typeof p === 'object') {
      let changed = false;
      WP_DAYS.forEach(([k]) => {
        const v = p[k];
        if (v && !Array.isArray(v) && typeof v === 'object') {
          const items = [];
          if (v.a) items.push({ t: v.a, note: v.note || '', done: false });
          if (v.b) items.push({ t: v.b, note: '', done: false });
          p[k] = items; changed = true;
        }
        const arr = p[k];
        if (Array.isArray(arr)) arr.forEach(it => {
          if (!it.id) {
            const kk = keyOfIt(it);
            if (it.roll) {
              if (!rollIdMap.has(kk)) rollIdMap.set(kk, 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
              it.id = rollIdMap.get(kk);   // 同一条顺延链所有副本共享同一 id（防完成同步失效）
            } else {
              it.id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
            }
            changed = true;
          }
        });
      });
      if (changed) weekStore = st;
    }
  });
  return st;
}
async function ensureWeekStore() {
  if (weekLoaded) return;
  const d = await api('/api/plugin/schedule/state');
  const raw = d && d.state;
  weekStore = normalizeWeekStore(raw);
  weekLoaded = true;
}
function loadWeekStore() { return weekStore; }
function saveWeekStore(st) {
  weekStore = st;
  api('/api/plugin/schedule/state', { method: 'PUT', body: { state: st } }).catch(() => {});
}
function loadWeekPlan(offset = S.sched.weekOffset) {
  return loadWeekStore()[weekRangeKey(offset)] || {};
}
function saveWeekPlan(plan, offset = S.sched.weekOffset) {
  const st = loadWeekStore();
  st[weekRangeKey(offset)] = plan;
  saveWeekStore(st);
}
function loadDoneLog() {
  let log = loadJSON(DONE_KEY, {});
  if (!Object.keys(log).length) {                            // 承接旧「按天打卡」数据
    const old = loadJSON('rt_checkin', {});
    const ks = Object.keys(old);
    if (ks.length) { ks.forEach(k => log[k] = 1); localStorage.setItem(DONE_KEY, JSON.stringify(log)); }
  }
  return log;
}
function bumpDone(date, d) {
  const log = loadDoneLog();
  log[date] = Math.max(0, (log[date] || 0) + d);
  localStorage.setItem(DONE_KEY, JSON.stringify(log));
}

/* ---------- 计划表 · 顺延 / 常驻 ---------- */
const INJ_KEY = 'rt_plan_injected';   // { 'YYYY-MM-DD': true } 常驻注入标记（尊重删除）
function parseDateKey(wk) {
  const [y, m, d] = wk.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function weekOffsetOf(wk) {
  const base = parseDateKey(fmtDate(mondayOf(0)));
  return Math.round((parseDateKey(wk) - base) / 86400000 / 7);
}
function applyRollover() {
  // 顺延：把「过去未完成且其顺延链最新副本未完成的任务」复制到今日（同名去重，不重复累积）
  // 完成仅当天生效：勾选最新一天完成后，该链不再顺延（历史天保持未完成显示）
  const st = loadWeekStore();
  const keyOf = it => it.t + '\u0001' + (it.note || '');
  // 收集每条顺延链「日期最大副本」的完成状态（有 id 用 id，无 id 旧副本用内容键）
  const latest = new Map();
  Object.keys(st).forEach(wk => {
    const off = weekOffsetOf(wk);
    const p = st[wk] || {};
    WP_DAYS.forEach(([k], i) => {
      const d = weekDateAt(i, off).getTime();
      (p[k] || []).forEach(it => {
        if (!it.roll) return;
        const kk = it.id || keyOf(it);
        const cur = latest.get(kk);
        if (!cur || d > cur.date) latest.set(kk, { date: d, done: !!it.done });
      });
    });
  });
  const plan = loadWeekPlan(0);
  const today = new Date();
  const todayKey = WP_DAYS[(today.getDay() + 6) % 7][0];
  const arr = plan[todayKey] || [];
  let changed = false;
  Object.keys(st).forEach(wk => {
    const off = weekOffsetOf(wk);
    const p = st[wk] || {};
    WP_DAYS.forEach(([k], i) => {
      const d = weekDateAt(i, off);
      if (d.getTime() >= today.getTime()) return;   // 只看过去
      (p[k] || []).forEach(it => {
        if (!it.roll) return;
        const kk = it.id || keyOf(it);
        const lk = latest.get(kk);
        if (lk && lk.done) return;                  // 链上最新副本已完成 → 整链不再顺延
        const dup = x => x.roll && (x.id ? x.id === it.id : x.t === it.t && (x.note || '') === (it.note || ''));
        if (!arr.some(dup)) {
          arr.push({ id: it.id, t: it.t, note: it.note || '', done: false, roll: true });
          changed = true;
        }
      });
    });
  });
  if (changed) { plan[todayKey] = arr; saveWeekPlan(plan, 0); }
}
function ensureRecurring(plan, offset) {
  // 常驻：把全局常驻模板补到「今天及未来」的每一天（当天只注入一次，用户删除后不再复活）
  const st = loadWeekStore();
  const tmpls = []; const seen = new Set();
  Object.keys(st).forEach(wk => {
    const p = st[wk] || {};
    WP_DAYS.forEach(([k]) => (p[k] || []).forEach(it => {
      if (it.rep) {
        const key = it.t + '\u0001' + (it.note || '');
        if (!seen.has(key)) { seen.add(key); tmpls.push({ t: it.t, note: it.note || '', rep: true }); }
      }
    }));
  });
  if (!tmpls.length) return plan;
  const inj = loadJSON(INJ_KEY, {});
  const todayS = fmtDate(new Date());
  let changed = false, injChanged = false;
  WP_DAYS.forEach(([k], i) => {
    const dk = fmtDate(weekDateAt(i, offset));
    if (dk < todayS) return;                 // 不追溯注入历史
    if (inj[dk]) return;                     // 该天已注入过
    const arr = plan[k] || [];
    const have = new Set(arr.map(x => x.t));
    let dayChanged = false;
    tmpls.forEach(t => { if (!have.has(t.t)) { arr.push({ t: t.t, note: t.note || '', done: false, rep: true }); dayChanged = true; } });
    if (dayChanged) { plan[k] = arr; inj[dk] = true; injChanged = true; changed = true; }
  });
  if (injChanged) localStorage.setItem(INJ_KEY, JSON.stringify(inj));
  if (changed) saveWeekPlan(plan, offset);
  return plan;
}
function syncPlanChainDone(id) {
  // 历史遗留：全链同步完成。当前顺延语义已改为「完成仅当天生效、链上最新副本决定是否顺延」，不再被调用（保留定义防误用）
  const st = loadWeekStore();
  Object.keys(st).forEach(wk => {
    const p = st[wk] || {};
    WP_DAYS.forEach(([k]) => (p[k] || []).forEach(x => { if (x.id === id) x.done = true; }));
  });
  saveWeekStore(st);
}
function delRollChain(id) {
  // 删除整条顺延链：所有周中同 id 任务一并移除（含已生成的副本）
  const st = loadWeekStore();
  Object.keys(st).forEach(wk => {
    const p = st[wk] || {};
    WP_DAYS.forEach(([k]) => {
      const arr = p[k];
      if (Array.isArray(arr)) {
        const keep = arr.filter(x => !x.id || x.id !== id || x.done);  // 保留已完成
        if (keep.length !== arr.length) p[k] = keep;
      }
    });
  });
  saveWeekStore(st);
}
function killRollChain(id) {
  // 终止同名顺延链（所有周中同 id roll 任务取消顺延）
  const st = loadWeekStore();
  Object.keys(st).forEach(wk => {
    const p = st[wk] || {};
    WP_DAYS.forEach(([k]) => (p[k] || []).forEach(x => { if (x.roll && x.id === id) x.roll = false; }));
  });
  saveWeekStore(st);
}

/* ---------------- 计划表（通用 · 自由增删 · 逐条打卡） ---------------- */
async function renderScheduleView(container) {
  ROOT = container;
  const box = ROOT;
  try { await ensureWeekStore(); }
  catch (e) { box.innerHTML = emptyHTML('⚠️', '计划表加载失败', esc(e.message)); return; }
  box.innerHTML = `
    <div class="gcard" style="margin-bottom:14px;">
      <div class="section-title"><span class="st-emoji">🗓️</span>周计划表
        <span style="font-size:12px;color:var(--text-dim);font-weight:400;">按真实日期分周 · 可切换周 · 往期计划保留 · 逐条打卡</span></div>
      <div class="wp-nav" id="wp-nav"></div>
      <div id="wp-today" style="margin-bottom:10px;"></div>
      <div id="wp-box"></div>
      <div style="display:flex;gap:10px;margin-top:12px;">
        <button class="btn soft" id="wp-reset">清空该周</button>
      </div>
    </div>
    <div class="gcard">
      <div class="section-title"><span class="st-emoji">🔥</span>年度打卡热力图
        <span style="font-size:12px;color:var(--text-dim);font-weight:400;">${SCHEDULE_YEAR} 年 · GitHub 贡献图风格 · 颜色越深当日完成越多</span></div>
      <div class="metrics" id="hm-chips" style="margin-bottom:14px;"></div>
      <div id="hm-box"></div>
      <div class="hm-legend">少
        <span class="hm-cell"></span>
        <span class="hm-cell l1"></span>
        <span class="hm-cell l2"></span>
        <span class="hm-cell l3"></span>
        <span class="hm-cell l4"></span> 多
      </div>
    </div>
    <div class="pi-overlay" id="pi-overlay">
      <div class="pi-card">
        <div class="pi-card-title" id="pi-title">新增计划</div>
        <label class="pi-lb">计划内容</label>
        <input class="input" id="pi-t" placeholder="如：写周报" maxlength="40">
        <label class="pi-lb">备注</label>
        <textarea class="input pi-ta" id="pi-note" rows="3" placeholder="补充说明…"></textarea>
        <label class="pi-check"><input type="checkbox" id="pi-done"> 已完成</label>
        <label class="pi-check"><input type="checkbox" id="pi-roll"> ↻ 未完成自动顺延到次日</label>
        <label class="pi-check"><input type="checkbox" id="pi-rep"> 🔁 每天自动常驻（当天可删 · 次日重现）</label>
        <div style="display:flex;gap:10px;margin-top:14px;">
          <button class="btn" id="pi-save">保存 ✓</button>
          <button class="btn danger-soft" id="pi-del" style="display:none;">删除</button>
          <button class="btn soft" id="pi-cancel">取消</button>
        </div>
      </div>
    </div>`;
  bindPlanEvents();
  drawCheckinHeatmap();
  drawWeekPlan();
  $('#wp-reset').onclick = () => {
    if (!confirm('清空该周全部计划？')) return;
    saveWeekPlan({});
    drawWeekPlan(); drawCheckinHeatmap();
  };
}

let piDay = null, piIdx = null;

function bindPlanEvents() {
  $('#pi-overlay').onclick = e => { if (e.target === $('#pi-overlay')) closePlanEditor(); };
  $('#pi-save').onclick = savePlanEditor;
  $('#pi-del').onclick = delPlanItem;
  $('#pi-cancel').onclick = closePlanEditor;
  $('#pi-overlay').onkeydown = e => {
    if (e.key === 'Enter' && e.target === $('#pi-t')) savePlanEditor();
    if (e.key === 'Escape') closePlanEditor();
  };
}
function closePlanEditor() {
  $('#pi-overlay').classList.remove('show');
  piDay = piIdx = null;
}
function openPlanEditor(day, idx) {
  const plan = loadWeekPlan();
  const it = idx != null ? (plan[day] || [])[idx] : null;
  piDay = day; piIdx = idx;
  const date = weekDateAt(WP_DAYS.findIndex(x => x[0] === day), S.sched.weekOffset);
  $('#pi-title').textContent = it ? '计划详情' : `新增计划（${WP_DAYS.find(x => x[0] === day)[1]} ${date.getMonth() + 1}/${date.getDate()}）`;
  $('#pi-t').value = it ? it.t : '';
  $('#pi-note').value = it ? (it.note || '') : '';
  $('#pi-done').checked = it ? !!it.done : false;
  $('#pi-roll').checked = it ? !!it.roll : false;
  $('#pi-rep').checked = it ? !!it.rep : false;
  $('#pi-del').style.display = it ? '' : 'none';
  $('#pi-overlay').classList.add('show');
  setTimeout(() => $('#pi-t').focus(), 60);
}
function savePlanEditor() {
  const t = $('#pi-t').value.trim();
  if (!t) { toast('计划内容不能为空', 'warn'); return; }
  const note = $('#pi-note').value.trim();
  const done = $('#pi-done').checked;
  const roll = $('#pi-roll').checked;
  const rep = $('#pi-rep').checked;
  const plan = loadWeekPlan();
  plan[piDay] = plan[piDay] || [];
  if (piIdx == null) {
    plan[piDay].push({ id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), t, note, done, roll, rep });
    if (done) bumpDone(dayDateOf(piDay), +1);
  } else {
    const it = plan[piDay][piIdx];
    const was = !!it.done;
    it.t = t; it.note = note; it.done = done; it.roll = roll; it.rep = rep;
    if (was !== done) bumpDone(dayDateOf(piDay), done ? +1 : -1);
  }
  saveWeekPlan(plan);
  closePlanEditor();
  drawWeekPlan(); drawCheckinHeatmap();
  toast('已保存 ✓', 'success');
}
function delPlanItem() {
  const plan = loadWeekPlan();
  const arr = plan[piDay] || [];
  const it = arr[piIdx];
  if (!it) return;
  const wasDone = !!it.done;
  const isRoll = !!it.roll;
  if (!isRoll) {
    if (wasDone) bumpDone(dayDateOf(piDay), -1);
    arr.splice(piIdx, 1);
    if (!arr.length) delete plan[piDay];
    saveWeekPlan(plan);
  } else {
    // 顺延任务：删当前天这条（无论完成与否）+ 同 id 未完成副本；
    // 其他天的已完成历史保留，但终止顺延（roll=false）
    const st = loadWeekStore();
    const wkKey = weekRangeKey(S.sched.weekOffset);
    Object.keys(st).forEach(wk => {
      const p = st[wk] || {};
      WP_DAYS.forEach(([k]) => {
        const aa = p[k];
        if (!Array.isArray(aa)) return;
        const keep = aa.filter(x => {
          if (!x.id || x.id !== it.id) return true;
          if (x.done && !(wk === wkKey && k === piDay)) { x.roll = false; return true; }
          return false;
        });
        if (keep.length !== aa.length) p[k] = keep;
      });
    });
    saveWeekStore(st);
    if (wasDone) bumpDone(dayDateOf(piDay), -1);
  }
  closePlanEditor();
  drawWeekPlan(); drawCheckinHeatmap();
  toast('已删除' + (isRoll ? '（顺延链已清理）' : ''), 'info');
}
function toggleItem(day, idx) {
  const plan = loadWeekPlan();
  const it = plan[day][idx];
  it.done = !it.done;
  bumpDone(dayDateOf(day), it.done ? +1 : -1);
  saveWeekPlan(plan);
  drawWeekPlan(); drawCheckinHeatmap();
}

let _planTip = null;
function showPlanTip(el, note) {
  hidePlanTip();
  _planTip = document.createElement('div');
  _planTip.className = 'plan-tip';
  _planTip.textContent = note;
  document.body.appendChild(_planTip);
  const r = el.getBoundingClientRect();
  _planTip.style.left = Math.max(12, r.left + r.width / 2 - 130) + 'px';
  _planTip.style.top = Math.max(12, r.top - 12) + 'px';
  _planTip.style.transform = 'translateY(-100%)';
  setTimeout(() => _planTip && _planTip.classList.add('on'), 10);
}
function hidePlanTip() { if (_planTip) { _planTip.remove(); _planTip = null; } }
function drawWeekPlan() {
  const offset = S.sched.weekOffset;
  applyRollover();                              // 顺延：未完成项自动落到今日
  let plan = loadWeekPlan(offset);
  plan = ensureRecurring(plan, offset);         // 常驻：渲染周自动补模板
  const todayIdx = (new Date().getDay() + 6) % 7;
  const todayKey = WP_DAYS[todayIdx][0];
  const mon = mondayOf(offset), sun = weekDateAt(6, offset);
  const isThis = offset === 0;
  const today = new Date();
  const fmtRange = `${mon.getFullYear()}年${mon.getMonth() + 1}月${mon.getDate()}日 – ${sun.getMonth() + 1}月${sun.getDate()}日`;
  $('#wp-nav').innerHTML = `
    <button class="btn soft sm" id="wp-prev">◀ 上一周</button>
    <div class="wp-range${isThis ? ' cur' : ''}">${isThis ? '本周 · ' : ''}${fmtRange}</div>
    <button class="btn soft sm" id="wp-next">下一周 ▶</button>
    ${!isThis ? '<button class="btn soft sm" id="wp-back">返回本周</button>' : ''}`;
  $('#wp-prev').onclick = e => { e.stopPropagation(); S.sched.weekOffset--; drawWeekPlan(); };
  $('#wp-next').onclick = e => { e.stopPropagation(); S.sched.weekOffset++; drawWeekPlan(); };
  const back = $('#wp-back');
  if (back) back.onclick = () => { S.sched.weekOffset = 0; drawWeekPlan(); };

  // 今日摘要：始终对应真实今天所在周的当天（含顺延与常驻）
  const tPlan = ensureRecurring(loadWeekPlan(0), 0);
  const todayItems = tPlan[todayKey] || [];
  const doneN = todayItems.filter(x => x.done).length;
  $('#wp-today').innerHTML =
    `<div style="font-size:13px;font-weight:600;color:var(--accent);background:var(--accent-soft);border-radius:10px;padding:8px 12px;">
      📌 今日（${today.getMonth() + 1}月${today.getDate()}日 ${WP_DAYS[todayIdx][1]}）：${todayItems.length
        ? `${doneN}/${todayItems.length} 条已完成` + (doneN ? ' · ' + todayItems.filter(x => x.done).map(x => esc(x.t)).join('、') : ' · 继续加油')
        : '暂无计划，点击 ＋ 添加'}</div>`;
  $('#wp-box').innerHTML = WP_DAYS.map(([k, label], i) => {
    const items = plan[k] || [];
    const d = weekDateAt(i, offset);
    const cls = isThis && i === todayIdx ? ' today' : '';
    return `<div class="wp-row${cls}">
      <span class="wp-day">${label} <b>${d.getMonth() + 1}/${d.getDate()}</b></span>
      <div class="wp-strip">
        ${items.map((it, j) => `
          <div class="pi${it.done ? ' done' : ''}" data-day="${k}" data-i="${j}" ${it.note ? 'data-note="' + esc(it.note) + '"' : ''} title="点击编辑 / 加备注">
            <button class="pi-done">✓</button>
            <span class="pi-text">${esc(it.t)}</span>
            ${it.roll ? '<span class="pi-badge">↻</span>' : ''}
            ${it.rep ? '<span class="pi-badge rep">🔁</span>' : ''}
            ${it.note ? '<span class="pi-note">📝</span>' : ''}
          </div>`).join('')}
        <button class="pi-add" data-day="${k}">＋ 添加</button>
      </div>
    </div>`;
  }).join('');
  $('#wp-box').onclick = e => {
    const addBtn = e.target.closest('.pi-add');
    if (addBtn) { openPlanEditor(addBtn.dataset.day, null); return; }
    const chip = e.target.closest('.pi');
    if (!chip) return;
    const day = chip.dataset.day, i = +chip.dataset.i;
    if (e.target.closest('.pi-done')) toggleItem(day, i);
    else openPlanEditor(day, i);
  };
  $('#wp-box').onmouseover = e => {
    const chip = e.target.closest('.pi');
    if (chip && chip.dataset.note) showPlanTip(chip, chip.dataset.note);
  };
  $('#wp-box').onmouseout = e => { if (e.target.closest('.pi')) hidePlanTip(); };
}

function countDoneByDate() {
  // 实时统计：遍历计划全量，按真实日期汇总各日已完成条数（与界面勾选完全同步，不依赖增量日志）
  const st = loadWeekStore();
  const m = {};
  Object.keys(st).forEach(wk => {
    const off = weekOffsetOf(wk);
    const p = st[wk] || {};
    WP_DAYS.forEach(([k], i) => {
      const dk = fmtDate(weekDateAt(i, off));
      (p[k] || []).forEach(it => { if (it.done) m[dk] = (m[dk] || 0) + 1; });
    });
  });
  return m;
}
function drawCheckinHeatmap() {
  const log = countDoneByDate();
  const today = new Date();
  const d1 = new Date(SCHEDULE_YEAR, 11, 31);
  // 每日「有完成记录」的连续天数 → 格子强度（模仿 GitHub 贡献图）
  const streakOf = {};
  let streak = 0;
  for (let d = new Date(SCHEDULE_YEAR, 0, 1); d <= d1; d.setDate(d.getDate() + 1)) {
    const k = fmtDate(d);
    streak = (log[k] || 0) > 0 ? streak + 1 : 0;
    streakOf[k] = streak;
  }
  const level = n => n === 0 ? '' : n === 1 ? ' l1' : n === 2 ? ' l2' : n <= 4 ? ' l3' : ' l4';
  const first = new Date(SCHEDULE_YEAR, 0, 1);
  first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const weeks = [];
  for (let w = new Date(first); w <= d1; w.setDate(w.getDate() + 7)) {
    const wk = [];
    for (let i = 0; i < 7; i++) { const d = new Date(w); d.setDate(w.getDate() + i); wk.push(d); }
    weeks.push(wk);
  }
  const monthCols = weeks.map(wk => wk.some(d => d.getDate() === 1) ? (wk.find(d => d.getDate() === 1).getMonth() + 1) : null);

  const yearDays = Object.keys(log).filter(k => k.startsWith(String(SCHEDULE_YEAR)) && log[k] > 0).length;
  let best = 0;
  Object.values(streakOf).forEach(s => best = Math.max(best, s));
  const monthKey = fmtDate(today).slice(0, 7);
  const monthDays = Object.keys(log).filter(k => k.startsWith(monthKey) && log[k] > 0).length;
  const todayN = log[fmtDate(today)] || 0;
  $('#hm-chips').innerHTML = `
    <div class="metric"><div class="m-num">${yearDays}</div><div class="m-label">本年打卡天数</div></div>
    <div class="metric"><div class="m-num">${best}</div><div class="m-label">最长连续天数</div></div>
    <div class="metric"><div class="m-num">${monthDays}</div><div class="m-label">本月打卡天数</div></div>
    <div class="metric"><div class="m-num">${todayN}</div><div class="m-label">今日完成条数</div></div>`;

  let html = '<div class="hm-scroll"><div class="hm" style="grid-template-columns:26px repeat(' + weeks.length + ',11px);">';
  monthCols.forEach((m, i) => { if (m) html += `<div class="hm-month" style="grid-column:${i + 2}">${m}月</div>`; });
  weeks.forEach((wk, i) => wk.forEach((d, r) => {
    const k = fmtDate(d);
    const isFuture = d > today || d.getFullYear() !== SCHEDULE_YEAR;
    const n = isFuture ? 0 : (log[k] || 0);
    const lvl = level(n);
    const off = isFuture ? ' off' : '';
    const tip = `${d.getMonth() + 1}月${d.getDate()}日 · ${n > 0 ? '完成 ' + n + ' 条' : '未完成'}`;
    if (i === 0 && (r === 0 || r === 2 || r === 4)) {
      html += `<div class="hm-dow" style="grid-column:1;grid-row:${r + 2}">${['一', '三', '五'][r === 0 ? 0 : r === 2 ? 1 : 2]}</div>`;
    }
    html += `<div class="hm-cell${lvl}${off}" style="grid-column:${i + 2};grid-row:${r + 2}" title="${esc(tip)}"></div>`;
  }));
  html += '</div></div>';
  $('#hm-box').innerHTML = html;
}


window.__toolRenderers.schedule = renderScheduleView;
})();

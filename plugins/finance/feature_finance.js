'use strict';
import * as FIN_SHARED from './shared.js';
/* 按需加载的功能模块：finance */
(function () {
  let ROOT = null;
const AI_PROVIDERS = [
  { id: 'deepseek', icon: '🪷', label: 'DeepSeek', defaultModel: 'deepseek-chat', hint: 'platform.deepseek.com 注册，sk- 开头' },
  { id: 'kimi', icon: '🧠', label: 'Kimi', defaultModel: 'kimi-k2.6', hint: 'platform.moonshot.cn 注册，sk- 开头；可用模型以账户授权为准（如 kimi-k2.6 / kimi-k2.7-code）' },
  { id: 'doubao', icon: '🫧', label: '豆包', defaultModel: 'doubao-seed-evolving', hint: '火山方舟控制台创建 API Key（ark- 开头）' },
];
/* ============================================================
   记账本（本地单机 · 日频快照 · 多账户/多币种/资产负债）
   ============================================================ */
const FIN_CHART_PREFS_KEY = FIN_SHARED.FIN_CHART_PREFS_KEY;
const FIN_SETTINGS_COLLAPSED_KEY = 'rt_fin_settings_collapsed';
function finChartPrefs() {
  try {
    const v = JSON.parse(localStorage.getItem(FIN_CHART_PREFS_KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch (e) { return {}; }
}
function finSaveChartPrefs() {
  try {
    localStorage.setItem(FIN_CHART_PREFS_KEY, JSON.stringify({
      curve: { mode: S.fin.curve.mode, fit: S.fin.curve.fit, forecast: S.fin.curve.forecast },
      fxhist: { mode: S.fin.fxhist.mode, fit: S.fin.fxhist.fit, forecast: S.fin.fxhist.forecast },
    }));
  } catch (e) { /* 忽略配额 */ }
}
const FIN_ACCT_TYPES = [['cash', '现金'], ['bank', '银行卡'], ['wallet', '电子钱包'], ['broker', '券商'], ['pension', '退休金'], ['fund', '公积金'], ['receivable', '应收(借出)'], ['other', '其他']];
const FIN_LIAB_KINDS = [['loan', '贷款'], ['credit', '信用卡'], ['friend', '亲友借款'], ['payable', '应付']];
const FIN_REAL_CATS = [['house', '房产'], ['car', '车辆'], ['metal', '贵金属'], ['jewel', '珠宝'], ['collect', '收藏'], ['equip', '设备']];
const FIN_TAX = { CNY: '¥', RUB: '₽', USD: '$', EUR: '€' };
function finDefault() {
  return {
    base: 'CNY',
    fx: { CNY: 1, RUB: 0.074, USD: 7.2, EUR: 7.8 },  // 1 外币 = x 本位币（1元≈13.5卢布）
    fxDate: null,                                      // 官方汇率最近更新时间
    goals: 0,                                          // 净资产目标（本位币）
    accounts: [], liabs: [], reals: [],
    acctGroups: [{ id: 'ungrouped', name: '未分组' }],
    acctTypes: [],
    inv: { accounts: [], holdings: [], notes: [] },
    snaps: [],
  };
}
let FIN_CACHE = null;
let FIN_SAVE_TIMER = null;
let FIN_SAVE_BUSY = false;

function finApplyDefaults(d) {
  if (!d || !Array.isArray(d.accounts)) d = finDefault();
  if (!d.fx || !d.fx[d.base]) d.fx = finDefault().fx;
  if (!d.inv) d.inv = finDefault().inv;
  if (d.goals == null) d.goals = 0;
  if (!d.snaps) d.snaps = [];
  if (!d.acctGroups || !Array.isArray(d.acctGroups)) d.acctGroups = [{ id: 'ungrouped', name: '未分组' }];
  if (!d.acctTypes || !Array.isArray(d.acctTypes)) d.acctTypes = [];
  if (d.fxDate == null) d.fxDate = null;
  if (!d.fxHist || typeof d.fxHist !== 'object') d.fxHist = {};
  if (d.inv && d.inv.holdings) d.inv.holdings.forEach(finSyncHolding);
  if (!d.inv.noteGroups || !Array.isArray(d.inv.noteGroups)) d.inv.noteGroups = [];
  if (!d.reasons || !Array.isArray(d.reasons)) d.reasons = ['日常支出', '理财收益', '固定工资'];
  try {
    const c = JSON.parse(localStorage.getItem(FIN_SETTINGS_COLLAPSED_KEY) || 'null');
    if (c && typeof c === 'object') d.settingsCollapsed = { ...(d.settingsCollapsed || {}), ...c };
  } catch (e) { /* 忽略损坏的旧 UI 状态 */ }
  return d;
}

function loadFin() {
  if (!FIN_CACHE) FIN_CACHE = finApplyDefaults(finDefault());
  return FIN_CACHE;
}

let FIN_CONTENT = null;
let FIN_CONTENT_SAVE = Promise.resolve();
const FIN_CONTENT_KEYS = {
  factor: 'rt_fq_factor_lib', datasets: 'rt_fq_datasets', fundnav: 'rt_fundnav',
  funddata: 'rt_funddata', excl: 'rt_fq_excl', layers: 'rt_fqlayers',
};
async function finContentFetch() {
  if (FIN_CONTENT) return FIN_CONTENT;
  const resp = await fetch('/api/plugin/finance/content-state', { cache: 'no-store' });
  const out = await resp.json().catch(() => ({}));
  const a = (resp.ok && out.ok && out.assets) ? out.assets : {};
  FIN_CONTENT = {
    rt_fq_factor_lib: a.rt_fq_factor_lib || {},
    rt_fq_datasets: a.rt_fq_datasets || {},
    rt_fundnav: a.rt_fundnav || { products: [] },
    rt_funddata: a.rt_funddata || { groups: [], items: [] },
    rt_fq_excl: a.rt_fq_excl || {},
    rt_fqlayers: a.rt_fqlayers || a.rt_fq_layers || {},
  };
  return FIN_CONTENT;
}
function finContentGet(key) { return (FIN_CONTENT && FIN_CONTENT[key]) || null; }
function finContentSet(key, value) {
  if (!FIN_CONTENT) FIN_CONTENT = {};
  FIN_CONTENT[key] = value;
  const snapshot = JSON.parse(JSON.stringify(value));
  FIN_CONTENT_SAVE = FIN_CONTENT_SAVE
    .then(() => fetch('/api/plugin/finance/content-state', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assets: { [key]: snapshot } }),
    }))
    .catch(() => {});
}

async function finFetchState() {
  const resp = await fetch('/api/plugin/finance/state', { cache: 'no-store' });
  const out = await resp.json().catch(() => ({}));
  if (!resp.ok || !out.ok || !out.state) throw new Error(out.error || ('HTTP ' + resp.status));
  FIN_CACHE = finApplyDefaults(out.state);
  await finContentFetch();
  return FIN_CACHE;
}

async function finPersist() {
  if (FIN_SAVE_BUSY) {
    FIN_SAVE_TIMER = setTimeout(finPersist, 120);
    return;
  }
  FIN_SAVE_BUSY = true;
  try {
    const resp = await fetch('/api/plugin/finance/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: FIN_CACHE }),
    });
    const out = await resp.json().catch(() => ({}));
    if (!resp.ok || !out.ok) throw new Error(out.error || ('HTTP ' + resp.status));
    if (out.state) FIN_CACHE = finApplyDefaults(out.state);
  } catch (e) {
    if (typeof toast === 'function') toast('记账数据保存失败：' + e.message, 'error', 5000);
  } finally {
    FIN_SAVE_BUSY = false;
  }
}

function saveFin(d) {
  FIN_CACHE = d;
  try {
    localStorage.setItem(FIN_SETTINGS_COLLAPSED_KEY, JSON.stringify(d.settingsCollapsed || {}));
  } catch (e) { /* 忽略配额 */ }
  if (FIN_SAVE_TIMER) clearTimeout(FIN_SAVE_TIMER);
  FIN_SAVE_TIMER = setTimeout(finPersist, 80);
}
function finToBase(d, amt, cur) { return (amt || 0) * (d.fx[cur] != null ? d.fx[cur] : 1); }
function finPct(n) {
  const abs = Math.abs(n);
  if (abs >= 100) return n.toFixed(0);
  if (abs >= 10) return n.toFixed(1);
  if (abs >= 1) return n.toFixed(2);
  if (abs >= 0.1) return n.toFixed(3);
  return n.toFixed(4);
}
function finStartDate(h) {
  if (h.lots && h.lots.length && h.lots[0].date) return h.lots[0].date;
  if (h.vals && h.vals.length && h.vals[0].date) return h.vals[0].date;
  return h.date || fmtDate(new Date());
}
function finEarliest(hs) { let m = null; hs.forEach(h => { const t = finStartDate(h); if (!m || t < m) m = t; }); return m; }
function finAnnualPct(d, costBase, valBase, startDate) {
  if (!costBase || costBase <= 0) return null;
  const d0 = new Date(String(startDate).replace(/-/g, '/') + ' 00:00:00');
  if (isNaN(d0.getTime())) return null;
  const days = Math.max(1, (Date.now() - d0.getTime()) / 86400000);
  const r = valBase / costBase;
  return (Math.pow(r, 365 / days) - 1) * 100;
}
function finFmt(n, cur) {
  const neg = n < 0;
  const s = Math.abs(n).toFixed(2);
  return (neg ? '-' : '') + (FIN_TAX[cur] || cur + ' ') + s;
}
function finCalc(d) {
  if (d.inv && d.inv.holdings) d.inv.holdings.forEach(finSyncHolding);
  // 理财账户：余额以挂靠持仓市值合计为准；未挂靠持仓单独计入投资（避免重复记账）
  const holdingSum = {};
  let inv = 0;
  d.inv.holdings.forEach(h => {
    const v = finToBase(d, h.value, h.cur);
    if (h.acctId) holdingSum[h.acctId] = (holdingSum[h.acctId] || 0) + v;
    else inv += v;
  });
  let fin = 0;
  d.accounts.forEach(a => {
    if (holdingSum[a.id] != null) { fin += holdingSum[a.id]; return; }
    fin += finToBase(d, a.balance, a.cur);
  });
  const real = d.reals.reduce((s, a) => s + finToBase(d, a.value, a.cur), 0);
  const liab = d.liabs.reduce((s, l) => s + finToBase(d, l.remain, l.cur), 0);
  return { fin, real, inv, liab, total: fin + real + inv, net: fin + real + inv - liab };
}
function finSaveSnap(d, mode, totalA, totalL, note, whys, vals) {
  const c = finCalc(d);
  const date = fmtDate(new Date());
  const prev = d.snaps.length ? d.snaps[d.snaps.length - 1] : null;
  const acctVals = {};
  d.accounts.forEach(a => {
    const input = vals && vals[a.id] != null ? parseFloat(vals[a.id]) : null;
    acctVals[a.id] = input != null && isFinite(input) ? input : (finAcctHoldings(d, a.id).length ? finAcctInvRaw(d, a.id) : a.balance);
  });
  const acctBase = d.accounts.reduce((sum, a) => sum + Math.round(finToBase(d, acctVals[a.id], a.cur) * 100) / 100, 0);
  const detailFin = Math.round(acctBase * 100) / 100;
  const detailNet = Math.round((detailFin + c.real + c.inv - c.liab) * 100) / 100;
  const detailTa = Math.round((detailFin + c.real + c.inv) * 100) / 100;
  const net = mode === 'quick' ? (totalA - totalL) : detailNet;
  const ta = mode === 'quick' ? totalA : detailTa;
  const tl = mode === 'quick' ? totalL : c.liab;
  const snap = { date, mode, ta, tl, net, fin: mode === 'quick' ? c.fin : detailFin, real: c.real, inv: c.inv, liab: c.liab, fx: { ...d.fx }, note: note || '',
    accts: d.accounts.map(a => { const w = whys && whys[a.id]; const b = { id: a.id, name: a.name, cur: a.cur, val: acctVals[a.id], base: Math.round(finToBase(d, acctVals[a.id], a.cur) * 100) / 100 }; if (w) b.why = w; return b; }) };
  const i = d.snaps.findIndex(x => x.date === date);
  if (i >= 0) d.snaps[i] = snap; else d.snaps.push(snap);
  d.snaps.sort((a, b) => a.date < b.date ? -1 : 1);
  saveFin(d);
  return { snap, prev, c };
}
function finAttributionParts(prev, snap) {
  const EPS = 0.005; // 分位精度：正常小额变动不能被 0.5 阈值丢掉
  const out = {};
  const add = (k, v) => { if (Math.abs(v) > EPS) out[k] = (out[k] || 0) + v; };
  const prevMap = {};
  (prev.accts || []).forEach(a => prevMap[a.id] = a);
  (snap.accts || []).forEach(a => {
    const p = prevMap[a.id];
    const fxT = snap.fx && snap.fx[a.cur] != null ? snap.fx[a.cur] : 1;
    const fxP = p && prev.fx && prev.fx[a.cur] != null ? prev.fx[a.cur] : fxT;
    const vT = a.val || 0, vP = p ? (p.val || 0) : 0;
    const baseT = Number.isFinite(Number(a.base)) ? Number(a.base) : vT * fxT;
    const baseP = p && Number.isFinite(Number(p.base)) ? Number(p.base) : vP * fxP;
    const dBase = baseT - baseP;
    if (Math.abs(dBase) <= EPS) return;
    const origWhy = a.why || (!p ? '新增账户' : '日常变动');   // 兜底归因：手动指定优先，首日默认新增账户
    const exch = vP * (fxT - fxP);                            // 汇率自动贡献（首日 vP=0 → 0）
    const balBase = dBase - exch;                             // 兜底池（余额贡献，可被细节划走）
    const subs = (a.subs || []).filter(s2 => Math.abs(s2.v) > EPS);
    const subSum = subs.reduce((s2, x) => s2 + x.v, 0);
    const fallback = balBase - subSum;                        // 自动兜底：剩余金额归原归因，保证细分完备
    if (Math.abs(exch) > EPS) add('汇率变动', exch);
    subs.forEach(s2 => add(s2.why, s2.v));
    if (Math.abs(fallback) > EPS) add(origWhy, fallback);
  });
  // 已消失账户的资产减少是真实变动，单独归因。
  const currentIds = new Set((snap.accts || []).map(a => a.id));
  (prev.accts || []).forEach(p => {
    if (currentIds.has(p.id)) return;
    const fxP = prev.fx && prev.fx[p.cur] != null ? prev.fx[p.cur] : 1;
    const base = Number.isFinite(Number(p.base)) ? Number(p.base) : (p.val || 0) * fxP;
    if (Math.abs(base) > EPS) add('账户移除', -base);
  });
  add('投资盈亏', snap.inv - prev.inv);
  add('实物增值/折旧', snap.real - prev.real);
  add('负债变化', prev.liab - snap.liab);
  const total = Object.values(out).reduce((s2, v) => s2 + v, 0);
  const residual = (snap.net - prev.net) - total;
  const items = Object.keys(out).sort((a, b) => Math.abs(out[b]) - Math.abs(out[a])).map(k => ({ k, v: out[k] }));
  return { items, residual };
}
function finAttribution(prev, snap) {
  // A3：真实差额直接并入「日常支出」，不再保留「未归因差额」独立项。
  const parts = finAttributionParts(prev, snap);
  const EPS = 0.005;
  if (Math.abs(parts.residual) > EPS) {
    const hit = parts.items.find(x => x.k === '日常支出');
    if (hit) hit.v += parts.residual;
    else parts.items.push({ k: '日常支出', v: parts.residual });
    parts.items.sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  }
  return parts.items;
}
function finCurOpts(d, extra) {
  const codes = Object.keys(d.fx);
  return codes.map(c => `<option value="${c}" ${extra === c ? 'selected' : ''}>${c} ${FIN_TAX[c] || ''}</option>`).join('');
}
function finAcctTypeName(d, t) {
  const hit = FIN_ACCT_TYPES.find(x => x[0] === t);
  if (hit) return hit[1];
  return t || '其他';
}
function finEnsureType(d, t) {
  if (!t) return 'other';
  if (FIN_ACCT_TYPES.some(x => x[0] === t)) return t;
  if (!d.acctTypes.includes(t)) d.acctTypes.push(t);
  return t;
}
function finAcctTypeOpts(d) {
  return [...FIN_ACCT_TYPES, ...(d.acctTypes || []).map(t => [t, t]), ['__new__', '✏️ 自定义新类型…']];
}
function finTypeMix(d) {
  const m = {};
  d.accounts.forEach(a => {
    const v = finAcctHoldings(d, a.id).length ? finAcctInvValue(d, a.id) : finToBase(d, a.balance, a.cur);
    m[a.type] = (m[a.type] || 0) + v;
  });
  return Object.keys(m).map(t => ({ type: t, name: finAcctTypeName(d, t), val: m[t] })).sort((a, b) => b.val - a.val);
}
function finGroupTotals(d) {
  const out = {};
  (d.acctGroups || []).forEach(g => out[g.id] = 0);
  d.accounts.forEach(a => {
    const g = a.group || 'ungrouped';
    const v = finAcctHoldings(d, a.id).length ? finAcctInvValue(d, a.id) : finToBase(d, a.balance, a.cur);
    out[g] = (out[g] || 0) + v;
  });
  return out;
}
function finAcctHoldings(d, acctId) { return d.inv.holdings.filter(h => h.acctId === acctId); }
function finAcctInvValue(d, acctId) {
  return finAcctHoldings(d, acctId).reduce((s, h) => s + finToBase(d, h.value, h.cur), 0);
}
function finPx(n) { return (n || 0).toFixed(8).replace(/0+$/, '').replace(/\.$/, ''); }
function finLotQty(h) { return (h.lots || []).reduce((s, l) => s + (l.qty || 0), 0); }
function finLotCost(h) { return (h.lots || []).reduce((s, l) => s + (l.cost || 0), 0); }
function finHoldingVal(h) { return finLotQty(h) * (h.price || 0); }
function finSyncHolding(h) {
  if (h.cashOnly) { h.qty = 0; h.lots = h.lots || []; if (h.cost == null || isNaN(h.cost)) h.cost = h.value || 0; return h; }
  if (!h.lots) {
    const qty = h.qty || 0, cost = h.cost || 0;
    h.lots = (qty > 0 || cost > 0) ? [{ id: 'l' + (h.id || 'h') + '0', date: h.date || fmtDate(new Date()), qty, cost, px: qty > 0 ? cost / qty : 0 }] : [];
  }
  if (h.price == null || isNaN(h.price) || h.price <= 0) {
    const q = finLotQty(h), c = finLotCost(h);
    h.price = q > 0 ? c / q : 0;
  }
  h.qty = finLotQty(h);
  h.cost = finLotCost(h);
  h.value = finHoldingVal(h);
  return h;
}
function finAcctName(d, id) { const a = d.accounts.find(x => x.id === id); return a ? a.name : '(未挂靠)'; }
function finNum(n) {
  const v = Math.round((n || 0) * 100) / 100;
  return String(v);
}
function finResolveHolding(o) {
  const price = parseFloat(o.price) || 0;
  let qty = parseFloat(o.qty) || 0;
  let cost = parseFloat(o.cost) || 0;
  if (qty <= 0 && price > 0 && cost > 0) qty = cost / price;   // 简捷：总成本 ÷ 单价
  if (cost <= 0 && price > 0 && qty > 0) cost = price * qty;   // 标准：单价 × 数量
  return { price: Math.round(price * 1e8) / 1e8, qty: Math.round(qty * 1e6) / 1e6, cost: Math.round(cost * 1e4) / 1e4 };
}
function finAcctInvRaw(d, acctId) {
  const acc = d.accounts.find(x => x.id === acctId);
  const baseVal = finAcctInvValue(d, acctId);
  const r = acc && d.fx[acc.cur];
  return r ? baseVal / r : baseVal;
}
function finCurveData(d, obj, spanDays) {
  const cutoff = spanDays ? fmtDate(new Date(Date.now() - spanDays * 864e5)) : null;
  const lastDate = d.snaps.length ? d.snaps[d.snaps.length - 1].date : null;
  const pts = [];
  d.snaps.forEach(s => {
    if (!s.accts || !s.accts.length) return;
    if (cutoff && s.date < cutoff) return;
    // 最新点用当前汇率（与顶部净资产实时口径一致）；历史点用快照锁定汇率（真实历史市值，不随汇率漂移）
    const isLast = s.date === lastDate;
    const rate = c => {
      if (isLast) return d.fx[c] != null ? d.fx[c] : 1;
      return s.fx && s.fx[c] != null ? s.fx[c] : (d.fx[c] != null ? d.fx[c] : 1);
    };
    let val = 0;
    if (obj === 'all') {
      val = s.accts.reduce((sum, a) => sum + (a.val || 0) * rate(a.cur), 0);
    } else if (obj.startsWith('grp:')) {
      const gid = obj.slice(4);
      val = s.accts.filter(a => { const acc = d.accounts.find(x => x.id === a.id); return acc && (acc.group || 'ungrouped') === gid; })
        .reduce((sum, a) => sum + (a.val || 0) * rate(a.cur), 0);
    } else {
      const a = s.accts.find(x => x.id === obj.slice(5));
      val = a ? (a.val || 0) * rate(a.cur) : 0;
    }
    pts.push({ date: s.date, val });
  });
  return pts;
}
function finRateView(d, c, dir) {
  const base = d.base;
  const fwd = d.fx[c] != null ? d.fx[c] : 0;
  const d2 = dir || (S && S.fin && S.fin.fxDir && S.fin.fxDir[c]) || (fwd >= 1 ? 'fwd' : 'rev');
  const rev = fwd > 0 ? 1 / fwd : 0;
  return d2 === 'fwd'
    ? { a: c, b: base, val: fwd, dir: 'fwd', label: `1 ${c} =`, to: base }
    : { a: base, b: c, val: rev, dir: 'rev', label: `1 ${base} =`, to: c };
}
async function finFetchRates() {
  if (!S.fin) S.fin = {};
  const d = loadFin();
  const res = await fetch('https://open.er-api.com/v6/latest/' + d.base);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  if (!j || !j.rates) throw new Error('返回数据异常');
  const rates = {};
  Object.entries(j.rates).forEach(([c, r]) => { if (c !== d.base && r > 0) rates[c] = 1 / r; });
  S.fin.apiRates = rates;
  let updated = 0;
  const fxToday = fmtDate(new Date());
  Object.keys(d.fx).forEach(c => { if (c !== d.base && rates[c] != null) {
    d.fx[c] = rates[c]; updated++;
    if (!d.fxHist) d.fxHist = {};
    const arr = d.fxHist[c] = d.fxHist[c] || [];
    const i = arr.findIndex(p => p.date === fxToday);
    if (i >= 0) arr[i].rate = rates[c]; else arr.push({ date: fxToday, rate: rates[c] });
  } });
  d.fxDate = fxToday;
  saveFin(d);
  const avail = Object.keys(rates).filter(c => d.fx[c] == null).length;
  return { updated, avail };
}
function finUsedCurs(d) {
  const used = new Set();
  d.accounts.forEach(a => used.add(a.cur));
  d.liabs.forEach(l => used.add(l.cur));
  d.reals.forEach(r => used.add(r.cur));
  d.inv.holdings.forEach(h => used.add(h.cur));
  return used;
}
function finClearUnusedFx(d) {
  const used = finUsedCurs(d);
  let n = 0;
  Object.keys(d.fx).forEach(c => { if (c !== d.base && !used.has(c)) { delete d.fx[c]; n++; } });
  return n;
}

/* ---------- 通用表单浮层 ---------- */
function finFormModal(title, fields, item, cb) {
  const body = fields.map(f => {
    const v = item ? item[f.k] : f.def;
    if (f.type === 'sel') {
      const optsHtml = f.opts.map(([v2, l]) => `<option value="${v2}" ${String(v) === String(v2) ? 'selected' : ''}>${l}</option>`).join('');
      const customInput = f.custom ? `<input class="input" data-f="${f.k}__new" placeholder="${f.customPh || '输入新类型名称'}" style="display:none;margin-top:6px;">` : '';
      const onch = f.onch ? ` onchange="${f.onch}"` : (f.custom ? ` onchange="this.nextElementSibling.style.display=this.value==='__new__'?'block':'none'"` : '');
      return `<label class="field ${f.cls || ''}"${f.hidden ? ' style="display:none"' : ''}>${f.label}<select class="input" data-f="${f.k}"${onch}>${optsHtml}</select>${customInput}</label>`;
    }
    if (f.type === 'check')
      return `<label class="pi-check"><input type="checkbox" data-f="${f.k}" ${v ? 'checked' : ''}> ${f.label}</label>`;
    return `<label class="field ${f.cls || ''}"${f.hidden ? ' style="display:none"' : ''}>${f.label}<input class="input" data-f="${f.k}" value="${esc(v == null ? '' : v)}" placeholder="${f.placeholder || ''}"></label>`;
  }).join('');
  const m = modal({ title, body, actions: [
    { label: '取消', cls: 'soft', onClick: mask => mask.remove() },
    { label: '保存 ✓', onClick: mask => {
      const out = {};
      fields.forEach(f => {
        const el = m.body.querySelector(`[data-f="${f.k}"]`);
        if (!el) { out[f.k] = item ? item[f.k] : f.def; return; }
        if (el.type === 'checkbox') { out[f.k] = el.checked; return; }
        if (el.tagName === 'SELECT' && el.value === '__new__') {
          const ni = m.body.querySelector(`[data-f="${f.k}__new"]`);
          out[f.k] = ni && ni.value.trim() ? ni.value.trim() : (item ? item[f.k] : '');
          return;
        }
        out[f.k] = el.value.trim();
      });
      cb(out); mask.remove();
    } },
  ]});
}

/* ---------- 理财量化（独立于记账本 · 只读记账本理财信息库） ---------- */
const FINQ_KEY = 'rt_finquant';   // 本地覆盖：{ watched: { 持仓id: { val, date } }, cfg: {} }
function loadFinQuant() {
  const q = loadJSON(FINQ_KEY, null);
  if (!q || typeof q !== 'object') return { watched: {}, cfg: {} };
  if (!q.watched) q.watched = {};
  if (!q.cfg) q.cfg = {};
  return q;
}
function saveFinQuant(q) { localStorage.setItem(FINQ_KEY, JSON.stringify(q)); }
function finqAcctName(d, id) { const a = (d.accounts || []).find(x => x.id === id); return a ? a.name : '未挂靠'; }
function finqBaseVal(h) {
  if (h.cashOnly) return h.value || 0;
  if (h.price != null && h.qty != null) return (h.price || 0) * (h.qty || 0);
  return h.value || 0;
}
function renderFinQuantTool() {
  const box = ROOT;
  box.innerHTML = `<div class="gcard" style="padding:28px;line-height:1.9;">
    <div class="section-title"><span class="st-emoji">📊</span>理财量化</div>
    <div style="font-size:14px;color:var(--text-dim);">
      数据已重置，功能待重构。<br>
      旧的 finquant 本地数据不迁移、不读取；本入口暂时只保留占位，不调用任何 API。
    </div>
  </div>`;
  return;
  if (S.fq && S.fq.view === 'factor') return renderFactorTool(box);
  if (S.fq && S.fq.view === 'fund') return renderFundNavTool(box);
  if (S.fq && S.fq.view === 'factorlib') return renderFactorLibView(box);
  box.innerHTML = `
    <div class="gcard" style="margin-bottom:14px;">
      <div class="section-title"><span class="st-emoji">🔭</span>自动采集（探索工作窗口）<span class="pi-badge rep" style="vertical-align:middle;">⏳ 探索中</span></div>
      <div style="font-size:13px;color:var(--text-dim);line-height:1.9;">
        目标：自动抓取基金净值与行情，替代手动更新。当前接入一个数据源，后续可再添加其他数据源。
      </div>
      <div class="fin-attrib" style="margin-top:8px;">
        <div class="attrib-row"><span>📦 天天基金网数据（场外基金每日净值 · 成立以来全量 · 本地缓存 24h）</span><button class="btn sm soft" id="fq-fund" style="font-size:12px;padding:2px 10px;">进入 →</button></div>
      </div>
      <div style="margin-top:12px;display:flex;gap:10px;align-items:center;">
        <input class="input" disabled placeholder="后续版本：数据源接入配置（API Key / 定时任务）…" style="flex:1;min-width:200px;">
        <button class="btn soft" disabled>保存配置（开发中）</button>
      </div>
    </div>
    <div class="gcard" style="margin-bottom:14px;">
      <div class="section-title"><span class="st-emoji">🧪</span>量化影响因子（工作窗口）<span class="pi-badge rep" style="vertical-align:middle;">🧪 参数待接入</span></div>
      <div style="font-size:12px;color:var(--text-dim);line-height:1.9;margin-bottom:8px;">
        四类因子组别，参数可展开 / 收起；点击参数行或「分析 →」独立进入分析面板（数据源与计算方案将逐步补充，为工作流化做准备）。
      </div>
      <div id="fq-factor-tree">${fnFactorRender()}</div>
    </div>
    <div class="gcard" style="margin-bottom:14px;">
      <div class="section-title"><span class="st-emoji">📚</span>影响因子库<span class="pi-badge" style="vertical-align:middle;">💾 全流程归档</span></div>
      <div style="font-size:12px;color:var(--text-dim);line-height:1.9;margin-bottom:8px;">
        按产品保存各影响因子的五层结果：长期 / 中期 / 短期全流程跑完后自动以最新数据独立覆盖归档；点击「进入 →」查看该类别五层结果并可导出 JSON。
      </div>
      <div id="fq-factor-lib-card">${fqFactorLibCardHTML()}</div>
    </div>
    <div class="gcard" style="margin-bottom:14px;">
      <div class="section-title"><span class="st-emoji">🗂</span>数据集（训练 / 预测样本）<span class="pi-badge" style="vertical-align:middle;">🧠 为训练准备</span></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px;">
        <button class="btn sm" id="fnd-add-grp">➕ 新增组别</button>
        <span class="fin-note">${fnDataLoad().items.length} 个数据集 · ${fnDataLoad().groups.length} 个组别 · 三点选样（A→B 训练 / B→C 预测）保存于此</span>
      </div>
      <div id="fnd-add-row" style="display:none;gap:8px;align-items:center;margin-bottom:8px;">
        <input class="input" id="fnd-grp-name" placeholder="新组别名称" style="width:160px;">
        <button class="btn sm" id="fnd-grp-ok">确认</button><button class="btn sm soft" id="fnd-grp-cx">取消</button>
      </div>
      <div id="fnd-tree">${fnDataRender()}</div>
    </div>`;
  const fundBtn = $('#fq-fund');
  if (fundBtn) fundBtn.onclick = () => {
    if (!S.fq) S.fq = { view: 'fund', expanded: null, list: null };
    S.fq.view = 'fund';
    renderFinQuantTool();
  };
  const ftr = $('#fq-factor-tree');
  if (ftr) ftr.onclick = e => {
    const grp = e.target.closest('.fq-fgrp');
    if (grp) {
      const id = grp.dataset.id;
      if (S.fq.fOpen.has(id)) S.fq.fOpen.delete(id); else S.fq.fOpen.add(id);
      ftr.innerHTML = fnFactorRender();
      return;
    }
    const fa = e.target.closest('.fq-fgrp-a');
    if (fa) {
      if (!S.fq) S.fq = { view: 'factor', factorGroup: fa.dataset.fgroup, expanded: null, list: null };
      S.fq.view = 'factor'; S.fq.factorGroup = fa.dataset.fgroup;
      renderFinQuantTool();
    }
  };
  const flib = $('#fq-factor-lib-card');
  if (flib) flib.onclick = e => {
    const b = e.target.closest('button[data-code][data-klass]');
    if (b) {
      if (!S.fq) S.fq = {};
      S.fq.view = 'factorlib'; S.fq.factorLibCode = b.dataset.code; S.fq.factorLibKlass = b.dataset.klass;
      renderFinQuantTool();
    }
  };
  const grpAddBtn = $('#fnd-add-grp');
  if (grpAddBtn) grpAddBtn.onclick = () => {
    const row = $('#fnd-add-row');
    row.style.display = row.style.display === 'none' ? 'flex' : 'none';
    if (row.style.display === 'flex') $('#fnd-grp-name').focus();
  };
  const grpOk = $('#fnd-grp-ok'), grpCx = $('#fnd-grp-cx');
  if (grpOk) grpOk.onclick = () => {
    const inp = $('#fnd-grp-name');
    if (!fnGroupAdd(inp.value)) { toast('组别名称无效或已存在', 'warn'); return; }
    inp.value = '';
    $('#fnd-add-row').style.display = 'none';
    $('#fnd-tree').innerHTML = fnDataRender();
    toast('组别已创建 ✓', 'success');
  };
  if (grpCx) grpCx.onclick = () => { $('#fnd-add-row').style.display = 'none'; };
  const fndTree = $('#fnd-tree');
  if (fndTree) fndTree.onclick = e => {
    const tog = e.target.closest('.fn-grp-toggle');
    if (tog) {
      const id = tog.dataset.id;
      if (S.fnd.open.has(id)) S.fnd.open.delete(id); else S.fnd.open.add(id);
      fndTree.innerHTML = fnDataRender();
      return;
    }
    const gdel = e.target.closest('.fn-grp-del');
    if (gdel) {
      if (!confirm('删除该组别及其全部数据集？')) return;
      if (!fnGroupDel(gdel.dataset.id)) { toast('至少保留一个组别', 'warn'); return; }
      fndTree.innerHTML = fnDataRender(); toast('组别已删除', 'info'); return;
    }
    const ddel = e.target.closest('.fn-ds-del');
    if (ddel) {
      if (!confirm('删除该数据集？')) return;
      fnDataDel(ddel.dataset.id);
      fndTree.innerHTML = fnDataRender(); toast('数据集已删除', 'info');
    }
  };
}

/* ---------- 影响因子库（理财量化 · 按产品归档 长/中/短 五层结果） ---------- */
const FQ_FACTOR_LIB_KEY = 'rt_fq_factor_lib';
function fqFactorLibGetAll() { const q = finContentGet(FQ_FACTOR_LIB_KEY); return (q && typeof q === 'object') ? q : {}; }
function fqFactorLibClass(gid) { return gid === 'L1' ? 'long' : gid === 'L2' ? 'mid' : 'short'; }
function fqFactorLibWindow(gid) {
  /* 统计时间窗口 → 起止日期：
     L2/L3（中期/短期预期类）取 S.fq.tw[gid]（自定义为「起~止」，窗口类型按今天往前推算）；
     L1（长期价值类）无时间窗口 → 以运行完成当日为窗口 */
  let start, end;
  if (FQ_DS_MODE[gid] && S.fq.tw && S.fq.tw[gid]) {
    const tw = String(S.fq.tw[gid]);
    const m = tw.match(/^(\d{4}-\d{2}-\d{2})\s*[~至－-]\s*(\d{4}-\d{2}-\d{2})$/);
    if (m) { start = m[1]; end = m[2]; }
    else {
      end = fmtDate(new Date());
      const d = new Date();
      const span = tw === '一周' ? 7 : tw === '一个月' ? 30 : tw === '三个月' ? 90 : tw === '六个月' ? 180 : tw === '一年' ? 365 : 30;
      d.setDate(d.getDate() - span);
      start = fmtDate(d);
    }
  } else {
    end = start = fmtDate(new Date());
  }
  return { key: start + '~' + end, start: start, end: end };
}
function fqFactorLibWins(entry, klass) {
  /* 规范化某产品某类别的窗口列表：旧格式（单条 {ts,layers} 无窗口）迁移为「历史归档」窗口 */
  const cls = entry && entry[klass];
  if (!cls || typeof cls !== 'object') return [];
  if (cls.layers && !cls.window_start) return [{ key: '历史归档', data: cls }];
  return Object.keys(cls).map(k => ({ key: k, data: cls[k] })).filter(w => w.data && w.data.layers);
}
function fqFactorLibSave(gid, code, p) {
  /* 全流程完成后归档：同一产品 + 同一价值类 + 同一时间窗口 → 覆盖该窗口数据；
     不同时间窗口 → 并列新增，互不覆盖；各类别（long/mid/short）独立 */
  const klass = fqFactorLibClass(gid);
  const layers = {};
  for (const l of FQ_LAYERS) {
    const d = fqLayerGet(gid, l.id, code);
    if (d && d.result) layers[l.id] = d.result;
  }
  if (Object.keys(layers).length < 5) return;   /* 五层未齐不覆盖 */
  const win = fqFactorLibWindow(gid);
  const lib = fqFactorLibGetAll();
  const entry = lib[code] = lib[code] || { name: (p && p.name) || code };
  if (entry[klass] && entry[klass].layers && !entry[klass].window_start) {
    entry[klass] = { '历史归档': { ts: entry[klass].ts, layers: entry[klass].layers } };   /* 旧格式迁移 */
  }
  const cls = entry[klass] = entry[klass] || {};
  cls[win.key] = { ts: fmtDate(new Date()) + ' ' + new Date().toTimeString().slice(0, 5), window_start: win.start, window_end: win.end, layers };
  finContentSet(FQ_FACTOR_LIB_KEY, lib);
  const el = document.getElementById('fq-factor-lib-card');
  if (el) el.innerHTML = fqFactorLibCardHTML();
}
function fqFactorLibCardHTML() {
  const lib = fqFactorLibGetAll();
  const prods = fnLoad().products;
  const clsMeta = [['long', '长期价值类'], ['mid', '中期预期类'], ['short', '短期交易类']];
  const rows = prods.map(p => {
    const e = lib[p.code] || {};
    const btns = clsMeta.map(([k, label]) => {
      const wins = fqFactorLibWins(e, k);
      const has = wins.length > 0;
      const total = wins.reduce((s, w) => s + (w.data && w.data.layers ? Object.keys(w.data.layers).length : 0), 0);
      return `<button class="btn sm ${has ? '' : 'soft'}" data-code="${esc(p.code)}" data-klass="${k}" title="${label}" style="font-size:12px;padding:2px 10px;">${label} · ${has ? '进入 →' : '待跑'}${has ? `<span class="fin-note" style="margin-left:4px;">${wins.length} 窗口 · ${total} 层</span>` : ''}</button>`;
    }).join(' ');
    return `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(0,0,0,.05);flex-wrap:wrap;">
      <b style="min-width:180px;font-size:13px;">${esc(p.name)}</b><span class="fin-note" style="min-width:64px;">${esc(p.code)}</span>
      <div style="display:flex;gap:8px;flex:1;flex-wrap:wrap;">${btns}</div></div>`;
  }).join('');
  return rows || '<span class="fin-note">尚无归档产品——在因子分析中运行「一键五层 / 一键全流程」后自动按产品入库</span>';
}
function fqFactorLibExport(code, klass, winKey, p) {
  const lib = fqFactorLibGetAll();
  const wins = fqFactorLibWins(lib[code], klass);
  const w = wins.find(x => x.key === winKey);
  if (!w) { toast('该时间窗口无可导出的归档数据', 'warn'); return; }
  const d = w.data;
  const payload = { product_id: code, product_name: (p && p.name) || code, factor_class: klass, window_start: d.window_start || '', window_end: d.window_end || '', archived_at: d.ts, ...d };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const filename = code + '_' + klass + '_' + (d.window_start || 'history') + '~' + (d.window_end || '') + '_factors.json';
  window.rtDownloadBlob(blob, filename);
  toast('已导出 ' + filename, 'success');
}
function fqFacLibArrTable(arr) {
  if (!arr || !arr.length) return '<span class="fin-note">空数组</span>';
  const keys = [];
  arr.forEach(x => { if (x && typeof x === 'object') Object.keys(x).forEach(k => { if (!keys.includes(k)) keys.push(k); }); });
  if (!keys.length) return '<span class="fin-note">无结构化数据</span>';
  return `<table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead><tr>${keys.map(k => `<th style="text-align:left;padding:5px 8px;border-bottom:1px solid rgba(0,0,0,.12);background:rgba(0,0,0,.03);white-space:nowrap;">${esc(k)}</th>`).join('')}</tr></thead>
    <tbody>${arr.map(x => `<tr>${keys.map(k => { const v = x && x[k]; return `<td style="padding:5px 8px;border-bottom:1px solid rgba(0,0,0,.06);vertical-align:top;">${esc(v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)))}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
}
function fqFacLibKVTable(obj) {
  const rows = Object.entries(obj || {});
  if (!rows.length) return '<span class="fin-note">无数据</span>';
  return `<table style="width:100%;border-collapse:collapse;font-size:12px;">
    <tbody>${rows.map(([k, v]) => `<tr><td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);white-space:nowrap;font-weight:600;color:var(--text-dim);width:1%;">${esc(k)}</td><td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);">${esc(v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)))}</td></tr>`).join('')}</tbody></table>`;
}
function fqFacLibRenderRes(res) {
  /* 影响因子库 · 五层结果拆解为表格：
     数组=统一列宽表；组结构（section+items）= 每组标题 + items 表格（items 数组列并集 / 对象键值表）；
     对象含 item_scores = 键值行 + item_scores 表格；普通对象 = 键值表 */
  if (Array.isArray(res)) {
    if (res.length && res.every(x => x && typeof x === 'object' && !Array.isArray(x) && ('section' in x || 'items' in x))) {
      return res.map(g => {
        const title = g.section || '组';
        const items = g.items;
        let body = '<span class="fin-note">无明细</span>';
        if (Array.isArray(items)) body = fqFacLibArrTable(items);
        else if (items && typeof items === 'object') body = fqFacLibKVTable(items);
        return `<div style="margin-bottom:10px;"><div style="font-weight:600;font-size:12.5px;margin-bottom:5px;">${esc(title)}</div>${body}</div>`;
      }).join('');
    }
    return fqFacLibArrTable(res);
  }
  if (res && typeof res === 'object') {
    if (Array.isArray(res.item_scores)) {
      const rest = Object.fromEntries(Object.entries(res).filter(([k]) => k !== 'item_scores'));
      return fqFacLibKVTable(rest) + '<div style="margin-top:8px;">' + fqFacLibArrTable(res.item_scores) + '</div>';
    }
    return fqFacLibKVTable(res);
  }
  return esc(String(res));
}
function renderFactorLibView(box) {
  const code = S.fq.factorLibCode, klass = S.fq.factorLibKlass;
  const lib = fqFactorLibGetAll();
  const e = lib[code] || {};
  const p = fnLoad().products.find(x => x.code === code);
  const label = { long: '长期价值类', mid: '中期预期类', short: '短期交易类' }[klass] || klass;
  const wins = fqFactorLibWins(e, klass);
  if (!S.fq.libOpen) S.fq.libOpen = new Set();
  const winHTML = wins.map(w => {
    const d = w.data;
    const winName = d.window_start && d.window_end ? (d.window_start + ' 至 ' + d.window_end) : w.key;
    const open = S.fq.libOpen.has(code + '|' + klass + '|' + w.key);
    const layersHTML = FQ_LAYERS.map((l, i) => {
      const res = d.layers && d.layers[l.id];
      return `<div class="gcard" style="margin:8px 0 8px 8px;">
        <div class="section-title" style="font-size:13.5px;">第 ${i + 1} 层 · ${esc(l.name)}</div>
        <div style="overflow-x:auto;">${res != null ? fqFacLibRenderRes(res) : '<span class="fin-note">该层无数据</span>'}</div>
      </div>`;
    }).join('');
    return `<div class="gcard" style="margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:10px;cursor:pointer;flex-wrap:wrap;" data-win="${esc(w.key)}">
        <span style="font-size:14px;color:var(--accent);width:20px;">${open ? '▾' : '▸'}</span>
        <b style="font-size:13.5px;flex:1;">${esc(winName)}</b>
        <span class="fin-note" style="font-size:11px;">归档：${esc(d.ts || '—')}</span>
        <button class="btn sm fqlib-win-export" data-win="${esc(w.key)}" style="font-size:12px;padding:2px 10px;">⬇ 导出 JSON</button>
      </div>
      ${open ? `<div style="margin-top:4px;">${layersHTML}</div>` : ''}
    </div>`;
  }).join('');
  box.innerHTML = `
    <button class="btn sm soft" id="fqlib-back">⬅ 返回理财量化</button>
    <div class="gcard" style="margin-top:10px;">
      <div class="section-title"><span class="st-emoji">📚</span>影响因子库 · ${esc(p ? p.name : code)} <span class="fin-note">(${esc(code)} · ${label})</span></div>
      <div class="fin-note" style="margin-bottom:8px;">共 ${wins.length} 个时间窗口组别：同一产品 · 同一价值类 · 同一时间窗口的全流程数据会自动覆盖；不同窗口并列展示，可独立展开 / 收起与导出。</div>
    </div>
    ${wins.length ? winHTML : '<span class="fin-note">该产品此类别尚无归档数据（请先跑完全流程）</span>'}`;
  const back = $('#fqlib-back');
  if (back) back.onclick = () => { S.fq.view = null; renderFinQuantTool(); };
  box.querySelectorAll('[data-win]').forEach(hd => {
    hd.onclick = ev => {
      if (ev.target.closest('.fqlib-win-export')) return;
      const k = hd.getAttribute('data-win');
      const id = code + '|' + klass + '|' + k;
      if (S.fq.libOpen.has(id)) S.fq.libOpen.delete(id); else S.fq.libOpen.add(id);
      renderFactorLibView(box);
    };
  });
  box.querySelectorAll('.fqlib-win-export').forEach(b => {
    b.onclick = () => fqFactorLibExport(code, klass, b.getAttribute('data-win'), p);
  });
}

/* ---------- 基金净值披露（理财量化 · 自动采集子界面） ---------- */
const FNAV_KEY = 'rt_fundnav';
function fnLoad() { const q = finContentGet(FNAV_KEY); return (q && Array.isArray(q.products)) ? q : { products: [] }; }
function fnSave(q) { finContentSet(FNAV_KEY, q); }
function fnSugg(kw) {
  const q = S.fq.list || [];
  const k = String(kw || '').trim().toLowerCase();
  if (!k) return [];
  const added = new Set(fnLoad().products.map(p => p.code));
  return q.filter(f => !added.has(f.code) && (f.code.includes(k) || f.name.toLowerCase().includes(k))).slice(0, 20);
}
function fnSuggRender() {
  const sl = document.getElementById('fn-sugg-list');
  const inp = document.getElementById('fn-code');
  if (!sl || !inp) return;
  const items = fnSugg(inp.value);
  if (!items.length) { sl.style.display = 'none'; return; }
  sl.innerHTML = items.map(f => `<div class="fn-sugg-item" data-code="${f.code}" style="padding:7px 12px;cursor:pointer;display:flex;gap:10px;align-items:baseline;">
    <b style="color:var(--accent);font-size:12.5px;">${f.code}</b><span style="flex:1;font-size:13px;">${esc(f.name)}</span><span class="fin-note" style="font-size:11px;">${esc(f.type)}</span></div>`).join('');
  sl.style.display = 'block';
  sl.querySelectorAll('.fn-sugg-item').forEach(it => {
    it.onclick = () => { inp.value = it.dataset.code; sl.style.display = 'none'; };
  });
}
function fnEnsureNav(code) {
  if (!S.fq.navs) S.fq.navs = {};
  if (S.fq.navs[code]) return Promise.resolve(S.fq.navs[code]);
  return apiPost('/api/plugin/finance/fund/nav', { code }).then(r => {
    if (!r || !r.ok) { toast((r && r.error) || '获取失败', 'error'); return null; }
    S.fq.navs[code] = r;
    return r;
  });
}
function fnAdd(code) {
  const q = fnLoad();
  if (q.products.some(p => p.code === code)) {
    toast('该产品已在列表中 ✓', 'info');
    S.fq.expanded = code; renderFundNavTool(); return;
  }
  toast('正在获取成立以来净值…', 'info');
  fnEnsureNav(code).then(r => {
    if (!r) return;
    const last = r.navs[r.navs.length - 1];
    q.products.unshift({ code, name: r.name, addedAt: fmtDate(new Date()),
      last_nav: last.unit_nav, last_date: last.date, count: r.count });
    fnSave(q);
    S.fq.expanded = code;
    renderFundNavTool();
    toast(`已添加「${r.name}」✓`, 'success');
  });
}
function fnRangeNavs(navs, range) {
  if (!range || range === 'all') return navs;
  if (typeof range === 'object') {
    const f = navs.filter(x => x.date >= (range.from || '') && x.date <= (range.to || ''));
    return f.length >= 2 ? f : navs;
  }
  const days = { '1m': 30, '3m': 91, '6m': 183, '1y': 366 }[range] || 366;
  const cutoff = Date.now() - days * 864e5;
  const f = navs.filter(x => new Date(x.date).getTime() >= cutoff);
  return f.length >= 2 ? f : navs;
}
function fnMaxDD(arr) {
  let peak = -Infinity, dd = 0;
  arr.forEach(x => { peak = Math.max(peak, x.unit_nav); dd = Math.max(dd, (peak - x.unit_nav) / peak); });
  return dd;
}
function fnFundChart(d) {
  if (!S.fq.ranges) S.fq.ranges = {};
  const range = S.fq.ranges[d.code] || 'all';
  const isCustom = typeof range === 'object';
  const all = d.navs || [];
  if (!all.length) return '<div class="empty">暂无数据</div>';
  const navs = fnRangeNavs(all, range);
  const last = navs[navs.length - 1], first = navs[0];
  const firstAll = all[0], lastAll = all[all.length - 1];
  const gainAll = firstAll.unit_nav ? (lastAll.unit_nav / firstAll.unit_nav - 1) * 100 : 0;
  const gainRng = first.unit_nav ? (last.unit_nav / first.unit_nav - 1) * 100 : 0;
  const maxDDAll = fnMaxDD(all), maxDDRng = fnMaxDD(navs);
  const spanDays = Math.max(1, (new Date(lastAll.date).getTime() - new Date(firstAll.date).getTime()) / 864e5);
  const ann = firstAll.unit_nav ? (Math.pow(lastAll.unit_nav / firstAll.unit_nav, 365 / spanDays) - 1) * 100 : 0;
  const W = 760, LT = 56, LR = 16, TP = 16, H1 = 170, GAP = 26, H2 = 84;
  const B1 = TP + H1, B2 = B1 + GAP + H2, H = B2 + 10;
  const inner = W - LT - LR;
  const n = navs.length;
  const vMin = Math.min(...navs.map(x => x.unit_nav)), vMax = Math.max(...navs.map(x => x.unit_nav));
  const vA = vMin === vMax ? vMin * 0.1 + 0.001 : (vMax - vMin) * 0.08;
  const lo = vMin - vA, hi = vMax + vA;
  const X = i => LT + (n === 1 ? inner / 2 : i / (n - 1) * inner);
  const Y = v => TP + (hi - v) / (hi - lo) * H1;
  const pts = navs.map((x, i) => `${X(i).toFixed(1)},${Y(x.unit_nav).toFixed(1)}`);
  const line = 'M' + pts.join(' L');
  const area = line + ` L${X(n - 1).toFixed(1)},${B1.toFixed(1)} L${LT},${B1.toFixed(1)} Z`;
  const ticks = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);
  const grid = [lo, (lo + hi) / 2, hi].map(v => Y(v));
  const cT = B1 + GAP + 6, cH = H2 - 12;
  const maxAbs = Math.max(0.01, ...navs.map(x => Math.abs(x.daily_return_pct || 0)));
  const bars = navs.map((x, i) => {
    const h = Math.abs(x.daily_return_pct || 0) / maxAbs * cH;
    const up = (x.daily_return_pct || 0) >= 0;
    return `<rect class="fj-bar" data-i="${i}" x="${(X(i) - 1.2).toFixed(1)}" y="${(cT + (up ? cH - h : 0)).toFixed(1)}" width="2.4" height="${Math.max(0.6, h).toFixed(1)}" fill="${up ? '#2e9e6b' : '#e05a7a'}" opacity="0.85"></rect>`;
  }).join('');
  const labels = range === 'all' ? [
    `成立以来 <b class="${gainAll >= 0 ? 'up' : 'down'}">${gainAll >= 0 ? '+' : ''}${gainAll.toFixed(2)}%</b>`,
    `最大回撤 <b class="down">${(-maxDDAll * 100).toFixed(2)}%</b>`,
    `年化 <b class="${ann >= 0 ? 'up' : 'down'}">${ann >= 0 ? '+' : ''}${ann.toFixed(2)}%</b>`,
    `成立 <span class="fin-note">${firstAll.date}</span>`,
    `<span class="fin-note">${all.length} 个交易日</span>`,
  ] : [
    `区间涨跌 <b class="${gainRng >= 0 ? 'up' : 'down'}">${gainRng >= 0 ? '+' : ''}${gainRng.toFixed(2)}%</b>`,
    `区间回撤 <b class="down">${(-maxDDRng * 100).toFixed(2)}%</b>`,
    `区间 <span class="fin-note">${first.date} → ${last.date}</span>`,
    `成立以来 <b class="${gainAll >= 0 ? 'up' : 'down'}">${gainAll >= 0 ? '+' : ''}${gainAll.toFixed(2)}%</b>`,
    `<span class="fin-note">${n} 个交易日（区间）</span>`,
  ];
  const rngBtns = [['all', '全部'], ['1y', '近1年'], ['6m', '近6月'], ['3m', '近3月'], ['1m', '近1月'], ['custom', '自定义']]
    .map(([k, lb]) => `<button class="btn sm ${range === k || (k === 'custom' && isCustom) ? '' : 'soft'}" data-rng="${k}" style="font-size:11.5px;padding:2px 10px;">${lb}</button>`).join('');
  const customRow = isCustom ? `
  <div class="fn-custom" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;font-size:12.5px;">
    <span>自定义区间</span>
    <input type="date" class="fn-rng-from input" value="${range.from || firstAll.date}" style="width:148px;padding:3px 6px;">
    <span>~</span>
    <input type="date" class="fn-rng-to input" value="${range.to || lastAll.date}" style="width:148px;padding:3px 6px;">
    <button class="btn sm fn-rng-apply">应用区间</button>
    <span class="fin-note">数据范围 ${firstAll.date} ~ ${lastAll.date}</span>
  </div>` : '';
  const pick = (S.fq.pick && S.fq.pick.code === d.code) ? S.fq.pick : null;
  let overlayHtml = '';
  if (pick && pick.pts.length) {
    const idxs = pick.pts.map(dt => navs.findIndex(x => x.date === dt)).filter(i => i >= 0);
    if (idxs.length >= 2) {
      const xa = X(idxs[0]), xb = X(idxs[1]);
      overlayHtml += `<rect x="${Math.min(xa, xb)}" y="${TP}" width="${Math.abs(xb - xa)}" height="${B1 - TP}" fill="var(--accent)" opacity="0.07"></rect>`;
    }
    if (idxs.length >= 3) {
      const xb = X(idxs[1]), xc = X(idxs[2]);
      overlayHtml += `<rect x="${Math.min(xb, xc)}" y="${TP}" width="${Math.abs(xc - xb)}" height="${B1 - TP}" fill="#b18ea8" opacity="0.09"></rect>`;
    }
    idxs.forEach((i, k) => {
      const lb = 'ABC'[k];
      overlayHtml += `<line x1="${X(i)}" y1="${TP}" x2="${X(i)}" y2="${B1}" stroke="#b18ea8" stroke-width="1.4" stroke-dasharray="4,3" opacity="0.8"></line>
        <circle cx="${X(i)}" cy="${Y(navs[i].unit_nav)}" r="5.5" fill="#fff" stroke="#b18ea8" stroke-width="2.4"></circle>
        <text x="${X(i)}" y="${Y(navs[i].unit_nav) - 9}" text-anchor="middle" font-size="11" font-weight="700" fill="#b18ea8">${lb}</text>`;
    });
  }
  const pickInfo = pick ? (pick.pts.length < 3
    ? `选点模式：已选 <b>${pick.pts.length}/3</b>（${['A', 'B', 'C'].slice(0, pick.pts.length).join(' → ') || 'A'}），点击曲线依次选点`
    : `三点已选：<b>${pick.pts.join(' → ')}</b>（A→B 训练集 · B→C 预测集）`) : '';
  const dsBtns = pick && pick.pts.length === 3
    ? `<button class="btn sm" id="fn-ds-save" style="margin-left:auto;">💾 保存数据集</button><button class="btn sm soft" id="fn-ds-cancel">取消</button>` : '';
  let dsRow = '';
  if (S.fq.dsForm && S.fq.dsForm.code === d.code) {
    const grps = fnDataLoad().groups;
    const options = grps.length
      ? grps.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('')
      : '<option value="">默认分组</option>';
    dsRow = `
    <div class="fn-dsform" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0;padding:10px 12px;background:var(--card);border:1px solid var(--line);border-radius:12px;font-size:12.5px;">
      <span>💾 数据集名称</span>
      <input class="input fn-ds-name" placeholder="例如：2026Q3 训练 / 预测" style="width:170px;padding:4px 8px;">
      <span>组别</span>
      <select class="input fn-ds-group" style="width:130px;padding:4px 6px;">${options}</select>
      <button class="btn sm" id="fn-ds-confirm">确认保存</button>
      <button class="btn sm soft" id="fn-ds-cancel2">取消</button>
      <span class="fin-note">训练 ${pick ? pick.pts.length : 0} 段（A→B）· 预测（B→C）</span>
    </div>`;
  }
  return `
  <div style="display:flex;gap:16px;flex-wrap:wrap;margin:4px 0 8px;font-size:12.5px;align-items:center;">
    <span>最新净值 <b style="color:var(--text);font-size:13px;">${Number(last.unit_nav).toFixed(4)}</b></span>
    <span class="fin-note">${last.date}</span>
    ${labels.map(l => `<span>${l}</span>`).join('')}
    <span class="fin-note" style="margin-left:auto;">${d.cached ? '（命中缓存）' : '（已获取）'}</span>
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center;">${rngBtns}
    <span style="flex:1;"></span>
    <button class="btn sm ${pick ? '' : 'soft'}" id="fn-pick-btn" style="font-size:11.5px;padding:2px 10px;">📊 数据分析</button>
  </div>
  ${pickInfo ? `<div style="font-size:12px;color:var(--accent);margin-bottom:8px;">${pickInfo}</div>` : ''}
  ${customRow}
  <div style="position:relative;overflow:auto;max-height:360px;">
    <svg viewBox="0 0 ${W} ${H}" class="fj-fund" style="min-width:${W}px;display:block;background:rgba(255,255,255,.28);border-radius:12px;cursor:crosshair;">
      <defs><linearGradient id="fnGrad2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
      ${grid.map((gy, gi) => `<line x1="${LT}" y1="${gy}" x2="${W - LR}" y2="${gy}" stroke="rgba(var(--accent-rgb),.10)" stroke-width="1"></line>`).join('')}
      <path d="${area}" fill="url(#fnGrad2)" opacity="0.32"></path>
      <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"></path>
      ${ticks.map(i => `<text x="${X(i)}" y="${B1 + 15}" text-anchor="middle" font-size="10" fill="#9a8d99">${navs[i].date.slice(5)}</text>`).join('')}
      ${grid.map((gy, gi) => `<text x="${LT - 6}" y="${gy + 3}" text-anchor="end" font-size="10" fill="#9a8d99">${[hi, (lo + hi) / 2, lo][gi].toFixed(2)}</text>`).join('')}
      <text x="${LT}" y="${B1 + 15}" font-size="10" fill="#9a8d99">单位净值</text>
      <line x1="${LT}" y1="${B1}" x2="${W - LR}" y2="${B1}" stroke="#d8ccd4" stroke-width="1"></line>
      <text x="${LT}" y="${B2 - 4}" font-size="10" fill="#9a8d99">日涨跌 %</text>
      ${bars}
      ${overlayHtml}
      <line x1="${LT}" y1="${cT + cH}" x2="${W - LR}" y2="${cT + cH}" stroke="#d8ccd4" stroke-width="1"></line>
      <line class="fj-cx" x1="${LT}" y1="${TP}" x2="${LT}" y2="${B2}" stroke="#b18ea8" stroke-width="1.2" opacity="0" style="pointer-events:none;"></line>
      <circle class="fj-hl" r="4.2" fill="#fff" stroke="var(--accent)" stroke-width="2.2" opacity="0" style="pointer-events:none;"></circle>
      <circle class="fj-hl2" r="3" fill="#fff" stroke="#b18ea8" stroke-width="1.8" opacity="0" style="pointer-events:none;"></circle>
    </svg>
    <div class="fj-tip" style="position:absolute;display:none;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:6px 10px;font-size:12px;box-shadow:0 8px 20px rgba(0,0,0,.14);pointer-events:none;z-index:20;white-space:nowrap;"></div>
  </div>
  ${dsBtns ? `<div style="display:flex;gap:10px;align-items:center;margin:10px 0;">${dsBtns}</div>` : ''}
  ${dsRow}`;
}
function fnBindFundChart(host, d) {
  const svg = host.querySelector('svg.fj-fund');
  if (!svg) return;
  const tip = host.querySelector('.fj-tip');
  const cx = host.querySelector('.fj-cx');
  const hl = host.querySelector('.fj-hl');
  const hl2 = host.querySelector('.fj-hl2');
  const navs = fnRangeNavs(d.navs || [], (S.fq.ranges || {})[d.code] || 'all');
  const n = navs.length;
  const W = 760, LT = 56, LR = 16, TP = 16, H1 = 170, GAP = 26, H2 = 84;
  const B1 = TP + H1, B2 = B1 + GAP + H2;
  const inner = W - LT - LR;
  const vMin = Math.min(...navs.map(x => x.unit_nav)), vMax = Math.max(...navs.map(x => x.unit_nav));
  const vA = vMin === vMax ? vMin * 0.1 + 0.001 : (vMax - vMin) * 0.08;
  const lo = vMin - vA, hi = vMax + vA;
  const X = i => LT + (n === 1 ? inner / 2 : i / (n - 1) * inner);
  const Y = v => TP + (hi - v) / (hi - lo) * H1;
  const cT = B1 + GAP + 6, cH = H2 - 12;
  const maxAbs = Math.max(0.01, ...navs.map(x => Math.abs(x.daily_return_pct || 0)));
  svg.onmousemove = e => {
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return;
    const vx = (e.clientX - rect.left) / rect.width * W;
    let idx = Math.round((vx - LT) / inner * (n - 1));
    idx = Math.max(0, Math.min(n - 1, idx));
    const x = X(idx);
    cx.setAttribute('x1', x); cx.setAttribute('x2', x); cx.setAttribute('opacity', '0.75');
    hl.setAttribute('cx', x); hl.setAttribute('cy', Y(navs[idx].unit_nav)); hl.setAttribute('opacity', '1');
    hl2.setAttribute('cx', x);
    hl2.setAttribute('cy', cT + cH - (Math.abs(navs[idx].daily_return_pct || 0) / maxAbs * cH));
    hl2.setAttribute('opacity', '1');
    const dp = navs[idx].daily_return_pct || 0;
    if (tip) {
      tip.innerHTML = `<b>${navs[idx].date}</b> · 净值 <b>${Number(navs[idx].unit_nav).toFixed(4)}</b> · 涨跌 <b class="${dp >= 0 ? 'up' : 'down'}">${dp >= 0 ? '+' : ''}${dp.toFixed(2)}%</b>`;
      tip.style.display = 'block';
      const tx = Math.max(4, Math.min(rect.width - 180, e.clientX - rect.left));
      const ty = Math.max(2, (e.clientY - rect.top) - 36);
      tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
    }
  };
  svg.onmouseleave = () => {
    if (cx) cx.setAttribute('opacity', '0');
    if (hl) hl.setAttribute('opacity', '0');
    if (hl2) hl2.setAttribute('opacity', '0');
    if (tip) tip.style.display = 'none';
  };
  host.querySelectorAll('[data-rng]').forEach(b => {
    b.onclick = () => {
      if (!S.fq.ranges) S.fq.ranges = {};
      S.fq.ranges[d.code] = b.dataset.rng === 'custom' ? {} : b.dataset.rng;
      host.innerHTML = fnFundChart(d);
      fnBindFundChart(host, d);
    };
  });
  const idxOf = e => {
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return -1;
    const vx = (e.clientX - rect.left) / rect.width * W;
    let idx = Math.round((vx - LT) / inner * (n - 1));
    return Math.max(0, Math.min(n - 1, idx));
  };
  const rerender = () => { host.innerHTML = fnFundChart(d); fnBindFundChart(host, d); };
  const applyRng = b => {
    if (!S.fq.ranges) S.fq.ranges = {};
    const fromEl = host.querySelector('.fn-rng-from');
    const toEl = host.querySelector('.fn-rng-to');
    if (!fromEl || !toEl) return;
    const from = fromEl.value, to = toEl.value;
    if (!from || !to) { toast('请选择起止日期', 'warn'); return; }
    if (from > to) { toast('起始日期不能晚于结束日期', 'warn'); return; }
    const f = (d.navs || []).filter(x => x.date >= from && x.date <= to);
    if (f.length < 2) { toast('区间内数据不足 2 条，请扩大范围', 'warn'); return; }
    S.fq.ranges[d.code] = { from, to };
    rerender();
  };
  const applyRngBtn = host.querySelector('.fn-rng-apply');
  if (applyRngBtn) applyRngBtn.onclick = () => applyRng(applyRngBtn);
  const pickBtn = host.querySelector('#fn-pick-btn');
  if (pickBtn) pickBtn.onclick = () => {
    if (S.fq.pick && S.fq.pick.code === d.code) S.fq.pick = null;
    else S.fq.pick = { code: d.code, pts: [] };
    rerender();
  };
  svg.onclick = e => {
    if (!S.fq.pick || S.fq.pick.code !== d.code) return;
    if (S.fq.pick.pts.length >= 3) return;
    const i = idxOf(e);
    if (i < 0) return;
    const dt = navs[i].date;
    if (S.fq.pick.pts.includes(dt)) return;
    S.fq.pick.pts.push(dt);
    rerender();
  };
  const saveBtn = host.querySelector('#fn-ds-save');
  if (saveBtn) saveBtn.onclick = () => {
    if (!S.fq.dsForm) S.fq.dsForm = {};
    S.fq.dsForm = { code: d.code };
    rerender();
  };
  const confirmBtn = host.querySelector('#fn-ds-confirm');
  if (confirmBtn) confirmBtn.onclick = () => {
    const nameEl = host.querySelector('.fn-ds-name');
    const grpEl = host.querySelector('.fn-ds-group');
    const name = nameEl ? nameEl.value.trim() : '';
    if (!name) { toast('请输入数据集名称', 'warn'); return; }
    if (!S.fq.pick || S.fq.pick.pts.length !== 3) { toast('请先完成三点选样', 'warn'); return; }
    const [fa, fb, fc] = S.fq.pick.pts;
    if (!(fa <= fb && fb <= fc)) { toast('三点应按时间先后选择', 'warn'); return; }
    const prod = fnLoad().products.find(p => p.code === d.code);
    fnDataAdd({ name, code: d.code, product: prod ? prod.name : d.code, group: grpEl ? grpEl.value : '', from: fa, split: fb, to: fc, navs: d.navs || [] });
    S.fq.pick = null;
    if (S.fq.dsForm) S.fq.dsForm = null;
    rerender();
    toast('数据集已保存 ✓', 'success');
  };
  const cancelBtns = host.querySelectorAll('#fn-ds-cancel, #fn-ds-cancel2');
  cancelBtns.forEach(b => { b.onclick = () => { S.fq.pick = null; if (S.fq.dsForm) S.fq.dsForm = null; rerender(); }; });
}
/* ---------- 数据集（训练/预测样本）存储与树列表 ---------- */
const FND_KEY = 'rt_funddata';
function fnDataLoad() { const q = finContentGet(FND_KEY); return (q && Array.isArray(q.groups) && Array.isArray(q.items)) ? q : { groups: [], items: [] }; }
function fnDataSave(q) { finContentSet(FND_KEY, q); }
function fnDataAdd(o) {
  const q = fnDataLoad();
  if (!q.groups.length) q.groups.push({ id: 'g' + Date.now(), name: '默认分组' });
  let gid = o.group;
  if (!gid || !q.groups.some(g => g.id === gid)) gid = q.groups[0].id;
  const sub = x => ({ date: x.date, unit_nav: x.unit_nav, daily_return_pct: x.daily_return_pct });
  const train = (o.navs || []).filter(x => x.date >= o.from && x.date <= o.split).map(sub);
  const pred = (o.navs || []).filter(x => x.date >= o.split && x.date <= o.to).map(sub);
  q.items.push({ id: 'd' + Date.now(), name: o.name, code: o.code, product: o.product || o.code,
    group: gid, from: o.from, split: o.split, to: o.to, train, pred, savedAt: fmtDate(new Date()) });
  fnDataSave(q);
}
function fnDataDel(id) { const q = fnDataLoad(); q.items = q.items.filter(it => it.id !== id); fnDataSave(q); }
function fnGroupAdd(name) {
  const q = fnDataLoad();
  if (!name.trim()) return false;
  if (q.groups.some(g => g.name === name.trim())) return false;
  q.groups.push({ id: 'g' + Date.now(), name: name.trim() });
  fnDataSave(q); return true;
}
function fnGroupDel(id) {
  const q = fnDataLoad();
  if (q.groups.length <= 1) return false;
  q.groups = q.groups.filter(g => g.id !== id);
  q.items = q.items.filter(it => it.group !== id);
  fnDataSave(q); return true;
}
function fnDataRender() {
  const q = fnDataLoad();
  if (!q.groups.length && !q.items.length) return '<div class="empty" style="padding:18px;"><span class="e-icon">🗂</span>暂无数据集 —— 在「基金公司 / 净值披露」展开产品 → 📊 数据分析 → 三点选样 → 保存</div>';
  if (!S.fnd) S.fnd = { open: new Set(q.groups.map(g => g.id)) };
  if (!q.groups.length) q.groups.push({ id: 'g' + Date.now(), name: '默认分组' });
  const gids = new Set(q.groups.map(g => g.id));
  q.items.forEach(it => { if (!gids.has(it.group)) it.group = q.groups[0].id; });
  return q.groups.map(g => {
    const its = q.items.filter(it => it.group === g.id);
    const open = S.fnd.open.has(g.id);
    const byCode = {};
    its.forEach(it => { (byCode[it.code] = byCode[it.code] || { name: it.product || it.code, items: [] }).items.push(it); });
    const prodRows = Object.keys(byCode).map(code => {
      const p = byCode[code];
      return `<div class="fj-lrow" style="padding-left:34px;font-size:12.5px;">
        <span class="fj-tag" style="width:26px;">📈</span><span>${esc(p.name)} <span class="fin-note">(${code} · ${p.items.length} 集)</span></span>
        <span style="flex:1;"></span>
      </div>
      ${p.items.map(it => `<div class="fj-lrow" style="padding-left:52px;font-size:12px;border-left:2px solid var(--line);margin-left:16px;align-items:center;">
        <span class="fj-tag" style="width:26px;">🗂</span>
        <span style="flex:1;min-width:110px;">${esc(it.name)}</span>
        <span class="fin-note">${it.from} → ${it.to}</span>
        <span class="fin-note" style="white-space:nowrap;">训练 ${it.train.length} / 预测 ${it.pred.length}</span>
        <button class="btn sm soft fn-ds-del" data-id="${it.id}" style="font-size:11px;padding:1px 7px;">✕</button>
      </div>`).join('')}`;
    }).join('');
    return `<div class="fj-lrow" style="font-size:13px;font-weight:600;align-items:center;">
      <span class="fj-tri fn-grp-toggle" data-id="${g.id}" style="cursor:pointer;width:18px;text-align:center;">${open ? '▾' : '▸'}</span>
      <span class="fj-tag" style="width:26px;">📁</span><span>${esc(g.name)} <span class="fin-note">(${its.length})</span></span>
      <span style="flex:1;"></span>
      <button class="btn sm soft fn-grp-del" data-id="${g.id}" style="font-size:11px;padding:1px 7px;">✕</button>
    </div>
    ${open ? prodRows : ''}`;
  }).join('');
}
/* ---------- 量化影响因子（组别 + 参数独立分析） ---------- */
const FQ_FACTORS = [
  { id: 'L1', name: '长期价值类', freq: '月 / 季更新', tag: '低频高置信', icon: '🏛️',
    items: ['公司基本面价值分', '产业景气与政策得分', '产业链分权综合得分'] },
  { id: 'L2', name: '中期预期类', freq: '日 / 周更新', tag: '中频边际变化', icon: '📊',
    items: ['公司事件预期差得分', '产业预期修正得分', '舆论综合得分', '舆论分歧度'] },
  { id: 'L3', name: '短期交易类', freq: '小时 / 日内更新', tag: '高频时效性', icon: '⚡',
    items: ['当日热点异常得分', '量价资金流得分', '行业自适应鲁棒系数'] },
  { id: 'L4', name: 'AI 框架支撑类', freq: '全周期自适应', tag: '全周期自适应', icon: '🤖',
    items: ['因子正交化变换矩阵', '因子有效性评分', '因子动态权重向量', '组合尾部风险值（CVaR）', '基本面偏离校正系数'] },
];
function fnFactorRender() {
  if (!S.fq) S.fq = { view: 'quant' };
  if (!S.fq.fOpen) S.fq.fOpen = new Set(FQ_FACTORS.map(g => g.id));
  return FQ_FACTORS.map(g => {
    const open = S.fq.fOpen.has(g.id);
    return `<div class="fj-lrow" style="font-size:13px;font-weight:600;align-items:center;">
      <span class="fj-tri fq-fgrp" data-id="${g.id}" style="cursor:pointer;width:18px;text-align:center;">${open ? '▾' : '▸'}</span>
      <span class="fj-tag" style="width:26px;">${g.icon}</span>
      <span>${g.name} <span class="fin-note" style="font-weight:400;">${g.freq} · ${g.tag}</span></span>
      <span style="flex:1;"></span>
      <span class="fin-note">${g.items.length} 项</span>
      <button class="btn sm soft fq-fgrp-a" data-fgroup="${g.id}" style="font-size:11.5px;padding:2px 10px;">分析 →</button>
    </div>
    ${open ? g.items.map(it => `<div class="fj-lrow" style="padding-left:36px;font-size:12.5px;align-items:center;">
      <span class="fj-tag" style="width:26px;">📌</span><span>${it}</span><span style="flex:1;"></span><span class="fin-note">待接入</span>
    </div>`).join('') : ''}`;
  }).join('');
}
/* ============================================================
   因子分析 · 五层信息流（长期/中期/短期组）
   每层四区块：① 上层信息概览 ② 提示词概览 ③ 运行按钮 ④ 结果展示
   第 1 层对接自动采集产品 → AI 补全 JSON；第 2~5 层待配置
   ============================================================ */
const FQ_LAYER_KEY = 'rt_fqlayers';
const FQ_LAYERS = [
  { id: 'base', name: '基础锚定数据层', badge: '对接自动采集 · AI 补全',
    prompt: '任务：产品信息补全。\n输入数据字段：product_id产品唯一代码，product_name产品名称，latest_price最新净值 / 收盘价。\n需要补充字段：product_type产品类型、company_full_name标的公司全称、industry_level1申万一级行业、industry_level2申万二级行业、list_date上市时间。\n规则：\n仅基于输入的product_id、product_name检索补全信息；\nproduct_type：区分股票 / 基金 / 债券等产品类别；\nindustry_level1：严格使用申万一级行业分类，不可自定义行业名称；对基金 / 债券等非股票类产品，若其本身无直接对应的申万一级行业，则填写其资金 / 持仓占比最大的投资行业类型（同样使用申万一级行业名称）；\nindustry_level2：严格使用申万二级行业分类，同样遵循申万分类体系；对基金 / 债券等无直接对应二级行业的产品，填写其资金 / 持仓占比最大的投资行业（申万二级）；无数据填null；\nlist_date：上市日期，格式YYYY-MM-DD；无数据填null；\n所有字段缺失无法查询时，统一填null，禁止空字符串、备注文字放在字段内；\n输出严格仅 JSON，不要解释、不要前言后语、不要 markdown 代码块标记之外多余文字；\nJSON 固定结构，字段顺序固定： { "product_id": "", "product_name": "", "product_type": "", "latest_price": "", "company_full_name": "", "industry_level1": "", "industry_level2": "", "list_date": "" }\n输入示例： product_id:600036, product_name: 招商银行，latest_price:32.15\n输出示例： {"product_id":"600036","product_name":"招商银行","product_type":"股票","latest_price":"32.15","company_full_name":"招商银行股份有限公司","industry_level1":"银行","industry_level2":"股份制银行","list_date":"2002-04-09"}\n现在处理下面输入： {{PRODUCT_INPUT}}' },
  { id: 'firm', name: '总览型基础信息生成层', badge: 'AI 补全 · 客观总览',
    prompt: '【角色】你是上市公司基本面分析助理，严格执行格式要求，不得添加任何额外表述。\n【任务】基于给定的公司基础信息，生成客观总览介绍，仅做事实陈述，不做任何价值判断，不涉及具体财务数据。\n【输入变量】\n公司全称：{{company_full_name}}\n证券代码：{{product_id}}\n所属行业：{{industry_level1}}\n二级行业：{{industry_level2}}\n数据源计划（第 1 层选定，无则填 null）：\n{{data_sources}}\n【输出格式要求】\n严格按照以下 JSON 数组结构输出，不得修改键名、不得新增条目、不得调整顺序，每个条目内容控制在50字以内：\n[\n  { "section": "公司主体信息", "items": { "公司全称": "", "证券代码": "", "上市板块": "", "法定代表人": "" } },\n  { "section": "产业归属定义", "items": { "一级产业": "", "二级细分领域": "", "产业核心定位": "" } },\n  { "section": "核心业务概览", "items": { "主营业务范围": "", "核心产品占比": "" } },\n  { "section": "产业链布局定位", "items": { "所处产业链环节": "", "上游核心依赖": "", "下游核心应用": "" } }\n]\n【强制约束】\n1. 所有信息必须客观可查，禁止编造\n2. 禁止输出任何开场白、结束语、解释说明\n3. 严格保留所有键名与数组顺序，不得修改\n4. 输出严格仅 JSON 数组，不要 markdown 代码块标记之外多余文字',
    prompt2: '【角色】你是中期预期分析助理，严格输出纯JSON，禁止任何额外文本。\n【任务】基于给定的基础数据，生成事实性总览信息，仅做客观陈述，不做任何价值判断与量化评估。新增要求如下：\n1. 事件部分新增事件详情列表，每个事件包含事件类型、事件标题、200字以内的客观事件描述，仅陈述事实不做评价\n2. 产业新闻部分新增「景气方向判断依据」，客观列示支撑景气方向判断的具体事实依据\n3. 舆论部分新增「整体情绪基调判断依据」，客观列示支撑情绪判断的具体数据依据\n【输入变量】\n标的名称：{{product_name}}\n所属行业：{{industry_level2}}\n时间窗口：{{time_window}}\n事件数据集：{{event_dataset}}\n产业数据集：{{industry_dataset}}\n舆情数据集：{{opinion_dataset}}\n【输出要求】\n仅输出合法JSON对象，禁止输出前缀、后缀、解释、markdown，确保可直接JSON.parse解析。\nJSON结构严格遵循以下字段，不得新增、删减、修改键名：\n{\n  "event_overview": {\n    "event_count": "事件总数量",\n    "main_event_types": ["主要事件类型1", "主要事件类型2"],\n    "event_time_distribution": "事件时间分布描述，如上旬集中发布",\n    "core_event_summary": "核心事件一句话总览",\n    "event_list": [\n      {\n        "event_type": "事件类型",\n        "event_title": "事件标题",\n        "event_description": "200字以内的客观事件描述，仅陈述核心事实、时间、主体，不做评价"\n      }\n    ]\n  },\n  "industry_news_overview": {\n    "news_count": "产业新闻总条数",\n    "core_topics": ["核心主题1", "核心主题2"],\n    "boom_direction": "景气方向描述，如边际向好/走弱/持平",\n    "boom_direction_basis": "景气方向判断依据，客观列示支撑判断的具体数据、新闻事实",\n    "industry_chain_involved": ["涉及产业链节点1", "涉及产业链节点2"]\n  },\n  "opinion_overview": {\n    "cover_platforms": ["覆盖平台1", "覆盖平台2"],\n    "total_discussion_volume": "讨论总量级描述",\n    "overall_emotion_tone": "整体情绪基调，如偏正面/偏负面/中性",\n    "overall_emotion_tone_basis": "整体情绪基调判断依据，客观列示情绪占比、讨论倾向等事实数据",\n    "user_structure": "用户结构描述，如机构占比高/散户为主"\n  }\n}\n【强制约束】\n4. 所有内容必须基于输入数据，不得编造\n5. 单条事件描述严格控制在200字以内，仅客观陈述事实，不包含任何评价、预测、观点\n6. 两类判断依据必须对应前文的结论，全部基于输入数据中的具体信息，不得主观推导\n7. 仅输出JSON对象，无任何其他字符' },
  { id: 'industry', name: '核心参数细节评估层', badge: 'AI 补全 · 长期价值',
    prompt: '【角色】你是专业的基本面量化分析师，严格按照指定格式输出，不得添加额外内容。\n【任务】针对目标公司的三个长期价值参数进行细节评估，每个评估小点必须给出明确结论，同时附带论据摘要和数据来源，确保可溯源。\n【输入变量】\n公司全称：{{company_full_name}}\n所属产业：{{industry_level1}}\n产业链定位：{{chain_position}}\n【评估维度与固定条目】\n严格按照以下3个维度、共9个小点展开，不得新增、减少、修改条目：\n1. 规模体量参数：总市值规模、净资产规模、人员与产能规模\n2. 盈利质量参数：ROE水平、盈利现金含量、毛利率稳定性\n3. 成长能力参数：营收复合增速、利润复合增速、研发投入强度\n【输出格式要求】\n严格按照以下 JSON 数组结构输出，不得修改键名、不得新增条目、不得调整顺序，每个小点输出固定四个字段「指标 / 评估结论 / 论据摘要 / 数据来源」：\n[\n  { "section": "规模体量参数评估", "items": [\n    { "指标": "总市值规模", "评估结论": "", "论据摘要": "", "数据来源": "" },\n    { "指标": "净资产规模", "评估结论": "", "论据摘要": "", "数据来源": "" },\n    { "指标": "人员与产能规模", "评估结论": "", "论据摘要": "", "数据来源": "" }\n  ] },\n  { "section": "盈利质量参数评估", "items": [\n    { "指标": "ROE水平", "评估结论": "", "论据摘要": "", "数据来源": "" },\n    { "指标": "盈利现金含量", "评估结论": "", "论据摘要": "", "数据来源": "" },\n    { "指标": "毛利率稳定性", "评估结论": "", "论据摘要": "", "数据来源": "" }\n  ] },\n  { "section": "成长能力参数评估", "items": [\n    { "指标": "营收复合增速", "评估结论": "", "论据摘要": "", "数据来源": "" },\n    { "指标": "利润复合增速", "评估结论": "", "论据摘要": "", "数据来源": "" },\n    { "指标": "研发投入强度", "评估结论": "", "论据摘要": "", "数据来源": "" }\n  ] }\n]\n【强制约束】\n1. 论据必须包含具体数值、时间周期、行业对比基准\n2. 数据来源必须明确到数据库/报告名称+时间节点，如「公司2023年年报（经审计）」「Wind数据库2024Q3」\n3. 禁止输出任何开场白、总结、额外说明\n4. 输出严格仅 JSON 数组，不要 markdown 代码块标记之外多余文字',
    prompt2: '【角色】你是中期预期量化分析师，严格输出纯JSON，禁止任何额外文本。\n【任务】针对4项中期预期参数进行细节评估，每项参数下设3个评估小点，每个小点必须给出明确结论，同时附带论据摘要和数据来源，确保可溯源。\n【输入变量】\n标的名称：{{product_name}}\n所属行业：{{industry_level2}}\n总览信息：{{mid_overview}}\n事件数据集：{{event_dataset}}\n产业数据集：{{industry_dataset}}\n舆情数据集：{{opinion_dataset}}\n【评估维度与固定条目】\n严格按照以下4项参数、共12个小点展开，不得新增、删减、修改条目：\n1. 公司事件预期差：事件类型与强度、预期差幅度、影响半衰期\n2. 产业预期修正：产业新闻情绪边际、景气数据变化、产业链传导影响\n3. 舆论综合得分：讨论量增速、加权情绪倾向、权威权重系数\n4. 舆论分歧度：跨平台分歧度、群体层级分歧、分歧变化趋势\n【输出要求】\n仅输出合法JSON对象，禁止输出任何额外内容。\nJSON结构严格遵循以下格式，不得修改键名：\n{\n  "event_expectation_gap": {\n    "dim_name": "公司事件预期差",\n    "items": [\n      { "item_name": "事件类型与强度", "conclusion": "评估结论", "evidence": "论据摘要，含具体数值与对比基准", "source": "数据来源，明确到库/时间" },\n      { "item_name": "预期差幅度", "conclusion": "", "evidence": "", "source": "" },\n      { "item_name": "影响半衰期", "conclusion": "", "evidence": "", "source": "" }\n    ]\n  },\n  "industry_expectation_correction": {\n    "dim_name": "产业预期修正",\n    "items": [\n      { "item_name": "产业新闻情绪边际", "conclusion": "", "evidence": "", "source": "" },\n      { "item_name": "景气数据变化", "conclusion": "", "evidence": "", "source": "" },\n      { "item_name": "产业链传导影响", "conclusion": "", "evidence": "", "source": "" }\n    ]\n  },\n  "public_opinion_score": {\n    "dim_name": "舆论综合得分",\n    "items": [\n      { "item_name": "讨论量增速", "conclusion": "", "evidence": "", "source": "" },\n      { "item_name": "加权情绪倾向", "conclusion": "", "evidence": "", "source": "" },\n      { "item_name": "权威权重系数", "conclusion": "", "evidence": "", "source": "" }\n    ]\n  },\n  "opinion_divergence": {\n    "dim_name": "舆论分歧度",\n    "items": [\n      { "item_name": "跨平台分歧度", "conclusion": "", "evidence": "", "source": "" },\n      { "item_name": "群体层级分歧", "conclusion": "", "evidence": "", "source": "" },\n      { "item_name": "分歧变化趋势", "conclusion": "", "evidence": "", "source": "" }\n    ]\n  }\n}\n【强制约束】\n5. 论据必须包含具体数值、时间周期、对比基准\n6. 数据来源必须明确到数据库/接口+时间节点\n7. 仅输出JSON，无任何其他字符' },
  { id: 'finance', name: '对抗性审查与置信度层', badge: 'AI 补全 · 对抗审查',
    prompt: '【角色】你是基本面数据审查专员，站在独立质疑的立场进行对抗性复核，不得默认原有结论正确。\n【任务】针对给定的评估小点及其论据，从以下维度审查并给出置信度得分（0-1，保留2位小数，0.1步进）：\n审查维度：\n1. 数据时效性：是否为最新数据，是否存在滞后\n2. 数据权威性：来源是否权威，是否经过审计\n3. 可比性：行业对比基准是否合理，是否存在口径差异\n4. 真实性：是否包含一次性因素、非经常性损益，是否存在会计调整\n【输入变量】\n待审查评估小点（每个小点含「评估指标 / 评估结论 / 论据摘要 / 数据来源」四个字段）：\n{{items_block}}\n【输出格式要求】\n严格按照以下 JSON 数组结构输出，每个评估小点对应一条审查结果，顺序与输入一致，不得新增、减少、修改条目：\n[\n  { "指标名称": "", "置信度得分": 0, "扣分说明": "" },\n  { "指标名称": "", "置信度得分": 0, "扣分说明": "" }\n]\n【强制约束】\n1. 满分1.0，存在问题逐项扣分，扣分说明必须具体到问题点\n2. 禁止无条件认可原有结论，必须至少指出1个潜在风险点\n3. 置信度得分保留2位小数、0.1步进，取值区间0-1\n4. 禁止输出任何额外解释、总结，输出严格仅 JSON 数组',
    prompt2: '【角色】你是独立数据审查专员，站在质疑立场进行对抗性复核，严格输出纯JSON。\n【任务】针对每个评估小点，从以下4个维度审查并给出置信度得分（0-1，保留2位小数，0.05步进）：\n审查维度：\n1. 时效性：数据是否在时间窗口内，是否存在滞后\n2. 权威性：来源是否权威，样本量是否充足\n3. 可比性：对比基准是否合理，是否存在口径差异\n4. 真实性：是否存在水军、炒作、一次性事件干扰\n【输入变量】\n评估小点列表：{{param_mid_evaluation}}\n【输出要求】\n仅输出合法JSON数组，每个元素对应一个评估小点的审查结果，顺序与输入完全一致。\nJSON结构：\n[\n  {\n    "item_name": "指标名称",\n    "confidence_score": 置信度数值,\n    "deduction_reason": "扣分说明，具体到问题点"\n  }\n]\n【强制约束】\n5. 满分1.0，存在问题逐项扣分，扣分说明必须具体\n6. 不得无条件认可，必须至少指出1个潜在风险点\n7. 仅输出JSON数组，无任何其他内容' },
  { id: 'risk', name: '标准化评分输出层', badge: 'AI 补全 · 评分输出', prev: ['industry', 'finance'],
    prompt: '【角色】你是量化评分输出专员，严格按照指定格式输出标准化评分结果，不得添加任何额外内容。\n【任务】基于评估结论与置信度，对每个指标进行0-10分量化评分，最终得分 = 原始得分 × 置信度，保留1位小数。\n评分规则（原始得分，0-10分）：\n- 行业前10%：9-10分\n- 行业前20%-10%：7-8分\n- 行业前40%-20%：5-6分\n- 行业后40%：0-4分\n【输入变量】\n全部参数评估数据（含评估结论、论据摘要、数据来源、置信度得分与扣分说明）：\n{{param_evaluation_full}}\n【输出格式要求】\n仅输出一个 JSON 代码块，不要输出 markdown 表格，不要输出任何解释文字：\n```json\n{\n  "product_id": "{{product_id}}",\n  "product_name": "{{product_name}}",\n  "total_score": 综合得分,\n  "dim_scores": {\n    "scale": 规模体量分,\n    "profit": 盈利质量分,\n    "growth": 成长能力分\n  },\n  "item_scores": [\n    { "name": "总市值规模", "raw_score": 0, "confidence": 0, "final_score": 0 },\n    { "name": "净资产规模", "raw_score": 0, "confidence": 0, "final_score": 0 },\n    { "name": "人员与产能规模", "raw_score": 0, "confidence": 0, "final_score": 0 },\n    { "name": "ROE水平", "raw_score": 0, "confidence": 0, "final_score": 0 },\n    { "name": "盈利现金含量", "raw_score": 0, "confidence": 0, "final_score": 0 },\n    { "name": "毛利率稳定性", "raw_score": 0, "confidence": 0, "final_score": 0 },\n    { "name": "营收复合增速", "raw_score": 0, "confidence": 0, "final_score": 0 },\n    { "name": "利润复合增速", "raw_score": 0, "confidence": 0, "final_score": 0 },\n    { "name": "研发投入强度", "raw_score": 0, "confidence": 0, "final_score": 0 }\n  ]\n}\n```\n【强制约束】\n1. 评分必须依据给定的评估结论与置信度，置信度取自输入中各指标对应值\n2. 最终得分 = 原始得分 × 置信度，保留1位小数\n3. JSON 必须覆盖全部9个指标（item_scores 为 9 项），字段与数值完整，且为合法可解析的 JSON\n4. 禁止输出任何开场白、总结、解释、markdown 表格或 JSON 之外的任何内容',
    prompt2: '【角色】你是量化评分输出专员，严格输出纯JSON，禁止任何额外文本。\n【任务】基于评估结论与置信度，对每个指标进行0-10分量化评分，最终得分 = 原始得分 × 置信度，保留1位小数。\n评分规则（原始得分0-10分）：\n1. 公司事件预期差：正向预期差越大得分越高，负向预期差得分越低，极端负向得0-2分\n2. 产业预期修正：正向边际修正得分高，负向修正得分低，持平得5分\n3. 舆论综合得分：情绪越正面、讨论量增速越快、权威权重越高，得分越高\n4. 舆论分歧度：分歧越大得分越高（拐点信号强度），完全一致得0分\n维度权重：公司事件预期差35%、产业预期修正30%、舆论综合得分25%、舆论分歧度10%\n【输入变量】\n标的代码：{{product_id}}\n标的名称：{{product_name}}\n完整评估数据：{{param_mid_evaluation}}\n【输出要求】\n仅输出合法JSON对象，结构严格如下，不得修改键名：\n{\n  "product_id": "",\n  "product_name": "",\n  "eval_date": "评分日期，YYYY-MM-DD",\n  "item_scores": [\n    {\n      "dim_name": "维度名称",\n      "item_name": "指标名称",\n      "raw_score": 原始得分,\n      "confidence": 置信度,\n      "final_score": 最终得分\n    }\n  ],\n  "dim_summary": [\n    {\n      "dim_name": "公司事件预期差",\n      "dim_avg_score": 维度平均分,\n      "weight": 权重比例,\n      "weighted_score": 加权得分\n    },\n    { "dim_name": "产业预期修正", "dim_avg_score": "", "weight": "", "weighted_score": "" },\n    { "dim_name": "舆论综合得分", "dim_avg_score": "", "weight": "", "weighted_score": "" },\n    { "dim_name": "舆论分歧度", "dim_avg_score": "", "weight": "", "weighted_score": "" }\n  ],\n  "total_mid_score": 中期预期综合得分\n}\n【强制约束】\n5. 所有分值保留1位小数，置信度保留2位小数\n6. 数组顺序与前文严格一致\n7. 仅输出JSON，无任何其他字符' },
];
const FQ_FIELDS = ['product_id', 'product_name', 'product_type', 'latest_price', 'company_full_name', 'industry_level1', 'industry_level2', 'list_date'];
const FQ_FIELD_ZH = { product_id: '产品唯一代码', product_name: '产品名称', product_type: '产品类型', latest_price: '最新净值/收盘价', company_full_name: '标的公司全称', industry_level1: '申万一级行业', industry_level2: '申万二级行业', list_date: '上市时间' };
const FQ_CORE_FIELDS = ['product_id', 'product_name', 'product_type', 'latest_price', 'company_full_name', 'industry_level1', 'list_date'];
/* ---------- 中期 / 短期预期类 · 数据源链路库 ----------
   第一层直接引用长期价值类第 1 层基础信息，由 AI 指定公开数据源（网站 / 软件 / 数据库）。
   打通后的链路全局保存（按申万一级行业聚合），中期 / 短期类共享；换产品仅替换关键词复用。 */
const FQ_DS_KEY = 'rt_fq_datasets';
const FQ_DS_MODE = { L2: true, L3: true };   // 组 id → 第一层为「数据源推荐」模式
function fqDsLoad() {
  /* 数据源链路库（全局 · 仅保存平台名称）：{平台名: {name, type, authority, home, category, industry, ts}}
     具体公告/报告为第一层单次运行资源，不进入本库（随第一层结果历史保存，供第二层爬取与后续可能使用） */
  const lib = finContentGet(FQ_DS_KEY) || {};
  /* 旧格式迁移：产业分组（{industry:{sources}}）/ 平台组（{平台名:{items}}）→ 纯平台名池 */
  const vals = Object.values(lib);
  const needMig = vals.some(v => v && (Array.isArray(v.sources) || Array.isArray(v.items)));
  if (needMig) {
    const nl = {};
    vals.forEach(v => {
      if (!v) return;
      if (Array.isArray(v.sources)) {
        v.sources.forEach(s => {
          if (s && s.name && !nl[s.name]) nl[s.name] = { name: s.name, type: s.type || '', authority: s.authority || '', home: s.home || '', category: s.category || '', industry: v.industry || '', ts: v.ts || '' };
        });
      } else if (Array.isArray(v.items)) {
        if (v.name && !nl[v.name]) nl[v.name] = { name: v.name, type: v.type || '', authority: v.authority || '', home: v.home || '', category: v.category || '', industry: v.industry || '', ts: v.ts || '' };
      }
    });
    fqDsSave(nl);
    return nl;
  }
  return lib;
}
function fqDsPoolTrim(lib, max) {
  /* 数据源链路库上限治理：超出 max 时删除最早进入的条目（按 ts 升序，无 ts 视为最早），返回裁剪后的库 */
  const keys = Object.keys(lib || {});
  if (keys.length <= max) return lib || {};
  const tsOf = n => { const t = (lib[n] && lib[n].ts) || ''; return t ? String(t) : '\u0000'; };
  keys.sort((a, b) => (tsOf(a) < tsOf(b) ? -1 : (tsOf(a) > tsOf(b) ? 1 : 0)));
  const out = {};
  keys.slice(keys.length - max).forEach(n => { out[n] = lib[n]; });
  return out;
}
function fqDsSave(lib) { finContentSet(FQ_DS_KEY, fqDsPoolTrim(lib, 100)); }
function fqDsInd(p) {
  /* 当前产品对应的产业 key（优先 L1.base 的申万一级行业，缺省未分类） */
  const l1 = fqLayerGet('L1', 'base', p.code);
  return (l1 && l1.result && l1.result.industry_level1) || '未分类';
}
function fqDsExisting(p) {
  /* 该产业已收录的平台组清单（供 AI 候选池：仅平台名称 + 分类，不含公告条目；分类未知的平台不进入候选池） */
  const lib = fqDsLoad();
  const ind = fqDsInd(p);
  return Object.keys(lib).map(k => ({ name: lib[k].name, category: lib[k].category, industry: lib[k].industry })).filter(g => g.category && (g.industry === ind || !g.industry));
}
function fqDsSaveSources(p, sources) {
  /* AI 推荐 / 手动添加 → 全局链路库：仅保存平台名称（+ 属性），具体公告/报告为单次运行资源不入库 */
  if (!Array.isArray(sources) || !sources.length) return;
  const lib = fqDsLoad();
  const ind = fqDsInd(p);
  const ts = fmtDate(new Date()) + ' ' + new Date().toTimeString().slice(0, 5);
  sources.forEach(s => {
    if (!s || !s.name) return;
    if (!lib[s.name]) lib[s.name] = { name: s.name, type: s.type || '', authority: s.authority || '', home: s.home || '', category: s.category || '', industry: ind, ts };
    else if (s.category && !lib[s.name].category) lib[s.name].category = s.category;
  });
  fqDsSave(lib);
}
function fqDsPrompt(p, tw, existing) {
  /* 中期预期类第一层 · 数据源推荐提示词（三类平台清单，纯 JSON；候选平台池：库中已有平台优先纳入，每类至多 5 个） */
  const l1 = fqLayerGet('L1', 'base', p.code);
  const b = (l1 && l1.result) || {};
  const comp = b.company_full_name || p.name;
  const ind1 = b.industry_level1 || '';
  const ind2 = b.industry_level2 || '';
  const twv = tw || '一个月';
  /* 候选平台池：该产业链路库已收录的平台（按分类分组，去重） */
  const pool = { company: [], industry: [], discussion: [] };
  (Array.isArray(existing) ? existing : []).forEach(s => {
    const c = s.category;
    if (c && pool[c] && s.name && !pool[c].includes(s.name)) pool[c].push(s.name);
  });
  const poolTxt = ['company', 'industry', 'discussion'].map(c => {
    const zh = c === 'company' ? '公司相关新闻平台' : c === 'industry' ? '行业相关新闻平台' : '投资讨论舆情平台';
    return '  ' + zh + '：' + (pool[c].length ? pool[c].join('、') : '（无）');
  }).join('\n');
  let t = '【角色】你是国内证券市场金融数据源规划专员，专注于输出可落地、合规、权威的数据采集平台清单，严格输出纯JSON。\n'
    + '【任务】根据给定的证券标的与行业信息，输出三类数据采集平台清单，用于中期预期类参数的数据采集。所有平台必须为国内合规可访问、真实存在的主流平台，按权威性从高到低排序。\n'
    + '【输入变量】\n证券代码：' + (p.code || 'null') + '\n标的名称：' + (comp || 'null') + '\n一级行业：' + (ind1 || 'null') + '\n二级行业：' + (ind2 || 'null') + '\n统计时间窗口：' + twv + '\n'
    + '【候选平台池】\n以下为数据源链路库（全局共享，该产业已收录）的平台，请在输出中优先纳入，避免重复推荐：\n' + poolTxt + '\n'
    + '【输出分类与字段要求】\n严格分为3大类，三类共输出恰好 15 个报告源（每类至多 5 个），每个源固定包含6个字段：\n'
    + '1. platform_name：平台名称\n'
    + '2. platform_type：平台类型（官方公告/财经媒体/行业机构/投资社区等）\n'
    + '3. authority_level：权威等级（S/A/B/C四级）\n'
    + '   - S：官方机构/交易所/监管平台，数据100%权威\n'
    + '   - A：主流持牌财经媒体/商业数据商，可信度高\n'
    + '   - B：垂直行业媒体/专业门户，可信度较好\n'
    + '   - C：社区/论坛类平台，用户生成内容\n'
    + '4. suitable_content：适用采集的具体数据内容\n'
    + '5. crawl_keyword：推荐抓取关键词，必须结合输入的标的与行业生成\n'
    + '6. report_url：该具体公告/报告/文本对应的直达网页地址（完整 URL，https 开头，可直接访问），用于爬虫层抓取\n'
    + '【三大分类定义】\n'
    + '6. 公司相关新闻平台：用于采集公司官方公告、重大事件、公司新闻等\n'
    + '7. 行业相关新闻平台：用于采集产业政策、行业动态、景气数据、产业链新闻等\n'
    + '8. 投资讨论舆情平台：用于采集投资者讨论、市场舆论、多空观点等舆情数据\n'
    + '【输出格式】\n仅输出合法JSON对象，禁止输出任何前缀、后缀、解释、markdown，确保可直接JSON.parse解析。\n'
    + 'JSON结构严格如下，不得新增、修改、删除键名：\n'
    + '{\n'
    + '  "company_news_platforms": [\n    { "platform_name": "巨潮资讯网", "platform_type": "官方公告平台", "authority_level": "S", "suitable_content": "上市公司官方公告、定期报告、重大事项披露", "crawl_keyword": "' + (p.code || '') + '", "report_url": "https://www.cninfo.com.cn/new/index" }\n  ],\n'
    + '  "industry_news_platforms": [\n    { "platform_name": "", "platform_type": "", "authority_level": "", "suitable_content": "", "crawl_keyword": "", "report_url": "" }\n  ],\n'
    + '  "investment_discussion_platforms": [\n    { "platform_name": "", "platform_type": "", "authority_level": "", "suitable_content": "", "crawl_keyword": "", "report_url": "" }\n  ]\n}\n'
    + '【强制约束】\n'
    + '9. 所有平台必须为国内真实存在、可正常访问的主流平台，禁止编造\n'
    + '10. 公司新闻平台必须包含至少2个S级官方公告类平台\n'
    + '11. 行业新闻平台必须包含官方行业监管/协会类平台，同时包含综合财经与垂直行业媒体\n'
    + '12. 从候选平台池 + 你补充推荐的新平台中，每个类别各选至多5个平台，按权威等级从高到低排序\n'
    + '13. 推荐抓取关键词必须结合输入的标的名称、证券代码、行业名称生成，具备可执行性\n'
    + '14. 仅输出纯JSON，无任何其他字符、说明、注释、开场白\n'
    + '15. 候选平台池中分类明确的平台优先保留，仅当该类型不足5个时才补充新平台\n'
    + '16. 候选平台池中的平台与新补充平台均须符合上述字段与权威等级要求，不得省略字段\n'
    + '17. 三类报告源合计必须恰好 15 个（每类 1~5 个），不得多不得少\n'
    + '18. 每个源必须给出 report_url：必须为<b>直达该具体公告/报告/文本内容页的网址</b>（https 开头、点击即可直接获取对应信息的页面），禁止给出网站首页/检索页/栏目列表页；若某公告暂无独立网页，则给出其所在检索结果的直链参数并注明；禁止编造或省略网址';
  return t;
}
function fqDsRefreshRef(gid) {
  /* 切换产品 / 时间窗口后刷新第一层引用区 */
  const code = S.fq.lprod || (fnLoad().products[0] || {}).code || '';
  const el = document.getElementById('fq-dsref-' + gid);
  if (el) el.innerHTML = fqDsRefHTML(gid, code);
}
const FQ_EXCL_KEY = 'rt_fq_excl';
function fqExclLoad() { const q = finContentGet(FQ_EXCL_KEY); return (q && typeof q === 'object') ? q : {}; }
function fqExclSave(d) { finContentSet(FQ_EXCL_KEY, d); }
function fqExclGet(gid, code) {
  const d = fqExclLoad();
  return ((d[gid] || {})[code] || []).slice();
}
function fqExclAdd(gid, code, items) {
  /* 追加失败项（跨轮累积，防止补充批次再次推荐） */
  const d = fqExclLoad();
  if (!d[gid]) d[gid] = {};
  if (!d[gid][code]) d[gid][code] = [];
  const list = d[gid][code];
  items.forEach(it => {
    if (it && (it.name || it.url) && !list.some(x => (it.name && x.name === it.name) || (it.url && x.url === it.url))) {
      list.push({ name: it.name || '', url: it.url || '', reason: it.reason || '爬取 / 清洗失败' });
    }
  });
  fqExclSave(d);
}
function fqExclClear(gid, code) {
  /* 清除该产品失败排除记录（轮次内数据仅为本地量：进入新流程时清空历史遗留，流程结束自动删除；
     成功完成后的采纳源已另存于第一层结果 rt_fqlayers，失败记录不持久留存） */
  const d = fqExclLoad();
  if (d[gid] && d[gid][code]) { delete d[gid][code]; if (!Object.keys(d[gid]).length) delete d[gid]; }
  fqExclSave(d);
}
function fqFlowQuota(need) {
  /* 补充轮推荐配额：已达标（缺口=0）的类不再推荐，把火力集中在缺失类加速补满。
     缺 1 类 → 该类输出 15 个；缺 2 类 → 每类各 7 个（约 14）；缺 3 类 → 每类各 5（原全量语义） */
  const miss = ['company', 'industry', 'discussion'].filter(c => (need[c] || 0) > 0);
  const q = { company: 0, industry: 0, discussion: 0 };
  if (miss.length === 0) { q.company = 5; q.industry = 5; q.discussion = 5; }  /* 防御：全达标（正常不会进入补充轮） */
  else if (miss.length === 3) { q.company = 5; q.industry = 5; q.discussion = 5; }
  else if (miss.length === 2) { miss.forEach(c => { q[c] = 7; }); }
  else if (miss.length === 1) { q[miss[0]] = 15; }
  return q;
}
function fqDsPromptSup(p, tw, existing, excludes, need, round, adopted, quota) {
  /* 补充批次提示词：独立精简版（不再拼接首轮全文，避免「恰好 15 / 候选池优先」等首轮规则与补充指令冲突），
     要求输出三类共 15 个全新候选（每类各 5 个），不得与已采纳源 / 失败排除列表重复；
     程序随后自动汇集各轮候选并按类各取 5 个，因此每轮候选越多越早补满 */
  const l1 = fqLayerGet('L1', 'base', p.code);
  const b = (l1 && l1.result) || {};
  const comp = b.company_full_name || p.name;
  const ind1 = b.industry_level1 || '';
  const ind2 = b.industry_level2 || '';
  const twv = tw || '一个月';
  const exclTxt = excludes && excludes.length
    ? excludes.map((e, i) => (i + 1) + '. ' + (e.name || '（未知名）') + (e.url ? '（' + e.url + '）' : '') + ' — ' + (e.reason || '爬取 / 清洗失败')).join('\n')
    : '（无）';
  const adoptTxt = adopted && adopted.length
    ? adopted.map((s, i) => (i + 1) + '. ' + (s.name || '（未知名）') + (s.url ? '（' + s.url + '）' : '')).join('\n')
    : '（无）';
  const needTxt = '公司 ' + (need.company || 0) + ' 个、产业 ' + (need.industry || 0) + ' 个、舆情 ' + (need.discussion || 0) + ' 个（仅作侧重参考，不是输出数量上限）';
  const q = quota || fqFlowQuota(need);
  const qTxt = '公司 ' + q.company + ' 个、产业 ' + q.industry + ' 个、舆情 ' + q.discussion + ' 个';
  /* 按缺口动态分配推荐数量：已达标类不再推荐（输出空数组），只聚焦缺失类加速补满 */
  let taskTxt, sumTxt, flexTxt;
  const miss = ['company', 'industry', 'discussion'].filter(c => (need[c] || 0) > 0);
  if (miss.length === 1) {
    const cn = { company: '公司新闻类（company_news_platforms）', industry: '产业新闻类（industry_news_platforms）', discussion: '投资舆情类（investment_discussion_platforms）' }[miss[0]];
    taskTxt = '当前其余两类数据源均已达标（≥5 个），无需再推荐；本次仅需补充<b>' + cn + '</b>，请输出该类 <b>15 个</b>全新候选数据源；其余两类一律输出空数组 []。';
    sumTxt = '1. 本次合计输出 ' + q[miss[0]] + ' 个（仅 ' + cn + ' 类）；若确实无法提供 15 个不与列表重复的新候选，则输出该类能提供的最多数量（允许少于 15，输出空数组 [] 亦可），其余两类必须输出空数组 []\n';
  } else if (miss.length === 2) {
    const names = miss.map(c => ({ company: '公司新闻类（company_news_platforms）', industry: '产业新闻类（industry_news_platforms）', discussion: '投资舆情类（investment_discussion_platforms）' }[c])).join(' 与 ');
    taskTxt = '当前另一类数据源已达标（≥5 个），无需再推荐；本次仅需补充<b>' + names + '</b>，请输出这两类<b>各 7 个</b>全新候选数据源（合计约 14 个）；已达标类一律输出空数组 []。';
    sumTxt = '1. 本次合计输出约 14 个（缺失两类各 7 个）；若某缺失类确实无法提供 7 个不与列表重复的新候选，则输出该类能提供的最多数量（允许少于 7 或输出空数组 []），其余缺失类仍尽量输出 7 个；已达标类必须输出空数组 []\n';
  } else {
    taskTxt = '请输出<b>三类共 15 个全新候选数据源（每类各 5 个）</b>';
    sumTxt = '1. 三类合计输出 15 个（每类各 5 个）；若某类确实无法提供 5 个不与列表重复的新候选，则输出该类能提供的最多数量（允许 0 个，输出空数组 []），其余类仍尽量输出 5 个\n';
  }
  return '【角色】你是国内证券市场金融数据源规划专员，当前任务为数据源推荐的「补充批次」，只输出全新的数据源候选清单，严格输出纯JSON。\n'
    + '【输入变量】\n证券代码：' + (p.code || 'null') + '\n标的名称：' + (comp || 'null') + '\n一级行业：' + (ind1 || 'null') + '\n二级行业：' + (ind2 || 'null') + '\n统计时间窗口：' + twv + '\n'
    + '【本次任务 · 第 ' + round + ' 轮】\n此前已采纳的部分数据源与已失败的数据源见下方两个列表。'
    + taskTxt + '全部不得与「已采纳列表」或「失败排除列表」中的任一平台名称或网址重复。\n'
    + '【已采纳列表（禁止重复推荐）】\n' + adoptTxt + '\n'
    + '【失败排除列表（禁止再次推荐）】\n' + exclTxt + '\n'
    + '【待补缺口（仅作侧重参考）】\n' + needTxt + '\n'
    + '【本次输出配额】\n' + qTxt + '\n'
    + '【输出分类与字段要求】\n严格分为3大类：company_news_platforms（公司相关新闻平台）、industry_news_platforms（行业相关新闻平台）、investment_discussion_platforms（投资讨论舆情平台）。'
    + '每个源固定包含6个字段：\n'
    + '1. platform_name：平台名称\n'
    + '2. platform_type：平台类型（官方公告/财经媒体/行业机构/投资社区等）\n'
    + '3. authority_level：权威等级（S/A/B/C四级，S=官方机构/交易所/监管平台，A=主流持牌财经媒体/商业数据商，B=垂直行业媒体/专业门户，C=社区/论坛）\n'
    + '4. suitable_content：适用采集的具体数据内容\n'
    + '5. crawl_keyword：推荐抓取关键词，结合标的与行业生成\n'
    + '6. report_url：该具体公告/报告/文本对应的直达网页地址（完整 URL，https 开头，点击即可直接获取对应信息），禁止给出网站首页/检索页/栏目列表页\n'
    + '【输出格式】\n仅输出合法JSON对象，禁止任何前缀、后缀、解释、markdown，确保可直接JSON.parse解析。JSON结构严格如下，不得新增、修改、删除键名：\n'
    + '{\n  "company_news_platforms": [\n    { "platform_name": "", "platform_type": "", "authority_level": "", "suitable_content": "", "crawl_keyword": "", "report_url": "" }\n  ],\n'
    + '  "industry_news_platforms": [\n    { "platform_name": "", "platform_type": "", "authority_level": "", "suitable_content": "", "crawl_keyword": "", "report_url": "" }\n  ],\n'
    + '  "investment_discussion_platforms": [\n    { "platform_name": "", "platform_type": "", "authority_level": "", "suitable_content": "", "crawl_keyword": "", "report_url": "" }\n  ]\n}\n'
    + '【强制约束】\n'
    + sumTxt
    + '2. 全部为国内真实存在、可正常访问的主流平台，禁止编造\n'
    + '3. 所有候选不得与上述两个列表中的任一平台名称或网址重复\n'
    + '4. 公司类须包含至少2个S级官方公告类平台；行业类须包含官方行业监管/协会平台\n'
    + '5. 每类按权威等级从高到低排序\n'
    + '6. report_url 必须为直达具体公告/报告/文本内容页的网址，禁止省略或编造\n'
    + '7. 仅输出纯JSON，无任何其他字符、说明、注释、开场白';
}
function fqDsExclFilter(flat, excludes) {
  /* 补充批次排除项过滤：与失败排除项重复的推荐项自动剔除（不判失败、不计重试），
     非重复项正常进入跨轮合并。
     匹配规则：推荐项带直达网址 → 仅与有网址的失败项按 url 精确比较（同名不同公告不误伤）；
     推荐项无网址 → 按平台名比较，防止同名被误伤 */
  if (!excludes || !excludes.length) return flat;
  return (flat || []).filter(s => {
    if (s.url) return !excludes.some(e => e.url && e.url === s.url);
    return !excludes.some(e => !e.url && e.name && e.name === s.name);
  });
}
const FQ_FLOW_KEY = 'rt_fq_flow_state';
function fqFlowStateGet(gid, code) {
  const d = loadJSON(FQ_FLOW_KEY, {});
  return ((d[gid] || {})[code]) || null;
}
function fqFlowStateSet(gid, code, st) {
  /* 断点续跑状态：记录当前轮次 / 步骤 / 时间戳（各步骤数据分别存于 rt_fqlayers / rt_fq_crawl / rt_fq_crawl_clean / rt_fq_excl） */
  const d = loadJSON(FQ_FLOW_KEY, {});
  if (!d[gid]) d[gid] = {};
  d[gid][code] = { round: st.round, step: st.step, tw: st.tw || '', msg: st.msg || '', updatedAt: fmtDate(new Date()) + ' ' + new Date().toTimeString().slice(0, 5) };
  localStorage.setItem(FQ_FLOW_KEY, JSON.stringify(d));
}
function fqFlowStateClear(gid, code) {
  const d = loadJSON(FQ_FLOW_KEY, {});
  if (d[gid]) delete d[gid][code];
  localStorage.setItem(FQ_FLOW_KEY, JSON.stringify(d));
}
function fqFlowStepName(step) {
  return ({ ai: '① AI 数据源推荐', crawl: '② 爬虫层抓取', clean: '③ AI 清洗', check: '④ 校验 / 补充' })[step] || step;
}
function fqSleep(ms) { return new Promise(r => setTimeout(r, ms)); }
/* 各层回复的结构门控类型（透传后端 expect，等待整体 JSON 闭合后才判完成，防止流式增量渲染中途误判）：
   rec=数据源推荐三键 · clean=清洗三组 · firm=总览三键 · mid3=中期第 3 层四维之一 · fin=审查数组 · risk=评分对象 */
const FQ_EXPECT = { base: 'rec', firm: 'firm', industry: 'mid3', finance: 'fin', risk: 'risk' };
function fqExpectOf(gid, lid) {
  /* 按组别选择后端结构门控：
     L2/L3（中期 / 短期预期类）= FQ_EXPECT 结构门控（数据源推荐 rec / 总览 firm / 第3层 mid3 / 审查 fin / 评分 risk）；
     L1（长期价值类）= 各层输出结构专用门控：base 产品补全对象（prod）、firm/industry 顶层数组（l1arr）、
     finance 审查数组（l1arrfin）、risk 评分对象（risk）——防止后端 _last_json 对象型/数组型
     提取优先误取数组内部单条对象或内部 items 数组。 */
  if (!FQ_DS_MODE[gid]) {
    if (lid === 'base') return 'prod';
    if (lid === 'finance') return 'l1arrfin';
    if (lid === 'risk') return 'risk';
    return 'l1arr';
  }
  return FQ_EXPECT[lid] || '';
}
function fqChatPost(url, message, timeoutMs, expect) {
  /* 网页会话请求：默认 195 秒超时（AbortController）；支持全局中断（FQ_ABORT 置位时立即中止）。
     expect：'rec'（推荐三键）/ 'clean'（清洗三组）—— 后端据此校验回复结构完整后才判完成，
     避免流式渲染中途把「单条可解析对象」误判为完整回复 */
  if (FQ_ABORT) return Promise.resolve({ ok: false, aborted: true, error: '⛔ 已手动中断' });
  const ctl = new AbortController();
  FQ_ABORT_CTLS.add(ctl);
  const tm = setTimeout(() => ctl.abort(), timeoutMs || 195000);
  return fetch('/api/plugin/webchat/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, message, expect: expect || '' }),
    signal: ctl.signal,
  }).then(r => r.json()).then(r => { clearTimeout(tm); FQ_ABORT_CTLS.delete(ctl); return r; })
    .catch(e => { clearTimeout(tm); FQ_ABORT_CTLS.delete(ctl); const ab = !!(FQ_ABORT && e && e.name === 'AbortError'); return { ok: false, error: ab ? '⛔ 已手动中断' : (e && e.name === 'AbortError' ? '超时（' + ((timeoutMs || 195000) / 1000) + ' 秒无响应）' : (e.message || String(e))), timeout: !!(e && e.name === 'AbortError' && !ab), aborted: ab }; });
}
function fqChatRestart() {
  /* 网页会话卡住 / 超时：强制重启浏览器（后端立即关闭浏览器，worker 异常路径自动重建并进入默认网址热页） */
  return fetch('/api/plugin/webchat/restart', { method: 'POST' }).then(r => r.json()).catch(() => ({ ok: false }));
}
function fqFlowRender(gid, st) {
  /* 一键信息流过程可视化：阶段 chips + 进度条 + 消息（容器 fq-flow-prog-<gid>） */
  const el = document.getElementById('fq-flow-prog-' + gid);
  if (!el) return;
  const steps = [
    { k: 'ai', name: '① AI 数据源推荐', icon: '🤖' },
    { k: 'crawl', name: '② 爬虫层抓取', icon: '🕷' },
    { k: 'clean', name: '③ AI 清洗', icon: '🧹' },
    { k: 'check', name: '④ 校验 / 补充', icon: '🔍' },
    { k: 'done', name: '⑤ 输出有效信息流', icon: '✅' },
  ];
  const chips = steps.map(s => {
    let cls = 'fin-note', txt = '等待';
    if (st.phase === 'done' || st.phase === 'fail') {
      /* 完成 / 停止态：所有步骤统一终态（done 步骤不再误判「进行中」——phase 与步骤 k 同名撞分支） */
      cls = 'fin-note'; txt = st.phase === 'done' ? '完成' : '—';
    }
    else if (st.phase === s.k) { cls = ''; txt = '进行中…'; }
    else if (st.doneIdx != null && steps.indexOf(s) < st.doneIdx) { cls = ''; txt = '完成'; }
    return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11.5px;padding:2px 8px;border-radius:12px;border:1px solid rgba(0,0,0,.1);${txt === '进行中…' ? 'background:rgba(99,102,241,.14);color:#6366f1;font-weight:600;' : (txt === '完成' ? 'background:rgba(46,158,107,.14);color:#2e9e6b;font-weight:600;' : 'color:var(--text-dim);')}">${s.icon} ${s.name} ${txt === '进行中…' ? '· 进行中' : txt}</span>`;
  }).join(' ');
  let bar = 0;
  if (st.doneIdx != null) bar = Math.min(100, Math.round(st.doneIdx / steps.length * 100) + (st.phase !== 'done' && st.phase !== 'fail' ? 12 : 0));
  if (st.phase === 'done') bar = 100;
  el.innerHTML = `<div style="border:1px solid rgba(99,102,241,.25);border-radius:10px;padding:8px 12px;background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(46,158,107,.06));">
    <div style="font-size:12px;font-weight:600;margin-bottom:6px;">⚡ 一键输出有效信息流 · ${st.round ? '第 ' + st.round + ' 轮' : ''}${st.phase === 'done' ? ' · 已完成' : (st.phase === 'fail' ? ' · 已停止' : ' · 进行中')}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">${chips}</div>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;">
      <div style="flex:1;height:7px;background:rgba(0,0,0,.07);border-radius:4px;overflow:hidden;">
        <div style="height:100%;width:${bar}%;background:linear-gradient(90deg,#6366f1,#2e9e6b);transition:width .3s;"></div>
      </div>
      <span class="fin-note" style="font-size:11px;white-space:nowrap;">${st.phase === 'done' ? '100%' : (st.phase === 'fail' ? '停止' : bar + '%')}</span>
    </div>
    <div class="fin-note" style="font-size:11.5px;line-height:1.6;">${st.msg || ''}</div>
    ${st.cleanInfo ? '<div style="font-size:11.5px;line-height:1.6;color:#6366f1;font-weight:600;margin-top:2px;">🧹 清洗批次 ' + st.cleanInfo.idx + ' / ' + st.cleanInfo.total + ' · 条目 ' + st.cleanInfo.itemIdx + ' / ' + st.cleanInfo.itemTotal + ' · 单批 ' + st.cleanInfo.chars + ' 字符（上限 10000）</div>' : ''}
    ${(st.phase !== 'done' && st.phase !== 'fail' && st.phase !== 'abort') ? '<div style="margin-top:6px;text-align:right;"><button class="btn sm fq-abort" data-gid="' + gid + '" style="font-size:12px;padding:2px 14px;background:#d2455a;color:#fff;border:none;border-radius:8px;cursor:pointer;">⛔ 中断 AI 任务</button></div>' : ''}
  </div>`;
  const ab = el.querySelector('.fq-abort');
  if (ab) ab.onclick = () => fqAbortNow('一键信息流');
  /* 已纳取数据库分布：每轮清洗完成后同步刷新（读已保存的 base 采纳源 + 清洗成功结果） */
  try {
    const psel = ROOT.querySelector('.fq-lsel[data-gid="' + gid + '"]');
    const pcode = psel && psel.value;
    const poolEl = document.getElementById('fq-flow-pool-' + gid);
    if (poolEl && pcode) poolEl.innerHTML = fqFlowPoolHTML(gid);
    /* 同步刷新第二层结果展示区（数据库可视化已并入第二层结果展示） */
    const firmEl = document.getElementById('fq-lres-' + gid + '-firm');
    if (firmEl && pcode) {
      const fres = fqLayerGet(gid, 'firm', pcode);
      firmEl.innerHTML = `<div style="margin-bottom:10px;">${fqFlowPoolHTML(gid, pcode)}</div>${fqLayerResHTML(fres, gid)}`;
    }
  } catch (e) { /* 分布渲染失败不影响信息流主流程 */ }
}
function fqFlowPoolHTML(gid, code) {
  /* 已纳取数据库分布：从 base 采纳源（含 category）+ 清洗成功结果（rt_fq_crawl_clean）统计，
     每轮清洗完成后由 fqFlowRender 自动刷新；按 公司新闻 / 产业新闻 / 投资舆情 三列展示 */
  const sel = code ? null : ROOT.querySelector('.fq-lsel[data-gid="' + gid + '"]');
  code = code || (sel && sel.value);
  if (!code) return '';
  const b = fqLayerGet(gid, 'base', code);
  const rr = b && b.result;
  const all = (rr && (Array.isArray(rr.selected) && rr.selected.length ? rr.selected : rr.sources)) || [];
  const cl = fqCrawlCleanGet(gid, code);
  const cat = { company: '公司新闻', industry: '产业新闻', discussion: '投资舆情' };
  const dot = { company: '#2e9e6b', industry: '#6366f1', discussion: '#f59e0b' };
  const cols = ['company', 'industry', 'discussion'].map(c => {
    const ok = all.filter(s => s.category === c && cl && Array.isArray(cl[c]) && cl[c].some(it => it.url === s.url));
    const names = ok.map(s => '• ' + (s.name || '')).slice(0, 5);
    const extra = ok.length > 5 ? ok.length - 5 : 0;
    return `<div style="flex:1;min-width:168px;border:1px solid rgba(0,0,0,.08);border-radius:10px;padding:8px 10px;background:#fff;">
      <div style="font-size:12px;font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${dot[c]};display:inline-block;"></span>${cat[c]}
        <span style="margin-left:auto;font-size:11.5px;background:rgba(99,102,241,.1);color:#6366f1;border-radius:10px;padding:0 8px;">${ok.length}/5</span>
      </div>
      <div style="font-size:11.5px;line-height:1.75;color:var(--text-dim);word-break:break-all;">${names.length ? names.join('<br>') + (extra ? '<br><span class="fin-note">… 其余 ' + extra + ' 个</span>' : '') : '<span class="fin-note">— 尚未纳入</span>'}</div>
    </div>`;
  }).join('');
  const total = ['company', 'industry', 'discussion'].reduce((a, c) => a + all.filter(s => s.category === c && cl && Array.isArray(cl[c]) && cl[c].some(it => it.url === s.url)).length, 0);
  return `<div style="border:1px dashed rgba(0,0,0,.12);border-radius:10px;padding:8px 12px;background:rgba(255,255,255,.6);">
    <div style="font-size:12px;font-weight:600;margin-bottom:6px;">📦 已纳取数据库分布 <span class="fin-note" style="font-weight:400;">（每轮 AI 清洗完成后同步纳入 · 当前共 ${total} 个）</span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">${cols}</div>
  </div>`;
}
async function fqFlowStepAI(gid, p, tw, round, excludes, need, st) {
  /* 第一层数据源推荐（含补充批次提示词 + 排除项校验）：web 通道 ≤3 次重试；
     补充轮按缺口配额（已达标类不推荐，缺 1 类出 15 / 缺 2 类各 7 / 缺 3 类各 5）加速补满 */
  st.phase = 'ai'; st.round = round;
  const quota = round > 1 ? fqFlowQuota(need) : null;
  st.msg = '⏳ 第 1 层 · AI 数据源推荐 · 第 ' + round + ' 轮' + (round > 1 ? '（补充批次：排除 ' + excludes.length + ' 项 · 配额 公司 ' + (quota && quota.company) + ' / 产业 ' + (quota && quota.industry) + ' / 舆情 ' + (quota && quota.discussion) + '）' : '');
  fqFlowRender(gid, st);
  let url = await fqLayerWebSess('base');
  if (!url) throw new Error('网页会话不可用（请先在 AI 工作台添加会话链接或完成登录）');
  const twTxt = fqTwText(gid, tw);
  /* 补充轮：读取第一层已采纳的累积源（fqFlowExec 每轮 merge 后已保存），并入提示词禁止重复 */
  const adoptSrcs = round === 1 ? [] : (() => {
    const b = fqLayerGet(gid, 'base', p.code);
    const rr = b && b.result;
    return (rr && (Array.isArray(rr.selected) && rr.selected.length ? rr.selected : rr.sources)) || [];
  })();
  const prompt = round === 1 ? fqDsPrompt(p, twTxt, fqDsExisting(p)) : fqDsPromptSup(p, twTxt, fqDsExisting(p), excludes, need, round, adoptSrcs, quota);
  let attempts = 0, lastErr = '', restarted = false;
  while (true) {
    fqAbortCheck();
    attempts++;
    st.msg = '⏳ 第 1 层 · AI 数据源推荐 · 第 ' + round + ' 轮 · 尝试 ' + attempts + '/3（会话 …' + url.slice(-10) + '）' + (restarted ? ' · 浏览器已重启' : '');
    fqFlowRender(gid, st);
    const r = await fqChatPost(url, prompt, 195000, 'rec');
    if (r && r.ok) {
      const obj = fqParseJSON(r.text);
      const bad = fqValidateResult(gid, 'base', obj) || fqDsShapeBad(obj, quota);
      const flat = bad ? [] : fqDsFlatten(obj);
      /* 补充轮：与失败排除项重复的推荐自动剔除（无需认为失败、不计入重试）；结构/数量校验仍判失败 */
      const flat2 = (round > 1 && flat.length) ? fqDsExclFilter(flat, excludes) : flat;
      const dupN = flat.length - flat2.length;
      if (!bad) {
        if (r.url && r.url !== url) { if (!S.fq.webSess) S.fq.webSess = {}; S.fq.webSess[FQ_WEB_GROUP.base || 'A'] = r.url; }
        /* 本轮产出交由 fqFlowExec 跨轮合并后统一保存（单轮数量不足 15 不判失败；全为重复项时无新增亦不判失败） */
        return { ok: true, srcs: flat2, attempts, dupN };
      }
      lastErr = bad;
      if (lastErr && r && r.text) lastErr += '（回复前 300 字符：' + (() => { const _t = String(r.text); return _t.slice(0, 300).replace(/\s+/g, ' ') + ' · len=' + _t.length + ' {=' + (_t.match(/\{/g) || []).length + ' }=' + (_t.match(/\}/g) || []).length + ' [=' + (_t.match(/\[/g) || []).length + ' ]=' + (_t.match(/\]/g) || []).length; })() + '）';
    } else {
      if (r && r.aborted) return { ok: false, aborted: true, lastErr: '⛔ 已手动中断' };
      lastErr = (r && r.error) || '未知错误';
      if (r && (r.timeout || r.code === 'need_login' || (r.error && r.error.indexOf('未等到新回复') >= 0))) {
        /* 超时 / 登录失效 / 页面无新回复：重启浏览器 → 重取会话 → 继续重试（本批仅重启一次） */
        if (!restarted) {
          restarted = true;
          st.msg = '⚠ 第 ' + attempts + ' 次尝试' + (r.timeout ? '超时（等待超限）' : (r.code === 'need_login' ? '登录失效' : '无新回复')) + ' —— 正在重启浏览器并重新连接…';
          fqFlowRender(gid, st);
          await fqChatRestart();
          try { const u2 = await fqLayerWebSess('base'); if (u2) url = u2; } catch (e) { lastErr = e.message || lastErr; }
        }
      }
    }
    if (attempts >= 3) return { ok: false, lastErr };
    /* 失败后冷却再重试：DS 可能仍在思考上一条回复，立即重发会打断生成并触发「频繁发送」报错 */
    st.msg = '⏸ 第 ' + attempts + ' 次尝试失败（' + lastErr + '）—— 冷却 12 秒后重试（等待 DS 完成上一条回复）';
    fqFlowRender(gid, st);
    await fqSleep(12000);
  }
}
async function fqFlowStepCrawl(gid, code, srcs, okSet, st, round) {
  /* 爬虫层：串行抓取本批新增（不在 okSet 的）数据源 */
  st.phase = 'crawl';
  const d = fqCrawlLoad();
  if (!d[gid]) d[gid] = {};
  if (!d[gid][code]) d[gid][code] = {};
  const map = d[gid][code];
  /* 跳过已在 okSet 的源；续跑断点（crawl）时已成功抓取的源（map.ok）也不重爬 */
  const todo = srcs.filter(s => s.url && !okSet.has(s.url) && !(map[s.url] && map[s.url].ok));
  const skipN = srcs.length - todo.length;
  let okN = 0;
  for (let i = 0; i < todo.length; i++) {
    fqAbortCheck();
    const s = todo[i];
    st.msg = '⏳ 爬虫层 · 抓取 ' + (i + 1) + '/' + todo.length + '（' + s.name + '）· 第 ' + round + ' 轮 · 本轮候选 ' + srcs.length + ' 源' + (skipN ? '（跳过已成功 ' + skipN + '）' : '');
    fqFlowRender(gid, st);
    map[s.url] = { ...(map[s.url] || {}), run: true };
    try {
      const res = await apiPost('/api/plugin/finance/crawl', { url: s.url });
      if (res && res.aborted) break;
      if (res && res.ok) { map[s.url] = { ok: true, snippet: res.snippet || '', len: res.len || 0, full: res.full || '', ts: Date.now() }; okN++; }
      else { map[s.url] = { ok: false, err: (res && res.error) || '未知错误', ts: Date.now() }; }
    } catch (e) { if (FQ_ABORT) break; map[s.url] = { ok: false, err: e.message || String(e), ts: Date.now() }; }
    fqCrawlSave(d);
  }
  st.msg = '爬虫层完成：成功 ' + okN + ' / ' + todo.length + '（' + srcs.filter(s => s.url && okSet.has(s.url)).length + ' 个此前已成功，跳过）';
  fqFlowRender(gid, st);
  return okN;
}
function fqCleanPromptFor(groups, map, capC) {
  /* 参数化清洗提示词：groups={company:[s...],industry:[...],discussion:[...]}。
     s.__compress=true  → 该条目为超长原文，提示词要求清洗后 ≤ capC 字符（允许适当压缩）；
     s.__cut=N          → 超长原文只发送前 N 字符片段（不在正文内写「已截断」类元文本，
                           片段性质以正文外的注记说明，避免污染正文、干扰 DS 清洗）；
     空组明确要求输出空数组；字符数随返回 */
  const limit = capC || 10000;
  const compressMode = ['company', 'industry', 'discussion'].some(c => (groups[c] || []).some(s => s.__compress));
  const fmt = c => {
    const list = groups[c] || [];
    if (!list.length) return '（本批无该组条目，对应数组输出空 []）';
    return list.map((s, i) => {
      const sd = map[s.url] || {};
      let body = sd.full || sd.snippet || '';
      let note = '';
      if (s.__cut != null && body.length > s.__cut) { body = body.slice(0, s.__cut); note += '\n（注：该条为超长原文截取的前 ' + s.__cut + ' 字符片段，可能不完整，仅清洗所给片段）'; }
      if (s.__compress) note += '\n（注：该条原文超长，清洗后正文字数必须 ≤ ' + limit + ' 字符，可适当压缩，但须保留全部事实与关键数据：数字、日期、机构名称）';
      return (i + 1) + '. ' + (s.name || '') + (s.type ? '（' + s.type + (s.authority ? ' · ' + s.authority : '') + '）' : '') + ' — ' + (s.desc || '') + '\n网址：' + (s.url || '') + note + '\n正文：' + body;
    }).join('\n');
  };
  const prompt = '【角色】你是网页正文清洗专员，严格输出纯JSON，禁止任何额外文本。\n'
    + '【任务】对给定三个信息组中的每条信息进行清洗：判断该条是否包含有效正文。\n'
    + '1. 若该条内容明显不含正文（如仅导航、空白、错误页提示、登录墙、验证码等），返回 status="failed"；\n'
    + (compressMode
      ? '2. 若含有正文，则筛除 UI 界面元素、广告、导航、页脚、推荐位等非正文内容，返回纯正文；清洗后正文字数必须 ≤ ' + limit + ' 字符：若原文超过该长度，可适当压缩（删除重复与次要信息、精简表述），但必须保留全部事实与关键数据（数字、日期、机构名称），不得改变原意。\n'
      : '2. 若含有正文，则筛除 UI 界面元素、广告、导航、页脚、推荐位等非正文内容，将纯正文直接返回：不做摘要、不改写、不翻译、不评价，保留原文（仅适度压缩多余空白）。\n')
    + '【输入变量】\n公司事件信息组（company）：\n' + fmt('company') + '\n\n产业新闻信息组（industry）：\n' + fmt('industry') + '\n\n舆情讨论信息组（discussion）：\n' + fmt('discussion') + '\n'
    + '【输出要求】仅输出合法JSON对象，禁止输出前缀、后缀、解释、markdown，确保可直接JSON.parse解析。JSON结构严格如下，不得新增、删减、修改键名：\n'
    + '{\n  "company": [ { "url": "原网址", "status": "ok或failed", "title": "正文标题或空字符串", "content": "清洗后正文；failed 时为空字符串" } ],\n'
    + '  "industry": [ { "url": "原网址", "status": "ok或failed", "title": "正文标题或空字符串", "content": "清洗后正文；failed 时为空字符串" } ],\n'
    + '  "discussion": [ { "url": "原网址", "status": "ok或failed", "title": "正文标题或空字符串", "content": "清洗后正文；failed 时为空字符串" } ]\n}\n'
    + '【强制约束】1. 每组条目必须对应输入中的网址，不得新增、删除或改序；无条目的组输出空数组\n2. 对明显无正文的条目必须返回 "failed"，不得编造内容\n'
    + (compressMode ? '3. 超长条目的清洗后正文必须 ≤ ' + limit + ' 字符（允许压缩但不得改变事实与关键数据）；普通条目的正文保持原样，仅筛除非正文成分\n' : '3. 正文保持原样，仅筛除非正文成分，不做摘要、改写、翻译\n')
    + '4. 仅输出JSON对象，无任何其他字符';
  return { prompt, chars: prompt.length };
}
function fqCleanSplitBatches(add, map, capChars, capItems) {
  /* 清洗拆批（字数限制与组别并列）：
     1. 先按组别分开；
     2. 组内正文 > capChars 的单条 → 独立批次（该条 >2×capChars 时只发送前 2×capChars 片段），
        提示词要求清洗后 ≤ capChars（允许压缩）；
     3. 其余普通条（正文 ≤ capChars）按 ≤capItems 条合批；若整批提示词 > capChars，
        则把批内最长条移出独立成批，直到整批 ≤ capChars；
     4. 极端情况（模板开销使单条仍超限）：截断该条正文至 capChars 附近并标记压缩。
     返回 [{ c, items, prompt, chars, trimmed, single?, compress? }] */
  const capC = capChars || 10000, capI = capItems || 5;
  const batches = [];
  ['company', 'industry', 'discussion'].forEach(c => {
    const list = add.filter(s => s.category === c);
    const normal = [], single = [];
    list.forEach(s => {
      const sd = map[s.url] || {};
      const len = (sd.full || sd.snippet || '').length;
      if (len > capC) single.push(s);   /* 超长单条：独立批次，需压缩 */
      else normal.push(s);
    });
    /* 超长单条：每条独立成批（正文 >2×capC 时截取前 2×capC 发送） */
    single.forEach(s => {
      const sd = map[s.url] || {};
      const full = sd.full || sd.snippet || '';
      const s2 = Object.assign({}, s);
      if (full.length > capC * 2) s2.__cut = capC * 2;
      s2.__compress = true;
      const groups = { company: [], industry: [], discussion: [] };
      groups[c] = [s2];
      const p1 = fqCleanPromptFor(groups, map, capC);
      batches.push({ c, items: [s2], prompt: p1.prompt, chars: p1.chars, trimmed: [], single: true, compress: true });
    });
    /* 普通条合批；整批超限 → 移出最长条独立成批 */
    for (let i = 0; i < normal.length; i += capI) {
      const items = normal.slice(i, i + capI);
      let groups = { company: [], industry: [], discussion: [] };
      groups[c] = items;
      let p1 = fqCleanPromptFor(groups, map, capC);
      while (p1.prompt.length > capC && items.length > 1) {
        let mi = 0, mL = -1;
        items.forEach((s, k) => { const sd = map[s.url] || {}; const L = (sd.full || sd.snippet || '').length; if (L > mL) { mL = L; mi = k; } });
        const big = items.splice(mi, 1)[0];
        const gs = { company: [], industry: [], discussion: [] };
        gs[c] = [big];
        const ps = fqCleanPromptFor(gs, map, capC);
        batches.push({ c, items: [big], prompt: ps.prompt, chars: ps.chars, trimmed: [] });
        groups = { company: [], industry: [], discussion: [] };
        groups[c] = items;
        p1 = fqCleanPromptFor(groups, map, capC);
      }
      if (items.length === 0) continue;
      /* 兜底：单条仍超限（模板开销）→ 截断正文至 capC 附近并标记压缩 */
      if (p1.prompt.length > capC) {
        const s2 = Object.assign({}, items[0]);
        s2.__cut = Math.max(0, capC - 1200);
        s2.__compress = true;
        const gs = { company: [], industry: [], discussion: [] };
        gs[c] = [s2];
        const ps = fqCleanPromptFor(gs, map, capC);
        batches.push({ c, items: [s2], prompt: ps.prompt, chars: ps.chars, trimmed: [], single: true, compress: true });
        continue;
      }
      batches.push({ c, items, prompt: p1.prompt, chars: p1.chars, trimmed: [] });
    }
  });
  return batches;
}
async function fqFlowStepClean(gid, code, srcs, okSet, st) {
  /* AI 清洗（web 通道）：将本批新增源按「≤5 条 / ≤10000 字符」双重限制拆为多个批次，逐批发送；
     每批独立 ≤3 次重试（超时 / 登录失效自动重启浏览器）；
     全部批成功 → {ok, obj(合并)}；某批 3 次全败 → {ok:false, lastErr, partial(已完成批)} */
  st.phase = 'clean';
  const map = fqCrawlGet(gid, code);
  const add = srcs.filter(s => s.url && !okSet.has(s.url) && map[s.url] && map[s.url].ok);
  if (!add.length) { st.msg = 'AI 清洗：本批无可新增源（全部已成功或无可抓取内容）'; fqFlowRender(gid, st); return { ok: true, obj: { company: [], industry: [], discussion: [] } }; }
  const batches = fqCleanSplitBatches(add, map, 10000, 5);
  const merged = { company: [], industry: [], discussion: [] };
  const seen = new Set();
  const pushOk = (c, it) => { if (it && it.status === 'ok' && it.url && !seen.has(it.url)) { seen.add(it.url); merged[c].push({ url: it.url, status: 'ok', title: it.title || '', content: it.content || '' }); } };
  st.cleanInfo = { idx: 0, total: batches.length, chars: 0, itemIdx: 0, itemTotal: 0 };
  let url = await fqLayerWebSess('base');
  if (!url) throw new Error('网页会话不可用（请先在 AI 工作台添加会话链接或完成登录）');
  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    st.cleanInfo.idx = bi + 1; st.cleanInfo.itemTotal = batch.items.length; st.cleanInfo.chars = batch.chars; st.cleanInfo.itemIdx = 0;
    let attempts = 0, lastErr = '', restarted = false;
    while (true) {
      attempts++;
      st.msg = '🧹 AI 清洗 · 批次 ' + (bi + 1) + '/' + batches.length + '（' + batch.items.length + ' 条 · ' + batch.chars + ' 字符' + (batch.single ? ' · 独立单条' : '') + (batch.compress ? ' · 超长压缩' : '') + '）· 尝试 ' + attempts + '/3（会话 …' + url.slice(-10) + '）' + (restarted ? ' · 浏览器已重启' : '');
      fqFlowRender(gid, st);
      const res = await fqChatPost(url, batch.prompt, 195000, 'clean');
      if (res && res.ok) {
        const obj = fqParseJSON(res.text);
        const bad = fqCrawlCleanBad(obj);
        if (!bad) {
          ['company', 'industry', 'discussion'].forEach(c => { (obj[c] || []).forEach(it => pushOk(c, it)); });
          st.cleanInfo.itemIdx = batch.items.length;
          st.msg = '✅ AI 清洗 · 批次 ' + (bi + 1) + '/' + batches.length + ' 完成（' + batch.items.length + ' 条已处理）';
          fqFlowRender(gid, st);
          break;
        }
        lastErr = bad;
        if (bad && res && res.text) lastErr = bad + '（回复前 300 字符：' + (() => { const _t = String(res.text); return _t.slice(0, 300).replace(/\s+/g, ' ') + ' · len=' + _t.length + ' {=' + (_t.match(/\{/g) || []).length + ' }=' + (_t.match(/\}/g) || []).length + ' [=' + (_t.match(/\[/g) || []).length + ' ]=' + (_t.match(/\]/g) || []).length; })() + '）';
      } else {
        if (res && res.aborted) return { ok: false, aborted: true, lastErr: '⛔ 已手动中断', partial: merged };
        lastErr = (res && res.error) || '未知错误';
        if (res && (res.timeout || res.code === 'need_login' || (res.error && res.error.indexOf('未等到新回复') >= 0))) {
          if (!restarted) {
            restarted = true;
            st.msg = '⚠ AI 清洗批次 ' + (bi + 1) + '/' + batches.length + ' 第 ' + attempts + ' 次尝试' + (res.timeout ? '超时（等待超限）' : (res.code === 'need_login' ? '登录失效' : '无新回复')) + ' —— 正在重启浏览器并重新连接…';
            fqFlowRender(gid, st);
            await fqChatRestart();
            try { const u2 = await fqLayerWebSess('base'); if (u2) url = u2; } catch (e) { lastErr = e.message || lastErr; }
          }
        }
      }
      if (attempts >= 3) return { ok: false, lastErr, partial: merged };
      /* 批次失败后冷却：避免打断 DS 上一条回复的生成（触发频繁发送报错） */
      st.msg = '⏸ 清洗批次 ' + (bi + 1) + '/' + batches.length + ' 第 ' + attempts + ' 次尝试失败（' + lastErr + '）—— 冷却 12 秒后重试';
      fqFlowRender(gid, st);
      await fqSleep(12000);
    }
  }
  st.cleanInfo = null;
  st.msg = 'AI 清洗完成：全部 ' + batches.length + ' 个批次处理完毕（有效正文 ' + seen.size + ' 条）';
  fqFlowRender(gid, st);
  return { ok: true, obj: merged };
}
function fqFlowMergeClean(gid, code, oldClean, newObj) {
  /* 合并清洗结果：旧 ok 条目 + 本批 ok 条目（按 url 去重），failed 条目剔除；保存并返回 merged */
  const merged = { company: [], industry: [], discussion: [] };
  ['company', 'industry', 'discussion'].forEach(c => {
    const seen = new Set();
    const keep = (oldClean && oldClean[c]) || [];
    keep.forEach(it => { if (it && it.status === 'ok' && it.url && !seen.has(it.url)) { seen.add(it.url); merged[c].push({ url: it.url, status: 'ok', title: it.title || '', content: it.content || '' }); } });
    ((newObj && newObj[c]) || []).forEach(it => { if (it && it.status === 'ok' && it.url && !seen.has(it.url)) { seen.add(it.url); merged[c].push({ url: it.url, status: 'ok', title: it.title || '', content: it.content || '' }); } });
  });
  const d = fqCrawlCleanLoad();
  if (!d[gid]) d[gid] = {};
  d[gid][code] = { company: merged.company, industry: merged.industry, discussion: merged.discussion, ts: fmtDate(new Date()) + ' ' + new Date().toTimeString().slice(0, 5) };
  fqCrawlCleanSave(d);
  return merged;
}
function fqFlowDiag(gid, code) {
  /* 信息流链路诊断：逐项检查 第 1 层采纳源 / 爬虫 / AI 清洗 / 第 2 层总览 的就绪状态，返回可读摘要 */
  const parts = [];
  const base = fqLayerGet(gid, 'base', code);
  const nSel = base && base.result && Array.isArray(base.result.selected) ? base.result.selected.length : 0;
  parts.push('① 数据源推荐：' + (base ? '已就绪（' + nSel + ' 个采纳源）' : '缺失'));
  const crawl = fqCrawlGet(gid, code);
  const nCrawl = crawl ? Object.keys(crawl).length : 0;
  const clean = fqCrawlCleanGet(gid, code);
  const cnts = ['company', 'industry', 'discussion'].map(c => ((clean && clean[c]) || []).length);
  parts.push('② 爬虫 ' + nCrawl + ' 条');
  parts.push('③ AI 清洗 company ' + cnts[0] + ' / industry ' + cnts[1] + ' / discussion ' + cnts[2]);
  parts.push('④ 第 2 层总览：' + (fqLayerGet(gid, 'firm', code) ? '已就绪' : '缺失'));
  return parts.join('；');
}
async function fqFlowStepFirm(gid, p, tw, st) {
  /* 信息流收尾：自动生成第 2 层（总览型基础信息生成层）——mid_overview（事件 / 产业 / 舆情三总览）
     作为第 3 层核心参数细节评估的初始数据；复用 fqFillPrompt 的 {{event_dataset}} 等（清洗数据直接代换）。
     自身消化所有异常：信息流数据已补满即算成功，firm 生成失败只回报结果，不拖垮信息流整体 */
  const layer = FQ_LAYERS.find(x => x.id === 'firm');
  if (!layer || !layer.prompt2) return { ok: true };   /* L1 无 prompt2：信息流仅用于 L2/L3 */
  st.msg = '🔄 信息流数据已就绪 —— 正在生成第 2 层 · 总览型基础信息生成层（事件 / 产业 / 舆情三总览）…';
  fqFlowRender(gid, st);
  try {
    const pv = fqLayerPrevs(gid, 'firm', p.code);
    const prompt = fqFillPrompt(layer, p, pv.prevs[0] || null, pv.prevs[1] || null, gid);
    const res = await fqExecOnceWeb(gid, 'firm', p, prompt, { phase: 'running', steps: [] });
    if (!res.ok) {
      if (res.aborted) return { ok: false, aborted: true };
      return { ok: false, lastErr: res.lastErr || '未知错误' };
    }
    return { ok: true };
  } catch (e) {
    if (FQ_ABORT) return { ok: false, aborted: true };
    return { ok: false, lastErr: (e && e.message) ? e.message : String(e) };
  }
}
async function fqFlowExec(gid, p, tw, resume) {
  /* 一键信息流主循环：AI 推荐 → 爬虫 → 清洗 → 失败剔除/排除 → 补充批次 → 三组各 5 源全成功跳出。
     resume（断点续跑）：从上次遗留的 {round, step} 处继续 —— 每步数据均已持久化
     （base→rt_fqlayers / 爬虫→rt_fq_crawl / 清洗→rt_fq_crawl_clean / 排除→rt_fq_excl），
     状态（rt_fq_flow_state）在每步写入时间戳；完成即清除状态，失败保留供续跑。 */
  const code = p.code;
  const excludes = fqExclGet(gid, code);
  const st = { phase: 'ai', round: (resume && resume.round) || 1, doneIdx: null, msg: '' };
  const okSet = new Set();
  let clean = fqCrawlCleanGet(gid, code) || null;
  if (clean) Object.keys(clean).forEach(c => { if (Array.isArray(clean[c])) clean[c].forEach(it => { if (it && it.status === 'ok' && it.url) okSet.add(it.url); }); });
  let allSrcs = [];   /* 跨轮累积源（url 去重 · 每类至多 5）：AI 每轮产出可能不满 15，合并后爬虫 / 清洗 / 校验 / 缺口计算均基于此 */
  let need = { company: 0, industry: 0, discussion: 0 };
  const MAX_ROUND = 6;
  const startRound = (resume && resume.round) || 1;
  let resumeStep = resume ? resume.step : null; /* 仅首轮生效：ai / crawl / clean / check */
  for (let round = startRound; round <= MAX_ROUND; round++) {
    fqAbortCheck();
    const rs = (resume && resume.round === round) ? resumeStep : null;
    let ai, cln;
    /* ① AI 数据源推荐（断点非 ai 时跳过，沿用已保存结果） */
    if (rs !== 'crawl' && rs !== 'clean' && rs !== 'check') {
      fqFlowStateSet(gid, code, { round, step: 'ai', tw, msg: st.msg });
      ai = await fqFlowStepAI(gid, p, tw, round, excludes, need, st);
      if (!ai.ok) {
        fqFlowStateSet(gid, code, { round, step: 'ai', tw, msg: st.msg });
        if (ai.aborted) { st.phase = 'abort'; st.msg = '⛔ 已中断 · 第 ' + round + ' 轮 ① AI 数据源推荐（数据已保留，可续跑）'; fqFlowRender(gid, st); fqExclClear(gid, code); return { ok: false, aborted: true }; }
        st.phase = 'fail'; st.msg = '❌ 第 ' + round + ' 轮 AI 推荐连续 3 次异常（' + ai.lastErr + '）—— 已停止（下次运行可续跑），可检查网页会话后重试'; fqFlowRender(gid, st); fqExclClear(gid, code);
        return { ok: false, reason: ai.lastErr };
      }
      st.doneIdx = 1;
      if (ai.srcs && ai.srcs.length) {
        const before = allSrcs.length;
        allSrcs = fqMergeSrcs(allSrcs, ai.srcs);
        st.msg = '① AI 推荐完成：第 ' + round + ' 轮 DS 输出 ' + ai.srcs.length + ' 个候选' + (ai.dupN ? '（自动剔除与失败排除项重复 ' + ai.dupN + ' 个）' : '') + '，去重后累计 ' + allSrcs.length + ' 个（本轮新增 ' + (allSrcs.length - before) + ' 个）';
      }
      fqDsSaveBase(gid, p, tw, allSrcs);
    } else {
      const b = fqLayerGet(gid, 'base', code);
      const rr = b && b.result;
      ai = { ok: true, srcs: (rr && (Array.isArray(rr.selected) && rr.selected.length ? rr.selected : rr.sources)) || [] };
      allSrcs = fqMergeSrcs(allSrcs, ai.srcs);
      st.doneIdx = 1;
      st.msg = '↻ 续跑：跳过 ①（沿用已保存的 AI 推荐 ' + allSrcs.length + ' 源）';
    }
    /* ② 爬虫层（断点非 clean/check 时执行；对本轮 AI 输出的全部候选操作，仅跳过已成功源，不做去重筛取） */
    if (rs !== 'clean' && rs !== 'check') {
      fqFlowStateSet(gid, code, { round, step: 'crawl', tw, msg: st.msg });
      await fqFlowStepCrawl(gid, code, ai.srcs || [], okSet, st, round);
      st.doneIdx = 2;
    } else if (rs !== 'check') {
      st.doneIdx = 2;
      st.msg = '↻ 续跑：跳过 ② 爬虫层（已抓取条目保留）';
    }
    /* ③ AI 清洗（断点非 check 时执行；对本轮候选清洗，仅清洗本轮新增成功源） */
    if (rs !== 'check') {
      fqFlowStateSet(gid, code, { round, step: 'clean', tw, msg: st.msg });
      cln = await fqFlowStepClean(gid, code, ai.srcs || [], okSet, st);
      if (!cln.ok) {
        /* 分批清洗：某批 3 次全败 / 中断时，已完成批先并入存储（供断点续跑 / 直接使用） */
        if (cln.partial && ['company', 'industry', 'discussion'].some(c => (cln.partial[c] || []).length)) clean = fqFlowMergeClean(gid, code, clean, cln.partial);
        fqFlowStateSet(gid, code, { round, step: 'clean', tw, msg: st.msg });
        if (cln.aborted) { st.phase = 'abort'; st.msg = '⛔ 已中断 · 第 ' + round + ' 轮 ③ AI 清洗（已完成批次已保留，可续跑）'; fqFlowRender(gid, st); fqExclClear(gid, code); return { ok: false, aborted: true }; }
        st.phase = 'fail'; st.msg = '❌ AI 清洗批次连续 3 次异常（' + cln.lastErr + '）—— 已停止（已完成批次已保留，下次运行可续跑），可检查网页会话后重试'; fqFlowRender(gid, st); fqExclClear(gid, code);
        return { ok: false, reason: cln.lastErr };
      }
      st.doneIdx = 3;
    } else {
      cln = { ok: true, obj: { company: [], industry: [], discussion: [] } };
      st.doneIdx = 3;
      st.msg = '↻ 续跑：跳过 ③ AI 清洗（已清洗条目保留）';
    }
    /* ④ 校验 / 补充（总是执行） */
    fqFlowStateSet(gid, code, { round, step: 'check', tw, msg: st.msg });
    clean = fqFlowMergeClean(gid, code, clean, cln.obj);
    /* 重建 okSet，统计本批失败项 */
    const fails = { company: [], industry: [], discussion: [] };
    const newFail = [];
    ['company', 'industry', 'discussion'].forEach(c => {
      const srcsC = allSrcs.filter(s => s.category === c);
      srcsC.forEach(s => {
        const done = clean[c].find(it => it.url === s.url);
        if (done) okSet.add(s.url);
        else {
          const m = fqCrawlGet(gid, code)[s.url];
          newFail.push({ name: s.name, url: s.url, reason: (m && m.err) ? '抓取失败：' + m.err : (s.url ? '清洗失败：无有效正文' : '缺少直达网址（report_url 为空）') });
          fails[c].push(s);
        }
      });
    });
    st.phase = 'check';
    const per = ['company', 'industry', 'discussion'].map(c => clean[c].length);
    /* 成功阈值阶梯：第 1-3 轮每类 5 → 第 4 轮每类 3 → 四轮后（第 5 轮起）每类 ≥1 即可放行 */
    const minNeed = round >= 5 ? 1 : (round >= 4 ? 3 : 5);
    if (per.every(n => n >= minNeed)) {
      /* 三类均达到当前阈值：按出现顺序每类至多选取前 5 个成功源保存为最终采纳，跳出并清除断点状态 */
      st.phase = 'done'; st.doneIdx = 5;
      const finalSrcs = fqFlowFinalSrcs(allSrcs, clean);
      fqDsSaveBase(gid, p, tw, finalSrcs);
      st.msg = '✅ 信息流输出完成：累计清洗 ' + allSrcs.length + ' 个候选，三类各 ' + minNeed + ' 源达标（阈值阶梯：前三轮每类 5 · 第 4 轮每类 3 · 四轮后每类 1），已按出现顺序每类至多选取前 5 个（共 ' + finalSrcs.length + ' 个采纳源）· 共 ' + round + ' 轮' + (minNeed < 5 ? '（阈值已放宽至每类 ' + minNeed + '）' : '');
      fqFlowRender(gid, st);
      /* 信息流收尾：自动生成 第 2 层（总览型基础信息生成层）——mid_overview 供第 3 层核心参数细节评估作为初始数据 */
      const firmRes = await fqFlowStepFirm(gid, p, tw, st);
      if (FQ_ABORT) {
        st.phase = 'abort';
        st.msg = '⛔ 已中断 · 信息流数据已就绪、第 2 层总览生成被中止（可单独运行第 2 层或重跑）';
        fqFlowRender(gid, st);
        fqFlowStateClear(gid, code);
        fqExclClear(gid, code);
        return { ok: false, aborted: true, partial: true };
      }
      st.msg = firmRes.ok
        ? '✅ 信息流输出完成：累计清洗 ' + allSrcs.length + ' 个候选，三类各 ' + minNeed + ' 源达标（阈值阶梯：前三轮每类 5 · 第 4 轮每类 3 · 四轮后每类 1），已按出现顺序每类至多选取前 5 个（共 ' + finalSrcs.length + ' 个采纳源）· 共 ' + round + ' 轮' + (minNeed < 5 ? '（阈值已放宽至每类 ' + minNeed + '）' : '') + '；<b>第 2 层总览已生成</b>（事件 / 产业 / 舆情三总览，供第 3 层直接使用）'
        : '⚠ 信息流输出完成（' + finalSrcs.length + ' 个采纳源），但第 2 层总览生成失败：' + esc(firmRes.lastErr || '未知错误') + ' —— 可单独点击「第 2 层 · 运行」重试';
      fqFlowRender(gid, st);
      fqFlowStateClear(gid, code);
      fqCrawlRender(gid);
      fqExclClear(gid, code);   /* 成功完成：失败记录即删，采纳源已留存于第一层结果 */
      return { ok: true, rounds: round, clean, excludes: excludes.length + newFail.length, minNeed, firm: firmRes.ok, firmErr: firmRes.ok ? '' : (firmRes.lastErr || '') };
    }
    /* 本批失败项 → 排除（防止再次输出） + 待补数量（缺口 = 每类 5 - 当前有效数，供提示词侧重） */
    if (newFail.length) fqExclAdd(gid, code, newFail);
    newFail.forEach(f => { if (!excludes.some(x => (f.name && x.name === f.name) || (f.url && x.url === f.url))) excludes.push(f); });
    need = { company: Math.max(0, 5 - per[0]), industry: Math.max(0, 5 - per[1]), discussion: Math.max(0, 5 - per[2]) };
    st.msg = '🔍 校验：当前各组成效 ' + per.join(' / ') + '（阈值 ' + minNeed + '），失败 ' + newFail.length + ' 项已加入排除列表，需补充 公司 ' + need.company + ' / 产业 ' + need.industry + ' / 舆情 ' + need.discussion + ' → 进入第 ' + (round + 1) + ' 轮';
    fqFlowRender(gid, st);
    resumeStep = null; /* 后续轮次全量执行 */
  }
  st.phase = 'fail';
  st.msg = '❌ 已达 ' + MAX_ROUND + ' 轮上限仍未补齐三类源（四轮后阈值已降至每类 1，当前 ' + ['company', 'industry', 'discussion'].map(c => clean[c].length).join(' / ') + '，仍未达标的类无法放行）—— 已停止（下次运行可续跑），请检查网页会话 / 换时间窗口重试';
  fqFlowRender(gid, st);
  fqExclClear(gid, code);   /* 退出流程：失败记录自动删除（仅保留采纳源 / 已抓取 / 已清洗数据供续跑） */
  return { ok: false, reason: '轮次上限' };
}
function fqFlowRun(gid, btn) {
  /* ⚡ 一键输出有效信息流入口 */
  fqFlowRunAsync(gid, btn);
}
function fqFlowRunAsync(gid, btn) {
  /* ⚡ 一键输出有效信息流（返回 promise，供「一键全流程」串联）：校验产品 / 时间窗口 / L1 基础信息；
     检测上次遗留的断点状态 → 询问续跑（保留已抓取 / 已清洗数据）或全新开始（清空该产品爬虫与清洗数据） */
  const sel = ROOT.querySelector('.fq-lsel[data-gid="' + gid + '"]');
  const code = sel && sel.value;
  const p = code && fnLoad().products.find(x => x.code === code);
  if (!p) { toast('请先选择产品', 'warn'); return Promise.resolve({ ok: false, reason: 'no product' }); }
  const l1 = fqLayerGet('L1', 'base', code);
  if (!l1 || !l1.result) { toast('请先运行 长期价值类 · 第 1 层（基础锚定数据层）获取该产品基础信息', 'warn'); return Promise.resolve({ ok: false, reason: 'no L1 base' }); }
  const twSel = ROOT.querySelector('.fq-twin[data-gid="' + gid + '"]');
  const tw = (twSel && twSel.value) || (S.fq.tw && S.fq.tw[gid]) || '一个月';
  const prev = fqFlowStateGet(gid, code);
  /* 进入信息流（全新或续跑）一律清除该产品历史失败排除记录 —— 轮次内数据仅为本地量，不继承过往 */
  fqExclClear(gid, code);
  let resume = null;
  if (prev) {
    const go = confirm('检测到上次遗留的一键信息流（第 ' + prev.round + ' 轮 · ' + fqFlowStepName(prev.step) + ' · ' + prev.updatedAt + '），是否接着运行？\n\n选「确定」= 从断点继续（已抓取 / 已清洗的数据保留）\n选「取消」= 全新开始（清空该产品的爬虫 / 清洗数据）');
    if (go) { resume = prev; }
  }
  if (!resume) {
    const existed = fqLayerGet(gid, 'base', code);
    if (existed && !confirm('该产品已有数据源推荐结果（' + (existed.product || existed.code || '') + ' · ' + existed.ts + '），全新信息流将重新运行第一层并清空该产品的爬虫 / 清洗数据，是否继续？')) return Promise.resolve({ ok: false, reason: 'cancelled' });
    /* 全新开始：清空该产品爬虫 / 清洗数据与断点状态（保证干净起点） */
    const cd = fqCrawlLoad();
    if (cd[gid]) cd[gid][code] = {};
    fqCrawlSave(cd);
    const cld = fqCrawlCleanLoad();
    if (cld[gid]) delete cld[gid][code];
    fqCrawlCleanSave(cld);
    fqFlowStateClear(gid, code);
  }
  fqAbortReset(); /* 新一次运行：清除上次中断标志 */
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = '⏳ 信息流运行中…';
  return new Promise(resolve => {
    fqFlowExec(gid, p, tw, resume).then(res => {
      btn.disabled = false; btn.textContent = orig;
      if (!res.ok) {
        if (res.aborted) { toast('⛔ 信息流已中断（进度已保留，可续跑）', 'warn'); resolve(res); return; }
        toast('一键信息流失败：' + res.reason, 'error'); resolve(res); return;
      }
      fqBaseShow(gid, 'base', code);
      const libEl = document.getElementById('fq-dslib-' + gid);
      if (libEl) libEl.innerHTML = fqDsLibHTML(gid);
      fqCrawlRender(gid);
      fqFlowSummaryRefresh(gid, code);
      toast('一键信息流完成 ✓（共 ' + res.rounds + ' 轮 · 三类各 ' + (res.minNeed || 5) + ' 源达标' + (res.firm ? ' · 第 2 层总览已生成' : (res.firmErr ? ' · ⚠ 第 2 层生成失败：' + res.firmErr + '（可单独运行第 2 层重试）' : '')) + '）', 'success');
      resolve(res);
    }).catch(e => {
      btn.disabled = false; btn.textContent = orig;
      if (FQ_ABORT) { toast('⛔ 信息流已中断（进度已保留，可续跑）', 'warn'); resolve({ ok: false, aborted: true }); return; }
      toast('一键信息流失败：' + e.message, 'error');
      resolve({ ok: false, reason: e.message });
    });
  });
}
function fqDsShapeBad(obj, cap) {
  /* 结构性校验：三类数组、每类至多 cap（补充轮按缺口配额：缺 1 类 → 该类 15；
     缺 2 类 → 各 7；缺 3 类 → 各 5；配额 0 的类宽容至多 5，不判失败）、每条含 platform_name。
     数量不足（某类 <5 / 合计 <15）不判失败 —— 一键信息流按「跨轮合并」接受部分产出，缺口由补充轮补齐 */
  const keys = ['company_news_platforms', 'industry_news_platforms', 'investment_discussion_platforms'];
  const capArr = cap ? [cap.company || 5, cap.industry || 5, cap.discussion || 5] : [5, 5, 5];
  const cnt = keys.map(k => (Array.isArray(obj[k]) ? obj[k].length : 0));
  if (cnt.some((c, i) => c > capArr[i])) return '数据源数量不合规：每类上限 ' + capArr.join('/') + '（当前 ' + cnt.join('/') + '）';
  return null;
}
function fqDsCountBad(obj) {
  /* 15 源校验：每类至多 5 个、合计恰好 15 个（仅用于单层按钮版的缺口提示；一键信息流不再因此判失败） */
  const cnt = ['company_news_platforms', 'industry_news_platforms', 'investment_discussion_platforms'].map(k => (Array.isArray(obj[k]) ? obj[k].length : 0));
  const total = cnt.reduce((a, b) => a + b, 0);
  if (cnt.some(c => c > 5)) return '数据源数量不合规：每类至多 5 个（当前 ' + cnt.join('/') + '）';
  if (total !== 15) return '数据源数量不合规：需恰好 15 个报告源（当前 ' + total + ' 个）';
  return null;
}
function fqMergeSrcs(all, add) {
  /* 跨轮合并源列表：按 url（无 url 按名称）去重、保持顺序。
     注意：不再做每类 cap 5 截断 —— 每轮 AI 输出的全部候选都要进入爬虫层 / 清洗层，
     最终「每类取前 5」由完成时按累计清洗成功结果挑选（fqFlowFinalSrcs） */
  const seen = new Set(all.map(s => s.url || s.name));
  const out = all.slice();
  (add || []).forEach(s => {
    const k = s.url || s.name;
    if (k && !seen.has(k)) { seen.add(k); out.push(s); }
  });
  return out;
}
function fqFlowFinalSrcs(allSrcs, clean) {
  /* 信息流完成后：从累计清洗成功结果中，每类按出现顺序选取前 5 个，作为第一层最终采纳源。
     补充轮次的筛选全部由清洗完成 —— 先出现者优先，未成功条目自然落选 */
  const cap = { company: 5, industry: 5, discussion: 5 };
  const res = [];
  ['company', 'industry', 'discussion'].forEach(c => {
    const seen = new Set();
    (allSrcs || []).forEach(s => {
      if (s.category === c && seen.size < (cap[c] || 5)) {
        const done = (clean[c] || []).find(it => it.url === s.url);
        if (done && !seen.has(s.url)) { seen.add(s.url); res.push({ ...s }); }
      }
    });
  });
  return res;
}
function fqDsFlatten(obj) {
  /* 三分类 → 拍平为链路条目（category 标记分类，供分组展示） */
  const flat = [];
  [['company_news_platforms', 'company'], ['industry_news_platforms', 'industry'], ['investment_discussion_platforms', 'discussion']].forEach(([k, c]) => {
    (obj[k] || []).forEach(s => {
      if (s && s.platform_name) flat.push({ name: s.platform_name, type: s.platform_type || '', authority: s.authority_level || '', desc: s.suitable_content || '', keyword: s.crawl_keyword || '', url: s.report_url || '', category: c, home: '', freq: '' });
    });
  });
  return flat;
}
function fqDsSaveBase(gid, p, tw, flat) {
  /* 保存第一层结果（引用 L1 基础信息 + 时间窗口 + 三类平台清单；selected 默认全选）与链路库 */
  const l1 = fqLayerGet('L1', 'base', p.code);
  const b = (l1 && l1.result) || {};
  fqLayerSet(gid, 'base', {
    code: p.code, product: p.name,
    result: { product_id: p.code, product_name: p.name, company_full_name: b.company_full_name || null, industry_level1: b.industry_level1 || null, industry_level2: b.industry_level2 || null, time_window: fqTwText(gid, tw), sources: flat, selected: flat.map(x => ({ ...x })) },
    raw: '', ts: fmtDate(new Date()) + ' ' + new Date().toTimeString().slice(0, 5), mode: 'web',
  });
  fqDsSaveSources(p, flat);
}
function fqDsExecOnceWeb(gid, p, tw, states, promptOverride) {
  /* 数据源推荐单层执行（web 通道，最多 3 次）：发送 → 解析 → 校验 → 保存链路库 + 本层结果；promptOverride 供一键信息流补充批次使用 */
  const layerNo = 1;
  return fqLayerWebSess('base').then(url => {
    if (!url) throw new Error('网页会话不可用（请先在 AI 工作台添加会话链接或完成登录）');
    const prompt = promptOverride || fqDsPrompt(p, fqTwText(gid, tw), fqDsExisting(p));
    let attempts = 0, lastErr = '';
    const tryOne = () => {
      attempts++;
      if (states) fqRenderProgress(gid, { phase: 'running', steps: states.steps, msg: '⏳ 第 1 层 · 数据源推荐 · 第 ' + attempts + ' 次尝试（会话 …' + url.slice(-10) + '）' });
      return apiPost('/api/plugin/webchat/chat', { url, message: prompt, expect: 'rec' }).then(r => {
        if (!r || !r.ok) {
          if (r && r.aborted) return { ok: false, aborted: true };
          if (r && r.code === 'need_login') throw new Error('网页登录已失效，请重新登录');
          throw new Error((r && r.error) || '未知错误');
        }
        const obj = fqParseJSON(r.text);
        const bad = fqValidateResult(gid, 'base', obj) || fqDsShapeBad(obj);
        if (bad) return { ok: false, bad };
        const cnt = ['company_news_platforms', 'industry_news_platforms', 'investment_discussion_platforms'].map(k => (Array.isArray(obj[k]) ? obj[k].length : 0));
        return { ok: true, obj, url: r.url, need: { company: Math.max(0, 5 - cnt[0]), industry: Math.max(0, 5 - cnt[1]), discussion: Math.max(0, 5 - cnt[2]) } };
      });
    };
    const run = () => tryOne().then(async res => {
      if (res.aborted) return res;
      if (res.ok) return res;
      lastErr = res.bad;
      if (attempts < 3) {
        /* 冷却再重试：避免打断 DS 正在生成的上一条回复（频繁发送报错） */
        if (states) fqRenderProgress(gid, { phase: 'running', steps: states.steps, msg: '⏸ 第 ' + attempts + ' 次尝试失败（' + lastErr + '）—— 冷却 12 秒后重试' });
        await fqSleep(12000);
        return run();
      }
      return { ok: false, lastErr };
    });
    return run().then(res => {
      if (!res.ok) return { ok: false, aborted: res.aborted, attempts, lastErr: res.lastErr };
      if (res.url && res.url !== url) {
        if (!S.fq.webSess) S.fq.webSess = {};
        S.fq.webSess[FQ_WEB_GROUP.base || 'A'] = res.url;
      }
      const flat = fqDsFlatten(res.obj);
      fqDsSaveBase(gid, p, tw, flat);
      return { ok: true, attempts, need: res.need };
    });
  });
}
function fqDsRun(gid, btn) {
  /* 单层按钮版数据源推荐（带结果审查，最多 3 次） */
  const sel = ROOT.querySelector('.fq-lsel[data-gid="' + gid + '"]');
  const code = sel && sel.value;
  const p = code && fnLoad().products.find(x => x.code === code);
  if (!p) { toast('请先选择产品', 'warn'); return; }
  const l1 = fqLayerGet('L1', 'base', code);
  if (!l1 || !l1.result) { toast('请先运行 长期价值类 · 第 1 层（基础锚定数据层）获取该产品基础信息', 'warn'); return; }
  const twSel = ROOT.querySelector('.fq-twin[data-gid="' + gid + '"]');
  const tw = (twSel && twSel.value) || (S.fq.tw && S.fq.tw[gid]) || '一个月';
  const existed = fqLayerGet(gid, 'base', code);
  if (existed && !confirm('该产品已有数据源推荐结果（' + (existed.product || existed.code || '') + ' · ' + existed.ts + '），是否覆盖？')) return;
  fqAbortReset(); /* 新一次运行：清除上次中断标志 */
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = '⏳ 推荐中…';
  const note = document.getElementById('fq-dsnote-' + gid);
  fqAbortMount(note, '数据源推荐');
  fqDsExecOnceWeb(gid, p, tw, null).then(res => {
    if (!res.ok) {
      btn.disabled = false; btn.textContent = orig;
      if (res.aborted) { if (note) note.textContent = '⛔ 已手动中断（未保存任何结果）'; toast('⛔ 数据源推荐已中断', 'warn'); return; }
      if (note) note.textContent = '⚠ 连续 3 次结果异常，已停止（' + res.lastErr + '）';
      toast('数据源推荐失败：' + res.lastErr, 'error');
      return;
    }
    fqBaseShow(gid, 'base', code);
    const libEl = document.getElementById('fq-dslib-' + gid);
    if (libEl) libEl.innerHTML = fqDsLibHTML(gid);
    btn.disabled = false; btn.textContent = orig;
    if (note) note.textContent = '';
    const gg = res.need;
    const gapTxt = (gg && (gg.company + gg.industry + gg.discussion) > 0)
      ? '（缺口：公司 ' + gg.company + ' / 产业 ' + gg.industry + ' / 舆情 ' + gg.discussion + '，未满 15 源）'
      : '';
    toast('数据源推荐完成 ✓（尝试 ' + res.attempts + ' 次），已保存至链路库' + gapTxt, 'success');
  }).catch(e => {
    btn.disabled = false; btn.textContent = orig;
    if (FQ_ABORT) { if (note) note.textContent = '⛔ 已手动中断（未保存任何结果）'; toast('⛔ 数据源推荐已中断', 'warn'); return; }
    if (note) note.textContent = '❌ ' + e.message;
    toast('数据源推荐失败：' + e.message, 'error');
  });
}
function fqDsResHTML(r, gid) {
  /* ③ 结果展示：三类平台清单（本次运行 · 单次资源），每行打钩选定 → 第二层初始数据源 */
  if (!r || !Array.isArray(r.sources)) return '<div class="empty" style="padding:12px;">暂无数据源推荐结果</div>';
  const cats = [['company', '🏢 公司相关新闻平台'], ['industry', '🏭 行业相关新闻平台'], ['discussion', '💬 投资讨论舆情平台']];
  const sel = Array.isArray(r.selected) ? r.selected : r.sources;
  let html = `<div style="font-size:11.5px;color:var(--text-dim);margin-bottom:6px;line-height:1.6;">
    已选定 <b id="fq-dsseln-${gid || ''}">${sel.length}/${r.sources.length}</b> 个数据源（默认全选，取消勾选则从第二层初始数据中移除）。
    第二层将从这些数据源开始爬取数据；具体公告 / 报告为<b>本次运行资源</b>，已随第一层结果历史保存，不进入全局链路库。
  </div>`;
  cats.forEach(([c, zh]) => {
    const rows = r.sources.filter(s => s.category === c);
    if (!rows.length) return;
    html += `<div style="font-size:12.5px;font-weight:600;margin:8px 0 4px;">${zh}（${rows.length}）</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:6px;">
        <tr style="background:rgba(143,216,184,.14);">
          <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.08);width:30px;"></td>
          <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.08);width:150px;">平台名称</td>
          <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.08);width:120px;">平台类型</td>
          <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.08);width:60px;">权威等级</td>
          <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.08);width:90px;">网址</td>
          <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.08);">具体公告 / 报告 · 抓取关键词</td>
        </tr>
        ${rows.map(s => {
          const key = (s.desc || s.keyword || '');
          const checked = sel.some(x => x.name === s.name && (x.desc || x.keyword || '') === key);
          return `<tr>
          <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);"><input type="checkbox" class="fq-ds-sel" data-g="${gid || ''}" data-name="${esc(s.name)}" data-content="${esc(key)}" ${checked ? 'checked' : ''} style="cursor:pointer;accent-color:#2e9e6b;"></td>
          <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);"><b>${esc(s.name || '')}</b></td>
          <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);">${esc(s.type || '')}</td>
          <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);"><span style="font-size:10px;padding:0 6px;border-radius:10px;background:rgba(46,158,107,.12);color:#2e9e6b;">${esc(s.authority || '')}</span></td>
          <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);font-size:11.5px;">${s.url ? '<a href="' + esc(s.url) + '" target="_blank" style="color:var(--accent);">🔗 打开</a>' : '<span class="fin-note">—</span>'}</td>
          <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);font-size:11.5px;">${esc(s.desc || '')}${s.keyword ? ' · <span style="color:var(--accent);">🔑 ' + esc(s.keyword) + '</span>' : ''}</td>
        </tr>`;
        }).join('')}
      </table>`;
  });
  return html || '<div class="fin-note" style="padding:4px 0;">暂无平台清单</div>';
}
function fqDsRefHTML(g, code) {
  /* ① 基础信息引用：长期价值类第 1 层（L1.base）结果 */
  const l1 = fqLayerGet('L1', 'base', code);
  if (!l1 || !l1.result) return '<div class="fin-note" style="font-size:12px;padding:4px 0;">暂无引用数据 —— 请先到「长期价值类 · 第 1 层（基础锚定数据层）」选择并运行该产品</div>';
  return `<div style="font-size:11.5px;color:var(--text-dim);margin-bottom:4px;">引用自 长期价值类 · 第 1 层（基础锚定数据层）· ${esc(l1.product || l1.code || '')}</div>` + fqLayerResHTML(l1);
}
function fqDsLibHTML(g) {
  /* ④ 数据源链路库（全局 · 仅平台名称，按产业分组展示；具体公告/报告为第一层单次资源） */
  const lib = fqDsLoad();
  const names = Object.keys(lib);
  if (!names.length) return '<div class="fin-note" style="font-size:12px;padding:4px 0;">链路库为空 —— 运行「🤖 AI 推荐并入库」后，AI 输出的平台名称将在此全局保存（中期 / 短期类共享，作为后续推荐候选池）；具体公告 / 报告为单次运行资源，仅随第一层结果保存。</div>';
  const byInd = {};
  names.forEach(nm => { const grp = lib[nm]; const ind = grp.industry || '未分类'; (byInd[ind] = byInd[ind] || []).push(nm); });
  return Object.keys(byInd).map(ind => {
    const list = byInd[ind];
    return `<div style="margin-bottom:8px;border:1px solid rgba(0,0,0,.08);border-radius:8px;padding:6px 10px;background:rgba(0,0,0,.02);">
      <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;margin-bottom:4px;">
        <span>🏷 ${esc(ind)}</span>
        <span class="fin-note" style="font-weight:400;">${list.length} 平台</span>
        <span style="flex:1;"></span>
      </div>
      ${list.map(nm => {
        const grp = lib[nm];
        return `<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:3px 0;border-top:1px dashed rgba(0,0,0,.06);">
          <b>${esc(nm)}</b>
          ${grp.authority ? `<span style="font-size:10px;padding:0 6px;border-radius:10px;background:rgba(46,158,107,.12);color:#2e9e6b;">${esc(grp.authority)}</span>` : ''}
          <span class="fin-note" style="font-size:11px;">${esc(grp.type || '')}</span>
          ${grp.home ? `<span class="fin-note" style="font-size:11.5px;">${esc(grp.home)}</span>` : ''}
          <span style="flex:1;"></span>
          <button class="btn sm soft fq-ds-del" data-g="${g}" data-name="${esc(nm)}" style="font-size:10.5px;padding:1px 7px;" title="从全局库移除该平台（不影响第一层历史结果）">✕</button>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
}
function fqDsLibSection(g) {
  /* 数据源链路库独立区块（显示于第一层与第二层之间，公共库 · 全局 · 可展开收起） */
  if (!S.fq.dslibOpen) S.fq.dslibOpen = new Set(['L2', 'L3']);
  const open = S.fq.dslibOpen.has(g.id);
  const lib = fqDsLoad();
  const cnt = Object.keys(lib).length;
  return `<div style="border:1px solid rgba(0,0,0,.08);border-radius:10px;margin-bottom:10px;overflow:hidden;background:#fff;">
    <div class="fq-dslib-hd" data-gid="${g.id}" style="display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;background:rgba(143,216,184,.12);">
      <span style="width:16px;text-align:center;font-size:12px;">${open ? '▾' : '▸'}</span>
      <b style="font-size:13px;">数据源链路库（全局 · 中期 / 短期共享 · 仅平台名称）</b>
      <span class="fin-note" id="fq-dslibcnt-${g.id}" style="font-size:11px;">${cnt} 平台</span>
    </div>
    <div id="fq-dslib-${g.id}" style="padding:10px 12px;${open ? '' : 'display:none;'}">${fqDsLibHTML(g.id)}</div>
  </div>`;
}
function fqTwCalc(tw) {
  /* 预设窗口 → 实际起止日期（截止今天，向前推）；返回 {start, end} YYYY-MM-DD */
  const end = new Date();
  const start = new Date();
  const fmt = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  if (tw === '一周') start.setDate(start.getDate() - 7);
  else if (tw === '一个月') start.setMonth(start.getMonth() - 1);
  else if (tw === '三个月') start.setMonth(start.getMonth() - 3);
  else if (tw === '六个月') start.setMonth(start.getMonth() - 6);
  else if (tw === '一年') start.setFullYear(start.getFullYear() - 1);
  return { start: fmt(start), end: fmt(end) };
}
function fqTwText(gid, tw) {
  /* 时间窗口展示文本：预设类型 → “类型（起 至 止）”；自定义 → 用 S.fq.twRange 指定起止 */
  if (tw === 'custom' && S.fq.twRange && S.fq.twRange[gid] && S.fq.twRange[gid].start && S.fq.twRange[gid].end) {
    return '自定义（' + S.fq.twRange[gid].start + ' 至 ' + S.fq.twRange[gid].end + '）';
  }
  const r = fqTwCalc(tw || '一个月');
  return (tw || '一个月') + '（' + r.start + ' 至 ' + r.end + '）';
}
function fqDsBodyHTML(g, layer, res) {
  /* L2/L3 第一层专用 body（简洁化整改）：
     ① 产品 / 时间窗口选择 ② 基础信息引用（长期价值类第 1 层） ③ 开始一键全流程（替代原数据源推荐栏） */
  const prods = fnLoad().products;
  const cur = S.fq.lprod || (prods[0] || {}).code || '';
  const opts = prods.map(p => `<option value="${esc(p.code)}" ${p.code === cur ? 'selected' : ''}>${esc(p.name)}（${esc(p.code)}）</option>`).join('');
  const tw = (S.fq.tw && S.fq.tw[g.id]) || '一个月';
  const twOpts = ['一周', '一个月', '三个月', '六个月', '一年', 'custom'].map(t => `<option value="${t}" ${t === tw ? 'selected' : ''}>${t === 'custom' ? '自定义' : t}</option>`).join('');
  const range = (S.fq.twRange && S.fq.twRange[g.id]) || {};
  const today = fqTwCalc('').end;
  const defStart = fqTwCalc('一个月').start;
  return `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px;font-size:12.5px;">
    <span>选择产品</span>
    <select class="input fq-lsel" data-gid="${g.id}" data-lid="base" style="width:280px;padding:4px 6px;">${opts}</select>
    <span>统计时间窗口</span>
    <select class="input fq-twin" data-gid="${g.id}" style="width:150px;padding:4px 6px;">${twOpts}</select>
    <span id="fq-twnote-${g.id}" style="font-size:11.5px;color:var(--text-dim);">${fqTwText(g.id, tw)}</span>
  </div>
  <div id="fq-twrange-${g.id}" style="display:${tw === 'custom' ? 'flex' : 'none'};gap:8px;align-items:center;margin:0 0 8px 96px;font-size:12px;flex-wrap:wrap;">
    <span class="fin-note">起始日期</span>
    <input type="date" class="input fq-twstart" data-gid="${g.id}" value="${range.start || defStart}" style="padding:3px 6px;">
    <span class="fin-note">结束日期</span>
    <input type="date" class="input fq-twend" data-gid="${g.id}" value="${range.end || today}" style="padding:3px 6px;">
  </div>
  <div style="font-size:12.5px;font-weight:600;margin-bottom:6px;">① 基础信息引用（长期价值类 · 第 1 层）</div>
  <div id="fq-dsref-${g.id}" style="margin-bottom:10px;">${fqDsRefHTML(g.id, cur)}</div>
  <div style="font-size:12.5px;font-weight:600;margin-bottom:6px;">② 开始一键全流程</div>
  <div style="font-size:12px;color:var(--text-dim);line-height:1.7;margin-bottom:8px;">
    一键输出有效信息流（AI 数据源推荐 → 爬虫 → AI 清洗 → 校验补充 → 第 2 层总览）自动衔接第 3→5 层评分，最终输出中期预期综合得分。
    数据源链路库上限 <b>100</b> 条，开启时自动清除最早超出部分。
  </div>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
    <button class="btn sm fq-lfull" data-gid="${g.id}" style="font-size:12px;padding:3px 16px;background:linear-gradient(90deg,#6366f1,#2e9e6b);border-color:transparent;color:#fff;">⚡ 开始一键全流程</button>
    <span class="fin-note" style="font-size:11px;">运行后自动清除链路库超出 100 条的旧条目；覆盖 / 续跑将弹窗确认。</span>
  </div>
  <div id="fq-flow-prog-${g.id}" style="margin-bottom:10px;"></div>
  <div id="fq-flow-pool-${g.id}" style="margin-bottom:10px;"></div>
  <div id="fq-lall-prog-${g.id}" style="margin-top:2px;"></div>`;
}
function fqDsAddModal(g, preInd) {
  /* 手动添加数据源（平台组 + 首条采集条目） */
  const m = modal({ title: '➕ 手动添加数据源', body: `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12.5px;">
      <div><div class="fin-note" style="margin-bottom:4px;">产业（申万一级，用于链路复用分组）</div>
        <input class="input" id="fq-ds-i" value="${esc(preInd || '')}" placeholder="如：银行 / 电力设备" style="width:100%;padding:4px 6px;"></div>
      <div><div class="fin-note" style="margin-bottom:4px;">平台名称</div>
        <input class="input" id="fq-ds-n" placeholder="如：巨潮资讯网" style="width:100%;padding:4px 6px;"></div>
      <div style="grid-column:1/3;"><div class="fin-note" style="margin-bottom:4px;">主页网址</div>
        <input class="input" id="fq-ds-h" placeholder="https://…" style="width:100%;padding:4px 6px;"></div>
      <div><div class="fin-note" style="margin-bottom:4px;">类型</div>
        <input class="input" id="fq-ds-t" placeholder="官方公告 / 财经媒体 / 行业机构 / 投资社区" style="width:100%;padding:4px 6px;"></div>
      <div><div class="fin-note" style="margin-bottom:4px;">分类（用于 AI 候选池分组）</div>
        <select class="input" id="fq-ds-cat" style="width:100%;padding:4px 6px;">
          <option value="">（不指定）</option>
          <option value="company">公司相关新闻平台</option>
          <option value="industry">行业相关新闻平台</option>
          <option value="discussion">投资讨论舆情平台</option>
        </select></div>
    </div>
  `, actions: [
    { label: '保存', cls: '', onClick: mask => {
      const ind = (document.getElementById('fq-ds-i').value || '').trim();
      const name = (document.getElementById('fq-ds-n').value || '').trim();
      const home = (document.getElementById('fq-ds-h').value || '').trim();
      if (!ind || !name) { toast('产业与平台名称必填', 'warn'); return; }
      const lib = fqDsLoad();
      if (!lib[name]) lib[name] = { name, type: (document.getElementById('fq-ds-t').value || '').trim(), authority: '', home, industry: ind, category: document.getElementById('fq-ds-cat').value || '', ts: fmtDate(new Date()) + ' ' + new Date().toTimeString().slice(0, 5) };
      else { toast('该平台已存在于全局链路库', 'warn'); return; }
      fqDsSave(lib);
      mask.remove();
      const el = document.getElementById('fq-dslib-' + g);
      if (el) el.innerHTML = fqDsLibHTML(g);
      toast('数据源已添加 ✓', 'success');
    }},
    { label: '取消', cls: 'soft', onClick: mask => mask.remove() },
  ]});
}
function fqDsBind(g) {
  ROOT.querySelectorAll('.fq-dsrun').forEach(btn => {
    btn.onclick = () => fqDsRun(btn.dataset.gid, btn);
  });
  ROOT.querySelectorAll('.fq-flowrun').forEach(btn => {
    btn.onclick = () => fqFlowRun(btn.dataset.gid, btn);
  });
  ROOT.querySelectorAll('.fq-twin').forEach(sel => {
    sel.onchange = () => {
      if (!S.fq.tw) S.fq.tw = {};
      S.fq.tw[sel.dataset.gid] = sel.value;
      const gid = sel.dataset.gid;
      const rg = document.getElementById('fq-twrange-' + gid);
      if (rg) rg.style.display = sel.value === 'custom' ? 'flex' : 'none';
      const note = document.getElementById('fq-twnote-' + gid);
      if (note) note.textContent = fqTwText(gid, sel.value);
      fqDsRefreshRef(gid);
    };
  });
  ROOT.querySelectorAll('.fq-twstart, .fq-twend').forEach(inp => {
    inp.onchange = () => {
      const gid = inp.dataset.gid;
      if (!S.fq.twRange) S.fq.twRange = {};
      if (!S.fq.twRange[gid]) S.fq.twRange[gid] = {};
      S.fq.twRange[gid].start = (ROOT.querySelector('.fq-twstart[data-gid="' + gid + '"]') || {}).value || '';
      S.fq.twRange[gid].end = (ROOT.querySelector('.fq-twend[data-gid="' + gid + '"]') || {}).value || '';
      const note = document.getElementById('fq-twnote-' + gid);
      if (note) note.textContent = fqTwText(gid, 'custom');
    };
  });
  ROOT.querySelectorAll('.fq-dsadd1').forEach(btn => {
    btn.onclick = () => fqDsAddModal(btn.dataset.gid, '');
  });
  ROOT.querySelectorAll('.fq-ds-del').forEach(btn => {
    btn.onclick = () => {
      const lib = fqDsLoad();
      if (!lib[btn.dataset.name]) return;
      if (!confirm('从全局链路库移除平台「' + btn.dataset.name + '」？（不影响第一层历史结果）')) return;
      delete lib[btn.dataset.name];
      fqDsSave(lib);
      const el = document.getElementById('fq-dslib-' + btn.dataset.g);
      if (el) el.innerHTML = fqDsLibHTML(btn.dataset.g);
      const cnt = document.getElementById('fq-dslibcnt-' + btn.dataset.g);
      if (cnt) cnt.textContent = Object.keys(lib).length + ' 平台';
    };
  });
  /* 链路库公共区块：区块折叠、第一层结果区数据源选定打钩 —— 事件委托，避免重渲染后绑定丢失 */
  if (!document._fqDsDelBound) {
    document._fqDsDelBound = true;
    document.addEventListener('click', ev => {
      const t = ev.target;
      if (!t || !t.closest) return;
      const hd = t.closest('.fq-dslib-hd');
      if (hd && hd.dataset && hd.dataset.gid) {
        const gid = hd.dataset.gid;
        const body = document.getElementById('fq-dslib-' + gid);
        const open = !(body && body.style.display === 'none');
        fqDsLibToggle(gid, !open);
      }
      const chd = t.closest('.fq-crawl-hd');
      if (chd && chd.dataset && chd.dataset.gid) {
        const gid = chd.dataset.gid;
        const body = document.getElementById('fq-crawlbody-' + gid);
        const open = !(body && body.style.display === 'none');
        fqCrawlToggle(gid, !open);
      }
      const cr = t.closest('.fq-crawlrun');
      if (cr && cr.dataset && cr.dataset.gid) fqCrawlRun(cr.dataset.gid, cr);
      const cl = t.closest('.fq-crawlclean');
      if (cl && cl.dataset && cl.dataset.gid) fqCrawlClean(cl.dataset.gid, cl);
      const pb = t.closest('.fq-crawl-paste');
      if (pb && pb.dataset && pb.dataset.g && pb.dataset.url) {
        ev.preventDefault();
        ev.stopPropagation();
        fqCrawlPaste(pb.dataset.g, pb.dataset.url);
      }
    });
    document.addEventListener('change', ev => {
      const ck = ev.target && ev.target.closest ? ev.target.closest('.fq-ds-sel') : null;
      if (!ck || !ck.dataset || !ck.dataset.g) return;
      fqDsSelToggle(ck.dataset.g, ck.dataset.name, ck.dataset.content, ck.checked);
    });
  }
}
function fqDsLibToggle(gid, open) {
  /* 展开 / 收起链路库公共区块 */
  if (!S.fq.dslibOpen) S.fq.dslibOpen = new Set(['L2', 'L3']);
  if (open) S.fq.dslibOpen.add(gid); else S.fq.dslibOpen.delete(gid);
  const body = document.getElementById('fq-dslib-' + gid);
  if (body) body.style.display = open ? '' : 'none';
  const hdEl = body && body.parentElement ? body.parentElement.querySelector('.fq-dslib-hd span') : null;
  if (hdEl) hdEl.textContent = open ? '▾' : '▸';
}
function fqDsSelToggle(gid, name, content, checked) {
  /* 第一层结果区打钩：更新本次运行选定的数据源（selected），作为第二层初始数据（保持 sources 原始顺序） */
  const code = S.fq.lprod || (fnLoad().products[0] || {}).code;
  const cell = fqLayerGet(gid, 'base', code);
  if (!cell || !cell.result || !Array.isArray(cell.result.sources)) return;
  const srcs = cell.result.sources;
  const src = srcs.find(s => s.name === name && (s.desc || s.keyword || '') === content);
  if (!src) return;
  const sel = Array.isArray(cell.result.selected) ? cell.result.selected.slice() : srcs.slice();
  const idx = sel.findIndex(x => x.name === name && (x.desc || x.keyword || '') === content);
  if (checked && idx < 0) {
    const eq = (a, b) => a.name === b.name && (a.desc || a.keyword || '') === (b.desc || b.keyword || '');
    const si = srcs.findIndex(s2 => eq(s2, src));
    let ins = sel.length;
    sel.forEach((x, i) => {
      const xi = srcs.findIndex(s2 => eq(s2, x));
      if (xi > si && i < ins) ins = i;
    });
    sel.splice(ins, 0, { ...src });
  }
  if (!checked && idx >= 0) sel.splice(idx, 1);
  cell.result.selected = sel;
  fqLayerSet(gid, 'base', cell);
  const planEl = document.getElementById('fq-dsplan-' + gid);
  if (planEl) planEl.innerHTML = fqDsPlanHTML(gid, code);
  const selNote = document.getElementById('fq-dsseln-' + gid);
  if (selNote) selNote.innerHTML = '<b>' + sel.length + '/' + cell.result.sources.length + '</b>';
}
function fqDsPlanHTML(g, code) {
  /* 第二层 · 数据源计划（第一层选定 · 本次运行资源）：作为第二层初始数据展示，并格式化注入提示词 {{data_sources}} */
  const base = fqLayerGet(g, 'base', code);
  const r = base && base.result;
  const srcs = (r && (Array.isArray(r.selected) && r.selected.length ? r.selected : r.sources)) || [];
  if (!srcs.length) return '<div class="fin-note" style="font-size:12px;padding:4px 0;">暂无数据源计划 —— 请先运行第 1 层（AI 推荐并入库）并选定数据源。</div>';
  const clean = fqCrawlCleanGet(g, code);
  const modeTxt = clean
    ? '<span style="color:var(--accent);">✅ 第二层数据源：AI 清洗版</span> —— 已爬取信息经 AI 清洗（筛除非正文），将直接代换本层提示词中的 {{event_dataset}} / {{industry_dataset}} / {{opinion_dataset}}'
    : '本层提示词数据源：<b>源计划列表</b>（未 AI 清洗）—— 爬取层完成「▶ 开始爬取 + 🤖 AI 清洗」后，将自动切换为清洗正文';
  return `<div style="background:rgba(143,216,184,.08);border-radius:8px;padding:8px 10px;font-size:12px;line-height:1.8;">
    <div style="margin-bottom:4px;color:var(--text-dim);">共 <b>${srcs.length}</b> 个数据源（来自第 1 层选定 · 本次运行）—— 本层提示词将以此为关键可替换值：</div>
    <div style="margin-bottom:4px;">${modeTxt}</div>
    ${srcs.map((s, i) => `<div>${i + 1}. <b>${esc(s.name || '')}</b>${s.type ? '（' + esc(s.type) + (s.authority ? ' · ' + esc(s.authority) : '') + '）' : ''} — ${esc(s.desc || '')}${s.keyword ? '（🔑 ' + esc(s.keyword) + '）' : ''}${s.url ? ' <a href="' + esc(s.url) + '" target="_blank" style="color:var(--accent);">🔗</a>' : ''}</div>`).join('')}
  </div>`;
}
const FQ_CRAWL_KEY = 'rt_fq_crawl';
function fqCrawlLoad() { try { return JSON.parse(localStorage.getItem(FQ_CRAWL_KEY) || '{}'); } catch (e) { return {}; } }
function fqCrawlSave(d) { localStorage.setItem(FQ_CRAWL_KEY, JSON.stringify(d)); }
function fqCrawlGet(gid, code) {
  const d = fqCrawlLoad();
  return (d[gid] && d[gid][code]) || {};
}
function fqCrawlSection(g) {
  /* 爬虫层：显示于数据源链路库与第二层之间，抓取选定数据源指向的信息（无 AI、无简化），点击条目展开前 50 字；进度可视化 */
  const lp = S.fq.lprod || (fnLoad().products[0] || {}).code;
  if (!S.fq.crawlOpen) S.fq.crawlOpen = new Set(['L2', 'L3']);
  const open = S.fq.crawlOpen.has(g.id);
  return `<div style="border:1px solid rgba(0,0,0,.08);border-radius:10px;margin-bottom:10px;overflow:hidden;background:#fff;">
    <div class="fq-crawl-hd" data-gid="${g.id}" style="display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;background:rgba(99,102,241,.10);">
      <span style="width:16px;text-align:center;font-size:12px;">${open ? '▾' : '▸'}</span>
      <b style="font-size:13px;">🕷 爬虫层（抓取选定数据源 · 简要预览）</b>
      <span style="flex:1;"></span>
      <span class="fin-note" id="fq-crawlstat-${g.id}" style="font-size:11px;"></span>
    </div>
    <div id="fq-crawlbody-${g.id}" style="padding:10px 12px;${open ? '' : 'display:none;'}">${fqCrawlHTML(g.id, lp)}</div>
  </div>`;
}
function fqCrawlHTML(gid, code) {
  const b = fqLayerGet(gid, 'base', code);
  const r = b && b.result;
  const srcs = (r && (Array.isArray(r.selected) && r.selected.length ? r.selected : r.sources)) || [];
  const map = fqCrawlGet(gid, code);
  if (!srcs.length) return '<div class="fin-note" style="font-size:12px;padding:4px 0;">暂无选定数据源 —— 请先运行第 1 层（AI 推荐并入库）并选定数据源。</div>';
  const withUrl = srcs.filter(s => s.url);
  const total = withUrl.length;
  const okN = withUrl.filter(s => map[s.url] && map[s.url].ok).length;
  const rows = srcs.map(s => {
    const st = map[s.url] || {};
    const icon = st.manual ? '📥' : (st.ok ? '✅' : (st.err ? '❌' : (st.run ? '⏳' : '⬜')));
    return `<div style="border-top:1px dashed rgba(0,0,0,.06);padding:3px 0;">
      <details data-url="${esc(s.url || '')}" style="font-size:12px;">
        <summary style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:2px 0;">
          <span>${icon}</span><b>${esc(s.name || '')}</b>
          <span class="fin-note" style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:280px;">${esc(s.desc || '')}</span>
          <span style="margin-left:auto;font-size:11px;color:${st.ok ? 'var(--accent)' : (st.err ? '#d2455a' : 'var(--text-dim)')};white-space:nowrap;">${st.manual ? '📥 手动 ' + st.len + ' 字' : (st.ok ? st.len + ' 字' : (st.err ? '失败' : (st.run ? '爬取中…' : (s.url ? '待爬取' : '无网址'))))}</span>
          <button class="btn sm soft fq-crawl-paste" data-g="${gid}" data-url="${esc(s.url || '')}" style="font-size:10.5px;padding:1px 8px;cursor:pointer;" title="手动粘贴该数据源正文（爬取失败 / 需人工补充时使用）">📥 粘贴</button>
        </summary>
        <div style="color:var(--text-dim);font-size:11.5px;line-height:1.7;padding:4px 8px 4px 26px;">${st.manual ? '📥 手动粘贴内容：' + esc(st.snippet) : (st.snippet ? '…' + esc(st.snippet) : (st.err ? '❌ 抓取失败：' + esc(st.err) : (st.run ? '正在抓取…' : (s.url ? '点击「▶ 开始爬取」获取前 50 字预览，或点击右侧「📥 粘贴」手动录入' : '该源无对应网址（第一层未给出 report_url），可点击右侧「📥 粘贴」手动录入'))))}</div>
      </details>
    </div>`;
  }).join('');
  return `<div style="font-size:11.5px;color:var(--text-dim);margin-bottom:6px;line-height:1.6;">
    爬取第二层将使用的 <b>${srcs.length}</b> 个选定数据源（含网址 ${total} 个），直接抓取网页正文（<b>无 AI、无简化</b>），点击条目展开查看前 50 字；
    <b>🤖 AI 清洗</b>将三组已爬取信息送 AI 筛除非正文（广告 / UI / 导航等），返回纯正文 JSON。
  </div>
  <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
    <button class="btn sm fq-crawlrun" data-gid="${gid}" style="font-size:12px;padding:3px 14px;">▶ 开始爬取</button>
    <button class="btn sm fq-crawlclean" data-gid="${gid}" style="font-size:12px;padding:3px 14px;background:linear-gradient(90deg,#6366f1,#2e9e6b);border-color:transparent;color:#fff;">🤖 AI 清洗</button>
    <div style="flex:1;height:7px;background:rgba(0,0,0,.06);border-radius:4px;overflow:hidden;">
      <div id="fq-crawlbar-${gid}" style="height:100%;width:${total ? (okN / total * 100) : 0}%;background:linear-gradient(90deg,#6366f1,#2e9e6b);transition:width .3s;"></div>
    </div>
    <span class="fin-note" id="fq-crawln-${gid}" style="font-size:11px;white-space:nowrap;">${okN}/${total} 成功</span>
  </div>
  <div id="fq-crawlclean-${gid}" style="margin-bottom:8px;">${fqCrawlCleanHTML(gid, code)}</div>
  ${rows}`;
}
function fqCrawlRender(gid) {
  /* 进度可视化：重渲染爬虫层主体并恢复已展开条目 */
  const body = ROOT.querySelector('#fq-crawlbody-' + gid);
  if (!body) return;
  const openUrls = [];
  body.querySelectorAll('details[open]').forEach(d => { const k = d.getAttribute('data-url'); if (k) openUrls.push(k); });
  const code = S.fq.lprod || (fnLoad().products[0] || {}).code;
  body.innerHTML = fqCrawlHTML(gid, code);
  openUrls.forEach(k => { const d = body.querySelector('details[data-url="' + k + '"]'); if (d) d.open = true; });
}
async function fqCrawlRun(gid, btn) {
  /* 逐源串行爬取：每个源完成后更新进度（进度条 / 计数 / 状态徽标） */
  const code = S.fq.lprod || (fnLoad().products[0] || {}).code;
  const b = fqLayerGet(gid, 'base', code);
  const r = b && b.result;
  const srcs = (r && (Array.isArray(r.selected) && r.selected.length ? r.selected : r.sources)) || [];
  const withUrl = srcs.filter(s => s.url);
  if (!withUrl.length) { toast('选定数据源均无网址 —— 请重新运行第 1 层（新版提示词要求每个源给出 report_url）', 'warn'); return; }
  const d = fqCrawlLoad();
  if (!d[gid]) d[gid] = {};
  if (!d[gid][code]) d[gid][code] = {};
  const map = d[gid][code];
  /* 跳过已手动粘贴的源（手动结果不被自动爬取覆盖）；其余源重新爬取 */
  const todo = withUrl.filter(s => !(map[s.url] && map[s.url].manual));
  if (!todo.length) { toast('所有有网址的数据源均已手动粘贴 / 爬取完成', 'info'); return; }
  let okN = 0;
  for (const s of todo) {
    map[s.url] = { ...(map[s.url] || {}), run: true };
    fqCrawlSave(d); fqCrawlRender(gid);
    try {
      const res = await apiPost('/api/plugin/finance/crawl', { url: s.url });
      if (res && res.aborted) break;
      if (res && res.ok) { map[s.url] = { ok: true, snippet: res.snippet || '', len: res.len || 0, full: res.full || '', ts: Date.now() }; okN++; }
      else { map[s.url] = { ok: false, err: (res && res.error) || '未知错误', ts: Date.now() }; }
    } catch (e) { if (FQ_ABORT) break; map[s.url] = { ok: false, err: e.message || String(e), ts: Date.now() }; }
    fqCrawlSave(d); fqCrawlRender(gid);
  }
  toast('爬取完成：成功 ' + okN + ' / ' + todo.length + ' 个数据源' + (withUrl.length > todo.length ? '（另有 ' + (withUrl.length - todo.length) + ' 个手动结果保留）' : ''), okN ? 'success' : 'error');
}
function fqCrawlToggle(gid, open) {
  if (!S.fq.crawlOpen) S.fq.crawlOpen = new Set(['L2', 'L3']);
  if (open) S.fq.crawlOpen.add(gid); else S.fq.crawlOpen.delete(gid);
  const body = document.getElementById('fq-crawlbody-' + gid);
  if (body) body.style.display = open ? '' : 'none';
  const hd = body && body.parentElement ? body.parentElement.querySelector('.fq-crawl-hd span') : null;
  if (hd) hd.textContent = open ? '▾' : '▸';
}
function fqCrawlSaveManual(gid, url, text) {
  /* 手动粘贴：将数据源文本直接存入爬取结果（manual 标记，展示前 50 字） */
  const code = S.fq.lprod || (fnLoad().products[0] || {}).code;
  const d = fqCrawlLoad();
  if (!d[gid]) d[gid] = {};
  if (!d[gid][code]) d[gid][code] = {};
  d[gid][code][url] = { ok: true, snippet: text.slice(0, 50), len: text.length, full: text, manual: true, ts: Date.now() };
  fqCrawlSave(d);
  fqCrawlRender(gid);
  toast('已保存手动内容（' + text.length + ' 字）', 'success');
}
function fqCrawlPaste(gid, url) {
  /* 手动粘贴弹窗：用于爬取失败 / 规模化数据人工补充（正确率 ~90% 之外的兜底） */
  const b = fqLayerGet(gid, 'base', S.fq.lprod || (fnLoad().products[0] || {}).code);
  const srcs = (b && b.result && (Array.isArray(b.result.selected) && b.result.selected.length ? b.result.selected : b.result.sources)) || [];
  const src = srcs.find(s => s.url === url);
  modal({
    title: '📥 手动粘贴 · ' + (src ? src.name : ''),
    body: '<div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;line-height:1.6;">粘贴该数据源对应的正文 / 关键信息（将展示前 50 字，完整长度自动记录）：</div>'
      + '<textarea id="fq-crawl-paste-ta" style="width:100%;height:150px;box-sizing:border-box;padding:8px;border:1px solid rgba(0,0,0,.15);border-radius:8px;font-family:inherit;font-size:12.5px;resize:vertical;" placeholder="在此粘贴文本内容…"></textarea>',
    actions: [
      { label: '取消', cls: 'soft', onClick: m => m.remove() },
      { label: '保存', cls: '', onClick: m => {
        const ta = document.getElementById('fq-crawl-paste-ta');
        const txt = (ta && ta.value || '').trim();
        if (!txt) { toast('内容为空，未保存', 'warn'); return; }
        fqCrawlSaveManual(gid, url, txt);
        m.remove();
      } },
    ],
  });
}
const FQ_CLEAN_KEY = 'rt_fq_crawl_clean';
function fqCrawlCleanLoad() { try { return JSON.parse(localStorage.getItem(FQ_CLEAN_KEY) || '{}'); } catch (e) { return {}; } }
function fqCrawlCleanSave(d) { localStorage.setItem(FQ_CLEAN_KEY, JSON.stringify(d)); }
function fqCrawlCleanGet(gid, code) {
  const d = fqCrawlCleanLoad();
  return (d[gid] && d[gid][code]) || null;
}
function fqCrawlCleanBad(obj) {
  /* AI 清洗结果审查（宽松阈值）：三键数组且条目为对象即通过；
     缺 url / status 的条目由 pushOk 丢弃，不因个别坏条目重跑整批。
     仅当组缺失、非数组或条目非对象时才判定失败（DS 正确率极高，勿轻易判错） */
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '解析失败（非 JSON 对象）';
  const keys = ['company', 'industry', 'discussion'];
  for (const k of keys) {
    if (!Array.isArray(obj[k])) return '缺少 ' + k + ' 数组';
    if (obj[k].some(it => !it || typeof it !== 'object')) return k + ' 存在非法条目';
  }
  return null;
}
function fqCleanGroupTxt(clean, g) {
  /* 清洗组 → 第二层提示词可替换文本：ok 条目含标题与全文正文；failed 条目标注爬取失败 */
  const items = clean[g] || [];
  return items.map((it, i) => {
    if (it && it.status === 'ok' && it.content) {
      return (i + 1) + '. ' + (it.title || it.url || '') + '（网址：' + (it.url || '') + '）\n正文：' + it.content;
    }
    return (i + 1) + '. ' + ((it && it.title) || '爬取失败') + '（网址：' + ((it && it.url) || '') + '）\n内容：爬取失败，无正文';
  }).join('\n');
}
function fqCrawlCleanHTML(gid, code) {
  /* 清洗结果可视化：三组卡片（✅ ok 展开正文 / ❌ 爬取失败） */
  const clean = fqCrawlCleanGet(gid, code);
  if (!clean) return '<div class="fin-note" style="font-size:12px;padding:2px 0;">尚未 AI 清洗 —— 点击「🤖 AI 清洗」将三组已爬取信息送 AI 筛除非正文，返回纯正文 JSON。</div>';
  const cats = [['company', '🏢 公司事件信息组'], ['industry', '🏭 产业新闻信息组'], ['discussion', '💬 舆情讨论信息组']];
  return cats.map(([c, zh]) => {
    const items = clean[c] || [];
    const rows = items.map(it => {
      const okk = it.status === 'ok';
      return `<div style="border-top:1px dashed rgba(0,0,0,.06);padding:3px 0;">
        <details data-curl="${esc(it.url || '')}" style="font-size:12px;">
          <summary style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:2px 0;">
            <span>${okk ? '✅' : '❌'}</span>
            <b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:360px;">${esc(it.title || it.url || '')}</b>
            <span style="margin-left:auto;font-size:11px;color:${okk ? 'var(--accent)' : '#d2455a'};white-space:nowrap;">${okk ? (it.content ? it.content.length + ' 字' : '已清洗') : '爬取失败'}</span>
          </summary>
          <div style="color:var(--text-dim);font-size:11.5px;line-height:1.7;padding:4px 8px 4px 26px;">${okk ? (it.content ? '<div style="max-height:220px;overflow:auto;white-space:pre-wrap;word-break:break-word;">' + esc(it.content) + '</div>' : '已清洗（无正文）') : '该数据源明显不含正文，AI 判定为爬取失败'}</div>
        </details>
      </div>`;
    }).join('');
    return `<div style="margin:6px 0;border:1px solid rgba(0,0,0,.08);border-radius:8px;padding:6px 10px;background:rgba(99,102,241,.03);">
      <div style="font-size:12.5px;font-weight:600;margin-bottom:4px;">${zh}（${items.length}）</div>
      ${rows || '<div class="fin-note">无条目</div>'}
    </div>`;
  }).join('');
}
async function fqCrawlClean(gid, btn) {
  /* AI 清洗（手动路径）：将已爬取信息按「≤5 条 / ≤10000 字符」双重限制拆批逐发，每批 ≤3 次重试，进度写入 #fq-crawlclean-<gid> */
  const code = S.fq.lprod || (fnLoad().products[0] || {}).code;
  const b = fqLayerGet(gid, 'base', code);
  const r = b && b.result;
  const srcs = (r && (Array.isArray(r.selected) && r.selected.length ? r.selected : r.sources)) || [];
  const map = fqCrawlGet(gid, code);
  const ready = srcs.filter(s => s.url && map[s.url] && map[s.url].ok);
  if (!ready.length) { toast('请先爬取 / 手动粘贴数据源（至少 1 条成功）后再清洗', 'warn'); return; }
  fqAbortReset(); /* 新一次清洗：清除上次中断标志 */
  if (btn) { btn.disabled = true; btn.textContent = '⏳ AI 清洗中…'; }
  const note = document.getElementById('fq-crawlclean-' + gid);
  fqAbortMount(note, 'AI 清洗');
  try {
    const url = await fqLayerWebSess('base');
    if (!url) throw new Error('网页会话不可用（请先在 AI 工作台添加会话链接或完成登录）');
    const batches = fqCleanSplitBatches(ready, map, 10000, 5);
    const merged = { company: [], industry: [], discussion: [] };
    const seen = new Set();
    const pushOk = (c, it) => { if (it && it.status === 'ok' && it.url && !seen.has(it.url)) { seen.add(it.url); merged[c].push({ url: it.url, status: 'ok', title: it.title || '', content: it.content || '' }); } };
    for (let bi = 0; bi < batches.length; bi++) {
      fqAbortCheck();
      const batch = batches[bi];
      if (note) note.innerHTML = '<div class="fin-note" style="font-size:12px;padding:2px 0;">🧹 AI 清洗 · 批次 ' + (bi + 1) + '/' + batches.length + '（' + batch.items.length + ' 条 · ' + batch.chars + ' 字符' + (batch.single ? ' · 独立单条' : '') + (batch.compress ? ' · 超长压缩' : '') + '）…</div>';
      fqAbortMount(note, 'AI 清洗');
      let attempts = 0, lastErr = '';
      while (true) {
        attempts++;
        if (note) note.innerHTML = '<div class="fin-note" style="font-size:12px;padding:2px 0;">🧹 AI 清洗 · 批次 ' + (bi + 1) + '/' + batches.length + '（' + batch.items.length + ' 条 · ' + batch.chars + ' 字符）· 尝试 ' + attempts + '/3（会话 …' + url.slice(-10) + '）…</div>';
        fqAbortMount(note, 'AI 清洗');
        try {
          const res = await fqChatPost(url, batch.prompt, 195000, 'clean');
          if (!res || !res.ok) {
            if (res && res.aborted) throw new Error('⛔ 已手动中断');
            if (res && res.code === 'need_login') throw new Error('网页登录已失效，请重新登录');
            if (res && res.timeout) throw new Error('超时（90 秒无响应）');
            throw new Error((res && res.error) || '未知错误');
          }
          const obj = fqParseJSON(res.text);
          const bad = fqCrawlCleanBad(obj);
          if (!bad) { ['company', 'industry', 'discussion'].forEach(c => { (obj[c] || []).forEach(it => pushOk(c, it)); }); break; }
          lastErr = bad;
        } catch (e) { lastErr = e.message || String(e); }
        if (attempts >= 3) throw new Error('批次连续 3 次异常：' + lastErr);
      }
    }
    const d = fqCrawlCleanLoad();
    if (!d[gid]) d[gid] = {};
    d[gid][code] = { company: merged.company, industry: merged.industry, discussion: merged.discussion, ts: fmtDate(new Date()) + ' ' + new Date().toTimeString().slice(0, 5) };
    fqCrawlCleanSave(d);
    fqCrawlRender(gid);
    if (note) note.innerHTML = '';
    const n = merged.company.length + merged.industry.length + merged.discussion.length;
    toast('AI 清洗完成：' + n + ' 条（有效正文 ' + seen.size + '）', 'success');
  } catch (e) {
    if (note) note.innerHTML = '<div class="fin-note" style="font-size:12px;padding:2px 0;">' + (FQ_ABORT ? '⛔ 已手动中断（已完成批次已保留，未写入存储）' : '❌ AI 清洗异常（' + esc(e.message || '') + '）—— 请重试或检查网页会话') + '</div>';
    if (FQ_ABORT) { toast('⛔ AI 清洗已中断', 'warn'); } else { toast('AI 清洗失败：' + e.message, 'error'); }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🤖 AI 清洗'; }
  }
}
function fqLayerGet(gid, lid, code) {
  /* 产品级信息库：{gid:{lid:{code:{result,raw,ts,mode,product}}}}；code 为空时返回该层任意最新记录 */
  const all = finContentGet(FQ_LAYER_KEY) || {};
  let cell = (all[gid] || {})[lid];
  if (!cell) return null;
  /* 兼容旧格式：单条记录（含 code 顶层字段）→ 迁移为按产品分档 */
  if (cell.code && typeof cell.code === 'string') {
    const mig = {};
    mig[cell.code] = cell;
    cell = mig;
    (all[gid] = all[gid] || {})[lid] = mig;
    finContentSet(FQ_LAYER_KEY, all);
  }
  if (code != null) {
    const rec = cell[code];
    return rec ? Object.assign({ code }, rec) : null;
  }
  const codes = Object.keys(cell);
  if (!codes.length) return null;
  const c = codes[codes.length - 1];
  return Object.assign({ code: c }, cell[c]);
}
function fqLayerSet(gid, lid, v) {
  /* 按产品归档：同一 (gid,lid) 下各产品结果互不覆盖 */
  if (!v || !v.code) return;
  const all = finContentGet(FQ_LAYER_KEY) || {};
  const code = v.code;
  if (!all[gid]) all[gid] = {};
  if (!all[gid][lid] || typeof all[gid][lid] !== 'object' || all[gid][lid].code) all[gid][lid] = {};
  all[gid][lid][code] = { product: v.product, result: v.result, raw: v.raw, ts: v.ts, mode: v.mode };
  finContentSet(FQ_LAYER_KEY, all);
}
function fqSanitizeJSON(t) {
  /* 容错：将 JSON 字符串值内的裸控制字符（换行/回车/制表）替换为空格，
     处理 DS 美化输出时字符串跨行导致的「Invalid control character」。 */
  let out = '', inStr = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (c === '\\') { out += t[i] + (t[i + 1] || ''); i++; continue; }
      if (c === '"') { inStr = false; out += c; continue; }
      if (c === '\n' || c === '\r' || c === '\t') { out += ' '; continue; }
      out += c; continue;
    }
    if (c === '"') inStr = true;
    out += c;
  }
  return out;
}
function fqParseJSON(text) {
  /* 正则定位正确 JSON：优先 ```json/``` 围栏块；剥离「json」「复制」「下载」等代码块头部标签
     与前后缀说明文字；对字符串值内裸控制字符做容错清洗。
     裁剪兜底必须「对象优先」——对象内嵌数组（如第五层 item_scores）时，
     若先按数组裁剪会误命中内部数组、返回类型错误的片段。 */
  let t = String(text || '').trim();
  const fm = t.match(/```(?:json|js|javascript)?\s*([\s\S]*?)```/i);
  if (fm) t = fm[1].trim();
  t = fqSanitizeJSON(t);
  try { return JSON.parse(t); } catch { /* 继续 */ }
  /* 主体提取：从首个 { 或 [ 截取到对应末尾，剥掉头部标签文字 */
  const core = t.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (core) {
    try { return JSON.parse(core[0]); } catch { /* 继续裁剪 */ }
  }
  /* 兜底：对象起始早于数组 → 对象优先（防内部数组误裁） */
  const bs = t.indexOf('['), be = t.lastIndexOf(']');
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s >= 0 && e > s && (bs < 0 || s < bs)) {
    try { return JSON.parse(t.slice(s, e + 1)); } catch { /* 尝试数组 */ }
  }
  if (bs >= 0 && be > bs) {
    try { return JSON.parse(t.slice(bs, be + 1)); } catch { /* 尝试对象 */ }
  }
  if (s >= 0 && e > s) {
    try { return JSON.parse(t.slice(s, e + 1)); } catch { /* 尝试宽松提取 */ }
  }
  /* 宽松兜底：清洗 JSON（company/industry/discussion 三组）若整体解析失败
     （如某条正文含未转义引号破坏结构），逐键提取数组片段；片段解析失败时
     再逐对象提取（跳过坏条目）。仅当能解出 ≥1 组才返回 */
  try {
    const loose = {};
    ['company', 'industry', 'discussion'].forEach(k => {
      const m = t.match(new RegExp('"' + k + '"\\s*:\\s*(\\[[\\s\\S]*?\\])(?=,|\\s*})'));
      if (m) {
        let a = null;
        try { const x = JSON.parse(m[1]); if (Array.isArray(x)) a = x; } catch (e) { a = null; }
        if (!a) {
          /* 数组片段整体不可解析 → 逐对象提取（正则提取 {…}，跳过含未转义引号的坏对象） */
          const items = [];
          const re = /\{[^{}]*\}/g;
          let mm;
          while ((mm = re.exec(m[1]))) {
            try { items.push(JSON.parse(mm[0])); } catch (e) { /* 坏条目跳过 */ }
          }
          if (items.length) a = items;
        }
        if (a) loose[k] = a;
      }
    });
    if (loose.company || loose.industry || loose.discussion) {
      /* 补齐缺失组为空数组，保证 fqCrawlCleanBad 结构校验通过（坏条目丢弃，不整批重跑） */
      ['company', 'industry', 'discussion'].forEach(k => { if (!loose[k]) loose[k] = []; });
      return loose;
    }
  } catch (e) { /* 放弃宽松提取 */ }
  return null;
}
function fqLayerItemCard(it) {
  const keys = Object.keys(it);
  return `<div style="border:1px solid rgba(0,0,0,.07);border-radius:8px;padding:6px 10px;margin:6px 0;font-size:12.5px;line-height:1.8;">
    ${keys.map(k => `<div><b style="color:var(--text-dim);font-weight:600;">${esc(k)}：</b>${it[k] == null || it[k] === '' ? '<span class="fin-note">null</span>' : esc(String(it[k]))}</div>`).join('')}
  </div>`;
}
function fqLayerTableArr(arr) {
  /* JSON 数组结果展示：带 section 分组（items 为对象 → 键值表格 / 数组 → 子项卡片）；扁平对象 → 单条卡片 */
  if (!Array.isArray(arr) || !arr.length) return fqLayerTable(arr);
  return arr.map(sec => {
    if (!sec || typeof sec !== 'object') return fqLayerTable(sec);
    if (!sec.section && !sec.items) return fqLayerItemCard(sec);
    const items = sec.items && typeof sec.items === 'object' ? sec.items : sec;
    const title = sec.section || '';
    if (Array.isArray(items)) {
      return `<div style="margin-bottom:8px;">
        <b style="font-size:12.5px;">${title ? esc(title) : ''}</b>
        ${items.map(it => (it && typeof it === 'object' ? fqLayerItemCard(it) : '')).join('')}
      </div>`;
    }
    const keys = Object.keys(items);
    if (!keys.length) return fqLayerTable(sec);
    return `<div style="margin-bottom:8px;">
      <b style="font-size:12.5px;">${title ? esc(title) : ''}</b>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
      ${keys.map(k => `<tr><td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);color:var(--text-dim);width:190px;">${esc(k)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);">${items[k] == null || items[k] === '' ? '<span class="fin-note">null</span>' : esc(String(items[k]))}</td></tr>`).join('')}
      </table>
    </div>`;
  }).join('');
}
function fqLayerTable(obj) {
  if (!obj) return '<div class="empty" style="padding:12px;">暂无结果</div>';
  return `<table style="width:100%;border-collapse:collapse;font-size:12.5px;">
    ${FQ_FIELDS.map(f => `<tr><td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);color:var(--text-dim);width:190px;">${FQ_FIELD_ZH[f] || f}</td>
      <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);">${obj[f] == null || obj[f] === '' ? '<span class="fin-note">null</span>' : esc(String(obj[f]))}</td></tr>`).join('')}
  </table>`;
}
function fqFindConf(prev2, name) {
  /* 从第 4 层（置信度审查）结果中按指标名称查置信度条目 */
  if (!prev2 || !Array.isArray(prev2.result)) return null;
  for (const sec of prev2.result) {
    if (Array.isArray(sec)) { for (const it of sec) if (it && it['指标名称'] === name) return it; }
    else if (sec && typeof sec === 'object') {
      if (sec['指标名称'] === name) return sec;
      if (Array.isArray(sec.items)) {
        const f = sec.items.find(it => it && it['指标名称'] === name);
        if (f) return f;
      }
    }
  }
  return null;
}
function fqLayerPrev(gid, lid, code) {
  /* 上一层在当前产品下的结果；无则 null */
  return fqLayerGet(gid, lid, code);
}
function fqFillPrompt(layer, p, prev, prev2, gid) {
  /* 填充提示词模板变量：{{PRODUCT_INPUT}} 产品原始信息；{{items_block}} 上一层小点列表；{{param_evaluation_full}} 评估+置信度合并；
     L2 中期预期类第二层使用 prompt2（事件细节综合评价模板），其 {{event_dataset}}/{{industry_dataset}}/{{opinion_dataset}}
     按第一层选定数据源（company/industry/discussion）分组格式化注入；其余 {{字段}} 用上一层结果 */
  let t = (gid === 'L2' && layer.prompt2) ? layer.prompt2 : (layer.prompt || '');
  if (t.indexOf('{{PRODUCT_INPUT}}') >= 0) {
    const input = 'product_id:' + p.code + ', product_name: ' + p.name + '，latest_price:' + (p.last_nav != null ? p.last_nav : 'null');
    t = t.replace('{{PRODUCT_INPUT}}', input);
  }
  if (t.indexOf('{{items_block}}') >= 0) {
    /* 第 4 层输入：将上一层（核心参数细节评估）结果拍平为编号小点列表 */
    const lines = [];
    if (prev && Array.isArray(prev.result)) {
      prev.result.forEach(sec => {
        if (sec && Array.isArray(sec.items)) sec.items.forEach(it => {
          if (it && typeof it === 'object') {
            const s = ['指标', '评估结论', '论据摘要', '数据来源']
              .filter(k => it[k] != null && it[k] !== '')
              .map(k => k + '：' + it[k]).join('；');
            if (s) lines.push(s);
          }
        });
      });
    }
    t = t.replace('{{items_block}}', lines.length ? lines.map((l, i) => (i + 1) + '. ' + l).join('\n') : 'null');
  }
  if (t.indexOf('{{param_evaluation_full}}') >= 0) {
    /* 第 5 层输入：合并第 3 层（评估小点）与第 4 层（置信度审查），按指标名配对 */
    const lines = [];
    if (prev && Array.isArray(prev.result)) {
      prev.result.forEach(sec => {
        if (sec && Array.isArray(sec.items)) sec.items.forEach(it => {
          if (it && typeof it === 'object') {
            const name = it['指标'] || '';
            const conf = fqFindConf(prev2, name);
            const block = [
              '指标：' + name,
              '评估结论：' + (it['评估结论'] != null ? it['评估结论'] : 'null'),
              '论据摘要：' + (it['论据摘要'] != null ? it['论据摘要'] : 'null'),
              '数据来源：' + (it['数据来源'] != null ? it['数据来源'] : 'null'),
            ];
            if (conf) block.push('置信度得分：' + (conf['置信度得分'] != null ? conf['置信度得分'] : 'null') + '（扣分说明：' + (conf['扣分说明'] != null ? conf['扣分说明'] : 'null') + '）');
            if (name || block.length > 1) lines.push(block.join('\n'));
          }
        });
      });
    }
    t = t.replace('{{param_evaluation_full}}', lines.length ? lines.map((l, i) => (i + 1) + '. ' + l).join('\n') : 'null');
  }
  if (t.indexOf('{{data_sources}}') >= 0) {
    /* 第二层提示词关键可替换值：第一层选定的数据源计划（格式化：编号 · 平台（类型 · 权威）— 具体公告（🔑 关键词）） */
    const r = prev && prev.result;
    const srcs = (r && (Array.isArray(r.selected) && r.selected.length ? r.selected : (Array.isArray(r.sources) ? r.sources : null))) || null;
    t = t.replace('{{data_sources}}', srcs && srcs.length
      ? '【数据源计划（共 ' + srcs.length + ' 个）】\n' + srcs.map((s, i) => (i + 1) + '. ' + (s.name || '') + (s.type ? '（' + s.type + (s.authority ? ' · ' + s.authority : '') + '）' : '') + (s.desc ? ' — ' + s.desc : '') + (s.keyword ? '（抓取关键词：' + s.keyword + '）' : '')).join('\n')
      : 'null');
  }
  const needDS = ['{{event_dataset}}', '{{industry_dataset}}', '{{opinion_dataset}}'].some(k => t.indexOf(k) >= 0);
  if (needDS) {
    /* L2 中期预期 · 第二 / 三层：主数据源 = 爬虫层 AI 清洗结果（三组正文，直接代换 {{event_dataset}} 等）；
       无清洗结果时回退为按类别分组的第一层选定数据源列表 */
    const code = S.fq.lprod || (fnLoad().products[0] || {}).code;
    const b = fqLayerGet(gid, 'base', code);
    const br = b && b.result;
    const sel = (br && Array.isArray(br.selected) && br.selected.length) ? br.selected : ((br && Array.isArray(br.sources)) ? br.sources : []);
    const fmtSrc = list => list.map((s, i) => (i + 1) + '. ' + (s.name || '') + (s.type ? '（' + s.type + (s.authority ? ' · ' + s.authority : '') + '）' : '') + (s.desc ? ' — ' + s.desc : '') + (s.keyword ? '（抓取关键词：' + s.keyword + '）' : '')).join('\n');
    const clean = fqCrawlCleanGet(gid, code);
    const map = [
      ['{{event_dataset}}', 'company', '公司事件数据源'],
      ['{{industry_dataset}}', 'industry', '产业新闻数据源'],
      ['{{opinion_dataset}}', 'discussion', '舆情讨论数据源'],
    ];
    map.forEach(([k, c, zh]) => {
      if (t.indexOf(k) < 0) return;
      if (clean) {
        const items = clean[c] || [];
        t = t.replace(k, items.length
          ? '【' + zh + ' · AI 清洗正文】\n' + fqCleanGroupTxt(clean, c)
          : '【' + zh + ' · AI 清洗正文】（无已爬取条目）');
      } else {
        const list = sel.filter(s => s.category === c);
        t = t.replace(k, list.length ? '【' + zh + '】\n' + fmtSrc(list) : '【' + zh + '】（无选定数据源）');
      }
    });
  }
  if (t.indexOf('{{mid_overview}}') >= 0) {
    /* L2 中期预期 · 第三层：{{mid_overview}} = 第二层（总览型基础信息生成层）最终结果（事件/产业/舆情三总览） */
    const ov = prev && prev.result;
    let txt = 'null';
    if (ov && typeof ov === 'object' && !Array.isArray(ov)) {
      const secs = [['event_overview', '事件总览'], ['industry_news_overview', '产业新闻总览'], ['opinion_overview', '舆情总览']];
      txt = secs.map(([k, zh]) => '【' + zh + '】\n' + (ov[k] != null ? JSON.stringify(ov[k], null, 1) : 'null')).join('\n\n');
    }
    t = t.replace('{{mid_overview}}', txt);
  }
  if (t.indexOf('{{param_mid_evaluation}}') >= 0) {
    /* L2 中期预期 · 第四/五层：{{param_mid_evaluation}} = 第三层（四维 12 小点）格式化；
       第五层（有 prev2=第四层审查结果）时按指标名配对追加置信度与扣分说明 */
    const ev = prev && prev.result;
    const conf = prev2 && prev2.result;
    const confMap = {};
    if (Array.isArray(conf)) conf.forEach(c => { if (c && c.item_name != null) confMap[String(c.item_name)] = c; });
    const lines = [];
    if (ev && typeof ev === 'object' && !Array.isArray(ev)) {
      const dims = ['event_expectation_gap', 'industry_expectation_correction', 'public_opinion_score', 'opinion_divergence'];
      let i = 0;
      dims.forEach(d => {
        const sec = ev[d];
        if (sec && Array.isArray(sec.items)) sec.items.forEach(it => {
          if (it && it.item_name) {
            i++;
            const evid = it.evidence ? '（论据：' + it.evidence + (it.source ? '；来源：' + it.source : '') + '）' : '';
            let line = i + '. ' + it.item_name + '：' + (it.conclusion || 'null') + evid;
            const c = confMap[String(it.item_name)];
            if (c) line += '（置信度：' + (typeof c.confidence_score === 'number' ? c.confidence_score.toFixed(2) : c.confidence_score) + '；扣分说明：' + (c.deduction_reason || '') + '）';
            lines.push(line);
          }
        });
      });
    }
    t = t.replace('{{param_mid_evaluation}}', lines.length ? lines.join('\n') : 'null');
  }
  if (t.indexOf('{{industry_level2}}') >= 0 && (!prev || !prev.result || prev.result.industry_level2 == null)) {
    /* 第三层（prev 为第二层结果，无 industry_level2）：从第 1 层基础信息补取 */
    const code = S.fq.lprod || (fnLoad().products[0] || {}).code;
    const b = fqLayerGet(gid, 'base', code);
    const l2 = b && b.result && b.result.industry_level2;
    t = t.replace('{{industry_level2}}', l2 != null && l2 !== '' ? String(l2) : 'null');
  }
  if (prev) {
    const dict = {};
    if (prev.result) {
      if (Array.isArray(prev.result)) {
        prev.result.forEach(sec => {
          if (sec && typeof sec === 'object') {
            if (Array.isArray(sec.items)) {
              sec.items.forEach(it => { if (it && typeof it === 'object') Object.assign(dict, it); });
            } else if (sec.items && typeof sec.items === 'object') {
              Object.assign(dict, sec.items);
            } else {
              Object.assign(dict, sec);
            }
          }
        });
        /* 语义别名：{{company_full_name}} ← 公司全称；{{industry_level1}} ← 一级产业；{{chain_position}} ← 所处产业链环节 */
        const alias = { company_full_name: '公司全称', industry_level1: '一级产业', chain_position: '所处产业链环节' };
        Object.keys(alias).forEach(a => {
          const v = dict[alias[a]];
          if (v != null && v !== '') t = t.split('{{' + a + '}}').join(String(v));
        });
      } else {
        Object.keys(prev.result).forEach(k => { dict[k] = prev.result[k]; });
      }
    }
    /* 产品基础字段恒可填充（{{product_id}}/{{product_name}} 等） */
    if (p) { dict['product_id'] = p.code; dict['product_name'] = p.name; }
    Object.keys(dict).forEach(k => {
      const v = dict[k];
      t = t.split('{{' + k + '}}').join(v == null || v === '' ? 'null' : String(v));
    });
  }
  t = t.replace(/\{\{\s*[A-Za-z_]+(?:_[A-Za-z_]+)*\s*\}\}/g, 'null');
  return t;
}
function fqLayerTableObj(obj) {
  /* 通用对象结果展示（第 5 层评分输出等）：顶层标量键值 + dim_scores 子表 + item_scores 表格 */
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return fqLayerTable(obj);
  const scalars = Object.keys(obj).filter(k => obj[k] == null || typeof obj[k] !== 'object');
  let html = '';
  if (scalars.length) {
    html += `<table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:8px;">
      ${scalars.map(k => `<tr><td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);color:var(--text-dim);width:190px;">${esc(k)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);">${obj[k] == null || obj[k] === '' ? '<span class="fin-note">null</span>' : esc(String(obj[k]))}</td></tr>`).join('')}
    </table>`;
  }
  const dim = obj.dim_scores;
  if (dim && typeof dim === 'object') {
    const zh = { scale: '规模体量', profit: '盈利质量', growth: '成长能力' };
    html += `<div style="font-size:12.5px;font-weight:600;margin-bottom:4px;">维度得分</div>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:8px;">
      ${Object.keys(dim).map(k => `<tr><td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);color:var(--text-dim);width:190px;">${esc(zh[k] || k)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);">${dim[k] == null ? '<span class="fin-note">null</span>' : esc(String(dim[k]))}</td></tr>`).join('')}
      </table>`;
  }
  if (Array.isArray(obj.item_scores) && obj.item_scores.length) {
    html += `<div style="font-size:12.5px;font-weight:600;margin-bottom:4px;">分项评分</div>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
      <tr style="background:rgba(143,216,184,.14);"><td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.08);">指标名称</td><td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.08);">原始得分</td><td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.08);">置信度</td><td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.08);">最终得分</td></tr>
      ${obj.item_scores.map(it => `<tr><td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);">${it && it.name != null ? esc(String(it.name)) : '<span class="fin-note">null</span>'}</td>
        <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);">${it && it.raw_score != null ? esc(String(it.raw_score)) : '<span class="fin-note">null</span>'}</td>
        <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);">${it && it.confidence != null ? esc(String(it.confidence)) : '<span class="fin-note">null</span>'}</td>
        <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);"><b>${it && it.final_score != null ? esc(String(it.final_score)) : '<span class="fin-note">null</span>'}</b></td></tr>`).join('')}
      </table>`;
  }
  return html || fqLayerTable(obj);
}
function fqMidResHTML(r) {
  /* L2 中期预期第二层结果：事件总览 / 产业新闻总览 / 舆情总览（三区块卡片） */
  const zh = { event_overview: '📅 事件总览', industry_news_overview: '🏭 产业新闻总览', opinion_overview: '💬 舆情总览' };
  const FN = { event_count: '事件总数量', main_event_types: '主要事件类型', event_time_distribution: '事件时间分布', core_event_summary: '核心事件总览', event_list: '事件详情列表', news_count: '产业新闻总条数', core_topics: '核心主题', boom_direction: '景气方向', boom_direction_basis: '景气方向判断依据', industry_chain_involved: '涉及产业链节点', cover_platforms: '覆盖平台', total_discussion_volume: '讨论总量级', overall_emotion_tone: '整体情绪基调', overall_emotion_tone_basis: '整体情绪基调判断依据', user_structure: '用户结构' };
  return Object.keys(zh).map(k => {
    const o = r[k] || {};
    const rows = Object.keys(o).map(f => {
      const v = o[f];
      let disp;
      if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
        /* 对象数组（如 event_list 事件详情列表）→ 条目卡片：类型 · 标题 + 描述 */
        disp = v.map(it => {
          const t = it && it.event_type ? '<b>' + esc(it.event_type) + '</b>' : '';
          const ti = it && it.event_title ? esc(it.event_title) : '';
          const d = it && it.event_description ? esc(it.event_description) : '';
          return '<div style="padding:5px 7px;border:1px solid rgba(0,0,0,.07);border-radius:6px;margin:3px 0;">'
            + ((t || ti) ? '<div style="font-weight:600;margin-bottom:2px;">' + (t ? t + (ti ? ' · ' + ti : '') : ti) + '</div>' : '')
            + (d ? '<div style="color:var(--text-dim);line-height:1.5;">' + d + '</div>' : '')
            + '</div>';
        }).join('');
      } else {
        disp = Array.isArray(v) ? v.join('、') : (v == null ? '—' : String(v));
        disp = esc(disp);
      }
      return `<tr><td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);width:160px;color:var(--text-dim);vertical-align:top;">${esc(FN[f] || f)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);">${disp}</td></tr>`;
    }).join('');
    return `<div style="border:1px solid rgba(0,0,0,.08);border-radius:8px;overflow:hidden;margin-bottom:8px;">
      <div style="font-size:12.5px;font-weight:600;padding:6px 10px;background:rgba(143,216,184,.12);">${zh[k]}</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">${rows || '<tr><td style="padding:6px 10px;" class="fin-note">无数据</td></tr>'}</table>
    </div>`;
  }).join('');
}
function fqExpectResHTML(r) {
  /* L2 中期预期 · 第三层结果渲染：四维卡片（公司事件预期差 / 产业预期修正 / 舆论综合得分 / 舆论分歧度），每维 items 表格 */
  const zh = { event_expectation_gap: '📈 公司事件预期差', industry_expectation_correction: '🏭 产业预期修正', public_opinion_score: '💬 舆论综合得分', opinion_divergence: '⚖️ 舆论分歧度' };
  const order = ['event_expectation_gap', 'industry_expectation_correction', 'public_opinion_score', 'opinion_divergence'];
  return order.map(k => {
    const sec = r[k];
    if (!sec) return '';
    const rows = (sec.items || []).map(it => `<tr>
      <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);width:150px;color:var(--text-dim);vertical-align:top;white-space:nowrap;">${esc(it.item_name || '')}</td>
      <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);">${esc(it.conclusion || '')}</td>
      <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);font-size:11px;color:var(--text-dim);">${esc(it.evidence || '')}</td>
      <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);font-size:11px;color:var(--text-dim);">${esc(it.source || '')}</td>
    </tr>`).join('');
    return `<div style="border:1px solid rgba(0,0,0,.08);border-radius:8px;overflow:hidden;margin-bottom:8px;">
      <div style="font-size:12.5px;font-weight:600;padding:6px 10px;background:rgba(99,102,241,.10);">${zh[k] || sec.dim_name || k}（${(sec.items || []).length}）</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <tr style="background:rgba(0,0,0,.03);font-size:11px;color:var(--text-dim);"><th style="padding:4px 8px;text-align:left;">评估小点</th><th style="padding:4px 8px;text-align:left;">结论</th><th style="padding:4px 8px;text-align:left;">论据</th><th style="padding:4px 8px;text-align:left;">来源</th></tr>
        ${rows || '<tr><td style="padding:6px 10px;" class="fin-note">无数据</td></tr>'}
      </table>
    </div>`;
  }).join('');
}
function fqFinanceMidHTML(r) {
  /* L2 中期预期 · 第四层结果渲染：审查表格（评估小点 / 置信度 / 扣分说明） */
  const rows = r.map((it, i) => `<tr>
    <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);width:220px;vertical-align:top;">${i + 1}. ${esc(it.item_name || '')}</td>
    <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);width:90px;vertical-align:top;"><b style="color:${Number(it.confidence_score) >= 0.6 ? 'var(--accent)' : (Number(it.confidence_score) >= 0.4 ? '#b7791f' : '#d2455a')};">${it.confidence_score}</b></td>
    <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);font-size:11px;color:var(--text-dim);vertical-align:top;">${esc(it.deduction_reason || '')}</td>
  </tr>`).join('');
  return `<div style="border:1px solid rgba(0,0,0,.08);border-radius:8px;overflow:hidden;margin-bottom:8px;">
    <div style="font-size:12.5px;font-weight:600;padding:6px 10px;background:rgba(183,121,31,.10);">🛡 对抗性审查 · 置信度（${r.length} 个小点）</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <tr style="background:rgba(0,0,0,.03);font-size:11px;color:var(--text-dim);"><th style="padding:4px 8px;text-align:left;">评估小点</th><th style="padding:4px 8px;text-align:left;">置信度</th><th style="padding:4px 8px;text-align:left;">扣分说明</th></tr>
      ${rows || '<tr><td style="padding:6px 10px;" class="fin-note">无数据</td></tr>'}
    </table>
  </div>`;
}
function fqRiskMidHTML(r) {
  /* L2 中期预期 · 第五层结果渲染：总分 + 12 小点评分表 + 维度加权汇总 */
  const rows = (r.item_scores || []).map((it, i) => `<tr>
    <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);width:170px;color:var(--text-dim);white-space:nowrap;">${esc(it.dim_name || '')}</td>
    <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);">${i + 1}. ${esc(it.item_name || '')}</td>
    <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);width:80px;text-align:center;">${it.raw_score}</td>
    <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);width:80px;text-align:center;">${typeof it.confidence === 'number' ? it.confidence.toFixed(2) : it.confidence}</td>
    <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);width:80px;text-align:center;"><b>${typeof it.final_score === 'number' ? it.final_score.toFixed(1) : it.final_score}</b></td>
  </tr>`).join('');
  const dimRows = (r.dim_summary || []).map(it => `<tr>
    <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);">${esc(it.dim_name || '')}</td>
    <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);width:90px;text-align:center;">${it.dim_avg_score}</td>
    <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);width:90px;text-align:center;">${it.weight}</td>
    <td style="padding:4px 8px;border-bottom:1px solid rgba(0,0,0,.06);width:90px;text-align:center;"><b>${it.weighted_score}</b></td>
  </tr>`).join('');
  return `<div style="border:1px solid rgba(0,0,0,.08);border-radius:8px;overflow:hidden;margin-bottom:8px;">
    <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:linear-gradient(90deg,rgba(99,102,241,.16),rgba(46,158,107,.10));">
      <div style="font-size:12.5px;font-weight:600;">📊 中期预期综合得分</div>
      <b style="font-size:20px;color:var(--accent);">${typeof r.total_mid_score === 'number' ? r.total_mid_score.toFixed(1) : r.total_mid_score}</b>
      <span style="flex:1;"></span>
      <span style="font-size:11.5px;color:var(--text-dim);">${esc(r.eval_date || '')}</span>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <tr style="background:rgba(0,0,0,.03);font-size:11px;color:var(--text-dim);"><th style="padding:4px 8px;text-align:left;">维度</th><th style="padding:4px 8px;text-align:left;">评估指标</th><th style="padding:4px 8px;text-align:center;">原始分</th><th style="padding:4px 8px;text-align:center;">置信度</th><th style="padding:4px 8px;text-align:center;">最终分</th></tr>
      ${rows || '<tr><td style="padding:6px 10px;" class="fin-note">无数据</td></tr>'}
    </table>
  </div>
  <div style="border:1px solid rgba(0,0,0,.08);border-radius:8px;overflow:hidden;margin-bottom:8px;">
    <div style="font-size:12.5px;font-weight:600;padding:6px 10px;background:rgba(46,158,107,.10);">维度汇总（权重）</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <tr style="background:rgba(0,0,0,.03);font-size:11px;color:var(--text-dim);"><th style="padding:4px 8px;text-align:left;">维度</th><th style="padding:4px 8px;text-align:center;">维度平均分</th><th style="padding:4px 8px;text-align:center;">权重</th><th style="padding:4px 8px;text-align:center;">加权得分</th></tr>
      ${dimRows || '<tr><td style="padding:6px 10px;" class="fin-note">无数据</td></tr>'}
    </table>
  </div>`;
}
function fqLayerResHTML(res, gid) {
  if (!res) return '<div class="empty" style="padding:12px;">该产品暂无运行结果 —— 运行 AI 补全或手动粘贴结果后在此展示</div>';
  const isMidFin = Array.isArray(res.result) && res.result.length >= 1 && res.result.every(x => x && x.item_name != null && typeof x.confidence_score === 'number');
  const isMidRisk = !Array.isArray(res.result) && res.result && typeof res.result === 'object' && res.result.total_mid_score != null && Array.isArray(res.result.item_scores);
  return (res.result
      ? (isMidFin ? fqFinanceMidHTML(res.result)
        : (isMidRisk ? fqRiskMidHTML(res.result)
        : (Array.isArray(res.result) ? fqLayerTableArr(res.result)
        : (typeof res.result === 'object' && Array.isArray(res.result.sources) && res.result.sources.length && res.result.sources[0].category ? fqDsResHTML(res.result, gid)
          : (typeof res.result === 'object' && res.result.event_overview && res.result.industry_news_overview && res.result.opinion_overview ? fqMidResHTML(res.result)
            : (typeof res.result === 'object' && res.result.event_expectation_gap && res.result.industry_expectation_correction && res.result.public_opinion_score && res.result.opinion_divergence ? fqExpectResHTML(res.result)
              : (FQ_CORE_FIELDS.every(f => f in res.result) ? fqLayerTable(res.result) : fqLayerTableObj(res.result))))))))
      : `<pre style="white-space:pre-wrap;word-break:break-word;background:rgba(0,0,0,.04);border-radius:8px;padding:8px 10px;margin:0;font-family:inherit;font-size:12.5px;line-height:1.7;">${esc(res.raw)}</pre>`)
    + `<div style="font-size:11px;color:var(--text-dim);margin-top:6px;">来源：${res.mode === 'manual' ? '📥 手动导入' : res.mode === 'web' ? '🌐 网页版运行' : '🤖 AI 自动补全'} · ${res.ts}</div>`;
}
function fqLayerPrevs(gid, lid, code) {
  /* 某层的全部前置层结果（layer.prev 指定，缺省为上一层）；返回 {prevs, miss, missName} */
  const lidx = FQ_LAYERS.findIndex(x => x.id === lid);
  const layer = FQ_LAYERS[lidx];
  const ids = layer.prev || (lidx > 0 ? [FQ_LAYERS[lidx - 1].id] : []);
  const prevs = ids.map(pid => fqLayerPrev(gid, pid, code));
  const mi = prevs.findIndex(x => !x);
  return { prevs, miss: mi >= 0, missName: mi >= 0 ? (FQ_LAYERS.find(x => x.id === ids[mi]) || {}).name || '' : '', missNo: mi >= 0 ? (FQ_LAYERS.findIndex(x => x.id === ids[mi]) + 1) : 0 };
}
function fqLayerPrevHTML(g, code, lid) {
  /* 指定层全部前置层结果的概览 HTML（每层标题 + 结果/占位） */
  const i = FQ_LAYERS.findIndex(x => x.id === lid);
  const layer = FQ_LAYERS[i];
  const ids = layer.prev || (i > 0 ? [FQ_LAYERS[i - 1].id] : []);
  if (!ids.length) return '';
  return ids.map(pid => {
    const pi = FQ_LAYERS.findIndex(l => l.id === pid);
    const pr = fqLayerPrev(g, pid, code);
    return `<div style="margin-bottom:8px;">
      <div style="font-size:11.5px;color:var(--text-dim);margin-bottom:4px;">来自 第 ${pi + 1} 层 · ${FQ_LAYERS[pi].name}</div>
      ${pr ? fqLayerResHTML(pr, g) : `<div class="fin-note" style="font-size:12px;padding:4px 0;">暂无结果 —— 请先运行「第 ${pi + 1} 层 · ${FQ_LAYERS[pi].name}」（当前产品）</div>`}
    </div>`;
  }).join('');
}
function fqLayerPromptTxt(layer, gid) {
  /* 本层实际使用的提示词模板：L2 中期预期 · 第二层（firm）与第三层（industry）用各自 prompt2（事件细节综合评价 / 中期预期参数评估），其余用 prompt */
  return (gid === 'L2' && layer.prompt2) ? layer.prompt2 : (layer.prompt || '');
}
function fqLayersBody(g) {
  if (!S.fq.lOpen) S.fq.lOpen = new Set(FQ_LAYERS.map(l => l.id));
  const lp = S.fq.lprod || (fnLoad().products[0] || {}).code;
  return fqDsUrlBar() + `<div style="font-size:12px;color:var(--text-dim);margin-bottom:10px;line-height:1.7;">
    五层信息流 · 第 1 层选择产品 → 逐层 AI 补全（结果自动校验，异常自动重跑，连续 3 次异常自动停止）。<br>
    默认通过 <b>AI 工作台 · 🌐 网页会话</b> 自动运行，且分为三个独立对话：第 1~3 层共用会话 A，第 4 层审查、第 5 层评分各自动开启新对话（会话 B / C）；可切换 API Key 直连或手动复制 / 粘贴。
  </div>
  ${fqRunAllView(g, !!FQ_DS_MODE[g.id])}
  ${FQ_LAYERS.map((layer, i) => {
    const open = S.fq.lOpen.has(layer.id);
    const res = fqLayerGet(g.id, layer.id, lp);
    const isBase = i === 0;
    const badgeClr = layer.prompt ? 'color:#2e9e6b;background:rgba(46,158,107,.10);' : 'color:#b7791f;background:rgba(183,121,31,.10);';
    /* 简洁化整改：隐藏数据源链路库（存储上限 100 由 fqDsSave / 一键全流程入口自动治理） */
    const dsLibSec = '';
    return dsLibSec + `<div class="fq-layer" style="border:1px solid rgba(0,0,0,.08);border-radius:10px;margin-bottom:10px;overflow:hidden;background:#fff;">
      <div class="fq-layer-hd" data-fql="${layer.id}" style="display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;background:rgba(143,216,184,.12);">
        <span style="width:16px;text-align:center;font-size:12px;">${open ? '▾' : '▸'}</span>
        <b style="font-size:13px;">第 ${i + 1} 层 · ${layer.name}</b>
        <span style="font-size:10.5px;padding:1px 8px;border-radius:20px;${badgeClr}">${layer.badge}</span>
        <span class="fin-note" id="fq-lhd-${g.id}-${layer.id}" style="margin-left:auto;font-size:11px;">${res ? '✓ ' + esc(res.product || res.code || '') + ' · ' + res.ts : ''}</span>
      </div>
      <div class="fq-layer-bd" style="${open ? '' : 'display:none;'}padding:10px 12px;">
        ${isBase && FQ_DS_MODE[g.id] ? fqDsBodyHTML(g, layer, res) : `
        ${isBase ? `<div style="font-size:12.5px;font-weight:600;margin-bottom:6px;">① 上层信息概览</div>
        <div id="fq-lprev-${g.id}-${layer.id}" style="margin-bottom:10px;">
          ${fqBaseOverview(g, layer)}
        </div>` : ''}
        <div style="font-size:12.5px;font-weight:600;margin-bottom:6px;">${isBase ? '②' : '①'} 提示词概览</div>
        <details style="margin-bottom:10px;font-size:12px;">
          <summary style="cursor:pointer;color:var(--accent);">${fqLayerPromptTxt(layer, g.id) ? '查看提示词（' + fqLayerPromptTxt(layer, g.id).split('\n')[0] + '…）' : '提示词待配置'}</summary>
          ${fqLayerPromptTxt(layer, g.id) ? `<pre style="white-space:pre-wrap;word-break:break-word;background:rgba(0,0,0,.04);border-radius:8px;padding:8px 10px;margin-top:6px;font-family:inherit;font-size:12px;line-height:1.6;">${esc(fqLayerPromptTxt(layer, g.id))}</pre>` : '<div class="fin-note" style="padding:4px 0;">后续在此配置本层提示词，用于将上层信息补全为「' + layer.name + '」数据。</div>'}
        </details>
        <div style="font-size:12.5px;font-weight:600;margin-bottom:6px;">${isBase ? '③' : '②'} 运行</div>
        <div style="margin-bottom:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <button class="btn sm fq-lrun" data-gid="${g.id}" data-lid="${layer.id}" ${layer.prompt ? '' : 'disabled title="提示词待配置"'} style="font-size:12px;padding:3px 14px;">🚀 ${isBase ? '运行（AI 补全）' : '运行（AI 补全）'}</button>
          <span style="font-size:12px;color:var(--text-dim);">运行通道</span>
          <select class="input fq-lmode" style="width:190px;padding:4px 6px;">
            <option value="web" ${(S.fq.lmode || 'web') === 'web' ? 'selected' : ''}>🌐 网页版（主逻辑）</option>
            <option value="api" ${S.fq.lmode === 'api' ? 'selected' : ''}>🪷 API Key 直连</option>
          </select>
          <span class="fin-note fq-lwebnote" id="fq-lwebnote-${g.id}" style="font-size:11px;">${fqWebSessLabel(g, layer)}</span>
          ${layer.prompt ? `<span style="flex:1;min-width:8px;"></span>
            <button class="btn sm soft fq-lcopy" data-gid="${g.id}" data-lid="${layer.id}" style="font-size:11.5px;padding:2px 10px;" title="复制完整提示词（含当前产品），供网页版 AI 手动运行">📋 复制提示词</button>
            <button class="btn sm soft fq-lpaste" data-gid="${g.id}" data-lid="${layer.id}" style="font-size:11.5px;padding:2px 10px;" title="将网页版 AI 返回的 JSON 粘贴回本窗口分析">📥 粘贴结果分析</button>` : ''}
          <span class="fin-note fq-lnote" id="fq-lnote-${g.id}-${layer.id}" style="font-size:11px;">${res ? '已有该产品结果，再次运行将询问是否覆盖' : '该产品首次运行将直接执行'}</span>
        </div>
        <div style="font-size:12.5px;font-weight:600;margin-bottom:6px;">${isBase ? '④' : '③'} 结果展示</div>
        <div id="fq-lres-${g.id}-${layer.id}">${(FQ_DS_MODE[g.id] && i === 1)
          ? `<div style="margin-bottom:10px;">${fqFlowPoolHTML(g.id, lp)}</div>${fqLayerResHTML(res, g.id)}`
          : fqLayerResHTML(res, g.id)}</div>
        `}
      </div>
    </div>`;
  }).join('')}`;
}
function fqBaseOverview(g, layer) {
  const prods = fnLoad().products;
  if (!prods.length) return '<div class="fin-note" style="font-size:12px;padding:4px 0;">自动采集窗口暂无产品 —— 请先到「理财量化 · 自动采集 · 天天基金网数据」添加产品</div>';
  const opts = prods.map(p => `<option value="${esc(p.code)}">${esc(p.name)}（${esc(p.code)}）</option>`).join('');
  return `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12.5px;">
    <span>选择产品</span>
    <select class="input fq-lsel" data-gid="${g.id}" data-lid="${layer.id}" style="width:300px;padding:4px 6px;">${opts}</select>
  </div>
  <div id="fq-lov2-${g.id}-${layer.id}" style="margin-top:8px;"></div>`;
}
function fqMid3TableHTML(res) {
  /* 第三层结果 → 四维表格（dim_name + items: 指标 / 结论 / 论据 / 来源） */
  if (!res || typeof res !== 'object' || Array.isArray(res)) return '<div class="fin-note" style="font-size:12px;padding:4px 0;">尚未运行 —— 一键评分 / 一键全流程会自动生成。</div>';
  const dims = ['event_expectation_gap', 'industry_expectation_correction', 'public_opinion_score', 'opinion_divergence'];
  const zh = { event_expectation_gap: '公司事件预期差', industry_expectation_correction: '产业预期修正', public_opinion_score: '舆论综合得分', opinion_divergence: '舆论分歧度' };
  return dims.map(k => {
    const sec = res[k];
    if (!sec || !Array.isArray(sec.items)) return '';
    return `<div style="margin:4px 0;border:1px solid rgba(0,0,0,.08);border-radius:8px;overflow:hidden;">
      <div style="font-size:12px;font-weight:600;padding:5px 10px;background:rgba(99,102,241,.08);">${zh[k] || k}</div>
      <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
        <tr style="background:rgba(0,0,0,.03);"><td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.06);width:110px;">指标</td><td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.06);">评估结论</td><td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.06);">论据 / 来源</td></tr>
        ${sec.items.map(it => `<tr>
          <td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.04);color:var(--text-dim);">${it && it.item_name ? esc(String(it.item_name)) : '<span class="fin-note">—</span>'}</td>
          <td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.04);">${it && it.conclusion ? esc(String(it.conclusion)) : '<span class="fin-note">null</span>'}</td>
          <td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.04);font-size:11px;color:var(--text-dim);">${(it && (it.evidence || it.source)) ? esc(String((it.evidence || '') + (it.source ? '（' + it.source + '）' : ''))) : '<span class="fin-note">—</span>'}</td>
        </tr>`).join('')}
      </table>
    </div>`;
  }).join('');
}
function fqFinanceTableHTML(res) {
  /* 第四层审查结果 → 指标 / 置信度 / 扣分说明 表格 */
  if (!Array.isArray(res) || !res.length) return '<div class="fin-note" style="font-size:12px;padding:4px 0;">尚未运行 —— 一键评分 / 一键全流程会自动生成。</div>';
  return `<table style="width:100%;border-collapse:collapse;font-size:11.5px;">
    <tr style="background:rgba(0,0,0,.03);"><td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.06);width:140px;">指标</td><td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.06);width:70px;">置信度</td><td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.06);">扣分说明</td></tr>
    ${res.map(it => `<tr>
      <td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.04);">${it && it.item_name != null ? esc(String(it.item_name)) : '<span class="fin-note">—</span>'}</td>
      <td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.04);"><b style="color:${(it && it.confidence_score != null && it.confidence_score < 0.6) ? '#d2455a' : '#2e9e6b'};">${it && typeof it.confidence_score === 'number' ? it.confidence_score.toFixed(2) : (it && it.confidence_score != null ? esc(String(it.confidence_score)) : '<span class="fin-note">—</span>')}</b></td>
      <td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.04);font-size:11px;color:var(--text-dim);">${it && it.deduction_reason ? esc(String(it.deduction_reason)) : '<span class="fin-note">—</span>'}</td>
    </tr>`).join('')}
  </table>`;
}
function fqRiskTableHTML(res) {
  /* 第五层评分结果 → 综合得分 + 维度汇总 + 分项评分 */
  if (!res || typeof res !== 'object' || Array.isArray(res)) return '<div class="fin-note" style="font-size:12px;padding:4px 0;">尚未运行 —— 一键评分 / 一键全流程会自动生成。</div>';
  let html = `<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
    <span style="font-size:12px;color:var(--text-dim);">综合得分</span>
    <b style="font-size:22px;color:#2e9e6b;">${res.total_mid_score != null ? esc(String(res.total_mid_score)) : '<span class="fin-note">—</span>'}</b>
    ${res.eval_date ? `<span class="fin-note" style="font-size:11px;">评分日期 ${esc(String(res.eval_date))}</span>` : ''}
  </div>`;
  if (Array.isArray(res.dim_summary) && res.dim_summary.length) {
    html += `<div style="font-size:12px;font-weight:600;margin:6px 0 3px;">维度汇总</div>
      <table style="width:100%;border-collapse:collapse;font-size:11.5px;margin-bottom:6px;">
        <tr style="background:rgba(0,0,0,.03);"><td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.06);">维度</td><td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.06);width:90px;">维度平均分</td><td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.06);width:70px;">权重</td><td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.06);width:90px;">加权得分</td></tr>
        ${res.dim_summary.map(d => `<tr><td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.04);">${d && d.dim_name ? esc(String(d.dim_name)) : '—'}</td>
          <td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.04);">${d && d.dim_avg_score != null ? esc(String(d.dim_avg_score)) : '—'}</td>
          <td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.04);">${d && d.weight != null ? esc(String(d.weight)) : '—'}</td>
          <td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.04);"><b>${d && d.weighted_score != null ? esc(String(d.weighted_score)) : '—'}</b></td></tr>`).join('')}
      </table>`;
  }
  if (Array.isArray(res.item_scores) && res.item_scores.length) {
    html += `<div style="font-size:12px;font-weight:600;margin:6px 0 3px;">分项评分（原始 × 置信度）</div>
      <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
        <tr style="background:rgba(0,0,0,.03);"><td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.06);">维度</td><td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.06);">指标</td><td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.06);width:64px;">原始</td><td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.06);width:64px;">置信度</td><td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.06);width:64px;">最终</td></tr>
        ${res.item_scores.map(it => `<tr>
          <td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.04);color:var(--text-dim);">${it && it.dim_name ? esc(String(it.dim_name)) : '—'}</td>
          <td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.04);">${it && it.item_name ? esc(String(it.item_name)) : '—'}</td>
          <td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.04);">${it && it.raw_score != null ? esc(String(it.raw_score)) : '—'}</td>
          <td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.04);">${it && typeof it.confidence === 'number' ? it.confidence.toFixed(2) : (it && it.confidence != null ? esc(String(it.confidence)) : '—')}</td>
          <td style="padding:3px 8px;border-bottom:1px solid rgba(0,0,0,.04);"><b style="color:#2e9e6b;">${it && it.final_score != null ? esc(String(it.final_score)) : '—'}</b></td>
        </tr>`).join('')}
      </table>`;
  }
  return html;
}
function fqFlowSummaryHTML(gid, code) {
  /* 一键全流程底部汇总卡片：① 数据库可视化 ② 第三层结果 ③ 第四层结果 ④ 第五层评分 */
  if (!code) return '';
  const card = (title, body, color) => `<div style="flex:1;min-width:300px;border:1px solid rgba(0,0,0,.08);border-radius:10px;padding:10px 12px;background:#fff;max-height:340px;overflow:auto;">
    <div style="font-size:12.5px;font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
      <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;"></span>${title}
    </div>
    ${body}
  </div>`;
  return `<div style="border:1px solid rgba(0,0,0,.08);border-radius:10px;padding:10px 12px;margin-bottom:12px;background:rgba(143,216,184,.06);">
    <div style="font-size:13px;font-weight:600;margin-bottom:8px;">📊 全流程信息汇总 <span class="fin-note" style="font-weight:400;">（一键输出有效信息流 → 一键评分 · 自动更新）</span></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      ${card('① 数据库可视化（已纳取）', fqFlowPoolHTML(gid), '#2e9e6b')}
      ${card('② 第三层 · 核心参数细节评估', fqMid3TableHTML(fqLayerGet(gid, 'industry', code) && fqLayerGet(gid, 'industry', code).result), '#6366f1')}
      ${card('③ 第四层 · 对抗性审查与置信度', fqFinanceTableHTML(fqLayerGet(gid, 'finance', code) && fqLayerGet(gid, 'finance', code).result), '#f59e0b')}
      ${card('④ 第五层 · 标准化评分输出', fqRiskTableHTML(fqLayerGet(gid, 'risk', code) && fqLayerGet(gid, 'risk', code).result), '#d2455a')}
    </div>
  </div>`;
}
function fqFlowSummaryRefresh(gid, code) {
  const el = document.getElementById('fq-flow-summary-' + gid);
  if (el) el.innerHTML = fqFlowSummaryHTML(gid, code || (S.fq.lprod || ''));
}
function fqRunAllView(g, midOnly) {
  /* 一键分析区块：L1 五层全跑。L2 / L3（中期 / 短期预期类）不在此渲染 ——
     一键全流程按钮已移入第一层（base）「开始一键全流程」区块（基础信息引用下方），
     一键评分并入全流程（页面简洁化：仅保留一键全流程单一入口） */
  if (midOnly) return '';
  return `<div style="border:1px solid rgba(0,0,0,.08);border-radius:10px;padding:10px 12px;margin-bottom:12px;background:#fff;">
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <button class="btn sm fq-lall" data-gid="${g.id}" style="font-size:12.5px;padding:4px 18px;">⚡ 一键五层信息分析</button>
      <span class="fin-note" style="font-size:11px;line-height:1.6;">自动串行运行第 1→5 层：上一层就绪后自动进入下一层，直至输出综合基本面价值分。<br>每层结果自动校验、异常自动重跑（连续 3 次异常即停止）；运行前将询问是否覆盖已有结果。</span>
    </div>
    <div id="fq-lall-prog-${g.id}" style="margin-top:8px;"></div>
  </div>`;
}
function fqRenderProgress(gid, states) {
  /* 一键分析进度可视化：进度条 + 分层状态 chip + 实时消息 */
  const el = document.getElementById('fq-lall-prog-' + gid);
  if (!el) return;
  const steps = states.steps || [];
  const n = steps.length, doneN = steps.filter(s => s.st === 'ok' || s.st === 'fail' || s.st === 'skip').length;
  const pct = n ? Math.round(doneN / n * 100) : 0;
  const bar = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
    <div style="flex:1;height:10px;border-radius:6px;background:rgba(0,0,0,.06);overflow:hidden;">
      <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#34c98a,#2e9e6b);transition:width .4s;"></div>
    </div>
    <b style="font-size:12px;">${doneN}/${n}（${pct}%）</b>
  </div>`;
  const chips = steps.map(s => {
    const icon = s.st === 'ok' ? '✅' : s.st === 'fail' ? '❌' : s.st === 'run' ? '⏳' : '○';
    const clr = s.st === 'ok' ? 'color:#2e9e6b;background:rgba(46,158,107,.10);'
      : s.st === 'fail' ? 'color:#d33;background:rgba(221,51,51,.08);'
      : s.st === 'run' ? 'color:#b7791f;background:rgba(183,121,31,.12);'
      : 'color:#888;background:rgba(0,0,0,.05);';
    return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11.5px;padding:2px 10px;border-radius:20px;${clr}">${icon} 第${s.idx}层 ${s.name}</span>`;
  }).join(' ');
  el.innerHTML = (states.phase === 'idle' ? '' : bar)
    + `<div style="display:flex;gap:6px;flex-wrap:wrap;">${chips}</div>`
    + (states.msg ? `<div class="fin-note" style="margin-top:6px;font-size:11.5px;">${states.msg}</div>` : '')
    + (S.fq && S.fq.curSess && S.fq.curSess.url ? `<div style="margin-top:4px;font-size:11px;color:#6366f1;font-weight:600;">🌐 当前会话：网页版 deepseek · ${fqDsSessName(S.fq.curSess)}（…${esc(String(S.fq.curSess.url).slice(-4))}）</div>` : '')
    + (states.phase === 'running' ? '<div style="margin-top:6px;text-align:right;"><button class="btn sm fq-abort" style="font-size:12px;padding:2px 14px;background:#d2455a;color:#fff;border:none;border-radius:8px;cursor:pointer;">⛔ 中断 AI 任务</button></div>' : '');
  const ab = el.querySelector('.fq-abort');
  if (ab) ab.onclick = () => fqAbortNow('一键分析 / 全流程');
}
function fqRunAuditCore(gid, lid, ctx, ui) {
  /* 网页 / API AI 调取公共审查执行器 —— L1 长期价值类 与 L2 中期预期类全程同路径（复用）：
     发送 → JSON 解析 → 结构校验（expect 门控）→ 异常自动重跑（≤3 次，间隔可配）→ 连续 3 次异常停止；
     支持手动中断（FQ_ABORT）、登录失效自动开登录窗、fresh:// 新会话回传缓存；
     成功自动入库 fqLayerSet 并刷新界面。
     ctx: { send(), prompt, url, code, product, mode }
     ui:  { note, progress(msg), done(msg), busy(on), retryDelay, onSuccess(attempts) }
     返回 Promise<{ok, attempts, aborted, lastErr}> */
  const layerNo = FQ_LAYERS.findIndex(x => x.id === lid) + 1;
  fqAbortReset();
  let attempts = 0, lastErr = '';
  const settle = (ok, aborted, err) => { if (ui.busy) ui.busy(false); return { ok, attempts, aborted: !!aborted, lastErr: err || '' }; };
  const tryRun = () => {
    attempts++;
    const msg = ctx.mode === 'web'
      ? '⏳ 第 ' + attempts + ' 次尝试 · 网页会话 …' + String(ctx.url || '').slice(-10)
      : '⏳ 第 ' + attempts + ' 次尝试 · API 直连';
    if (ui.progress) ui.progress(msg);
    if (ui.busy) ui.busy(true);
    if (ui.note) fqAbortMount(ui.note, '第 ' + layerNo + ' 层');
    return Promise.resolve().then(ctx.send).then(r => {
      if (!r || !r.ok) {
        lastErr = (r && r.error) || '未知错误';
        if (r && r.aborted) { if (ui.done) ui.done('⛔ 已手动中断（未保存任何结果）'); return settle(false, true); }
        if (r && r.code === 'need_login') {
          lastErr = '网页登录已失效（已打开登录窗口，请重新登录后重试）';
          if (ui.progress) ui.progress('网页登录已失效，正在打开登录窗口…');
          webLogin();
          if (ui.done) ui.done('⚠ ' + lastErr);
          return settle(false, false, lastErr);
        }
        return retry('请求失败：' + lastErr);
      }
      const obj = fqParseJSON(r.text);
      const bad = fqValidateResult(gid, lid, obj);
      if (bad) {
        lastErr = bad;
        const preview = String(r.text || '').replace(/\s+/g, ' ').slice(0, 60);
        return retry('结果异常：' + bad + (preview ? '｜原文前60字符：' + preview : ''));
      }
      /* fresh:// 新会话完成后，回传真实会话 URL 并缓存，供同组后续复用（保留上下文） */
      if (r.url && r.url !== ctx.url) {
        if (!S.fq.webSess) S.fq.webSess = {};
        S.fq.webSess[FQ_WEB_GROUP[lid] || 'A'] = r.url;
        ctx.url = r.url;
        const note2 = document.getElementById('fq-lwebnote-' + gid);
        if (note2) note2.textContent = fqWebSessLabel(gid, FQ_LAYERS.find(x => x.id === lid));
      }
      fqLayerSet(gid, lid, { code: ctx.code, product: ctx.product, result: obj, raw: obj ? '' : String(r.text), ts: fmtDate(new Date()) + ' ' + new Date().toTimeString().slice(0, 5), mode: ctx.mode });
      fqBaseShow(gid, lid, ctx.code);
      const resBox = document.getElementById('fq-lres-' + gid + '-' + lid);
      if (resBox) resBox.scrollIntoView({ block: 'nearest' });
      const okMsg = attempts > 1 ? '第 ' + attempts + ' 次尝试成功（前 ' + (attempts - 1) + ' 次异常）' : '✅ 结果已获取';
      if (ui.progress) ui.progress(okMsg);
      if (ui.done) ui.done(attempts > 1 ? okMsg : '');
      if (ui.onSuccess) ui.onSuccess(attempts);
      return settle(true);
    }).catch(e => {
      if (FQ_ABORT) { if (ui.done) ui.done('⛔ 已手动中断（未保存任何结果）'); return settle(false, true); }
      lastErr = e.message;
      return retry('请求失败：' + e.message);
    });
  };
  const retry = (why) => {
    if (FQ_ABORT) { if (ui.done) ui.done('⛔ 已手动中断（未保存任何结果）'); return settle(false, true); }
    if (attempts < 3) {
      const delay = ui.retryDelay != null ? ui.retryDelay : 600;
      if (ui.progress) ui.progress(why + '，自动重跑第 ' + (attempts + 1) + ' 次…（间隔 ' + Math.round(delay / 1000) + ' 秒，避免打断 DS 生成）');
      return fqSleep(delay).then(tryRun);
    }
    if (ui.done) ui.done('⚠ 连续 3 次结果异常，已停止（末次：' + lastErr + '）');
    return settle(false, false, lastErr);
  };
  return tryRun();
}
function fqExecOnceWeb(gid, lid, p, prompt, states) {
  /* 一键分析单层执行（与单层运行共用公共审查执行器 fqRunAuditCore，路径完全一致）：
     获取组会话 → 审查式发送 / 解析 / 判定（≤3 次重试）→ 成功入库 */
  const layerNo = FQ_LAYERS.findIndex(x => x.id === lid) + 1;
  return fqLayerWebSess(lid).then(url => {
    if (!url) throw new Error('网页会话不可用（请先在 AI 工作台添加会话链接或完成登录）');
    const rp = (msg) => { if (states) fqRenderProgress(gid, { phase: 'running', steps: states.steps, msg: '⏳ 第 ' + layerNo + ' 层 · ' + msg }); };
    return fqRunAuditCore(gid, lid, {
      send: () => apiPost('/api/plugin/webchat/chat', { url, message: prompt, expect: fqExpectOf(gid, lid) }),
      prompt: prompt, url: url, code: p.code, product: p.name, mode: 'web',
    }, {
      note: null,
      progress: rp,
      done: rp,
      busy: () => {},
      retryDelay: 12000, /* 冷却重试：避免打断 DS 正在生成的上一条回复（频繁发送报错） */
    });
  });
}
const FQ_MID3_DIMS = [
  { key: 'event_expectation_gap', dim: '公司事件预期差', group: 'company', zh: '公司事件数据源',
    items: ['事件类型与强度', '预期差幅度', '影响半衰期'] },
  { key: 'industry_expectation_correction', dim: '产业预期修正', group: 'industry', zh: '产业新闻数据源',
    items: ['产业新闻情绪边际', '景气数据变化', '产业链传导影响'] },
  { key: 'public_opinion_score', dim: '舆论综合得分', group: 'discussion', zh: '舆情讨论数据源',
    items: ['讨论量增速', '加权情绪倾向', '权威权重系数'] },
  { key: 'opinion_divergence', dim: '舆论分歧度', group: 'discussion', zh: '舆情讨论数据源',
    items: ['跨平台分歧度', '群体层级分歧', '分歧变化趋势'] },
];
function fqMid3Batches(gid, code, p, tw) {
  /* L2 中期预期 · 第三层分批计划：按数据组聚合为三批 ——
     批1 公司事件预期差（company 组）、批2 产业预期修正（industry 组）、
     批3 舆论综合 + 舆论分歧（discussion 组，两个 dim 一并评估） */
  const clean = fqCrawlCleanGet(gid, code);
  const b = fqLayerGet(gid, 'base', code);
  const br = b && b.result;
  const groups = {
    company: '公司事件数据源',
    industry: '产业新闻数据源',
    discussion: '舆情讨论数据源',
  };
  const batchKeys = [['event_expectation_gap'], ['industry_expectation_correction'], ['public_opinion_score', 'opinion_divergence']];
  return batchKeys.map(keys => {
    const dims = keys.map(k => FQ_MID3_DIMS.find(d => d.key === k));
    const group = dims[0].group;
    const items = (clean && clean[group]) || [];
    const dataTxt = items.length
      ? '【' + (groups[group]) + ' · AI 清洗正文】\n' + fqCleanGroupTxt(clean, group)
      : '【' + (groups[group]) + '】（无已爬取条目）';
    return { keys, dims, group, zh: groups[group], dataTxt, chars: dataTxt.length };
  });
}
function fqMidSplitItems(items, limit, per) {
  /* 类内数据拆分：按「每子批 ≤per 条 且 ≤limit 字符」累积切分（单条超限则独立成批并压缩提示要求） */
  const out = [];
  let cur = [], curChars = 0;
  const push = () => { if (cur.length) { out.push({ items: cur, chars: curChars }); cur = []; curChars = 0; } };
  (items || []).forEach(it => {
    const c = (it && (it.content || it.title || '').length) || 0;
    const cFull = c + (it.url ? it.url.length : 0) + 60;
    if (cur.length >= per || (curChars + cFull > limit && cur.length)) push();
    cur.push(it); curChars += cFull;
  });
  push();
  return out.length ? out : [{ items: [], chars: 0 }];
}
function fqMid3OverviewTxt(gid, code) {
  /* {{mid_overview}}：第二层（总览型基础信息生成层）最终结果 → 三总览文本 */
  const ov = fqLayerGet(gid, 'firm', code);
  const o = ov && ov.result;
  if (!o || typeof o !== 'object' || Array.isArray(o)) return 'null';
  const secs = [['event_overview', '事件总览'], ['industry_news_overview', '产业新闻总览'], ['opinion_overview', '舆情总览']];
  return secs.map(([k, zh]) => '【' + zh + '】\n' + (o[k] != null ? JSON.stringify(o[k], null, 1) : 'null')).join('\n\n');
}
function fqMid3PromptFor(batch, p, tw, dataTxt, overviewTxt, prevItemsTxt, isChain) {
  /* L2 第三层单批提示词：仅评估本批 dims；isChain 时附「前批结论」要求在其基础上进一步分析 */
  const l1 = fqLayerGet('L1', 'base', p.code);
  const b1 = (l1 && l1.result) || {};
  const ind2 = b1.industry_level2 || 'null';
  const dimTxt = batch.dims.map(d => d.dim + '：' + d.items.join('、')).join('；');
  const keysJson = batch.keys.map(k => {
    const d = batch.dims.find(x => x.key === k);
    const items = d.items.map(n => JSON.stringify({ item_name: n, conclusion: '', evidence: '', source: '' })).join(',\n');
    return '  "' + k + '": {\n    "dim_name": "' + d.dim + '",\n    "items": [\n      ' + items + '\n    ]\n  }';
  }).join(',\n');
  let t = '【角色】你是中期预期量化分析师，严格输出纯JSON，禁止任何额外文本。\n'
    + '【任务】针对<b>' + batch.dims.map(d => d.dim).join('、') + '</b>进行细节评估，每个评估小点必须给出明确结论，同时附带论据摘要和数据来源，确保可溯源。\n'
    + '【输入变量】\n标的名称：' + (p.name || 'null') + '\n所属行业：' + ind2 + '\n统计时间窗口：' + (tw || '一个月') + '\n总览信息：\n' + overviewTxt + '\n\n本维度数据集：\n' + dataTxt + '\n'
    + '【评估维度与固定条目】\n严格按照以下维度与固定小点展开，不得新增、删减、修改条目：\n' + dimTxt + '\n'
    + '【输出要求】\n仅输出合法JSON对象，禁止输出任何额外内容。JSON结构严格如下，不得修改键名：\n{\n' + keysJson + '\n}\n'
    + '【强制约束】\n1. 论据必须包含具体数值、时间周期、对比基准\n2. 数据来源必须明确到数据库/接口+时间节点\n3. 仅输出JSON，无任何其他字符';
  if (isChain && prevItemsTxt) {
    t = t.replace('【评估维度与固定条目】', '【此前已得出的评估结论（基于前一批数据，务必保留其合理部分）】\n' + prevItemsTxt + '\n要求：请在其基础上，结合下列「本维度数据集」中的新增数据<b>进一步分析</b>——修正或细化各小点结论、补充更新论据与来源；最终输出仍为固定小点的完整评估。\n\n【评估维度与固定条目】');
  }
  return t;
}
async function fqMid3Exec(gid, code, p, tw, batch, states, st, msgPrefix) {
  /* 执行一批：数据 ≤ 阈值 → 单次；超阈值 → 类内拆子批链式（前批结论并入下批提示词） */
  const LIMIT = 10000, PER = 5;
  let url = await fqLayerWebSess('industry');
  if (!url) throw new Error('网页会话不可用（请先在 AI 工作台添加会话链接或完成登录）');
  const overviewTxt = fqMid3OverviewTxt(gid, code);
  const baseChars = 800; /* 模板 + 总览的估算开销（阈值按数据文本计） */
  const sendOne = async (prompt, label) => {
    let attempts = 0, lastErr = '', restarted = false;
    while (true) {
      fqAbortCheck();
      attempts++;
      if (states) { states.msg = label + ' · 尝试 ' + attempts + '/3（会话 …' + url.slice(-10) + '）' + (restarted ? ' · 浏览器已重启' : ''); fqRenderProgress(gid, states); }
      const r = await fqChatPost(url, prompt, 195000, 'mid3');
      if (r && r.ok) {
        const obj = fqParseJSON(r.text);
        const bad = batch.keys.every(k => obj && obj[k] && typeof obj[k] === 'object' && obj[k].dim_name && Array.isArray(obj[k].items) && obj[k].items.length >= 1)
          ? null : '批次输出缺少本批维度（' + batch.keys.join(' / ') + '）或结构不完整';
        if (!bad) return { ok: true, obj };
        lastErr = bad;
        if (states) { states.msg = label + ' 第 ' + attempts + ' 次失败（' + bad + '）—— 冷却 12 秒后重试'; fqRenderProgress(gid, states); }
      } else {
        if (r && r.aborted) return { ok: false, aborted: true, lastErr: '⛔ 已手动中断' };
        lastErr = (r && r.error) || '未知错误';
        if (r && (r.timeout || r.code === 'need_login' || (r.error && r.error.indexOf('未等到新回复') >= 0))) {
          if (!restarted) {
            restarted = true;
            if (states) { states.msg = '⚠ ' + label + ' ' + attempts + ' 次' + (r.timeout ? '超时' : (r.code === 'need_login' ? '登录失效' : '无新回复')) + ' —— 正在重启浏览器…'; fqRenderProgress(gid, states); }
            await fqChatRestart();
            try { const u2 = await fqLayerWebSess('industry'); if (u2) url = u2; } catch (e) { lastErr = e.message || lastErr; }
          }
        }
      }
      if (attempts >= 3) return { ok: false, lastErr };
      await fqSleep(12000);
    }
  };
  const mergeDim = (acc, obj, keys) => {
    /* 子批结果合并：后批同名 item 覆盖前批（链式累积）；不同 dim 键并入 */
    keys.forEach(k => {
      const sec = obj && obj[k];
      if (sec && Array.isArray(sec.items)) {
        const itemsMap = {};
        (acc[k] && acc[k].items || []).forEach(it => { if (it && it.item_name) itemsMap[it.item_name] = it; });
        sec.items.forEach(it => { if (it && it.item_name) itemsMap[it.item_name] = it; });
        acc[k] = { dim_name: sec.dim_name || k, items: batch.dims.find(d => d.key === k).items.map(n => itemsMap[n] || { item_name: n, conclusion: '', evidence: '', source: '' }) };
      }
    });
    return acc;
  };
  const acc = {};
  batch.keys.forEach(k => { acc[k] = { dim_name: '', items: [] }; });
  if (batch.chars + baseChars <= LIMIT) {
    /* 单次发送 */
    const prompt = fqMid3PromptFor(batch, p, tw, batch.dataTxt, overviewTxt, '', false);
    const res = await sendOne(prompt, msgPrefix + '· 单批（' + batch.chars + ' 字符）');
    if (!res.ok) return res;
    mergeDim(acc, res.obj, batch.keys);
  } else {
    /* 类内拆子批，链式：前批结论并入下批提示词 */
    const items = (fqCrawlCleanGet(gid, code) || {})[batch.group] || [];
    const parts = fqMidSplitItems(items, LIMIT, PER);
    let prevTxt = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const dataTxt = part.items.length
        ? '【' + batch.zh + ' · AI 清洗正文 · 第 ' + (i + 1) + '/' + parts.length + ' 批】\n' + part.items.map((it, j) => (j + 1) + '. ' + (it.title || it.url || '') + '（网址：' + (it.url || '') + '）\n正文：' + (it.content || '')).join('\n')
        : '（无数据）';
      const prompt = fqMid3PromptFor(batch, p, tw, dataTxt, overviewTxt, prevTxt, i > 0);
      const res = await sendOne(prompt, msgPrefix + '· 子批 ' + (i + 1) + '/' + parts.length + '（' + part.chars + ' 字符' + (i > 0 ? ' · 链式带前批结论' : '') + '）');
      if (!res.ok) {
        if (res.aborted) return res;
        /* 子批失败：保留已合并结论继续（容错），3 次全败仍返回失败但带 partial */
        if (i === parts.length - 1 && !Object.keys(acc).some(k => (acc[k].items || []).length)) return res;
        continue;
      }
      mergeDim(acc, res.obj, batch.keys);
      /* 前批结论文本：本批 dims 的 items */
      prevTxt = batch.dims.map(d => '【' + d.dim + '】' + (acc[d.key].items || []).map(it => '- ' + it.item_name + '：' + (it.conclusion || 'null') + '（论据：' + (it.evidence || 'null') + '；来源：' + (it.source || 'null') + '）').join('\n')).join('\n\n');
    }
  }
  return { ok: true, obj: acc };
}
async function fqMidLayer3Run(gid, code, p, tw, states, st) {
  /* L2 中期预期 · 第三层（核心参数细节评估层）分批链式执行：
     按 公司事件 / 产业预期 / 舆论两组 三批评估；批内数据超阈值 → 类内拆子批，
     子批结论并入下一子批提示词「在其基础上进一步分析」；最终合并四键结果入库 */
  if (states) { states.msg = '⏳ 第 3 层 · 核心参数细节评估 · 分批链式执行（公司事件 / 产业预期 / 舆论两组）…'; fqRenderProgress(gid, states); }
  const batches = fqMid3Batches(gid, code, p, tw);
  const merged = {};
  let attempts = 0, lastErr = '', aborted = false;
  for (let bi = 0; bi < batches.length; bi++) {
    fqAbortCheck();
    const batch = batches[bi];
    const res = await fqMid3Exec(gid, code, p, tw, batch, states, st,
      '⏳ 第 3 层 · 批 ' + (bi + 1) + '/' + batches.length + '（' + batch.dims.map(d => d.dim).join(' / ') + ' · ' + batch.chars + ' 字符）');
    if (!res.ok) {
      if (res.aborted) { aborted = true; break; }
      lastErr = res.lastErr;
      break;
    }
    attempts++;
    Object.keys(res.obj).forEach(k => { merged[k] = res.obj[k]; });
    if (states) { states.msg = '✅ 第 3 层 · 批 ' + (bi + 1) + '/' + batches.length + ' 完成（' + batch.dims.map(d => d.dim).join(' / ') + '）——进入下一批…'; fqRenderProgress(gid, states); }
  }
  if (aborted) return { ok: false, aborted: true, partial: merged };
  if (!lastErr && Object.keys(merged).length) {
    fqLayerSet(gid, 'industry', { code: p.code, product: p.name, result: merged, raw: '', ts: fmtDate(new Date()) + ' ' + new Date().toTimeString().slice(0, 5), mode: 'web' });
    fqBaseShow(gid, 'industry', p.code);
    return { ok: true, attempts, batches: batches.length };
  }
  return { ok: false, lastErr: lastErr || '三批均无有效输出', partial: merged };
}
function fqRunAll(gid, btn) {
  /* 一键分析入口：L1 五层全跑；L2 / L3（中期 / 短期预期类）仅第 3→5 层（第 1-2 层由信息流完成） */
  const layers = FQ_DS_MODE[gid] ? FQ_LAYERS.slice(2) : FQ_LAYERS;
  const sel = ROOT.querySelector('.fq-lsel[data-gid="' + gid + '"]');
  const code = sel && sel.value;
  const p = code && fnLoad().products.find(x => x.code === code);
  if (!p) { toast('请先选择产品', 'warn'); return; }
  if ((S.fq.lmode || 'web') !== 'web') { toast('一键分析目前仅支持 🌐 网页版通道（请将运行通道切换为网页版）', 'warn'); return; }
  fqRunAllCore(gid, code, p, btn, layers);
}
async function fqRunAllCore(gid, code, p, btn, layers, skipConfirm) {
  /* 一键分析核心串行：覆盖确认（skipConfirm=true 时跳过，用于一键全流程串联）→ 逐层运行 → 完成提示；返回 {ok} */
  const existing = layers.filter(l => fqLayerGet(gid, l.id, code));
  let all = true;
  if (existing.length && !skipConfirm) {
    const missing = layers.filter(l => !fqLayerGet(gid, l.id, code)).map(l => '第' + (FQ_LAYERS.indexOf(l) + 1) + '层').join('、');
    all = confirm('该产品已有 ' + existing.length + ' 层结果，一键分析将重新运行全部' + layers.length + '层并覆盖。\n\n点「确定」= 全部覆盖重跑\n点「取消」= 仅运行缺失的层' + (missing ? '（' + missing + '）' : ''));
  }
  const targets = all ? layers.map(l => l.id) : layers.filter(l => !fqLayerGet(gid, l.id, code)).map(l => l.id);
  if (!targets.length) { toast('无需运行：全部' + layers.length + '层均已就绪', 'warn'); return { ok: false, reason: 'noop' }; }
  fqAbortReset(); /* 新一次运行：清除上次中断标志 */
  btn.disabled = true;
  const states = { phase: 'running', msg: '', steps: FQ_LAYERS.map((l, i) => {
    /* L2 / L3：第 1-2 层标记为「跳过」（由信息流完成），仅第 3-5 层参与运行 */
    const skip = FQ_DS_MODE[gid] && i < 2;
    return { id: l.id, idx: i + 1, name: l.name, st: skip ? 'skip' : (targets.includes(l.id) ? 'todo' : 'ok') };
  }) };
  fqRenderProgress(gid, states);
  let stopped = false;
  for (const l of layers) {
      fqAbortCheck();
      const st = states.steps.find(s => s.id === l.id);
      if (st.st !== 'todo') continue;
      st.st = 'run';
      fqRenderProgress(gid, states);
      const pv = fqLayerPrevs(gid, l.id, code);
      if (FQ_DS_MODE[gid] && l.id === 'base') {
        /* 中期 / 短期预期类第一层：数据源推荐（引用 L1 基础信息 + AI 指定网站/软件） */
        if (!fqLayerGet('L1', 'base', code) || !fqLayerGet('L1', 'base', code).result) {
          st.st = 'fail';
          states.phase = 'stopped';
          states.msg = '⚠ 缺少 长期价值类 · 第 1 层 基础信息（数据源推荐依赖其产业 / 公司信息），自动流程终止';
          fqRenderProgress(gid, states);
          toast('一键分析终止：请先运行 长期价值类 · 第 1 层 获取基础信息', 'error');
          stopped = true; break;
        }
        try {
          const res = await fqDsExecOnceWeb(gid, p, (S.fq.tw && S.fq.tw[gid]) || '一个月', states);
          if (!res.ok) {
            if (res.aborted) {
              st.st = 'fail';
              states.phase = 'stopped';
              states.msg = '⛔ 已手动中断 · 第 1 层（数据源推荐）—— 已完成层结果已保留';
              fqRenderProgress(gid, states);
              toast('⛔ 一键分析已中断', 'warn');
              stopped = true; break;
            }
            st.st = 'fail';
            states.phase = 'stopped';
            states.msg = '❌ 第 1 层（数据源推荐）连续 3 次结果异常（' + esc(res.lastErr) + '），自动流程已停止';
            fqRenderProgress(gid, states);
            toast('一键分析已停止：第 1 层连续 3 次异常', 'error');
            stopped = true; break;
          }
          st.st = 'ok';
          states.msg = '✅ 第 1 层完成（数据源推荐 · 尝试 ' + res.attempts + ' 次）——自动进入下一层…';
          fqRenderProgress(gid, states);
          fqBaseShow(gid, 'base', code);
          const libEl = document.getElementById('fq-dslib-' + gid);
          if (libEl) libEl.innerHTML = fqDsLibHTML(gid);
        } catch (e) {
          st.st = 'fail';
          states.phase = 'stopped';
          states.msg = '❌ 第 1 层失败：' + esc(e.message);
          fqRenderProgress(gid, states);
          toast('一键分析失败：' + e.message, 'error');
          stopped = true; break;
        }
        continue;
      }
      if (pv.miss) {
        st.st = 'fail';
        states.phase = 'stopped';
        /* 报错分析：L2/L3 缺第 2 层时给出信息流链路诊断（第 2 层由「一键输出有效信息流」收尾自动生成） */
        let diag = '';
        if (FQ_DS_MODE[gid] && pv.missNo === 2) {
          diag = ' —— 链路诊断：' + fqFlowDiag(gid, code)
            + '。第 2 层（总览型基础信息生成层）由「一键输出有效信息流」收尾自动生成，请先运行 信息流 / ⚡ 一键全流程；'
            + '若信息流完成消息提示「第 2 层生成失败」，可单独点击「第 2 层 · 运行」重试后再点「一键评分」。';
        }
        states.msg = '⚠ 缺少第 ' + pv.missNo + ' 层（' + pv.missName + '）结果，自动流程终止' + diag;
        fqRenderProgress(gid, states);
        toast('一键分析终止：缺少第 ' + pv.missNo + ' 层结果' + diag, 'error');
        stopped = true; break;
      }
      if (FQ_DS_MODE[gid] && l.id === 'industry') {
        /* L2 中期预期 · 第三层：分批链式评估（按 公司事件 / 产业预期 / 舆论两组 三批；
           批内数据超阈值 → 类内拆子批，前批结论并入下批「在其基础上进一步分析」） */
        try {
          const res = await fqMidLayer3Run(gid, code, p, (S.fq.tw && S.fq.tw[gid]) || '一个月', states, st);
          if (!res.ok) {
            if (res.aborted) {
              st.st = 'fail';
              states.phase = 'stopped';
              states.msg = '⛔ 已手动中断 · 第 3 层（核心参数细节评估）—— 已合并批次结果已保留';
              fqRenderProgress(gid, states);
              toast('⛔ 一键分析已中断', 'warn');
              stopped = true; break;
            }
            st.st = 'fail';
            states.phase = 'stopped';
            states.msg = '❌ 第 3 层（核心参数细节评估）执行失败：' + esc(res.lastErr || '未知错误');
            fqRenderProgress(gid, states);
            toast('一键分析已停止：第 3 层执行失败', 'error');
            stopped = true; break;
          }
          st.st = 'ok';
          states.msg = '✅ 第 3 层完成（分批链式 · ' + res.batches + ' 批）——自动进入下一层…';
          fqRenderProgress(gid, states);
        } catch (e) {
          st.st = 'fail';
          states.phase = 'stopped';
          states.msg = '❌ 第 3 层失败：' + esc(e.message);
          fqRenderProgress(gid, states);
          toast('一键分析失败：' + e.message, 'error');
          stopped = true; break;
        }
        continue;
      }
      const prompt = fqFillPrompt(l, p, pv.prevs[0] || null, pv.prevs[1] || null, gid);
      try {
        const res = await fqExecOnceWeb(gid, l.id, p, prompt, states);
        if (!res.ok) {
          if (res.aborted) {
            st.st = 'fail';
            states.phase = 'stopped';
            states.msg = '⛔ 已手动中断 · 第 ' + st.idx + ' 层 —— 已完成层结果已保留';
            fqRenderProgress(gid, states);
            toast('⛔ 一键分析已中断', 'warn');
            stopped = true; break;
          }
          st.st = 'fail';
          states.phase = 'stopped';
          states.msg = '❌ 第 ' + st.idx + ' 层连续 3 次结果异常（' + esc(res.lastErr) + '），自动流程已停止';
          fqRenderProgress(gid, states);
          toast('一键分析已停止：第 ' + st.idx + ' 层连续 3 次异常', 'error');
          stopped = true; break;
        }
        st.st = 'ok';
        states.msg = '✅ 第 ' + st.idx + ' 层完成（尝试 ' + res.attempts + ' 次）——自动进入下一层…';
        fqRenderProgress(gid, states);
      } catch (e) {
        st.st = 'fail';
        states.phase = 'stopped';
        states.msg = '❌ 第 ' + st.idx + ' 层失败：' + esc(e.message);
        fqRenderProgress(gid, states);
        toast('一键分析失败：' + e.message, 'error');
        stopped = true; break;
      }
    }
    if (!stopped) {
      const risk = fqLayerGet(gid, 'risk', code);
      const total = risk && risk.result ? (FQ_DS_MODE[gid] ? risk.result.total_mid_score : risk.result.total_score) : null;
      fqFactorLibSave(gid, code, p);   /* 影响因子库：全流程完成 → 本组别（长/中/短）独立覆盖归档 */
      states.phase = 'done';
      states.msg = '🎉 ' + (FQ_DS_MODE[gid] ? '中期预期评分' : '五层分析') + '全部完成' + (total != null ? '，综合得分：<b>' + esc(String(total)) + '</b>' : '');
      fqRenderProgress(gid, states);
      toast('一键' + (FQ_DS_MODE[gid] ? '评分' : '五层分析') + '完成' + (total != null ? '，综合得分 ' + total : ''), 'success');
    }
    btn.disabled = false;
    if (!stopped) fqFlowSummaryRefresh(gid, code);
    return { ok: !stopped };
}
function fqLayersBind(g) {
  const dsUrlIn = document.getElementById('fq-dsurl');
  const dsUrlAdd = document.getElementById('fq-dsurl-add');
  const dsUrlClear = document.getElementById('fq-dsurl-clear');
  const dsUrlNote = document.getElementById('fq-dsurl-note');
  const refreshDsUrlUI = () => {
    if (dsUrlIn) dsUrlIn.value = '';
    if (dsUrlNote) dsUrlNote.textContent = fqDsUrlLabel();
    /* 重建会话池 chips（固定 id 容器，避免父级结构变化导致找不到） */
    const wrap = document.getElementById('fq-dsurl-chips');
    if (wrap) {
      const pool = fqDsUrlsGet();
      wrap.innerHTML = pool.map((x, i) => `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11.5px;padding:2px 8px;border-radius:12px;border:1px solid rgba(0,0,0,.1);background:rgba(99,102,241,.06);"><b>${i + 1}</b> <span title="${esc(x.url)}">${x.name ? esc(x.name) : '…' + esc(String(x.url).slice(-4))}</span><a href="javascript:;" data-idx="${i}" data-act="rename" style="color:#6366f1;text-decoration:none;font-weight:700;" title="重命名会话">✎</a><a href="javascript:;" data-idx="${i}" data-act="del" style="color:#d2455a;text-decoration:none;font-weight:700;" title="移除该会话">×</a></span>`).join(' ') || '<span class="fin-note" style="font-size:11px;">尚未添加会话网址</span>';
      wrap.querySelectorAll('a[data-idx]').forEach(a => {
        a.onclick = () => {
          const idx = parseInt(a.getAttribute('data-idx'), 10);
          const act = a.getAttribute('data-act');
          const pool2 = fqDsUrlsGet();
          const item = pool2[idx];
          if (!item) return;
          if (act === 'rename') {
            const nm = prompt('为该会话重命名（仅内部可视化，网址不变）：', item.name || '');
            if (nm != null) { item.name = String(nm).trim(); fqDsUrlsSet(pool2); refreshDsUrlUI(); toast('会话 ' + (idx + 1) + ' 已重命名为「' + (item.name || '（未命名）') + '」', 'success'); }
            return;
          }
          pool2.splice(idx, 1);
          fqDsUrlsSet(pool2);
          refreshDsUrlUI();
          toast('已移除会话 ' + (idx + 1));
        };
      });
    }
    /* 清空 A 组会话缓存，使后续运行立即采用自定义网址池 */
    if (S.fq.webSess) delete S.fq.webSess.A;
    ROOT.querySelectorAll('.fq-lwebnote').forEach(n => {
      n.innerHTML = fqWebSessLabel(g, FQ_LAYERS[0]);
    });
  };
  if (dsUrlAdd) dsUrlAdd.onclick = () => {
    const v = (dsUrlIn && dsUrlIn.value.trim()) || '';
    if (!v) { toast('请先粘贴会话链接', 'warn'); return; }
    const pool = fqDsUrlsGet();
    if (pool.includes(v)) { toast('该会话已在池中', 'warn'); return; }
    pool.push(v);
    fqDsUrlsSet(pool);
    refreshDsUrlUI();
    toast('已加入会话池（当前 ' + (pool.length + 1) + ' 个）· 轮流交替发送', 'success');
  };
  if (dsUrlClear) dsUrlClear.onclick = () => {
    if (!fqDsUrlsGet().length) { toast('会话池已为空', ''); return; }
    fqDsUrlsSet([]);
    refreshDsUrlUI();
    toast('已清空会话池（恢复默认会话）', '');
  };
  ROOT.querySelectorAll('[data-fql]').forEach(hd => {
    hd.onclick = () => {
      const id = hd.dataset.fql;
      const bd = hd.nextElementSibling;
      const isOpen = bd.style.display !== 'none';
      bd.style.display = isOpen ? 'none' : '';
      hd.querySelector('span').textContent = isOpen ? '▸' : '▾';
      if (isOpen) S.fq.lOpen.delete(id); else S.fq.lOpen.add(id);
    };
  });
  ROOT.querySelectorAll('.fq-lsel').forEach(sel => {
    sel.onchange = () => fqBaseShow(sel.dataset.gid, sel.dataset.lid, sel.value);
    if (sel.value) fqBaseShow(sel.dataset.gid, sel.dataset.lid, sel.value);
  });
  const modeSel = ROOT.querySelector('.fq-lmode');
  if (modeSel) {
    modeSel.onchange = () => { S.fq.lmode = modeSel.value; };
  }
  ROOT.querySelectorAll('.fq-lrun').forEach(btn => {
    btn.onclick = () => fqLayerRun(btn.dataset.gid, btn.dataset.lid, btn);
  });
  ROOT.querySelectorAll('.fq-lcopy').forEach(btn => {
    btn.onclick = () => fqLayerCopy(btn.dataset.gid, btn.dataset.lid);
  });
  ROOT.querySelectorAll('.fq-lpaste').forEach(btn => {
    btn.onclick = () => fqLayerPaste(btn.dataset.gid, btn.dataset.lid);
  });
  ROOT.querySelectorAll('.fq-lall').forEach(btn => {
    btn.onclick = () => fqRunAll(btn.dataset.gid, btn);
  });
  ROOT.querySelectorAll('.fq-lfull').forEach(btn => {
    btn.onclick = () => fqFlowFullRun(btn.dataset.gid, btn);
  });
  if (FQ_DS_MODE[g.id]) fqDsBind(g);
}
function fqFlowFullRun(gid, btn) {
  /* ⚡ 一键全流程：有效信息流（AI 推荐 → 爬虫 → AI 清洗 → 校验补充）自动衔接 第 3→5 层评分；
     完成后刷新底部「全流程信息汇总」四卡片 */
  if ((S.fq.lmode || 'web') !== 'web') { toast('一键全流程目前仅支持 🌐 网页版通道（请将运行通道切换为网页版）', 'warn'); return; }
  fqAbortReset();
  /* 开启一键全流程：自动治理数据源链路库上限（超出 100 条的最早条目即刻删除） */
  try { fqDsSave(fqDsLoad()); } catch (e) { /* 治理失败不影响主流程 */ }
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = '⏳ 全流程运行中…';
  (async () => {
    try {
      /* 阶段一：有效信息流 */
      const r1 = await fqFlowRunAsync(gid, btn);
      if (FQ_ABORT) { toast('⛔ 全流程已中断（信息流阶段 · 进度已保留，可续跑）', 'warn'); return; }
      if (!r1 || !r1.ok) {
        toast('信息流未完成，已停止（未进入评分阶段）', 'error');
        return;
      }
      /* 阶段二：第 3→5 层评分（先校验第 2 层总览已就绪，缺失时给出诊断而不盲目进入评分） */
      const sel = ROOT.querySelector('.fq-lsel[data-gid="' + gid + '"]');
      const code = sel && sel.value;
      const p = code && fnLoad().products.find(x => x.code === code);
      if (!p) { toast('产品信息读取失败，评分阶段已跳过', 'warn'); return; }
      if (!fqLayerGet(gid, 'firm', code)) {
        toast('⚠ 信息流已产出数据，但第 2 层（总览型基础信息生成层）结果缺失：' + fqFlowDiag(gid, code)
          + '。建议：① 若刚才信息流提示「第 2 层生成失败」，请单独点击「第 2 层 · 运行」重试；② 或重新运行一键全流程；就绪后再点「一键评分」。', 'warn');
        return;
      }
      btn.textContent = '⏳ 评分阶段（第 3-5 层）…';
      const r2 = await fqRunAllCore(gid, code, p, btn, FQ_LAYERS.slice(2), true);   /* 一键全流程：跳过覆盖确认，直接重跑覆盖 */
      if (r2 && r2.ok) toast('⚡ 一键全流程完成（信息流 + 评分 ✓）', 'success');
      else toast('评分阶段未完整完成（信息流已就绪，可单独点「一键评分」重试）', 'warn');
    } catch (e) {
      if (FQ_ABORT) toast('⛔ 全流程已中断', 'warn');
      else toast('一键全流程失败：' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
      fqFlowSummaryRefresh(gid, S.fq.lprod || '');
    }
  })();
}
function fqLayerCopy(gid, lid) {
  /* 手动模式①：复制完整提示词（已填充当前产品/上层信息），供网页版 AI 运行 */
  const layer = FQ_LAYERS.find(x => x.id === lid);
  const lidx = FQ_LAYERS.findIndex(x => x.id === lid);
  if (!layer || !layer.prompt) { toast('该层提示词待配置', 'warn'); return; }
  const sel = ROOT.querySelector('.fq-lsel[data-lid="' + FQ_LAYERS[0].id + '"]');
  const code = sel && sel.value;
  const p = code && fnLoad().products.find(x => x.code === code);
  if (!p) { toast('请先选择产品', 'warn'); return; }
  const pv = fqLayerPrevs(gid, lid, code);
  if (pv.miss) { toast('请先运行「第 ' + pv.missNo + ' 层 · ' + pv.missName + '」获取当前产品的上层信息', 'warn'); return; }
  const prompt = fqFillPrompt(layer, p, pv.prevs[0] || null, pv.prevs[1] || null, gid);
  const ta = document.createElement('textarea');
  ta.value = prompt;
  ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { /* 忽略 */ }
  ta.remove();
  toast(ok ? '提示词已复制 ✓ 粘贴到网页版 AI 运行后，复制结果回到本窗口' : '复制失败，请长按手动复制', ok ? 'success' : 'error');
}
function fqLayerPaste(gid, lid) {
  /* 手动模式②：粘贴网页版 AI 返回的内容（JSON 或 markdown 文本），解析并入库分析 */
  const layer = FQ_LAYERS.find(x => x.id === lid);
  const lidx = FQ_LAYERS.findIndex(x => x.id === lid);
  if (!layer || !layer.prompt) { toast('该层提示词待配置', 'warn'); return; }
  const sel = ROOT.querySelector('.fq-lsel[data-lid="' + FQ_LAYERS[0].id + '"]');
  const code = sel && sel.value;
  const p = code && fnLoad().products.find(x => x.code === code);
  if (!p) { toast('请先选择产品', 'warn'); return; }
  const pv = fqLayerPrevs(gid, lid, code);
  if (pv.miss) { toast('请先运行「第 ' + pv.missNo + ' 层 · ' + pv.missName + '」获取当前产品的上层信息', 'warn'); return; }
  const existed = fqLayerGet(gid, lid, code);
  if (existed && !confirm('该产品已有运行结果（' + (existed.product || existed.code || '') + ' · ' + existed.ts + '），是否覆盖？')) return;
  const lv = lidx + 1;
  const m = modal({ title: `📥 粘贴结果 · 第 ${lv} 层`, body: `
    <div style="font-size:13px;color:var(--text-dim);margin-bottom:8px;">将网页版 AI 返回的内容（纯 JSON / markdown 原文均可，带 \`\`\`json 围栏也可以）粘贴到下方：</div>
    <textarea class="input" id="fq-paste-in" rows="8" placeholder='粘贴 AI 返回结果…' style="width:100%;resize:vertical;font-family:monospace;font-size:12px;"></textarea>
  `, actions: [
    { label: '分析并入库', cls: '', onClick: mask => {
      const t = document.getElementById('fq-paste-in').value;
      const obj = fqParseJSON(t);
      if (!obj && !String(t || '').trim()) { toast('粘贴内容为空', 'warn'); return; }
      fqLayerSet(gid, lid, { code: p.code, product: p.name, result: obj, raw: obj ? '' : String(t), ts: fmtDate(new Date()) + ' ' + new Date().toTimeString().slice(0, 5), mode: 'manual' });
      mask.remove();
      fqBaseShow(gid, lid, code);
      toast(obj ? '手动结果已导入 ✓' : '已保存为文本结果 ✓', obj ? 'success' : 'info');
    }},
    { label: '取消', cls: 'soft', onClick: mask => mask.remove() },
  ]});
}
function fqProvSync(sel) {
  /* 拉取各平台 Key 状态：标注选项，并自动切换到已配置平台 */
  api('/api/plugin/ai/keys').then(k => {
    if (!sel || !k || !k.ok) return;
    const provs = k.providers || {};
    const cur = sel.value;
    const curOk = provs[cur] && provs[cur].has_key;
    const alt = AI_PROVIDERS.filter(p => !p.pending && p.id !== cur && provs[p.id] && provs[p.id].has_key)[0];
    sel.innerHTML = AI_PROVIDERS.filter(p => !p.pending).map(p => {
      const st = provs[p.id];
      const mark = st && st.has_key ? ' ✓ 已配置' : ' ⚠ 未配置';
      return `<option value="${p.id}" ${sel.value === p.id ? 'selected' : ''}>${p.icon} ${p.label}${mark}</option>`;
    }).join('');
    if (!curOk && alt) {
      sel.value = alt.id;
      S.fq.lprov = alt.id;
      toast('已自动切换至已配置的 ' + alt.label, 'info');
    }
  }).catch(() => {});
}
function fqLayerSync(gid, lid, code) {
  /* 按当前产品刷新某层的结果区 / 头部徽标 / 运行备注 */
  const cur = fqLayerGet(gid, lid, code);
  const resBox = document.getElementById('fq-lres-' + gid + '-' + lid);
  if (resBox) resBox.innerHTML = fqLayerResHTML(cur, gid);
  const planEl = document.getElementById('fq-dsplan-' + gid);
  if (planEl) planEl.innerHTML = fqDsPlanHTML(gid, code);
  const hd = document.getElementById('fq-lhd-' + gid + '-' + lid);
  if (hd) hd.innerHTML = cur ? '✓ ' + esc(cur.product || cur.code || '') + ' · ' + cur.ts : '';
  const note = document.getElementById('fq-lnote-' + gid + '-' + lid);
  if (note) note.textContent = cur ? '已有该产品结果，再次运行将询问是否覆盖' : '该产品首次运行将直接执行';
}
function fqBaseShow(gid, lid, code) {
  if (S.fq) S.fq.lprod = code;
  const el = document.getElementById('fq-lov2-' + gid + '-' + lid);
  const p = fnLoad().products.find(x => x.code === code);
  if (el) el.innerHTML = p ? `<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;background:rgba(143,216,184,.10);border-radius:8px;padding:8px 10px;">
    <span><b>product_id</b> ${esc(p.code)}</span>
    <span><b>product_name</b> ${esc(p.name)}</span>
    <span><b>latest_price</b> ${p.last_nav == null ? '<span class="fin-note">null</span>' : esc(String(p.last_nav))}</span>
  </div>` : '';
  /* 第 1 层自身结果区/徽标/备注 */
  fqLayerSync(gid, lid, code);
  /* 第 2~5 层：上层信息概览已精简，仅同步结果区/徽标/备注到当前产品 */
  FQ_LAYERS.slice(1).forEach(layer => {
    fqLayerSync(gid, layer.id, code);
  });
  /* 中期 / 短期预期类第一层引用区同步（产品切换时刷新引用与链路展示） */
  Object.keys(FQ_DS_MODE).forEach(dgid => {
    if (dgid === gid && !(FQ_DS_MODE[gid] && lid === 'base')) return;
    const refEl = document.getElementById('fq-dsref-' + dgid);
    if (refEl) refEl.innerHTML = fqDsRefHTML(dgid, code);
    fqLayerSync(dgid, 'base', code);
    const libEl = document.getElementById('fq-dslib-' + dgid);
    if (libEl) libEl.innerHTML = fqDsLibHTML(dgid);
  });
}
/* 五层 → 三组会话：第 1~3 层共用会话 A（延续上下文）；第 4 层审查、第 5 层评分各用新对话 */
const FQ_WEB_GROUP = { base: 'A', firm: 'A', industry: 'A', finance: 'B', risk: 'C' };
const FQ_DSURL_KEY = 'rt_fq_dsurl';
const FQ_DSURLS_KEY = 'rt_fq_dsurls';      /* 多会话网址池（数组）——轮流交替发送 */
const FQ_DSURL_IDX_KEY = 'rt_fq_dsurl_idx'; /* 轮询索引：每次取下一个会话实现交替对话 */
function fqDsUrlsGet() {
  /* 会话池：对象数组 [{url, name}]。旧单值（rt_fq_dsurl）与旧字符串数组首次读取时一次性迁移，
     此后池为空即为真空（删除 / 清空后不再回退旧值） */
  const v = loadJSON(FQ_DSURLS_KEY, null);
  if (Array.isArray(v)) {
    return v.map(x => {
      if (typeof x === 'string') return { url: x, name: '' };                              /* 旧字符串元素迁移 */
      if (x && typeof x === 'object' && x.url && typeof x.url === 'string') return { url: x.url, name: (x.name || '') };
      return null;
    }).filter(Boolean);
  }
  const old = localStorage.getItem(FQ_DSURL_KEY) || ''; /* 旧单值键为纯字符串，不可走 JSON.parse */
  if (typeof old === 'string' && old.trim()) {
    const arr = [{ url: old.trim(), name: '' }];
    fqDsUrlsSet(arr);
    localStorage.removeItem(FQ_DSURL_KEY);
    return arr;
  }
  return [];
}
function fqDsUrlsSet(arr) {
  localStorage.setItem(FQ_DSURLS_KEY, JSON.stringify((arr || []).map(x => (typeof x === 'string' ? { url: x, name: '' } : x)).filter(x => x && x.url && typeof x.url === 'string')));
}
function fqDsUrlPeek() {
  /* 只读查看当前轮询位置的会话（不推进索引、不改 curSess），供标签/进度显示使用 */
  const pool = fqDsUrlsGet();
  if (!pool.length) return null;
  let idx = parseInt(localStorage.getItem(FQ_DSURL_IDX_KEY) || '0', 10);
  if (!isFinite(idx) || idx < 0) idx = 0;
  return { url: pool[idx % pool.length].url, name: pool[idx % pool.length].name || '', idx: idx % pool.length, total: pool.length };
}
function fqDsUrlGet() {
  /* 从会话池轮询取下一个网址（交替进行网页版 DS 对话；空池 = 沿用 AI 工作台已选 / 默认会话）。
     同时记录 S.fq.curSess（当前实际使用的会话，供「一键分析 · 当前会话」展示） */
  const pool = fqDsUrlsGet();
  if (!pool.length) { if (S.fq) S.fq.curSess = null; return ''; }
  let idx = parseInt(localStorage.getItem(FQ_DSURL_IDX_KEY) || '0', 10);
  if (!isFinite(idx) || idx < 0) idx = 0;
  const item = pool[idx % pool.length];
  localStorage.setItem(FQ_DSURL_IDX_KEY, String((idx + 1) % pool.length));
  if (S.fq) S.fq.curSess = { url: item.url, name: item.name || '', idx: idx % pool.length, total: pool.length };
  return item.url;
}
function fqDsUrlSet(u) {
  /* 单值写入 → 归入会话池（去重；空值=清空池） */
  if (!u || !String(u).trim()) { localStorage.removeItem(FQ_DSURLS_KEY); localStorage.removeItem(FQ_DSURL_IDX_KEY); return; }
  const pool = fqDsUrlsGet();
  const v = String(u).trim();
  if (!pool.some(x => x.url === v)) pool.push({ url: v, name: '' });
  fqDsUrlsSet(pool);
  localStorage.setItem(FQ_DSURL_IDX_KEY, '0');
}
function fqDsSessName(item) {
  /* 会话显示名：池内自定义名称优先，否则显示网址后四位 */
  if (!item || !item.url) return '';
  return item.name || '…' + String(item.url).slice(-4);
}
function fqDsUrlLabel() {
  const pool = fqDsUrlsGet();
  if (!pool.length) return '使用默认会话（AI 工作台已选 / 自动沿用）';
  const cur = fqDsUrlPeek();
  return '会话池 ' + pool.length + ' 个网址 · 轮流交替发送（当前第 ' + ((cur && cur.idx) || 0) + 1 + ' 个 · ' + fqDsSessName(cur) + '）';
}
function fqDsUrlBar() {
  const pool = fqDsUrlsGet();
  const chips = pool.map((x, i) => `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11.5px;padding:2px 8px;border-radius:12px;border:1px solid rgba(0,0,0,.1);background:rgba(99,102,241,.06);">
    <b>${i + 1}</b> <span title="${esc(x.url)}">${x.name ? esc(x.name) : '…' + esc(String(x.url).slice(-4))}</span>
    <a href="javascript:;" data-idx="${i}" data-act="rename" style="color:#6366f1;text-decoration:none;font-weight:700;" title="重命名会话">✎</a>
    <a href="javascript:;" data-idx="${i}" data-act="del" style="color:#d2455a;text-decoration:none;font-weight:700;" title="移除该会话">×</a></span>`).join(' ');
  return `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;padding:8px 12px;border:1px solid rgba(0,0,0,.08);border-radius:10px;background:#fff;">
    <span style="font-size:12.5px;font-weight:600;">🌐 网页会话网址池</span>
    <input class="input" id="fq-dsurl" value="" placeholder="粘贴 DeepSeek 会话链接，可添加多个（轮流交替发送）" style="flex:1;min-width:240px;padding:5px 8px;font-size:12.5px;">
    <button class="btn sm" id="fq-dsurl-add" style="font-size:12px;padding:3px 14px;">＋ 添加</button>
    <button class="btn sm soft" id="fq-dsurl-clear" style="font-size:12px;padding:3px 10px;">✖ 清空</button>
    <span class="fin-note" id="fq-dsurl-note" style="font-size:11px;">${fqDsUrlLabel()}</span>
    <div id="fq-dsurl-chips" style="width:100%;display:flex;gap:6px;flex-wrap:wrap;">${chips || '<span class="fin-note" style="font-size:11px;">尚未添加会话网址</span>'}</div>
  </div>`;
}
function fqWebSessLabel(g, layer) {
  const grp = FQ_WEB_GROUP[layer.id] || 'A';
  const url = (S.fq.webSess || {})[grp];
  if (grp === 'A') {
    const peek = fqDsUrlPeek();   /* 只读：不推进轮询索引 */
    if (peek) return `会话 A（自定义网址 · 第 ${peek.idx + 1}/${peek.total}）：${fqDsSessName(peek)}`;
  }
  if (url === 'fresh://') return `会话 ${grp}：新对话（首次回复后取得链接）`;
  if (url) return `会话 ${grp}：…${url.slice(-12)}`;
  if (grp === 'A') return S.ai && S.ai.wsess ? `会话 A（沿用已选）：${esc(S.ai.wsess.name)}` : '会话 A：运行时自动沿用已选会话或默认会话';
  return `会话 ${grp}：运行时自动开启新对话（独立上下文）`;
}
function fqLayerWebSess(lid) {
  /* 返回该层所属组会话 URL；A 组优先使用因子分析顶部设置的自定义网址，其次沿用已选/默认会话；B/C 组自动开启新对话 */
  const g = FQ_WEB_GROUP[lid] || 'A';
  if (g === 'A') {
    const cust = fqDsUrlGet();
    if (cust) return Promise.resolve(cust);
  }
  if (!S.fq.webSess) S.fq.webSess = {};
  if (S.fq.webSess[g]) return Promise.resolve(S.fq.webSess[g]);
  if (g === 'A') {
    if (S.ai && S.ai.wsess && S.ai.wsess.url) { S.fq.webSess.A = S.ai.wsess.url; return Promise.resolve(S.ai.wsess.url); }
    return api('/api/plugin/webchat/sessions').then(r => {
      const lst = (r && r.sessions) || [];
      if (lst.length) { S.fq.webSess.A = lst[0].url; return lst[0].url; }
      return null;
    });
  }
  return apiPost('/api/plugin/webchat/new', {}).then(r => {
    if (!r || !r.ok) throw new Error((r && (r.error || (r.code === 'need_login' ? '网页登录已失效，请重新登录' : ''))) || '开启新对话失败');
    S.fq.webSess[g] = r.url;
    return r.url;
  });
}
function fqValidateResult(gid, lid, obj) {
  /* 结果审查：返回 null=通过；否则返回失败原因（用于自动重跑，连续 3 次失败即停止）
     L2 中期预期 · 第三层（industry）结果为四键对象（dim_name + items）；其余为数组结构 */
  if (!obj) return '解析失败（非 JSON 内容）';
  switch (lid) {
    case 'base':
      if (typeof obj === 'object' && !Array.isArray(obj)) {
        if (Array.isArray(obj.sources)) return obj.sources.length >= 1 && obj.sources.every(s => s && (s.name || s.home)) ? null : '数据源推荐结果每条需含 name / home';
        const three = [obj.company_news_platforms, obj.industry_news_platforms, obj.investment_discussion_platforms];
        if (three.some(Array.isArray)) {
          const all = [].concat(...three.filter(Array.isArray));
          return all.length >= 1 && all.every(s => s && s.platform_name) ? null : '平台条目缺少 platform_name';
        }
        if (obj.product_id != null || obj.product_name != null) return null;
      }
      return '缺少 product_id / product_name 字段';
    case 'firm':
      if (typeof obj === 'object' && !Array.isArray(obj) && obj.event_overview && obj.industry_news_overview && obj.opinion_overview) return null;  /* L2 中期预期 · 事件/产业/舆情总览 */
      return (Array.isArray(obj) && obj.length >= 1 && obj.every(s => s && typeof s === 'object')) ? null : '应为 JSON 数组且每条含字段';
    case 'industry':
      if (gid === 'L2' && typeof obj === 'object' && !Array.isArray(obj)) {
        /* L2 中期预期 · 第三层：四键对象（公司事件预期差 / 产业预期修正 / 舆论综合得分 / 舆论分歧度），每键含 dim_name + items(3) */
        const keys = ['event_expectation_gap', 'industry_expectation_correction', 'public_opinion_score', 'opinion_divergence'];
        if (keys.every(k => obj[k] && typeof obj[k] === 'object' && obj[k].dim_name && Array.isArray(obj[k].items) && obj[k].items.length >= 1)) return null;
        return '应包含 4 个维度（event_expectation_gap / industry_expectation_correction / public_opinion_score / opinion_divergence），每维含 dim_name 与 items';
      }
      return (Array.isArray(obj) && obj.length === 3 && obj.every(s => s && Array.isArray(s.items))) ? null : '应为 3 个维度分组且每组含 items';
    case 'finance':
      if (gid === 'L2') {
        /* L2 中期预期 · 第四层：审查结果数组，每条含 item_name 与 confidence_score（0-1） */
        return (Array.isArray(obj) && obj.length >= 1 && obj.every(it => it && it.item_name != null && typeof it.confidence_score === 'number' && it.confidence_score >= 0 && it.confidence_score <= 1)) ? null : '应为审查结果数组：每条含 item_name 与 0-1 的 confidence_score';
      }
      return (Array.isArray(obj) && obj.length >= 1 && obj.every(it => {
        const c = it && it['置信度得分'];
        return typeof c !== 'number' || (c >= 0 && c <= 1);
      })) ? null : '置信度得分超出 0-1 区间或条目结构异常';
    case 'risk':
      if (gid === 'L2') {
        /* L2 中期预期 · 第五层：评分对象（item_scores 含 dim_name/item_name/raw_score/confidence/final_score + dim_summary + total_mid_score） */
        return (typeof obj === 'object' && !Array.isArray(obj)
          && Array.isArray(obj.item_scores) && obj.item_scores.length >= 1
          && obj.item_scores.every(it => it && it.dim_name && it.item_name && typeof it.final_score === 'number')
          && Array.isArray(obj.dim_summary) && obj.dim_summary.length >= 1
          && typeof obj.total_mid_score === 'number') ? null : '应包含 item_scores（每条含 dim_name/item_name/final_score）、dim_summary 与 total_mid_score';
      }
      return (typeof obj === 'object' && !Array.isArray(obj) && Array.isArray(obj.item_scores) && obj.item_scores.length >= 1 && obj.item_scores.every(it => it && typeof it.final_score === 'number')) ? null : 'item_scores 缺失或 final_score 非数字';
  }
  return null;
}
function fqLayerRun(gid, lid, btn) {
  const layer = FQ_LAYERS.find(x => x.id === lid);
  const lidx = FQ_LAYERS.findIndex(x => x.id === lid);
  if (!layer || !layer.prompt) { toast('该层提示词待配置', 'warn'); return; }
  const sel = ROOT.querySelector('.fq-lsel[data-lid="' + FQ_LAYERS[0].id + '"]');
  const code = sel && sel.value;
  const p = code && fnLoad().products.find(x => x.code === code);
  if (!p) { toast('请先选择产品', 'warn'); return; }
  const pv = fqLayerPrevs(gid, lid, code);
  if (pv.miss) { toast('请先运行「第 ' + pv.missNo + ' 层 · ' + pv.missName + '」获取当前产品的上层信息', 'warn'); return; }
  const existed = fqLayerGet(gid, lid, code);
  if (existed && !confirm('该产品已有运行结果（' + (existed.product || existed.code || '') + ' · ' + existed.ts + '），是否覆盖？')) return;
  if (FQ_DS_MODE[gid] && lid === 'industry') {
    /* L2 中期预期 · 第三层：分批链式评估（公司事件 / 产业预期 / 舆论两组 三批，类内超阈值拆子批带前批结论） */
    if ((S.fq.lmode || 'web') !== 'web') { toast('第三层目前仅支持 🌐 网页版通道', 'warn'); return; }
    fqAbortReset();
    const note = document.getElementById('fq-lnote-' + gid + '-' + lid);
    fqAbortMount(note, '第 3 层');
    const orig = btn.textContent;
    btn.disabled = true;
    const states = { phase: 'running', msg: '', steps: [{ id: 'industry', idx: 3, name: layer.name, st: 'run' }] };
    (async () => {
      try {
        const res = await fqMidLayer3Run(gid, code, p, (S.fq.tw && S.fq.tw[gid]) || '一个月', states, states.steps[0]);
        if (!res.ok) {
          if (res.aborted) { if (note) note.textContent = '⛔ 已手动中断（已合并批次结果已保留）'; toast('⛔ 第 3 层运行已中断', 'warn'); }
          else { if (note) note.textContent = '⚠ 执行失败：' + (res.lastErr || '未知错误'); toast('第 3 层执行失败：' + (res.lastErr || '未知错误'), 'error'); }
        } else {
          if (note) note.textContent = '✅ 完成（分批链式 · ' + res.batches + ' 批）';
          toast('第 3 层（核心参数细节评估）完成', 'success');
        }
      } catch (e) { if (note) note.textContent = '⚠ ' + e.message; toast('第 3 层失败：' + e.message, 'error'); }
      btn.disabled = false; btn.textContent = orig;
    })();
    return;
  }
  const prompt = fqFillPrompt(layer, p, pv.prevs[0] || null, pv.prevs[1] || null, gid);
  if ((S.fq.lmode || 'web') === 'web') {
    fqLayerWebSess(lid).then(url => {
      if (!url) { toast('网页会话不可用：请先在「AI 工作台 · 🌐 网页会话」添加并选中会话链接，或完成登录', 'warn'); return; }
      fqRunWithAudit(gid, lid, btn, {
        send: () => apiPost('/api/plugin/webchat/chat', { url, message: prompt, expect: fqExpectOf(gid, lid) }),
        prompt: prompt, url: url, code: p.code, product: p.name, mode: 'web',
      });
    }).catch(e => { toast('会话准备失败：' + e.message, 'error'); });
    return;
  }
  /* 备选：API Key 直连（同样带结果审查与自动重跑） */
  const prov = S.fq.lprov || 'deepseek';
  fqRunWithAudit(gid, lid, btn, {
    send: () => apiPost('/api/plugin/ai/chat', { provider: prov, message: prompt, history: [] }),
    prompt: prompt, url: '', code: p.code, product: p.name, mode: 'auto',
  });
}
function fqRunWithAudit(gid, lid, btn, ctx) {
  /* 单层运行（按钮式）：委托公共审查执行器 fqRunAuditCore —— 与一键分析（fqExecOnceWeb）同一路径 */
  const orig = btn.textContent;
  const layerNo = FQ_LAYERS.findIndex(x => x.id === lid) + 1;
  const note = document.getElementById('fq-lnote-' + gid + '-' + lid);
  return fqRunAuditCore(gid, lid, ctx, {
    note: note,
    progress: msg => { if (note) { note.textContent = msg; fqAbortMount(note, '第 ' + layerNo + ' 层'); } },
    done: msg => { if (note) note.textContent = msg; },
    busy: on => { btn.disabled = !!on; btn.textContent = on ? '⏳ 运行中…' : orig; },
    onSuccess: attempts => { toast('第 ' + layerNo + ' 层结果已获取 ✓（尝试 ' + attempts + ' 次）', 'success'); },
  });
}
function renderFactorTool(box) {
  if (!box) box = ROOT;
  const g = FQ_FACTORS.find(x => x.id === S.fq.factorGroup) || FQ_FACTORS[0];
  const isFlow = g.id !== 'L4';
  box.innerHTML = `
    <div class="gcard">
      <div class="section-title"><span class="st-emoji">🧪</span>因子分析 · ${esc(g.name)}
        <span style="font-size:12px;color:var(--text-dim);font-weight:400;">${g.freq} · ${g.tag} · ${g.items.length} 项参数</span></div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
        <button class="btn sm soft" id="fn-fac-back">⬅ 返回量化影响因子</button>
        ${isFlow
          ? `<span class="pi-badge ok" style="font-size:11px;">🔄 五层信息流 · 逐层 AI 补全</span>`
          : `<span class="pi-badge rep">⏳ 数据源与计算方案待接入</span>`}
      </div>
      ${isFlow ? fqLayersBody(g) : `
      <div style="font-size:12.5px;color:var(--text-dim);margin-bottom:8px;">该组参数（点击后续逐步补充数据获取与评分方案）：</div>
      ${g.items.map(it => `<div class="fj-lrow" style="padding-left:16px;font-size:12.5px;align-items:center;">
        <span class="fj-tag" style="width:26px;">📌</span><span>${it}</span><span style="flex:1;"></span><span class="fin-note">待接入</span>
      </div>`).join('')}
      <div class="empty" style="padding:24px;margin-top:10px;">
        <span class="e-icon">🧪</span>
        <div style="margin-top:8px;font-size:13px;">「${esc(g.name)}」分析面板</div>
        <div style="font-size:12px;color:var(--text-dim);margin-top:6px;line-height:1.8;">
          当前为工作流化预留入口：后续在此补充该组各因子的数据获取（${g.freq}）、评分算法、回测与阈值面板。
        </div>
      </div>`}
    </div>`;
  const back = $('#fn-fac-back');
  if (back) back.onclick = () => { S.fq.view = 'quant'; S.fq.factorGroup = null; renderFinQuantTool(); };
  if (isFlow) fqLayersBind(g);
}
function renderFundNavTool(box) {
  if (!box) box = ROOT;
  if (!S.fq) S.fq = { view: 'fund', expanded: null, list: null };
  const prod = fnLoad().products;
  if (!S.fq.list) {
    S.fq.list = [];
    apiPost('/api/plugin/finance/fund/list', {}).then(r => { if (r && r.ok) S.fq.list = r.funds; });
  }
  box.innerHTML = `
    <div class="gcard" style="margin-bottom:14px;">
      <div class="section-title"><span class="st-emoji">📦</span>基金公司 / 净值披露
        <span style="font-size:12px;color:var(--text-dim);font-weight:400;">天天基金公开数据 · 成立以来全量净值 · 本地缓存 24h</span></div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <button class="btn sm soft" id="fn-back">⬅ 返回理财量化</button>
        <div style="position:relative;flex:1;min-width:240px;max-width:440px;">
          <input class="input" id="fn-code" placeholder="输入 6 位基金编号，或搜索名称下拉选择…" style="width:100%;">
          <div id="fn-sugg-list" style="position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:30;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 10px 26px rgba(0,0,0,.12);max-height:280px;overflow:auto;display:none;"></div>
        </div>
        <button class="btn sm" id="fn-add">➕ 添加产品</button>
        <span class="fin-note">已添加 ${prod.length} 个产品${S.fq.list && S.fq.list.length ? ` · 全量列表 ${S.fq.list.length} 只可选` : ''}</span>
      </div>
    </div>
    <div id="fn-list">
      ${prod.length ? `<div class="gcard">
        <div class="section-title"><span class="st-emoji">📚</span>产品列表
          <span style="font-size:12px;color:var(--text-dim);font-weight:400;">点击产品展开 / 收起净值可视化 · ✕ 移除</span></div>
        ${prod.map(p => {
          const open = S.fq.expanded === p.code;
          return `<div class="fn-prod${open ? ' on' : ''}" data-code="${p.code}">
            <span class="fr-tag" style="width:56px;">${p.code}</span>
            <span class="fr-name" style="flex:1;min-width:140px;">${esc(p.name)}</span>
            <span style="width:92px;">最新 <b style="color:var(--text);">${Number(p.last_nav).toFixed(4)}</b></span>
            <span class="fin-note" style="width:86px;">${p.last_date || '—'}</span>
            <span class="fin-note" style="width:70px;">${p.count || 0} 日</span>
            <span style="width:24px;text-align:right;cursor:pointer;color:#e05a7a;" data-del="${p.code}" title="移除">✕</span>
          </div>
          ${open ? `<div class="fn-chart" id="fn-chart-${p.code}"><div class="empty" style="padding:16px;"><span class="e-icon">⏳</span>正在加载成立以来净值…</div></div>` : ''}`;
        }).join('')}
      </div>` : `<div class="gcard"><div class="empty" style="padding:26px;"><span class="e-icon">📭</span>尚未添加任何基金 —— 输入编号或从全量列表下拉选择后添加</div></div>`}
    </div>`;
  $('#fn-back').onclick = () => { S.fq.view = null; renderFinQuantTool(); };
  const inp = $('#fn-code');
  inp.oninput = () => fnSuggRender();
  inp.onfocus = () => fnSuggRender();
  inp.onblur = () => setTimeout(() => { const sl = document.getElementById('fn-sugg-list'); if (sl) sl.style.display = 'none'; }, 180);
  $('#fn-add').onclick = () => {
    const code = inp.value.trim();
    if (!/^\d{6}$/.test(code)) return toast('请输入 6 位基金编号', 'warn');
    fnAdd(code);
  };
  const list = box.querySelector('#fn-list');
  if (list) list.onclick = e => {
    const del = e.target.closest('[data-del]');
    if (del) {
      if (!confirm(`移除「${del.dataset.del}」？本地缓存数据保留，可随时重新添加。`)) return;
      const q = fnLoad();
      q.products = q.products.filter(p => p.code !== del.dataset.del);
      fnSave(q);
      if (S.fq.expanded === del.dataset.del) S.fq.expanded = null;
      renderFundNavTool();
      return;
    }
    const row = e.target.closest('.fn-prod');
    if (!row) return;
    S.fq.expanded = S.fq.expanded === row.dataset.code ? null : row.dataset.code;
    renderFundNavTool();
  };
  if (S.fq.expanded) {
    const code = S.fq.expanded;
    fnEnsureNav(code).then(r => {
      const host = document.getElementById('fn-chart-' + code);
      if (host && r) { host.innerHTML = fnFundChart(r); fnBindFundChart(host, r); }
    });
  }
}

/* ---------- 主视图 ---------- */
function renderFinanceTool(container) {
  ROOT = container;
  const box = ROOT;
  if (!FIN_CACHE) {
    box.innerHTML = '<div class="gcard" style="padding:24px;color:var(--text-dim);">正在从数据库读取记账数据…</div>';
    finFetchState().then(() => renderFinanceTool(ROOT)).catch(e => {
      box.innerHTML = '<div class="gcard" style="padding:24px;color:#b42318;">记账数据读取失败：' + esc(e.message) + '</div>';
    });
    return;
  }
  if (!S.fin) S.fin = { tab: 'dash' };
  box.innerHTML = `
    <div class="fin-tabs" id="fin-tabs">
      ${[['dash', '📊 仪表盘'], ['snap', '📸 每日快照'], ['acct', '🏦 账户'], ['liab', '💳 负债'], ['real', '🏠 实物资产'], ['inv', '📈 理财'], ['rep', '📄 报表'], ['set', '⚙️ 设置']]
        .map(([id, lb]) => `<button class="fin-tab${S.fin.tab === id ? ' on' : ''}" data-tab="${id}">${lb}</button>`).join('')}
    </div>
    <div id="fin-body"></div>`;
  $('#fin-tabs').onclick = e => {
    const b = e.target.closest('.fin-tab');
    if (!b) return;
    S.fin.tab = b.dataset.tab;
    renderFinanceTool(ROOT);
  };
  finRender();
}
function finRender() {
  const d = loadFin();
  const body = $('#fin-body');
  if (S.fin.tab === 'dash') finDash(body, d);
  else if (S.fin.tab === 'snap') finSnapPage(body, d);
  else if (S.fin.tab === 'acct') finAcctsPage(body, d);
  else if (S.fin.tab === 'liab') finLiabsPage(body, d);
  else if (S.fin.tab === 'real') finRealsPage(body, d);
  else if (S.fin.tab === 'inv') finInvPage(body, d);
  else if (S.fin.tab === 'rep') finReportPage(body, d);
  else if (S.fin.tab === 'set') finSettingsPage(body, d);
}

/* ---------- 仪表盘 ---------- */
/* ---------- 仪表盘增强：区间归因 / 饼图 / 汇率历史 / 排除归因曲线 ---------- */
function finAttribKeys(d) {
  // 资产曲线只展示资产口径可解释的归因；横向转账、负债变化、账户移除不进入曲线图例。
  const curveExcluded = new Set(['横向转账', '负债变化', '账户移除']);
  const set = new Set();
  for (let i = 1; i < d.snaps.length; i++) finAttribution(d.snaps[i - 1], d.snaps[i]).forEach(x => {
    if (!curveExcluded.has(x.k)) set.add(x.k);
  });
  return Array.from(set);
}
function finAttribRange(d, from, to) {
  const EPS = 0.005;
  const acc = {};
  const add = (k, v) => { if (Math.abs(v) > EPS) acc[k] = (acc[k] || 0) + v; };
  const idx0 = from ? d.snaps.findIndex(s => s.date >= from) : 0;
  let prev = idx0 > 0 ? d.snaps[idx0 - 1] : null;
  d.snaps.forEach(s => {
    if (from && s.date < from) return;
    if (to && s.date > to) return;
    if (prev) finAttribution(prev, s).forEach(x => add(x.k, x.v));
    prev = s;
  });
  return acc;
}
function finAttribSources(prev, snap, key) {
  // 归因来源：某区间片段内组成指定归因的账户/聚合项（与 finAttribution 同口径）
  const EPS = 0.005;
  const out = [];
  const add = (name, cur, v, note) => { if (Math.abs(v) > EPS) out.push({ name, cur, v, note: note || '' }); };
  const prevMap = {};
  (prev.accts || []).forEach(a => prevMap[a.id] = a);
  (snap.accts || []).forEach(a => {
    const p = prevMap[a.id];
    const fxT = snap.fx && snap.fx[a.cur] != null ? snap.fx[a.cur] : 1;
    const fxP = p && prev.fx && prev.fx[a.cur] != null ? prev.fx[a.cur] : fxT;
    const vT = a.val || 0, vP = p ? (p.val || 0) : 0;
    const baseT = Number.isFinite(Number(a.base)) ? Number(a.base) : vT * fxT;
    const baseP = p && Number.isFinite(Number(p.base)) ? Number(p.base) : vP * fxP;
    const dBase = baseT - baseP;
    if (Math.abs(dBase) <= EPS) return;
    const origWhy = a.why || (!p ? '新增账户' : '日常变动');
    const exch = vP * (fxT - fxP);
    const balBase = dBase - exch;
    const subs = (a.subs || []).filter(s2 => Math.abs(s2.v) > EPS);
    const subSum = subs.reduce((s2, x) => s2 + x.v, 0);
    const fallback = balBase - subSum;
    if (key === '汇率变动') add(a.name || a.id, a.cur, exch, '汇率折算');
    subs.forEach(s2 => { if (s2.why === key) add(a.name || a.id, a.cur, s2.v, '手动明细'); });
    if (origWhy === key) add(a.name || a.id, a.cur, fallback, '自动兜底');
  });
  if (key === '投资盈亏') add('理财持仓合计', '', snap.inv - prev.inv, '聚合变动');
  if (key === '实物增值/折旧') add('实物资产合计', '', snap.real - prev.real, '聚合变动');
  if (key === '负债变化') add('负债合计', '', prev.liab - snap.liab, '聚合变动');
  if (key === '日常支出') {
    // A3：真实差额并入日常支出；下钻时单独列出该差额来源。
    const residual = finAttributionParts(prev, snap).residual;
    add('快照净变动与日常支出合计差额', '', residual, '真实差额并入日常支出');
  }
  if (key === '账户移除') {
    const current = new Set((snap.accts || []).map(a => a.id));
    (prev.accts || []).forEach(a => {
      if (current.has(a.id)) return;
      const fx = prev.fx && prev.fx[a.cur] != null ? prev.fx[a.cur] : 1;
      const base = Number.isFinite(Number(a.base)) ? Number(a.base) : (a.val || 0) * fx;
      add(a.name || a.id, a.cur, -base, '已移除账户（按上期快照）');
    });
  }
  return out;
}
function finAttribSourceGroups(d, from, to, key) {
  // 按日期分组：目标区间内每个快照日期的来源明细
  const groups = [];
  const idx0 = from ? d.snaps.findIndex(s => s.date >= from) : 0;
  if (idx0 < 0) return groups;
  let prev = idx0 > 0 ? d.snaps[idx0 - 1] : null;
  d.snaps.forEach((s, i) => {
    if (i < idx0) return;
    if (to && s.date > to) return;
    if (prev) {
      const items = finAttribSources(prev, s, key);
      if (items.length) groups.push({ date: s.date, items, total: items.reduce((s2, x) => s2 + x.v, 0) });
    }
    prev = s;
  });
  return groups;
}
function finReasonUsage(d, reason) {
  // 变更原因引用校验：账户级 why 与明细 subs[].why 都算引用
  const hits = [];
  (d.snaps || []).forEach(s => {
    (s.accts || []).forEach(a => {
      if (a.why === reason) hits.push({ date: s.date, name: a.name || a.id, kind: '账户变更原因' });
      (a.subs || []).forEach(sub => { if (sub.why === reason) hits.push({ date: s.date, name: a.name || a.id, kind: '明细' }); });
    });
  });
  return hits;
}
function finSnapVal(s, fx) {
  return (s.accts || []).reduce((sum, a) => sum + (a.val || 0) * (fx && fx[a.cur] != null ? fx[a.cur] : 1), 0);
}
function finAttribDetail(prev, snap) {
  // 归因明细：每账户一笔变动行（含自动汇率拆分 + 手动细节 + 自动兜底），供「编辑归因明细」直接写快照 why/subs（持久化到 finance_*）
  const EPS = 0.005;
  const rows = [];
  const prevMap = {};
  (prev.accts || []).forEach(a => prevMap[a.id] = a);
  (snap.accts || []).forEach(a => {
    const p = prevMap[a.id];
    const fxT = snap.fx && snap.fx[a.cur] != null ? snap.fx[a.cur] : 1;
    const fxP = p && prev.fx && prev.fx[a.cur] != null ? prev.fx[a.cur] : fxT;
    const vT = a.val || 0, vP = p ? (p.val || 0) : 0;
    const baseT = Number.isFinite(Number(a.base)) ? Number(a.base) : vT * fxT;
    const baseP = p && Number.isFinite(Number(p.base)) ? Number(p.base) : vP * fxP;
    const dBase = baseT - baseP;
    if (Math.abs(dBase) <= EPS) return;
    const origWhy = a.why || (!p ? '新增账户' : '日常变动');
    const exch = vP * (fxT - fxP);
    const balBase = dBase - exch;
    const subs = (a.subs || []).slice();
    const subSum = subs.reduce((s2, x) => s2 + x.v, 0);
    rows.push({ id: a.id, name: a.name || a.id, cur: a.cur, dBase, exch, balBase, subs, subSum,
      fallback: balBase - subSum, why: a.why || '', origWhy, autoWhy: origWhy });
  });
  // 全局归因（只读展示：投资盈亏 / 实物 / 负债，无账户级 why 可写）
  const global = [];
  const g = (k, v) => { if (Math.abs(v) > EPS) global.push({ k, v }); };
  g('投资盈亏', snap.inv - prev.inv);
  g('实物增值/折旧', snap.real - prev.real);
  g('负债变化', prev.liab - snap.liab);
  return { rows, global };
}
function finSubId() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function finLinkCands(d) {
  // 横向转账关联候选：全部日期的账户变动行（不含自身，由调用方排除）
  const cands = [];
  for (let i = d.snaps.length - 1; i >= 1; i--) {
    const dt = finAttribDetail(d.snaps[i - 1], d.snaps[i]);
    dt.rows.forEach(r => cands.push({ key: d.snaps[i].date + '|' + r.id, date: d.snaps[i].date, name: r.name, cur: r.cur, v: r.dBase, remain: r.balBase - r.subSum }));
  }
  return cands;
}
function finAttrDetailHTML(d) {
  // 归因明细渲染：按日期倒序 · 每账户行可展开细节面板（自动汇率拆分 + 手动细节 + 自动兜底 + 横向转账关联）
  const reasons = d.reasons || [];
  const cands = finLinkCands(d);
  const candMap = {};
  cands.forEach(c => candMap[c.key] = `${c.date.slice(5)} · ${c.name}（${c.cur} ${c.v >= 0 ? '+' : '-'}${Math.abs(c.v).toFixed(0)}）`);
  const open = (S.fin.attrOpen && S.fin.attrOpen.rows) || {};
  const days = (S.fin.attrOpen && S.fin.attrOpen.days) || new Set();
  let html = '';
  for (let i = d.snaps.length - 1; i >= 1; i--) {
    const s = d.snaps[i], p = d.snaps[i - 1];
    const dt = finAttribDetail(p, s);
    if (!dt.rows.length && !dt.global.length) continue;
    const dayOpen = days.has(s.date);
    html += `<div class="attr-day ${dayOpen ? 'open' : ''}">
      <div class="attr-day-h" data-daytg="${esc(s.date)}" role="button" tabindex="0"><span class="attr-day-caret">${dayOpen ? '▾' : '▸'}</span> 📅 ${esc(s.date)}${s.note ? ' · <span style="color:var(--text-dim)">' + esc(s.note) + '</span>' : ''}<span class="attr-day-n">${dt.rows.length} 账户${dt.global.length ? ' · ' + dt.global.length + ' 聚合' : ''}</span></div>
      ${dayOpen ? dt.rows.map(r => {
        const key = s.date + '|' + r.id;
        const isOpen = !!open[key];
        const opts = reasons.map(x => `<option value="${esc(x)}" ${r.why === x ? 'selected' : ''}>${esc(x)}</option>`).join('')
          + (r.why && !reasons.includes(r.why) ? `<option value="${esc(r.why)}" selected>${esc(r.why)}</option>` : '')
          + `<option value="__auto__" ${!r.why ? 'selected' : ''}>⚙ 自动：${esc(r.origWhy)}</option>`;
        const subCats = reasons.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('')
          + `<option value="横向转账">🔁 横向转账</option><option value="汇率变动">💱 汇率变动</option>`;
        const linkOpts = `<option value="">选择关联变动…</option>`
          + cands.filter(c => c.key !== key).map(c => `<option value="${c.key}" data-remain="${c.remain}">${candMap[c.key]}</option>`).join('');
        return `<div class="attr-drow">
          <span class="attr-dname" title="${esc(r.name)}">${esc(r.name)}</span>
          <span class="attr-dcur">${esc(r.cur)}</span>
          <span class="attr-dval ${r.dBase >= 0 ? 'up' : 'down'}">${r.dBase >= 0 ? '+' : '-'}${finFmt(Math.abs(r.dBase), d.base)}</span>
          <select class="input attr-sel" data-attrwhy="1" data-date="${esc(s.date)}" data-id="${esc(r.id)}" data-prev="${esc(r.why)}" style="width:168px;">${opts}</select>
          <button class="btn sm soft attr-subtg" data-subtg="${key}">${isOpen ? '− 细节' : '＋ 细节'}</button>
        </div>
        ${isOpen ? `<div class="attr-subbox">
          ${Math.abs(r.exch) > 0.005 ? `<div class="attr-sub auto"><span class="sub-why">💱 汇率变动（自动）</span><span class="sub-v ${r.exch >= 0 ? 'up' : 'down'}">${r.exch >= 0 ? '+' : '-'}${finFmt(Math.abs(r.exch), d.base)}</span></div>` : ''}
          ${r.subs.map(s2 => {
            const lkN = s2.linkDate ? (candMap[s2.linkDate + '|' + s2.linkId] || ('🔗 ' + s2.linkDate + ' · ' + s2.linkId)) : '';
            return `<div class="attr-sub"><span class="sub-why">${esc(s2.why)}${lkN ? ' <span class="sub-link">🔗 ' + esc(lkN) + '</span>' : ''}</span>
              <span class="sub-v ${s2.v >= 0 ? 'up' : 'down'}">${s2.v >= 0 ? '+' : '-'}${finFmt(Math.abs(s2.v), d.base)}</span>
              <button class="btn sm soft mini" data-subdel="${key}|${esc(s2.id)}">✕</button></div>`;
          }).join('')}
          <div class="attr-sub fb"><span class="sub-why">⚙ 自动兜底：${esc(r.origWhy)}</span><span class="sub-v ${r.fallback >= 0 ? 'up' : 'down'}">${r.fallback >= 0 ? '+' : '-'}${finFmt(Math.abs(r.fallback), d.base)}</span></div>
          <div class="attr-sub add">
            <select class="input sub-cat" data-subcat="${key}">${subCats}</select>
            <input class="input" type="number" step="any" min="0" data-subval="${key}" placeholder="金额" style="width:104px;">
            <label class="attr-last" data-lastwrap="${key}" style="display:none;"><input type="checkbox" data-sublast="${key}" data-remain="${Math.abs(r.fallback).toFixed(2)}"> 最后一个关联账户</label>
            <span class="attr-last-note" data-lastnote="${key}" style="display:none;">自动填充关联方金额</span>
            <select class="input sub-link" data-sublink="${key}" style="display:none;max-width:230px;">${linkOpts}</select>
            <button class="btn sm" data-subadd="${key}">＋ 添加</button>
          </div>
        </div>` : ''}`;
      }).join('') : ''}
      ${dayOpen ? dt.global.map(g => `<div class="attr-drow global"><span class="attr-dname">${esc(g.k)}</span><span class="attr-dcur"></span><span class="attr-dval ${g.v >= 0 ? 'up' : 'down'}">${g.v >= 0 ? '+' : '-'}${finFmt(Math.abs(g.v), d.base)}</span><span class="attr-dfix">聚合变动 · 仅展示</span></div>`).join('') : ''}
    </div>`;
  }
  return html || '<div class="fin-note" style="padding:10px;">暂无显著变动明细</div>';
}
function finCurveAttribution(prev, s, fxNow, isLast) {
  // 曲线口径归因：汇率口径与曲线完全一致（最新点用当前汇率），阈值 0.01，残差按曲线差值兜底
  // 保证勾选全部归因后 exclSum == 曲线每段变动，扣除后曲线严格水平
  const out = {};
  const TH = 0.01;
  const add = (k, v) => { if (Math.abs(v) > TH) out[k] = (out[k] || 0) + v; };
  const prevMap = {};
  (prev.accts || []).forEach(a => prevMap[a.id] = a);
  (s.accts || []).forEach(a => {
    const p = prevMap[a.id];
    const fxT = s.fx && s.fx[a.cur] != null ? s.fx[a.cur] : 1;
    const fxP = p && prev.fx && prev.fx[a.cur] != null ? prev.fx[a.cur] : fxT;
    const vT = a.val || 0, vP = p ? (p.val || 0) : 0;
    const dBase = vT * fxT - vP * fxP;
    if (Math.abs(dBase) <= TH) return;
    const origWhy = a.why || (!p ? '新增账户' : '日常变动');
    const exch = vP * (fxT - fxP);
    const balBase = dBase - exch;
    const subs = (a.subs || []).filter(s2 => Math.abs(s2.v) > TH);
    const subSum = subs.reduce((s2, x) => s2 + x.v, 0);
    const fallback = balBase - subSum;
    if (Math.abs(exch) > TH) add('汇率变动', exch);
    subs.forEach(s2 => { if (s2.why !== '横向转账') add(s2.why, s2.v); });
    if (Math.abs(fallback) > TH) add(origWhy, fallback);
  });
  return out;
}
function finCurveDataExcl(d, obj, spanDays, exclSet) {
  const cutoff = spanDays ? fmtDate(new Date(Date.now() - spanDays * 864e5)) : null;
  const lastDate = d.snaps.length ? d.snaps[d.snaps.length - 1].date : null;
  const pts = [];
  let exclSum = 0, prev = null;
  d.snaps.forEach(s => {
    if (!s.accts || !s.accts.length) return;
    if (cutoff && s.date < cutoff) return;
    const isLast = s.date === lastDate;
    const rate = c => s.fx && s.fx[c] != null ? s.fx[c] : (d.fx[c] != null ? d.fx[c] : 1);
    let val = 0;
    if (obj === 'all') val = s.accts.reduce((sum, a) => sum + (a.val || 0) * rate(a.cur), 0);
    else if (obj.startsWith('grp:')) {
      const gid = obj.slice(4);
      val = s.accts.filter(a => { const acc = d.accounts.find(x => x.id === a.id); return acc && (acc.group || 'ungrouped') === gid; })
        .reduce((sum, a) => sum + (a.val || 0) * rate(a.cur), 0);
    } else {
      const a = s.accts.find(x => x.id === obj.slice(5));
      val = a ? (a.val || 0) * rate(a.cur) : 0;
    }
    if (exclSet && exclSet.size && prev && prev.accts && prev.accts.length) {
      const attr = finCurveAttribution(prev, s, d.fx, isLast);
      Object.keys(attr).forEach(k => { if (exclSet.has(k)) exclSum += attr[k]; });
    }
    pts.push({ date: s.date, val: val - exclSum });
    prev = s;
  });
  return pts;
}
function finPieSVG(box, items, base, title) {
  if (!items.length) { box.innerHTML = '<div class="empty" style="padding:20px;"><span class="e-icon">🥧</span>该方向无变动</div>'; return; }
  const total = items.reduce((s2, x) => s2 + x.v, 0) || 1;
  const R = 66, cx = 78, cy = 78;
  const palette = ['#58c9a0', '#7fa8d9', '#ffb454', '#c89be0', '#ff8fa3', '#8fbf9a', '#f2c94c', '#6cc7d4', '#f0988a', '#a3b8d8'];
  let a0 = -Math.PI / 2;
  const segs = items.map(x => { const a1 = a0 + x.v / total * Math.PI * 2; const s2 = { k: x.k, v: x.v, a0, a1 }; a0 = a1; return s2; });
  const isFull = s2 => s2.a1 - s2.a0 >= Math.PI * 2 - 1e-9;
  const path = s2 => {
    const large = s2.a1 - s2.a0 > Math.PI ? 1 : 0;
    const x0 = cx + R * Math.cos(s2.a0), y0 = cy + R * Math.sin(s2.a0);
    const x1 = cx + R * Math.cos(s2.a1), y1 = cy + R * Math.sin(s2.a1);
    return `M ${cx} ${cy} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
  };
  const seg = (s2, i) => isFull(s2)
    ? `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${palette[i % palette.length]}" stroke="#fff" stroke-width="1.5"></circle>`
    : `<path d="${path(s2)}" fill="${palette[i % palette.length]}" stroke="#fff" stroke-width="1.5"></path>`;
  const rows = items.map((x, i) => `<div class="attrib-row pie-legend-row" data-pie-key="${esc(x.k)}" role="button" tabindex="0" title="点击查看该归因的来源明细">
      <span class="pi-dot" style="background:${palette[i % palette.length]}"></span>
      <span class="pie-legend-name">${esc(x.k)}</span>
      <span class="up">${finFmt(x.v, base)} · ${(x.v / total * 100).toFixed(1)}%</span>
    </div>`).join('');
  box.innerHTML = `
    <div class="pie-head">${title}（合计 ${finFmt(total, base)}）</div>
    <div class="pie-body">
      <svg viewBox="0 0 156 156" class="pie-svg">
        ${segs.map(seg).join('')}
        <text x="78" y="80" text-anchor="middle" font-size="12" font-weight="700" fill="#2b3440">${items.length} 项</text>
      </svg>
      <div class="pie-legend">${rows}</div>
    </div>`;
}
/* ---- 折线图通用：拟合曲线 + 节点 tooltip/常显 ---- */
function finSmoothPath(pts, x, y, getV) {
  // Catmull-Rom → 三次贝塞尔平滑曲线（穿过所有节点）
  const gv = typeof getV === 'function' ? getV : p => p.val;
  if (pts.length < 3) return null;
  let d = `M ${x(0).toFixed(1)} ${y(gv(pts[0])).toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const i0 = Math.max(0, i - 1), i1 = i, i2 = Math.min(pts.length - 1, i + 1), i3 = Math.min(pts.length - 1, i + 2);
    const c1x = x(i1) + (x(i2) - x(i0)) / 6;
    const c1y = y(gv(pts[i1])) + (y(gv(pts[i2])) - y(gv(pts[i0]))) / 6;
    const c2x = x(i2) - (x(i3) - x(i1)) / 6;
    const c2y = y(gv(pts[i2])) - (y(gv(pts[i3])) - y(gv(pts[i1]))) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${x(i2).toFixed(1)} ${y(gv(pts[i2])).toFixed(1)}`;
  }
  return d;
}
function finPolyFit(pts, degree, getV) {
  // 最小二乘多项式拟合（正规方程 + 高斯消元），x 归一化到 [0,1]
  // getV 允许折线图（val）与汇率图（rate）复用同一套拟合/平滑实现
  const gv = typeof getV === 'function' ? getV : p => p.val;
  const n = pts.length;
  const xs = pts.map((_, i) => n === 1 ? 0 : i / (n - 1));
  const ys = pts.map(gv);
  const m = degree + 1;
  const a = Array.from({ length: m }, () => new Array(m).fill(0));
  const b = new Array(m).fill(0);
  for (let i = 0; i < n; i++) {
    const t = xs[i];
    for (let r = 0; r < m; r++) {
      const tp = Math.pow(t, r);
      b[r] += tp * ys[i];
      for (let c = 0; c < m; c++) a[r][c] += tp * Math.pow(t, c);
    }
  }
  for (let col = 0; col < m; col++) {
    let piv = col;
    for (let r = col + 1; r < m; r++) if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r;
    if (Math.abs(a[piv][col]) < 1e-12) return new Array(m).fill(0);
    [a[col], a[piv]] = [a[piv], a[col]]; [b[col], b[piv]] = [b[piv], b[col]];
    for (let r = col + 1; r < m; r++) {
      const f = a[r][col] / a[col][col];
      for (let c = col; c < m; c++) a[r][c] -= f * a[col][c];
      b[r] -= f * b[col];
    }
  }
  const co = new Array(m).fill(0);
  for (let r = m - 1; r >= 0; r--) {
    let s = b[r];
    for (let c = r + 1; c < m; c++) s -= a[r][c] * co[c];
    co[r] = a[r][r] ? s / a[r][r] : 0;
  }
  return co;
}
function finPolyPath(pts, xIdx, yt, degree, getV, forecast) {
  // 多项式拟合曲线路径；xIdx: 扩展后的索引→x像素（forecast 天按 1 天 1 格等距外推）
  const n = pts.length;
  if (n < 2) return null;
  const deg = Math.max(1, Math.min(degree || 3, n - 1));
  const co = finPolyFit(pts, deg, getV);
  const extra = Math.max(0, parseInt(forecast, 10) || 0);
  const total = n - 1 + extra;
  const seg = 18;
  const steps = Math.max(1, total * seg);
  let d = '';
  for (let k = 0; k <= steps; k++) {
    const j = total * k / steps;
    const t = j / (n - 1);
    let v = 0; for (let r = 0; r <= deg; r++) v += co[r] * Math.pow(t, r);
    d += (k ? ' L ' : 'M ') + xIdx(j).toFixed(1) + ' ' + yt(v).toFixed(1);
  }
  return d;
}
function finFitPath(pts, xIdx, y, fit, getV, forecast) {
  const gv = typeof getV === 'function' ? getV : p => p.val;
  if (fit === 'smooth') return finSmoothPath(pts, xIdx, y, gv);
  const deg = /^poly[1-6]$/.test(String(fit || '')) ? parseInt(String(fit).slice(4), 10) : 3;
  return finPolyPath(pts, xIdx, y, deg, gv, forecast);
}
function finFitDegree(fit) {
  return /^poly[1-6]$/.test(String(fit || '')) ? parseInt(String(fit).slice(4), 10) : 3;
}
function finForecastVals(pts, fit, getV, forecast) {
  // 预测值：沿用实际点的拟合系数，在最后实际点之后按 1 天 1 格外推
  const n = pts.length;
  const extra = Math.max(0, parseInt(forecast, 10) || 0);
  if (n < 2 || !extra) return [];
  const deg = Math.max(1, Math.min(finFitDegree(fit), n - 1));
  const gv = typeof getV === 'function' ? getV : p => p.val;
  const co = finPolyFit(pts, deg, gv);
  const out = [];
  for (let j = n; j < n + extra; j++) {
    const t = j / (n - 1);
    let v = 0; for (let r = 0; r <= deg; r++) v += co[r] * Math.pow(t, r);
    out.push(v);
  }
  return out;
}
function finAddDays(dateStr, days) {
  const d = new Date(String(dateStr || '') + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + (parseInt(days, 10) || 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function bindChartTip(box, W, H) {
  // 节点悬浮 tooltip（SVG viewBox 坐标 → 容器像素）
  // 定位：默认显示在节点右上方；右侧或顶部空间不足时翻到节点左侧/下方，
  //      并把最终位置夹在视口内，避免靠右节点把数值顶出屏幕。
  if (!box) return;
  const svg = box.querySelector('svg');
  if (!svg) return;
  box.style.position = 'relative';
  let tip = box.querySelector('.fin-tip');
  if (!tip) { tip = document.createElement('div'); tip.className = 'fin-tip'; tip.style.display = 'none'; box.appendChild(tip); }
  box.onmousemove = e => {
    const nd = e.target.closest ? e.target.closest('.fin-node') : null;
    if (!nd) { tip.style.display = 'none'; return; }
    const brect = box.getBoundingClientRect();
    const srect = svg.getBoundingClientRect();
    const scale = Math.min(srect.width / W, srect.height / H) || 1;
    const offX = (srect.width - W * scale) / 2, offY = (srect.height - H * scale) / 2;
    const vx = (e.clientX - srect.left - offX) / scale;
    const vy = (e.clientY - srect.top - offY) / scale;
    const ax = (vx / W) * srect.width + (srect.left - brect.left);
    const ay = (vy / H) * srect.height + (srect.top - brect.top);
    tip.textContent = nd.dataset.tip;
    tip.style.display = 'block';
    tip.style.visibility = 'hidden';
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    const gap = 14, edge = 8;
    // 水平：优先右侧；右侧放不下就翻到左侧；两侧都放不下时夹在视口内
    let leftV = brect.left + ax + gap;
    if (leftV + tw > vw - edge) leftV = brect.left + ax - gap - tw;
    leftV = Math.max(edge, Math.min(vw - tw - edge, leftV));
    // 垂直：优先节点上方；顶部放不下就放到下方
    let topV = brect.top + ay - th - 10;
    if (topV < edge) topV = brect.top + ay + gap;
    topV = Math.max(edge, Math.min(vh - th - edge, topV));
    tip.style.left = (leftV - brect.left) + 'px';
    tip.style.top = (topV - brect.top) + 'px';
    tip.style.visibility = 'visible';
  };
  box.onmouseleave = () => { tip.style.display = 'none'; };
}
function finFxPts(d, c) {
  // 汇率波动数据：按 finRateView 方向口径输出（RUB 等 1 外币 < 1 本位币的币种反转为「1 本位币 = ? 外币」）
  const raw = (d.fxHist && d.fxHist[c]) || [];
  if (finRateView(d, c).dir === 'rev') return raw.map(p => ({ date: p.date, rate: p.rate > 0 ? 1 / p.rate : p.rate }));
  return raw;
}
function finFxSVG(box, pts, c, cfg) {
  cfg = cfg || {};
  if (pts.length < 2) {
    box.innerHTML = '<div class="empty" style="padding:16px;"><span class="e-icon">💱</span>' + (pts.length ? '汇率记录不足 2 天，暂无法连线' : '暂无汇率记录 —— 在「设置」获取官方汇率后，每日自动记录') + '</div>';
    return;
  }
  const W = 760, H = 170, padL = 64, padR = 12, padT = 16, padB = 28;
  const dir = cfg.dir || 'fwd';
  const decimals = dir === 'rev' ? 3 : 4;
  const unit = dir === 'rev' ? `1 ${cfg.base || ''} =` : `1 ${c} =`;
  const mode = ['curve', 'line', 'fit'].includes(String(cfg.mode)) ? cfg.mode : 'fit';
  const forecast = mode === 'fit' ? Math.max(0, parseInt(cfg.forecast, 10) || 0) : 0;
  const vals = pts.map(p => p.rate);
  const fVals = mode === 'fit' ? finForecastVals(pts, cfg.fit, p => p.rate, forecast) : [];
  const allVals = vals.concat(fVals);
  const min = Math.min(...allVals), max = Math.max(...allVals);
  const span = Math.max(1e-6, max - min);
  const total = pts.length - 1 + forecast;
  const xIdx = j => padL + (W - padL - padR) * j / Math.max(1, total);
  const y = v => padT + (H - padT - padB) * (1 - (v - min) / span);
  const line = pts.map((p, i) => `${xIdx(i)},${y(p.rate)}`).join(' ');
  const fitPath = mode === 'fit'
    ? finFitPath(pts, xIdx, y, cfg.fit, p => p.rate, forecast)
    : mode === 'curve'
      ? finSmoothPath(pts, xIdx, y, p => p.rate)
      : null;
  const color = vals[vals.length - 1] >= vals[0] ? '#58c9a0' : '#ff6f95';
  const fmtVal = v => Number(v.toFixed(decimals));
  const lastDate = pts[pts.length - 1].date;
  const fPts = fVals.map((v, k) => ({ date: finAddDays(lastDate, k + 1), val: v, j: pts.length + k }));
  box.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      ${[0, .5, 1].map(f => `<line x1="${padL}" y1="${y(min + span * f)}" x2="${W - padR}" y2="${y(min + span * f)}" stroke="rgba(var(--accent-rgb),.12)" stroke-dasharray="4 5"></line>`).join('')}
      ${fitPath
        ? `<path d="${fitPath}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path>`
        : `<polyline points="${line}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></polyline>`}
      <text x="${W - padR}" y="${padT + 6}" text-anchor="end" font-size="12" font-weight="700" fill="${color}">最新 ${fmtVal(pts[pts.length - 1].rate)} ${unit} · ${pts[pts.length - 1].date.slice(5)}</text>
      ${pts.filter((_, i) => i % Math.max(1, Math.ceil(pts.length / 8)) === 0).map((p, i) => `<text x="${xIdx(i * Math.ceil(pts.length / 8))}" y="${H - 9}" text-anchor="middle" font-size="10.5" fill="#a08496">${p.date.slice(5)}</text>`).join('')}
      ${forecast ? `<text x="${xIdx(total)}" y="${H - 9}" text-anchor="middle" font-size="10.5" fill="#17aeb8">${finAddDays(lastDate, forecast).slice(5)}</text>` : ''}
      <text x="${padL - 5}" y="${y(max) + 4}" text-anchor="end" font-size="10.5" fill="#a08496">${fmtVal(max)}</text>
      <text x="${padL - 5}" y="${y(min) + 4}" text-anchor="end" font-size="10.5" fill="#a08496">${fmtVal(min)}</text>
      ${pts.map((p, i) => `
        <circle class="fin-node" cx="${xIdx(i)}" cy="${y(p.rate)}" r="12" fill="transparent" data-tip="${p.date} · ${unit} ${fmtVal(p.rate)}" data-px="${xIdx(i)}" data-py="${y(p.rate)}"></circle>
        <circle cx="${xIdx(i)}" cy="${y(p.rate)}" r="3.6" fill="${color}" stroke="#fff" stroke-width="1.2"></circle>
        ${cfg.labels ? `<text x="${xIdx(i)}" y="${y(p.rate) - 9}" text-anchor="middle" font-size="10" font-weight="700" fill="${color}">${fmtVal(p.rate)}</text>` : ''}`).join('')}
      ${fPts.map(p => `
        <circle class="fin-node fin-forecast-node" cx="${xIdx(p.j)}" cy="${y(p.val)}" r="12" fill="transparent" data-tip="${p.date} · ${unit} ${fmtVal(p.val)}" data-px="${xIdx(p.j)}" data-py="${y(p.val)}"></circle>
        <circle cx="${xIdx(p.j)}" cy="${y(p.val)}" r="3.6" fill="#17b9c5" stroke="#fff" stroke-width="1.2"></circle>
        ${cfg.labels ? `<text x="${xIdx(p.j)}" y="${y(p.val) - 9}" text-anchor="middle" font-size="10" font-weight="700" fill="#17b9c5">${fmtVal(p.val)}</text>` : ''}`).join('')}
    </svg>`;
  bindChartTip(box, W, H);
}

/* ---------- 仪表盘（增强版） ---------- */
function finDash(body, d) {
  if (!S.fin) S.fin = {};
  const c = finCalc(d);
  const snaps = d.snaps;
  const last = snaps.length ? snaps[snaps.length - 1] : null;
  const todaySnap = snaps.length && snaps[snaps.length - 1].date === fmtDate(new Date()) ? snaps[snaps.length - 1] : null;
  const prev = snaps.length > 1 ? snaps[snaps.length - 2] : null;
  const dNet = last && prev ? last.net - prev.net : 0;
  const mStart = snaps.filter(x => x.date >= fmtDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))[0];
  const mNet = mStart ? (last ? last.net : 0) - mStart.net : 0;
  // 币种敞口（与 finCalc 同口径：理财账户按持仓币种分布）
  const curMap = {};
  d.accounts.forEach(a => {
    if (finAcctHoldings(d, a.id).length) {
      finAcctHoldings(d, a.id).forEach(h => curMap[h.cur] = (curMap[h.cur] || 0) + finToBase(d, h.value, h.cur));
    } else {
      curMap[a.cur] = (curMap[a.cur] || 0) + finToBase(d, a.balance, a.cur);
    }
  });
  d.inv.holdings.forEach(h => { if (!h.acctId) curMap[h.cur] = (curMap[h.cur] || 0) + finToBase(d, h.value, h.cur); });
  d.reals.forEach(a => curMap[a.cur] = (curMap[a.cur] || 0) + finToBase(d, a.value, a.cur));
  d.liabs.forEach(l => curMap[l.cur] = (curMap[l.cur] || 0) - finToBase(d, l.remain, l.cur));
  const curRows = Object.keys(curMap).filter(k => Math.abs(curMap[k]) > 0.01).sort((a, b) => Math.abs(curMap[b]) - Math.abs(curMap[a]));
  const maxCur = Math.max(1, ...curRows.map(k => Math.abs(curMap[k])));
  // 资产曲线（支持排除指定归因）
  if (!S.fin.curve) {
    const p = finChartPrefs().curve || {};
    S.fin.curve = { obj: 'all', span: 30, excl: {}, mode: p.mode || 'fit',
      fit: p.fit || 'poly3', forecast: Number(p.forecast) || 0 };
  }
  if (!['curve', 'line', 'fit'].includes(String(S.fin.curve.mode))) S.fin.curve.mode = 'fit';
  if (S.fin.curve.labels == null) S.fin.curve.labels = false;
  if (!/^poly[1-6]$/.test(String(S.fin.curve.fit || ''))) S.fin.curve.fit = 'poly3';
  S.fin.curve.forecast = Math.max(0, parseInt(S.fin.curve.forecast, 10) || 0);
  const curve = S.fin.curve;
  const exclSet = new Set(Object.keys(curve.excl || {}).filter(k => curve.excl[k]));
  const attribKeys = finAttribKeys(d);
  const objOpts = [['all', '全部账户'], ...(d.acctGroups || []).map(g => ['grp:' + g.id, '👥 ' + g.name]), ...d.accounts.map(a => ['acct:' + a.id, '🏦 ' + a.name])];
  const cvPts = finCurveDataExcl(d, curve.obj, parseInt(curve.span) || 0, exclSet);
  // 净资产变动归因（可设区间）
  if (!S.fin.attrib) S.fin.attrib = { from: '', to: '' };
  const acfg = S.fin.attrib;
  const attrFrom = acfg.from || (snaps.length ? snaps[0].date : '');
  const attrTo = acfg.to || (snaps.length ? snaps[snaps.length - 1].date : '');
  const hasAttr = !!(last && prev);
  const snapDates = snaps.map(s => s.date).filter(Boolean).sort();
  const snapMin = snapDates.length ? snapDates[0] : '';
  const snapMax = snapDates.length ? snapDates[snapDates.length - 1] : '';
  const attrAcc = finAttribRange(d, acfg.from || null, acfg.to || null);
  const attrRows = Object.entries(attrAcc).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const pos = attrRows.filter(x => x[1] > 0.005).map(([k, v]) => ({ k, v }));
  const neg = attrRows.filter(x => x[1] < -0.005).map(([k, v]) => ({ k, v: -v }));
  // 汇率波动（刷新汇率时按日记录）
  if (!S.fin.fxhist) {
    const p = finChartPrefs().fxhist || {};
    S.fin.fxhist = { cur: '', from: '', to: '', mode: p.mode || 'fit',
      fit: p.fit || 'poly3', forecast: Number(p.forecast) || 0 };
  }
  if (!['curve', 'line', 'fit'].includes(String(S.fin.fxhist.mode))) S.fin.fxhist.mode = 'fit';
  if (S.fin.fxhist.labels == null) S.fin.fxhist.labels = false;
  if (!/^poly[1-6]$/.test(String(S.fin.fxhist.fit || ''))) S.fin.fxhist.fit = 'poly3';
  S.fin.fxhist.forecast = Math.max(0, parseInt(S.fin.fxhist.forecast, 10) || 0);
  const fxh = S.fin.fxhist;
  const fxCodes = Object.keys(d.fx).filter(k => k !== d.base);
  if (!fxh.cur || !fxCodes.includes(fxh.cur)) fxh.cur = fxCodes[0] || '';
  const fxPts = finFxPts(d, fxh.cur).filter(p => (!fxh.from || p.date >= fxh.from) && (!fxh.to || p.date <= fxh.to));
  const fxhPts = d.fxHist && d.fxHist[fxh.cur] ? d.fxHist[fxh.cur] : [];
  const fxhFrom = fxh.from || (fxhPts.length ? fxhPts[0].date : '');
  const fxhTo = fxh.to || (fxhPts.length ? fxhPts[fxhPts.length - 1].date : '');
  body.innerHTML = `
    <div class="fin-stats">
      <div class="fin-stat main"><div class="fin-label">净资产</div><div class="fin-num">${finFmt(c.net, d.base)}</div>
        <div class="fin-delta ${dNet >= 0 ? 'up' : 'down'}">${last ? (dNet >= 0 ? '▲' : '▼') + finFmt(Math.abs(dNet), d.base) + ' vs 上日' : '尚无快照'}</div></div>
      <div class="fin-stat"><div class="fin-label">总资产</div><div class="fin-num">${finFmt(c.total, d.base)}</div></div>
      <div class="fin-stat"><div class="fin-label">总负债</div><div class="fin-num">${finFmt(c.liab, d.base)}</div></div>
      <div class="fin-stat"><div class="fin-label">本月净变动</div><div class="fin-num ${mNet >= 0 ? 'up' : 'down'}">${mNet >= 0 ? '+' : ''}${finFmt(mNet, d.base)}</div></div>
    </div>
    ${todaySnap ? `<div class="fin-todaybar">📸 今日快照已保存（${todaySnap.mode === 'quick' ? '快速模式' : '逐账户填报'}）${todaySnap.note ? ' · 备注：' + esc(todaySnap.note) : ''}</div>`
      : `<div class="fin-todaybar warn">今日尚未保存快照 —— 去「每日快照」更新一下</div>`}
    <div class="gcard" style="margin-top:14px;">
      <div class="section-title"><span class="st-emoji">📉</span>账户 / 组别资产曲线</div>
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">
        <select class="input" id="cv-obj" style="width:250px;">${objOpts.map(([v, l]) => `<option value="${v}" ${curve.obj === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select class="input" id="cv-span" style="width:130px;">
          ${[['7', '近 7 天'], ['30', '近 30 天'], ['90', '近 90 天'], ['0', '全部']].map(([v, l]) => `<option value="${v}" ${String(curve.span) === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <select class="input" id="cv-mode" style="width:138px;" title="连接 / 拟合模式">
          <option value="curve" ${curve.mode === 'curve' ? 'selected' : ''}>〰️ 曲线连接</option>
          <option value="line" ${curve.mode === 'line' ? 'selected' : ''}>📏 直线连接</option>
          <option value="fit" ${curve.mode === 'fit' ? 'selected' : ''}>📈 拟合（n 阶）</option>
        </select>
        <select class="input" id="cv-fit" style="width:112px;${curve.mode === 'fit' ? '' : 'display:none;'}" title="多项式拟合阶数（1=线性）">
          ${[1,2,3,4,5,6].map(d => `<option value="poly${d}" ${curve.fit === 'poly' + d ? 'selected' : ''}>${d} 次${d === 1 ? '（线性）' : ''}</option>`).join('')}
        </select>
        <label class="pi-check" style="margin-right:0;gap:4px;">预测 <input class="input" type="number" min="0" step="1" id="cv-forecast" value="${curve.forecast}" style="width:64px;padding:4px 6px;" ${curve.mode === 'fit' ? '' : 'disabled title="仅拟合模式可预测"'}> 天</label>
        <label class="pi-check" style="margin-right:0;"><input type="checkbox" id="cv-labels" ${curve.labels ? 'checked' : ''}> 显示节点值</label>
      </div>
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-top:8px;">
        ${attribKeys.length ? attribKeys.map(k => `<label class="pi-check" style="margin:0;"><input type="checkbox" data-excl="${esc(k)}" ${exclSet.has(k) ? 'checked' : ''}> ${esc(k)}</label>`).join('') : '<span class="fin-note">（快照不足 2 个，暂无归因可扣除）</span>'}
      </div>
      <div id="cv-chart"></div>
    </div>
    <div class="gcard" style="margin-top:14px;">
      <div class="section-title"><span class="st-emoji">🌍</span>币种敞口（本位币 ${d.base}）</div>
      <div class="fin-bars">${curRows.length ? curRows.map(k => `
        <div class="fin-bar-row"><span class="fin-bar-label">${k} ${FIN_TAX[k] || ''}</span>
          <div class="fin-bar-track"><div class="fin-bar-fill" style="width:${Math.round(Math.abs(curMap[k]) / maxCur * 100)}%;background:${curMap[k] >= 0 ? '#58c9a0' : '#ff6f95'}"></div></div>
          <span class="fin-bar-val">${curMap[k] >= 0 ? '' : '-'}${finFmt(Math.abs(curMap[k]), d.base)}</span></div>`).join('')
        : '<div class="empty" style="padding:20px;"><span class="e-icon">🌐</span>暂无币种数据</div>'}
      </div>
      <div style="margin-top:12px;border-top:1px dashed rgba(var(--accent-rgb),.25);padding-top:10px;">
        <div style="font-size:12.5px;font-weight:700;margin-bottom:6px;">💱 今日汇率</div>
        <div class="fin-attrib">${Object.keys(d.fx).filter(k => k !== d.base).map(k => { const rv = finRateView(d, k); return `<div class="attrib-row"><span>1 ${rv.a} =</span><span style="font-weight:700;">${rv.val.toFixed(4)} ${rv.to}</span></div>`; }).join('')}</div>
      </div>
      <div style="margin-top:12px;border-top:1px dashed rgba(var(--accent-rgb),.25);padding-top:10px;">
        <div style="font-size:12.5px;font-weight:700;margin-bottom:6px;">📈 汇率波动（刷新官方汇率时自动记录当日 · 未刷新日期留空）</div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:6px;">
          <select class="input" id="fxh-cur" style="width:150px;">${fxCodes.map(k2 => `<option value="${k2}" ${fxh.cur === k2 ? 'selected' : ''}>${k2} ${FIN_TAX[k2] || ''}</option>`).join('')}</select>
          <input type="date" class="input" id="fxh-from" value="${fxhFrom}" style="width:150px;">
          <span class="fin-note">→</span>
          <input type="date" class="input" id="fxh-to" value="${fxhTo}" style="width:150px;">
          <select class="input" id="fxh-mode" style="width:138px;" title="连接 / 拟合模式">
            <option value="curve" ${fxh.mode === 'curve' ? 'selected' : ''}>〰️ 曲线连接</option>
            <option value="line" ${fxh.mode === 'line' ? 'selected' : ''}>📏 直线连接</option>
            <option value="fit" ${fxh.mode === 'fit' ? 'selected' : ''}>📈 拟合（n 阶）</option>
          </select>
          <select class="input" id="fxh-fit" style="width:112px;${fxh.mode === 'fit' ? '' : 'display:none;'}" title="多项式拟合阶数（1=线性）">
            ${[1,2,3,4,5,6].map(d => `<option value="poly${d}" ${fxh.fit === 'poly' + d ? 'selected' : ''}>${d} 次${d === 1 ? '（线性）' : ''}</option>`).join('')}
          </select>
          <label class="pi-check" style="margin-right:0;gap:4px;">预测 <input class="input" type="number" min="0" step="1" id="fxh-forecast" value="${fxh.forecast}" style="width:64px;padding:4px 6px;" ${fxh.mode === 'fit' ? '' : 'disabled title="仅拟合模式可预测"'}> 天</label>
          <label class="pi-check" style="margin-right:0;"><input type="checkbox" id="fxh-labels" ${fxh.labels ? 'checked' : ''}> 显示节点值</label>
          <span class="fin-note">1 ${finRateView(d, fxh.cur).a} = ? ${finRateView(d, fxh.cur).to}（RUB 按 1 ${d.base} = ? 卢布口径）</span>
        </div>
        <div id="fxh-chart"></div>
      </div>
    </div>
    <div class="gcard" style="margin-top:14px;">
      <div class="section-title"><span class="st-emoji">🔍</span>净资产变动归因</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
        <input type="date" class="input" id="attr-from" value="${attrFrom}" style="width:150px;" ${snapMin ? `min="${snapMin}" max="${snapMax}"` : ''} ${snaps.length ? '' : 'disabled'}>
        <span class="fin-note">→</span>
        <input type="date" class="input" id="attr-to" value="${attrTo}" style="width:150px;" ${snapMin ? `min="${snapMin}" max="${snapMax}"` : ''} ${snaps.length ? '' : 'disabled'}>
        <span class="fin-note" id="attr-range-note">${snaps.length ? `最早 ${snapMin} · 最新 ${snapMax}` : '暂无记录'}</span>
      </div>
      ${hasAttr ? `<div id="attr-pies" class="attr-pies">
        <div id="pie-pos"></div>
        <div id="pie-neg"></div>
      </div>
      <div id="attr-drill" class="fin-drill" style="display:none;" role="dialog" aria-label="归因来源明细">
        <div class="fin-drill-h"><b id="attr-drill-title"></b><button class="mini-btn" id="attr-drill-close" type="button">✕ 关闭</button></div>
        <div id="attr-drill-body"></div>
      </div>
      <div id="attr-detail" style="display:none;margin-top:12px;max-height:440px;overflow:auto;border-top:1px dashed rgba(var(--accent-rgb),.25);padding-top:10px;"></div>
      <div class="fin-attr-toggle-wrap"><button class="btn soft sm" id="attr-edit" aria-expanded="false">▾ 展开归因明细</button></div>`
        : `<div class="empty" style="padding:18px;"><span class="e-icon">📉</span>${snaps.length ? '至少需要 2 个快照才能计算净资产变动归因。' : '暂无记录；保存快照后可查看净资产变动归因。'}</div>`}
    </div>
    ${d.goals > 0 ? `<div class="gcard" style="margin-top:14px;">
      <div class="section-title"><span class="st-emoji">🎯</span>净资产目标</div>
      <div class="fin-prog"><div class="fin-prog-fill" style="width:${Math.min(100, Math.round(c.net / d.goals * 100))}%"></div></div>
      <div style="font-size:12.5px;color:var(--text-dim);margin-top:6px;">${finFmt(c.net, d.base)} / ${finFmt(d.goals, d.base)} · ${Math.min(100, Math.round(c.net / d.goals * 100))}%</div>
    </div>` : ''}`;
  const cvEl = $('#cv-chart'), fxhEl = $('#fxh-chart'), pEl = $('#pie-pos'), nEl = $('#pie-neg');
  const drawCurve = () => {
    if (!cvEl) return;
    const d2 = loadFin();
    const ex2 = new Set(Object.keys(S.fin.curve.excl || {}).filter(k => S.fin.curve.excl[k]));
    finLineSVG(cvEl, finCurveDataExcl(d2, S.fin.curve.obj, parseInt(S.fin.curve.span) || 0, ex2), d2.base, { mode: S.fin.curve.mode, fit: S.fin.curve.fit, labels: S.fin.curve.labels, forecast: S.fin.curve.forecast });
  };
  const drawFx = () => {
    if (!fxhEl) return;
    const d2 = loadFin();
    const f = S.fin.fxhist;
    const pts = finFxPts(d2, f.cur).filter(p => (!f.from || p.date >= f.from) && (!f.to || p.date <= f.to));
    finFxSVG(fxhEl, pts, f.cur, { mode: f.mode, fit: f.fit, labels: f.labels, forecast: f.forecast, dir: finRateView(d2, f.cur).dir, base: d2.base });
  };
  if (cvEl) finLineSVG(cvEl, cvPts, d.base, { mode: curve.mode, fit: curve.fit, labels: curve.labels, forecast: curve.forecast });
  if (fxhEl) finFxSVG(fxhEl, fxPts, fxh.cur, { mode: fxh.mode, fit: fxh.fit, labels: fxh.labels, forecast: fxh.forecast, dir: finRateView(d, fxh.cur).dir, base: d.base });
  if (pEl) finPieSVG(pEl, pos, d.base, '📈 增长来源');
  if (nEl) finPieSVG(nEl, neg, d.base, '📉 减小去向');
  // 图例下钻：点击某归因图例 → 浮层按日期分组列出该区间内组成该归因的来源
  const drillEl = $('#attr-drill'), drillBody = $('#attr-drill-body'), drillTitle = $('#attr-drill-title');
  let drillKey = '';
  const closeDrill = () => {
    drillKey = '';
    if (drillEl) drillEl.style.display = 'none';
    document.querySelectorAll('.pie-legend-row.on').forEach(x => x.classList.remove('on'));
  };
  const refreshAttrDetail = () => {
    const det = $('#attr-detail');
    if (!det) return;
    const dd = loadFin();
    const panelScroll = det.scrollTop;
    const pageY = window.scrollY;
    det.innerHTML = finAttrDetailHTML(dd);
    det.scrollTop = panelScroll;
    if (window.scrollY !== pageY) window.scrollTo(window.scrollX, pageY);
    const acc = finAttribRange(dd, acfg.from || null, acfg.to || null);
    const rows = Object.entries(acc).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    if (pEl) finPieSVG(pEl, rows.filter(x => x[1] > 0.005).map(([k, v]) => ({ k, v })), dd.base, '📈 增长来源');
    if (nEl) finPieSVG(nEl, rows.filter(x => x[1] < -0.005).map(([k, v]) => ({ k, v: -v })), dd.base, '📉 减小去向');
    closeDrill();
  };
  const placeDrill = anchor => {
    if (!drillEl || !anchor) return;
    const r = anchor.getBoundingClientRect();
    const w = drillEl.offsetWidth, h = drillEl.offsetHeight;
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    const edge = 8;
    let left = r.right + 10;
    if (left + w > vw - edge) left = r.left - w - 10;
    left = Math.max(edge, Math.min(vw - w - edge, left));
    let top = r.top;
    top = Math.max(edge, Math.min(vh - h - edge, top));
    drillEl.style.left = left + 'px';
    drillEl.style.top = top + 'px';
  };
  const showDrill = (key, rowEl) => {
    if (!drillEl || !drillBody) return;
    const groups = finAttribSourceGroups(d, attrFrom, attrTo, key);
    const grand = groups.reduce((s2, g) => s2 + g.total, 0);
    if (drillTitle) drillTitle.textContent = `🔎 ${key} · 来源明细（${attrFrom || '起'} → ${attrTo || '今'} · 合计 ${finFmt(grand, d.base)}）`;
    drillBody.innerHTML = groups.length ? groups.map(g => `
      <div class="fin-drill-day">
        <div class="fin-drill-dayh"><span>📅 ${esc(g.date)}</span><span class="${g.total >= 0 ? 'up' : 'down'}">${g.total >= 0 ? '+' : '-'}${finFmt(Math.abs(g.total), d.base)}</span></div>
        ${g.items.map(it => `<div class="fin-drill-src">
          <span class="src-nm" title="${esc(it.name)}">${esc(it.name)}</span>
          <span class="src-cur">${esc(it.cur || '—')}</span>
          <span class="src-note">${esc(it.note)}</span>
          <span class="src-v ${it.v >= 0 ? 'up' : 'down'}">${it.v >= 0 ? '+' : '-'}${finFmt(Math.abs(it.v), d.base)}</span>
        </div>`).join('')}
      </div>`).join('') : '<div class="fin-note" style="margin:4px 0;">该区间内没有可下钻的来源明细</div>';
    if (drillEl.style.display !== 'block') {
      drillEl.style.display = 'block';
      drillEl.style.left = '8px';
      drillEl.style.top = '8px';
    }
    placeDrill(rowEl);
  };
  const pieClick = e => {
    const row = e.target.closest ? e.target.closest('.pie-legend-row') : null;
    if (!row) return;
    const key = row.dataset.pieKey || '';
    if (!key) return;
    if (drillKey === key && drillEl && drillEl.style.display === 'block') { closeDrill(); return; }
    if (drillEl) drillEl.style.display = 'none';
    document.querySelectorAll('.pie-legend-row.on').forEach(x => x.classList.remove('on'));
    row.classList.add('on');
    drillKey = key;
    showDrill(key, row);
  };
  if (pEl) pEl.onclick = pieClick;
  if (nEl) nEl.onclick = pieClick;
  if (drillEl) {
    const closeBtn = $('#attr-drill-close');
    if (closeBtn) closeBtn.onclick = closeDrill;
  }
  // 扣除归因：事件委托 + 勾选后仅重绘曲线（不整体重渲染，保证即时生效）
  body.onchange = null;
  body.onchange = e => {
    const t = e.target;
    if (!t || !t.getAttribute || t.getAttribute('data-excl') == null) return;
    if (!S.fin.curve.excl) S.fin.curve.excl = {};
    S.fin.curve.excl[t.getAttribute('data-excl')] = t.checked;
    drawCurve();
  };
  const bindCh = (id, fn) => { const el = $(id); if (el) el.onchange = fn; };
  const bindCk = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
  bindCh('#cv-obj', e => { S.fin.curve.obj = e.target.value; finDash(body, loadFin()); });
  bindCh('#cv-span', e => { S.fin.curve.span = parseInt(e.target.value) || 0; finDash(body, loadFin()); });
  bindCh('#cv-mode', e => {
    S.fin.curve.mode = ['curve', 'line', 'fit'].includes(e.target.value) ? e.target.value : 'fit';
    finSaveChartPrefs();
    finDash(body, loadFin());
  });
  bindCh('#cv-fit', e => { S.fin.curve.fit = e.target.value; finSaveChartPrefs(); drawCurve(); });
  bindCh('#cv-forecast', e => {
    if (S.fin.curve.mode !== 'fit') return;
    const v = Math.max(0, parseInt(e.target.value, 10) || 0);
    S.fin.curve.forecast = v;
    if (String(e.target.value).trim() === '') e.target.value = '0';
    finSaveChartPrefs();
    drawCurve();
  });
  bindCk('#cv-labels', () => { S.fin.curve.labels = $('#cv-labels').checked; drawCurve(); });
  bindCh('#fxh-cur', e => { S.fin.fxhist.cur = e.target.value; finDash(body, loadFin()); });
  bindCh('#fxh-from', e => { S.fin.fxhist.from = e.target.value; finDash(body, loadFin()); });
  bindCh('#fxh-to', e => { S.fin.fxhist.to = e.target.value; finDash(body, loadFin()); });
  bindCh('#fxh-mode', e => {
    S.fin.fxhist.mode = ['curve', 'line', 'fit'].includes(e.target.value) ? e.target.value : 'fit';
    finSaveChartPrefs();
    finDash(body, loadFin());
  });
  bindCh('#fxh-fit', e => { S.fin.fxhist.fit = e.target.value; finSaveChartPrefs(); drawFx(); });
  bindCh('#fxh-forecast', e => {
    if (S.fin.fxhist.mode !== 'fit') return;
    const v = Math.max(0, parseInt(e.target.value, 10) || 0);
    S.fin.fxhist.forecast = v;
    if (String(e.target.value).trim() === '') e.target.value = '0';
    finSaveChartPrefs();
    drawFx();
  });
  bindCk('#fxh-labels', () => { S.fin.fxhist.labels = $('#fxh-labels').checked; drawFx(); });
  // 起止日期直接生效：改任一日期即重算并重绘归因卡片（无「应用区间」按钮）
  bindCh('#attr-from', e => { S.fin.attrib.from = e.target.value; finDash(body, loadFin()); });
  bindCh('#attr-to', e => { S.fin.attrib.to = e.target.value; finDash(body, loadFin()); });
  // 归因明细：卡片底部居中的下拉按钮，默认收起；展开/收起只切换明细区。
  bindCk('#attr-edit', () => {
    const det = $('#attr-detail'), btn = $('#attr-edit');
    if (!det) return;
    if (!S.fin.attrOpen) S.fin.attrOpen = { show: false, rows: {}, days: new Set() };
    if (!(S.fin.attrOpen.days instanceof Set)) S.fin.attrOpen.days = new Set();
    S.fin.attrOpen.show = !S.fin.attrOpen.show;
    det.style.display = S.fin.attrOpen.show ? 'block' : 'none';
    if (btn) {
      btn.textContent = S.fin.attrOpen.show ? '▴ 收起归因明细' : '▾ 展开归因明细';
      btn.setAttribute('aria-expanded', String(!!S.fin.attrOpen.show));
    }
    if (S.fin.attrOpen.show) det.innerHTML = finAttrDetailHTML(d);
  });
  const detEl = $('#attr-detail');
  if (detEl) detEl.onchange = e => {
    const cat = e.target.closest('select[data-subcat]');
    if (cat) {
      const box = cat.closest('.attr-subbox');
      const show = cat.value === '横向转账';
      const lk = box && box.querySelector('[data-sublink]');
      const wrap = box && box.querySelector('[data-lastwrap]');
      const lastEl = box && box.querySelector('[data-sublast]');
      const note = box && box.querySelector('[data-lastnote]');
      const val = box && box.querySelector('[data-subval]');
      if (lk) lk.style.display = show ? 'inline-block' : 'none';
      if (wrap) wrap.style.display = show ? 'inline-flex' : 'none';
      if (!show && lastEl) {
        lastEl.checked = false;
        if (val) { val.disabled = false; val.value = ''; val.placeholder = '金额'; }
        if (note) note.style.display = 'none';
      }
      return;
    }
    const lastEl = e.target.closest('input[data-sublast]');
    if (lastEl) {
      const box = lastEl.closest('.attr-subbox');
      const val = box && box.querySelector('[data-subval]');
      const note = box && box.querySelector('[data-lastnote]');
      const lk = box && box.querySelector('[data-sublink]');
      const opt = lk && lk.selectedOptions && lk.selectedOptions[0];
      const linked = opt ? Math.abs(parseFloat(opt.dataset.remain || '0')) : 0;
      if (lastEl.checked) {
        if (val) { val.disabled = true; val.value = (isFinite(linked) ? linked : 0).toFixed(2); val.placeholder = '自动填充关联方金额'; }
        if (note) note.style.display = 'inline';
        if (lk) lk.style.display = 'inline-block';
      } else {
        if (val) { val.disabled = false; val.value = ''; val.placeholder = '金额'; }
        if (note) note.style.display = 'none';
      }
      return;
    }
    const lkEl = e.target.closest('select[data-sublink]');
    if (lkEl) {
      const box = lkEl.closest('.attr-subbox');
      const lastEl = box && box.querySelector('[data-sublast]');
      const val = box && box.querySelector('[data-subval]');
      if (lastEl && lastEl.checked && val) {
        const opt = lkEl.selectedOptions && lkEl.selectedOptions[0];
        const linked = opt ? Math.abs(parseFloat(opt.dataset.remain || '0')) : 0;
        val.value = (isFinite(linked) ? linked : 0).toFixed(2);
      }
      return;
    }
    const sel = e.target.closest('select[data-attrwhy]');
    if (!sel) return;
    const dd = loadFin();
    let v = sel.value;
    const snap = dd.snaps.find(x => x.date === sel.dataset.date);
    if (snap && snap.accts) {
      const a = snap.accts.find(x => x.id === sel.dataset.id);
      if (a) { if (v === '__auto__') delete a.why; else a.why = v; }
    }
    saveFin(dd);
    toast(v === '__auto__' ? '已恢复自动归因 ✓' : '归因已更新并持久化 ✓', 'success');
    refreshAttrDetail();
  };
  if (detEl) detEl.onclick = e => {
    const day = e.target.closest('[data-daytg]');
    if (day) {
      if (!S.fin.attrOpen) S.fin.attrOpen = { show: true, rows: {}, days: new Set() };
      if (!(S.fin.attrOpen.days instanceof Set)) S.fin.attrOpen.days = new Set();
      const dk = day.dataset.daytg;
      if (S.fin.attrOpen.days.has(dk)) S.fin.attrOpen.days.delete(dk); else S.fin.attrOpen.days.add(dk);
      refreshAttrDetail();
      return;
    }
    const tg = e.target.closest('[data-subtg]');
    if (tg) {
      if (!S.fin.attrOpen) S.fin.attrOpen = { show: true, rows: {}, days: new Set() };
      if (!(S.fin.attrOpen.days instanceof Set)) S.fin.attrOpen.days = new Set();
      const k = tg.dataset.subtg;
      if (S.fin.attrOpen.rows[k]) delete S.fin.attrOpen.rows[k]; else S.fin.attrOpen.rows[k] = true;
      refreshAttrDetail();
      return;
    }
    const cat = e.target.closest('select[data-subcat]');
    if (cat) {
      const box = cat.closest('.attr-subbox');
      const lk = box && box.querySelector('[data-sublink]');
      if (lk) lk.style.display = cat.value === '横向转账' ? 'inline-block' : 'none';
      return;
    }
    const del = e.target.closest('[data-subdel]');
    if (del) {
      const [date, id, subId] = del.dataset.subdel.split('|');
      const dd = loadFin();
      const snap = dd.snaps.find(x => x.date === date);
      const acct = snap && snap.accts.find(x => x.id === id);
      const subs = acct && acct.subs;
      if (!subs) return;
      const idx = subs.findIndex(x => x.id === subId);
      if (idx < 0) return;
      const sub = subs[idx];
      if (sub.linkDate && sub.linkId) {   // 同步清理对方关联细节
        const oSnap = dd.snaps.find(x => x.date === sub.linkDate);
        const oAcct = oSnap && oSnap.accts.find(x => x.id === sub.linkId);
        if (oAcct && oAcct.subs) {
          const oi = oAcct.subs.findIndex(x => x.linkSubId === subId || (x.why === '横向转账' && x.linkDate === date && x.linkId === id));
          if (oi >= 0) oAcct.subs.splice(oi, 1);
        }
      }
      subs.splice(idx, 1);
      saveFin(dd);
      toast('细节已删除 ✓（兜底自动重算）', 'success');
      refreshAttrDetail();
      return;
    }
    const add = e.target.closest('[data-subadd]');
    if (add) {
      const [date, id] = add.dataset.subadd.split('|');
      const dd = loadFin();
      const si = dd.snaps.findIndex(x => x.date === date);
      const snap = dd.snaps[si], acct = snap && snap.accts.find(x => x.id === id);
      if (!acct || si < 1) return;
      const box = add.closest('.attr-subbox');
      const catEl = box.querySelector('[data-subcat]');
      const valEl = box.querySelector('[data-subval]');
      const lastEl = box.querySelector('[data-sublast]');
      const why = catEl.value;
      const isLast = !!(lastEl && lastEl.checked && why === '横向转账');
      const dt = finAttribDetail(dd.snaps[si - 1], snap);
      const r = dt.rows.find(x => x.id === id);
      if (!r) return toast('该行无可细分金额', 'warn');
      const remain = r.balBase - r.subSum;                 // 当前行带符号剩余兜底
      let ld = '', lid = '', lAcct = null, lr = null, lrRemain = 0;
      if (why === '横向转账') {
        const lk = box.querySelector('[data-sublink]').value;
        if (!lk || lk === add.dataset.subadd) return toast('请选择关联的转入/转出账户变动', 'warn');
        [ld, lid] = lk.split('|');
        const li = dd.snaps.findIndex(x => x.date === ld);
        const lSnap = dd.snaps[li]; lAcct = lSnap && lSnap.accts.find(x => x.id === lid);
        if (!lSnap || !lAcct || li < 1) return toast('关联行不存在', 'error');
        const ldt = finAttribDetail(dd.snaps[li - 1], lSnap);
        lr = ldt.rows.find(x => x.id === lid);
        if (!lr) return toast('关联行无显著变动', 'warn');
        lrRemain = lr.balBase - lr.subSum;
      }
      let vIn;
      if (isLast) {
        // 最后一项按“关联方在该笔转账中的对应金额”填充，而不是当前账户总额。
        vIn = Math.abs(lrRemain);
        if (vIn <= 0.5) return toast('关联账户已无剩余金额可填', 'warn');
      } else {
        vIn = parseFloat(valEl.value);
        if (!vIn || isNaN(vIn) || vIn <= 0) return toast('请输入有效金额', 'warn');
        if (why === '横向转账' && vIn >= Math.abs(r.balBase) - 0.01) {
          return toast('非最后一行金额必须小于该横向转账总额；如是最后一行请勾选「最后一个关联账户」', 'warn', 4200);
        }
      }
      if (Math.abs(vIn) > Math.abs(remain) + 0.01) {
        return toast(isLast
          ? `关联方对应金额 ${finFmt(vIn, dd.base)} 超过当前账户剩余 ${finFmt(Math.abs(remain), dd.base)}，无法添加`
          : '超出剩余兜底金额（剩余 ' + finFmt(Math.abs(remain), dd.base) + '）', 'warn', 4200);
      }
      const v = vIn * Math.sign(r.balBase || 1);           // 细节金额与行变动同方向（负变动行自动取负，保证兜底完备）
      if (!acct.subs) acct.subs = [];
      const sub = { id: finSubId(), why, v };
      if (why === '横向转账') {
        if (!isLast) {
          if (Math.abs(vIn) > Math.abs(lrRemain) + 0.01) return toast('关联方剩余金额不足，无法关联转账', 'warn');
        }
        const lv = vIn * Math.sign(lr.balBase || 1);       // 对方行细节按对方方向（转账双方自然符号相反）
        if (!lAcct.subs) lAcct.subs = [];
        const lsub = { id: finSubId(), why: '横向转账', v: lv, linkDate: date, linkId: id, linkSubId: sub.id };
        sub.linkDate = ld; sub.linkId = lid; sub.linkSubId = lsub.id;
        lAcct.subs.push(lsub);
      }
      acct.subs.push(sub);
      saveFin(dd);
      toast(isLast ? '最后一个关联账户已按关联方金额自动填充 ✓' : '细节已添加 ✓（兜底自动重算）', 'success');
      refreshAttrDetail();
      return;
    }
  };
  // 重渲染后恢复明细展开状态（细节修改后不丢上下文）
  if (S.fin.attrOpen && S.fin.attrOpen.show) {
    const det = $('#attr-detail'), btn = $('#attr-edit');
    if (det) { det.style.display = 'block'; det.innerHTML = finAttrDetailHTML(d); }
    if (btn) {
      btn.textContent = '▴ 收起归因明细';
      btn.setAttribute('aria-expanded', 'true');
    }
  }

}

function finLineSVG(box, pts, base, cfg) {
  cfg = cfg || {};
  if (pts.length < 2) {
    box.innerHTML = '<div class="empty" style="padding:26px;"><span class="e-icon">📉</span>' + (pts.length ? '明细快照不足 2 个，暂无法连线' : '暂无逐账户快照明细 —— 保存今日快照后开始记录') + '</div>';
    return;
  }
  const W = 760, H = 200, padL = 46, padR = 12, padT = 18, padB = 30;
  const mode = ['curve', 'line', 'fit'].includes(String(cfg.mode)) ? cfg.mode : 'fit';
  const forecast = mode === 'fit' ? Math.max(0, parseInt(cfg.forecast, 10) || 0) : 0;
  const vals = pts.map(p => p.val);
  const fVals = mode === 'fit' ? finForecastVals(pts, cfg.fit, p => p.val, forecast) : [];
  const allVals = vals.concat(fVals);
  const min = Math.min(...allVals), max = Math.max(...allVals);
  const span = Math.max(1, max - min);
  const total = pts.length - 1 + forecast;
  const xIdx = j => padL + (W - padL - padR) * j / Math.max(1, total);
  const y = v => padT + (H - padT - padB) * (1 - (v - min) / span);
  const line = pts.map((p, i) => `${xIdx(i)},${y(p.val)}`).join(' ');
  const fitPath = mode === 'fit'
    ? finFitPath(pts, xIdx, y, cfg.fit, p => p.val, forecast)
    : mode === 'curve'
      ? finSmoothPath(pts, xIdx, y, p => p.val)
      : null;
  const color = vals[vals.length - 1] >= vals[0] ? '#58c9a0' : '#ff6f95';
  const lastDate = pts[pts.length - 1].date;
  const fPts = fVals.map((v, k) => ({ date: finAddDays(lastDate, k + 1), val: v, j: pts.length + k }));
  box.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      ${[0, .5, 1].map(f => `<line x1="${padL}" y1="${y(min + span * f)}" x2="${W - padR}" y2="${y(min + span * f)}" stroke="rgba(var(--accent-rgb),.12)" stroke-dasharray="4 5"></line>`).join('')}
      <polygon points="${xIdx(0)},${y(vals[0])} ${line} ${xIdx(pts.length - 1)},${y(vals[pts.length - 1])}" fill="${color}" opacity="0.12"></polygon>
      ${fitPath
        ? `<path d="${fitPath}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path>`
        : `<polyline points="${line}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></polyline>`}
      <text x="${W - padR}" y="${padT + 6}" text-anchor="end" font-size="12" font-weight="700" fill="${color}">最新 ${finFmt(pts[pts.length - 1].val, base)} · ${pts[pts.length - 1].date.slice(5)}</text>
      ${pts.filter((_, i) => i % Math.max(1, Math.ceil(pts.length / 8)) === 0).map((p, i) =>
        `<text x="${xIdx(i * Math.ceil(pts.length / 8))}" y="${H - 10}" text-anchor="middle" font-size="10.5" fill="#a08496">${p.date.slice(5)}</text>`).join('')}
      ${forecast ? `<text x="${xIdx(total)}" y="${H - 10}" text-anchor="middle" font-size="10.5" fill="#17aeb8">${finAddDays(lastDate, forecast).slice(5)}</text>` : ''}
      <text x="${padL - 4}" y="${y(max)}" text-anchor="end" font-size="10.5" fill="#a08496">${finFmt(max, base)}</text>
      <text x="${padL - 4}" y="${y(min)}" text-anchor="end" font-size="10.5" fill="#a08496">${finFmt(min, base)}</text>
      ${pts.map((p, i) => `
        <circle class="fin-node" cx="${xIdx(i)}" cy="${y(p.val)}" r="12" fill="transparent" data-tip="${p.date} · ${finFmt(p.val, base)}" data-px="${xIdx(i)}" data-py="${y(p.val)}"></circle>
        <circle cx="${xIdx(i)}" cy="${y(p.val)}" r="3.6" fill="${color}" stroke="#fff" stroke-width="1.2"></circle>
        ${cfg.labels ? `<text x="${xIdx(i)}" y="${y(p.val) - 9}" text-anchor="middle" font-size="10" font-weight="700" fill="${color}">${finFmt(p.val, base)}</text>` : ''}`).join('')}
      ${fPts.map(p => `
        <circle class="fin-node fin-forecast-node" cx="${xIdx(p.j)}" cy="${y(p.val)}" r="12" fill="transparent" data-tip="${p.date} · ${finFmt(p.val, base)}" data-px="${xIdx(p.j)}" data-py="${y(p.val)}"></circle>
        <circle cx="${xIdx(p.j)}" cy="${y(p.val)}" r="3.6" fill="#17b9c5" stroke="#fff" stroke-width="1.2"></circle>
        ${cfg.labels ? `<text x="${xIdx(p.j)}" y="${y(p.val) - 9}" text-anchor="middle" font-size="10" font-weight="700" fill="#17b9c5">${finFmt(p.val, base)}</text>` : ''}`).join('')}
    </svg>`;
  bindChartTip(box, W, H);
}

/* ---------- 每日快照 ---------- */
function finSnapPage(body, d) {
  const snaps = d.snaps;
  const today = fmtDate(new Date());
  const tIdx = snaps.findIndex(x => x.date === today);
  const cur = tIdx >= 0 ? snaps[tIdx] : null;
  const prev = snaps.length ? (tIdx >= 0 ? (tIdx > 0 ? snaps[tIdx - 1] : null) : snaps[snaps.length - 1]) : null;
  const idxOf = (list, id) => { const a = list.find(x => x.id === id); return a ? a.val : null; };
  const defVal = a => {
    let v;
    if (idxOf((cur && cur.accts) || [], a.id) != null) v = idxOf(cur.accts, a.id);
    else if (prev && idxOf(prev.accts || [], a.id) != null) v = idxOf(prev.accts, a.id);
    else v = finAcctHoldings(d, a.id).length ? finAcctInvRaw(d, a.id) : a.balance;
    return Math.round((Number(v) || 0) * 100) / 100;
  };
  body.innerHTML = `
    <div class="gcard">
      <div class="section-title"><span class="st-emoji">📸</span>每日快照 · 逐账户填报
        <span style="font-size:12px;color:var(--text-dim);font-weight:400;">${today} · 每行默认取昨日填报值，只改有变动的即可</span></div>
      <div class="fin-table" id="snap-rows" style="margin-top:8px;">
        <div class="fin-row head"><span style="flex:1;min-width:110px;">账户</span><span style="width:34px;">币种</span><span style="width:130px;">今日余额</span><span style="flex:1;min-width:80px;">折合 ${d.base}</span><span style="width:80px;">vs 昨日</span><span style="width:122px;">变更原因</span></div>
        ${d.accounts.map(a => {
          const isInv = finAcctHoldings(d, a.id).length > 0;
          const curWhy = cur ? ((cur.accts || []).find(x => x.id === a.id) || {}).why : '';
          let whyOpts = d.reasons.map(r => `<option value="${esc(r)}" ${curWhy === r ? 'selected' : ''}>${esc(r)}</option>`).join('') + (curWhy && !d.reasons.includes(curWhy) ? `<option value="${esc(curWhy)}" selected>${esc(curWhy)}</option>` : '');
          const v = defVal(a);
          const pv = prev ? idxOf(prev.accts || [], a.id) : null;
          const delta = pv != null ? v - pv : null;
          return `<div class="fin-row">
            <span class="fr-name" style="flex:1;min-width:110px;">${esc(a.name)}${isInv ? ' · 理财' : ''}</span>
            <span class="fr-cur" style="width:34px;">${a.cur}</span>
            <input class="input" data-acct="${a.id}" type="number" step="any" value="${v}" style="width:130px;">
            <span id="eq-${a.id}" style="flex:1;min-width:80px;">≈ ${finFmt(finToBase(d, v, a.cur), d.base)}</span>
            <span class="fr-mode ${delta != null && delta < 0 ? 'down' : delta != null && delta > 0 ? 'up' : ''}" style="width:80px;">${delta != null ? (delta >= 0 ? '+' : '') + finFmt(delta, a.cur) : '—'}</span>
            <select class="input snap-why" data-why="${a.id}" style="width:122px;">${whyOpts}</select>
          </div>`;
        }).join('') || '<div class="empty" style="padding:24px;"><span class="e-icon">🏦</span>暂无账户，先去「账户」页新增</div>'}
      </div>
      <label class="field" style="margin-top:10px;">备注（大额收支 / 特殊调整，可选）<input class="input" id="snap-note" value="${cur ? esc(cur.note) : ''}"></label>
      <div style="display:flex;gap:10px;align-items:center;margin-top:10px;">
        <button class="btn" id="snap-save">保存今日快照 ✓</button>
        <button class="btn soft" id="snap-eq">⇧ 按昨日填充</button>
        ${cur ? '<span class="fin-todaybar" style="margin:0;">今日快照已保存 ✓（重新保存将覆盖）</span>' : ''}
      </div>
    </div>`;
  $('#snap-rows').oninput = e => {
    const inp = e.target.closest('input[data-acct]');
    if (!inp) return;
    const a = d.accounts.find(x => x.id === inp.dataset.acct);
    const el = a && document.getElementById('eq-' + a.id);
    if (el) el.textContent = '≈ ' + finFmt(finToBase(d, parseFloat(inp.value) || 0, a.cur), d.base);
  };
  $('#snap-eq').onclick = () => {
    if (!prev || !prev.accts) return toast('尚无昨日明细可填充', 'warn');
    prev.accts.forEach(a => { const inp = document.querySelector(`[data-acct="${a.id}"]`); if (inp) inp.value = a.val; });
    toast('已按昨日值填充 ✓', 'success');
  };
  $('#snap-save').onclick = () => {
    const dd = loadFin();
    const note = $('#snap-note').value.trim();
    const whys = {};
    document.querySelectorAll('#snap-rows select[data-why]').forEach(sel => {
      const w = sel.value;
      if (w) whys[sel.dataset.why] = w;
    });
    const vals = {};
    dd.accounts.forEach(a => {
      const inp = document.querySelector(`[data-acct="${a.id}"]`);
      if (!inp) return;
      const nv = parseFloat(inp.value);
      if (isNaN(nv) || nv < 0) return;
      vals[a.id] = Math.round(nv * 100) / 100;
      if (finAcctHoldings(dd, a.id).length) {
        const oldRaw = finAcctInvRaw(dd, a.id);
        // 输入值优先：即使差异小于 1 分，也把持仓换算值对齐到用户输入，避免 36.44 回写成 36.438147。
        if (oldRaw > 0 && Math.abs(nv - oldRaw) > 1e-9) {
          const k = nv / oldRaw;
          finAcctHoldings(dd, a.id).forEach(h => {
            if (h.cashOnly) h.value = Math.round(h.value * k * 100) / 100;
            else h.price = Math.round((h.price || 0) * k * 1e8) / 1e8;
          });
        }
      }
      a.balance = nv;
    });
    saveFin(dd);
    finSaveSnap(dd, 'detail', 0, 0, note, whys, vals);
    renderFinanceTool(ROOT); toast('今日快照已保存 ✓', 'success');
  };
}

/* ---------- 账户 ---------- */
function finAcctsPage(body, d) {
  const list = d.accounts;
  const groups = d.acctGroups || [{ id: 'ungrouped', name: '未分组' }];
  const totals = finGroupTotals(d);
  const rowOf = (a) => {
    const isInv = finAcctHoldings(d, a.id).length > 0;
    const hv = finAcctInvValue(d, a.id);
    return `
    <div class="fin-row" draggable="true" data-id="${a.id}">
      <span class="fr-name">${esc(a.name)}</span>
      <span class="fr-tag">${finAcctTypeName(d, a.type)}</span>
      <span class="fr-cur">${a.cur}</span>
      <span class="fr-net">${isInv ? finFmt(hv, d.base) : finFmt(a.balance, a.cur)}</span>
      <span style="font-size:12px;color:var(--text-dim);">${isInv ? '≈ ' + finFmt(hv, d.base) + ' · 理财汇总' : '≈ ' + finFmt(finToBase(d, a.balance, a.cur), d.base)}</span>
      <span class="fr-mode">${a.include ? '计入总资产' : '不计入'}${isInv ? ' · 挂靠持仓' : ''}</span>
      <span class="fr-ops">
        <button class="mini-btn" data-act="edit" data-id="${a.id}">编辑</button>
        <button class="mini-btn" data-act="del" data-id="${a.id}">删除</button>
      </span>
    </div>`;
  };
  body.innerHTML = `
    <div class="gcard">
      <div class="section-title"><span class="st-emoji">🏦</span>账户管理
        <button class="btn sm" id="ac-grp" style="margin-left:auto;margin-right:6px;">＋ 新增分组</button>
        <button class="btn sm" id="ac-add">＋ 新增账户</button></div>
      <div class="fin-note">💡 拖拽账户行可移动到其他分组 · 类型支持自定义</div>
      <div id="ac-groups">${groups.map((g, gi) => `
        <div class="acct-grp" data-g="${g.id}">
          <div class="ag-head">
            <span class="ag-name">${esc(g.name)}</span>
            <span class="ag-sub">${finFmt(totals[g.id] || 0, d.base)}</span>
            ${g.id !== 'ungrouped' ? `<span class="ag-ops">
              <button class="mini-btn" data-gg="ren" data-gi="${gi}">✏️ 改名</button>
              <button class="mini-btn" data-gg="del" data-gi="${gi}">🗑 删除</button></span>` : ''}
          </div>
          <div class="ag-drop">
            ${list.filter(a => (a.group || 'ungrouped') === g.id).map(rowOf).join('') || '<div class="empty" style="padding:14px;"><span class="e-icon">📭</span>拖拽账户到此分组</div>'}
          </div>
        </div>`).join('')}
      </div>
    </div>`;
  $('#ac-add').onclick = () => {
    finFormModal('新增账户', [
      { k: 'name', label: '名称', placeholder: '如：工资卡' },
      { k: 'type', label: '类型', type: 'sel', opts: finAcctTypeOpts(d), def: 'bank', custom: true, customPh: '输入新类型名称，如：学生卡' },
      { k: 'group', label: '分组', type: 'sel', opts: groups.map(g => [g.id, g.name]), def: 'ungrouped' },
      { k: 'cur', label: '币种', type: 'sel', opts: Object.keys(d.fx).map(c => [c, c]), def: d.base },
      { k: 'balance', label: '余额', def: '' },
      { k: 'date', label: '估值日期（YYYY-MM-DD）', def: fmtDate(new Date()) },
      { k: 'include', label: '计入总资产', type: 'check', def: true },
    ], null, o => {
      const dd = loadFin();
      const t = finEnsureType(dd, o.type);
      dd.accounts.push({ id: 'a' + Date.now(), name: o.name, type: t, group: o.group || 'ungrouped', cur: o.cur, balance: parseFloat(o.balance) || 0, date: o.date, include: !!o.include });
      saveFin(dd); renderFinanceTool(ROOT); toast('账户已添加 ✓', 'success');
    });
  };
  $('#ac-grp').onclick = () => finFormModal('新增分组', [
    { k: 'name', label: '组名', placeholder: '如：莫斯科日常 / 国内账户' },
  ], null, o => {
    const dd = loadFin();
    dd.acctGroups.push({ id: 'g' + Date.now(), name: o.name });
    saveFin(dd); renderFinanceTool(ROOT); toast('分组已创建 ✓', 'success');
  });
  $('#ac-groups').onclick = e => {
    const b = e.target.closest('[data-gg]');
    if (!b) return;
    const g = groups[+b.dataset.gi];
    if (b.dataset.gg === 'ren') {
      finFormModal('重命名分组', [{ k: 'name', label: '组名' }], g, o => {
        const dd = loadFin(); const it = dd.acctGroups.find(x => x.id === g.id);
        if (it) it.name = o.name; saveFin(dd); renderFinanceTool(ROOT); toast('已保存 ✓', 'success');
      });
    } else {
      if (!confirm(`删除分组「${g.name}」？组内账户将移至「未分组」`)) return;
      const dd = loadFin();
      dd.acctGroups = dd.acctGroups.filter(x => x.id !== g.id);
      dd.accounts.forEach(a => { if (a.group === g.id) a.group = 'ungrouped'; });
      saveFin(dd); renderFinanceTool(ROOT); toast('分组已删除，账户已移至未分组 ✓', 'success');
    }
  };
  $('#ac-groups').onclick = e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const a = list.find(x => x.id === b.dataset.id);
    if (!a) return;
    if (b.dataset.act === 'del') {
      if (!confirm(`删除账户「${a.name}」？`)) return;
      const dd = loadFin(); dd.accounts = dd.accounts.filter(x => x.id !== a.id); saveFin(dd); renderFinanceTool(ROOT);
    } else {
      const aIsInv = finAcctHoldings(d, a.id).length > 0;
      const aF = [
        { k: 'name', label: '名称' },
        { k: 'type', label: '类型', type: 'sel', opts: finAcctTypeOpts(d), custom: true, customPh: '输入新类型名称' },
        { k: 'group', label: '分组', type: 'sel', opts: groups.map(g => [g.id, g.name]) },
        { k: 'cur', label: '币种', type: 'sel', opts: Object.keys(d.fx).map(c => [c, c]) },
      ];
      if (!aIsInv) aF.push({ k: 'balance', label: '余额' });
      aF.push({ k: 'date', label: '估值日期' }, { k: 'include', label: '计入总资产', type: 'check' });
      finFormModal('编辑账户', aF, a, o => {
        const dd = loadFin(); const it = dd.accounts.find(x => x.id === a.id);
        if (!it) return;
        const t = finEnsureType(dd, o.type);
        const upd = { name: o.name, type: t, group: o.group || 'ungrouped', cur: o.cur, date: o.date, include: !!o.include };
        if (!aIsInv) upd.balance = parseFloat(o.balance) || 0;
        Object.assign(it, upd);
        saveFin(dd); renderFinanceTool(ROOT); toast('已保存 ✓', 'success');
      });
    }
  };
  const gbox = $('#ac-groups');
  gbox.addEventListener('dragstart', e => {
    const row = e.target.closest('.fin-row');
    if (!row) return;
    e.dataTransfer.setData('fin/acct', row.dataset.id);
    row.classList.add('dragging');
  });
  gbox.addEventListener('dragend', e => {
    if (e.target.classList) e.target.classList.remove('dragging');
    gbox.querySelectorAll('.ag-drop').forEach(x => x.classList.remove('drag-on'));
  });
  gbox.addEventListener('dragover', e => {
    const drop = e.target.closest('.ag-drop');
    if (!drop) return;
    e.preventDefault();
    drop.classList.add('drag-on');
  });
  gbox.addEventListener('dragleave', e => {
    const drop = e.target.closest('.ag-drop');
    if (drop && !drop.contains(e.relatedTarget)) drop.classList.remove('drag-on');
  });
  gbox.addEventListener('drop', e => {
    const drop = e.target.closest('.ag-drop');
    if (!drop) return;
    e.preventDefault();
    drop.classList.remove('drag-on');
    const grp = drop.closest('.acct-grp');
    const id = e.dataTransfer.getData('fin/acct');
    if (!grp || !id) return;
    const dd = loadFin();
    const it = dd.accounts.find(x => x.id === id);
    if (!it) return;
    const ng = grp.dataset.g;
    if (it.group === ng) return;
    it.group = ng;
    saveFin(dd); renderFinanceTool(ROOT); toast(`已移至「${grp.querySelector('.ag-name').textContent}」✓`, 'success');
  });
}

/* ---------- 负债 ---------- */
function finLiabsPage(body, d) {
  const list = d.liabs;
  const byKind = {};
  list.forEach(l => { const k = l.kind; byKind[k] = (byKind[k] || 0) + finToBase(d, l.remain, l.cur); });
  const maxK = Math.max(1, ...Object.values(byKind));
  body.innerHTML = `
    <div class="gcard">
      <div class="section-title"><span class="st-emoji">💳</span>负债管理（借入 / 贷款 / 信用卡 / 应付）
        <button class="btn sm" id="li-add" style="margin-left:auto;">＋ 新增负债</button></div>
      <div class="fin-bars" style="margin-bottom:12px;">${Object.keys(byKind).map(k => `
        <div class="fin-bar-row"><span class="fin-bar-label">${(FIN_LIAB_KINDS.find(x => x[0] === k) || ['', k])[1]}</span>
          <div class="fin-bar-track"><div class="fin-bar-fill" style="width:${Math.round(byKind[k] / maxK * 100)}%;background:#ff6f95"></div></div>
          <span class="fin-bar-val">${finFmt(byKind[k], d.base)}</span></div>`).join('')}
      </div>
      <div class="fin-table">${list.map((l, i) => `
        <div class="fin-row">
          <span class="fr-name">${esc(l.name)}</span>
          <span class="fr-tag">${(FIN_LIAB_KINDS.find(x => x[0] === l.kind) || ['', l.kind])[1]}</span>
          <span class="fr-cur">${l.cur}</span>
          <span class="fr-net">${finFmt(l.remain, l.cur)}</span>
          <span style="font-size:12px;color:var(--text-dim);">≈ ${finFmt(finToBase(d, l.remain, l.cur), d.base)}</span>
          ${l.rate ? `<span class="fr-mode">利率 ${l.rate}%</span>` : '<span class="fr-mode">—</span>'}
          <span class="fr-ops">
            <button class="mini-btn" data-act="edit" data-i="${i}">编辑</button>
            <button class="mini-btn" data-act="del" data-i="${i}">删除</button>
          </span>
        </div>`).join('') || '<div class="empty" style="padding:24px;"><span class="e-icon">💳</span>暂无负债记录</div>'}
      </div>
    </div>`;
  $('#li-add').onclick = () => finFormModal('新增负债', [
    { k: 'name', label: '名称', placeholder: '如：房贷 / 花呗' },
    { k: 'kind', label: '类型', type: 'sel', opts: FIN_LIAB_KINDS, def: 'loan' },
    { k: 'cur', label: '币种', type: 'sel', opts: Object.keys(d.fx).map(c => [c, c]), def: d.base },
    { k: 'principal', label: '本金', def: '' },
    { k: 'remain', label: '剩余本金', def: '' },
    { k: 'rate', label: '年利率 %', def: '' },
    { k: 'due', label: '还款日（可选）', def: '' },
    { k: 'note', label: '对手方/备注（可选）', def: '' },
  ], null, o => {
    const dd = loadFin();
    dd.liabs.push({ id: 'l' + Date.now(), name: o.name, kind: o.kind, cur: o.cur, principal: parseFloat(o.principal) || 0, remain: parseFloat(o.remain) || 0, rate: parseFloat(o.rate) || 0, due: o.due, note: o.note });
    saveFin(dd); renderFinanceTool(ROOT); toast('负债已添加 ✓', 'success');
  });
  body.querySelector('.fin-table').onclick = e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const i = +b.dataset.i, l = list[i];
    if (b.dataset.act === 'del') {
      if (!confirm(`删除负债「${l.name}」？`)) return;
      const dd = loadFin(); dd.liabs.splice(i, 1); saveFin(dd); renderFinanceTool(ROOT);
    } else {
      finFormModal('编辑负债', [
        { k: 'name', label: '名称' }, { k: 'kind', label: '类型', type: 'sel', opts: FIN_LIAB_KINDS },
        { k: 'cur', label: '币种', type: 'sel', opts: Object.keys(d.fx).map(c => [c, c]) },
        { k: 'principal', label: '本金' }, { k: 'remain', label: '剩余本金' },
        { k: 'rate', label: '年利率 %' }, { k: 'due', label: '还款日' }, { k: 'note', label: '备注' },
      ], l, o => {
        const dd = loadFin(); const it = dd.liabs.find(x => x.id === l.id);
        Object.assign(it, { name: o.name, kind: o.kind, cur: o.cur, principal: parseFloat(o.principal) || 0, remain: parseFloat(o.remain) || 0, rate: parseFloat(o.rate) || 0, due: o.due, note: o.note });
        saveFin(dd); renderFinanceTool(ROOT); toast('已保存 ✓', 'success');
      });
    }
  };
}

/* ---------- 实物资产 ---------- */
function finRealsPage(body, d) {
  const list = d.reals;
  body.innerHTML = `
    <div class="gcard">
      <div class="section-title"><span class="st-emoji">🏠</span>实物资产（低频估值 · 独立管理）
        <button class="btn sm" id="re-add" style="margin-left:auto;">＋ 新增实物</button></div>
      <div class="fin-table">${list.map((a, i) => `
        <div class="fin-row">
          <span class="fr-name">${esc(a.name)}</span>
          <span class="fr-tag">${(FIN_REAL_CATS.find(t => t[0] === a.cat) || ['', a.cat])[1]}</span>
          <span class="fr-cur">${a.cur}</span>
          <span class="fr-net">${finFmt(a.value, a.cur)}</span>
          <span style="font-size:12px;color:var(--text-dim);">≈ ${finFmt(finToBase(d, a.value, a.cur), d.base)}</span>
          <span class="fr-mode">成本 ${finFmt(a.cost, a.cur)} · 估值 ${a.date}</span>
          <span class="fr-ops">
            <button class="mini-btn" data-act="val" data-i="${i}">更新估值</button>
            <button class="mini-btn" data-act="edit" data-i="${i}">编辑</button>
            <button class="mini-btn" data-act="del" data-i="${i}">删除</button>
          </span>
        </div>`).join('') || '<div class="empty" style="padding:24px;"><span class="e-icon">🏠</span>暂无实物资产</div>'}
      </div>
    </div>`;
  $('#re-add').onclick = () => finFormModal('新增实物资产', [
    { k: 'name', label: '名称', placeholder: '如：自住房 / 车辆' },
    { k: 'cat', label: '类别', type: 'sel', opts: FIN_REAL_CATS, def: 'house' },
    { k: 'cur', label: '币种', type: 'sel', opts: Object.keys(d.fx).map(c => [c, c]), def: d.base },
    { k: 'cost', label: '购买价', def: '' },
    { k: 'value', label: '当前估值', def: '' },
    { k: 'date', label: '估值日期', def: fmtDate(new Date()) },
    { k: 'note', label: '备注（折旧/增值方式等）', def: '' },
  ], null, o => {
    const dd = loadFin();
    dd.reals.push({ id: 'r' + Date.now(), name: o.name, cat: o.cat, cur: o.cur, cost: parseFloat(o.cost) || 0, value: parseFloat(o.value) || 0, date: o.date, note: o.note });
    saveFin(dd); renderFinanceTool(ROOT); toast('已添加 ✓', 'success');
  });
  body.querySelector('.fin-table').onclick = e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const i = +b.dataset.i, a = list[i];
    const dd0 = loadFin();
    if (b.dataset.act === 'del') {
      if (!confirm(`删除「${a.name}」？`)) return;
      dd0.reals.splice(i, 1); saveFin(dd0); renderFinanceTool(ROOT);
    } else if (b.dataset.act === 'val') {
      finFormModal(`更新「${a.name}」估值`, [
        { k: 'value', label: '当前估值（' + a.cur + '）', def: a.value },
        { k: 'date', label: '估值日期', def: a.date },
      ], null, o => {
        const dd = loadFin(); const it = dd.reals.find(x => x.id === a.id);
        it.value = parseFloat(o.value) || 0; it.date = o.date;
        saveFin(dd); renderFinanceTool(ROOT); toast('估值已更新 ✓', 'success');
      });
    } else {
      finFormModal('编辑实物资产', [
        { k: 'name', label: '名称' }, { k: 'cat', label: '类别', type: 'sel', opts: FIN_REAL_CATS },
        { k: 'cur', label: '币种', type: 'sel', opts: Object.keys(d.fx).map(c => [c, c]) },
        { k: 'cost', label: '购买价' }, { k: 'value', label: '当前估值' },
        { k: 'date', label: '估值日期' }, { k: 'note', label: '备注' },
      ], a, o => {
        const dd = loadFin(); const it = dd.reals.find(x => x.id === a.id);
        Object.assign(it, { name: o.name, cat: o.cat, cur: o.cur, cost: parseFloat(o.cost) || 0, value: parseFloat(o.value) || 0, date: o.date, note: o.note });
        saveFin(dd); renderFinanceTool(ROOT); toast('已保存 ✓', 'success');
      });
    }
  };
}

/* ---------- 理财 ---------- */
function finLotModalCash(d, h) {
  const pnl = h.value - (h.cost || 0), pct = h.cost > 0 ? pnl / h.cost * 100 : 0;
  const hist = (h.vals || []).slice(-10).reverse().map(v => `<div class="fin-row"><span class="fr-date">${v.date}</span><span class="fr-net">总值 ${finNum(v.value)}</span></div>`).join('');
  const body = `
    <div style="font-size:13.5px;margin-bottom:8px;">
      <b>${esc(h.name)}</b> · 类理财（仅总值） · ${h.cur} · ${esc(finAcctName(d, h.acctId))}<br>
      <span style="color:var(--text-dim);">${h.date} 估值</span>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:10px;">
      ${[['当前总值', finFmt(h.value, h.cur)], ['基准总值', finFmt(h.cost || 0, h.cur)], ['浮动盈亏', (pnl >= 0 ? '+' : '-') + finFmt(Math.abs(pnl), h.cur)], ['收益率', finPct(pct) + '%']].map(([k, v]) => `<div style="flex:1;background:rgba(255,255,255,.5);border-radius:10px;padding:8px;text-align:center;"><div style="font-size:11px;color:var(--text-dim);">${k}</div><div style="font-weight:700;font-size:14px;">${v}</div></div>`).join('')}
    </div>
    <div class="section-title" style="font-size:13px;">📅 估值序列（最近 ${Math.min(10, (h.vals || []).length)} 条）</div>
    <div class="fin-table">${hist || '<div class="empty" style="padding:14px;">暂无估值记录</div>'}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
      <button class="btn soft sm" data-lot="total">更新总值</button>
      <button class="btn sm fj-danger" data-lot="close">全部平仓</button>
    </div>`;
  modal({ title: '持仓详情 · ' + h.name, body, actions: [{ label: '关闭', cls: 'soft', onClick: m => m.remove() }] });
  document.querySelector('#modal-root .modal').addEventListener('click', e => {
    const b = e.target.closest('[data-lot]');
    if (!b) return;
    if (b.dataset.lot === 'total') finLotTotal(d, h);
    else if (b.dataset.lot === 'close') finLotClose(d, h);
  });
}
function finLotTotal(d, h) {
  finFormModal('更新总值 · ' + h.name, [
    { k: 'value', label: '当前总值（币种金额）', def: finNum(h.value) },
    { k: 'date', label: '估值日期', def: fmtDate(new Date()) },
  ], null, o => {
    const v = parseFloat(o.value);
    if (isNaN(v) || v < 0) return toast('请输入有效总值', 'warn');
    const dd = loadFin(); const it = dd.inv.holdings.find(x => x.id === h.id);
    if (!it) return;
    it.value = Math.round(v * 100) / 100;
    it.date = o.date;
    it.vals = it.vals || [];
    it.vals.push({ date: o.date, value: it.value });
    finSyncHolding(it);
    saveFin(dd); renderFinanceTool(ROOT); toast('总值已更新 ✓（' + o.date + '）', 'success');
  });
}
function finLotModal(d, h) {
  finSyncHolding(h);
  if (h.cashOnly) { finLotModalCash(d, h); return; }
  const totalQty = finLotQty(h), totalCost = finLotCost(h), val = finHoldingVal(h);
  const pnl = val - totalCost, pct = totalCost > 0 ? pnl / totalCost * 100 : 0;
  const rows = h.lots.map(l => {
    const lv = (l.qty || 0) * (h.price || 0);
    const lp = lv - (l.cost || 0);
    return `<div class="fin-row">
      <span class="fr-date">${l.date}</span>
      <span>${finNum(l.qty)} 份</span>
      <span>买入价 ${finPx(l.px)}</span>
      <span>成本 ${finNum(l.cost)}</span>
      <span class="fr-net">市值 ${finNum(lv)}</span>
      <span class="fr-mode ${lp >= 0 ? 'up' : 'down'}">${lp >= 0 ? '+' : '-'}${finNum(Math.abs(lp))}</span>
    </div>`;
  }).join('');
  const hist = (h.vals || []).slice(-10).reverse().map(v => `<div class="fin-row"><span class="fr-date">${v.date}</span><span>单价 ${finPx(v.price)}</span><span class="fr-net">市值 ${finNum(v.value)}</span></div>`).join('');
  const body = `
    <div style="font-size:13.5px;margin-bottom:8px;">
      <b>${esc(h.name)}</b> · ${esc(h.type || '投资')} · ${h.cur} · ${esc(finAcctName(d, h.acctId))}<br>
      <span style="color:var(--text-dim);">当日单价 ${finPx(h.price)}（${h.date}）· 共 ${finNum(totalQty)} 份</span>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:10px;">
      ${[['当前市值', finFmt(val, h.cur)], ['累计成本', finFmt(totalCost, h.cur)], ['浮动盈亏', (pnl >= 0 ? '+' : '-') + finFmt(Math.abs(pnl), h.cur)], ['收益率', finPct(pct) + '%']].map(([k, v]) => `<div style="flex:1;background:rgba(255,255,255,.5);border-radius:10px;padding:8px;text-align:center;"><div style="font-size:11px;color:var(--text-dim);">${k}</div><div style="font-weight:700;font-size:14px;">${v}</div></div>`).join('')}
    </div>
    <div class="section-title" style="font-size:13px;">🧺 仓位组成（${h.lots.length} 笔 · 序列保存）</div>
    <div class="fin-table">${rows || '<div class="empty" style="padding:14px;">无仓位</div>'}</div>
    ${hist ? `<div class="section-title" style="font-size:13px;margin-top:10px;">📅 估值序列（最近 ${Math.min(10, (h.vals || []).length)} 条）</div><div class="fin-table">${hist}</div>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
      <button class="btn soft sm" data-lot="add">＋ 追加买入</button>
      <button class="btn soft sm" data-lot="sell">部分卖出</button>
      <button class="btn sm fj-danger" data-lot="close">全部平仓</button>
      <button class="btn sm" data-lot="price">更新当日单价</button>
    </div>`;
  modal({ title: '持仓详情 · ' + h.name, body, actions: [{ label: '关闭', cls: 'soft', onClick: m => m.remove() }] });
  document.querySelector('#modal-root .modal').addEventListener('click', e => {
    const b = e.target.closest('[data-lot]');
    if (!b) return;
    const act = b.dataset.lot;
    if (act === 'add') finLotAdd(d, h);
    else if (act === 'sell') finLotSell(d, h);
    else if (act === 'close') finLotClose(d, h);
    else if (act === 'price') finLotPrice(d, h);
  });
}
function finLotAdd(d, h) {
  finFormModal('追加买入 · ' + h.name, [
    { k: 'price', label: '买入单价（币种金额，8 位精度）', def: finPx(h.price), placeholder: '如：1.00860000' },
    { k: 'qty', label: '追加数量（份）', def: '', placeholder: '留空则自动 = 总成本 ÷ 单价' },
    { k: 'cost', label: '追加总成本（币种金额）', def: '', placeholder: '留空则自动 = 单价 × 数量' },
    { k: 'date', label: '买入日期', def: fmtDate(new Date()) },
  ], null, o => {
    const r = finResolveHolding(o);
    if (!r.qty && !r.cost) return toast('请填写数量或总成本', 'warn');
    const dd = loadFin(); const it = dd.inv.holdings.find(x => x.id === h.id);
    if (!it) return;
    it.lots = it.lots || [];
    it.lots.push({ id: 'l' + Date.now(), date: o.date, qty: r.qty, cost: r.cost, px: r.price || (r.qty > 0 ? r.cost / r.qty : 0) });
    finSyncHolding(it);
    saveFin(dd); renderFinanceTool(ROOT); toast('已追加买入 ✓', 'success');
  });
}
function finLotSell(d, h) {
  finFormModal('部分卖出 · ' + h.name, [
    { k: 'qty', label: '卖出数量（份）', def: '', placeholder: '当前总 ' + finNum(finLotQty(h)) + ' 份' },
  ], null, o => {
    const n = parseFloat(o.qty);
    if (!n || n <= 0) return toast('请输入卖出数量', 'warn');
    if (n > finLotQty(h) + 1e-6) return toast('卖出数量超过持有数量', 'warn');
    const dd = loadFin(); const it = dd.inv.holdings.find(x => x.id === h.id);
    if (!it) return;
    let remain = n;
    const kept = [];
    it.lots.forEach(l => {
      if (remain <= 0) { kept.push(l); return; }
      const lq = l.qty || 0;
      if (lq <= remain) { remain -= lq; return; }   // 整仓卖出
      kept.push({ ...l, qty: lq - remain, cost: l.cost * (1 - remain / lq) });   // 部分扣减（成本按比例）
      remain = 0;
    });
    it.lots = kept;
    if (finLotQty(it) <= 1e-6) {
      if (!confirm('已全部卖完，删除该持仓？')) { finSyncHolding(it); saveFin(dd); renderFinanceTool(ROOT); return; }
      dd.inv.holdings = dd.inv.holdings.filter(x => x.id !== it.id);
      saveFin(dd); renderFinanceTool(ROOT); toast('持仓已平仓 ✓', 'success'); return;
    }
    finSyncHolding(it);
    saveFin(dd); renderFinanceTool(ROOT); toast('已卖出 ' + finNum(n) + ' 份 ✓', 'success');
  });
}
function finLotClose(d, h) {
  if (!confirm('确认全部平仓「' + h.name + '」？将删除该持仓记录。')) return;
  const dd = loadFin(); dd.inv.holdings = dd.inv.holdings.filter(x => x.id !== h.id);
  saveFin(dd); renderFinanceTool(ROOT); toast('已全部平仓 ✓', 'success');
}
function finLotPrice(d, h) {
  finFormModal('更新当日单价 · ' + h.name, [
    { k: 'price', label: '当日单价（8 位精度）', def: finPx(h.price), placeholder: '如：1.01000000' },
    { k: 'date', label: '估值日期', def: fmtDate(new Date()) },
  ], null, o => {
    const p = parseFloat(o.price);
    if (!p || p <= 0) return toast('请输入有效单价', 'warn');
    const dd = loadFin(); const it = dd.inv.holdings.find(x => x.id === h.id);
    if (!it) return;
    it.price = Math.round(p * 1e8) / 1e8;
    it.date = o.date;
    it.vals = it.vals || [];
    it.vals.push({ date: o.date, price: it.price, value: finLotQty(it) * it.price });   // 序列存储，不覆盖
    finSyncHolding(it);
    saveFin(dd); renderFinanceTool(ROOT); toast('单价已更新 ✓（' + o.date + '）', 'success');
  });
}
function finInvPage(body, d) {
  const inv = d.inv;
  const accts = d.accounts;
  const sel = S.fin.invAcct || '__all__';
  const holdingView = sel === '__all__' ? inv.holdings : inv.holdings.filter(h => h.acctId === sel);
  const orphan = inv.holdings.filter(h => !h.acctId);
  const sum = src => { let cost = 0, val = 0; src.forEach(h => { cost += finToBase(d, h.cost, h.cur); val += finToBase(d, h.value, h.cur); }); return { cost, val, pnl: val - cost }; };
  const agg = sum(holdingView);
  const pct = agg.cost > 0 ? agg.pnl / agg.cost * 100 : 0;
  const ar = finAnnualPct(d, agg.cost, agg.val, finEarliest(holdingView));
  const acctName = id => { const a = accts.find(x => x.id === id); return a ? a.name : '(未挂靠)'; };
  body.innerHTML = `
    <div class="gcard">
      <div class="section-title"><span class="st-emoji">📈</span>理财专区
        <button class="btn sm" id="iv-add" style="margin-left:auto;">＋ 新增持仓</button></div>
      <div class="fin-note">💡 持仓挂靠账户后，该账户余额自动 = 持仓市值合计（避免重复记账）；未挂靠持仓单独计入「独立投资」。</div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:8px;">
        <span style="font-size:13px;font-weight:700;">分析账户：</span>
        <select class="input" id="iv-acct" style="width:260px;">
          <option value="__all__">全部持仓</option>
          ${accts.map(a => `<option value="${a.id}" ${sel === a.id ? 'selected' : ''}>${esc(a.name)}（${finFmt(finAcctInvValue(d, a.id), d.base)}）</option>`).join('')}
        </select>
      </div>
      <div class="fin-stats" style="margin-top:12px;">
        <div class="fin-stat main"><div class="fin-label">持仓市值</div><div class="fin-num">${finFmt(agg.val, d.base)}</div></div>
        <div class="fin-stat"><div class="fin-label">累计成本</div><div class="fin-num">${finFmt(agg.cost, d.base)}</div></div>
        <div class="fin-stat"><div class="fin-label">浮动盈亏</div><div class="fin-num ${agg.pnl >= 0 ? 'up' : 'down'}">${agg.pnl >= 0 ? '+' : '-'}${finFmt(Math.abs(agg.pnl), d.base)}</div></div>
        <div class="fin-stat"><div class="fin-label">收益率</div><div class="fin-num ${pct >= 0 ? 'up' : 'down'}">${finPct(pct)}%</div></div>
        <div class="fin-stat"><div class="fin-label">年化收益率</div><div class="fin-num ${ar == null ? '' : ar >= 0 ? 'up' : 'down'}">${ar == null ? '—' : finPct(ar) + '%'}</div></div>
      </div>
      ${sel !== '__all__' ? `<div class="fin-todaybar" style="margin-top:10px;">🏦 账户「${esc(acctName(sel))}」余额由以下持仓自动汇总：${finFmt(agg.val, d.base)}</div>`
        : (orphan.length ? `<div class="fin-todaybar warn" style="margin-top:10px;">⚠️ ${orphan.length} 条持仓未挂靠账户，将单独计入「独立投资」市值</div>` : '')}
      <div class="fin-table" style="margin-top:12px;">${holdingView.map((h, i) => {
        const hp = finToBase(d, h.value - h.cost, h.cur);
        const hr = h.cost > 0 ? (h.value - h.cost) / h.cost * 100 : 0;
        const har = finAnnualPct(d, finToBase(d, h.cost, h.cur), finToBase(d, h.value, h.cur), finStartDate(h));
        return `<div class="fin-row">
          <span class="fr-name">${esc(h.name)}</span>
          <span class="fr-tag">${esc(h.type || '投资')}</span>
          <span class="fr-cur">${h.cur}</span>
          <span>${h.cashOnly ? '类理财（仅总值）' : finNum(h.qty) + ' 份 × ' + finPx(h.price)}</span>
          <span class="fr-net">${finFmt(h.value, h.cur)}</span>
          <span class="fr-mode ${hp >= 0 ? 'up' : 'down'}">${hp >= 0 ? '+' : '-'}${finFmt(Math.abs(hp), d.base)} (${finPct(hr)}%)</span>
          <span class="fr-ann" title="年化收益率（按最早买入/估值日起算）">年化 ${har == null ? '—' : finPct(har) + '%'}</span>
          <span class="fr-ops">
            <button class="mini-btn" data-act="lot" data-id="${h.id}">详情</button>
            <button class="mini-btn" data-act="edit" data-id="${h.id}">编辑</button>
            <button class="mini-btn" data-act="del" data-id="${h.id}">删除</button>
          </span>
        </div>`; }).join('') || '<div class="empty" style="padding:24px;"><span class="e-icon">📈</span>暂无持仓，点右上角新增</div>'}
      </div>
    </div>
    <div class="gcard" style="margin-top:14px;">
      <div class="section-title"><span class="st-emoji">📝</span>投资笔记（买入逻辑 / 策略）
        <button class="btn sm" id="iv-note" style="margin-left:auto;margin-right:6px;">＋ 记一条</button>
        <button class="btn sm" id="iv-ngrp">＋ 新建笔记架</button></div>
      <div class="fin-note">💡 拖拽笔记行可移动到其他笔记架 · 笔记架可自定义、改名、删除（架内笔记自动移回未分组）</div>
      <div id="nv-groups">${(() => {
        const groups = d.inv.noteGroups || [];
        const rowOf = (n) => `
          <div class="fin-row" draggable="true" data-id="${n.id}">
            <span class="fr-date">${n.date}</span>
            <span class="fr-name" style="flex:1;">${esc(n.title)}</span>
            <span class="fr-note" style="flex:2;" title="${esc(n.body || '')}">${esc((n.body || '').slice(0, 60))}</span>
            <span class="fr-ops"><button class="mini-btn" data-act="ndel" data-id="${n.id}">删除</button></span>
          </div>`;
        const blocks = [['', '📂 未分组']].concat(groups.map(g => [g.id, g.name]));
        return blocks.map(([gid, gname], gi) => `
          <div class="acct-grp" data-g="${gid}">
            <div class="ag-head">
              <span class="ag-name">${esc(gname)}</span>
              <span class="ag-sub">${inv.notes.filter(n => (n.gid || '') === gid).length} 条</span>
              ${gid !== '' ? `<span class="ag-ops">
                <button class="mini-btn" data-ng="ren" data-gi="${gi}">✏️ 改名</button>
                <button class="mini-btn" data-ng="del" data-gi="${gi}">🗑 删除</button></span>` : ''}
            </div>
            <div class="ag-drop">
              ${inv.notes.filter(n => (n.gid || '') === gid).map(rowOf).join('') || '<div class="empty" style="padding:14px;"><span class="e-icon">📭</span>拖拽笔记到此架</div>'}
            </div>
          </div>`).join('');
      })()}</div>
    </div>`;
  $('#iv-acct').onchange = e => { S.fin.invAcct = e.target.value; renderFinanceTool(ROOT); };
  const acctOpts = [['__none__', '暂不挂靠（独立记账）'], ...accts.map(a => [a.id, a.name]), ['__new__', '✏️ 新建对应账户…']];
  $('#iv-add').onclick = () => finFormModal('新增持仓', [
    { k: 'name', label: '产品 / 分类名称', placeholder: '如：余利宝 / 月利宝 / 沪深300ETF' },
    { k: 'type', label: '类型', def: '理财', placeholder: '如：货币基金 / 股票 / 定期' },
    { k: 'acctId', label: '挂靠账户', type: 'sel', opts: acctOpts, def: sel !== '__all__' ? sel : '__none__', custom: true, customPh: '输入新账户名称，如：余额宝账户' },
    { k: 'cur', label: '币种', type: 'sel', opts: Object.keys(d.fx).map(c => [c, c]), def: d.base },
    { k: 'kind', label: '计值方式', type: 'sel', opts: [[0, '标准理财（数量 × 单价）'], [1, '类理财（仅总值）']], onch: "var v=this.value==='1';var m=this.closest('.modal');m.querySelectorAll('.f-cash').forEach(function(e){e.style.display=v?'none':''});var t=m.querySelector('.f-total');if(t)t.style.display=v?'':'none'" },
    { k: 'price', label: '买入单价（币种金额，8 位精度）', def: '', placeholder: '如：1.00860000', cls: 'f-cash' },
    { k: 'qty', label: '数量（份，可小数）', def: '', placeholder: '留空则自动 = 总成本 ÷ 单价', cls: 'f-cash' },
    { k: 'cost', label: '买入总成本（币种金额）', def: '', placeholder: '留空则自动 = 单价 × 数量', cls: 'f-cash' },
    { k: 'value', label: '总值（币种金额，类理财填写）', def: '', placeholder: '仅类理财填写', cls: 'f-total', hidden: true },
    { k: 'date', label: '买入 / 估值日期', def: fmtDate(new Date()) },
  ], null, o => {
    const dd = loadFin();
    let acctId = o.acctId;
    if (!acctId || acctId === '__none__') acctId = '';
    else if (!dd.accounts.some(x => x.id === acctId)) {
      const na = { id: 'a' + Date.now(), name: acctId, type: 'broker', group: 'ungrouped', cur: o.cur, balance: 0, date: fmtDate(new Date()), include: true };
      dd.accounts.push(na); acctId = na.id;
    }
    const id0 = 'h' + Date.now();
    if (String(o.kind) === '1') {
      const nv = parseFloat(o.value);
      if (isNaN(nv) || nv < 0) return toast('请填写有效总值', 'warn');
      const nv2 = Math.round(nv * 100) / 100; const nh = { id: id0, name: o.name, type: o.type || '类理财', acctId, cur: o.cur, date: o.date, cashOnly: true, value: nv2, cost: nv2, lots: [], vals: [{ date: o.date, value: nv2 }] };
      finSyncHolding(nh); dd.inv.holdings.push(nh);
    } else {
      const h0 = finResolveHolding(o);
      const nh = { id: id0, name: o.name, type: o.type, acctId, cur: o.cur, date: o.date, price: h0.price, lots: (h0.qty > 0 || h0.cost > 0) ? [{ id: 'l' + Date.now(), date: o.date, qty: h0.qty, cost: h0.cost, px: h0.price }] : [] };
      finSyncHolding(nh); dd.inv.holdings.push(nh);
    }
    saveFin(dd); renderFinanceTool(ROOT); toast('持仓已添加 ✓', 'success');
  });
  $('#iv-note').onclick = () => finFormModal('投资笔记', [
    { k: 'title', label: '标题', placeholder: '如：为什么买入这只基金' },
    { k: 'body', label: '内容（可选）' },
    { k: 'gid', label: '笔记架', type: 'sel', opts: [['', '未分组']].concat((d.inv.noteGroups || []).map(g => [g.id, g.name])), def: '' },
  ], null, o => {
    const dd = loadFin();
    dd.inv.notes.push({ id: 'n' + Date.now(), title: o.title, body: o.body, date: fmtDate(new Date()), gid: o.gid || '' });
    saveFin(dd); renderFinanceTool(ROOT); toast('笔记已保存 ✓', 'success');
  });
  $('#iv-ngrp').onclick = () => finFormModal('新建笔记架', [
    { k: 'name', label: '架名', placeholder: '如：短线策略 / 长期持有' },
  ], null, o => {
    const dd = loadFin();
    dd.inv.noteGroups.push({ id: 'g' + Date.now(), name: o.name });
    saveFin(dd); renderFinanceTool(ROOT); toast('笔记架已创建 ✓', 'success');
  });
  const nv = $('#nv-groups');
  nv.onclick = e => {
    const b = e.target.closest('[data-act],[data-ng]');
    if (!b) return;
    if (b.dataset.act === 'ndel') {
      const dd = loadFin(); dd.inv.notes = dd.inv.notes.filter(x => x.id !== b.dataset.id); saveFin(dd); renderFinanceTool(ROOT);
      return;
    }
    const gidx = +b.dataset.gi - 1;
    const g = (d.inv.noteGroups || [])[gidx];
    if (!g) return;
    if (b.dataset.ng === 'ren') {
      finFormModal('重命名笔记架', [{ k: 'name', label: '架名' }], g, o => {
        const dd = loadFin(); const it = (dd.inv.noteGroups || []).find(x => x.id === g.id);
        if (it) it.name = o.name; saveFin(dd); renderFinanceTool(ROOT); toast('已保存 ✓', 'success');
      });
    } else {
      if (!confirm(`删除笔记架「${g.name}」？架内笔记将移回「未分组」`)) return;
      const dd = loadFin();
      dd.inv.noteGroups = (dd.inv.noteGroups || []).filter(x => x.id !== g.id);
      (dd.inv.notes || []).forEach(n => { if (n.gid === g.id) n.gid = ''; });
      saveFin(dd); renderFinanceTool(ROOT); toast('笔记架已删除 ✓', 'success');
    }
  };
  nv.addEventListener('dragstart', e => {
    const row = e.target.closest('.fin-row');
    if (!row) return;
    e.dataTransfer.setData('fin/note', row.dataset.id);
    row.classList.add('dragging');
  });
  nv.addEventListener('dragend', e => {
    if (e.target.classList) e.target.classList.remove('dragging');
    nv.querySelectorAll('.ag-drop').forEach(x => x.classList.remove('drag-on'));
  });
  nv.addEventListener('dragover', e => {
    const drop = e.target.closest('.ag-drop');
    if (!drop) return;
    e.preventDefault();
    drop.classList.add('drag-on');
  });
  nv.addEventListener('dragleave', e => {
    const drop = e.target.closest('.ag-drop');
    if (drop && !drop.contains(e.relatedTarget)) drop.classList.remove('drag-on');
  });
  nv.addEventListener('drop', e => {
    const drop = e.target.closest('.ag-drop');
    if (!drop) return;
    e.preventDefault();
    drop.classList.remove('drag-on');
    const grp = drop.closest('.acct-grp');
    const id = e.dataTransfer.getData('fin/note');
    if (!grp || !id) return;
    const dd = loadFin();
    const it = (dd.inv.notes || []).find(x => x.id === id);
    if (!it) return;
    const ng = grp.dataset.g;
    if ((it.gid || '') === ng) return;
    it.gid = ng;
    saveFin(dd); renderFinanceTool(ROOT); toast(`笔记已移至「${grp.querySelector('.ag-name').textContent}」✓`, 'success');
  });
  body.querySelector('.fin-table').onclick = e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const h = inv.holdings.find(x => x.id === b.dataset.id);
    if (!h) return;
    if (b.dataset.act === 'lot') { const dd = loadFin(); const hh = dd.inv.holdings.find(x => x.id === h.id); if (hh) finLotModal(dd, hh); return; }
    if (b.dataset.act === 'del') {
      if (!confirm(`删除持仓「${h.name}」？`)) return;
      const dd = loadFin(); dd.inv.holdings = dd.inv.holdings.filter(x => x.id !== h.id); saveFin(dd); renderFinanceTool(ROOT);
    } else {
      finFormModal('编辑持仓', [
        { k: 'name', label: '产品 / 分类名称' }, { k: 'type', label: '类型' },
        { k: 'acctId', label: '挂靠账户', type: 'sel', opts: acctOpts, custom: true, customPh: '输入新账户名称' },
        { k: 'cur', label: '币种', type: 'sel', opts: Object.keys(d.fx).map(c => [c, c]) },
        ...(h.cashOnly ? [{ k: 'value', label: '当前总值（币种金额）', def: finNum(h.value) }, { k: 'cost', label: '基准总值（初始本金，盈亏以此计算）', def: finNum(h.cost || h.value) }] : [{ k: 'price', label: '当日单价（币种金额，8 位精度）' }, { k: 'qty', label: '总数量（份）' }, { k: 'cost', label: '总成本（币种金额）' }]),
        { k: 'date', label: '估值日期' },
      ], h, o => {
        const dd = loadFin(); const it = dd.inv.holdings.find(x => x.id === h.id);
        if (!it) return;
        let acctId = o.acctId;
        if (!acctId || acctId === '__none__') acctId = '';
        else if (!dd.accounts.some(x => x.id === acctId)) {
          const na = { id: 'a' + Date.now(), name: acctId, type: 'broker', group: 'ungrouped', cur: o.cur, balance: 0, date: fmtDate(new Date()), include: true };
          dd.accounts.push(na); acctId = na.id;
        }
        const h0 = finResolveHolding(o);
        const oldQ = finLotQty(it), oldC = finLotCost(it);
        Object.assign(it, { name: o.name, type: o.type, acctId, cur: o.cur, date: o.date });
        if (it.cashOnly) {
          const nv = parseFloat(o.value);
          if (!isNaN(nv) && nv >= 0 && Math.abs(nv - it.value) > 0.005) { it.value = Math.round(nv * 100) / 100; it.vals = it.vals || []; it.vals.push({ date: o.date, value: it.value }); }
          const nc = parseFloat(o.cost);
          if (!isNaN(nc) && nc >= 0 && Math.abs(nc - (it.cost || 0)) > 0.005) it.cost = Math.round(nc * 100) / 100;
        } else {
        if (h0.price > 0) it.price = h0.price;
        if (h0.qty > 0 && oldQ > 0 && Math.abs(h0.qty - oldQ) > 1e-6) { const k = h0.qty / oldQ; (it.lots || []).forEach(l => { l.qty = l.qty * k; l.cost = l.cost * k; }); }
        else if (h0.cost > 0 && oldC > 0 && Math.abs(h0.cost - oldC) > 0.01) { const k2 = h0.cost / oldC; (it.lots || []).forEach(l => l.cost = l.cost * k2); }
        if (h0.price > 0) { it.vals = it.vals || []; it.vals.push({ date: o.date, price: it.price, value: finLotQty(it) * it.price }); }
        }
        finSyncHolding(it);
        saveFin(dd); renderFinanceTool(ROOT); toast('已保存 ✓', 'success');
      });
    }
  };
}

/* ---------- 报表 ---------- */
function finReportPage(body, d) {
  const snaps = d.snaps;
  const today = new Date();
  const curMonth = fmtDate(new Date(today.getFullYear(), today.getMonth(), 1));
  const monthSnaps = snaps.filter(x => x.date >= curMonth);
  const mDelta = monthSnaps.length > 1 ? monthSnaps[monthSnaps.length - 1].net - monthSnaps[0].net : 0;
  const weekSnaps = snaps.slice(-7);
  const wDelta = weekSnaps.length > 1 ? weekSnaps[weekSnaps.length - 1].net - weekSnaps[0].net : 0;
  body.innerHTML = `
    <div class="fin-stats">
      <div class="fin-stat"><div class="fin-label">本周净变动</div><div class="fin-num ${wDelta >= 0 ? 'up' : 'down'}">${wDelta >= 0 ? '+' : ''}${finFmt(wDelta, d.base)}</div></div>
      <div class="fin-stat"><div class="fin-label">本月净变动</div><div class="fin-num ${mDelta >= 0 ? 'up' : 'down'}">${mDelta >= 0 ? '+' : ''}${finFmt(mDelta, d.base)}</div></div>
      <div class="fin-stat"><div class="fin-label">快照总数</div><div class="fin-num">${snaps.length}</div></div>
      <div class="fin-stat"><div class="fin-label">最近快照</div><div class="fin-num" style="font-size:15px;">${snaps.length ? snaps[snaps.length - 1].date : '—'}</div></div>
    </div>
    <div class="gcard" style="margin-top:14px;">
      <div class="section-title"><span class="st-emoji">📄</span>净资产变化表（全部快照）</div>
      <div class="fin-table">
        <div class="fin-row head"><span class="fr-date">日期</span><span style="flex:1;">总资产</span><span style="flex:1;">总负债</span><span class="fr-net">净资产</span><span class="fr-mode">日变动</span><span style="flex:1;">模式</span></div>
        ${snaps.slice().reverse().map((x, i, arr) => {
          const p = arr[i + 1];
          const dv = p ? x.net - p.net : null;
          return `<div class="fin-row">
            <span class="fr-date">${x.date}</span>
            <span style="flex:1;">${finFmt(x.ta, d.base)}</span>
            <span style="flex:1;">${finFmt(x.tl, d.base)}</span>
            <span class="fr-net">${finFmt(x.net, d.base)}</span>
            <span class="fr-mode ${dv == null ? '' : dv >= 0 ? 'up' : 'down'}">${dv == null ? '—' : (dv >= 0 ? '+' : '') + finFmt(dv, d.base)}</span>
            <span style="flex:1;">${x.mode === 'quick' ? '快速' : '详细'}</span>
          </div>`; }).join('') || '<div class="empty" style="padding:24px;"><span class="e-icon">📄</span>暂无快照</div>'}
      </div>
    </div>
    ${finAiHTML(d)}`;
  FIN_AI_KINDS.forEach(k => { const b = body.querySelector('#fin-ai-' + k.id); if (b) b.onclick = () => finAiRun(k.id, d); });
}

/* ---------- 报表 · AI 分析（网页版 DeepSeek） ---------- */
const FIN_AI_KINDS = [
  { id: 'overview', name: '总账分析', icon: '📊', desc: '资产负债结构 · 净资产趋势 · 汇率敞口 · 变动归因' },
  { id: 'fin', name: '理财分析', icon: '💹', desc: '理财持仓明细 · 浮动盈亏 · 收益率' },
  { id: 'advice', name: '账目建议', icon: '🧭', desc: '账户结构 · 流动性 · 币种与记账建议' },
];
function finAiFxTo(d, v, c) { const fx = d.fx || {}; const base = d.base || 'CNY'; return (v || 0) * (fx[c] || 1) / (fx[base] || 1); }
function finAiCtx(d) {
  /* 从记账本数据提取 AI 分析所需的上下文（全部折合基准货币） */
  const fx = d.fx || {}; const base = d.base || 'CNY';
  const toBase = (v, c) => finAiFxTo(d, v, c);
  const accts = (d.accounts || []).filter(a => a.include !== false);
  const snaps = d.snaps || [];
  const last = snaps[snaps.length - 1];
  const net = last ? last.net : accts.reduce((s, a) => s + toBase(a.balance, a.cur || base), 0);
  const ta = last ? last.ta : net; const tl = last ? last.tl : 0;
  const groups = (d.acctGroups || []).map(g => {
    const list = accts.filter(a => (a.group || 'ungrouped') === g.id);
    const sum = list.reduce((s, a) => s + toBase(a.balance, a.cur || base), 0);
    return { id: g.id, name: g.name, n: list.length, sum, list };
  }).filter(g => g.n > 0);
  const curExposure = {};
  accts.forEach(a => { const c = a.cur || base; curExposure[c] = (curExposure[c] || 0) + toBase(a.balance, c); });
  const holdings = ((d.inv || {}).holdings || []).map(h => {
    const mkt = h.cashOnly ? h.value : ((h.price || 0) * (h.qty || 0));
    const cost = h.cost != null ? h.cost : (h.cashOnly ? h.value : 0);
    const pnl = mkt - cost;
    return { name: h.name, type: h.type || (h.cashOnly ? '类现金理财' : '持仓'), cur: h.cur || base, cashOnly: !!h.cashOnly,
      qty: h.qty || 0, cost, mkt: mkt || 0, pnl, ret: cost ? pnl / cost * 100 : 0, date: h.date || '', valsN: (h.vals || []).length };
  });
  const hSum = holdings.reduce((s, h) => s + h.mkt, 0);
  const hPnl = holdings.reduce((s, h) => s + h.pnl, 0);
  const hCost = holdings.reduce((s, h) => s + h.cost, 0);
  const week = snaps.slice(-7);
  const wDelta = week.length > 1 ? week[week.length - 1].net - week[0].net : 0;
  const curMonth = fmtDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const mSnaps = snaps.filter(x => x.date >= curMonth);
  const mDelta = mSnaps.length > 1 ? mSnaps[mSnaps.length - 1].net - mSnaps[0].net : 0;
  return { base, net, ta, tl, last, snaps, groups, curExposure, holdings, hSum, hPnl, hCost, wDelta, mDelta };
}
function finAiNum(v) { return Math.round(v * 100) / 100; }
function finAiPrompt(d, kind) {
  /* 三类模块各自生成「信息全 + 简洁」的提示词：关键词与实际账户信息直接关联 */
  const c = finAiCtx(d);
  const curLine = Object.keys(c.curExposure).map(k => `${k} ${finAiNum(c.curExposure[k])}`).join(' · ');
  const grpLine = c.groups.map(g => `- ${g.name}：${g.n} 个账户，合计 ${finAiNum(g.sum)}（${g.list.map(a => `${a.name}(${a.type || '账户'}) ${finAiNum(finAiFxTo(d, a.balance, a.cur || c.base))}`).join('；')}）`).join('\n');
  const snapLine = c.snaps.slice(-5).map(x => `${x.date} → ${finAiNum(x.net)}`).join('，');
  const hLine = c.holdings.length ? c.holdings.map(h => `- ${h.name}（${h.type}·${h.cur}${h.cashOnly ? '·类现金' : ''}）：成本 ${finAiNum(h.cost)}，市值 ${finAiNum(h.mkt)}，浮动盈亏 ${finAiNum(h.pnl)}（${finAiNum(h.ret)}%）${h.date ? '，估值日 ' + h.date : ''}`).join('\n') : '- 无持仓';
  const common = `【输入数据】\n基准货币：${c.base}\n净资产：${finAiNum(c.net)}（总资产 ${finAiNum(c.ta)} - 总负债 ${finAiNum(c.tl)}）\n最近快照：${c.last ? c.last.date : '—'}；近7日净资产变动 ${c.wDelta >= 0 ? '+' : ''}${finAiNum(c.wDelta)}；本月变动 ${c.mDelta >= 0 ? '+' : ''}${finAiNum(c.mDelta)}\n币种敞口（折合${c.base}）：${curLine}\n账户分组（折合${c.base}）：\n${grpLine || '- 无账户'}\n近5日快照：${snapLine || '—'}\n理财持仓：\n${hLine}\n理财合计：市值 ${finAiNum(c.hSum)}，成本 ${finAiNum(c.hCost)}，浮动盈亏 ${finAiNum(c.hPnl)}`;
  if (kind === 'overview') return `【角色】你是个人财务总账分析助理，严格基于输入数据客观分析，禁止编造，回复精炼。
【任务】分析整体财务状况与趋势：资产负债结构、净资产近7日/本月变动及可能原因、账户与币种结构、主要风险点，并给出 2-4 条可执行建议。
【输出要求】仅输出合法JSON对象，禁止输出任何前缀、后缀、解释、markdown代码块。JSON结构严格如下，不得新增、删减、修改键名：
{
  "summary": "财务状况一句话总评",
  "trend": "趋势分析（近7日/本月变动及可能原因）",
  "detail": [
    { "指标": "资产负债率", "数值": "28%", "说明": "计算口径简述" },
    { "指标": "RUB敞口占比", "数值": "25%", "说明": "汇率风险简述" }
  ],
  "risks": ["风险点1", "风险点2", "风险点3"],
  "advice": ["建议1", "建议2", "建议3"]
}
detail 至少 3 行，必须含净资产、资产负债率、币种敞口。所有内容必须基于输入数据，禁止编造。
${common}`;
  if (kind === 'fin') return `【角色】你是个人理财配置分析助理，严格基于输入数据客观分析，禁止编造，回复精炼。
【任务】分析理财配置与收益表现：持仓结构与集中度、各类产品（类现金/持仓）的成本、市值、浮动盈亏与收益率、整体收益贡献，指出理财层面的风险点，并给出 2-4 条配置或操作建议。
【输出要求】仅输出合法JSON对象，禁止输出任何前缀、后缀、解释、markdown代码块。JSON结构严格如下，不得新增、删减、修改键名：
{
  "summary": "理财结构一句话总评",
  "returns": "收益与盈亏分析",
  "holdings": [
    { "名称": "余利宝", "类型": "类现金", "币种": "CNY", "成本": 50687.29, "市值": 50693.16, "浮动盈亏": 5.87, "收益率": "0.01%" }
  ],
  "risks": ["理财风险点1", "理财风险点2"],
  "advice": ["配置建议1", "配置建议2", "配置建议3"]
}
holdings 数组必须覆盖输入数据中的全部持仓，每个字段不得为空。所有内容必须基于输入数据，禁止编造。
${common}`;
  return `【角色】你是个人记账与资金管理顾问，严格基于输入数据客观建议，禁止编造，回复精炼。
【任务】评估记账与资金管理现状：账户分组结构与分散度、现金/理财/外币配置比例、流动性是否充足、币种敞口与汇率风险、记账完整性（快照频率、持仓估值日），并给出 3-5 条可落地的管理建议。
【输出要求】仅输出合法JSON对象，禁止输出任何前缀、后缀、解释、markdown代码块。JSON结构严格如下，不得新增、删减、修改键名：
{
  "assessment": "现状评估（账户结构、流动性、记账完整性）",
  "problems": ["主要问题1", "主要问题2", "主要问题3"],
  "checklist": [
    { "项目": "流动性", "现状": "偏弱", "建议": "保留1-2个月支出" },
    { "项目": "RUB敞口", "现状": "占比25%", "建议": "逐步换汇控制占比" }
  ],
  "suggestions": ["建议1", "建议2", "建议3", "建议4"]
}
checklist 至少 3 行，必须覆盖流动性、币种敞口、记账完整性。所有内容必须基于输入数据，禁止编造。
${common}`;
}
function finAiToggle(hd) {
  /* 点击词头展开 / 收起该栏内容 */
  const body = document.getElementById(hd.id.replace('-hd', '-body'));
  const tri = document.getElementById(hd.id.replace('-hd', '-tri'));
  const open = hd.getAttribute('data-open') === '1';
  hd.setAttribute('data-open', open ? '0' : '1');
  if (body) body.style.display = open ? 'none' : '';
  if (tri) tri.textContent = open ? '▶' : '▼';
}
function finAiHTML(d) {
  /* 报表页 · AI 分析卡片（三模块纵向排列，词头可点击展开/收起 + 会话状态 + 中断） */
  return `<div class="gcard" style="margin-top:14px;">
    <div class="section-title"><span class="st-emoji">🤖</span>AI 分析 <span style="font-size:12px;color:var(--text-dim);font-weight:400;">网页版 DeepSeek · 自动使用会话池交替发送</span></div>
    <div id="fin-ai-sess" style="font-size:11.5px;color:var(--text-dim);margin-bottom:8px;">${finAiSessLine()}</div>
    ${FIN_AI_KINDS.map(k => `<div style="border:1px solid rgba(0,0,0,.08);border-radius:10px;margin-bottom:10px;background:#fff;overflow:hidden;">
      <div id="fin-ai-${k.id}-hd" data-open="1" onclick="finAiToggle(this)" title="点击展开 / 收起"
        style="display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:pointer;user-select:none;">
        <span id="fin-ai-${k.id}-tri" style="font-size:10px;color:var(--text-dim);width:14px;text-align:center;">▼</span>
        <span style="font-size:12.5px;font-weight:600;">${k.icon} ${k.name}</span>
        <span style="font-size:11px;color:var(--text-dim);font-weight:400;">${k.desc}</span>
      </div>
      <div id="fin-ai-${k.id}-body" style="padding:0 12px 12px;">
        <button class="btn sm" id="fin-ai-${k.id}" style="font-size:12px;padding:3px 14px;">▶ 运行</button>
        <div id="fin-ai-${k.id}-st" style="font-size:11.5px;margin-top:6px;color:var(--text-dim);"></div>
        <div id="fin-ai-${k.id}-res" style="font-size:12.5px;white-space:pre-wrap;word-break:break-word;max-height:300px;overflow:auto;margin-top:4px;"></div>
      </div>
    </div>`).join('')}
  </div>`;
}
function finAiSessLine() {
  const peek = fqDsUrlPeek && fqDsUrlPeek();
  if (peek) return `🌐 会话池 ${peek.total} 个网址 · 当前第 ${peek.idx + 1} 个：${fqDsSessName(peek)}（交替发送）`;
  if (S.ai && S.ai.wsess && S.ai.wsess.url) return `🌐 沿用 AI 工作台已选会话：${esc(S.ai.wsess.name || '…' + String(S.ai.wsess.url).slice(-12))}`;
  return '🌐 未配置会话：请先在「AI 工作台-网页会话」添加会话网址，或在此处直接添加';
}
function finAiRenderRes(res, obj) {
  /* 报表 AI 分析结果渲染：JSON → 表格（对象数组）/ 列表（字符串数组）/ 键值段落 */
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) { res.textContent = obj == null ? '' : String(obj); return; }
  const html = [];
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      if (!v.length) {
        /* 空数组：显示占位，避免只留标题造成"内容缺失"观感 */
        html.push(`<div style="font-weight:600;font-size:12.5px;margin:8px 0 3px;">${esc(k)}</div>
          <div style="font-size:11.5px;color:var(--text-dim);padding-left:10px;">（无条目）</div>`);
        continue;
      }
      const isObjArr = v.every(x => x && typeof x === 'object' && !Array.isArray(x));
      if (isObjArr) {
        /* 对象数组 → 实线表格（避免细 rgba 边框呈现"虚线"观感） */
        const cols = [...new Set(v.flatMap(x => Object.keys(x)))];
        html.push(`<div style="font-weight:600;font-size:12.5px;margin:8px 0 3px;">${esc(k)}</div>
          <table style="width:100%;border-collapse:collapse;font-size:11.5px;border:1px solid #d0d7de;border-radius:6px;">
            <tr style="background:#f2f4f7;">${cols.map(c => `<td style="padding:4px 8px;border:1px solid #d8dee4;font-weight:600;">${esc(c)}</td>`).join('')}</tr>
            ${v.map(x => `<tr>${cols.map(c => `<td style="padding:4px 8px;border:1px solid #e3e8ee;">${esc(x[c] != null ? String(x[c]) : '')}</td>`).join('')}</tr>`).join('')}
          </table>`);
      } else {
        /* 字符串数组 → 项目列表 */
        html.push(`<div style="font-weight:600;font-size:12.5px;margin:8px 0 3px;">${esc(k)}</div>
          ${v.map(x => `<div style="font-size:12.5px;margin:2px 0;padding-left:10px;">• ${esc(typeof x === 'object' && x !== null ? JSON.stringify(x) : String(x))}</div>`).join('')}`);
      }
    } else if (v && typeof v === 'object') {
      html.push(`<div style="font-weight:600;font-size:12.5px;margin:8px 0 3px;">${esc(k)}</div>
        <div style="font-size:12px;font-family:monospace;white-space:pre-wrap;word-break:break-word;">${esc(JSON.stringify(v, null, 1))}</div>`);
    } else {
      html.push(`<div style="font-size:12.5px;margin:4px 0;"><b>${esc(k)}</b>：${esc(String(v))}</div>`);
    }
  }
  res.innerHTML = html.join('');
}
function finAiRun(kind, d) {
  /* 报表 AI 分析执行（与影响因子一键分析同路径的审查执行器）：
     网页会话发送 → 空回复/请求失败自动重跑（≤3 次，间隔 12s 冷却，避免打断 DS 生成）→ 连续 3 次异常停止；
     支持手动中断（FQ_ABORT）、登录失效自动开登录窗、进度显示尝试次数与当前会话 */
  const btn = document.getElementById('fin-ai-' + kind);
  const st = document.getElementById('fin-ai-' + kind + '-st');
  const res = document.getElementById('fin-ai-' + kind + '-res');
  if (!btn || !st || !res) return;
  fqAbortReset();
  const url = fqDsUrlGet && fqDsUrlGet() || (S.ai && S.ai.wsess && S.ai.wsess.url) || '';
  if (!url) { st.textContent = '⚠ 请先添加网页会话网址（AI 工作台-网页会话 → ＋ 添加）'; return; }
  const prompt = finAiPrompt(d, kind);
  const k = FIN_AI_KINDS.find(x => x.id === kind);
  btn.disabled = true;
  let attempts = 0, lastErr = '';
  const show = msg => { st.innerHTML = msg + ' <button class="btn sm fin-ai-abort" style="font-size:11px;padding:1px 10px;background:#d2455a;color:#fff;border:none;border-radius:6px;cursor:pointer;">⛔ 中断</button>'; const b = st.querySelector('.fin-ai-abort'); if (b) b.onclick = () => fqAbortNow('报表 AI 分析'); };
  const settle = (ok, aborted, err) => { btn.disabled = false; return { ok, attempts, aborted: !!aborted, lastErr: err || '' }; };
  const tryRun = () => {
    attempts++;
    show('⏳ 第 ' + attempts + ' 次尝试 · 网页会话 …' + String(url).slice(-10));
    return Promise.resolve().then(() => apiPost('/api/plugin/webchat/chat', { url, message: prompt, expect: 'finai' })).then(r => {
      if (!r || !r.ok) {
        lastErr = (r && r.error) || '未知错误';
        if (r && r.aborted) { const t = '⛔ 已手动中断'; st.textContent = t; res.textContent = t; return settle(false, true); }
        if (r && r.code === 'need_login') {
          lastErr = '网页登录已失效（已打开登录窗口，请重新登录后重试）';
          show('⚠ ' + lastErr); res.textContent = '⚠ ' + lastErr;
          if (window.webLogin) webLogin();
          return settle(false, false, lastErr);
        }
        return retry('请求失败：' + lastErr);
      }
      const text = String(r.text || '').trim();
      if (!text) { lastErr = '回复为空（DS 未输出有效内容）'; return retry('结果异常：' + lastErr); }
      /* 与影响因子一致：提示词强制 JSON 输出，抓取后解析；非 JSON 或缺少顶层特征键
         （summary/assessment —— 后端门控可能误取嵌套子对象）视为结果异常自动重跑 */
      const obj = fqParseJSON(text);
      const feats = obj && typeof obj === 'object' && !Array.isArray(obj) && ('summary' in obj || 'assessment' in obj);
      if (!obj || !feats) {
        lastErr = !obj ? '非 JSON 输出' : 'JSON 缺少顶层特征键（summary/assessment）——疑似取到嵌套子对象（若连续多次失败，请重启后端服务 python main.py 后重试）';
        const preview = text.replace(/\s+/g, ' ').slice(0, 60);
        return retry('结果异常：' + lastErr + (preview ? '｜原文前60字符：' + preview : ''));
      }
      st.innerHTML = '✅ ' + k.name + '完成 · ' + fmtDate(new Date()) + ' ' + new Date().toTimeString().slice(0, 5) + (attempts > 1 ? '（第 ' + attempts + ' 次尝试成功，前 ' + (attempts - 1) + ' 次异常）' : '');
      finAiRenderRes(res, obj);
      return settle(true);
    }).catch(e => {
      if (FQ_ABORT) { const t = '⛔ 已手动中断'; st.textContent = t; res.textContent = t; return settle(false, true); }
      lastErr = (e && e.message) || String(e);
      return retry('请求失败：' + lastErr);
    });
  };
  const retry = why => {
    if (FQ_ABORT) { const t = '⛔ 已手动中断'; st.textContent = t; res.textContent = t; return settle(false, true); }
    if (attempts < 3) {
      show(why + '，自动重跑第 ' + (attempts + 1) + ' 次…（间隔 12 秒，避免打断 DS 生成）');
      return fqSleep(12000).then(tryRun);
    }
    const msg = '⚠ 连续 3 次结果异常，已停止（末次：' + lastErr + '）';
    st.textContent = msg; res.textContent = msg;
    return settle(false, false, lastErr);
  };
  return tryRun();
}

/* ---------- 设置 ---------- */
function finSettingsPage(body, d) {
  const base = d.base;
  const curKeys = Object.keys(d.fx).filter(c => c !== base);
  const apiRates = S.fin && S.fin.apiRates || null;
  const availCodes = apiRates ? Object.keys(apiRates).filter(c => d.fx[c] == null).sort() : [];
  const availOpts = availCodes.length
    ? availCodes.map(c => `<option value="${c}">${c} ${FIN_TAX[c] || ''}</option>`).join('')
    : `<option value="">${apiRates ? '官方币种已全部添加' : '请先获取官方汇率'}</option>`;
  const reasonUse = {};
  (d.reasons || []).forEach(r => reasonUse[r] = finReasonUsage(d, r));
  const collapsed = (d.settingsCollapsed && typeof d.settingsCollapsed === 'object') ? d.settingsCollapsed : {};
  body.innerHTML = `
    <div class="gcard ${collapsed.base ? 'fin-collapsed' : ''}" data-setcard="base">
      <div class="section-title" data-settoggle="base"><span class="st-emoji">⚙️</span>设置与数据<span class="fin-caret">${collapsed.base ? '▸' : '▾'}</span></div>
      <label class="field">本位币
        <select class="input" id="set-base">${finCurOpts(d)}</select></label>
      <div class="fin-note">汇率双向显示（默认取大于 1 的方向）：1 外币 = X 本位币 ⇄ 1 本位币 = X 外币 · 快照保存时锁定当时汇率</div>
      <div class="fin-table" id="fx-table" style="margin-top:8px;">
        ${curKeys.map(c => { const rv = finRateView(d, c); return `<div class="fin-row">
          <span class="fr-name">${c} ${FIN_TAX[c] || ''}</span>
          <span>${rv.label} <input class="input" data-fx="${c}" type="number" step="any" value="${Number(rv.val.toFixed(4))}" style="width:130px;margin:0 4px;"> ${rv.to}</span>
          <button class="mini-btn" data-ff="flip" data-c="${c}">⇄</button>
        </div>`; }).join('')}
      </div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:12px;">
        <button class="btn sm" id="fx-fetch">🌐 获取官方今日汇率（仅更新现有币种）</button>
        <button class="btn soft sm" id="fx-clear">🗑 删去未使用币种</button>
        <span class="fin-note">${d.fxDate ? '上次在线更新：' + d.fxDate : '尚未在线更新（可手动填写）'}</span>
      </div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:10px;">
        <span class="fin-note">从官方添加币种：</span>
        <select class="input" id="fx-pick" style="width:180px;">${availOpts}</select>
        <button class="btn soft sm" id="fx-pick-add">＋ 添加</button>
      </div>
      <div style="display:flex;gap:10px;margin-top:10px;">
        <input class="input" id="fx-new" placeholder="手动：新币种代码，如 EUR" style="width:190px;">
        <input class="input" id="fx-rate" type="number" step="any" placeholder="1 外币 = ? 本位币" style="width:180px;">
        <button class="btn soft sm" id="fx-add">手动添加</button>
      </div>
      <label class="field" style="margin-top:14px;">净资产目标（本位币）<input class="input" id="set-goal" type="number" value="${d.goals || ''}"></label>
      <button class="btn" id="set-save" style="margin-top:10px;">保存设置 ✓</button>
    </div>
    <div class="gcard ${collapsed.reasons ? 'fin-collapsed' : ''}" style="margin-top:14px;" data-setcard="reasons">
      <div class="section-title" data-settoggle="reasons"><span class="st-emoji">🏷️</span>变更原因管理<span class="fin-caret">${collapsed.reasons ? '▸' : '▾'}</span></div>
      <div class="fin-note" style="margin-top:0;">统一维护变更原因；每日快照与归因明细只能选择此处已有的原因。删除前会校验全部历史快照的引用。</div>
      <div class="fin-attrib" id="reason-list" style="margin-top:10px;">
        ${d.reasons.length ? d.reasons.map(r => { const used = reasonUse[r] || []; return `<div class="attrib-row">
          <span>${esc(r)}</span>
          <span style="display:flex;align-items:center;gap:10px;">
            <span class="fin-note" style="margin:0;">${used.length ? '被 ' + used.length + ' 处引用' : '未引用'}</span>
            <button class="mini-btn" data-reason-del="${esc(r)}">🗑 删除</button>
          </span>
        </div>`; }).join('') : '<div class="fin-note" style="margin:0;">暂无变更原因，请先新增</div>'}
      </div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap;">
        <input class="input" id="reason-new" placeholder="新变更原因，如：房租 / 奖金" style="width:260px;">
        <button class="btn sm" id="reason-add">＋ 新增</button>
      </div>
    </div>
    <div class="gcard ${collapsed.backup ? 'fin-collapsed' : ''}" style="margin-top:14px;" data-setcard="backup">
      <div class="section-title" data-settoggle="backup"><span class="st-emoji">💾</span>数据备份 / 导入导出<span class="fin-caret">${collapsed.backup ? '▸' : '▾'}</span></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn" id="fin-exp">导出 JSON</button>
        <button class="btn soft" id="fin-bak">一键本地备份</button>
      </div>
      <label class="field" style="margin-top:12px;">导入（粘贴 JSON 后点导入）<textarea class="input" id="fin-imp" rows="4" placeholder='{"base":"CNY",...}'></textarea></label>
      <button class="btn soft" id="fin-load">导入 JSON</button>
      <div class="fin-note" style="margin-top:8px;">全部数据存于本机 SQLite（finance_*），无账号无云同步；导出/备份文件请自行妥善保存。旧 rt_fin 仅保留为只读历史备份。</div>
    </div>
    <div class="gcard ${collapsed.prefs ? 'fin-collapsed' : ''}" style="margin-top:14px;" data-setcard="prefs">
      <div class="section-title" data-settoggle="prefs"><span class="st-emoji">🧩</span>数据与偏好备份<span class="fin-caret">${collapsed.prefs ? '▸' : '▾'}</span></div>
      <div class="fin-note" style="margin-top:0;">将主题、折叠、图表模式、视图位置等 UI 偏好导出为配置文件；业务内容仍以 SQLite 为准。</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">
        <button class="btn" id="pref-export">导出当前配置</button>
        <button class="btn soft" id="pref-import-btn">导入并覆盖配置</button>
        <input id="pref-import-file" type="file" accept="application/json,.json" hidden>
      </div>
      <div class="fin-note" style="margin-top:8px;">导出文件：travel_tree_preferences.json · 导入后自动刷新页面</div>
    </div>`;
  $('#set-base').onchange = e => {
    const dd = loadFin(); dd.base = e.target.value; saveFin(dd); renderFinanceTool(ROOT); toast('本位币已切换 ✓', 'success');
  };
  $('#fx-table').onchange = e => {
    const dd = loadFin(); const c = e.target.dataset.fx; const v = parseFloat(e.target.value);
    if (!v) return;
    const dir = S.fin.fxDir && S.fin.fxDir[c] || (dd.fx[c] >= 1 ? 'fwd' : 'rev');
    dd.fx[c] = dir === 'fwd' ? v : 1 / v;
    saveFin(dd); renderFinanceTool(ROOT); toast(`${c} 汇率已更新 ✓`, 'success');
  };
  $('#fx-table').onclick = e => {
    const b = e.target.closest('[data-ff]');
    if (!b) return;
    if (!S.fin.fxDir) S.fin.fxDir = {};
    S.fin.fxDir[b.dataset.c] = S.fin.fxDir[b.dataset.c] === 'fwd' ? 'rev' : 'fwd';
    renderFinanceTool(ROOT);
  };
  $('#fx-fetch').onclick = async () => {
    const btn = $('#fx-fetch'); btn.disabled = true; btn.textContent = '⏳ 正在获取…';
    try {
      const r = await finFetchRates();
      toast(`已更新 ${r.updated} 种现有币种汇率 · 官方另有 ${r.avail} 种可选添加 ✓`, 'success');
    } catch (err) { toast('汇率获取失败：' + err.message + '（请检查网络后重试）', 'error'); }
    finally { renderFinanceTool(ROOT); }
  };
  $('#fx-clear').onclick = () => {
    const dd = loadFin();
    const removed = finClearUnusedFx(dd);
    if (!removed) return toast('没有可删去的未使用币种', 'warn');
    saveFin(dd); renderFinanceTool(ROOT); toast(`已删去 ${removed} 个未使用币种 ✓`, 'success');
  };
  $('#fx-pick-add').onclick = () => {
    const code = $('#fx-pick').value;
    if (!code || !S.fin.apiRates || !S.fin.apiRates[code]) return toast('请先获取官方汇率后再选择', 'warn');
    const dd = loadFin();
    if (dd.fx[code] != null) return toast('该币种已存在', 'warn');
    dd.fx[code] = S.fin.apiRates[code];
    saveFin(dd); renderFinanceTool(ROOT); toast(`${code} 已添加（1 ${code} = ${S.fin.apiRates[code].toFixed(4)} ${dd.base}）✓`, 'success');
  };
  $('#fx-add').onclick = () => {
    const code = $('#fx-new').value.trim().toUpperCase(), rate = parseFloat($('#fx-rate').value);
    if (!code || !rate) return toast('请填写币种与汇率', 'warn');
    if (d.fx[code] != null) return toast('该币种已存在', 'warn');
    const dd = loadFin(); dd.fx[code] = rate; saveFin(dd); renderFinanceTool(ROOT); toast('币种已添加 ✓', 'success');
  };
  $('#set-save').onclick = () => {
    const dd = loadFin(); dd.goals = parseFloat($('#set-goal').value) || 0; saveFin(dd); toast('设置已保存 ✓', 'success');
  };
  $('#reason-add').onclick = () => {
    const inp = $('#reason-new'), v = inp ? inp.value.trim() : '';
    if (!v) return toast('请输入变更原因', 'warn');
    const dd = loadFin();
    if (dd.reasons.includes(v)) return toast('该变更原因已存在', 'warn');
    dd.reasons.push(v); saveFin(dd);
    toast('变更原因已新增 ✓ 各页选项已同步', 'success');
    finSettingsPage(body, loadFin());
  };
  $('#reason-list').onclick = e => {
    const b = e.target.closest('[data-reason-del]');
    if (!b) return;
    const r = b.dataset.reasonDel;
    const dd = loadFin();
    const used = finReasonUsage(dd, r);
    if (used.length) {
      const dates = Array.from(new Set(used.map(x => x.date))).sort();
      const shown = dates.slice(0, 5).join('、') + (dates.length > 5 ? ' 等 ' + dates.length + ' 天' : '');
      toast(`无法删除「${r}」：历史快照中有 ${used.length} 处引用（${shown}）`, 'error', 6000);
      return;
    }
    if (!confirm(`确认删除变更原因「${r}」？删除后每日快照与归因明细的选项将同步移除。`)) return;
    const idx = dd.reasons.indexOf(r);
    if (idx < 0) return;
    dd.reasons.splice(idx, 1); saveFin(dd);
    toast('变更原因已删除 ✓ 各页选项已同步', 'success');
    finSettingsPage(body, loadFin());
  };
  $('#fin-exp').onclick = () => {
    const blob = new Blob([JSON.stringify(loadFin(), null, 2)], { type: 'application/json' });
    const filename = 'russian-tutor-记账-' + fmtDate(new Date()) + '.json';
    window.rtDownloadBlob(blob, filename);
    toast('已导出 JSON ✓', 'success');
  };
  $('#fin-bak').onclick = () => {
    let bak = null;
    try { bak = JSON.parse(localStorage.getItem('rt_fin_bak') || 'null'); } catch (e) { bak = null; }
    toast(bak ? '历史 rt_fin_bak 为只读备份，不再覆盖' : '未找到历史 rt_fin_bak（只读）', 'error', 5000);
  };
  $('#fin-load').onclick = () => {
    try {
      const o = JSON.parse($('#fin-imp').value);
      if (!Array.isArray(o.accounts)) throw new Error('缺少 accounts 字段');
      saveFin(o); renderFinanceTool(ROOT); toast('导入成功 ✓', 'success');
    } catch (e) { toast('导入失败：' + e.message, 'error'); }
  };
  $('#pref-export').onclick = () => {
    const data = window.APP_PREFS || { version: 1, updated_at: new Date().toISOString(), values: {}, raw: {} };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    window.rtDownloadBlob(blob, 'travel_tree_preferences.json');
    toast('已导出 travel_tree_preferences.json ✓', 'success');
  };
  $('#pref-import-btn').onclick = () => $('#pref-import-file').click();
  $('#pref-import-file').onchange = async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const obj = JSON.parse(await file.text());
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('配置文件必须是 JSON 对象');
      await api('/api/preferences/import', { body: { preferences: obj } });
      toast('配置已导入，正在刷新...', 'success');
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      toast('导入失败：' + (err && err.message ? err.message : err), 'error');
    }
  };
  body.querySelectorAll('[data-settoggle]').forEach(el => {
    el.onclick = () => {
      const card = el.closest('[data-setcard]');
      if (!card) return;
      const key = el.dataset.settoggle;
      const now = !card.classList.contains('fin-collapsed');
      card.classList.toggle('fin-collapsed', now);
      const caret = el.querySelector('.fin-caret');
      if (caret) caret.textContent = now ? '▸' : '▾';
      const dd = loadFin();
      if (!dd.settingsCollapsed || typeof dd.settingsCollapsed !== 'object') dd.settingsCollapsed = {};
      dd.settingsCollapsed[key] = now;
      saveFin(dd);
    };
  });
}



window.__toolRenderers.finance = renderFinanceTool;
})();

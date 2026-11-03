'use strict';
/* 按需加载的功能模块：model-usage（模型用量与消费） */
(function () {
  let ROOT = null;
/* ============================================================
   模型用量与消费（第二版）
   - 单次调用手动录入；四 token 字段必填，总 token 只读自动求和；
   - 按价目自动计算花销（只读）+ 可编辑实际花销，两者都保存；
   - 北京时间峰谷 + 可配置节假日；调用时间按莫斯科时间录入；
   - 价目/节假日在本工具设置弹层维护，持久化到 data/settings.json；
   - 时间趋势、对话/功能/模型分组、可筛选明细与编辑/删除。
   与「记账本」完全独立。
   ============================================================ */
const MU = {
  records: [],
  suggestions: { conversation_label: [], feature_label: [], model_name: [] },
  pricing: { models: {}, holidays: [] },
  editingId: null,
  actualDirty: false,
  cards: {},
  filters: { from: '', to: '', conversation: '', feature: '', model: '', currency: '' },
  trend: { grain: 'day', metric: 'calls' },
  viz: { grain: 'day', metric: 'calls', from: '', to: '', segments: {} },
  group: 'conversation_label',
  sort: { key: 'called_at', dir: 'desc' },
};
const MU_CARD_KEY = 'rt_mu_cards';
const MU_VIZ_SEGMENTS = {
  calls: [{ key: 'calls', label: '调用次数', color: '#ff6f95' }],
  tokens: [
    { key: 'uncached', label: '缓存未命中', color: '#ff8a3d' },
    { key: 'cache_read', label: '缓存命中', color: '#58c9a0' },
    { key: 'cache_write', label: '缓存写入', color: '#b06bff' },
    { key: 'output', label: '输出', color: '#4e8cff' },
  ],
  cost: [
    { key: 'theory_uncached', label: '未命中理论值', color: '#ff8a3d' },
    { key: 'theory_cache_read', label: '命中理论值', color: '#58c9a0' },
    { key: 'theory_output', label: '输出理论值', color: '#4e8cff' },
    { key: 'diff', label: '实际−理论差值', color: '#9a8d99' },
  ],
};

const MU_GROUP_LABELS = {
  conversation_label: '对话标签',
  feature_label: '功能标签',
  model_name: '模型名',
};
const MU_METRIC_LABELS = { calls: '调用次数', tokens: 'total token', cost: '实际花销' };
const MU_CURRENCY_SUGGESTIONS = ['CNY', 'USD', 'EUR', 'JPY', 'RUB', 'HKD', 'GBP'];
const MU_MODEL_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,59}$/;

/* ---------------- 格式化 ---------------- */
function muPad(n) { return String(n).padStart(2, '0'); }

function muNowInput() {
  const d = new Date();
  return `${d.getFullYear()}-${muPad(d.getMonth() + 1)}-${muPad(d.getDate())}T`
    + `${muPad(d.getHours())}:${muPad(d.getMinutes())}:${muPad(d.getSeconds())}`;
}

function muToInput(stored) { return String(stored || '').replace(' ', 'T'); }

function muNum(n) {
  if (n === null || n === undefined || n === '') return '0';
  return Number(n).toLocaleString('zh-CN');
}

function muMoney(n) {
  const v = Number(n);
  return '¥' + (Number.isFinite(v) ? v : 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2, maximumFractionDigits: 6,
  });
}

function muCostValue(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return String(Number(n.toFixed(6)));
}

function muFormatInterval(seconds) {
  if (seconds === null || seconds === undefined || seconds === '') return '';
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${muPad(h)}:${muPad(m)}:${muPad(s)}`;
  if (m) return `${muPad(m)}:${muPad(s)}`;
  return muPad(s);
}

function muParseInterval(raw) {
  const text = String(raw === null || raw === undefined ? '' : raw).trim();
  if (!text) return { seconds: null, warning: '' };
  if (!/^\d+(?::\d+){0,2}$/.test(text)) {
    return { error: '间隔无法解析，请使用 HH:MM:SS / MM:SS / SS（如 01:02:03、02:03、45）' };
  }
  const parts = text.split(':').map(Number);
  let h = 0, m = 0, s = 0;
  if (parts.length === 1) s = parts[0];
  else if (parts.length === 2) { m = parts[0]; s = parts[1]; }
  else { h = parts[0]; m = parts[1]; s = parts[2]; }
  const total = h * 3600 + m * 60 + s;
  const issues = [];
  if (m > 59) issues.push('分钟超过 59');
  if (s > 59) issues.push('秒超过 59');
  return {
    seconds: total,
    warning: issues.length ? `间隔${issues.join('、')}，仍按输入值保存为 ${total} 秒` : '',
  };
}

/* 仅接受非负整数；空返回 null，非法返回 NaN。 */
function muInt(value) {
  const text = String(value === null || value === undefined ? '' : value).trim();
  if (!text) return null;
  if (!/^\d+$/.test(text)) return NaN;
  const n = Number(text);
  return Number.isSafeInteger(n) ? n : NaN;
}

function muFloat(value) {
  const text = String(value === null || value === undefined ? '' : value).trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : NaN;
}

function muStoredFromInput(raw) {
  const m = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = [Number(m[1]), Number(m[2]), Number(m[3]),
    Number(m[4]), Number(m[5]), Number(m[6] || 0)];
  const probe = new Date(y, mo - 1, d, h, mi, s);
  if (probe.getFullYear() !== y || probe.getMonth() !== mo - 1 || probe.getDate() !== d
    || probe.getHours() !== h || probe.getMinutes() !== mi || probe.getSeconds() !== s) {
    return null;
  }
  return `${m[1]}-${m[2]}-${m[3]} ${muPad(h)}:${muPad(mi)}:${muPad(s)}`;
}

function muWeekStart(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${muPad(d.getMonth() + 1)}-${muPad(d.getDate())}`;
}

function muIsCny(record) { return String(record.currency || '').toUpperCase() === 'CNY'; }
function muShortTime(stored) {
  const text = String(stored || '');
  return text.length >= 16 ? text.slice(5, 16) : text;
}
function muErrorHTML(message) {
  return `<div class="mu-empty-error"><b>读取失败</b><span>${esc(message || '无响应')}</span>
    <button class="mini-btn" data-mu-retry="1">重试</button></div>`;
}
function muLoadCards() {
  try {
    const v = JSON.parse(localStorage.getItem(MU_CARD_KEY) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch (e) { return {}; }
}
function muSaveCards() {
  try { localStorage.setItem(MU_CARD_KEY, JSON.stringify(MU.cards || {})); } catch (e) { /* 忽略配额 */ }
}
function muSetCard(id, open) {
  MU.cards[id] = !!open;
  muSaveCards();
  muApplyCardState();
}
function muApplyCardState() {
  Array.from(ROOT.querySelectorAll('.mu-card[data-mu-card]')).forEach(card => {
    const id = card.dataset.muCard;
    card.classList.toggle('mu-collapsed', !MU.cards[id]);
    const title = card.querySelector(':scope > .section-title');
    if (title && !title.querySelector('.mu-caret')) {
      const caret = document.createElement('span');
      caret.className = 'mu-caret';
      caret.textContent = '▾';
      const emoji = title.querySelector('.st-emoji');
      if (emoji) emoji.insertAdjacentElement('afterend', caret);
      else title.prepend(caret);
    }
  });
}
function muBindCardToggles() {
  Array.from(ROOT.querySelectorAll('.mu-card > .section-title')).forEach(title => {
    title.onclick = e => {
      if (e.target.closest('button,input,select,textarea,a,label,.mu-switches,.mu-viz-controls,.mu-filters,.pills')) return;
      const card = title.closest('.mu-card');
      const id = card && card.dataset.muCard;
      if (!id) return;
      muSetCard(id, !MU.cards[id]);
    };
  });
}
function muSetAllCards(open) {
  Array.from(ROOT.querySelectorAll('.mu-card[data-mu-card]')).forEach(card => { MU.cards[card.dataset.muCard] = !!open; });
  muSaveCards();
  muApplyCardState();
}

/* ---------------- 价目与峰谷 ---------------- */
function muModelKeys() { return Object.keys(MU.pricing.models || {}); }

function muModelLabel(key) {
  const m = MU.pricing.models[key];
  return (m && m.label) || key;
}

function muDefaultModel() {
  const keys = muModelKeys();
  if (keys.includes('deepseek-flash')) return 'deepseek-flash';
  return keys[0] || '';
}

/* 调用时间按莫斯科存储；加 5 小时得到北京时间墙钟，再用 UTC 字段读取。 */
function muBeijingParts(calledAtStored) {
  const m = String(calledAtStored || '').match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]),
    Number(m[4]), Number(m[5]), Number(m[6])) + 5 * 3600 * 1000;
  const d = new Date(ms);
  return {
    date: `${d.getUTCFullYear()}-${muPad(d.getUTCMonth() + 1)}-${muPad(d.getUTCDate())}`,
    weekday: d.getUTCDay(),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

function muTierFor(calledAtStored) {
  const bj = muBeijingParts(calledAtStored);
  if (!bj) return null;
  const holidays = new Set((MU.pricing.holidays || []).map(String));
  if (holidays.has(bj.date)) return 'offpeak';
  if (bj.weekday === 0 || bj.weekday === 6) return 'offpeak';
  return ((9 * 60 <= bj.minutes && bj.minutes < 12 * 60)
    || (14 * 60 <= bj.minutes && bj.minutes < 18 * 60)) ? 'peak' : 'offpeak';
}

function muPrice(modelKey, field, tier) {
  const model = MU.pricing.models[modelKey];
  if (!model || !model[field]) return null;
  const n = Number(model[field][tier]);
  return Number.isFinite(n) ? n : null;
}

function muCalcCost(modelKey, tokens, tier) {
  if (!tokens || !tier) return null;
  const cr = muPrice(modelKey, 'cache_read', tier);
  const ui = muPrice(modelKey, 'uncached_input', tier);
  const out = muPrice(modelKey, 'output', tier);
  if (cr === null || ui === null || out === null) return null;
  const total = (tokens.uncached_input_tokens * ui
    + tokens.cache_read_tokens * cr
    + tokens.output_tokens * out) / 1_000_000;
  return Number(total.toFixed(6));
}

function muFormTokens() {
  const values = {
    uncached_input_tokens: muInt($('#mu-uncached') ? $('#mu-uncached').value : ''),
    cache_read_tokens: muInt($('#mu-cache-read') ? $('#mu-cache-read').value : ''),
    cache_write_tokens: muInt($('#mu-cache-write') ? $('#mu-cache-write').value : ''),
    output_tokens: muInt($('#mu-output') ? $('#mu-output').value : ''),
  };
  if (Object.values(values).some(v => v === null || Number.isNaN(v) || v < 0)) return null;
  return values;
}

function muFormCalc() {
  const tokens = muFormTokens();
  if (!tokens) return null;
  const called = muStoredFromInput($('#mu-called') ? $('#mu-called').value : '');
  const tier = called ? muTierFor(called) : null;
  const model = $('#mu-model') ? $('#mu-model').value : '';
  return { tokens, tier, cost: muCalcCost(model, tokens, tier) };
}

function muUpdateCalc() {
  const tokens = muFormTokens();
  const totalEl = $('#mu-total');
  if (totalEl) {
    totalEl.value = tokens
      ? tokens.uncached_input_tokens + tokens.cache_read_tokens + tokens.cache_write_tokens + tokens.output_tokens
      : '';
  }
  const calc = muFormCalc();
  const costEl = $('#mu-calc-cost');
  if (costEl) costEl.value = calc && calc.cost !== null ? muCostValue(calc.cost) : '';
  const tierEl = $('#mu-tier-label');
  if (tierEl) {
    tierEl.textContent = calc && calc.tier ? (calc.tier === 'peak' ? '高峰价' : '空闲价') : '待判定';
    tierEl.className = 'mu-tier ' + (calc && calc.tier === 'peak' ? 'peak' : 'offpeak');
  }
  const actualEl = $('#mu-actual');
  if (actualEl && !MU.actualDirty) {
    actualEl.value = calc && calc.cost !== null ? muCostValue(calc.cost) : '';
  }
}

/* ---------------- 页面骨架 ---------------- */
function renderModelUsageTool(container) {
  ROOT = container;
  const box = ROOT;
  MU.cards = muLoadCards();
  box.innerHTML = `
    <div class="gcard mu-card" data-mu-card="overview" style="margin-bottom:14px;">
      <div class="section-title"><span class="st-emoji">📈</span>模型用量与消费
        <span class="mu-hint">四 token 字段 · 价目自动计算 · 对话/功能/模型分组</span>
        <button class="btn sm soft" id="mu-pricing-open" style="margin-left:auto;">⚙️ 价目与节假日</button>
        <button class="btn sm soft" id="mu-refresh">↻ 刷新</button>
      </div>
      <div class="mu-note">记录 DeepSeek Harness 的单次调用：调用时间（莫斯科时间）、对话标签、对话内序号、功能标签、模型名、四类 token、计算/实际花销与间隔。
        价目单位元/百万 tokens；高峰按北京时间周一至周五 9:00–12:00、14:00–18:00，节假日列表内日期全天按空闲。本工具与「记账本」<b>完全独立</b>；汇总与图表<b>只统计 CNY 记录</b>，不做跨币种换算。</div>
      <div id="mu-metrics" class="metrics mu-metrics"></div>
    </div>

    <div class="gcard mu-card" id="mu-form-card" data-mu-card="form" style="margin-bottom:14px;">
      <div class="section-title"><span class="st-emoji">📝</span><span id="mu-form-title">新增调用记录</span>
        <span class="mu-hint" id="mu-form-mode">手动录入 · 总 token 与计算花销自动</span>
        <button class="btn sm soft" id="mu-form-cancel" style="margin-left:auto;display:none;">取消编辑</button>
      </div>
      <div class="mu-form-grid">
        <label class="field" data-field="called_at"><span>调用时间（莫斯科时间） <i class="mu-req">*</i></span>
          <input class="input" type="datetime-local" step="1" id="mu-called">
          <span class="mu-err"></span>
        </label>
        <label class="field" data-field="conversation_label"><span>对话标签 <i class="mu-req">*</i></span>
          <input class="input" id="mu-conv" list="mu-dl-conv" maxlength="120" placeholder="例：Harness 开发">
          <span class="mu-err"></span>
        </label>
        <label class="field" data-field="turn_index"><span>对话内序号 <i class="mu-req">*</i></span>
          <input class="input" type="number" min="1" step="1" id="mu-turn" value="1">
          <span class="mu-err"></span>
        </label>
        <label class="field" data-field="feature_label"><span>功能标签 <i class="mu-req">*</i></span>
          <input class="input" id="mu-feature" list="mu-dl-feature" maxlength="120" placeholder="例：代码修改">
          <span class="mu-err"></span>
        </label>
        <label class="field" data-field="model_name"><span>模型名 <i class="mu-req">*</i></span>
          <select class="input" id="mu-model"></select>
          <span class="mu-err"></span>
        </label>
        <label class="field" data-field="uncached_input_tokens"><span>缓存未命中输入 token <i class="mu-req">*</i></span>
          <input class="input" type="number" min="0" step="1" id="mu-uncached" placeholder="非负整数">
          <span class="mu-err"></span>
        </label>
        <label class="field" data-field="cache_read_tokens"><span>缓存命中输入 token <i class="mu-req">*</i></span>
          <input class="input" type="number" min="0" step="1" id="mu-cache-read" placeholder="非负整数">
          <span class="mu-err"></span>
        </label>
        <label class="field" data-field="cache_write_tokens"><span>缓存写入 token <i class="mu-req">*</i></span>
          <input class="input" type="number" min="0" step="1" id="mu-cache-write" placeholder="非负整数（不计价）">
          <span class="mu-err"></span>
        </label>
        <label class="field" data-field="output_tokens"><span>输出 token <i class="mu-req">*</i></span>
          <input class="input" type="number" min="0" step="1" id="mu-output" placeholder="非负整数">
          <span class="mu-err"></span>
        </label>
        <label class="field"><span>总 token（只读）</span>
          <input class="input mu-readonly" id="mu-total" readonly tabindex="-1" placeholder="四字段自动求和">
        </label>
        <label class="field"><span>计算花销（只读） <span class="mu-tier offpeak" id="mu-tier-label">待判定</span></span>
          <input class="input mu-readonly" id="mu-calc-cost" readonly tabindex="-1" placeholder="按价目自动计算">
        </label>
        <label class="field" data-field="actual_cost"><span>实际花销（可编辑）</span>
          <input class="input" type="number" min="0" step="0.000001" id="mu-actual" placeholder="默认等于计算花销">
          <span class="mu-err"></span>
        </label>
        <label class="field" data-field="currency"><span>币种 <i class="mu-req">*</i></span>
          <input class="input" id="mu-currency" list="mu-dl-currency" value="CNY" maxlength="20" placeholder="默认 CNY">
          <span class="mu-err"></span>
        </label>
        <label class="field" data-field="interval_text"><span>间隔（选填）</span>
          <input class="input" id="mu-interval" placeholder="01:02:03 / 02:03 / 45">
          <span class="mu-err"></span>
        </label>
      </div>
      <div class="mu-form-help">四个 token 字段均必填；总 token 与计算花销只读。实际花销默认等于计算花销，可因账单误差手动修改。缓存写入 token 仅记录、不单独计价。间隔可省略高位，分/秒超出 59 会提示但可保存。非 CNY 记录可保存，但不参与统一汇总与图表。</div>
      <div id="mu-form-warn" class="mu-form-warn"></div>
      <div class="mu-form-actions">
        <button class="btn" id="mu-save">保存记录 ✓</button>
        <button class="btn soft" id="mu-reset">清空表单</button>
        <span id="mu-form-msg" class="mu-muted"></span>
      </div>
      <datalist id="mu-dl-conv"></datalist>
      <datalist id="mu-dl-feature"></datalist>
      <datalist id="mu-dl-model"></datalist>
      <datalist id="mu-dl-currency">${MU_CURRENCY_SUGGESTIONS.map(c => `<option value="${c}"></option>`).join('')}</datalist>
    </div>

    <div class="gcard mu-card" data-mu-card="trend" style="margin-bottom:14px;">
      <div class="section-title"><span class="st-emoji">📊</span>时间趋势
        <span class="mu-hint">按筛选后的 CNY 记录聚合</span>
        <div class="mu-switches">
          <div class="mu-seg" id="mu-grain" role="group" aria-label="按日 / 按周">
            <button type="button" data-grain="day" class="active">按日</button>
            <button type="button" data-grain="week">按周</button>
          </div>
          <div class="mu-seg mu-seg-3" id="mu-metric" role="group" aria-label="调用次数 / token / 实际花销">
            <button type="button" data-metric="calls" class="active">调用次数</button>
            <button type="button" data-metric="tokens">token</button>
            <button type="button" data-metric="cost">实际花销</button>
          </div>
        </div>
      </div>
      <div id="mu-trend"></div>
    </div>

    <div class="gcard mu-card" data-mu-card="viz" style="margin-bottom:14px;">
      <div class="section-title"><span class="st-emoji">🧊</span>可视化：日 / 分钟
        <span class="mu-hint">CNY · 莫斯科时间 · 分钟按持续时间分摊</span>
      </div>
      <div class="mu-viz-controls">
        <label>横轴 <select class="input" id="mu-viz-grain"><option value="day">日</option><option value="minute">分钟</option></select></label>
        <label>从 <input class="input" type="date" id="mu-viz-from"></label>
        <label>到 <input class="input" type="date" id="mu-viz-to"></label>
        <label>纵轴 <select class="input" id="mu-viz-metric"><option value="calls">调用次数</option><option value="tokens">token</option><option value="cost">实际花销</option></select></label>
      </div>
      <div class="mu-viz-note" id="mu-viz-note"></div>
      <div id="mu-viz"></div>
    </div>

    <div class="gcard mu-card" data-mu-card="group" style="margin-bottom:14px;">
      <div class="section-title"><span class="st-emoji">🧮</span>分组汇总
        <span class="mu-hint">仅统计 CNY 记录</span>
        <div class="pills mu-group-pills" id="mu-group-dim">
          <button type="button" class="pill active" data-group="conversation_label">对话标签</button>
          <button type="button" class="pill" data-group="feature_label">功能标签</button>
          <button type="button" class="pill" data-group="model_name">模型名</button>
        </div>
      </div>
      <div id="mu-group"></div>
    </div>

    <div class="gcard mu-card" data-mu-card="detail">
      <div class="section-title"><span class="st-emoji">📋</span>明细表
        <span class="mu-hint" id="mu-count"></span>
        <button class="btn sm soft" id="mu-filter-reset" style="margin-left:auto;">重置筛选</button>
      </div>
      <div class="mu-filters">
        <label class="field">从
          <input class="input" type="date" id="mu-f-from">
        </label>
        <label class="field">到
          <input class="input" type="date" id="mu-f-to">
        </label>
        <label class="field">对话标签
          <select class="input" id="mu-f-conv"><option value="">全部</option></select>
        </label>
        <label class="field">功能标签
          <select class="input" id="mu-f-feature"><option value="">全部</option></select>
        </label>
        <label class="field">模型名
          <select class="input" id="mu-f-model"><option value="">全部</option></select>
        </label>
        <label class="field">币种
          <select class="input" id="mu-f-currency"><option value="">全部</option></select>
        </label>
      </div>
      <div class="mu-filter-note" id="mu-filter-note"></div>
      <div id="mu-table"></div>
    </div>`;

  muBindStatic();
  muBindCardToggles();
  muApplyCardState();
  muResetForm();
  muRefresh();
}

/* ---------------- 静态事件 ---------------- */
function muBindStatic() {
  const refresh = $('#mu-refresh');
  if (refresh) refresh.onclick = () => muRefresh();
  const pricingOpen = $('#mu-pricing-open');
  if (pricingOpen) pricingOpen.onclick = () => muOpenPricing();

  const save = $('#mu-save');
  if (save) save.onclick = () => muSave();
  const reset = $('#mu-reset');
  if (reset) reset.onclick = () => muResetForm();
  const cancel = $('#mu-form-cancel');
  if (cancel) cancel.onclick = () => muCancelEdit();

  const formCard = $('#mu-form-card');
  if (formCard) {
    formCard.addEventListener('input', e => {
      const field = e.target.closest('[data-field]');
      if (field) {
        field.classList.remove('mu-bad');
        const err = field.querySelector('.mu-err');
        if (err) err.textContent = '';
      }
      if (e.target.id === 'mu-actual') MU.actualDirty = true;
      muUpdateCalc();
    });
    formCard.addEventListener('change', e => {
      if (e.target.id === 'mu-model' || e.target.id === 'mu-called') muUpdateCalc();
    });
  }

  const grain = $('#mu-grain');
  if (grain) grain.onclick = () => {
    MU.trend.grain = MU.trend.grain === 'day' ? 'week' : 'day';
    muSyncPills();
    muPaintTrend(muCny(muFiltered()));
  };
  const metric = $('#mu-metric');
  if (metric) metric.onclick = () => {
    const order = ['calls', 'tokens', 'cost'];
    const i = order.indexOf(MU.trend.metric);
    MU.trend.metric = order[(i + 1) % order.length];
    muSyncPills();
    muPaintTrend(muCny(muFiltered()));
  };
  const group = $('#mu-group-dim');
  if (group) group.onclick = e => {
    const btn = e.target.closest('[data-group]');
    if (!btn) return;
    MU.group = btn.dataset.group;
    muSyncPills();
    muPaintGroup(muCny(muFiltered()));
  };

  const vizGrain = $('#mu-viz-grain');
  if (vizGrain) vizGrain.onchange = () => {
    MU.viz.grain = vizGrain.value === 'minute' ? 'minute' : 'day';
    muInitVizRange();
    muSyncVizControls();
    muPaintViz();
  };
  const vizMetric = $('#mu-viz-metric');
  if (vizMetric) vizMetric.onchange = () => {
    MU.viz.metric = ['calls', 'tokens', 'cost'].includes(vizMetric.value) ? vizMetric.value : 'calls';
    muPaintViz();
  };
  const vizFrom = $('#mu-viz-from');
  if (vizFrom) vizFrom.onchange = () => {
    MU.viz.from = vizFrom.value || '';
    if (MU.viz.grain === 'minute' || !MU.viz.to || MU.viz.to < MU.viz.from) MU.viz.to = MU.viz.from;
    muSyncVizControls();
    muPaintViz();
  };
  const vizTo = $('#mu-viz-to');
  if (vizTo) vizTo.onchange = () => {
    if (MU.viz.grain === 'minute') return;
    MU.viz.to = vizTo.value || MU.viz.from;
    if (MU.viz.to < MU.viz.from) MU.viz.to = MU.viz.from;
    muSyncVizControls();
    muPaintViz();
  };
  const vizEl = $('#mu-viz');
  if (vizEl) vizEl.onclick = e => {
    const btn = e.target.closest('[data-mu-viz-seg]');
    if (!btn) return;
    const key = btn.dataset.muVizSeg;
    MU.viz.segments[key] = !MU.viz.segments[key];
    muPaintViz();
  };

  const filterReset = $('#mu-filter-reset');
  if (filterReset) filterReset.onclick = () => {
    MU.filters = { from: '', to: '', conversation: '', feature: '', model: '', currency: '' };
    ['#mu-f-from', '#mu-f-to', '#mu-f-conv', '#mu-f-feature', '#mu-f-model', '#mu-f-currency'].forEach(sel => {
      const el = $(sel); if (el) el.value = '';
    });
    muPaint();
  };

  const table = $('#mu-table');
  if (table) table.onclick = e => {
    const retry = e.target.closest('[data-mu-retry]');
    if (retry) { muRefresh(); return; }
    const sort = e.target.closest('[data-sort]');
    if (sort) {
      const key = sort.dataset.sort;
      if (MU.sort.key === key) MU.sort.dir = MU.sort.dir === 'asc' ? 'desc' : 'asc';
      else {
        MU.sort.key = key;
        MU.sort.dir = ['conversation_label', 'feature_label', 'model_name', 'currency']
          .includes(key) ? 'asc' : 'desc';
      }
      muPaintTable(muFiltered());
      return;
    }
    const edit = e.target.closest('[data-edit]');
    if (edit) { muStartEdit(Number(edit.dataset.edit)); return; }
    const del = e.target.closest('[data-del]');
    if (del) muDelete(Number(del.dataset.del));
  };
}

function muSyncPills() {
  $$('#mu-grain [data-grain]').forEach(b => b.classList.toggle('active', b.dataset.grain === MU.trend.grain));
  $$('#mu-metric [data-metric]').forEach(b => b.classList.toggle('active', b.dataset.metric === MU.trend.metric));
  $$('#mu-group-dim [data-group]').forEach(b => b.classList.toggle('active', b.dataset.group === MU.group));
}

/* ---------------- 读取与建议值 ---------------- */
async function muRefresh() {
  const d = await apiPost('/api/plugin/model_usage/records', {});
  if (!d || !d.ok) {
    const msg = (d && d.error) || '无响应';
    toast('读取模型用量失败：' + msg, 'error');
    if ($('#mu-trend')) $('#mu-trend').innerHTML = muErrorHTML(msg);
    if ($('#mu-group')) $('#mu-group').innerHTML = muErrorHTML(msg);
    if ($('#mu-table')) $('#mu-table').innerHTML = muErrorHTML(msg);
    if ($('#mu-viz')) $('#mu-viz').innerHTML = muErrorHTML(msg);
    Array.from(ROOT.querySelectorAll('[data-mu-retry]')).forEach(btn => { btn.onclick = () => muRefresh(); });
    return;
  }
  MU.records = Array.isArray(d.records) ? d.records : [];
  MU.suggestions = d.suggestions || { conversation_label: [], feature_label: [], model_name: [] };
  MU.pricing = d.pricing && d.pricing.models ? d.pricing : { models: {}, holidays: [] };
  muFillDatalist('mu-dl-conv', MU.suggestions.conversation_label || []);
  muFillDatalist('mu-dl-feature', MU.suggestions.feature_label || []);
  muFillDatalist('mu-dl-model', MU.suggestions.model_name || []);
  muFillModelSelect($('#mu-model') ? $('#mu-model').value : '');
  muSyncFilterOptions();
  muInitVizRange();
  muSyncVizControls();
  muUpdateCalc();
  muPaint();
}

function muFillDatalist(id, values) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = (values || []).map(v => `<option value="${esc(v)}"></option>`).join('');
}

function muFillModelSelect(preferred) {
  const sel = $('#mu-model');
  if (!sel) return;
  const keys = muModelKeys();
  if (!keys.length) {
    sel.innerHTML = '<option value="">（无价目，请先设置）</option>';
    sel.value = '';
    return;
  }
  const current = preferred && keys.includes(preferred) ? preferred : (keys.includes(sel.value) ? sel.value : '');
  sel.innerHTML = keys.map(k => `<option value="${esc(k)}">${esc(muModelLabel(k))}</option>`).join('');
  sel.value = current || muDefaultModel();
}

function muUnique(column) {
  const set = new Set();
  MU.records.forEach(r => {
    const v = String(r[column] === null || r[column] === undefined ? '' : r[column]);
    if (v) set.add(v);
  });
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function muFillFilterSelect(sel, values, current) {
  if (!sel) return '';
  const list = values || [];
  const keep = list.includes(current) ? current : '';
  sel.innerHTML = '<option value="">全部</option>'
    + list.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  sel.value = keep;
  return keep;
}

function muSyncFilterOptions() {
  MU.filters.conversation = muFillFilterSelect($('#mu-f-conv'), muUnique('conversation_label'), MU.filters.conversation);
  MU.filters.feature = muFillFilterSelect($('#mu-f-feature'), muUnique('feature_label'), MU.filters.feature);
  MU.filters.model = muFillFilterSelect($('#mu-f-model'), muUnique('model_name'), MU.filters.model);
  MU.filters.currency = muFillFilterSelect($('#mu-f-currency'), muUnique('currency'), MU.filters.currency);
}

function muReadFilters() {
  MU.filters = {
    from: $('#mu-f-from') ? $('#mu-f-from').value : '',
    to: $('#mu-f-to') ? $('#mu-f-to').value : '',
    conversation: $('#mu-f-conv') ? $('#mu-f-conv').value : '',
    feature: $('#mu-f-feature') ? $('#mu-f-feature').value : '',
    model: $('#mu-f-model') ? $('#mu-f-model').value : '',
    currency: $('#mu-f-currency') ? $('#mu-f-currency').value : '',
  };
  muPaint();
}

/* ---------------- 筛选与聚合 ---------------- */
function muFiltered() {
  const f = MU.filters;
  return MU.records.filter(r => {
    const day = String(r.called_at || '').slice(0, 10);
    if (f.from && day < f.from) return false;
    if (f.to && day > f.to) return false;
    if (f.conversation && r.conversation_label !== f.conversation) return false;
    if (f.feature && r.feature_label !== f.feature) return false;
    if (f.model && r.model_name !== f.model) return false;
    if (f.currency && String(r.currency || '').toUpperCase() !== f.currency.toUpperCase()) return false;
    return true;
  });
}

function muCny(list) { return list.filter(muIsCny); }

function muPickMetric(bucket) {
  if (MU.trend.metric === 'tokens') return bucket.tokens;
  if (MU.trend.metric === 'cost') return bucket.cost;
  return bucket.calls;
}

function muFormatMetric(value) {
  if (MU.trend.metric === 'cost') return muMoney(value);
  return muNum(value);
}

function muPaint() {
  const list = muFiltered();
  const cny = muCny(list);
  muPaintMetrics(list, cny);
  muPaintTrend(cny);
  muPaintGroup(cny);
  muPaintTable(list);
  muPaintViz();
  if ($('#mu-count')) {
    $('#mu-count').textContent = `显示 ${list.length} / ${MU.records.length} 条 · CNY 汇总 ${cny.length} 条`;
  }
  const note = $('#mu-filter-note');
  if (note) {
    const excluded = list.length - cny.length;
    note.textContent = excluded > 0
      ? `当前筛选结果中有 ${excluded} 条非 CNY 记录：明细表可见并标注，但不参与趋势 / 汇总。`
      : '';
  }
}

function muPaintMetrics(list, cny) {
  const el = $('#mu-metrics');
  if (!el) return;
  const tokens = cny.reduce((sum, r) => sum + (Number(r.total_tokens) || 0), 0);
  const calculated = cny.reduce((sum, r) => sum + (Number(r.calculated_cost) || 0), 0);
  const actual = cny.reduce((sum, r) => sum + (Number(r.actual_cost) || 0), 0);
  const excluded = list.length - cny.length;
  el.innerHTML = `
    <div class="metric"><div class="m-num">${muNum(cny.length)}</div><div class="m-label">调用次数（当前筛选 · CNY）</div></div>
    <div class="metric"><div class="m-num">${muNum(tokens)}</div><div class="m-label">总 token（CNY）</div></div>
    <div class="metric"><div class="m-num">${muMoney(calculated)}</div><div class="m-label">计算花销（CNY）</div></div>
    <div class="metric"><div class="m-num">${muMoney(actual)}</div><div class="m-label">实际花销（CNY）</div></div>
    <div class="metric"><div class="m-num">${muNum(excluded)}</div><div class="m-label">非 CNY（不参与汇总）</div></div>`;
}

function muTrendBuckets(cny) {
  const map = new Map();
  cny.forEach(r => {
    const day = String(r.called_at || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    const key = MU.trend.grain === 'week' ? muWeekStart(day) : day;
    if (!map.has(key)) map.set(key, { key, calls: 0, tokens: 0, cost: 0 });
    const b = map.get(key);
    b.calls += 1;
    b.tokens += Number(r.total_tokens) || 0;
    b.cost += Number(r.actual_cost) || 0;
  });
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function muPaintTrend(cny) {
  const el = $('#mu-trend');
  if (!el) return;
  if (!cny.length) {
    el.innerHTML = emptyHTML('📭', '暂无可汇总的 CNY 记录',
      MU.records.length ? '当前筛选结果没有 CNY 记录；非 CNY 记录只在明细表展示。' : '先在上方新增一条调用记录。');
    return;
  }
  const buckets = muTrendBuckets(cny);
  const values = buckets.map(muPickMetric);
  const max = Math.max(0, ...values);
  const rows = buckets.map(b => {
    const value = muPickMetric(b);
    const pct = max > 0 ? Math.max(2, Math.round(value / max * 100)) : 0;
    const label = MU.trend.grain === 'week' ? `${b.key.slice(5)} 周` : b.key.slice(5);
    const title = MU.trend.grain === 'week' ? `周起始 ${b.key}` : b.key;
    return `<div class="mu-trend-row" title="${esc(title)}">
      <span class="mu-trend-label">${esc(label)}</span>
      <div class="mu-trend-track"><span class="mu-trend-fill" style="width:${pct}%"></span></div>
      <span class="mu-trend-value">${muFormatMetric(value)}</span>
    </div>`;
  }).join('');
  const tableRows = buckets.map(b => {
    const label = MU.trend.grain === 'week' ? `${b.key.slice(5)} 周` : b.key;
    return `<tr><td>${esc(label)}</td><td class="mu-num">${muNum(b.calls)}</td>
      <td class="mu-num">${muNum(b.tokens)}</td><td class="mu-num">${muMoney(b.cost)}</td></tr>`;
  }).join('');
  const metricLabel = MU_METRIC_LABELS[MU.trend.metric] || '调用次数';
  el.innerHTML = `
    <div class="mu-chart-lines">${rows}</div>
    <div class="mu-muted mu-chart-foot">${MU.trend.grain === 'week' ? '按周（周一起）' : '按日'} · 柱状指标：${metricLabel} · 仅 CNY 记录</div>
    <div class="table-wrap mu-trend-table"><table class="grid">
      <thead><tr><th>期间</th><th class="mu-num">调用次数</th><th class="mu-num">总 token</th><th class="mu-num">实际花销</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table></div>`;
}

function muPaintGroup(cny) {
  const el = $('#mu-group');
  if (!el) return;
  if (!cny.length) {
    el.innerHTML = emptyHTML('📭', '暂无可汇总的 CNY 记录',
      '分组汇总只统计 CNY 记录；非 CNY 记录请在明细表查看。');
    return;
  }
  const dim = MU.group;
  const map = new Map();
  cny.forEach(r => {
    const name = String(r[dim] === null || r[dim] === undefined || r[dim] === '' ? '（未填写）' : r[dim]);
    if (!map.has(name)) map.set(name, { name, calls: 0, tokens: 0, cost: 0 });
    const g = map.get(name);
    g.calls += 1;
    g.tokens += Number(r.total_tokens) || 0;
    g.cost += Number(r.actual_cost) || 0;
  });
  const rows = [...map.values()].sort((a, b) =>
    (b.calls - a.calls) || (b.tokens - a.tokens) || a.name.localeCompare(b.name, 'zh-CN'));
  const totalCalls = rows.reduce((sum, r) => sum + r.calls, 0) || 1;
  const maxCalls = Math.max(1, ...rows.map(r => r.calls));
  const body = rows.map(r => {
    const pct = Math.round(r.calls / totalCalls * 100);
    const bar = Math.max(2, Math.round(r.calls / maxCalls * 100));
    return `<tr>
      <td><span class="mu-clip" title="${esc(r.name)}">${esc(r.name)}</span></td>
      <td class="mu-num">${muNum(r.calls)}</td>
      <td class="mu-num">${muNum(r.tokens)}</td>
      <td class="mu-num">${muMoney(r.cost)}</td>
      <td><div class="mu-share"><span class="mu-share-bar" style="width:${bar}%"></span><b>${pct}%</b></div></td>
    </tr>`;
  }).join('');
  const totals = rows.reduce((acc, r) => {
    acc.calls += r.calls; acc.tokens += r.tokens; acc.cost += r.cost; return acc;
  }, { calls: 0, tokens: 0, cost: 0 });
  el.innerHTML = `<div class="table-wrap mu-group-table"><table class="grid">
    <thead><tr><th>${MU_GROUP_LABELS[dim]}</th><th class="mu-num">调用次数</th><th class="mu-num">总 token</th>
      <th class="mu-num">实际花销</th><th>调用占比</th></tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr class="mu-total-row"><td>合计</td><td class="mu-num">${muNum(totals.calls)}</td>
      <td class="mu-num">${muNum(totals.tokens)}</td><td class="mu-num">${muMoney(totals.cost)}</td><td></td></tr></tfoot>
  </table></div>`;
}

/* ---------------- 新增可视化：日 / 分钟 ---------------- */
function muAddDays(dateStr, days) {
  const d = new Date(String(dateStr || '') + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + (parseInt(days, 10) || 0));
  return `${d.getFullYear()}-${muPad(d.getMonth() + 1)}-${muPad(d.getDate())}`;
}

function muDateList(from, to) {
  if (!from) return [];
  const start = new Date(from + 'T00:00:00');
  const end = new Date((to || from) + 'T00:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
  const out = [];
  const d = new Date(start);
  while (d <= end && out.length < 400) {
    out.push(`${d.getFullYear()}-${muPad(d.getMonth() + 1)}-${muPad(d.getDate())}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function muStoredParts(stored) {
  const m = String(stored || '').match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  return {
    date: `${m[1]}-${m[2]}-${m[3]}`,
    sec: Number(m[4]) * 3600 + Number(m[5]) * 60 + Number(m[6]),
  };
}

function muVizComponents(r, metric) {
  if (metric === 'calls') return { calls: 1 };
  if (metric === 'tokens') {
    return {
      uncached: Number(r.uncached_input_tokens) || 0,
      cache_read: Number(r.cache_read_tokens) || 0,
      cache_write: Number(r.cache_write_tokens) || 0,
      output: Number(r.output_tokens) || 0,
    };
  }
  const model = MU.pricing.models[r.model_name];
  const tier = r.price_tier === 'peak' ? 'peak' : 'offpeak';
  const price = field => model && model[field] ? (Number(model[field][tier]) || 0) : 0;
  const u = (Number(r.uncached_input_tokens) || 0) * price('uncached_input') / 1e6;
  const cr = (Number(r.cache_read_tokens) || 0) * price('cache_read') / 1e6;
  const out = (Number(r.output_tokens) || 0) * price('output') / 1e6;
  const theory = u + cr + out;
  return {
    theory_uncached: u,
    theory_cache_read: cr,
    theory_output: out,
    diff: (Number(r.actual_cost) || 0) - theory,
  };
}

function muVizAllocate(r, comps, selectedDays, dayMap, minuteMap) {
  const parts = muStoredParts(r.called_at);
  if (!parts) return;
  const duration = Math.max(0, Number(r.interval_seconds) || 0);
  const addAt = (date, minute, share) => {
    if (!selectedDays.has(date)) return;
    const target = minuteMap || dayMap;
    if (!target) return;
    const key = minuteMap ? minute : date;
    if (!target.has(key)) target.set(key, {});
    const bucket = target.get(key);
    Object.keys(comps).forEach(k => {
      bucket[k] = (bucket[k] || 0) + (Number(comps[k]) || 0) * share;
    });
  };
  if (duration <= 0) {
    addAt(parts.date, Math.floor(parts.sec / 60), 1);
    return;
  }
  let date = parts.date;
  let sec = parts.sec;
  let remaining = duration;
  let guard = 0;
  while (remaining > 0 && guard < 100000) {
    guard += 1;
    const overlap = Math.min(remaining, 86400 - sec);
    if (overlap <= 0) { date = muAddDays(date, 1); sec = 0; continue; }
    if (selectedDays.has(date)) {
      const t1 = sec + overlap;
      const m0 = Math.floor(sec / 60);
      const m1 = Math.floor((t1 - 1e-7) / 60);
      for (let m = m0; m <= m1; m++) {
        const ov = Math.min(t1, (m + 1) * 60) - Math.max(sec, m * 60);
        if (ov <= 0) continue;
        addAt(date, m, ov / duration);
      }
    }
    remaining -= overlap;
    sec += overlap;
    if (sec >= 86400) { date = muAddDays(date, 1); sec = 0; }
  }
}

function muMinuteLabel(minute) {
  const m = Math.max(0, Math.min(1439, Number(minute) || 0));
  return `${muPad(Math.floor(m / 60))}:${muPad(m % 60)}`;
}

function muVizSegmentDefs(metric) {
  const defs = MU_VIZ_SEGMENTS[metric] || [];
  return defs.map(s => ({
    ...s,
    visible: MU.viz.segments[s.key] !== undefined ? !!MU.viz.segments[s.key] : s.key !== 'cache_write',
  }));
}

function muInitVizRange() {
  const dates = muCny(MU.records).map(r => String(r.called_at || '').slice(0, 10))
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!MU.viz.segments || typeof MU.viz.segments !== 'object') MU.viz.segments = {};
  if (!dates.length) {
    if (!MU.viz.from) MU.viz.from = '';
    if (!MU.viz.to) MU.viz.to = '';
    return;
  }
  if (!MU.viz.from) MU.viz.from = dates[0];
  if (!MU.viz.to) MU.viz.to = dates[dates.length - 1];
  if (MU.viz.grain === 'minute' || MU.viz.to < MU.viz.from) MU.viz.to = MU.viz.from;
}

function muSyncVizControls() {
  const grainEl = $('#mu-viz-grain');
  const metricEl = $('#mu-viz-metric');
  const fromEl = $('#mu-viz-from');
  const toEl = $('#mu-viz-to');
  if (grainEl) grainEl.value = MU.viz.grain;
  if (metricEl) metricEl.value = MU.viz.metric;
  if (fromEl) fromEl.value = MU.viz.from || '';
  if (toEl) {
    toEl.value = MU.viz.to || '';
    toEl.disabled = MU.viz.grain === 'minute';
    toEl.title = MU.viz.grain === 'minute' ? '分钟模式强制单日（与起始日期相同）' : '';
  }
}

function muVizData() {
  const records = muCny(MU.records);
  if (!records.length) return { buckets: [], minute: false };
  if (MU.viz.grain === 'minute') {
    const day = MU.viz.from || MU.viz.to;
    const selected = new Set(day ? [day] : []);
    const minutes = new Map();
    records.forEach(r => muVizAllocate(r, muVizComponents(r, MU.viz.metric), selected, null, minutes));
    const buckets = [...minutes.entries()].sort((a, b) => a[0] - b[0]).map(([minute, comps]) => ({
      minute, label: muMinuteLabel(minute), comps,
    }));
    return { buckets, minute: true, day };
  }
  const dates = muDateList(MU.viz.from, MU.viz.to);
  const selected = new Set(dates);
  const days = new Map(dates.map(d => [d, {}]));
  records.forEach(r => muVizAllocate(r, muVizComponents(r, MU.viz.metric), selected, days, null));
  return {
    buckets: dates.map(d => ({ date: d, label: d, comps: days.get(d) || {} })),
    minute: false,
  };
}

function muPaintViz() {
  const el = $('#mu-viz');
  if (!el) return;
  const data = muVizData();
  const defs = muVizSegmentDefs(MU.viz.metric);
  const segs = defs.filter(s => s.visible);
  const note = $('#mu-viz-note');
  if (!MU.records.length) {
    if (note) note.textContent = '';
    el.innerHTML = emptyHTML('📭', '暂无可视化数据', '先新增一条 CNY 调用记录，再选择日 / 分钟与纵轴指标。');
    return;
  }
  if (!data.buckets.length || !segs.length) {
    if (note) note.textContent = segs.length ? '' : '请至少开启一个图例分段。';
    el.innerHTML = emptyHTML('📭', '当前范围暂无可视化数据',
      data.buckets.length ? '图例分段已全部关闭。' : '当前日期范围内没有 CNY 记录；调整起止日期或粒度。');
    return;
  }
  const valuesOf = (comps) => {
    const posParts = segs.filter(s => s.key !== 'diff');
    const pos = posParts.reduce((sum, s) => sum + Math.max(0, Number(comps[s.key]) || 0), 0);
    const diffSeg = segs.find(s => s.key === 'diff');
    const diff = diffSeg ? (Number(comps.diff) || 0) : 0;
    return { pos, diff, total: pos + diff };
  };
  const vals = data.buckets.map(b => valuesOf(b.comps || {}));
  const maxPos = Math.max(0, ...vals.map(v => v.pos + Math.max(0, v.diff)));
  const minNeg = Math.min(0, ...vals.map(v => Math.min(0, v.diff)));
  const W = data.minute ? 1000 : Math.max(760, data.buckets.length * 34);
  const H = 270, padL = 56, padR = 16, padT = 20, padB = 36;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const top = Math.max(1e-9, maxPos), bottom = Math.min(0, minNeg);
  const range = Math.max(1e-9, top - bottom);
  const y = v => padT + (top - v) / range * plotH;
  const n = data.buckets.length;
  const xOf = (i, b) => data.minute
    ? padL + ((b.minute + 0.5) / 1440) * plotW
    : padL + ((i + 0.5) / n) * plotW;
  const barW = data.minute
    ? Math.max(1.5, (plotW / 1440) * 0.72)
    : Math.max(4, Math.min(30, (plotW / n) * 0.62));
  const bars = data.buckets.map((b, i) => {
    const comps = b.comps || {};
    const v = vals[i];
    const x = xOf(i, b);
    const t = `data-viz-key="${data.minute ? 'm' + b.minute : b.date}" data-viz-label="${esc(b.label)}" data-total="${v.total}"`;
    let acc = 0;
    let parts = '';
    segs.filter(s => s.key !== 'diff').forEach(s => {
      const sv = Math.max(0, Number(comps[s.key]) || 0);
      if (sv <= 0) return;
      const y0 = y(acc), y1 = y(acc + sv);
      parts += `<rect x="${(x - barW / 2).toFixed(2)}" y="${y1.toFixed(2)}" width="${barW.toFixed(2)}" height="${Math.max(0.4, y0 - y1).toFixed(2)}" fill="${s.color}"><title>${esc(b.label)} · ${esc(s.label)} ${muNum(sv)}</title></rect>`;
      acc += sv;
    });
    const diffSeg = segs.find(s => s.key === 'diff');
    if (diffSeg && v.diff > 0) {
      const y0 = y(acc), y1 = y(acc + v.diff);
      parts += `<rect x="${(x - barW / 2).toFixed(2)}" y="${y1.toFixed(2)}" width="${barW.toFixed(2)}" height="${Math.max(0.4, y0 - y1).toFixed(2)}" fill="${diffSeg.color}"><title>${esc(b.label)} · ${esc(diffSeg.label)} ${muNum(v.diff)}</title></rect>`;
      acc += v.diff;
    } else if (diffSeg && v.diff < 0) {
      const y0 = y(0), y1 = y(v.diff);
      parts += `<rect x="${(x - barW / 2).toFixed(2)}" y="${y0.toFixed(2)}" width="${barW.toFixed(2)}" height="${Math.max(0.6, y1 - y0).toFixed(2)}" fill="${diffSeg.color}"><title>${esc(b.label)} · ${esc(diffSeg.label)} ${muNum(v.diff)}</title></rect>`;
    }
    return `<g ${t}>${parts}</g>`;
  }).join('');
  const dayStep = Math.max(1, Math.ceil(n / 10));
  const xTicks = data.minute
    ? [0, 120, 240, 360, 480, 600, 720, 840, 960, 1080, 1200, 1320, 1439].map(m =>
        `<text x="${(padL + ((m + 0.5) / 1440) * plotW).toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="10" fill="#a08496">${muMinuteLabel(m)}</text>`).join('')
    : data.buckets.filter((_, i) => i % dayStep === 0).map((b, i) =>
        `<text x="${(padL + (((i * dayStep) + 0.5) / n) * plotW).toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="10" fill="#a08496">${esc(b.label.slice(5))}</text>`).join('');
  const grid = [top, 0, bottom].filter((v, i, arr) => arr.indexOf(v) === i).map(v =>
    `<line x1="${padL}" y1="${y(v)}" x2="${W - padR}" y2="${y(v)}" stroke="rgba(var(--accent-rgb),.16)" stroke-dasharray="4 5"></line>
     <text x="${padL - 4}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="#a08496">${muNum(Number(v.toFixed(2)))}</text>`).join('');
  const legend = defs.map(s => `<button type="button" class="mu-viz-leg ${s.visible ? 'on' : ''}" data-mu-viz-seg="${s.key}"><i style="background:${s.color}"></i>${esc(s.label)}</button>`).join('');
  el.innerHTML = `<div class="mu-viz-chart-wrap"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="min-width:${data.minute ? 760 : Math.min(W, 1100)}px;display:block;">
    ${grid}
    <line x1="${padL}" y1="${y(0)}" x2="${W - padR}" y2="${y(0)}" stroke="rgba(var(--accent-rgb),.35)" stroke-width="1.2"></line>
    ${bars}
    ${xTicks}
  </svg></div>
  <div class="mu-viz-legend">${legend}</div>`;
  if (note) {
    const scope = data.minute
      ? `分钟模式 · ${data.day || '未选日期'}（莫斯科时间）· 0:00–23:59 · 仅显示有数据分钟`
      : `日模式 · ${MU.viz.from || '—'} → ${MU.viz.to || '—'}`;
    const extra = MU.viz.metric === 'cost' ? ' · 理论三段 + 差值；负差值在柱底向下' : '';
    note.textContent = `${scope} · 仅 CNY · 柱高为分摊份额${extra}`;
  }
}

/* ---------------- 明细表 ---------------- */
function muSorted(list) {
  const key = MU.sort.key;
  const dir = MU.sort.dir === 'asc' ? 1 : -1;
  const textKeys = ['called_at', 'conversation_label', 'feature_label', 'model_name', 'currency', 'updated_at'];
  return list.slice().sort((a, b) => {
    let av = a[key];
    let bv = b[key];
    if (textKeys.includes(key)) {
      av = String(av === null || av === undefined ? '' : av);
      bv = String(bv === null || bv === undefined ? '' : bv);
      const cmp = av.localeCompare(bv, 'zh-CN');
      return cmp !== 0 ? cmp * dir : (b.id - a.id);
    }
    const diff = (Number(av) || 0) - (Number(bv) || 0);
    return diff !== 0 ? diff * dir : (b.id - a.id);
  });
}

function muSortArrow(key) {
  if (MU.sort.key !== key) return '';
  return MU.sort.dir === 'asc' ? ' ▲' : ' ▼';
}

function muSortTh(key, label, cls = '') {
  return `<th class="mu-sort ${cls}" data-sort="${key}" title="点击排序">${label}${muSortArrow(key)}</th>`;
}

function muPaintTable(list) {
  const el = $('#mu-table');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = emptyHTML('📋', '当前筛选条件下没有记录',
      MU.records.length ? '可调整上方筛选条件或重置筛选。' : '先在上方新增一条调用记录。');
    return;
  }
  const rows = muSorted(list).map(r => {
    const cny = muIsCny(r);
    const tier = r.price_tier === 'peak' ? '高峰价' : '空闲价';
    const interval = muFormatInterval(r.interval_seconds);
    return `<tr class="${cny ? '' : 'mu-row-noncny'}">
      <td><div>${esc(r.called_at)}</div><div class="mu-muted">#${r.id}</div></td>
      <td><span class="tag-chip" title="${esc(r.conversation_label)}">${esc(r.conversation_label)}</span></td>
      <td class="mu-num">第 ${muNum(r.turn_index)} 次</td>
      <td><span class="mu-clip" title="${esc(r.feature_label)}">${esc(r.feature_label)}</span></td>
      <td><span class="mu-clip" title="${esc(muModelLabel(r.model_name))}">${esc(muModelLabel(r.model_name))}</span><div class="mu-muted">${tier}</div></td>
      <td class="mu-num">${muNum(r.uncached_input_tokens)}</td>
      <td class="mu-num">${muNum(r.cache_read_tokens)}</td>
      <td class="mu-num">${muNum(r.cache_write_tokens)}</td>
      <td class="mu-num">${muNum(r.output_tokens)}</td>
      <td class="mu-num"><b>${muNum(r.total_tokens)}</b></td>
      <td class="mu-num">${muMoney(r.calculated_cost)}</td>
      <td class="mu-num"><b>${muMoney(r.actual_cost)}</b></td>
      <td><span class="mu-currency ${cny ? '' : 'mu-currency-off'}">${esc(r.currency)}</span>${cny ? '' : '<div class="mu-muted">不参与统一汇总</div>'}</td>
      <td>${interval ? `<span title="${r.interval_seconds} 秒">${esc(interval)}</span>` : '—'}</td>
      <td><span class="mu-muted" title="创建：${esc(r.created_at)}&#10;更新：${esc(r.updated_at)}">${esc(muShortTime(r.updated_at))}</span></td>
      <td class="mu-actions">
        <button class="mini-btn" data-edit="${r.id}" title="编辑">✏️</button>
        <button class="mini-btn danger" data-del="${r.id}" title="删除">🗑️</button>
      </td>
    </tr>`;
  }).join('');
  el.innerHTML = `<div class="table-wrap mu-detail-wrap"><table class="grid mu-detail-table">
    <thead><tr>
      ${muSortTh('called_at', '调用时间')}
      ${muSortTh('conversation_label', '对话标签')}
      ${muSortTh('turn_index', '对话内序号', 'mu-num')}
      ${muSortTh('feature_label', '功能标签')}
      ${muSortTh('model_name', '模型名')}
      ${muSortTh('uncached_input_tokens', '未命中输入', 'mu-num')}
      ${muSortTh('cache_read_tokens', '命中输入', 'mu-num')}
      ${muSortTh('cache_write_tokens', '缓存写入', 'mu-num')}
      ${muSortTh('output_tokens', '输出', 'mu-num')}
      ${muSortTh('total_tokens', '总 token', 'mu-num')}
      ${muSortTh('calculated_cost', '计算花销', 'mu-num')}
      ${muSortTh('actual_cost', '实际花销', 'mu-num')}
      ${muSortTh('currency', '币种')}
      ${muSortTh('interval_seconds', '间隔')}
      ${muSortTh('updated_at', '维护')}
      <th>操作</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

/* ---------------- 表单 ---------------- */
function muCollectForm() {
  return {
    called_at: $('#mu-called') ? $('#mu-called').value : '',
    conversation_label: $('#mu-conv') ? $('#mu-conv').value : '',
    turn_index: $('#mu-turn') ? $('#mu-turn').value : '',
    feature_label: $('#mu-feature') ? $('#mu-feature').value : '',
    model_name: $('#mu-model') ? $('#mu-model').value : '',
    uncached_input_tokens: $('#mu-uncached') ? $('#mu-uncached').value : '',
    cache_read_tokens: $('#mu-cache-read') ? $('#mu-cache-read').value : '',
    cache_write_tokens: $('#mu-cache-write') ? $('#mu-cache-write').value : '',
    output_tokens: $('#mu-output') ? $('#mu-output').value : '',
    actual_cost: $('#mu-actual') ? $('#mu-actual').value : '',
    currency: $('#mu-currency') ? $('#mu-currency').value : 'CNY',
    interval_text: $('#mu-interval') ? $('#mu-interval').value : '',
  };
}

function muValidate(values) {
  const errors = {};
  const warnings = [];
  const clean = {};

  clean.called_at = muStoredFromInput(values.called_at);
  if (!values.called_at) errors.called_at = '请选择调用时间';
  else if (!clean.called_at) errors.called_at = '调用时间格式不正确';

  clean.conversation_label = String(values.conversation_label || '').trim();
  if (!clean.conversation_label) errors.conversation_label = '请填写对话标签';

  const turn = muInt(values.turn_index);
  if (turn === null) errors.turn_index = '请填写对话内序号';
  else if (Number.isNaN(turn) || turn <= 0) errors.turn_index = '对话内序号必须为正整数';
  else clean.turn_index = turn;

  clean.feature_label = String(values.feature_label || '').trim();
  if (!clean.feature_label) errors.feature_label = '请填写功能标签';

  clean.model_name = String(values.model_name || '').trim();
  if (!clean.model_name) errors.model_name = '请选择模型';
  else if (!MU.pricing.models || !MU.pricing.models[clean.model_name]) {
    errors.model_name = '该模型未配置价目，请先在「价目与节假日」中添加';
  }

  const tokenFields = [
    ['uncached_input_tokens', '缓存未命中输入 token'],
    ['cache_read_tokens', '缓存命中输入 token'],
    ['cache_write_tokens', '缓存写入 token'],
    ['output_tokens', '输出 token'],
  ];
  tokenFields.forEach(([key, label]) => {
    const n = muInt(values[key]);
    if (n === null) errors[key] = `请填写${label}`;
    else if (Number.isNaN(n) || n < 0) errors[key] = `${label}必须为非负整数`;
    else clean[key] = n;
  });

  const actualText = String(values.actual_cost === null || values.actual_cost === undefined ? '' : values.actual_cost).trim();
  if (!actualText) {
    clean.actual_cost = null;
  } else {
    const actual = muFloat(actualText);
    if (Number.isNaN(actual) || actual === null || actual < 0) errors.actual_cost = '实际花销必须为非负数字';
    else clean.actual_cost = actual;
  }

  clean.currency = String(values.currency || '').trim().toUpperCase();
  if (!clean.currency) errors.currency = '请填写币种';

  const interval = muParseInterval(values.interval_text);
  if (interval.error) errors.interval_text = interval.error;
  else {
    clean.interval_text = String(values.interval_text || '').trim();
    clean.interval_seconds = interval.seconds;
    if (interval.warning) warnings.push(interval.warning);
  }

  delete clean.interval_seconds;
  return { errors, warnings, clean };
}

function muShowErrors(errors) {
  $$('#mu-form-card [data-field]').forEach(field => {
    field.classList.remove('mu-bad');
    const err = field.querySelector('.mu-err');
    if (err) err.textContent = '';
  });
  const keys = Object.keys(errors);
  if (!keys.length) return;
  keys.forEach(key => {
    const field = document.querySelector(`#mu-form-card [data-field="${key}"]`);
    if (!field) return;
    field.classList.add('mu-bad');
    const err = field.querySelector('.mu-err');
    if (err) err.textContent = errors[key];
  });
  const first = document.querySelector(`#mu-form-card [data-field="${keys[0]}"] .input`);
  if (first) first.focus();
  muFormMessage(`请先修正 ${keys.length} 个字段`, true);
}

function muPaintFormWarnings(warnings) {
  const el = $('#mu-form-warn');
  if (!el) return;
  el.innerHTML = (warnings || []).map(w => `<div class="mu-warn">⚠️ ${esc(w)}</div>`).join('');
}

function muFormMessage(text, isError = false) {
  const el = $('#mu-form-msg');
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('mu-form-msg-error', !!isError);
}

function muResetForm(opts) {
  const options = opts || {};
  const keep = options.keep || {};
  MU.editingId = null;
  MU.actualDirty = false;
  if ($('#mu-form-title')) $('#mu-form-title').textContent = '新增调用记录';
  if ($('#mu-form-mode')) $('#mu-form-mode').textContent = '手动录入 · 总 token 与计算花销自动';
  if ($('#mu-form-cancel')) $('#mu-form-cancel').style.display = 'none';
  if ($('#mu-save')) $('#mu-save').textContent = '保存记录 ✓';
  if ($('#mu-called')) $('#mu-called').value = muNowInput();
  if ($('#mu-conv')) $('#mu-conv').value = keep.conversation_label || '';
  if ($('#mu-turn')) $('#mu-turn').value = options.turn ? String(options.turn) : '1';
  if ($('#mu-feature')) $('#mu-feature').value = keep.feature_label || '';
  muFillModelSelect(keep.model_name || '');
  if ($('#mu-uncached')) $('#mu-uncached').value = '';
  if ($('#mu-cache-read')) $('#mu-cache-read').value = '';
  if ($('#mu-cache-write')) $('#mu-cache-write').value = '';
  if ($('#mu-output')) $('#mu-output').value = '';
  if ($('#mu-actual')) $('#mu-actual').value = '';
  if ($('#mu-currency')) $('#mu-currency').value = keep.currency || 'CNY';
  if ($('#mu-interval')) $('#mu-interval').value = '';
  muShowErrors({});
  muPaintFormWarnings([]);
  muFormMessage('');
  muUpdateCalc();
}

function muStartEdit(id) {
  const rec = MU.records.find(r => Number(r.id) === Number(id));
  if (!rec) {
    toast('记录不存在或已被删除，已刷新列表', 'warn');
    muRefresh();
    return;
  }
  MU.editingId = rec.id;
  muSetCard('form', true);
  if ($('#mu-form-title')) $('#mu-form-title').textContent = `编辑记录 #${rec.id}`;
  if ($('#mu-form-mode')) $('#mu-form-mode').textContent = `调用时间 ${rec.called_at}`;
  if ($('#mu-form-cancel')) $('#mu-form-cancel').style.display = '';
  if ($('#mu-save')) $('#mu-save').textContent = '保存修改 ✓';
  if ($('#mu-called')) $('#mu-called').value = muToInput(rec.called_at);
  if ($('#mu-conv')) $('#mu-conv').value = rec.conversation_label || '';
  if ($('#mu-turn')) $('#mu-turn').value = String(rec.turn_index);
  if ($('#mu-feature')) $('#mu-feature').value = rec.feature_label || '';
  muFillModelSelect(rec.model_name || '');
  if ($('#mu-uncached')) $('#mu-uncached').value = String(rec.uncached_input_tokens ?? '');
  if ($('#mu-cache-read')) $('#mu-cache-read').value = String(rec.cache_read_tokens ?? '');
  if ($('#mu-cache-write')) $('#mu-cache-write').value = String(rec.cache_write_tokens ?? '');
  if ($('#mu-output')) $('#mu-output').value = String(rec.output_tokens ?? '');
  if ($('#mu-currency')) $('#mu-currency').value = rec.currency || 'CNY';
  if ($('#mu-interval')) $('#mu-interval').value = rec.interval_text || muFormatInterval(rec.interval_seconds);
  if ($('#mu-actual')) $('#mu-actual').value = String(rec.actual_cost ?? '');
  MU.actualDirty = Math.abs(Number(rec.actual_cost) - Number(rec.calculated_cost)) > 1e-9;
  muShowErrors({});
  muPaintFormWarnings([]);
  muFormMessage(`正在编辑 #${rec.id}`);
  muUpdateCalc();
  const card = $('#mu-form-card');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function muCancelEdit() {
  if (!MU.editingId) return;
  muResetForm();
  toast('已退出编辑', 'info');
}

async function muSave() {
  const values = muCollectForm();
  const v = muValidate(values);
  muShowErrors(v.errors);
  if (Object.keys(v.errors).length) {
    toast('保存被阻止：请修正标红字段', 'warn');
    return;
  }
  muPaintFormWarnings(v.warnings);
  const editing = MU.editingId;
  const payload = {
    called_at: v.clean.called_at,
    conversation_label: v.clean.conversation_label,
    turn_index: v.clean.turn_index,
    feature_label: v.clean.feature_label,
    model_name: v.clean.model_name,
    uncached_input_tokens: v.clean.uncached_input_tokens,
    cache_read_tokens: v.clean.cache_read_tokens,
    cache_write_tokens: v.clean.cache_write_tokens,
    output_tokens: v.clean.output_tokens,
    actual_cost: v.clean.actual_cost,
    currency: v.clean.currency,
    interval_text: v.clean.interval_text,
  };
  if (editing) payload.id = editing;
  const save = $('#mu-save');
  if (save) { save.disabled = true; save.textContent = '保存中…'; }
  muFormMessage('正在保存…');
  const r = await apiPost(editing ? '/api/plugin/model_usage/update' : '/api/plugin/model_usage/add', payload);
  if (save) { save.disabled = false; save.textContent = editing ? '保存修改 ✓' : '保存记录 ✓'; }
  if (!r || !r.ok) {
    const msg = (r && r.error) || '保存失败';
    muFormMessage(msg, true);
    toast('保存失败：' + msg, 'error');
    if (r && /不存在|已被删除/.test(String(r.error || ''))) await muRefresh();
    return;   // 保留用户已填内容
  }
  if (r.warnings && r.warnings.length) {
    muPaintFormWarnings(r.warnings);
    toast(r.warnings.join('；'), 'warn', 5200);
  } else {
    toast(editing ? '记录已更新 ✓' : '记录已保存 ✓', 'success');
  }
  const keep = {
    conversation_label: v.clean.conversation_label,
    feature_label: v.clean.feature_label,
    model_name: v.clean.model_name,
    currency: v.clean.currency,
  };
  const nextTurn = editing ? undefined : v.clean.turn_index + 1;
  await muRefresh();
  muResetForm({ keep, turn: nextTurn });
  muFormMessage(editing ? '已更新，表单已切回新增模式' : '已保存，可继续录入下一条');
}

async function muDelete(id) {
  const rec = MU.records.find(r => Number(r.id) === Number(id));
  if (!rec) {
    toast('记录不存在或已被删除，已刷新列表', 'warn');
    muRefresh();
    return;
  }
  const first = confirm(`删除记录 #${rec.id}（${rec.called_at} · ${rec.conversation_label}）？\n删除后不可恢复。`);
  if (!first) return;
  const second = confirm(`再次确认：记录 #${rec.id} 删除后无法恢复，确定删除？`);
  if (!second) return;
  const r = await apiPost('/api/plugin/model_usage/delete', { id: rec.id });
  if (!r || !r.ok) {
    toast('删除失败：' + ((r && r.error) || '未知错误'), 'error');
    if (r && /不存在|已被删除/.test(String(r.error || ''))) await muRefresh();
    return;
  }
  toast(`已删除记录 #${rec.id}`, 'success');
  if (Number(MU.editingId) === Number(rec.id)) muResetForm();
  await muRefresh();
}

/* ---------------- 价目与节假日设置 ---------------- */
function muPricingArray() {
  return muModelKeys().map(key => {
    const m = MU.pricing.models[key] || {};
    return {
      key,
      label: m.label || key,
      cache_read: { offpeak: String((m.cache_read || {}).offpeak ?? ''), peak: String((m.cache_read || {}).peak ?? '') },
      uncached_input: { offpeak: String((m.uncached_input || {}).offpeak ?? ''), peak: String((m.uncached_input || {}).peak ?? '') },
      output: { offpeak: String((m.output || {}).offpeak ?? ''), peak: String((m.output || {}).peak ?? '') },
    };
  });
}

function muOpenPricing() {
  let draftModels = muPricingArray();
  let draftHolidays = [...(MU.pricing.holidays || [])];
  const body = document.createElement('div');
  const m = modal({
    title: '⚙️ 价目与节假日设置（元 / 百万 tokens）',
    body,
    actions: [
      { label: '取消', cls: 'soft', onClick: mask => mask.remove() },
      { label: '保存价目', onClick: () => muSavePricing(m) },
    ],
  });
  const modalEl = m.mask.querySelector('.modal');
  if (modalEl) {
    modalEl.style.width = 'min(1320px, calc(100vw - 24px))';
    modalEl.style.maxWidth = 'calc(100vw - 24px)';
  }

  const capture = () => {
    const rows = body.querySelectorAll('#mu-price-table tbody tr');
    draftModels = [...rows].map(tr => {
      const get = sel => (tr.querySelector(sel)?.value ?? '');
      return {
        key: get('[data-pk]').trim(),
        label: get('[data-pl]').trim(),
        cache_read: { offpeak: get('[data-cr-o]'), peak: get('[data-cr-p]') },
        uncached_input: { offpeak: get('[data-ui-o]'), peak: get('[data-ui-p]') },
        output: { offpeak: get('[data-out-o]'), peak: get('[data-out-p]') },
      };
    });
    const holidays = [];
    body.querySelectorAll('[data-holiday]').forEach(el => holidays.push(el.dataset.holiday));
    draftHolidays = holidays;
  };

  const error = text => {
    const el = body.querySelector('#mu-price-error');
    if (el) el.textContent = text || '';
  };

  const render = () => {
    const rows = draftModels.map((mm, i) => `<tr data-price-row="${i}">
      <td><input class="input mu-price-input" data-pk value="${esc(mm.key)}" placeholder="模型 key"></td>
      <td><input class="input mu-price-input" data-pl value="${esc(mm.label)}" placeholder="显示名"></td>
      <td><input class="input mu-price-input" data-cr-o type="number" min="0" step="0.0001" value="${esc(mm.cache_read.offpeak)}"></td>
      <td><input class="input mu-price-input" data-cr-p type="number" min="0" step="0.0001" value="${esc(mm.cache_read.peak)}"></td>
      <td><input class="input mu-price-input" data-ui-o type="number" min="0" step="0.0001" value="${esc(mm.uncached_input.offpeak)}"></td>
      <td><input class="input mu-price-input" data-ui-p type="number" min="0" step="0.0001" value="${esc(mm.uncached_input.peak)}"></td>
      <td><input class="input mu-price-input" data-out-o type="number" min="0" step="0.0001" value="${esc(mm.output.offpeak)}"></td>
      <td><input class="input mu-price-input" data-out-p type="number" min="0" step="0.0001" value="${esc(mm.output.peak)}"></td>
      <td><button class="mini-btn danger" data-price-del="${i}" title="删除模型">🗑️</button></td>
    </tr>`).join('');
    const holidayChips = draftHolidays.map((h, i) =>
      `<span class="mu-holiday-chip" data-holiday="${esc(h)}">${esc(h)} <button class="mini-btn" data-holiday-del="${i}" title="移除">✕</button></span>`).join('')
      || '<span class="mu-muted">未配置节假日；列表内日期全天按空闲。</span>';
    body.innerHTML = `<div class="mu-price-wrap">
      <p class="mu-muted mu-price-note">高峰：北京时间周一至周五 9:00–12:00、14:00–18:00；节假日列表内日期全天按空闲。录入时间按莫斯科时间保存；本设置只影响新录入/编辑时的计算花销，不改历史已保存的计算值。</p>
      <div class="table-wrap mu-price-scroll"><table class="grid mu-price-table" id="mu-price-table">
        <thead><tr><th>模型 key</th><th>显示名</th><th>缓存命中 空闲</th><th>缓存命中 高峰</th>
          <th>未命中输入 空闲</th><th>未命中输入 高峰</th><th>输出 空闲</th><th>输出 高峰</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="9"><span class="mu-muted">至少保留一个模型。</span></td></tr>'}</tbody>
      </table></div>
      <div class="mu-price-actions"><button class="btn soft sm" data-price-add="1">＋ 新增模型</button></div>
      <div class="mu-price-error" id="mu-price-error"></div>
      <section class="mu-holiday-box"><h4>中国法定节假日（可配置）</h4>
        <div class="mu-holiday-list">${holidayChips}</div>
        <div class="mu-holiday-add"><input class="input" type="date" id="mu-holiday-new"><button class="btn soft sm" data-holiday-add="1">添加日期</button></div>
        <p class="mu-muted">默认空列表，不内置任何法定节假日；由你按需要维护。日期按北京时间判定。</p>
      </section>
    </div>`;
    body.onclick = e => {
      const add = e.target.closest('[data-price-add]');
      if (add) {
        capture();
        let n = 1, key = 'new-model';
        while (draftModels.some(x => x.key === key)) { n += 1; key = 'new-model-' + n; }
        draftModels.push({ key, label: '', cache_read: { offpeak: '', peak: '' }, uncached_input: { offpeak: '', peak: '' }, output: { offpeak: '', peak: '' } });
        render();
        return;
      }
      const del = e.target.closest('[data-price-del]');
      if (del) {
        capture();
        draftModels.splice(Number(del.dataset.priceDel), 1);
        render();
        return;
      }
      const addHoliday = e.target.closest('[data-holiday-add]');
      if (addHoliday) {
        capture();
        const input = body.querySelector('#mu-holiday-new');
        const value = input ? String(input.value || '').trim() : '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) { error('请选择节假日日期'); return; }
        if (!draftHolidays.includes(value)) draftHolidays.push(value);
        draftHolidays.sort();
        render();
        return;
      }
      const delHoliday = e.target.closest('[data-holiday-del]');
      if (delHoliday) {
        capture();
        draftHolidays.splice(Number(delHoliday.dataset.holidayDel), 1);
        render();
      }
    };
  };

  render();
  m.body.style.maxHeight = '72vh';
  m.body.style.overflow = 'auto';
}

function muSavePricing(m) {
  const body = m.body;
  const errEl = body.querySelector('#mu-price-error');
  const setError = text => { if (errEl) errEl.textContent = text || ''; };
  const rows = body.querySelectorAll('#mu-price-table tbody tr');
  const models = {};
  const seen = new Set();
  try {
    [...rows].forEach(tr => {
      const val = sel => {
        const el = tr.querySelector(sel);
        return el ? String(el.value || '').trim() : '';
      };
      const key = val('[data-pk]');
      if (!MU_MODEL_KEY_RE.test(key)) throw new Error('模型 key 不合法：' + (key || '（空）'));
      if (seen.has(key)) throw new Error('模型 key 重复：' + key);
      seen.add(key);
      const price = sel => {
        const raw = val(sel);
        if (!raw) throw new Error(key + ' 的价格不能为空');
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) throw new Error(key + ' 的价格必须为非负数字');
        return n;
      };
      models[key] = {
        label: val('[data-pl]') || key,
        cache_read: { offpeak: price('[data-cr-o]'), peak: price('[data-cr-p]') },
        uncached_input: { offpeak: price('[data-ui-o]'), peak: price('[data-ui-p]') },
        output: { offpeak: price('[data-out-o]'), peak: price('[data-out-p]') },
      };
    });
    if (!Object.keys(models).length) throw new Error('至少保留一个模型');
  } catch (e) {
    setError(e.message || String(e));
    return;
  }
  const holidays = [...new Set([...body.querySelectorAll('[data-holiday]')].map(el => el.dataset.holiday))]
    .filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort();
  const btn = m.mask.querySelector('.modal .m-actions .btn:last-child');
  if (btn) btn.disabled = true;
  setError('');
  apiPost('/api/plugin/model_usage/pricing', { models, holidays }).then(r => {
    if (btn) btn.disabled = false;
    if (!r || !r.ok) {
      setError((r && r.error) || '保存价目失败');
      return;
    }
    MU.pricing = r.pricing || { models: {}, holidays: [] };
    m.mask.remove();
    muFillModelSelect($('#mu-model') ? $('#mu-model').value : '');
    muUpdateCalc();
    muPaint();
    toast('价目与节假日已保存 ✓', 'success');
  });
}

window.__toolRenderers['model-usage'] = renderModelUsageTool;
})();



/* finance 插件共享纯函数与常量；无 DOM、无 localStorage 写入。 */
export const FIN_CHART_PREFS_KEY = 'rt_fin_chart_prefs';
export const FIN_ACCT_TYPES = [['cash', '现金'], ['bank', '银行卡'], ['wallet', '电子钱包'],
  ['broker', '券商'], ['pension', '退休金'], ['fund', '公积金'],
  ['receivable', '应收(借出)'], ['other', '其他']];
export const FIN_LIAB_KINDS = [['loan', '贷款'], ['credit', '信用卡'],
  ['friend', '亲友借款'], ['payable', '应付']];
export const FIN_REAL_CATS = [['house', '房产'], ['car', '车辆'], ['metal', '贵金属'],
  ['jewel', '珠宝'], ['collect', '收藏'], ['equip', '设备']];
export const FIN_TAX = { CNY: '¥', RUB: '₽', USD: '$', EUR: '€' };

export function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function finAddDays(dateStr, n) {
  const d = new Date(String(dateStr).replace(/-/g, '/') + ' 00:00:00');
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}

export function finToBase(fx, amount, cur) {
  return (amount || 0) * (fx && fx[cur] != null ? fx[cur] : 1);
}

export function finNum(n) {
  return String(Math.round((n || 0) * 100) / 100);
}

export function finPct(n) {
  const abs = Math.abs(n);
  if (abs >= 100) return n.toFixed(0);
  if (abs >= 10) return n.toFixed(1);
  if (abs >= 1) return n.toFixed(2);
  if (abs >= 0.1) return n.toFixed(3);
  return n.toFixed(4);
}

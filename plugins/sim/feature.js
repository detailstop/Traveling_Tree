'use strict';
/* 按需加载的功能模块：sim */
(function () {
/* ============================================================
   随机模拟器（蒙特卡洛 · 条件多叉树）
   L1 模拟问题 → L2 初始条件 → 动画模拟 → 统计可视化
   ============================================================ */
const SIM_KEY = 'rt_sim';
function simRng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function simGauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function simFieldHTML(fields, cur) {
  return fields.map(f => {
    const v = cur && cur[f.k] != null ? cur[f.k] : f.def;
    if (f.type === 'select') return `<label class="sim-f">${f.label}<select class="input sim-in" data-k="${f.k}">${f.opts.map(([ov, ot]) => `<option value="${ov}" ${String(v) === String(ov) ? 'selected' : ''}>${ot}</option>`).join('')}</select></label>`;
    return `<label class="sim-f">${f.label}<input class="input sim-in" data-k="${f.k}" type="number" value="${v}"${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''}${f.step != null ? ` step="${f.step}"` : ''}></label>`;
  }).join('');
}
function simBar(rows) {
  return rows.map(([l, v]) => `<div class="sim-stat"><div class="sim-sl">${l}</div><div class="sim-sv">${v}</div></div>`).join('');
}

/* ---------- 随机游走 · 方向概率与运动 ---------- */
function simBuildProbs(ps, n) {
  // n 个方向仅需 n-1 个概率：第 n 个 = 100% - 前 n-1 个之和，随后归一化保证完备
  const raw = ps.slice(0, n - 1).map(x => Math.max(0, Math.min(100, x == null ? 0 : Number(x))));
  if (raw.length < n - 1 || raw.every(v => v === 0)) return Array(n).fill(1 / n);   // 未设置 → 均等
  const arr = raw.slice();
  arr.push(Math.max(0, 100 - arr.reduce((a, b) => a + b, 0)));
  const tot = arr.reduce((a, b) => a + b, 0);
  return tot > 0 ? arr.map(x => x / tot) : Array(n).fill(1 / n);
}
function simSampleDir(rng, probs) {
  let r = rng();
  for (let i = 0; i < probs.length; i++) { if (r < probs[i]) return i; r -= probs[i]; }
  return probs.length - 1;
}
function simMove(rng, cfg) {
  const L = cfg.stepLen;
  if (cfg.dirMode === '4' || cfg.dirMode === '8') {
    const n = cfg.dirMode === '4' ? 4 : 8;
    const ps = [];
    for (let i = 0; i < n - 1; i++) ps.push(cfg['p' + (i + 1)]);
    const probs = simBuildProbs(ps, n);
    const idx = simSampleDir(rng, probs);
    const a = idx * 2 * Math.PI / n;   // 0=右 → 顺时针：右/下/左/上
    return [Math.cos(a) * L, Math.sin(a) * L];
  }
  // 连续式（任意方向）：以中心角 gaussMean° 为 0 的正态概率密度，截断归一化到 [-180°, 180°]
  const sigma = Math.max(1, (cfg.gaussA || 90) / 2);   // a ≈ 2σ：约 95% 落在 ±a
  let ang;
  do { ang = (cfg.gaussMean || 0) + simGauss(rng) * sigma; } while (ang < -180 || ang > 180);
  const a = ang * Math.PI / 180;
  return [Math.cos(a) * L, Math.sin(a) * L];
}
function simCliffTrials(cfg) {
  // 落崖概率统计学模拟：预计算 trials 次独立试验的落崖占比（每次试验至多 min(steps,800) 步，性能可控）
  const n = Math.max(1, Math.min(cfg.trials || 200, 2000));
  const maxSteps = Math.min(cfg.steps || 3000, 800);
  let fallen = 0;
  const last = { f: false, path: [[0, 0]] };
  for (let t = 0; t < n; t++) {
    const rng = simRng(((cfg.seed | 0) * 1000003 + t + 1) >>> 0);
    let x = 0, y = 0, f = false;
    const path = [[0, 0]];
    for (let s = 0; s < maxSteps; s++) {
      const m = simMove(rng, cfg);
      x += m[0]; y += m[1];
      if (simFell(cfg, 'cliff', x, y)) { f = true; break; }
      if (path.length < 1200) path.push([x, y]);
    }
    if (f) fallen++;
    if (t === n - 1) { last.f = f; last.path = path; last.end = [x, y]; }
  }
  return { n, fallen, ratio: fallen / n, last };
}
/* ---------- 自定义边界（极坐标） · 圆 / 矩形（对角点） / 直线（两极点） ---------- */
function simPolar(t, r) { const a = (t || 0) * Math.PI / 180; return [Math.cos(a) * r, Math.sin(a) * r]; }
function simLineBound(P1, P2) {
  // 两点确定直线：单位法向量 n 与截距 d，使有向距离 f(P)=n·P−d 满足 f(原点)≤0（原点恒在界内）
  const dx = P2[0] - P1[0], dy = P2[1] - P1[1];
  const L = Math.hypot(dx, dy);
  if (L < 1e-6) return { n: [0, 1], d: 0 };
  let nx = -dy / L, ny = dx / L;
  let d = nx * P1[0] + ny * P1[1];
  if (d < 0) { nx = -nx; ny = -ny; d = -d; }
  return { n: [nx, ny], d };
}
function simBoundMax(cfg, p) {
  // 边界外接范围（px）：用于自适应画布缩放
  const shape = cfg[p + 'Shape'];
  if (shape === 'circle') { const [cx, cy] = simPolar(cfg[p + 'CT'], cfg[p + 'CD']); return Math.hypot(cx, cy) + (cfg[p + 'CR'] || 0); }
  const A = simPolar(cfg[p + 'AT'] != null ? cfg[p + 'AT'] : cfg[p + 'LT1'], cfg[p + 'AR'] != null ? cfg[p + 'AR'] : cfg[p + 'LR1']);
  const B = simPolar(cfg[p + 'BT'] != null ? cfg[p + 'BT'] : cfg[p + 'LT2'], cfg[p + 'BR'] != null ? cfg[p + 'BR'] : cfg[p + 'LR2']);
  return Math.max(Math.hypot(A[0], A[1]), Math.hypot(B[0], B[1]));
}
function simBounce(cfg, p, x, y) {
  // 墙反弹：圆 → 半径 clamp；矩形 → AABB clamp；直线 → 关于直线镜像反射
  const shape = cfg[p + 'Shape'];
  if (shape === 'circle') {
    const [cx, cy] = simPolar(cfg[p + 'CT'], cfg[p + 'CD']);
    const R = cfg[p + 'CR'] || 0;
    const dx = x - cx, dy = y - cy, dd = Math.hypot(dx, dy);
    if (dd > R && dd > 0) { x = cx + dx / dd * R; y = cy + dy / dd * R; }
  } else if (shape === 'rect') {
    const [ax, ay] = simPolar(cfg[p + 'AT'], cfg[p + 'AR']);
    const [bx, by] = simPolar(cfg[p + 'BT'], cfg[p + 'BR']);
    const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
    if (x < x0) x = x0; if (x > x1) x = x1; if (y < y0) y = y0; if (y > y1) y = y1;
  } else if (shape === 'line') {
    const [ax, ay] = simPolar(cfg[p + 'LT1'], cfg[p + 'LR1']);
    const [bx, by] = simPolar(cfg[p + 'LT2'], cfg[p + 'LR2']);
    const B = simLineBound([ax, ay], [bx, by]);
    const f = B.n[0] * x + B.n[1] * y - B.d;
    if (f > 0) { x -= 2 * f * B.n[0]; y -= 2 * f * B.n[1]; }
  }
  return [x, y];
}
function simFell(cfg, p, x, y) {
  // 崖判定：越出圆 / 越出矩形 / 越过直线 → 落崖
  const shape = cfg[p + 'Shape'];
  if (shape === 'circle') {
    const [cx, cy] = simPolar(cfg[p + 'CT'], cfg[p + 'CD']);
    return Math.hypot(x - cx, y - cy) > (cfg[p + 'CR'] || 0);
  }
  if (shape === 'rect') {
    const [ax, ay] = simPolar(cfg[p + 'AT'], cfg[p + 'AR']);
    const [bx, by] = simPolar(cfg[p + 'BT'], cfg[p + 'BR']);
    return x < Math.min(ax, bx) || x > Math.max(ax, bx) || y < Math.min(ay, by) || y > Math.max(ay, by);
  }
  const [ax, ay] = simPolar(cfg[p + 'LT1'], cfg[p + 'LR1']);
  const [bx, by] = simPolar(cfg[p + 'LT2'], cfg[p + 'LR2']);
  const B = simLineBound([ax, ay], [bx, by]);
  return B.n[0] * x + B.n[1] * y - B.d > 0;
}
function simShapeFields(p, shape, cfg) {
  // 按形状生成条件字段；圆半径沿用旧 wallDist/cliffDist 以兼容已有配置
  const isWall = p === 'wall';
  const R = cfg[p + 'CR'] || (isWall ? (cfg.wallDist || 120) : (cfg.cliffDist || 100));
  if (shape === 'circle') return [
    { k: p + 'CR', label: '半径（px）', type: 'number', def: R, min: 10, max: 500 },
    { k: p + 'CT', label: '圆心 · 角度（°）', type: 'number', def: 0, min: -180, max: 180 },
    { k: p + 'CD', label: '圆心 · 距离（px）', type: 'number', def: 0, min: 0, max: 400 },
  ];
  if (shape === 'rect') return [
    { k: p + 'AT', label: '角点 A · 角度（°）', type: 'number', def: 135, min: -180, max: 180 },
    { k: p + 'AR', label: '角点 A · 距离（px）', type: 'number', def: Math.round(R * 1.4142), min: 10, max: 600 },
    { k: p + 'BT', label: '角点 B · 角度（°）', type: 'number', def: -45, min: -180, max: 180 },
    { k: p + 'BR', label: '角点 B · 距离（px）', type: 'number', def: Math.round(R * 1.4142), min: 10, max: 600 },
  ];
  return [
    { k: p + 'LT1', label: '端点 1 · 角度（°）', type: 'number', def: 30, min: -180, max: 180 },
    { k: p + 'LR1', label: '端点 1 · 距离（px）', type: 'number', def: R, min: 10, max: 600 },
    { k: p + 'LT2', label: '端点 2 · 角度（°）', type: 'number', def: 150, min: -180, max: 180 },
    { k: p + 'LR2', label: '端点 2 · 距离（px）', type: 'number', def: R, min: 10, max: 600 },
  ];
}
function simDrawBound(ctx, p, cfg, cxp, cyp, S) {
  // 绘制边界：圆/矩形/直线（虚线 + 锚点标记）
  const shape = cfg[p + 'Shape'];
  ctx.save();
  ctx.strokeStyle = 'rgba(251,113,133,.55)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
  ctx.fillStyle = 'rgba(251,113,133,.8)';
  if (shape === 'circle') {
    const [cx, cy] = simPolar(cfg[p + 'CT'], cfg[p + 'CD']);
    const R = cfg[p + 'CR'] || 0;
    ctx.beginPath(); ctx.arc(cxp + cx * S, cyp + cy * S, R * S, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cxp + cx * S, cyp + cy * S, 3.5, 0, Math.PI * 2); ctx.fill();
  } else if (shape === 'rect') {
    const [ax, ay] = simPolar(cfg[p + 'AT'], cfg[p + 'AR']);
    const [bx, by] = simPolar(cfg[p + 'BT'], cfg[p + 'BR']);
    const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
    ctx.strokeRect(cxp + x0 * S, cyp + y0 * S, (x1 - x0) * S, (y1 - y0) * S);
    [[ax, ay], [bx, by]].forEach(pt => { ctx.beginPath(); ctx.arc(cxp + pt[0] * S, cyp + pt[1] * S, 3.5, 0, Math.PI * 2); ctx.fill(); });
  } else {
    const [ax, ay] = simPolar(cfg[p + 'LT1'], cfg[p + 'LR1']);
    const [bx, by] = simPolar(cfg[p + 'LT2'], cfg[p + 'LR2']);
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    ctx.beginPath();
    ctx.moveTo(cxp + (ax - ux * 400) * S, cyp + (ay - uy * 400) * S);
    ctx.lineTo(cxp + (bx + ux * 400) * S, cyp + (by + uy * 400) * S);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(cxp + ax * S, cyp + ay * S); ctx.lineTo(cxp + bx * S, cyp + by * S); ctx.stroke();
    [[ax, ay], [bx, by]].forEach(pt => { ctx.beginPath(); ctx.arc(cxp + pt[0] * S, cyp + pt[1] * S, 3.5, 0, Math.PI * 2); ctx.fill(); });
  }
  ctx.restore();
}
function simFieldGroups(M, cfg) {
  // 条件化字段：返回分组 [{ title, fields }]；未定义 condFields 的模型保持单组
  if (!M.condFields) return [{ title: '', fields: M.fields }];
  return M.condFields(cfg);
}
function simAllDefs(M) {
  // 收集该模型所有可能出现的字段默认值（含条件字段）
  const defs = {};
  if (M.condFields) {
    const probes = [];
    const push = g => g.forEach(gr => (gr.fields || []).forEach(f => { if (!probes.some(x => x.k === f.k)) probes.push(f); }));
    push(M.condFields({ dirMode: '4', boundary: 'wall' }));
    push(M.condFields({ dirMode: '8', boundary: 'wall' }));
    push(M.condFields({ dirMode: 'any', boundary: 'wall' }));
    push(M.condFields({ dirMode: '4', boundary: 'cliff', cliffMode: 'stats' }));
    push(M.condFields({ dirMode: '4', boundary: 'cliff', cliffMode: 'single' }));
    push(M.condFields({ dirMode: '4', boundary: 'none' }));
    ['wall', 'cliff'].forEach(p => ['circle', 'rect', 'line'].forEach(sh => {
      simShapeFields(p, sh, {}).forEach(f => { if (!probes.some(x => x.k === f.k)) probes.push(f); });
    }));
    probes.forEach(f => { defs[f.k] = f.def; });
  } else {
    M.fields.forEach(f => { defs[f.k] = f.def; });
  }
  return defs;
}

const SIM_MODELS = {
  /* ---------------- 醉汉问题（随机游走） ---------------- */
  drunk: {
    name: '醉汉问题', icon: '🚶', desc: '经典二维随机游走：验证 MSD ≈ N·l² 与位移分布',
    fields: [
      { k: 'steps', label: '步数', type: 'number', def: 3000, min: 100, max: 50000 },
      { k: 'stepLen', label: '步长（px）', type: 'number', def: 6, min: 1, max: 50 },
      { k: 'dirMode', label: '方向模式', type: 'select', opts: [['4', '四方向（离散）'], ['8', '八方向（离散）'], ['any', '任意角度（连续）']] },
      { k: 'perFrame', label: '每帧步数', type: 'number', def: 3, min: 1, max: 40 },
      { k: 'seed', label: '随机种子', type: 'number', def: 1 },
    ],
    // L2 条件化初始条件：L2-1 通用（步数/步长/方向/每帧/种子）+ 方向模式扩展；L2-2 特定（问题模式 + 墙/崖）
    condFields(cfg) {
      const dirs = [];
      if (cfg.dirMode === '4') dirs.push(
        { k: 'p1', label: '右方向概率 %', type: 'number', def: 25, min: 0, max: 100 },
        { k: 'p2', label: '下方向概率 %', type: 'number', def: 25, min: 0, max: 100 },
        { k: 'p3', label: '左方向概率 %', type: 'number', def: 25, min: 0, max: 100 });
      else if (cfg.dirMode === '8') dirs.push(
        { k: 'p1', label: '右方向概率 %', type: 'number', def: 12.5, min: 0, max: 100 },
        { k: 'p2', label: '右下概率 %', type: 'number', def: 12.5, min: 0, max: 100 },
        { k: 'p3', label: '下方向概率 %', type: 'number', def: 12.5, min: 0, max: 100 },
        { k: 'p4', label: '左下概率 %', type: 'number', def: 12.5, min: 0, max: 100 },
        { k: 'p5', label: '左方向概率 %', type: 'number', def: 12.5, min: 0, max: 100 },
        { k: 'p6', label: '左上概率 %', type: 'number', def: 12.5, min: 0, max: 100 },
        { k: 'p7', label: '上方向概率 %', type: 'number', def: 12.5, min: 0, max: 100 });
      else dirs.push(
        { k: 'gaussMean', label: '中心角（°）', type: 'number', def: 0, min: -180, max: 180 },
        { k: 'gaussA', label: '集中度 ±a（°）', type: 'number', def: 90, min: 1, max: 180 });
      const spec = [];
      if (cfg.boundary === 'wall') {
        spec.push({ k: 'wallShape', label: '墙形状', type: 'select', def: cfg.wallShape || 'circle', opts: [['circle', '圆形'], ['rect', '矩形（对角点）'], ['line', '直线（两极点）']] });
        spec.push(...simShapeFields('wall', cfg.wallShape || 'circle', cfg));
      }
      if (cfg.boundary === 'cliff') {
        spec.push({ k: 'cliffShape', label: '崖形状', type: 'select', def: cfg.cliffShape || 'circle', opts: [['circle', '圆形'], ['rect', '矩形（对角点）'], ['line', '直线（两极点）']] });
        spec.push(...simShapeFields('cliff', cfg.cliffShape || 'circle', cfg));
        spec.push({ k: 'cliffMode', label: '落崖模拟类型', type: 'select', def: 'single', opts: [['single', '单次落崖模拟'], ['stats', '落崖概率统计']] });
        if (cfg.cliffMode === 'stats') spec.push({ k: 'trials', label: '模拟次数', type: 'number', def: 200, min: 10, max: 2000 });
      }
      return [
        { title: 'L2-1 · 通用初始条件', fields: [
          { k: 'steps', label: '步数', type: 'number', def: 3000, min: 100, max: 50000 },
          { k: 'stepLen', label: '步长（px）', type: 'number', def: 6, min: 1, max: 50 },
          { k: 'dirMode', label: '方向模式', type: 'select', def: '4', opts: [['4', '四方向（离散）'], ['8', '八方向（离散）'], ['any', '任意角度（连续）']] },
          ...dirs,
          { k: 'perFrame', label: '每帧步数', type: 'number', def: 3, min: 1, max: 40 },
          { k: 'seed', label: '随机种子', type: 'number', def: 1 },
        ] },
        { title: 'L2-2 · 特定条件（问题模式）', fields: [
          { k: 'boundary', label: '问题模式', type: 'select', def: 'none', opts: [['none', '无界自由游走'], ['wall', '撞墙反弹'], ['cliff', '落崖停止']] },
          ...spec,
        ] },
      ];
    },
    init(cfg, W, H) {
      const base = { rng: simRng(cfg.seed), x: 0, y: 0, path: [[0, 0]], step: 0, maxD: 0, msdSum: 0, home: 0, done: false, fallen: false };
      if (cfg.boundary === 'cliff' && cfg.cliffMode === 'stats') {
        // 统计学模式：预计算 trials 次试验的落崖占比（结果立即可读，不逐帧推进）
        const t = simCliffTrials(cfg);
        return Object.assign(base, { done: true, trial: t, path: t.last.path, x: t.last.end[0], y: t.last.end[1] });
      }
      return base;
    },
    step(cfg, st, W, H) {
      if (st.done) return;
      const rng = st.rng;
      for (let i = 0; i < cfg.perFrame && st.step < cfg.steps; i++) {
        const mv = simMove(rng, cfg);
        let nx = st.x + mv[0], ny = st.y + mv[1];
        if (cfg.boundary === 'wall') {
          const b = simBounce(cfg, 'wall', nx, ny); nx = b[0]; ny = b[1];   // 自定义形状反弹
        }
        st.x = nx; st.y = ny; st.step++;
        if (cfg.boundary === 'cliff' && simFell(cfg, 'cliff', st.x, st.y)) {
          st.fallen = true; st.done = true;   // 落崖停止
          break;
        }
        const d = Math.hypot(st.x, st.y);
        if (d > st.maxD) st.maxD = d;
        st.msdSum += d * d;
        if (d < cfg.stepLen * 0.5 && st.step > 0) st.home++;
        if (st.path.length < 6000) st.path.push([st.x, st.y]);
      }
      if (st.step >= cfg.steps) st.done = true;
    },
    draw(ctx, cfg, st, W, H) {
      const cxp = W / 2, cyp = H / 2;
      let lim = 0;
      if (cfg.boundary === 'wall') lim = Math.max(lim, simBoundMax(cfg, 'wall'));
      if (cfg.boundary === 'cliff') lim = Math.max(lim, simBoundMax(cfg, 'cliff'));
      let S = Math.min(W, H) / 2 / 240;
      if (st.maxD > 190 || lim > 190) S = Math.min(W, H) / 2 / (Math.max(st.maxD, lim) * 1.25);
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(148,163,184,.14)'; ctx.lineWidth = 1;
      for (let g = -600; g <= 600; g += 50) {
        const x = cxp + g * S, y = cyp + g * S;
        if (x >= 0 && x <= W) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        if (y >= 0 && y <= W) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      }
      if (cfg.boundary === 'wall') simDrawBound(ctx, 'wall', cfg, cxp, cyp, S);
      if (cfg.boundary === 'cliff') simDrawBound(ctx, 'cliff', cfg, cxp, cyp, S);
      ctx.fillStyle = 'rgba(148,163,184,.7)';
      ctx.beginPath(); ctx.arc(cxp, cyp, 4, 0, Math.PI * 2); ctx.fill();
      if (st.path.length > 1) {
        ctx.beginPath();
        for (let i = 0; i < st.path.length; i++) {
          const x = cxp + st.path[i][0] * S, y = cyp + st.path[i][1] * S;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(99,179,237,.6)'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke();
      }
      const px = cxp + st.x * S, py = cyp + st.y * S;
      if (st.fallen) {
        ctx.fillStyle = '#f87171';
        ctx.beginPath(); ctx.arc(px, py, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('💀', px, py + 4);
        ctx.fillStyle = 'rgba(248,113,113,.16)';
        ctx.beginPath(); ctx.arc(px, py, 20, 0, Math.PI * 2); ctx.fill();
        return;
      }
      ctx.fillStyle = '#ffb454';
      ctx.beginPath(); ctx.arc(px, py, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px - 4.5, py - 2, 3, 0, Math.PI * 2); ctx.arc(px + 4.5, py - 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(px, py + 4, 5, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    },
    stats(cfg, st) {
      const L = cfg.stepLen || 1;
      if (cfg.boundary === 'cliff' && cfg.cliffMode === 'stats' && st.trial) {
        const sh = cfg.cliffShape || 'circle';
        const shName = ({ circle: '圆形', rect: '矩形', line: '直线' })[sh] || sh;
        return [
          ['落崖占比', (st.trial.ratio * 100).toFixed(2) + '%'],
          ['落崖 / 试验', st.trial.fallen + ' / ' + st.trial.n + ' 次'],
          ['单次试验步数上限', Math.min(cfg.steps || 3000, 800) + ' 步'],
          ['崖边界', shName + ' · ' + simBoundMax(cfg, 'cliff').toFixed(0) + ' px'],
        ];
      }
      const rows = [
        ['进度', st.step + ' / ' + cfg.steps + ' 步'],
        ['距原点位移', (Math.hypot(st.x, st.y) / L).toFixed(2) + ' 步'],
        ['最大距离', (st.maxD / L).toFixed(2) + ' 步'],
        ['MSD 均方位移', st.step ? (st.msdSum / st.step / (L * L)).toFixed(2) + ' 步²' : '—'],
        ['回到原点', st.home + ' 次'],
        ['理论 MSD', '≈ ' + cfg.steps + '·l²'],
      ];
      if (cfg.boundary === 'cliff') rows.push(['状态', st.fallen ? '💀 已落崖' : '存活中']);
      return rows;
    },
  },

  /* ---------------- 粒子沉积 ---------------- */
  deposit: {
    name: '粒子沉积', icon: '🏔️', desc: 'DLA 扩散聚集 / 随机沉降：观察分形结构与堆积形态',
    fields: [
      { k: 'count', label: '目标粒子数', type: 'number', def: 400, min: 20, max: 2000 },
      { k: 'mode', label: '沉积模式', type: 'select', opts: [['dla', 'DLA 扩散聚集'], ['rain', '随机沉降（雨滴）']] },
      { k: 'stick', label: '粘附概率 %', type: 'number', def: 100, min: 1, max: 100 },
      { k: 'radius', label: '粒子半径', type: 'number', def: 3, min: 1, max: 8 },
      { k: 'perFrame', label: '每帧发射数', type: 'number', def: 3, min: 1, max: 20 },
      { k: 'seed', label: '随机种子', type: 'number', def: 1 },
    ],
    init(cfg, W, H) {
      const key = (x, y) => x + ',' + y;
      const set = new Set();
      if (cfg.mode === 'rain') {
        const gy = Math.round(H - 4);
        for (let gx = 2; gx <= W - 2; gx += 3) set.add(key(gx, gy));
        return { rng: simRng(cfg.seed), set, key, cx: 0, cy: gy, count: 0, walk: null, dropped: 0, done: false };
      }
      const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
      set.add(key(cx, cy));
      return { rng: simRng(cfg.seed), set, key, cx, cy, count: 1, maxR: 0, walk: null, dropped: 0, done: false };
    },
    step(cfg, st, W, H) {
      if (st.done) return;
      const rng = st.rng;
      for (let i = 0; i < cfg.perFrame && st.count < cfg.count; i++) {
        if (!st.walk) {
          let x, y;
          if (cfg.mode === 'rain') { x = 8 + rng() * (W - 16); y = 6; }
          else {
            // DLA：从结构边缘（当前最大半径 + 25px）的圆环上发射，大幅缩短游走距离
            const ang = rng() * Math.PI * 2;
            const rr = Math.max(20, st.maxR + 25);
            x = Math.min(Math.max(st.cx + Math.cos(ang) * rr, 6), W - 6);
            y = Math.min(Math.max(st.cy + Math.sin(ang) * rr, 6), H - 6);
          }
          st.walk = { x, y, life: 0 };
        }
        const w = st.walk, R = cfg.radius;
        let nx, ny;
        if (cfg.mode === 'rain') {
          nx = w.x + (rng() - 0.5) * 0.8;
          ny = w.y + 4.5;
        } else {
          const dx = st.cx - w.x, dy = st.cy - w.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist > Math.max(40, st.maxR + 35)) {
            // 逃逸保护：距结构过远时快速拉回
            nx = w.x + dx / dist * 3.5;
            ny = w.y + dy / dist * 3.5;
          } else {
            nx = w.x + Math.cos(rng() * Math.PI * 2) * 1.6 + dx / dist * 1.4;
            ny = w.y + Math.sin(rng() * Math.PI * 2) * 1.6 + dy / dist * 1.4;
          }
        }
        w.life++;
        if (nx < R || nx > W - R || ny < R || ny > H - R) { st.walk = null; continue; }
        const gx = Math.round(nx), gy = Math.round(ny);
        let touch = false;
        if (cfg.mode === 'rain') {
          // 雨滴：检测下方路径（下落 4.5px/步需探测 1-5px）+ 当前行侧向
          for (let oy = 1; oy <= 5 && !touch; oy++) for (let ox = -1; ox <= 1 && !touch; ox++) {
            if (st.set.has(st.key(gx + ox, gy + oy))) touch = true;
          }
          for (let ox = -1; ox <= 1 && !touch; ox++) if (st.set.has(st.key(gx + ox, gy))) touch = true;
        } else {
          for (let ox = -2; ox <= 2 && !touch; ox++) for (let oy = -2; oy <= 2 && !touch; oy++) {
            if (st.set.has(st.key(gx + ox, gy + oy))) touch = true;
          }
        }
        if (touch) {
          if (rng() * 100 < cfg.stick) {
            st.set.add(st.key(gx, gy));
            st.count++; st.dropped++;
            const rr2 = Math.hypot(gx - st.cx, gy - st.cy);
            if (rr2 > st.maxR) st.maxR = rr2;
            st.walk = null;
          } else if (w.life > 4000) { st.walk = null; }
          else { w.x = nx; w.y = ny; }
        } else { w.x = nx; w.y = ny; }
      }
      if (st.count >= cfg.count) { st.done = true; st.walk = null; }
    },
    draw(ctx, cfg, st, W, H) {
      ctx.clearRect(0, 0, W, H);
      const R = cfg.radius;
      ctx.fillStyle = 'rgba(251,191,36,.9)';
      st.set.forEach(k => {
        const i = k.indexOf(',');
        ctx.fillRect(+k.slice(0, i) - R / 2, +k.slice(i + 1) - R / 2, R, R);
      });
      if (st.walk) {
        ctx.fillStyle = '#7dd3fc';
        ctx.beginPath(); ctx.arc(st.walk.x, st.walk.y, R + 1, 0, Math.PI * 2); ctx.fill();
      }
    },
    stats(cfg, st) {
      let minY = 1e9, maxR = 0;
      st.set.forEach(k => {
        const i = k.indexOf(',');
        const x = +k.slice(0, i), y = +k.slice(i + 1);
        if (y < minY) minY = y;
        const r = Math.hypot(x - st.cx, y - st.cy);
        if (r > maxR) maxR = r;
      });
      const height = cfg.mode === 'rain' ? Math.max(0, Math.round((st.cy - minY) / (cfg.radius || 1))) + ' 层' : '半径 ' + Math.round(maxR) + ' px';
      return [
        ['沉积粒子', st.count + ' / ' + cfg.count],
        ['结构范围', height],
        ['完成度', st.done ? '100% ✓' : Math.round(st.count / cfg.count * 100) + '%'],
        ['粘附率', cfg.stick + '%'],
        ['模式', cfg.mode === 'rain' ? '随机沉降' : 'DLA 扩散聚集'],
        ['状态', st.done ? '已完成' : '沉积中…'],
      ];
    },
  },

  /* ---------------- 粒子自由运动 ---------------- */
  free: {
    name: '粒子自由运动', icon: '🌀', desc: '气体式运动：速度分布、平均动能、边界反射',
    fields: [
      { k: 'count', label: '粒子数', type: 'number', def: 120, min: 10, max: 500 },
      { k: 'speed', label: '速度基准', type: 'number', def: 2, min: 0.2, max: 10, step: 0.1 },
      { k: 'speedMode', label: '速度分布', type: 'select', opts: [['const', '恒定速率'], ['gauss', '麦克斯韦（正态近似）']] },
      { k: 'boundary', label: '边界', type: 'select', opts: [['wall', '弹性反射'], ['wrap', '周期（穿墙）']] },
      { k: 'factor', label: '时间倍率', type: 'number', def: 1, min: 0.1, max: 5, step: 0.1 },
      { k: 'seed', label: '随机种子', type: 'number', def: 1 },
    ],
    init(cfg, W, H) {
      const rng = simRng(cfg.seed);
      const ps = [];
      for (let i = 0; i < cfg.count; i++) {
        const a = rng() * Math.PI * 2;
        const sp = cfg.speedMode === 'const' ? cfg.speed : Math.abs(simGauss(rng)) * cfg.speed * 0.35 + cfg.speed * 0.25;
        ps.push({ x: 10 + rng() * (W - 20), y: 10 + rng() * (H - 20), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp });
      }
      return { rng, ps, t: 0, bounces: 0 };
    },
    step(cfg, st, W, H) {
      const dt = 0.06 * cfg.factor;
      for (const p of st.ps) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (cfg.boundary === 'wall') {
          if (p.x < 4) { p.x = 4; p.vx = Math.abs(p.vx); st.bounces++; }
          if (p.x > W - 4) { p.x = W - 4; p.vx = -Math.abs(p.vx); st.bounces++; }
          if (p.y < 4) { p.y = 4; p.vy = Math.abs(p.vy); st.bounces++; }
          if (p.y > H - 4) { p.y = H - 4; p.vy = -Math.abs(p.vy); st.bounces++; }
        } else {
          if (p.x < 4) p.x = W - 4; if (p.x > W - 4) p.x = 4;
          if (p.y < 4) p.y = H - 4; if (p.y > H - 4) p.y = 4;
        }
      }
      st.t += dt;
    },
    draw(ctx, cfg, st, W, H) {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1.5;
      ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
      for (let i = 0; i < st.ps.length; i++) {
        const p = st.ps[i];
        ctx.fillStyle = 'hsl(' + ((i * 137) % 360) + ',72%,68%)';
        ctx.beginPath(); ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2); ctx.fill();
        if (i < 14) {
          ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.vx * 8, p.y + p.vy * 8); ctx.stroke();
        }
      }
    },
    stats(cfg, st) {
      let vs = 0, v2 = 0;
      st.ps.forEach(p => { const v = Math.hypot(p.vx, p.vy); vs += v; v2 += v * v; });
      const n = st.ps.length || 1;
      return [
        ['模拟时间', st.t.toFixed(1) + ' s'],
        ['平均速率', (vs / n).toFixed(2)],
        ['RMS 速率', Math.sqrt(v2 / n).toFixed(2)],
        ['平均动能', (v2 / n / 2).toFixed(2) + ' 单位'],
        ['边界碰撞', st.bounces + ' 次'],
        ['粒子数', n],
      ];
    },
  },
};

function saveSimCfg() {
  localStorage.setItem(SIM_KEY, JSON.stringify({ model: S.sim.model, cfg: S.sim.cfg }));
}

function renderSimTool() {
  if (S.sim && S.sim.raf) { cancelAnimationFrame(S.sim.raf); S.sim.raf = null; }
  const dd = loadJSON(SIM_KEY, null) || {};
  const model = dd.model && SIM_MODELS[dd.model] ? dd.model : 'drunk';
  const M = SIM_MODELS[model];
  const defs = simAllDefs(M);
  const cfg = Object.assign(defs, dd.cfg || {});
  const box = $('#tool-view');
  box.innerHTML = `
    <div class="sim-wrap">
      <div class="sim-left">
        <div class="sim-tree-title">🎲 随机模拟器</div>
        <div class="sim-node-title">L1 · 模拟问题（多叉树）</div>
        <div class="sim-tree">${Object.keys(SIM_MODELS).map(id => {
          const m = SIM_MODELS[id];
          return `<button class="sim-node${id === model ? ' on' : ''}" data-model="${id}">
            <span class="sim-node-icon">${m.icon}</span>
            <span><b>${m.name}</b><small>${m.desc}</small></span></button>`;
        }).join('')}</div>
        <div class="sim-node-title">L2 · 初始条件（按所选条件动态出现）</div>
        <div class="sim-fields">${simFieldGroups(M, cfg).map(g => `
          ${g.title ? `<div class="sim-group-title">${g.title}</div>` : ''}
          <div class="sim-fg">${simFieldHTML(g.fields, cfg)}</div>`).join('')}</div>
        <div class="fin-note" style="margin-top:10px;">💡 修改条件自动重置 · 第 n 个方向概率自动补全 · 种子保证结果可复现</div>
      </div>
      <div class="sim-right">
        <div class="sim-canvas-box"><canvas id="sim-cv"></canvas></div>
        <div class="sim-ctrl">
          <button class="btn sm" id="sim-run">▶ 开始</button>
          <button class="btn sm soft" id="sim-reset">🔄 重置</button>
          <span id="sim-state" style="font-size:12px;color:var(--text-dim);">—</span>
        </div>
        <div class="sim-stats" id="sim-stats"></div>
      </div>
    </div>`;
  const cv = $('#sim-cv');
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.max(560, Math.round(cv.clientWidth * dpr));
  cv.height = Math.round(460 * dpr);
  S.sim = { model, cfg, raf: null, running: false };
  const reset = () => {
    const mm = SIM_MODELS[S.sim.model];
    const st = mm.init(S.sim.cfg, cv.width, cv.height);
    S.sim.state = st;
    mm.draw(cv.getContext('2d'), S.sim.cfg, st, cv.width, cv.height);
    const ss = $('#sim-stats');
    if (ss) ss.innerHTML = simBar(mm.stats(S.sim.cfg, st));
    const stl = $('#sim-state');
    if (stl) stl.textContent = '已就绪';
  };
  const loop = () => {
    if (!S.sim || !S.sim.running) return;
    const c2 = document.getElementById('sim-cv');
    if (!c2 || !c2.isConnected) { S.sim.running = false; S.sim.raf = null; return; }
    const mm = SIM_MODELS[S.sim.model];
    mm.step(S.sim.cfg, S.sim.state, c2.width, c2.height);
    mm.draw(c2.getContext('2d'), S.sim.cfg, S.sim.state, c2.width, c2.height);
    const ss = document.getElementById('sim-stats');
    if (ss) ss.innerHTML = simBar(mm.stats(S.sim.cfg, S.sim.state));
    S.sim.raf = requestAnimationFrame(loop);
  };
  $('#sim-run').onclick = () => {
    if (S.sim.running) {
      S.sim.running = false; cancelAnimationFrame(S.sim.raf); S.sim.raf = null;
      $('#sim-run').textContent = '▶ 开始';
      const stl = $('#sim-state'); if (stl) stl.textContent = '已暂停';
    } else {
      S.sim.running = true;
      $('#sim-run').textContent = '⏸ 暂停';
      loop();
    }
  };
  $('#sim-reset').onclick = () => {
    S.sim.running = false; cancelAnimationFrame(S.sim.raf); S.sim.raf = null;
    $('#sim-run').textContent = '▶ 开始';
    reset();
  };
  box.querySelector('.sim-tree').onclick = e => {
    const b = e.target.closest('.sim-node');
    if (!b || b.dataset.model === S.sim.model) return;
    S.sim.model = b.dataset.model;
    const nm = SIM_MODELS[S.sim.model];
    const nd = {};
    nm.fields.forEach(f => { nd[f.k] = f.def; });
    S.sim.cfg = nd;
    saveSimCfg();
    renderSimTool();
  };
  box.querySelector('.sim-fields').onchange = e => {
    const inp = e.target.closest('.sim-in');
    if (!inp) return;
    S.sim.cfg[inp.dataset.k] = inp.type === 'number' ? parseFloat(inp.value) : inp.value;
    saveSimCfg();
    S.sim.running = false; cancelAnimationFrame(S.sim.raf); S.sim.raf = null;
    const run = $('#sim-run'); if (run) run.textContent = '▶ 开始';
    if (['dirMode', 'boundary', 'cliffMode', 'wallShape', 'cliffShape'].includes(inp.dataset.k)) {
      renderSimTool();   // 条件联动：重建条件化字段
      return;
    }
    reset();
  };
  reset();
}


window.__toolRenderers.sim = renderSimTool;
})();

'use strict';
/* 按需加载的功能模块：screeps */
(function () {
  let ROOT = null;
/* ---------- Screeps Arena：三模式入口（Pain and Gain / Spawn and Swamp / Escort Run） ---------- */
let SC_VIEW = 'home'; // home | pain | sas | escort（与 hash 路由同步）
const SC_MODES = [
  { id: 'pain', route: '#/pain-and-gain', icon: '⚔️', name: 'Pain and Gain', desc: '抢占高价值房间，先发育者获胜', tint: 'linear-gradient(135deg,#e2543f,#c0392b)' },
  { id: 'sas', route: '#/spawn-and-swamp', icon: '🐊', name: 'Spawn and Swamp', desc: '沼泽地形下的基地攻防战', tint: 'linear-gradient(135deg,#3f9e5a,#2d7a44)' },
  { id: 'escort', route: '#/escort-run', icon: '🛡️', name: 'Escort Run', desc: '护送关键单位穿越战场', tint: 'linear-gradient(135deg,#4a7fd4,#2f5cb0)' },
];

function scRouteOf(id) {
  const m = SC_MODES.find(x => x.id === id);
  return m ? m.route : '';
}
function scIdOfRoute(route) {
  const m = SC_MODES.find(x => x.route === route);
  return m ? m.id : null;
}

function renderScreepsTool(container) {
  ROOT = container;
  const box = ROOT;
  const fromHash = scIdOfRoute(location.hash);
  if (fromHash) {
    SC_VIEW = fromHash;
    if (fromHash === 'sas') { renderScreepsSasPage(); return; }
    renderScreepsModePage(fromHash);
    return;
  }
  SC_VIEW = 'home';
  box.innerHTML = `
    <div style="padding:16px 0 8px;">
      <div style="font-size:22px;font-weight:700;margin-bottom:4px;">Screeps Arena</div>
      <div style="font-size:13px;color:var(--text-dim);">用 JavaScript / TypeScript 编写单位 AI 的编程竞技游戏 · 选择一种模式开始</div>
    </div>
    <div style="display:flex;gap:18px;justify-content:center;align-items:stretch;flex-wrap:wrap;padding:24px 0 12px;">
      ${SC_MODES.map(m => `
        <div data-route="${m.route}" style="width:250px;cursor:pointer;border-radius:14px;padding:26px 20px 22px;
             background:linear-gradient(160deg,var(--gcard-bg,#1b1e28),var(--gcard-bg2,#14161f));
             border:1px solid var(--line);box-shadow:0 2px 10px rgba(0,0,0,.25);transition:transform .16s,box-shadow .16s;
             display:flex;flex-direction:column;align-items:center;text-align:center;"
             onmouseover="this.style.transform='scale(1.04)';this.style.boxShadow='0 10px 28px rgba(0,0,0,.45),0 0 0 1px var(--accent-soft)'"
             onmouseout="this.style.transform='';this.style.boxShadow='0 2px 10px rgba(0,0,0,.25)'">
          <div style="width:64px;height:64px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:34px;
               background:${m.tint};box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);">${m.icon}</div>
          <div style="font-size:20px;font-weight:700;margin:16px 0 6px;">${m.name}</div>
          <div style="font-size:13px;color:var(--text-dim);line-height:1.6;">${m.desc}</div>
          <div style="margin-top:14px;font-size:12px;color:var(--accent);">进入开发页 →</div>
        </div>`).join('')}
    </div>`;
  box.querySelectorAll('[data-route]').forEach(el => el.onclick = () => {
    location.hash = el.dataset.route;
    renderScreepsTool(ROOT);
  });
}

/* 模式占位页：仅返回首页按钮 + 占位文案 */
/* ============ Spawn and Swamp：积木式配置工作台（第二步：三栏布局 + 假数据占位） ============ */
const SC_BLOCK_LIB = {
  unit: [
    { id: 'u-worker', icon: '👷', name: 'Worker 单位', desc: '采集 / 建造 / 运输' },
    { id: 'u-melee', icon: '⚔️', name: 'Melee 单位', desc: '近战攻击' },
    { id: 'u-ranged', icon: '🏹', name: 'Ranged 单位', desc: '远程攻击' },
    { id: 'u-healer', icon: '💊', name: 'Healer 单位', desc: '治疗友方' },
  ],
  action: [
    { id: 'a-harvest', icon: '⛏️', name: 'HARVEST', desc: '采集最近能量源' },
    { id: 'a-transfer', icon: '📦', name: 'TRANSFER', desc: '转移能量到建筑' },
    { id: 'a-move', icon: '🚶', name: 'MOVE_TO', desc: '移动到目标' },
    { id: 'a-attack', icon: '🗡️', name: 'ATTACK', desc: '攻击目标' },
    { id: 'a-heal', icon: '💚', name: 'HEAL', desc: '治疗友方' },
    { id: 'a-build', icon: '🔨', name: 'BUILD', desc: '建造扩展' },
    { id: 'a-retreat', icon: '🏃', name: 'RETREAT', desc: '撤退' },
    { id: 'a-wait', icon: '⏸️', name: 'WAIT', desc: '等待' },
  ],
  condition: [
    { id: 'c-hp', icon: '❤️', name: '血量低于 X', desc: '设置阈值参数' },
    { id: 'c-enemy', icon: '👁️', name: '范围内有敌人', desc: '检测敌方单位' },
    { id: 'c-energy-full', icon: '🔋', name: '能量已满', desc: '携带能量已满' },
    { id: 'c-energy-empty', icon: '🪫', name: '能量已空', desc: '携带能量已空' },
    { id: 'c-done', icon: '✅', name: '任务已完成', desc: 'Task 状态 DONE' },
  ],
  strategy: [
    { id: 's-boom', icon: '🌱', name: 'BOOM 发育', desc: 'tick<500 优先经济' },
    { id: 's-expand', icon: '🏗️', name: 'EXPAND 扩张', desc: '能量充足造扩展' },
    { id: 's-attack', icon: '🔥', name: 'ATTACK 进攻', desc: '军事优势时切换' },
    { id: 's-defend', icon: '🛡️', name: 'DEFEND 防守', desc: '敌方压境时切换' },
  ],
};

let SC_SAS_UNITS = [
  { id: 'u1', name: 'Worker', roleName: 'worker', bodyParts: ['WORK', 'CARRY', 'MOVE'], moduleStatus: 'NOT_GENERATED', lastGeneratedHash: '', blocks: [
    { kind: 'action', lib: 'a-harvest', params: { target: '最近能量源' }, next: '' },
    { kind: 'condition', lib: 'c-energy-full', params: { next: 'TRANSFER' }, next: 'TRANSFER' },
    { kind: 'action', lib: 'a-transfer', params: { target: '最近 Spawn / Extension' }, next: '' },
    { kind: 'condition', lib: 'c-enemy', params: { next: 'RETREAT' }, next: 'RETREAT' },
  ]},
  { id: 'u2', name: 'Melee', roleName: 'melee', bodyParts: ['ATTACK', 'MOVE', 'MOVE'], moduleStatus: 'NOT_GENERATED', lastGeneratedHash: '', blocks: [
    { kind: 'action', lib: 'a-move', params: { target: '敌方 Spawn' }, next: '' },
    { kind: 'action', lib: 'a-attack', params: { target: '最近敌方单位' }, next: '' },
    { kind: 'condition', lib: 'c-hp', params: { threshold: 30 }, next: 'RETREAT' },
    { kind: 'action', lib: 'a-retreat', params: { target: '我方 Spawn' }, next: '' },
  ]},
];

/* 配置哈希（djb2）：配置为唯一事实来源，任何变化都会改变哈希 */
function scSasDjb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
function scSasConfigHash(u) {
  const parts = (u.blocks || []).map(b => b.kind + '|' + b.lib + '|' + JSON.stringify(b.params || {}) + '|' + (b.next || ''));
  return scSasDjb2((u.name || '') + '|' + (u.bodyParts || []).join(',') + '|' + parts.join('~'));
}

/* 同步状态判定：配置 hash 与 lastGeneratedHash 比较 */
function scSasSyncStatus(u) {
  const hash = scSasConfigHash(u);
  if (hash === u.lastGeneratedHash) return 'SYNCED';
  return u.lastGeneratedHash ? 'STALE' : 'NOT_GENERATED';
}
/* 任何配置变化后调用：静默重算状态（不弹窗，由状态点呈现） */
function scSasMarkStale(uid) {
  const u = SC_SAS_UNITS.find(x => x.id === uid);
  if (!u) return;
  u.moduleStatus = scSasSyncStatus(u);
}

let SC_SAS_LIB_TAB = 'unit';
let SC_SAS_RIGHT_TAB = 'preview';
let SC_SAS_SELECTED = 'u1';

function scLibTab(t) {
  SC_SAS_LIB_TAB = t;
  const lib = $('#sc-lib');
  if (lib) { lib.innerHTML = scLibHTML(); scLibWireAdd(); }
}
function scLibWireAdd() {
  const lib = $('#sc-lib');
  if (!lib) return;
  lib.querySelectorAll('[data-add]').forEach(el => el.onclick = e => {
    e.stopPropagation();
    scSasAddBlock(el.dataset.kind, el.dataset.add);
  });
}
function scRightTab(t) {
  SC_SAS_RIGHT_TAB = t;
  const pv = $('#sc-right-preview'), ai = $('#sc-right-ai');
  const bt = $('#sc-tab-preview'), bt2 = $('#sc-tab-ai');
  if (pv) pv.style.display = t === 'preview' ? '' : 'none';
  if (ai) ai.style.display = t === 'ai' ? '' : 'none';
  if (bt) bt.style.background = t === 'preview' ? 'rgba(63,158,90,.25)' : '';
  if (bt2) bt2.style.background = t === 'ai' ? 'rgba(63,158,90,.25)' : '';
}
function scLibHTML() {
  const items = SC_BLOCK_LIB[SC_SAS_LIB_TAB] || [];
  return items.map(b => `
    <div draggable="true" data-lib="${b.id}" data-kind="${SC_SAS_LIB_TAB}"
         style="display:flex;gap:8px;align-items:center;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid var(--line);margin-bottom:8px;cursor:grab;"
         onmouseover="this.style.borderColor='var(--accent-soft)'" onmouseout="this.style.borderColor=''"
         ondragstart="scLibDragStart(event,'${b.id}','${SC_SAS_LIB_TAB}')" ondragend="scLibDragEnd(event)">
      <span style="font-size:18px;">${b.icon}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;">${b.name}</div>
        <div style="font-size:11px;color:var(--text-dim);">${b.desc}</div>
      </div>
      <span data-add="${b.id}" data-kind="${SC_SAS_LIB_TAB}" style="font-size:14px;color:var(--accent);cursor:pointer;" title="添加到当前单位">＋</span>
    </div>`).join('');
}

function scLibDragStart(e, libId, kind) {
  e.dataTransfer.setData('text/plain', kind + ':' + libId);
  e.dataTransfer.effectAllowed = 'copy';
  if (e.target.closest) e.target.closest('[draggable]').style.opacity = '.55';
}
function scLibDragEnd(e) {
  if (e.target.closest) e.target.closest('[draggable]').style.opacity = '';
  const cv = $('#sc-canvas');
  if (cv) cv.style.outline = '';
}

function scSasAddBlock(kind, libId) {
  const meta = SC_BLOCK_LIB[kind] ? SC_BLOCK_LIB[kind].find(x => x.id === libId) : null;
  if (!meta) return;
  if (kind === 'unit') {
    scSasAddUnit(meta.name.replace('单位', ''));
    return;
  }
  const u = SC_SAS_UNITS.find(x => x.id === SC_SAS_SELECTED);
  if (!u) { toast('请先选择单位卡片', 'warn'); return; }
  if (kind === 'strategy') { toast('战略积木将在第五步接入', 'info'); return; }
  u.blocks.push({
    kind,
    lib: libId,
    params: kind === 'condition' ? { next: 'IDLE' } : { target: '最近能量源' },
    next: '',
  });
  scSasMarkStale(u.id);
  scSasRenderCanvas();
  scSasRefreshStatus();
  toast('已添加 ' + meta.name + ' → ' + u.name, 'success');
}

function scSasRefreshStatus() {
  const total = SC_SAS_UNITS.reduce((s, x) => s + x.blocks.length, 0);
  const sel = SC_SAS_UNITS.find(x => x.id === SC_SAS_SELECTED);
  const st = $('#sc-st-unit');
  if (st) st.textContent = '当前选中单位：' + (sel ? sel.name : '无');
  const stc = $('#sc-st-count');
  if (stc) stc.textContent = '积木总数：' + total;
  const empty = SC_SAS_UNITS.filter(x => !x.blocks.length).map(x => x.name);
  const ok = $('#sc-st-ok');
  if (ok) ok.textContent = empty.length ? '配置合法性：⚠ ' + empty.join('、') + ' 缺少积木' : '配置合法性：✓ 合法';
  const orphans = scSasFindOrphans();
  const stOr = $('#sc-st-orphan');
  if (stOr) {
    if (orphans.length) {
      stOr.innerHTML = '⚠ 发现孤立文件 ' + orphans.map(p =>
        '<span style="font-family:Consolas,Menlo,monospace;">' + p + '</span> <button class="btn sm" data-or="' + p + '" style="padding:1px 6px;font-size:11px;">删除</button>'
      ).join(' ｜ ');
      stOr.querySelectorAll('[data-or]').forEach(el => el.onclick = () => scSasDelOrphan(el.dataset.or));
    } else {
      stOr.textContent = '';
    }
  }
}

/* 孤立文件检测：modules/roles/ 下已应用（非占位）但画布上无对应单位的文件 */
function scSasFindOrphans() {
  const roleNames = new Set(SC_SAS_UNITS.map(u => u.roleName).filter(Boolean));
  const orphans = [];
  SC_VFS_ORDER.filter(p => p.startsWith('modules/roles/') && SC_VFS[p]).forEach(p => {
    const c = SC_VFS[p].content;
    if (!c || c.trim().startsWith('//')) return; // 占位不算孤立
    const rn = p.replace('modules/roles/', '').replace('.ts', '');
    if (!roleNames.has(rn)) orphans.push(p);
  });
  return orphans;
}
function scSasDelOrphan(file) {
  if (!confirm('删除孤立文件 ' + file + '？（画布上不存在对应单位，且不会影响其他模块）')) return;
  delete SC_VFS[file];
  scSasRefreshStatus();
  toast('已删除孤立文件 ' + file, 'success');
}

/* ============ Spawn and Swamp：虚拟文件系统（第三步：固定框架 + 只读呈现） ============ */
const SC_VFS = {
  'framework/types.ts': {
    readonly: true,
    content: `export enum Phase {
  BOOM = 'BOOM',
  EXPAND = 'EXPAND',
  ATTACK = 'ATTACK',
  DEFEND = 'DEFEND'
}

export interface StrategyContext {
  phase: Phase;
  economyRatio: number;
  militaryRatio: number;
  priorities: string[];
  tick: number;
}

export type DemandType = 'HARVEST' | 'BUILD' | 'ATTACK' | 'DEFEND' | 'HEAL';

export interface Demand {
  id: string;
  type: DemandType;
  targetId: string;
  position: { x: number; y: number };
  priority: number;
  requiredBodyParts?: string[];
}

export interface Task {
  demand: Demand;
  creepId: string;
  status: 'PENDING' | 'ACTIVE' | 'DONE';
}

export interface GameAdapter {
  getMyCreeps(): Creep[];
  getEnemyCreeps(): Creep[];
  getMySpawn(): StructureSpawn | null;
  getEnergySources(): Source[];
  getMyExtensions(): StructureExtension[];
  getEnemyExtensions(): StructureExtension[];
  getEnemySpawn(): StructureSpawn | null;
  getCreepHealth(creep: Creep): number;
  getCreepBodyParts(creep: Creep): string[];
  isInDanger(creep: Creep): boolean;
  getCombatPower(creep: Creep): number;
}

// 每个状态必须实现这个接口
export interface StateDefinition {
  name: string;
  enter?(creep: Creep, task: Task, ctx: any): void;
  execute(creep: Creep, task: Task, ctx: any): string; // 返回下一个状态名
  exit?(creep: Creep, task: Task, ctx: any): void;
}

// 每个角色模块必须导出这个对象
export interface RoleModule {
  roleName: string;
  initialState: string;
  states: Record<string, StateDefinition>;
  // 单位创建时决定身体部件
  getBodyParts(ctx: StrategyContext): string[];
  // 单位进入时初始化上下文
  onSpawn?(creep: Creep): void;
}

// 战略模块必须导出这个对象
export interface StrategyModule {
  name: string;
  evaluate(tick: number, adapter: GameAdapter): StrategyContext;
}

// 建筑管理模块必须导出这个对象
export interface BuildingModule {
  name: string;
  run(strategy: StrategyContext, adapter: GameAdapter): void;
}`,
  },
  'framework/globalState.ts': {
    readonly: true,
    content: `import { StrategyContext, Task, GameAdapter } from './types';

export interface GlobalState {
  strategy: StrategyContext | null;
  tasks: Map<string, Task>;
  tick: number;
  adapter: GameAdapter;
}

export const globalState: GlobalState = {
  strategy: null,
  tasks: new Map(),
  tick: 0,
  adapter: null as unknown as GameAdapter, // 由运行时注入
};`,
  },
  'framework/adapter.ts': {
    readonly: true,
    content: `import { GameAdapter } from './types';

// 空实现占位：真实 Adapter 由页面 / 运行时注入（Screeps Arena 环境）
export const adapter: GameAdapter = null as unknown as GameAdapter;`,
  },
  'framework/baseStateMachine.ts': {
    readonly: true,
    content: `import { RoleModule, Task } from './types';

export function runRole(creep: Creep, module: RoleModule, task: Task | null) {
  if (!task) return;
  const stateName = (creep as any).__state ?? module.initialState;
  const state = module.states[stateName];
  if (!state) return;
  const next = state.execute(creep, task, {});
  if (next !== stateName) {
    state.exit?.(creep, task, {});
    (creep as any).__state = next;
    module.states[next]?.enter?.(creep, task, {});
  }
}`,
  },
  'framework/registry.ts': {
    readonly: true,
    content: `import { RoleModule, StrategyModule, BuildingModule } from './types';

class Registry {
  private roles = new Map<string, RoleModule>();
  private strategies: StrategyModule[] = [];
  private buildings: BuildingModule[] = [];

  registerRole(m: RoleModule) { this.roles.set(m.roleName, m); }
  registerStrategy(m: StrategyModule) { this.strategies.push(m); }
  registerBuilding(m: BuildingModule) { this.buildings.push(m); }

  getRole(name: string) { return this.roles.get(name); }
  getAllRoles() { return Array.from(this.roles.values()); }
  getStrategy() { return this.strategies[this.strategies.length - 1]; }
  getAllBuildings() { return this.buildings; }
}

export const registry = new Registry();`,
  },
  'main.ts': {
    readonly: true,
    content: `import { registry } from './framework/registry';
import { runRole } from './framework/baseStateMachine';
import { globalState } from './framework/globalState';

// 模块自动注册（页面生成时自动填充 import）
import { workerRole } from './modules/roles/worker';
import { defaultStrategy } from './modules/strategy/defaultStrategy';
import { spawnManager } from './modules/buildings/spawnManager';

registry.registerRole(workerRole);
registry.registerStrategy(defaultStrategy);
registry.registerBuilding(spawnManager);

export function loop() {
  const strategy = registry.getStrategy()?.evaluate(globalState.tick, globalState.adapter);
  if (strategy) globalState.strategy = strategy;

  for (const b of registry.getAllBuildings()) b.run(globalState.strategy, globalState.adapter);

  for (const creep of globalState.adapter.getMyCreeps()) {
    const role = registry.getRole((creep as any).__role);
    if (!role) continue;
    const task = globalState.tasks.get(creep.id) ?? null;
    runRole(creep, role, task);
  }
  globalState.tick++;
}`,
  },
  'modules/roles/worker.ts': { readonly: false, content: `// modules/roles/worker.ts\n// 待生成：由积木配置 + AI 生成，遵守 framework/types.ts 的 RoleModule 接口` },
  'modules/roles/melee.ts': { readonly: false, content: `// modules/roles/melee.ts\n// 待生成：由积木配置 + AI 生成` },
  'modules/roles/ranged.ts': { readonly: false, content: `// modules/roles/ranged.ts\n// 待生成：由积木配置 + AI 生成` },
  'modules/roles/healer.ts': { readonly: false, content: `// modules/roles/healer.ts\n// 待生成：由积木配置 + AI 生成` },
  'modules/strategy/defaultStrategy.ts': { readonly: false, content: `// modules/strategy/defaultStrategy.ts\n// 待生成：由积木配置 + AI 生成，遵守 StrategyModule 接口` },
  'modules/buildings/spawnManager.ts': { readonly: false, content: `// modules/buildings/spawnManager.ts\n// 待生成：由积木配置 + AI 生成，遵守 BuildingModule 接口` },
  'modules/buildings/extensionPlacer.ts': { readonly: false, content: `// modules/buildings/extensionPlacer.ts\n// 待生成：由积木配置 + AI 生成，遵守 BuildingModule 接口` },
};
const SC_VFS_ORDER = [
  'framework/types.ts', 'framework/globalState.ts', 'framework/adapter.ts',
  'framework/baseStateMachine.ts', 'framework/registry.ts', 'main.ts',
  'modules/roles/worker.ts', 'modules/roles/melee.ts', 'modules/roles/ranged.ts', 'modules/roles/healer.ts',
  'modules/strategy/defaultStrategy.ts',
  'modules/buildings/spawnManager.ts', 'modules/buildings/extensionPlacer.ts',
];

function scVfsOpen() {
  let ov = document.getElementById('sc-vfs-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'sc-vfs-overlay';
    ov.className = 'rv-overlay';
    document.body.appendChild(ov);
  }
  ov.innerHTML = `
    <div class="rv-card" style="width:860px;max-width:92vw;display:flex;flex-direction:column;height:78vh;">
      <div style="display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--line);">
        <span style="font-size:15px;font-weight:700;">📖 查看框架代码</span>
        <span style="font-size:12px;color:var(--text-dim);">framework/ 与 main.ts 只读锁定 🔒 · AI 仅生成 modules/ 📝</span>
        <button class="btn sm" id="sc-vfs-close" style="margin-left:auto;">✕ 关闭</button>
      </div>
      <div style="display:flex;flex:1;min-height:0;">
        <div style="width:250px;flex-shrink:0;border-right:1px solid var(--line);overflow:auto;padding:8px;">
          <div style="font-size:12px;color:var(--text-dim);padding:6px 8px;">📂 framework/（只读）</div>
          ${SC_VFS_ORDER.filter(p => p.startsWith('framework/')).map(p => `
            <div data-vfsp="${p}" style="padding:4px 8px 4px 18px;font-size:12.5px;cursor:pointer;border-radius:5px;font-family:Consolas,Menlo,monospace;" onmouseover="this.style.background='var(--accent-soft)'" onmouseout="this.style.background=''">🔒 ${p.replace('framework/', '')}</div>`).join('')}
          <div style="font-size:12px;color:var(--text-dim);padding:6px 8px;">📄 main.ts（只读）</div>
          <div data-vfsp="main.ts" style="padding:4px 8px 4px 18px;font-size:12.5px;cursor:pointer;border-radius:5px;font-family:Consolas,Menlo,monospace;" onmouseover="this.style.background='var(--accent-soft)'" onmouseout="this.style.background=''">🔒 main.ts</div>
          <div style="font-size:12px;color:var(--text-dim);padding:6px 8px;">📂 modules/（AI 生成写入）</div>
          ${SC_VFS_ORDER.filter(p => p.startsWith('modules/') && SC_VFS[p]).map(p => {
            const applied = SC_VFS[p].content && !SC_VFS[p].content.trim().startsWith('//');
            return `
            <div data-vfsp="${p}" style="padding:4px 8px 4px 18px;font-size:12.5px;cursor:pointer;border-radius:5px;font-family:Consolas,Menlo,monospace;" onmouseover="this.style.background='var(--accent-soft)'" onmouseout="this.style.background=''">${applied ? '🟢' : '⚪'} ${p.replace('modules/', '')}${applied ? '<span style="color:#3f9e5a;font-size:11px;"> 已应用</span>' : '<span style="color:var(--text-dim);font-size:11px;"> 占位</span>'}</div>`}).join('')}
        </div>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;">
          <div style="font-size:12px;color:var(--text-dim);padding:8px 14px;border-bottom:1px solid var(--line);" id="sc-vfs-cur">framework/types.ts</div>
          <pre id="sc-vfs-code" style="flex:1;overflow:auto;margin:0;padding:14px;background:#0d1117;color:#c9d1d9;font-family:Consolas,Menlo,monospace;font-size:12.5px;line-height:1.6;white-space:pre-wrap;"></pre>
        </div>
      </div>
    </div>`;
  ov.classList.add('show');
  ov.onclick = e => { if (e.target === ov) scVfsClose(); };
  $('#sc-vfs-close').onclick = scVfsClose;
  ov.querySelectorAll('[data-vfsp]').forEach(el => el.onclick = () => {
    ov.querySelectorAll('[data-vfsp]').forEach(x => x.style.background = '');
    el.style.background = 'rgba(63,158,90,.22)';
    const f = SC_VFS[el.dataset.vfsp];
    $('#sc-vfs-cur').textContent = el.dataset.vfsp;
    $('#sc-vfs-code').textContent = f ? f.content : '';
  });
  ov.querySelector('[data-vfsp="framework/types.ts"]').click();
}
function scVfsClose() {
  const ov = document.getElementById('sc-vfs-overlay');
  if (ov) ov.classList.remove('show');
}

async function renderScreepsSasPage() {
  const box = ROOT;
  const restored = await scSasLoad();
  const totalBlocks = SC_SAS_UNITS.reduce((s, u) => s + u.blocks.length, 0);
  box.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;gap:8px;align-items:center;padding:10px 14px;background:var(--gcard-bg,#1b1e28);border:1px solid var(--line);border-radius:10px;flex-wrap:wrap;">
        <button class="btn sm" id="sc-back">← 返回首页</button>
        <span style="font-weight:700;font-size:14px;">🐊 Spawn and Swamp</span>
        <span style="font-size:12px;color:var(--text-dim);">积木式配置工作台</span>
        <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn sm" id="sc-vfs">📖 查看框架代码</button>
          <button class="btn sm" id="sc-save">💾 保存配置</button>
          <button class="btn sm" id="sc-gen">⚙️ 生成提示词</button>
          <button class="btn sm" id="sc-gen-all">📄 生成所有过期提示词</button>
          <button class="btn sm" id="sc-copy">📋 复制提示词</button>
          <button class="btn sm" id="sc-apply">📥 应用 AI 代码</button>
        </div>
      </div>
      <div style="display:flex;gap:10px;min-height:520px;align-items:stretch;">
        <div style="width:215px;flex-shrink:0;background:var(--gcard-bg,#1b1e28);border:1px solid var(--line);border-radius:10px;padding:10px;display:flex;flex-direction:column;">
          <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px;">🧱 积木仓库</div>
          <div style="display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap;">
            ${[['unit', '单位'], ['action', '行为'], ['condition', '条件'], ['strategy', '战略']].map(t => `
              <span data-t="${t[0]}" style="padding:3px 8px;border-radius:6px;font-size:11px;cursor:pointer;background:${SC_SAS_LIB_TAB === t[0] ? 'rgba(63,158,90,.25)' : 'rgba(255,255,255,.05)'};"
                   onmouseover="this.style.background='rgba(63,158,90,.15)'" onmouseout="this.style.background='${SC_SAS_LIB_TAB === t[0] ? 'rgba(63,158,90,.25)' : 'rgba(255,255,255,.05)'}'">${t[1]}</span>`).join('')}
          </div>
          <div id="sc-lib" style="overflow:auto;flex:1;"></div>
        </div>
        <div style="flex:1;min-width:0;background:var(--gcard-bg,#1b1e28);border:1px solid var(--line);border-radius:10px;padding:12px;display:flex;flex-direction:column;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <span style="font-size:12px;color:var(--text-dim);">🎛 积木装配区（画布）</span>
            <button class="btn sm" id="sc-add-unit" style="margin-left:auto;">＋ 新建单位</button>
          </div>
          <div id="sc-canvas" style="overflow:auto;flex:1;display:flex;flex-direction:column;gap:14px;"></div>
        </div>
        <div style="width:290px;flex-shrink:0;background:var(--gcard-bg,#1b1e28);border:1px solid var(--line);border-radius:10px;padding:10px;display:flex;flex-direction:column;">
          <div style="display:flex;gap:4px;margin-bottom:10px;">
            <span id="sc-tab-preview" data-t="preview" style="padding:4px 10px;border-radius:6px;font-size:12px;cursor:pointer;background:rgba(63,158,90,.25);">提示词预览</span>
            <span id="sc-tab-ai" data-t="ai" style="padding:4px 10px;border-radius:6px;font-size:12px;cursor:pointer;background:rgba(255,255,255,.05);">AI 代码模式</span>
          </div>
          <div id="sc-right-preview" style="flex:1;overflow:auto;font-size:12px;line-height:1.7;color:#9db1c8;white-space:pre-wrap;font-family:Consolas,Menlo,monospace;background:#0d1117;border-radius:8px;padding:10px;"></div>
          <div id="sc-right-ai" style="flex:1;display:none;flex-direction:column;">
            <textarea id="sc-ai-code" rows="16" placeholder="将 AI 返回的模块代码粘贴到这里，然后点击「应用 AI 代码」" style="flex:1;width:100%;background:#0d1117;color:#c9d1d9;border:1px solid var(--line);border-radius:8px;padding:10px;font-family:Consolas,Menlo,monospace;font-size:12px;resize:vertical;"></textarea>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:18px;align-items:center;font-size:12px;color:var(--text-dim);padding:8px 14px;background:var(--gcard-bg,#1b1e28);border:1px solid var(--line);border-radius:8px;flex-wrap:wrap;">
        <span id="sc-st-unit">当前选中单位：Worker</span>
        <span id="sc-st-count">积木总数：${totalBlocks}</span>
        <span id="sc-st-ok">配置合法性：✓</span>
        <span id="sc-st-orphan"></span>
      </div>
    </div>`;
  $('#sc-back').onclick = () => { location.hash = ''; renderScreepsTool(ROOT); };
  $('#sc-vfs').onclick = () => scVfsOpen();
  $('#sc-save').onclick = () => scSasSave();
  $('#sc-gen').onclick = () => scSasGenPrompt();
  $('#sc-gen-all').onclick = () => scSasGenAllPrompts();
  $('#sc-copy').onclick = () => scSasCopyPrompt();
  $('#sc-apply').onclick = () => scSasApplyCode();
  $('#sc-add-unit').onclick = () => scSasAddUnit('');
  $('#sc-lib').innerHTML = scLibHTML();
  scLibWireAdd();
  box.querySelectorAll('[data-t]').forEach(el => el.onclick = () => {
    if (el.id === 'sc-tab-preview') scRightTab('preview');
    else if (el.id === 'sc-tab-ai') scRightTab('ai');
    else scLibTab(el.dataset.t);
  });
  const canvas = $('#sc-canvas');
  canvas.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; canvas.style.outline = '2px dashed rgba(63,158,90,.55)'; });
  canvas.addEventListener('dragleave', () => { canvas.style.outline = ''; });
  canvas.addEventListener('drop', e => {
    e.preventDefault();
    canvas.style.outline = '';
    const data = e.dataTransfer.getData('text/plain') || '';
    const idx = data.indexOf(':');
    if (idx < 0) return;
    scSasAddBlock(data.slice(0, idx), data.slice(idx + 1));
  });
  scSasRenderCanvas();
  scSasRefreshStatus();
  scSasFillPreview();
}

let SC_SAS_CFG = {}; // 'unitId:idx' -> true（参数表单展开）
let SC_SAS_DRAG = null; // { uid, idx }

function scSasRenderCanvas() {
  const cv = $('#sc-canvas');
  if (!cv) return;
  cv.innerHTML = SC_SAS_UNITS.map(u => {
    const sel = u.id === SC_SAS_SELECTED;
    const borderColor = u.moduleStatus === 'STALE' ? 'rgba(233,187,83,.7)' : (sel ? 'rgba(63,158,90,.55)' : 'var(--line)');
    const cardTitle = u.moduleStatus === 'STALE' ? '点击生成提示词以更新代码' : '';
    const stBadge = u.moduleStatus === 'SYNCED'
      ? '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#3f9e5a;" title="代码与配置一致">🟢 已同步</span>'
      : u.moduleStatus === 'STALE'
        ? '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#e9bb53;" title="点击生成提示词以更新代码">🟡 配置已修改，需重新生成</span>'
        : '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--text-dim);" title="尚未生成代码">⚪ 尚未生成代码</span>';
    return `
    <div data-unit="${u.id}" title="${cardTitle}" style="border:2px solid ${borderColor};border-radius:12px;background:rgba(255,255,255,.03);padding:12px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <span data-rename="${u.id}" style="font-size:15px;font-weight:700;cursor:pointer;" title="点击重命名">${esc(u.name)}</span>
        <span style="font-size:11px;color:var(--text-dim);">单位卡片 · ${u.blocks.length} 个积木</span>
        <span style="margin-left:auto;">${stBadge}</span>
        <button class="btn sm" data-delunit="${u.id}">✕ 删除</button>
      </div>
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:8px;">初始状态：IDLE</div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${u.blocks.length ? u.blocks.map((b, i) => scSasBlockHTML(u, b, i)).join('') : '<div style="font-size:12px;color:var(--text-dim);padding:8px;text-align:center;border:1px dashed var(--line);border-radius:8px;">拖入积木或点左侧 ＋ 添加</div>'}
      </div>
      ${u.moduleStatus === 'STALE' ? `
      <div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(233,187,83,.10);border:1px solid rgba(233,187,83,.4);font-size:12px;color:#e9bb53;display:flex;align-items:center;gap:8px;">
        ⚠️ 本单位的配置已修改，请重新生成提示词并应用 AI 代码
        <button class="btn sm" data-gen="${u.id}" style="margin-left:auto;">生成提示词</button>
      </div>` : ''}
    </div>`;
  }).join('');
  cv.querySelectorAll('[data-unit]').forEach(el => el.onclick = () => {
    SC_SAS_SELECTED = el.dataset.unit;
    scSasRenderCanvas();
    scSasRefreshStatus();
  });
  cv.querySelectorAll('[data-delunit]').forEach(el => el.onclick = e => {
    e.stopPropagation();
    scSasDelUnit(el.dataset.delunit);
  });
  cv.querySelectorAll('[data-rename]').forEach(el => el.onclick = e => {
    e.stopPropagation();
    scSasRenameUnit(el.dataset.rename);
  });
  cv.querySelectorAll('[data-gen]').forEach(el => el.onclick = e => {
    e.stopPropagation();
    scSasGenPrompt(el.dataset.gen);
  });
}

function scSasBlockHTML(u, b, i) {
  let meta = null;
  if (b.kind === 'action') meta = SC_BLOCK_LIB.action.find(x => x.id === b.lib);
  else if (b.kind === 'condition') meta = SC_BLOCK_LIB.condition.find(x => x.id === b.lib);
  if (!meta) return '';
  const key = u.id + ':' + i;
  const open = !!SC_SAS_CFG[key];
  const params = Object.entries(b.params).map(([k, v]) => `${k}=${v}`).join(' · ');
  return `
    <div data-block="${key}" draggable="true"
         style="display:flex;flex-direction:column;border-radius:8px;background:${b.kind === 'condition' ? 'rgba(74,127,212,.12)' : 'rgba(63,158,90,.10)'};border:1px solid ${b.kind === 'condition' ? 'rgba(74,127,212,.35)' : 'rgba(63,158,90,.3)'};"
         ondragstart="scSasBlockDragStart(event,'${u.id}',${i})" ondragover="scSasBlockDragOver(event,'${u.id}',${i})"
         ondrop="scSasBlockDrop(event,'${u.id}',${i})" ondragend="scSasBlockDragEnd(event)">
      <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;cursor:pointer;" onclick="scSasToggleCfg('${u.id}',${i})">
        <span style="font-size:15px;">${meta.icon}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;">${meta.name}${b.next ? ' → ' + esc(b.next) : ''}</div>
          <div style="font-size:11px;color:var(--text-dim);">${params || '（点击配置参数）'}</div>
        </div>
        <span style="font-size:12px;color:var(--text-dim);">#${i + 1}</span>
        <span style="font-size:13px;color:#b04a5a;cursor:pointer;" onclick="event.stopPropagation();scSasDelBlock('${u.id}',${i})">✕</span>
      </div>
      ${open ? scSasBlockCfgHTML(u, b, i) : ''}
    </div>
    ${i < u.blocks.length - 1 ? '<div style="text-align:center;color:var(--text-dim);font-size:10px;">↓</div>' : ''}`;
}

function scSasBlockCfgHTML(u, b, i) {
  if (b.kind === 'action') {
    const targets = ['最近能量源', '最近敌方单位', '敌方 Spawn', '我方 Spawn', '最近 Extension', '最近友方单位'];
    return `<div style="padding:8px 10px;border-top:1px dashed rgba(255,255,255,.12);display:flex;flex-direction:column;gap:6px;">
      <label style="font-size:11px;color:var(--text-dim);">目标参数</label>
      <select class="input" style="width:100%;" onchange="scSasCfgSet('${u.id}',${i},'target',this.value)">
        ${targets.map(t => `<option ${(b.params.target || '') === t ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
      <label style="font-size:11px;color:var(--text-dim);">执行后跳转状态</label>
      <input class="input" style="width:100%;" value="${esc(b.next || '')}" placeholder="状态名，如 IDLE / HARVEST" onchange="scSasCfgSet('${u.id}',${i},'next',this.value)">
    </div>`;
  }
  const needThreshold = b.lib === 'c-hp';
  return `<div style="padding:8px 10px;border-top:1px dashed rgba(255,255,255,.12);display:flex;flex-direction:column;gap:6px;">
    ${needThreshold ? `<label style="font-size:11px;color:var(--text-dim);">阈值参数（血量 %）</label>
      <input class="input" type="number" style="width:100%;" value="${b.params.threshold ?? 30}" onchange="scSasCfgSet('${u.id}',${i},'threshold',this.value)">` : ''}
    <label style="font-size:11px;color:var(--text-dim);">跳转目标状态</label>
    <input class="input" style="width:100%;" value="${esc(b.next || '')}" placeholder="状态名，如 RETREAT / HARVEST" onchange="scSasCfgSet('${u.id}',${i},'next',this.value)">
  </div>`;
}

function scSasToggleCfg(uid, idx) {
  const key = uid + ':' + idx;
  if (SC_SAS_CFG[key]) delete SC_SAS_CFG[key]; else SC_SAS_CFG[key] = true;
  scSasRenderCanvas();
}
function scSasCfgSet(uid, idx, k, v) {
  const u = SC_SAS_UNITS.find(x => x.id === uid);
  if (!u || !u.blocks[idx]) return;
  if (k === 'next') u.blocks[idx].next = v;
  else u.blocks[idx].params[k] = v;
  scSasMarkStale(uid);
  scSasRenderCanvas();
}
function scSasDelBlock(uid, idx) {
  const u = SC_SAS_UNITS.find(x => x.id === uid);
  if (!u) return;
  u.blocks.splice(idx, 1);
  scSasMarkStale(uid);
  scSasRenderCanvas();
  scSasRefreshStatus();
}
function scSasBlockDragStart(e, uid, idx) {
  SC_SAS_DRAG = { uid, idx };
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', uid + ':' + idx);
}
function scSasBlockDragOver(e, uid, idx) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const el = e.currentTarget;
  el.style.borderColor = 'rgba(233,187,83,.8)';
}
function scSasBlockDrop(e, uid, idx) {
  e.preventDefault();
  e.stopPropagation();
  scSasBlockMove(uid, idx);
  scSasBlockDragEnd(e);
}
function scSasBlockDragEnd(e) {
  const el = e.currentTarget;
  if (el) el.style.borderColor = '';
  SC_SAS_DRAG = null;
}
function scSasBlockMove(toUid, toIdx) {
  if (!SC_SAS_DRAG) return;
  const fromU = SC_SAS_UNITS.find(x => x.id === SC_SAS_DRAG.uid);
  const toU = SC_SAS_UNITS.find(x => x.id === toUid);
  if (!fromU || !toU) return;
  const block = fromU.blocks.splice(SC_SAS_DRAG.idx, 1)[0];
  if (!block) return;
  let insertAt = toIdx;
  if (fromU === toU && SC_SAS_DRAG.idx < toIdx) insertAt = toIdx - 1;
  toU.blocks.splice(insertAt, 0, block);
  scSasMarkStale(fromU.id);
  if (fromU !== toU) scSasMarkStale(toU.id);
  scSasRenderCanvas();
  scSasRefreshStatus();
}

function scSasAddUnit(name) {
  const n = (name != null ? String(name) : '') || prompt('输入新单位名称（如 Worker2）：', 'Unit') || 'Unit';
  const id = 'u' + Date.now();
  const roleName = n.toLowerCase().replace(/\s+/g, '') || 'unit';
  SC_SAS_UNITS.push({
    id, name: n, roleName,
    bodyParts: (SC_BODY_DEFAULT[roleName] || ['WORK', 'CARRY', 'MOVE']).slice(),
    moduleStatus: 'NOT_GENERATED', lastGeneratedHash: '',
    blocks: [],
  });
  SC_SAS_SELECTED = id;
  scSasRenderCanvas();
  scSasRefreshStatus();
  toast('已新建单位 ' + n, 'success');
}
function scSasRenameUnit(uid) {
  const u = SC_SAS_UNITS.find(x => x.id === uid);
  if (!u) return;
  const n = prompt('重命名单位：', u.name);
  if (n && n.trim()) {
    u.name = n.trim();
    u.roleName = u.name.toLowerCase().replace(/\s+/g, '') || 'unit';
    scSasMarkStale(uid);
    scSasRenderCanvas();
    scSasRefreshStatus();
  }
}
function scSasDelUnit(uid) {
  const u = SC_SAS_UNITS.find(x => x.id === uid);
  if (!u) return;
  scSasDelDialog(u);
}
function scSasRemoveUnit(uid) {
  SC_SAS_UNITS = SC_SAS_UNITS.filter(x => x.id !== uid);
  if (SC_SAS_SELECTED === uid) SC_SAS_SELECTED = SC_SAS_UNITS.length ? SC_SAS_UNITS[0].id : '';
  scSasRenderCanvas();
  scSasRefreshStatus();
}
function scSasCleanModule(u) {
  const file = 'modules/roles/' + u.roleName + '.ts';
  if (SC_VFS[file]) delete SC_VFS[file];
  scSasSyncMainTs();
  toast('已删除 ' + file + '，main.ts 已按当前单位列表重建', 'success');
}
/* main.ts 自动维护：按当前画布单位列表重建角色 import 与注册（唯一权威入口） */
function scSasSyncMainTs() {
  const roleImports = [];
  const roleRegs = [];
  const seen = new Set();
  SC_SAS_UNITS.forEach(u => {
    const rn = u.roleName || 'unit';
    if (seen.has(rn)) return;
    seen.add(rn);
    roleImports.push("import { " + rn + "Role } from './modules/roles/" + rn + "';");
    roleRegs.push("registry.registerRole(" + rn + "Role);");
  });
  const main = SC_VFS['main.ts'];
  const loopMatch = main.content.match(/export function loop\(\) \{[\s\S]*\}$/);
  const loopBody = loopMatch ? loopMatch[0] : 'export function loop() { /* 框架入口，未初始化 */ }';
  main.content = `import { registry } from './framework/registry';
import { runRole } from './framework/baseStateMachine';
import { globalState } from './framework/globalState';

// 模块自动注册（页面自动同步）
${roleImports.join('\n')}
import { defaultStrategy } from './modules/strategy/defaultStrategy';
import { spawnManager } from './modules/buildings/spawnManager';

${roleRegs.join('\n')}
registry.registerStrategy(defaultStrategy);
registry.registerBuilding(spawnManager);

${loopBody}`;
  return main.content;
}
function scSasDelDialog(u) {
  const file = 'modules/roles/' + u.roleName + '.ts';
  let ov = document.getElementById('sc-sas-del-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'sc-sas-del-overlay';
    ov.className = 'rv-overlay';
    document.body.appendChild(ov);
  }
  ov.innerHTML = `
    <div class="rv-card" style="width:520px;max-width:92vw;padding:0;">
      <div style="display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--line);">
        <span style="font-size:15px;font-weight:700;">确认删除单位 "${esc(u.name)}" 吗？</span>
        <button class="btn sm" id="sc-sas-del-close" style="margin-left:auto;">✕</button>
      </div>
      <div style="padding:14px 16px;font-size:13px;line-height:1.9;">
        <div style="color:#e9bb53;">⚠️ 将同时删除以下内容：</div>
        <div style="padding-left:14px;color:var(--text-dim);font-family:Consolas,Menlo,monospace;font-size:12px;">
          · ${file}<br>
          · main.ts 中的 import 语句<br>
          · main.ts 中的 registry.registerRole(${u.roleName}Role) 语句
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid var(--line);">
        <button class="btn sm" id="sc-sas-del-cancel">取消</button>
        <button class="btn sm" id="sc-sas-del-soft" style="background:rgba(233,187,83,.18);border-color:rgba(233,187,83,.5);">仅删除配置</button>
        <button class="btn sm" id="sc-sas-del-hard" style="background:rgba(176,74,90,.2);border-color:rgba(176,74,90,.55);">删除配置并清理代码</button>
      </div>
    </div>`;
  ov.classList.add('show');
  ov.onclick = e => { if (e.target === ov) scSasDelDialogClose(); };
  $('#sc-sas-del-close').onclick = scSasDelDialogClose;
  $('#sc-sas-del-cancel').onclick = scSasDelDialogClose;
  $('#sc-sas-del-soft').onclick = () => {
    scSasDelDialogClose();
    scSasRemoveUnit(u.id);
    toast('已仅删除配置：' + u.name + '（模块文件与 main.ts 保持不变）', 'info');
  };
  $('#sc-sas-del-hard').onclick = () => {
    scSasDelDialogClose();
    scSasRemoveUnit(u.id);
    scSasCleanModule(u);
  };
}
function scSasDelDialogClose() {
  const ov = document.getElementById('sc-sas-del-overlay');
  if (ov) ov.classList.remove('show');
}

let SC_SAS_PROMPT = '';
const SC_ACTION_CN = { HARVEST: '采集能量', TRANSFER: '转移能量', MOVE_TO: '移动到目标', ATTACK: '攻击', HEAL: '治疗', BUILD: '建造', RETREAT: '撤退', WAIT: '等待' };
const SC_COND_CN = { 'c-hp': '血量低于阈值', 'c-enemy': '范围内有敌人', 'c-energy-full': '能量已满', 'c-energy-empty': '能量已空', 'c-done': '任务已完成' };
const SC_BODY_DEFAULT = {
  worker: ['WORK', 'CARRY', 'MOVE'],
  melee: ['ATTACK', 'MOVE', 'MOVE'],
  ranged: ['RANGED_ATTACK', 'MOVE', 'MOVE'],
  healer: ['HEAL', 'MOVE', 'MOVE'],
};

function scSasBlockStateName(b) {
  if (b.kind === 'action') { const m = SC_BLOCK_LIB.action.find(x => x.id === b.lib); return m ? m.name : 'IDLE'; }
  return b.next || 'IDLE';
}

function scSasGenPromptText(u) {
  const roleName = u.roleName || u.name.toLowerCase().replace(/\s+/g, '') || 'unit';
  const file = 'modules/roles/' + roleName + '.ts';
  const body = (u.bodyParts && u.bodyParts.length ? u.bodyParts : (SC_BODY_DEFAULT[roleName] || ['WORK', 'CARRY', 'MOVE'])).map(x => '"' + x + '"').join(', ');
  const flow = [];
  let idx = 1;
  flow.push(idx++ + '. 状态 IDLE：无动作，立即跳转到 ' + (u.blocks.length ? scSasBlockStateName(u.blocks[0]) : 'IDLE'));
  u.blocks.forEach(b => {
    if (b.kind === 'action') {
      const meta = SC_BLOCK_LIB.action.find(x => x.id === b.lib);
      if (!meta) return;
      const cn = SC_ACTION_CN[meta.name] || meta.name;
      const target = b.params.target || '最近能量源';
      const next = b.next || 'IDLE';
      flow.push(idx++ + '. 状态 ' + meta.name + '：调用 creep ' + cn + '（目标：' + target + '）；完成后跳转到 ' + next);
    } else {
      const meta = SC_BLOCK_LIB.condition.find(x => x.id === b.lib);
      if (!meta) return;
      const cn = SC_COND_CN[b.lib] || meta.name;
      const th = (b.lib === 'c-hp' && b.params.threshold != null) ? '（阈值 ' + b.params.threshold + '%）' : '';
      const next = b.next || 'IDLE';
      flow.push(idx++ + '. 当 ' + cn + th + ' 时，跳转到 ' + next);
    }
  });
  return `你是一个 Screeps Arena 开发者。请生成一个符合固定接口的 TypeScript 模块文件。

【框架约定 - 不得修改】
下面这些接口已经存在，你必须 import 并使用，不能重新定义：
- RoleModule, StateDefinition, Task, StrategyContext, GameAdapter（来自 framework/types.ts）
- registry（来自 framework/registry.ts）

【目标文件】 ${file}

【模块要求】
- 必须 export const ${roleName}Role: RoleModule
- roleName 为 "${roleName}"
- initialState 为 "IDLE"
- getBodyParts 返回 [${body}]

【行为流程】
${flow.join('\n')}

【约束】
- 只能使用 framework/types.ts 中定义的接口
- 不要修改 framework 下的任何文件
- 不要生成其他模块（如 melee.ts、spawnManager.ts）
- 只输出 ${file} 的完整代码，不要输出解释`;
}

function scSasGenPrompt(uid) {
  const u = (uid && SC_SAS_UNITS.find(x => x.id === uid)) || SC_SAS_UNITS.find(x => x.id === SC_SAS_SELECTED) || SC_SAS_UNITS[0];
  if (!u) { toast('请先新建单位卡片', 'warn'); return; }
  SC_SAS_PROMPT = scSasGenPromptText(u);
  scSasFillPreview();
  scRightTab('preview');
  toast('已生成提示词：modules/roles/' + (u.roleName || 'unit') + '.ts', 'success');
}

/* 批量：为所有过期（STALE）或已配置未生成（NOT_GENERATED 且有积木）的单位生成提示词，分隔符拼接 */
function scSasGenAllPrompts() {
  const need = SC_SAS_UNITS.filter(u => u.roleName && (u.moduleStatus === 'STALE' || (u.moduleStatus === 'NOT_GENERATED' && u.blocks.length)));
  if (!need.length) { toast('没有需要生成的过期模块（全部已同步）', 'info'); return; }
  const parts = need.map((u, i) => {
    const file = 'modules/roles/' + u.roleName + '.ts';
    return '===== 提示词 ' + (i + 1) + '/' + need.length + '：' + file + ' =====\n' + scSasGenPromptText(u);
  });
  SC_SAS_PROMPT = parts.join('\n\n');
  scSasFillPreview();
  scRightTab('preview');
  toast('已生成 ' + need.length + ' 条提示词（' + need.map(u => u.roleName).join('、') + '）', 'success');
}

function scSasCopyPrompt() {
  if (!SC_SAS_PROMPT) { toast('请先生成提示词', 'warn'); return; }
  const done = () => toast('已复制提示词', 'success');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(SC_SAS_PROMPT).then(done).catch(() => scSasCopyFallback(done));
  } else scSasCopyFallback(done);
}
function scSasCopyFallback(done) {
  const ta = document.createElement('textarea');
  ta.value = SC_SAS_PROMPT;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动选择复制', 'warn'); }
  document.body.removeChild(ta);
}

function scSasSyntaxCheck(src) {
  const s = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const stack = [];
  const pairs = { ')': '(', ']': '[', '}': '{' };
  let quote = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) { if (ch === quote && s[i - 1] !== '\\') quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if ('([{'.includes(ch)) { stack.push(ch); continue; }
    if (')]}'.includes(ch)) {
      const want = pairs[ch];
      if (!stack.length || stack.pop() !== want) return { ok: false, err: '括号不匹配，位置 ' + i };
    }
  }
  if (quote) return { ok: false, err: '字符串未闭合' };
  if (stack.length) return { ok: false, err: '存在未闭合的括号 ' + stack.join('') };
  return { ok: true, err: '' };
}

function scSasInterfaceCheck(code, roleName) {
  const errs = [];
  if (!/framework\/types/.test(code)) errs.push('未找到 framework/types.ts 的 import');
  const expRe = new RegExp('export\\s+(const|\\{)[^;]{0,80}' + roleName + 'Role');
  if (!expRe.test(code) && !code.includes(roleName + 'Role')) errs.push('未找到导出 ' + roleName + 'Role');
  if (!/roleName\s*:/.test(code)) errs.push('缺少 roleName 字段');
  if (!/initialState\s*:/.test(code)) errs.push('缺少 initialState 字段');
  if (!/states\s*:/.test(code)) errs.push('缺少 states 字段');
  if (!/getBodyParts/.test(code)) errs.push('缺少 getBodyParts 方法');
  return errs;
}

function scSasApplyCode() {
  const u = SC_SAS_UNITS.find(x => x.id === SC_SAS_SELECTED) || SC_SAS_UNITS[0];
  if (!u) { toast('请先新建单位卡片', 'warn'); return; }
  const roleName = u.roleName || u.name.toLowerCase().replace(/\s+/g, '') || 'unit';
  const file = 'modules/roles/' + roleName + '.ts';
  const code = ($('#sc-ai-code').value || '').trim();
  if (!code) { toast('请先粘贴 AI 返回的代码', 'warn'); return; }
  const syn = scSasSyntaxCheck(code);
  if (!syn.ok) { toast('语法校验失败：' + syn.err, 'error'); return; }
  const errs = scSasInterfaceCheck(code, roleName);
  if (errs.length) { toast('接口校验失败：' + errs.join('；'), 'error'); return; }
  SC_VFS[file].content = code;
  u.lastGeneratedHash = scSasConfigHash(u);
  u.moduleStatus = 'SYNCED';
  scSasSyncMainTs();
  scSasRenderCanvas();
  scSasRefreshStatus();
  toast('已应用 ' + roleName + '.ts，配置与代码已同步（🟢 SYNCED）', 'success');
}

async function scSasSave() {
  const modules = {};
  SC_VFS_ORDER.filter(p => p.startsWith('modules/') && SC_VFS[p]).forEach(p => {
    const c = SC_VFS[p].content;
    if (c && !c.trim().startsWith('//')) modules[p] = c; // 仅保存已应用的非占位内容
  });
  const data = { v: 1, units: SC_SAS_UNITS, selected: SC_SAS_SELECTED, modules, mainTs: SC_VFS['main.ts'].content };
  try {
    await api('/api/plugin/screeps/state', { method: 'PUT', body: { state: data } });
    toast('已保存配置（' + SC_SAS_UNITS.length + ' 个单位 · ' + SC_SAS_UNITS.reduce((s, u) => s + u.blocks.length, 0) + ' 个积木）', 'success');
  } catch (e) { toast('保存失败：' + e.message, 'error'); }
}

async function scSasLoad() {
  let data = null;
  try { const d = await api('/api/plugin/screeps/state'); data = d && d.state; } catch (e) { return false; }
  if (!data || data.v !== 1 || !Array.isArray(data.units)) return false;
  SC_SAS_UNITS = data.units.map(u => {
    const roleName = u.roleName || (u.name || 'Unit').toLowerCase().replace(/\s+/g, '') || 'unit';
    return {
      id: u.id || ('u' + Math.random().toString(36).slice(2)),
      name: u.name || 'Unit',
      roleName,
      bodyParts: Array.isArray(u.bodyParts) ? u.bodyParts.slice() : (SC_BODY_DEFAULT[roleName] || ['WORK', 'CARRY', 'MOVE']).slice(),
      moduleStatus: u.moduleStatus || 'NOT_GENERATED',
      lastGeneratedHash: u.lastGeneratedHash || '',
      blocks: Array.isArray(u.blocks) ? u.blocks.filter(b => {
        const lib = SC_BLOCK_LIB[b.kind] || [];
        return lib.some(x => x.id === b.lib);
      }) : [],
    };
  });
  if (data.selected && SC_SAS_UNITS.some(x => x.id === data.selected)) SC_SAS_SELECTED = data.selected;
  else SC_SAS_SELECTED = SC_SAS_UNITS.length ? SC_SAS_UNITS[0].id : '';
  if (data.modules) Object.keys(data.modules).forEach(p => { if (SC_VFS[p]) SC_VFS[p].content = data.modules[p]; });
  if (data.mainTs && SC_VFS['main.ts']) SC_VFS['main.ts'].content = data.mainTs;
  return true;
}

function scSasFillPreview() {
  const pv = $('#sc-right-preview');
  if (!pv) return;
  pv.textContent = SC_SAS_PROMPT || `（提示词预览 · 第六步接入）\n\n配置了 ${SC_SAS_UNITS.length} 个单位卡片，共 ${SC_SAS_UNITS.reduce((s, u) => s + u.blocks.length, 0)} 个积木。\n\n点击顶栏「⚙️ 生成提示词」，将当前选中单位的积木配置转为结构化提示词显示在这里。`;
}

function renderScreepsModePage(mode) {
  const m = SC_MODES.find(x => x.id === mode);
  const box = ROOT;
  box.innerHTML = `
    <div class="gcard" style="min-height:300px;">
      <div class="section-title"><span class="st-emoji">${m.icon}</span>${m.name}
        <span style="font-size:12px;color:var(--text-dim);font-weight:400;">${m.desc}</span>
        <button class="btn sm" id="sc-back" style="margin-left:auto;">← 返回首页</button>
      </div>
      <div style="padding:60px 0;text-align:center;color:var(--text-dim);font-size:13px;">
        ${m.name} 开发页规划中 · 尚未开始
      </div>
    </div>`;
  $('#sc-back').onclick = () => {
    location.hash = '';
    renderScreepsTool(ROOT);
  };
}

window.addEventListener('hashchange', () => {
  if (S && S.tool === 'screeps') renderScreepsTool(ROOT);
});


window.__toolRenderers.screeps = renderScreepsTool;
})();

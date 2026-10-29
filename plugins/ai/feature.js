'use strict';
/* 按需加载的功能模块：ai */
(function () {
/* ============================================================
   AI 工作台（多平台对话：DeepSeek · Kimi · 豆包待接入）
   ============================================================ */
const AI_PROVIDERS = [
  { id: 'deepseek', icon: '🪷', label: 'DeepSeek', defaultModel: 'deepseek-chat', hint: 'platform.deepseek.com 注册，sk- 开头' },
  { id: 'kimi', icon: '🧠', label: 'Kimi', defaultModel: 'kimi-k2.6', hint: 'platform.moonshot.cn 注册，sk- 开头；可用模型以账户授权为准（如 kimi-k2.6 / kimi-k2.7-code）' },
  { id: 'doubao', icon: '🫧', label: '豆包', defaultModel: 'doubao-seed-evolving', hint: '火山方舟控制台创建 API Key（ark- 开头）' },
];
let aiSaveChain = Promise.resolve();
function aiSaveState() {
  if (!S.ai) return;
  const snapshot = JSON.parse(JSON.stringify({
    tab: S.ai.tab,
    hist: S.ai.hist || {},
    wsessId: S.ai.wsess ? S.ai.wsess.id : (S.ai.wsessId || null),
  }));
  const txlog = JSON.parse(JSON.stringify(S.ai.txlog || {}));
  aiSaveChain = aiSaveChain
    .then(() => api('/api/plugin/ai/state', { method: 'PUT', body: { state: snapshot, txlog } }))
    .catch(() => {});
}
async function aiRestoreState() {
  if (!S.ai) S.ai = { tab: 'deepseek', hist: {}, wsess: null };
  try {
    const d = await api('/api/plugin/ai/state');
    const state = d && d.state;
    if (state && typeof state === 'object') {
      if (state.tab === 'deepseek' || state.tab === 'kimi' || state.tab === 'doubao' || state.tab === 'web') S.ai.tab = state.tab;
      if (state.hist && typeof state.hist === 'object') S.ai.hist = state.hist;
      if (state.wsessId) S.ai.wsessId = state.wsessId;
    }
    if (d && d.txlog && typeof d.txlog === 'object') S.ai.txlog = d.txlog;
  } catch (e) { /* 后端不可用时保持默认 */ }
}
function aiTab() { return S.ai ? S.ai.tab : 'deepseek'; }
async function renderAITool() {
  const box = $('#tool-view');
  await aiRestoreState();
  const isWeb = aiTab() === 'web';
  box.innerHTML = `
    <div class="gcard">
      <div class="section-title"><span class="st-emoji">🤖</span>AI 工作台
        <span style="font-size:12px;color:var(--text-dim);font-weight:400;">多平台对话 · 各平台独立上下文</span>
        <button class="btn soft sm" id="ai-setkey" style="margin-left:auto;${isWeb ? 'display:none;' : ''}">⚙ 设置 Key</button>
        <button class="btn soft sm" id="ai-web-login" style="${isWeb ? '' : 'display:none;'}">🔑 登录</button></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
        ${AI_PROVIDERS.map(p => `<button class="btn sm ${aiTab() === p.id ? '' : 'soft'}" data-ai-pid="${p.id}" style="font-size:12.5px;padding:3px 12px;">${p.icon} ${p.label}</button>`).join('')}
        <button class="btn sm ${isWeb ? '' : 'soft'}" data-ai-pid="web" style="font-size:12.5px;padding:3px 12px;">🌐 网页会话</button>
      </div>
      <div id="ai-status" style="font-size:12.5px;margin-bottom:10px;"></div>
      ${isWeb ? '<div id="web-sessions" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center;"></div>' : ''}
      <div id="ai-msgs" style="height:360px;overflow-y:auto;background:rgba(255,255,255,.6);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px;"></div>
      <div style="display:flex;gap:10px;margin-top:12px;">
        <textarea class="input" id="ai-in" rows="2" placeholder="输入消息，Enter 发送 · Shift+Enter 换行" style="flex:1;resize:vertical;"></textarea>
        <button class="btn" id="ai-send" style="align-self:flex-end;">发送</button>
        <button class="btn sm" id="ai-abort" style="align-self:flex-end;font-size:12px;padding:6px 14px;background:#d2455a;color:#fff;border:none;border-radius:8px;cursor:pointer;display:none;">⛔ 中断</button>
      </div>
      <div id="ai-txlog" style="margin-top:10px;border:1px solid rgba(0,0,0,.08);border-radius:10px;background:#fff;padding:8px 12px;"></div>
    </div>`;
  if (isWeb) { refreshWebStatus(); renderWebSessions(); } else { refreshAIStatus(); }
  aiTxLogRender();   /* 接口收发日志卡片（最新发送指令 / 最新接收信息） */
  const msgs = $('#ai-msgs');
  replayAIHistory();
  const send = () => {
    const v = $('#ai-in').value.trim();
    if (!v) return;
    aiPush('user', v);
    $('#ai-in').value = '';
    aiCall(v);
  };
  $('#ai-send').onclick = send;
  $('#ai-in').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  const aiAbortBtn = document.getElementById('ai-abort');
  if (aiAbortBtn) aiAbortBtn.onclick = () => fqAbortNow('AI 工作台对话');
  $('#ai-setkey').onclick = () => aiSetKey();
  $('#ai-web-login').onclick = () => webLogin();
  document.querySelectorAll('#tool-view [data-ai-pid]').forEach(b => {
    b.onclick = () => {
      if (b.dataset.aiPid === aiTab()) return;
      S.ai.tab = b.dataset.aiPid;
      aiSaveState();
      renderAITool();
    };
  });
}
function refreshWebStatus() {
  api('/api/plugin/webchat/status').then(r => {
    const el = $('#ai-status');
    if (!el) return;
    el.innerHTML = r && r.ok
      ? (r.ready
          ? '<span style="color:#30a46e;">🌐 网页会话：已登录 ✓ 浏览器挂起中 · 与 DeepSeek 保持连接，可直接对话</span><span style="color:var(--text-dim);margin-left:8px;">串行处理 · 保留网页历史上下文</span>'
          : '<span style="color:#b04a5a;">网页会话：未登录 —— 点击「🔑 登录」并在弹出窗口完成登录</span>')
      : '网页会话状态获取失败';
  }).catch(() => {});
}
function renderWebSessions() {
  const box = $('#web-sessions');
  if (!box) return;
  api('/api/plugin/webchat/sessions').then(r => {
    const lst = (r && r.sessions) || [];
    let cur = S.ai.wsess;
    if (cur && !lst.find(s => s.id === cur.id)) { S.ai.wsess = null; cur = null; }
    if (!cur && S.ai.wsessId) {   // 全局状态恢复上次选中的会话
      cur = lst.find(s => s.id === S.ai.wsessId) || null;
      S.ai.wsess = cur;
    }
    box.innerHTML = `<button class="btn sm soft" id="web-add">➕ 添加会话</button>` +
      lst.map(s => `<span class="web-chip${cur && cur.id === s.id ? ' on' : ''}" data-sid="${s.id}" style="font-size:12px;padding:3px 10px;border-radius:20px;cursor:pointer;border:1px solid rgba(0,0,0,.12);${cur && cur.id === s.id ? 'background:rgba(143,216,184,.35);' : 'background:#fff;'}">${esc(s.name)} <b data-del="${s.id}" style="margin-left:4px;cursor:pointer;color:#b04a5a;">×</b></span>`).join('');
    if (!S.ai.wsess && lst.length) S.ai.wsess = lst[0];
    const addBtn = document.getElementById('web-add');
    if (addBtn) addBtn.onclick = () => webAddSession();
    box.querySelectorAll('.web-chip').forEach(ch => {
      ch.onclick = e => {
        const del = e.target.closest('[data-del]');
        if (del) {
          apiPost('/api/plugin/webchat/sessions/delete', { id: del.dataset.del }).then(r => {
            if (r && r.ok) {
              if (S.ai.wsess && S.ai.wsess.id === del.dataset.del) { S.ai.wsess = null; S.ai.wsessId = null; }
              aiSaveState();
              renderWebSessions(); toast('会话已删除', 'info');
            }
            else toast((r && r.error) || '删除失败', 'error');
          });
          return;
        }
        const sid = ch.dataset.sid;
        S.ai.wsess = lst.find(s => s.id === sid) || null;
        aiSaveState();
        renderWebSessions();
      };
    });
  }).catch(() => {});
}
function webAddSession() {
  const m = modal({ title: '🌐 添加网页会话', body: `
    <div style="font-size:13px;color:var(--text-dim);margin-bottom:8px;">粘贴网页版会话链接（如 chat.deepseek.com/a/chat/s/xxx），对话将复用该会话的网页历史上下文。</div>
    <div style="font-size:13px;font-weight:600;margin:4px 0;">名称（可选）</div>
    <input class="input" id="ws-name" placeholder="例如：DeepSeek 学术讨论" style="width:100%;">
    <div style="font-size:13px;font-weight:600;margin:10px 0 4px;">会话链接</div>
    <input class="input" id="ws-url" placeholder="https://chat.deepseek.com/a/chat/s/..." style="width:100%;">
  `, actions: [
    { label: '保存', cls: '', onClick: mask => {
      const url = $('#ws-url').value.trim();
      if (!url) { toast('链接不能为空', 'warn'); return; }
      apiPost('/api/plugin/webchat/sessions', { name: $('#ws-name').value.trim(), url }).then(r => {
        if (!r || !r.ok) { toast((r && r.error) || '保存失败', 'error'); return; }
        S.ai.wsess = r.session;
        mask.remove(); renderWebSessions(); toast('会话已添加 ✓', 'success');
      }).catch(e => toast(e.message, 'error'));
    }},
    { label: '取消', cls: 'soft', onClick: mask => mask.remove() },
  ]});
}
function webLogin() {
  toast('正在打开登录窗口，请在弹出的浏览器中登录…', 'info');
  apiPost('/api/plugin/webchat/login').then(r => {
    if (r && r.ok) { toast('登录成功 ✓ 已自动切换回后台模式', 'success'); refreshWebStatus(); }
    else toast('登录失败：' + ((r && r.error) || '未知错误'), 'error');
  }).catch(e => toast(e.message, 'error'));
}
function aiHist() {
  if (!S.ai) S.ai = { tab: 'deepseek', hist: {} };
  if (!S.ai.hist[S.ai.tab]) S.ai.hist[S.ai.tab] = [];
  return S.ai.hist[S.ai.tab];
}
function replayAIHistory() {
  const hist = aiHist();
  if (!hist.length) {
    if (aiTab() === 'web') {
      aiPush('ai', '你好！当前模式：🌐 网页会话。点击「➕ 添加会话」保存网页版对话链接，即可通过网页版对话（保留网页历史上下文、可使用网页版联网能力）。');
      return;
    }
    const p = AI_PROVIDERS.find(x => x.id === aiTab());
    aiPush('ai', `你好！当前平台：${p.icon} ${p.label}。输入消息即可对话，回答支持公式与 Markdown 原文。`);
    return;
  }
  hist.forEach(m => aiBubble(m.role, m.content));
}
function refreshAIStatus() {
  api('/api/plugin/ai/keys').then(k => {
    const el = $('#ai-status');
    if (!el) return;
    const provs = (k && k.providers) || {};
    const parts = AI_PROVIDERS.map(p => {
      const s = provs[p.id];
      return s && s.has_key
        ? `${p.icon} ${p.label}：<span style="color:#30a46e;">✓（${esc(s.model)}）</span>`
        : `${p.icon} ${p.label}：<span style="color:#b04a5a;">未配置</span>`;
    });
    el.innerHTML = parts.join(' · ');
  }).catch(() => {});
}
function aiTxLogRender() {
  /* 接口收发日志卡片：最新发送指令串 + 最新接收信息（回复或状态） */
  const el = document.getElementById('ai-txlog');
  if (!el) return;
  const d = S.ai && S.ai.txlog;
  const block = (label, item, color) => item ? `<div style="margin-bottom:6px;">
    <div style="font-size:11px;color:var(--text-dim);font-weight:600;">${label} <span style="font-weight:400;">· ${esc(item.ts)} · ${esc(item.provider || '')}</span></div>
    <div style="font-size:12px;font-family:monospace;white-space:pre-wrap;word-break:break-word;max-height:130px;overflow:auto;border-left:2px solid ${color};padding-left:8px;margin-top:2px;">${esc(String(item.text || ''))}</div>
  </div>` : '';
  el.innerHTML = `<div style="font-size:12.5px;font-weight:600;margin-bottom:6px;">📡 接口收发日志 <span class="fin-note" style="font-weight:400;">（最新发送指令串 / 最新接收信息 · 自动更新）</span></div>`
    + block('⬆ 最新发送指令串', d && d.lastSend, '#6366f1')
    + block('⬇ 最新接收信息', d && d.lastRecv, '#2e9e6b')
    + ((!d || (!d.lastSend && !d.lastRecv)) ? '<div class="fin-note" style="font-size:11px;">尚无收发记录 —— 发送一条消息后自动显示。</div>' : '');
}
function aiTxLogSet(kind, provider, text) {
  /* 记录收发日志并持久化（仅保留最新一条发送 / 接收） */
  if (!S.ai) S.ai = {};
  if (!S.ai.txlog) S.ai.txlog = {};
  const rec = { ts: fmtDate(new Date()) + ' ' + new Date().toTimeString().slice(0, 5), provider: provider || '', text: String(text || '') };
  if (kind === 'send') S.ai.txlog.lastSend = rec; else S.ai.txlog.lastRecv = rec;
  aiSaveState();
  aiTxLogRender();
}
function aiBubble(role, text) {
  const msgs = $('#ai-msgs');
  const d = document.createElement('div');
  d.style.cssText = role === 'user'
    ? 'align-self:flex-end;background:rgba(143,216,184,.35);border-radius:12px 12px 4px 12px;padding:8px 12px;max-width:85%;white-space:pre-wrap;word-break:break-word;font-size:13.5px;'
    : 'align-self:flex-start;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:12px 12px 12px 4px;padding:8px 12px;max-width:85%;white-space:pre-wrap;word-break:break-word;font-size:13.5px;';
  d.textContent = text;
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
}
function aiPush(role, text) {
  aiBubble(role, text);
  aiHist().push({ role, content: text });
  aiSaveState();
}
function aiCall(msg) {
  fqAbortReset(); /* 新一次对话：清除上次中断标志 */
  const abBtn = document.getElementById('ai-abort');
  if (abBtn) abBtn.style.display = '';
  const done = () => { if (abBtn) abBtn.style.display = 'none'; };
  aiPush('ai', aiTab() === 'web' ? '（网页会话思考中…）' : '（思考中…）');
  const pid = aiTab();
  const pLabel = (AI_PROVIDERS.find(x => x.id === pid) || { label: '网页会话' }).label;
  aiTxLogSet('send', pid === 'web' ? '网页会话' : pLabel, msg);
  const last = $('#ai-msgs').lastElementChild;
  if (pid === 'web') {
    const sess = S.ai.wsess;
    if (!sess) { last.textContent = '⚠ 请先点击「➕ 添加会话」并选择一个会话链接'; done(); return; }
    apiPost('/api/plugin/webchat/chat', { url: sess.url, message: msg }).then(r => {
      done();
      if (!r || !r.ok) {
        const errTxt = '⚠ ' + ((r && r.error) || '请求失败');
        last.textContent = errTxt;
        aiTxLogSet('recv', '网页会话', errTxt);
        if (r && r.aborted) { last.textContent = '⛔ 已手动中断'; toast('⛔ 对话已中断', 'warn'); return; }
        if (r && r.code === 'need_login') { toast('登录已失效，正在打开登录窗口…', 'warn'); webLogin(); }
        return;
      }
      last.textContent = r.text;
      aiTxLogSet('recv', '网页会话', r.text);
      S.ai.hist['web'].push({ role: 'assistant', content: r.text });
      aiSaveState();
    }).catch(e => { done(); if (FQ_ABORT) { last.textContent = '⛔ 已手动中断'; return; } last.textContent = '⚠ ' + e.message; aiTxLogSet('recv', '网页会话', '⚠ ' + e.message); });
    return;
  }
  apiPost('/api/plugin/ai/chat', { provider: pid, message: msg, history: S.ai.hist[pid] || [] }).then(r => {
    done();
    if (!r || !r.ok) {
      const errTxt = '⚠ ' + ((r && r.error) || '请求失败');
      last.textContent = errTxt;
      aiTxLogSet('recv', pLabel, errTxt);
      if (r && r.aborted) { last.textContent = '⛔ 已手动中断'; toast('⛔ 对话已中断', 'warn'); }
      return;
    }
    last.textContent = r.text;
    aiTxLogSet('recv', pLabel, r.text);
    S.ai.hist[pid].push({ role: 'assistant', content: r.text });
    aiSaveState();
  }).catch(e => { done(); if (FQ_ABORT) { last.textContent = '⛔ 已手动中断'; return; } last.textContent = '⚠ ' + e.message; aiTxLogSet('recv', pLabel, '⚠ ' + e.message); });
}
function aiSetKey() {
  const p = AI_PROVIDERS.find(x => x.id === aiTab());
  const m = modal({ title: `🤖 AI 工作台 · ${p.label} Key`, body: `
    <div style="font-size:13px;color:var(--text-dim);margin-bottom:8px;">在 ${p.hint}。Key 仅保存在本机 <b>data/ai_keys.json</b>，不会上传。</div>
    <div style="font-size:13px;font-weight:600;margin:4px 0;">API Key</div>
    <input class="input" id="ak-key" type="password" placeholder="sk-..." style="width:100%;">
    <div style="font-size:13px;font-weight:600;margin:10px 0 4px;">模型（可选）</div>
    <input class="input" id="ak-model" placeholder="${p.defaultModel}" style="width:100%;">
  `, actions: [
    { label: '保存', cls: '', onClick: mask => {
      const key = $('#ak-key').value.trim();
      if (!key) { toast('Key 不能为空', 'warn'); return; }
      const model = $('#ak-model').value.trim() || p.defaultModel;
      const body = { provider: p.id };
      body[p.id] = key;
      body[p.id + '_model'] = model;
      apiPost('/api/plugin/ai/keys', body).then(r => {
        if (!r || !r.ok) { toast((r && r.error) || '保存失败', 'error'); return; }
        mask.remove(); refreshAIStatus(); toast(`${p.label} Key 已保存 ✓ 可以开始对话了`, 'success');
      }).catch(e => toast(e.message, 'error'));
    }},
    { label: '取消', cls: 'soft', onClick: mask => mask.remove() },
  ]});
}


window.__toolRenderers.ai = renderAITool;
})();

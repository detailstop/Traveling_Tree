'use strict';
/* 项目管理器：仅存储手填提示词、导入文本结果并保存上下文快照。 */
(function () {
const PM_STATUS = {
  empty: ['未开始', 'empty'],
  prompt_ready: ['提示词就绪', 'prompt_ready'],
  result_pasted: ['已回填', 'result_pasted'],
  satisfied: ['已验收', 'satisfied'],
};
const PM_RESULT_FORMAT_REQUIREMENTS = [
  '正文格式：Markdown 纯文本，长度不限，必填。',
  '',
  'summary_json 通用 schema：',
  '{',
  '  "schema_version": "1.0",',
  '  "step_id": "S0",',
  '  "status": "draft",',
  '  "objective": "本步在做什么",',
  '  "outputs": [{ "artifact": "文件名", "summary": "结果摘要" }],',
  '  "changes": [{ "type": "add|modify|remove", "target": "对象", "description": "变化" }],',
  '  "decisions": [{ "question": "问题", "choice": "选择", "reason": "依据" }],',
  '  "risks": [{ "risk": "风险", "impact": "影响", "mitigation": "缓解" }],',
  '  "verification": [{ "check": "检查项", "result": "pass|fail|na", "evidence": "证据" }],',
  '  "notes": ["备注"],',
  '  "details": {},',
  '  "task_done": false',
  '}',
  '',
  'details 字段说明：details 为对象，由各阶段自行定义内部结构，必须承载本阶段全部关键信息，不得只放摘要；下游阶段通过 details 取用结构化内容。若某阶段尚未定义 details 结构，写 <!-- 待补充 -->。',
  '',
  '阶段特有要求：',
  '- S0：details 必须包含以下字段，且与正文内容一致：',
  '  {',
  '    "goal": "项目要达成的可验证终态，一句话",',
  '    "scope_in": ["本项目明确要做的范围，逐条"],',
  '    "scope_out": ["明确不做的内容，逐条"],',
  '    "acceptance": ["验收标准，逐条，每条可检查"],',
  '    "constraints": ["关键约束，逐条"],',
  '    "risks": [{ "risk": "风险", "impact": "影响", "mitigation": "缓解" }],',
  '    "open_questions": ["待确认项，逐条"]',
  '  }',
  '  上述六项内容必须同时出现在正文与 details 中；details 为结构化版本，正文为人类可读版本。',
  '- S3：正文内必须包含一个 ```json 代码块，内容为任务对象数组，每个对象含 id、title、description、files、acceptance。',
  '- S5：summary_json 必须含布尔字段 task_done。',
].join('\n');
const PM = { projects: [], project: null, stageId: null, detail: null, selectedDraftId: null, editor: null };

async function pmRequest(path, method = 'GET', body) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  let response;
  try { response = await fetch(path, options); }
  catch (cause) {
    const error = new Error('无法连接本机服务，请检查服务是否运行。', { cause });
    error.status = 0;
    throw error;
  }
  const type = response.headers.get('Content-Type') || '';
  const raw = await response.text();
  let data = raw;
  if (!type.includes('text/plain') && raw) {
    try { data = JSON.parse(raw); } catch (_) { data = { error: raw }; }
  }
  if (!response.ok || (data && typeof data === 'object' && data.ok === false)) {
    const message = typeof data === 'string' ? data : (data && data.error);
    const error = new Error(message || `请求失败（HTTP ${response.status}）`);
    error.status = response.status;
    throw error;
  }
  pmClearError();
  return data;
}

function pmStatus(status) {
  const [label, cls] = PM_STATUS[status] || ['未知', 'empty'];
  return `<span class="pm-status ${cls}">${label}</span>`;
}
function pmDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? esc(value) : esc(date.toLocaleString());
}
function pmToast(message, type = 'info') { toast(message, type); }
function pmClearError() { $('#pm-error')?.remove(); }
function pmError(error) {
  const root = $('#pm-view');
  if (!root) return;
  let host = $('#pm-error');
  if (!host) {
    host = document.createElement('div');
    host.id = 'pm-error';
    host.className = 'pm-error-box';
    host.setAttribute('role', 'alert');
    root.prepend(host);
  }
  host.replaceChildren();
  const text = document.createElement('span');
  const status = error && Number.isInteger(error.status) && error.status > 0
    ? `HTTP ${error.status}：` : (error && error.status === 0 ? '连接错误：' : '页面错误：');
  text.textContent = status + (error && error.message || String(error));
  const close = document.createElement('button');
  close.type = 'button'; close.className = 'pm-error-close'; close.textContent = '关闭';
  close.onclick = pmClearError;
  host.append(text, close);
}
function pmDownload(name, content) {
  window.rtDownloadText(content, name, 'text/plain;charset=utf-8');
}
async function pmCopy(content, label) {
  try { await navigator.clipboard.writeText(content); pmToast(label + '已复制', 'success'); }
  catch (_) { pmError(new Error('复制失败，请检查浏览器剪贴板权限。')); }
}

function renderProjectManager() {
  const host = $('#tool-view');
  if (!host) return;
  if (!$('#pm-view')) host.innerHTML = '<div id="pm-view"></div>';
  const root = $('#pm-view');
  if (!root) return;
  root.classList.remove('hidden');
  PM.project = null; PM.stageId = null; PM.detail = null; PM.selectedDraftId = null; PM.editor = null;
  pmLoadProjects();
}

async function pmLoadProjects() {
  const root = $('#pm-view');
  root.innerHTML = '<div class="pm-loading">正在读取项目…</div>';
  try {
    const data = await pmRequest('/api/plugin/project_manager/projects');
    PM.projects = data.projects || [];
    pmRenderProjectList();
  } catch (error) { pmError(error); }
}

function pmRenderProjectList() {
  const root = $('#pm-view');
  pmBindProjectListEvents(root);
  root.innerHTML = `
    <div class="pm-head"><div><h2>项目管理</h2><p>按六个固定阶段推进项目；提示词由用户手填，文本结果与上下文声明保存在本机 SQLite。</p></div></div>
    <section class="pm-create-entry">
      <div class="pm-create-entry-head"><b>新建项目</b><button class="btn soft sm" id="pm-new-toggle" data-action="toggle-new-project" aria-expanded="false">展开表单</button></div>
      <form id="pm-new-form" class="pm-create hidden">
        <label>项目名称<input class="input" name="name" maxlength="160" required placeholder="输入项目名称"></label>
        <label>项目描述<textarea class="input" name="description" rows="2" placeholder="目标、背景或边界说明（可选）"></textarea></label>
        <div><button class="btn" type="submit">创建</button><button class="btn soft" type="button" id="pm-new-cancel" data-action="cancel-new-project">取消</button></div>
      </form>
    </section>
    <div class="pm-project-list-title">项目列表</div>
    ${PM.projects.length ? `<div class="pm-project-list">${PM.projects.map(project => {
      const latest = project.latest_stage;
      return `<div class="pm-project-row">
        <button class="pm-project-card" data-action="open-project" data-project-id="${project.id}">
          <span class="pm-project-main"><b>${esc(project.name)}</b><small>创建于 ${pmDate(project.created_at)}</small></span>
          <span class="pm-project-current">${latest ? `<b>${esc(latest.name)}</b>${pmStatus(latest.status)}` : '阶段未初始化'}</span>
          <span class="pm-project-arrow">›</span>
        </button>
        <button class="btn soft danger" data-action="delete-project" data-project-id="${project.id}">删除</button>
      </div>`;
    }).join('')}</div>` : '<div class="pm-empty">尚无项目。展开上方表单创建项目。</div>'}`;
}

function pmBindProjectListEvents(root) {
  if (!root || root.dataset.pmProjectListEvents === 'bound') return;
  root.dataset.pmProjectListEvents = 'bound';
  root.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target || !root.contains(target)) return;
    if (target.dataset.action === 'toggle-new-project') {
      const form = $('#pm-new-form');
      const opening = form.classList.contains('hidden');
      form.classList.toggle('hidden', !opening);
      target.textContent = opening ? '收起表单' : '展开表单';
      target.setAttribute('aria-expanded', String(opening));
      if (opening) form.elements.namedItem('name')?.focus();
    } else if (target.dataset.action === 'cancel-new-project') {
      const form = $('#pm-new-form');
      form.reset();
      form.classList.add('hidden');
      const toggle = $('[data-action="toggle-new-project"]');
      if (toggle) { toggle.textContent = '展开表单'; toggle.setAttribute('aria-expanded', 'false'); }
    } else if (target.dataset.action === 'open-project') {
      pmOpenProject(Number(target.dataset.projectId));
    } else if (target.dataset.action === 'delete-project') {
      const projectId = Number(target.dataset.projectId);
      const project = PM.projects.find(item => item.id === projectId);
      if (!project || !window.confirm(`确认删除项目“${project.name}”及其全部阶段、提示词和结果？此操作不可撤销。`)) return;
      target.disabled = true;
      pmRequest(`/api/plugin/project_manager/projects/${projectId}`, 'DELETE')
        .then(() => pmLoadProjects())
        .catch(error => pmError(error))
        .finally(() => { target.disabled = false; });
    }
  });
  root.addEventListener('submit', async event => {
    if (event.target.id !== 'pm-new-form') return;
    event.preventDefault();
    const form = event.target;
    const fields = new FormData(form);
    const submit = form.querySelector('[type="submit"]');
    if (submit.disabled) return;
    submit.disabled = true;
    try {
      await pmRequest('/api/plugin/project_manager/projects', 'POST', {
        name: fields.get('name'), description: fields.get('description'),
      });
      form.reset();
      await pmLoadProjects();
    } catch (error) { pmError(error); }
    finally { submit.disabled = false; }
  });
}

async function pmOpenProject(projectId, stageId) {
  const root = $('#pm-view');
  root.innerHTML = '<div class="pm-loading">正在读取阶段…</div>';
  try {
    PM.project = await pmRequest('/api/plugin/project_manager/projects/' + projectId);
    PM.stageId = stageId || PM.project.latest_stage_id || (PM.project.stages[0] || {}).id;
    PM.selectedDraftId = null;
    await pmLoadStage();
  } catch (error) { pmError(error); }
}

async function pmLoadStage() {
  if (!PM.stageId) return pmLoadProjects();
  PM.detail = await pmRequest('/api/plugin/project_manager/stages/' + PM.stageId);
  if (!PM.detail.prompt_drafts.some(draft => draft.id === PM.selectedDraftId)) {
    PM.selectedDraftId = PM.detail.active_draft?.id ?? null;
  }
  pmRenderProjectDetail();
}

async function pmLoadProjectAndStage() {
  PM.project = await pmRequest(`/api/plugin/project_manager/projects/${PM.project.id}`);
  PM.detail = await pmRequest(`/api/plugin/project_manager/stages/${PM.stageId}`);
  if (!PM.detail.prompt_drafts.some(draft => draft.id === PM.selectedDraftId)) {
    PM.selectedDraftId = PM.detail.active_draft?.id ?? null;
  }
  pmRenderProjectDetail();
}

function pmRenderProjectDetail() {
  const root = $('#pm-view');
  const project = PM.project;
  const stages = project.stages || [];
  const { stage, active_draft: active, prompt_drafts: drafts, results } = PM.detail;
  const selected = drafts.find(draft => draft.id === PM.selectedDraftId) || active;
  root.innerHTML = `
    <div class="pm-head pm-detail-head"><div><button class="btn soft sm" id="pm-list-back">← 项目列表</button><h2>${esc(project.name)}</h2><p>${esc(project.description || '未填写描述')}</p></div><span class="pm-project-state">${project.status === 'active' ? '进行中' : project.status === 'completed' ? '已完成' : '已归档'}</span></div>
    <nav class="pm-stage-nav">${stages.map(item => `<button class="pm-stage-step ${item.id === PM.stageId ? 'selected' : ''} ${item.is_latest ? 'latest' : ''}" data-stage-id="${item.id}"><span>${esc(item.code)}</span><b>${esc(item.name)}</b>${item.is_latest ? '<i>当前</i>' : ''}<small>${PM_STATUS[item.status]?.[0] || esc(item.status)}</small></button>`).join('')}</nav>
    <div class="pm-stage-summary"><b>${esc(stage.code)} ${esc(stage.name)}</b><span>${esc(stage.purpose)}</span>${pmStatus(stage.status)}</div>
    <div class="pm-columns">
      <section class="pm-panel">
        <h3>提示词</h3>
        <div class="pm-draft-meta">${selected ? `当前查看 v${selected.version} · ${selected.is_active ? '当前版本' : '历史版本'} · ${pmDate(selected.created_at)}` : '暂无当前版本'}</div>
        ${selected ? `<pre class="pm-prompt-content">${esc(selected.content)}</pre>` : '<div class="pm-empty compact">暂无提示词</div>'}
        <div class="pm-actions">
          <button class="btn" id="pm-new-prompt">新建提示词</button>
          <button class="btn soft" id="pm-edit-prompt" ${active ? '' : 'disabled'}>编辑当前版本</button>
          <button class="btn soft" id="pm-delete-active" ${active ? '' : 'disabled'}>删除当前版本</button>
          <button class="btn soft" id="pm-copy-prompt" ${selected ? '' : 'disabled'}>复制</button>
          <button class="btn soft" id="pm-export-prompt" ${selected ? '' : 'disabled'}>导出</button>
        </div>
        <div id="pm-prompt-editor" class="pm-manual-area hidden"></div>
        <details class="pm-versions" ${drafts.length ? '' : 'hidden'}><summary>提示词版本（${drafts.length}）</summary>
          ${drafts.map(draft => `<div class="pm-version-row ${draft.id === selected?.id ? 'selected' : ''}">
            <button class="pm-version-select" data-view-draft="${draft.id}">v${draft.version} · ${draft.source === 'manual' ? '手填' : '历史版本'} · ${pmDate(draft.created_at)}</button>
            ${draft.is_active ? '<b>当前</b>' : `<button class="btn soft sm" data-activate-draft="${draft.id}">设为当前版本</button>`}
            <button class="btn soft sm danger" data-delete-draft="${draft.id}">删除</button>
          </div>`).join('')}
        </details>
      </section>
      <section class="pm-panel">
        <div class="pm-panel-heading"><h3>结果 <small>共 ${results.length} 条</small></h3><div class="pm-actions"><button class="btn soft" id="pm-format-toggle" aria-expanded="false">结果格式要求</button><button class="btn" id="pm-import-toggle">导入结果</button></div></div>
        <section id="pm-format-panel" class="pm-format-panel hidden" aria-label="结果格式要求">
          <pre>${esc(PM_RESULT_FORMAT_REQUIREMENTS)}</pre>
          <button class="btn soft sm" id="pm-copy-format">复制格式要求</button>
        </section>
        <form id="pm-result-form" class="pm-result-import hidden">
          <label class="pm-label">选择 .txt / .md 文件（可选）<input class="input" type="file" id="pm-result-file" accept=".txt,.md,text/plain,text/markdown"></label>
          <label class="pm-label">粘贴或编辑结果正文<textarea class="input" name="body" rows="9" required placeholder="Markdown 纯文本"></textarea></label>
          <label class="pm-label">总结 JSON（可选）<textarea class="input" name="summary_json" rows="3" placeholder='{"objective":"..."}'></textarea></label>
          <div><button class="btn sm" type="submit">保存结果</button><button class="btn soft sm" type="button" id="pm-result-cancel">取消</button></div>
        </form>
        ${results.length ? `<div class="pm-results">${results.map(result => {
          const promptLabel = result.prompt_version ? `提示词 v${result.prompt_version}` : '未关联';
          return `<article class="pm-result">
            <div class="pm-result-head"><b>结果 #${result.id}</b><time>${pmDate(result.created_at)}</time><span>${promptLabel}</span></div>
            <details class="pm-result-context"><summary>查看上下文声明</summary><pre class="pm-context">${esc(result.context_header)}</pre></details>
            <pre class="pm-result-body">${esc(result.body)}</pre>
            ${result.summary_json ? `<details class="pm-summary-inline"><summary>总结 JSON</summary><pre>${esc(result.summary_json)}</pre></details>` : ''}
            <div class="pm-actions">
              <button class="btn soft sm" data-copy-context="${result.id}">复制声明</button>
              <button class="btn soft sm" data-copy-full="${result.id}">复制声明+正文</button>
              <button class="btn soft sm" data-copy-body="${result.id}">复制正文</button>
              <button class="btn soft sm" data-export-context="${result.id}">导出声明</button>
              <button class="btn soft sm" data-export-body="${result.id}">导出正文</button>
              <button class="btn soft sm" data-export-full="${result.id}">导出声明+正文</button>
              <button class="btn soft sm danger" data-delete-result="${result.id}">删除</button>
            </div>
          </article>`;
        }).join('')}</div>` : '<div class="pm-empty compact">暂无结果</div>'}
      </section>
      <section class="pm-panel">
        <h3>总结与状态</h3>
        ${results[0]?.summary_json ? `<pre class="pm-summary">${esc(results[0].summary_json)}</pre>` : '<div class="pm-empty compact">最新结果没有总结 JSON</div>'}
        <div class="pm-status-current">当前状态：${pmStatus(stage.status)}</div>
        <div class="pm-status-actions">${Object.entries(PM_STATUS).map(([key, [label]]) => `<button class="btn soft sm" data-set-status="${key}" ${stage.status === key ? 'disabled' : ''}>${label}</button>`).join('')}</div>
        <div class="pm-actions"><button class="btn soft sm" id="pm-refresh">刷新</button></div>
      </section>
    </div>`;
  pmWireProjectDetail();
}

function pmPromptEditor(mode) {
  const editor = $('#pm-prompt-editor');
  const active = PM.detail.active_draft;
  if (!mode) { editor.classList.add('hidden'); editor.replaceChildren(); PM.editor = null; return; }
  PM.editor = mode;
  editor.classList.remove('hidden');
  editor.innerHTML = `<label class="pm-label">${mode === 'edit' ? '编辑当前版本内容' : '新提示词内容'}<textarea class="input" id="pm-prompt-content" rows="12" placeholder="手动输入完整提示词">${mode === 'edit' ? esc(active?.content || '') : ''}</textarea></label><div><button class="btn sm" id="pm-prompt-save">保存为新版本</button><button class="btn soft sm" id="pm-prompt-cancel">取消</button></div>`;
  $('#pm-prompt-save').onclick = async () => {
    try {
      const content = $('#pm-prompt-content').value;
      await pmRequest(`/api/plugin/project_manager/stages/${PM.stageId}/prompt-drafts`, 'POST', { content });
      PM.selectedDraftId = null;
      await pmLoadStage();
    } catch (error) { pmError(error); }
  };
  $('#pm-prompt-cancel').onclick = () => pmPromptEditor(null);
}

function pmWireProjectDetail() {
  const root = $('#pm-view');
  const stage = PM.detail.stage;
  const selected = PM.detail.prompt_drafts.find(draft => draft.id === PM.selectedDraftId) || PM.detail.active_draft;
  const results = new Map(PM.detail.results.map(result => [result.id, result]));
  $('#pm-list-back').onclick = pmLoadProjects;
  root.querySelectorAll('[data-stage-id]').forEach(button => button.onclick = async () => {
    PM.stageId = Number(button.dataset.stageId); PM.selectedDraftId = null;
    try { await pmLoadStage(); } catch (error) { pmError(error); }
  });
  $('#pm-new-prompt').onclick = () => pmPromptEditor('new');
  $('#pm-edit-prompt').onclick = () => pmPromptEditor('edit');
  $('#pm-copy-prompt').onclick = () => selected && pmCopy(selected.content, '提示词');
  $('#pm-export-prompt').onclick = () => selected && pmDownload(`pm-${stage.code}-v${selected.version}-prompt.txt`, selected.content);
  $('#pm-delete-active').onclick = async () => {
    const active = PM.detail.active_draft;
    if (!active || !window.confirm(`确认删除当前提示词 v${active.version}？关联结果会保留，但关联版本将清空。`)) return;
    try { await pmRequest(`/api/plugin/project_manager/prompt-drafts/${active.id}`, 'DELETE'); PM.selectedDraftId = null; await pmLoadStage(); }
    catch (error) { pmError(error); }
  };
  root.querySelectorAll('[data-view-draft]').forEach(button => button.onclick = () => {
    PM.selectedDraftId = Number(button.dataset.viewDraft); pmRenderProjectDetail();
  });
  root.querySelectorAll('[data-activate-draft]').forEach(button => button.onclick = async () => {
    try {
      const id = Number(button.dataset.activateDraft);
      await pmRequest(`/api/plugin/project_manager/prompt-drafts/${id}`, 'PATCH', { is_active: true });
      PM.selectedDraftId = id; await pmLoadStage();
    } catch (error) { pmError(error); }
  });
  root.querySelectorAll('[data-delete-draft]').forEach(button => button.onclick = async () => {
    const draft = PM.detail.prompt_drafts.find(item => item.id === Number(button.dataset.deleteDraft));
    if (!draft || !window.confirm(`确认删除提示词 v${draft.version}？`)) return;
    try { await pmRequest(`/api/plugin/project_manager/prompt-drafts/${draft.id}`, 'DELETE'); PM.selectedDraftId = null; await pmLoadStage(); }
    catch (error) { pmError(error); }
  });

  const importForm = $('#pm-result-form');
  $('#pm-format-toggle').onclick = event => {
    const panel = $('#pm-format-panel');
    panel.classList.toggle('hidden');
    event.currentTarget.setAttribute('aria-expanded', String(!panel.classList.contains('hidden')));
  };
  $('#pm-copy-format').onclick = () => pmCopy(PM_RESULT_FORMAT_REQUIREMENTS, '格式要求');
  $('#pm-import-toggle').onclick = () => importForm.classList.toggle('hidden');
  $('#pm-result-file').onchange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { importForm.elements.body.value = await file.text(); }
    catch (error) { pmError(error); }
  };
  $('#pm-result-cancel').onclick = () => { importForm.reset(); importForm.classList.add('hidden'); };
  importForm.onsubmit = async event => {
    event.preventDefault();
    const fields = new FormData(importForm);
    const summary = String(fields.get('summary_json') || '').trim();
    try {
      if (summary) JSON.parse(summary);
      await pmRequest(`/api/plugin/project_manager/stages/${stage.id}/results`, 'POST', {
        body: fields.get('body'), summary_json: summary || null,
        prompt_draft_id: PM.detail.active_draft?.id ?? null,
      });
      await pmLoadProjectAndStage();
    } catch (error) { pmError(error); }
  };
  root.querySelectorAll('[data-copy-context]').forEach(button => button.onclick = () => pmCopy(results.get(Number(button.dataset.copyContext)).context_header, '上下文声明'));
  root.querySelectorAll('[data-copy-body]').forEach(button => button.onclick = () => pmCopy(results.get(Number(button.dataset.copyBody)).body, '结果正文'));
  root.querySelectorAll('[data-copy-full]').forEach(button => button.onclick = () => {
    const result = results.get(Number(button.dataset.copyFull));
    pmCopy(result.context_header + '\n\n---\n\n' + result.body, '声明与正文');
  });
  root.querySelectorAll('[data-export-context]').forEach(button => button.onclick = async () => {
    const result = results.get(Number(button.dataset.exportContext));
    try {
      const context = await pmRequest(`/api/plugin/project_manager/results/${result.id}/export-context`);
      pmDownload(`pm-result-${result.id}-context.txt`, context);
    } catch (error) { pmError(error); }
  });
  root.querySelectorAll('[data-export-body]').forEach(button => button.onclick = () => {
    const result = results.get(Number(button.dataset.exportBody));
    pmDownload(`pm-result-${result.id}.md`, result.body);
  });
  root.querySelectorAll('[data-export-full]').forEach(button => button.onclick = () => {
    const result = results.get(Number(button.dataset.exportFull));
    pmDownload(`pm-result-${result.id}-with-context.md`, result.context_header + '\n\n---\n\n' + result.body);
  });
  root.querySelectorAll('[data-delete-result]').forEach(button => button.onclick = async () => {
    const result = results.get(Number(button.dataset.deleteResult));
    if (!result || !window.confirm(`确认删除结果 #${result.id}？`)) return;
    try { await pmRequest(`/api/plugin/project_manager/results/${result.id}`, 'DELETE'); await pmLoadProjectAndStage(); }
    catch (error) { pmError(error); }
  });
  root.querySelectorAll('[data-set-status]').forEach(button => button.onclick = async () => {
    try {
      await pmRequest(`/api/plugin/project_manager/stages/${stage.id}/status`, 'PATCH', { status: button.dataset.setStatus });
      await pmLoadProjectAndStage();
    } catch (error) { pmError(error); }
  });
  $('#pm-refresh').onclick = async () => {
    try { await pmLoadProjectAndStage(); } catch (error) { pmError(error); }
  };
}

window.__toolRenderers['project-manager'] = renderProjectManager;
})();

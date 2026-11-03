'use strict';
/* 理财量化占位：旧 finquant 数据已丢弃，不读写任何 API/表。 */
(function () {
  let ROOT = null;
  function renderFinQuantTool(container) {
  ROOT = container;
    const box = ROOT;
    box.innerHTML = `<div class="gcard" style="padding:28px;line-height:1.9;">
      <div class="section-title"><span class="st-emoji">📊</span>理财量化</div>
      <div style="font-size:14px;color:var(--text-dim);">
        数据已重置，功能待重构。<br>
        旧的 finquant 本地数据不迁移、不读取；本入口暂时只保留占位，不调用任何 API。
      </div>
    </div>`;
  }
  window.__toolRenderers.finquant = renderFinQuantTool;
})();

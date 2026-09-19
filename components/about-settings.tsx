"use client";

import { UiText, UiElement } from "@/components/ui-text";
import { DisclosureIcon } from "./disclosure-icon";
import { useState } from "react";
import { useLanguage } from "./language-provider";

type AboutSettingsProps = {
  defaultVersion: string;
};


export function AboutSettings({ defaultVersion }: AboutSettingsProps) {
  const { locale } = useLanguage();
  const releaseHighlights = locale === "en" ? [
    "Unified collection statuses: Holding, Awaiting Grading, At Grading, Pending Sale and Sold. The first four count as owned holdings.",
    "Valuation coverage now excludes sold cards; status edits validate quantity while historical cash flows and realized returns remain available.",
    "Grouped entry into card, grading and financial sections with automatic attribute checks.",
    "Added supplementary transactions, expenses and valuations during entry, including draft recovery.",
    "Added a remembered valuation visibility toggle and simplified Home labels.",
    "Restored filtered portfolio navigation and return to results, moved Portfolio before Showcase and simplified navigation copy.",
    "Unified export controls and added confirmed wish deletion in the editor.",
    "Reused portfolio quantities, valuation facts and coverage rules, removed redundant code and fixed stale AI attributes."
  ] : [
    "收藏状态统一为持有、待送评、送评中、待售、已售，前四项均计入持仓。",
    "估值覆盖排除已售，状态修改校验数量，保留历史现金流及已实现盈亏。",
    "录入页按卡片、评级和财务分区，字段关联属性自动勾选。",
    "录入时可补充交易、费用与估值记录，并随草稿恢复。",
    "首页估值增加可记忆的显隐切换，精简首页栏目名称。",
    "恢复首页筛选组合与返回结果入口，组合导航前移，精简相关提示和链接样式。",
    "统一导出操作与视图切换，心愿编辑区支持确认删除。",
    "组合统计复用数量、估值事实与覆盖口径，清理重复代码并修复 AI 属性残留。"
  ];
  const [expanded, setExpanded] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  function handleToggle() {
    if (expanded) setShowReleaseNotes(false);
    setExpanded((visible) => !visible);
  }

  return (
    <section className="panel settings-section about-settings" data-testid="about-settings">
      <button
        type="button"
        className="about-toggle"
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-controls="about-card-vault-content"
      >
        <span className="about-title"><UiText text={"关于"} /></span>
        <span className="about-toggle-end"><span className="about-version">v{defaultVersion}</span><DisclosureIcon expanded={expanded} /></span>
      </button>

      {expanded ? (
        <div className="about-content" id="about-card-vault-content">
          <div className="about-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowReleaseNotes((visible) => !visible)} aria-expanded={showReleaseNotes}><UiText text={"更新说明"} /></button>
            <a className="btn btn-secondary" href="https://github.com/qlinter/card-vault" target="_blank" rel="noreferrer"><UiText text={"项目主页"} /></a>
          </div>

          {showReleaseNotes ? (
            <UiElement as="div" uiMessages={{"aria-label": {text:"Card Vault v{0} 更新说明",values:[defaultVersion],translateValues:[]}}} className="about-release-notes" role="region" >
              <div><h3>v{defaultVersion}<UiText text={" 主要更新"} /></h3><small>2026-09-19</small></div>
              <ul data-i18n-skip>{releaseHighlights.map((item) => <li key={item}>{item}</li>)}</ul>
            </UiElement>
          ) : null}

          <footer className="about-footer">© 2026 QL · Card Vault</footer>
        </div>
      ) : null}
    </section>
  );
}

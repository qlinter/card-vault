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
    "CSV/XLSX import mapping, previews, per-row retries and conflict-safe undo.",
    "Paged collections, reminders, wishlist budgets and a shared user guide in Settings.",
    "Explicit interface translations protect user content; galleries emphasize complete card images.",
    "Mixed CNY/USD payments and cross-currency sales share one physical holding.",
    "Settings now manage reporting currency and manual FX dates, sources, and revisions.",
    "Financial views share one calculation; snapshots preserve their FX evidence and incomplete data remains unavailable.",
    "Backups pause local writes and validate referenced media. The globe opens a language menu."
  ] : [
    "新增 CSV/XLSX 导入映射、预演、逐行重试和冲突保护撤销。",
    "收藏分页、整理提醒、愿望预算与设置中的统一使用说明。",
    "显式界面翻译保护用户原文，展馆提升卡图展示和阅读体验。",
    "支持 CNY/USD 混合付款和跨币出售，同一实物数量只计算一次。",
    "设置中管理报表币种、人工汇率、生效日期、来源和历史修订。",
    "财务页面统一核算，快照保留汇率依据，资料缺失时明确标为不完整。",
    "备份暂停本地写入并校验媒体引用；地球按钮打开语言菜单。"
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
              <div><h3>v{defaultVersion}<UiText text={" 主要更新"} /></h3><small>2026-09-07</small></div>
              <ul data-i18n-skip>{releaseHighlights.map((item) => <li key={item}>{item}</li>)}</ul>
            </UiElement>
          ) : null}

          <footer className="about-footer">© 2026 QL · Card Vault</footer>
        </div>
      ) : null}
    </section>
  );
}

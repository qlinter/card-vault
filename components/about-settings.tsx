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
    "Windows-reserved and occupied ports now fall back to an OS-assigned local port.",
    "Missing FX preserves monthly purchase/sale counts; status timers and recurring reminders are accurate.",
    "Exports respect cross-page selections; restore rolls back if final validation fails.",
    "Incremental financial indexes, faster quote/rate lookup and focused reminder queries reduce unnecessary work.",
    "Only current data formats are supported; historical upgrade and conversion paths have been removed.",
    "Bilingual READMEs retain every historical version; release notes include code optimizations and validation."
  ] : [
    "Windows 保留或占用优先端口时，自动改用系统分配的本地端口。",
    "缺失汇率仍保留逐月买入/出售数量，修正状态计时与提醒复发。",
    "导出遵循跨页勾选范围；恢复最终检查失败时回滚原数据。",
    "增量财务索引、估值与汇率查找优化，单条提醒仅查询对应卡片。",
    "仅支持当前数据格式，移除历史数据升级与旧格式转换功能。",
    "中英文 README 保留全部历史版本，更新说明包含代码优化与验收结果。"
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
              <div><h3>v{defaultVersion}<UiText text={" 主要更新"} /></h3><small>2026-09-08</small></div>
              <ul data-i18n-skip>{releaseHighlights.map((item) => <li key={item}>{item}</li>)}</ul>
            </UiElement>
          ) : null}

          <footer className="about-footer">© 2026 QL · Card Vault</footer>
        </div>
      ) : null}
    </section>
  );
}

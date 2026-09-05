"use client";

import { useState } from "react";
import { useLanguage } from "./language-provider";

type AboutSettingsProps = {
  defaultVersion: string;
};


export function AboutSettings({ defaultVersion }: AboutSettingsProps) {
  const { locale } = useLanguage();
  const releaseHighlights = locale === "en" ? [
    "Mixed CNY/USD payments and cross-currency sales share one physical holding.",
    "Settings now manage reporting currency and manual FX dates, sources, and revisions.",
    "Financial views share one calculation; snapshots preserve their FX evidence and incomplete data remains unavailable.",
    "Backups pause local writes and validate referenced media. The globe opens a language menu."
  ] : [
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
        <span className="about-title">关于</span>
        <span className="about-version">v{defaultVersion}</span>
      </button>

      {expanded ? (
        <div className="about-content" id="about-card-vault-content">
          <div className="about-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowReleaseNotes((visible) => !visible)} aria-expanded={showReleaseNotes}>
              更新说明
            </button>
            <a className="btn btn-secondary" href="https://github.com/qlinter/card-vault" target="_blank" rel="noreferrer">
              项目主页
            </a>
          </div>

          {showReleaseNotes ? (
            <div className="about-release-notes" role="region" aria-label={`Card Vault v${defaultVersion} 更新说明`}>
              <div><h3>v{defaultVersion} 主要更新</h3><small>2026-08-28</small></div>
              <ul data-i18n-skip>{releaseHighlights.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ) : null}

          <footer className="about-footer">© 2026 QL · Card Vault</footer>
        </div>
      ) : null}
    </section>
  );
}

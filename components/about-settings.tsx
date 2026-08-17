"use client";

import { useState } from "react";

type AboutSettingsProps = {
  defaultVersion: string;
};

const releaseHighlights = [
  "优化卡片列表和组合分析的渲染性能。",
  "改进跨设备开发时的依赖检查与自动恢复。",
  "设置页新增可折叠的版本与项目入口。"
];

export function AboutSettings({ defaultVersion }: AboutSettingsProps) {
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
              <div><h3>v{defaultVersion} 主要更新</h3><small>2026-08-17</small></div>
              <ul>{releaseHighlights.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ) : null}

          <footer className="about-footer">© 2026 QL · Card Vault</footer>
        </div>
      ) : null}
    </section>
  );
}

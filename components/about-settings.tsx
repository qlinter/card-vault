"use client";

import { useState } from "react";

type AboutSettingsProps = {
  defaultVersion: string;
};

const releaseHighlights = [
  "自动识别并回填限量编号状态，首页支持限量卡筛选及 CNY 成本/估值排序。",
  "加固本地服务会话、Electron sandbox 与 IPC 来源校验。",
  "新增领域校验、代码检查和自动化测试覆盖率门槛，并升级 React 安全修复版本。"
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
              <div><h3>v{defaultVersion} 主要更新</h3><small>2026-08-21</small></div>
              <ul>{releaseHighlights.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ) : null}

          <footer className="about-footer">© 2026 QL · Card Vault</footer>
        </div>
      ) : null}
    </section>
  );
}

"use client";

import { useState } from "react";

type AboutSettingsProps = {
  defaultVersion: string;
};

const releaseHighlights = [
  "新增中英文界面切换，并完成主要页面的全英文覆盖与重复标题清理。",
  "完成分享展馆升级：统一展馆样式、响应式预览、重点卡故事、图片优化和导出质量检查。",
  "Windows 发布支持无证书生成完整产物；配置可信凭据后自动签名并校验时间戳。"
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
              <div><h3>v{defaultVersion} 主要更新</h3><small>2026-08-28</small></div>
              <ul>{releaseHighlights.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ) : null}

          <footer className="about-footer">© 2026 QL · Card Vault</footer>
        </div>
      ) : null}
    </section>
  );
}

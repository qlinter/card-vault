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
    "Updated Next.js, sharp and js-yaml to security-patched versions.",
    "Startup failures show the underlying error and actual log path.",
    "AI and storage settings are saved atomically; restore verifies copied files before switching data.",
    "Fixed Windows path boundaries and future-date counts in collection digests.",
    "Optimized dense portfolio history and added streamed CSV/XLSX generation with cancellation cleanup.",
    "Removed obsolete helpers and consolidated ZIP generation, performance sampling and packaging rules."
  ] : [
    "更新 Next.js、sharp 和 js-yaml，修复已知依赖安全问题。",
    "启动失败显示底层错误及实际日志路径。",
    "AI 与存储配置完整写入后替换；恢复切换前再次校验复制文件。",
    "修正 Windows 路径边界及收藏摘要的未来日期计数。",
    "优化密集组合历史，支持 CSV/XLSX 流式生成与取消清理。",
    "移除无用旧代码，统一 ZIP 归档、性能采样与打包内容管理。"
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

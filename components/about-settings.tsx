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
    "Added DeepSeek V4.1 Flash image recognition with encrypted local credentials.",
    "Aligned financial-history amounts and edit actions, and redesigned holding metrics.",
    "Simplified sorting and Portfolio labels; fixed structure alignment and long product names.",
    "Consolidated AI configuration rules and removed obsolete financial submission actions.",
    "Separated gallery HTML, styles and scripts while preserving generated output.",
    "Added automated dependency-cycle and client/server boundary checks."
  ] : [
    "新增 DeepSeek V4.1 Flash 图像识别配置，沿用本机密钥加密存储。",
    "对齐财务历史金额与编辑入口，重新整理持仓指标布局。",
    "精简排序及组合文案，修复收藏结构对齐和长产品线显示。",
    "统一 AI 配置规则，移除过时的财务提交入口。",
    "拆分分享 HTML、样式与脚本，保持生成内容一致。",
    "增加循环依赖与客户端/服务端边界自动检查。"
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
              <div><h3>v{defaultVersion}<UiText text={" 主要更新"} /></h3><small>2026-09-11</small></div>
              <ul data-i18n-skip>{releaseHighlights.map((item) => <li key={item}>{item}</li>)}</ul>
            </UiElement>
          ) : null}

          <footer className="about-footer">© 2026 QL · Card Vault</footer>
        </div>
      ) : null}
    </section>
  );
}

"use client";

import { UiText, UiElement } from "@/components/ui-text";
import { DisclosureIcon } from "./disclosure-icon";
import { useState } from "react";
import { useLanguage } from "./language-provider";
import { currentReleaseNotes } from "@/lib/release-notes";

type AboutSettingsProps = {
  defaultVersion: string;
};


export function AboutSettings({ defaultVersion }: AboutSettingsProps) {
  const { locale } = useLanguage();
  const releaseHighlights = currentReleaseNotes.highlights[locale === "en" ? "en" : "zh"];
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
              <div><h3>v{defaultVersion}<UiText text={" 主要更新"} /></h3><small>{currentReleaseNotes.date}</small></div>
              <ul data-i18n-skip>{releaseHighlights.map((item) => <li key={item}>{item}</li>)}</ul>
            </UiElement>
          ) : null}

          <footer className="about-footer">© 2026 QL · Card Vault</footer>
        </div>
      ) : null}
    </section>
  );
}

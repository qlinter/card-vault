"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UiText, UiElement } from "./ui-text";
import { DisclosureIcon } from "./disclosure-icon";
import { useLanguage } from "./language-provider";
import { currentReleaseNotes } from "@/lib/release-notes";

export function SettingsHelp({ defaultVersion }: { defaultVersion: string }) {
  const { locale } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false), [releaseOpen, setReleaseOpen] = useState(false);
  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash;
      if (hash === "#user-guide-settings") { router.replace("/settings/guide"); return; }
      if (["#help-settings", "#about-settings", "#about-card-vault-content"].includes(hash)) {
        setOpen(true);
        if (hash !== "#help-settings") setReleaseOpen(true);
      }
    };
    sync(); window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [router]);
  const highlights = currentReleaseNotes.highlights[locale === "en" ? "en" : "zh"];
  return <footer className="settings-help" id="help-settings" data-testid="settings-help">
    <button type="button" className="settings-help-toggle" aria-expanded={open} aria-controls="help-settings-content" onClick={() => setOpen(!open)}>
      <span><UiText text="帮助与版本" /></span><span><small>v{defaultVersion}</small><DisclosureIcon expanded={open} /></span>
    </button>
    <div className="settings-help-content" id="help-settings-content" hidden={!open}>
      <nav className="settings-help-actions">
        <Link className="btn btn-secondary" href="/settings/guide"><UiText text="使用说明" /></Link>
        <button className="btn btn-secondary" type="button" aria-expanded={releaseOpen} aria-controls="settings-release-notes" onClick={() => setReleaseOpen(!releaseOpen)}><UiText text="更新说明" /></button>
        <a className="btn btn-secondary" href="https://github.com/qlinter/card-vault" target="_blank" rel="noreferrer"><UiText text="项目主页" /></a>
      </nav>
      {releaseOpen ? <UiElement as="div" uiMessages={{ "aria-label": { text: "Card Vault v{0} 更新说明", values: [defaultVersion] } }} className="about-release-notes" id="settings-release-notes" role="region">
        <div><h3>v{defaultVersion}<UiText text=" 主要更新" /></h3><small>{currentReleaseNotes.date}</small></div>
        <ul data-i18n-skip>{highlights.map(item => <li key={item}>{item}</li>)}</ul>
      </UiElement> : null}
      <p className="settings-help-copyright">© 2026 QL · Card Vault</p>
    </div>
  </footer>;
}

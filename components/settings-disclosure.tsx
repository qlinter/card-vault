"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useLanguage } from "./language-provider";
import { DisclosureIcon } from "./disclosure-icon";

export function SettingsDisclosure({ id, zh, en, aliases = [], openOnHash = true, children }: {
  id: string; zh: string; en: string; aliases?: readonly string[]; openOnHash?: boolean; children: ReactNode;
}) {
  const { locale } = useLanguage();
  const [open, setOpen] = useState(false), [loaded, setLoaded] = useState(false);
  const targets = [id, ...aliases].join("|");
  useEffect(() => {
    if (!openOnHash) return;
    const sync = () => {
      if (targets.split("|").includes(window.location.hash.slice(1))) { setLoaded(true); setOpen(true); }
    };
    sync(); window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [targets, openOnHash]);
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (open && openOnHash && hash !== id && targets.split("|").includes(hash)) {
      document.getElementById(hash)?.scrollIntoView({ block: "start" });
    }
  }, [open, openOnHash, id, targets]);
  return <section className="panel settings-section" id={id}>
    <button type="button" className="ai-settings-toggle" aria-expanded={open} aria-controls={id + "-content"} aria-label={locale === "en" ? (open ? "Collapse " : "Expand ") + en : (open ? "收起" : "展开") + zh} onClick={() => { setLoaded(true); setOpen(!open); }}><span><strong>{locale === "en" ? en : zh}</strong></span><DisclosureIcon expanded={open} /></button>
    <div id={id + "-content"} className="settings-disclosure-content" hidden={!open}>{loaded ? children : null}</div>
  </section>;
}
export function DataSettings({ children }: { children: ReactNode }) {
  return <SettingsDisclosure id="data-settings" zh="数据" en="Data" aliases={["data-backup", "data-export", "data-transfer", "data-maintenance", "storage"]}>{children}</SettingsDisclosure>;
}

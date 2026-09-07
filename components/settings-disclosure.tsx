"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useLanguage } from "./language-provider";
import { DisclosureIcon } from "./disclosure-icon";
import { UserGuide } from "./user-guide";
function SettingsDisclosure({ id, zh, en, children }: { id: string; zh: string; en: string; children: ReactNode }) {
  const { locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { if ((window.location.hash === "#" + id || (id === "data-settings" && window.location.hash === "#data-export"))) { setLoaded(true); setOpen(true); } }, [id]);
  return <section className="panel settings-section" id={id}>
    <button type="button" className="ai-settings-toggle" aria-expanded={open} aria-controls={id + "-content"} aria-label={locale === "en" ? (open ? "Collapse " : "Expand ") + en : (open ? "收起" : "展开") + zh} onClick={() => { setLoaded(true); setOpen(!open); }}><span><strong>{locale === "en" ? en : zh}</strong></span><DisclosureIcon expanded={open} /></button>
    <div id={id + "-content"} className="settings-disclosure-content" hidden={!open}>{loaded ? children : null}</div>
  </section>;
}
export function UserGuideSettings() { return <SettingsDisclosure id="user-guide-settings" zh="使用说明" en="User guide"><UserGuide embedded /></SettingsDisclosure>; }
export function DataSettings({ children }: { children: ReactNode }) { return <SettingsDisclosure id="data-settings" zh="数据" en="Data">{children}</SettingsDisclosure>; }

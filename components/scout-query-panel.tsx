"use client";
import { useState } from "react";
import { useLanguage } from "./language-provider";
import { emptyScoutQuery, scoutSearchText, scoutLinks, type ScoutQuery } from "@/lib/scout-domain";
const platformLogos: Record<string, string> = { cardhobby: "/platform-logos/cardhobby.jpg", ebay: "/platform-logos/ebay.png", "130pt": "/platform-logos/130point.webp" };
export function ScoutQueryPanel({ initialQuery = emptyScoutQuery }: { initialQuery?: ScoutQuery }) {
  const { locale } = useLanguage(), l = (zh: string, en: string) => locale === "en" ? en : zh;
  const [draft, setDraft] = useState(() => scoutSearchText(initialQuery)), [copyError, setCopyError] = useState("");
  const keyword = draft;
  const query = { ...emptyScoutQuery, keyword };
  async function copy() {
    try { await navigator.clipboard.writeText(keyword.trim()); setCopyError(""); }
    catch { setCopyError(l("复制失败，请选中关键词手工复制。", "Copy failed. Select and copy the keywords.")); }
  }
  return <section className="panel scout-query">
    <h2>{l("跨站查询", "Cross-site search")}</h2>
    <div className="scout-keyword-form"><label><span className="sr-only">{l("关键词", "Keywords")}</span><input type="search" maxLength={500} value={keyword} onChange={event => { setDraft(event.target.value); setCopyError(""); }} /></label><button type="button" className="btn btn-secondary" disabled={!keyword.trim()} onClick={() => void copy()}>{l("复制关键词", "Copy keywords")}</button></div>
    <div className="scout-links">{scoutLinks(query).map(link => {
      const label = link.source === "cardhobby" ? l("卡淘", "Cardhobby") : link.label;
      return <a key={link.source} className={"scout-platform scout-platform-" + link.source} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={label + " · " + l("打开查询", "Open search")}>
        <span className="scout-platform-mark" aria-hidden="true"><img src={platformLogos[link.source]} alt="" width={44} height={36} /></span>
        <strong>{label}</strong>
        <svg className="scout-platform-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-9 9M10 5H5v14h14v-5" /></svg>
      </a>;
    })}</div>
    {copyError ? <p role="alert">{copyError}</p> : null}
  </section>;
}

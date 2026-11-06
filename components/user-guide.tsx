"use client";
import Link from "next/link";
import { useLanguage } from "@/components/language-provider";

import { galleryKeyboardShortcuts, userGuideSections as sections } from "@/lib/user-guide-content";

export function UserGuide({ embedded = false }: { embedded?: boolean }) {
  const { locale } = useLanguage();
  const l = (zh: string, en: string) => locale === "en" ? en : zh;
  return <div className={embedded ? "user-guide-page" : "page user-guide-page"}>
    {!embedded ? <header className="title-row"><h1 className="h1">{l("使用说明", "User guide")}</h1><Link className="btn btn-secondary" href="/settings">{l("返回设置", "Back to Settings")}</Link></header> : null}
    <nav className="panel user-guide-index" aria-label={l("说明目录", "Guide contents")}>{sections.map(section => <a key={section.id} href={"#" + section.id}>{l(section.zh, section.en)}</a>)}</nav>
    {sections.map(section => <section className="panel user-guide-section" id={section.id} key={section.id}>
      <h2>{l(section.zh, section.en)}</h2>
      {section.items.map(([zh, en]) => <p key={en}>{l(zh, en)}</p>)}
      {section.id === "showcase" ? <div className="user-guide-shortcuts" aria-labelledby="gallery-shortcuts-title">
        <h3 id="gallery-shortcuts-title">{l("浏览键盘操作", "Gallery keyboard shortcuts")}</h3>
        <dl>{galleryKeyboardShortcuts.map(shortcut => <div key={shortcut.keys}><dt><kbd>{shortcut.keys === "Space" ? l("空格", "Space") : shortcut.keys}</kbd></dt><dd>{l(shortcut.zh, shortcut.en)}</dd></div>)}</dl>
      </div> : null}
      {section.id === "finance" ? <Link href="/settings/finance-rules">{l("详细财务计算规则", "Detailed financial calculation rules")}</Link> : null}
    </section>)}
  </div>;
}

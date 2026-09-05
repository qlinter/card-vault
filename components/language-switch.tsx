"use client";

import { useLanguage } from "@/components/language-provider";
import { useEffect, useId, useRef, useState } from "react";

const languages = [
  { locale: "zh-CN", label: "简体中文" },
  { locale: "en", label: "English" }
] as const;

export function LanguageSwitch() {
  const { locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<Array<HTMLButtonElement | null>>([]);
  const label = locale === "en" ? "Choose language" : "选择语言";

  function closeMenu() {
    setOpen(false);
    trigger.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    options.current[languages.findIndex((language) => language.locale === locale)]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, locale]);

  return (
    <div className="language-menu" ref={container} data-i18n-skip onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
    <button
      ref={trigger}
      type="button"
      className="language-switch"
      aria-label={label}
      title={label}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? menuId : undefined}
      onClick={() => setOpen((value) => !value)}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setOpen(true);
        }
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
      </svg>
    </button>
    {open ? (
      <div className="language-menu-options" id={menuId} role="menu" tabIndex={-1} aria-label={label} onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeMenu();
        } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          const current = options.current.findIndex((option) => option === document.activeElement);
          const next = event.key === "Home" ? 0 : event.key === "End" ? languages.length - 1
            : (current + (event.key === "ArrowDown" ? 1 : -1) + languages.length) % languages.length;
          options.current[next]?.focus();
        }
      }}>
        {languages.map((language, index) => (
          <button key={language.locale} ref={(element) => { options.current[index] = element; }}
            type="button" role="menuitemradio" aria-checked={locale === language.locale}
            lang={language.locale} tabIndex={-1}
            onClick={() => { setLocale(language.locale); closeMenu(); }}>
            <span>{language.label}</span>
            {locale === language.locale ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4 10-10" /></svg> : null}
          </button>
        ))}
      </div>
    ) : null}
    </div>
  );
}

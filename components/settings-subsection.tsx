import type { ReactNode } from "react";

export function SettingsSubsection({ id, title, meta, className, children }: {
  id?: string; title: string; meta?: ReactNode; className?: string; children: ReactNode;
}) {
  return <section id={id} className={["settings-subsection", className].filter(Boolean).join(" ")} aria-label={title}>
    <header className="settings-subsection-heading"><h3>{title}</h3>{meta}</header>
    {children}
  </section>;
}

"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useLanguage } from "./language-provider";
export type ViewMode = "grid" | "list" | "table";
export function useViewMode(scope: string, initial: ViewMode): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState(initial);
  const key = "card-vault:view:" + scope;
  useEffect(() => { try { const saved = window.localStorage.getItem(key); if (saved === "list" || saved === initial || (scope === "data" && saved === "table")) setMode(saved); } catch { /* View switching also works without browser storage. */ } }, [key, scope, initial]);
  const change = useCallback((next: ViewMode) => { setMode(next); try { window.localStorage.setItem(key, next); } catch { /* Retain the choice for this page session. */ } }, [key]);
  return [mode, change];
}
export function ViewModeToggle({ value, onChange, modes }: { value: ViewMode; onChange: (mode: ViewMode) => void; modes: ViewMode[] }) {
  const { locale } = useLanguage();
  const labels = locale === "en" ? { grid: "Cards", list: "List", table: "Table" } : { grid: "卡片", list: "列表", table: "表格" };
  return (
    <div className="view-mode-toggle" role="group" aria-label={locale === "en" ? "View mode" : "视图切换"}>
      {modes.map(mode => {
        const label = locale === "en" ? labels[mode] + " view" : labels[mode] + "视图";
        return (
          <button type="button" key={mode} aria-pressed={value === mode} aria-label={label} title={label} onClick={() => onChange(mode)}>
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              {mode === "grid" ? <path d="M3 3h5v5H3zM12 3h5v5h-5zM3 12h5v5H3zM12 12h5v5h-5z" />
                : mode === "list" ? <path d="M3 4h2v2H3zM8 5h9M3 9h2v2H3zM8 10h9M3 14h2v2H3zM8 15h9" />
                  : <path d="M3 3h14v14H3zM3 8h14M3 12.5h14M8 3v14" />}
            </svg>
          </button>
        );
      })}
    </div>
  );
}

const CollectionViewContext = createContext<ReturnType<typeof useViewMode> | null>(null);
export function CollectionViewProvider({ scope, children }: { scope: string; children: ReactNode }) {
  const view = useViewMode(scope, "grid");
  return <CollectionViewContext.Provider value={view}>{children}</CollectionViewContext.Provider>;
}
export function useCollectionView() {
  const view = useContext(CollectionViewContext);
  if (!view) throw new Error("Collection view provider is missing.");
  return view;
}
export function CollectionViewToggle() {
  const [view, setView] = useCollectionView();
  return <ViewModeToggle value={view} onChange={setView} modes={["grid", "list"]} />;
}

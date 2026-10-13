"use client";

import { useLanguage } from "./language-provider";

export function WorkspacePagination({ page, pageSize, count, busy, onChange }: { page: number; pageSize: number; count: number; busy: boolean; onChange: (page: number) => void }) {
  const { locale } = useLanguage();
  if (count <= pageSize) return null;
  return <div className="scout-card-pagination">
    <button type="button" className="btn btn-secondary" disabled={busy || page <= 1} onClick={() => onChange(page - 1)}>{locale === "en" ? "Previous" : "上一页"}</button>
    <span>{page} / {Math.ceil(count / pageSize)}</span>
    <button type="button" className="btn btn-secondary" disabled={busy || page * pageSize >= count} onClick={() => onChange(page + 1)}>{locale === "en" ? "Next" : "下一页"}</button>
  </div>;
}

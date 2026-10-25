"use client";
import type { ScoutData } from "@/lib/scout-service";
import { formatMinorMoneyGrouped } from "@/lib/financial-history";
import { useLanguage } from "./language-provider";
import { useWishDrafts } from "./use-wish-drafts";
import { WorkspacePagination } from "./workspace-pagination";
import type { WorkspaceMutation } from "./use-workspace-data";

export function ScoutWishlist({ identity, data, busy, saving, mutate, search, setSearch, setPage }: {
  identity: string; data: ScoutData | null; busy: boolean; saving: boolean; mutate: WorkspaceMutation;
  search: string; setSearch: (value: string) => void; setPage: (page: number) => void;
}) {
  const { locale } = useLanguage(), l = (zh: string, en: string) => locale === "en" ? en : zh;
  const { plan, setPlan, formOpen, setFormOpen, openEditor, completeDraft, available, ready } = useWishDrafts(identity);
  async function remove(row: NonNullable<ScoutData>["plans"][number]) {
    if (window.confirm(l("确定删除心愿“" + row.title + "”吗？", "Delete wish “" + row.title + "”?"))) {
      if (await mutate({ action: "wish-delete", id: row.id }) && plan.id === row.id) completeDraft();
    }
  }
  return <section className="panel scout-wishlist">
    <div className="title-row wish-header"><h2>{l("心愿单", "Wishlist")}</h2><button type="button" className="btn btn-secondary" disabled={busy || !ready} onClick={() => openEditor()}>{l("新增心愿", "New wish")}</button></div>
    <label className="wish-search"><span className="sr-only">{l("搜索心愿", "Search wishes")}</span><input type="search" maxLength={500} placeholder={l("搜索名称、主体或备注", "Search title, subject or notes")} value={search} onChange={event => setSearch(event.target.value)} /></label>
    {formOpen ? <div className="wish-editor">
      <div className="title-row"><h3>{plan.id ? l("编辑心愿", "Edit wish") : l("新增心愿", "New wish")}</h3><button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setFormOpen(false)}>{l("关闭录入", "Close editor")}</button></div>
      <form onSubmit={async event => { event.preventDefault(); if (await mutate({ action: "wish", ...plan })) completeDraft(); }}>
        <fieldset disabled={busy}><div className="wish-form-grid">
          <label><span>{l("心愿名称 *", "Wish title *")}</span><input required maxLength={500} value={plan.title} onChange={event => setPlan({ ...plan, title: event.target.value })} /></label>
          <label><span>{l("卡片主体（可选）", "Subject (optional)")}</span><input maxLength={500} value={plan.playerName} onChange={event => setPlan({ ...plan, playerName: event.target.value })} /></label>
          <label><span>{l("预算（可选）", "Budget (optional)")}</span><input inputMode="decimal" value={plan.budget} onChange={event => setPlan({ ...plan, budget: event.target.value })} /></label>
          <label><span>{l("币种", "Currency")}</span><select value={plan.currency} onChange={event => setPlan({ ...plan, currency: event.target.value })}><option>CNY</option><option>USD</option></select></label>
          <label className="wish-notes-field"><span>{l("备注（可选）", "Notes (optional)")}</span><textarea rows={3} maxLength={10000} value={plan.notes} onChange={event => setPlan({ ...plan, notes: event.target.value })} /></label>
        </div><button className="btn btn-primary">{saving ? l("正在保存…", "Saving…") : plan.id ? l("保存心愿", "Save wish") : l("添加心愿", "Add wish")}</button></fieldset>
        {!available ? <p className="muted">{l("本机草稿保存不可用，请保存心愿后再离开。", "Local draft storage is unavailable; save the wish before leaving.")}</p> : null}
      </form>
    </div> : null}
    <div className="wish-list" aria-busy={busy}>
      {data?.plans.map(row => <article className="scout-wish" key={row.id} data-wish-id={row.id}>
        <div className="wish-identity"><h3>{row.title}</h3>{row.playerName ? <p className="muted">{row.playerName}</p> : null}</div>
        <div className="wish-budget">{row.budgetMinor === null ? "–" : formatMinorMoneyGrouped(BigInt(row.budgetMinor), row.currency)}</div>
        <div className="wish-actions"><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => openEditor(row)}>{l("编辑", "Edit")}</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void remove(row)}>{l("删除", "Delete")}</button></div>
        {row.notes ? <p className="wish-notes">{row.notes}</p> : null}
      </article>)}
      {!data ? <p role="status" className="muted">{l("正在读取心愿…", "Loading wishes…")}</p> : !data.plans.length && search ? <p className="muted">{l("没有匹配的心愿。", "No matching wishes.")}</p> : null}
    </div>
    {data ? <WorkspacePagination page={data.page} pageSize={data.pageSize} count={data.count} busy={busy} onChange={setPage} /> : null}
  </section>;
}

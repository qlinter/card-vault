"use client";
import { useLanguage } from "./language-provider";
import { emptyScoutQuery, type ScoutQuery } from "@/lib/scout-domain";
import { ScoutQueryPanel } from "./scout-query-panel";
import { ScoutWishlist } from "./scout-wishlist";
import { useScoutData } from "./use-scout-data";
import { useScoutState } from "./use-scout-state";
import { useDebouncedValue } from "./use-debounced-value";
import { WorkspaceFeedback } from "./workspace-feedback";

export function ScoutWorkspace({ identity, initialQuery = emptyScoutQuery }: { identity: string; initialQuery?: ScoutQuery }) {
  const { locale } = useLanguage();
  const context = useScoutState(identity, "workspace", { search: "", page: 1 }, true);
  const search = context.value.search;
  const debounced = useDebouncedValue(search);
  const pending = search !== debounced;
  const source = "/api/scout?" + new URLSearchParams({ q: debounced, page: String(context.value.page) });
  const { data, issue, busy, submitting, notice, mutate, refresh } = useScoutData(source, pending);
  return <div className="page management-page scout-page">
    <h1 className="sr-only">{locale === "en" ? "Scout" : "寻卡"}</h1>
    <WorkspaceFeedback issue={issue} submitting={submitting} notice={notice} refresh={refresh} />
    <ScoutWishlist identity={identity} data={data} busy={busy || !context.ready} saving={submitting} mutate={mutate}
      search={search} setSearch={value => context.setValue({ search: value, page: 1 })}
      setPage={page => context.field("page")(page)} />
    <ScoutQueryPanel initialQuery={initialQuery} />
  </div>;
}

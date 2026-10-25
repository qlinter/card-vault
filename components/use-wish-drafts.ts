"use client";
import { useScoutState } from "./use-scout-state";
import { scoutMoneyInput } from "@/lib/scout-domain";
import type { ScoutData } from "@/lib/scout-service";

const blankWish = { id: "", title: "", playerName: "", budget: "", currency: "CNY", notes: "" };
type WishDraft = typeof blankWish;
export function useWishDrafts(identity: string) {
  const persisted = useScoutState(identity, "drafts", { drafts: {} as Record<string, WishDraft>, key: "new", formOpen: false }, false, value => {
    if (!value || typeof value !== "object") return false;
    const state = value as { drafts?: Record<string, WishDraft>; key?: unknown; formOpen?: unknown };
    return typeof state.key === "string" && typeof state.formOpen === "boolean" && !!state.drafts &&
      Object.values(state.drafts).every(draft => draft && Object.keys(blankWish).every(key => typeof draft[key as keyof WishDraft] === "string"));
  });
  const { drafts, key, formOpen } = persisted.value;
  const setDrafts = persisted.field("drafts"), setKey = persisted.field("key"), setFormOpen = persisted.field("formOpen");
  function openEditor(row?: ScoutData["plans"][number]) {
    const nextKey = row?.id ?? "new";
    setDrafts(current => current[nextKey] ? current : { ...current, [nextKey]: row ? {
      id: row.id, title: row.title, playerName: row.playerName ?? "", budget: scoutMoneyInput(row.budgetMinor), currency: row.currency, notes: row.notes ?? ""
    } : { ...blankWish } });
    setKey(nextKey); setFormOpen(true);
  }
  function completeDraft() {
    setDrafts(current => { const next = { ...current }; delete next[key]; return next; });
    setFormOpen(false); setKey("new");
  }
  return { plan: drafts[key] ?? blankWish, setPlan: (plan: WishDraft) => setDrafts(current => ({ ...current, [key]: plan })),
    formOpen, setFormOpen, openEditor, completeDraft, available: persisted.available, ready: persisted.ready };
}

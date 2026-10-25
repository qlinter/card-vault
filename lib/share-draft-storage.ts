export function shareDraftStorageKey(draftId: string) {
  return `card-vault:share-editor:1:${draftId}`;
}

/** Acknowledgements only clear the exact draft that reached a successful save. */
export function acknowledgeShareDraft(storage: Pick<Storage, "getItem" | "removeItem">, draftId: string, token: string) {
  const key = shareDraftStorageKey(draftId);
  try {
    const pending = JSON.parse(storage.getItem(`${key}:submitted`) || "null") as { token?: string; draft?: string } | null;
    if (!pending || pending.token !== token) return;
    if (storage.getItem(key) === pending.draft) storage.removeItem(key);
    storage.removeItem(`${key}:submitted`);
  } catch { /* Keep the draft if storage or the acknowledgement is unavailable. */ }
}

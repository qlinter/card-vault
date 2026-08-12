import { useEffect, useState } from "react";
import { parseShareEditorDraft, shareEditorDraftVersion, snapshotsEqual, type ShareEditorDraft, type ShareEditorSnapshot } from "@/lib/share-editor-state";
import type { SharePickerCard } from "@/components/share-card-picker";

export function useShareDraftPersistence({ draftId, cards, error, initialSnapshot, currentSnapshot, applySnapshot, resetHistory }: { draftId: string; cards: SharePickerCard[]; error?: string; initialSnapshot: ShareEditorSnapshot; currentSnapshot: ShareEditorSnapshot; applySnapshot: (snapshot: ShareEditorSnapshot) => void; resetHistory: (snapshot: ShareEditorSnapshot) => void }) {
  const draftStorageKey = `card-vault:share-editor:${shareEditorDraftVersion}:${draftId}`;
  const submittedStorageKey = `${draftStorageKey}:submitted`;
  const [recoverableDraft, setRecoverableDraft] = useState<ShareEditorDraft | null>(null);
  const [draftPersistenceEnabled, setDraftPersistenceEnabled] = useState(false);
  const [draftStatus, setDraftStatus] = useState("正在检查本机草稿...");

  useEffect(() => {
    const wasSubmitted = localStorage.getItem(submittedStorageKey) === "true";
    if (wasSubmitted && !error) {
      localStorage.removeItem(draftStorageKey); localStorage.removeItem(submittedStorageKey);
      setDraftPersistenceEnabled(true); setDraftStatus("本机草稿已启用"); return;
    }
    if (wasSubmitted) localStorage.removeItem(submittedStorageKey);
    const stored = localStorage.getItem(draftStorageKey);
    const parsed = stored ? parseShareEditorDraft(stored, cards.map((card) => card.id)) : null;
    if (parsed && !snapshotsEqual(parsed.snapshot, initialSnapshot)) {
      setRecoverableDraft(parsed); setDraftStatus(`发现 ${new Date(parsed.savedAt).toLocaleString()} 的本机草稿`); return;
    }
    if (stored) localStorage.removeItem(draftStorageKey);
    setDraftPersistenceEnabled(true); setDraftStatus("本机草稿已启用");
  }, [cards, draftStorageKey, error, initialSnapshot, submittedStorageKey]);

  useEffect(() => {
    if (!draftPersistenceEnabled || recoverableDraft) return;
    const timeout = window.setTimeout(() => {
      localStorage.setItem(draftStorageKey, JSON.stringify({ version: shareEditorDraftVersion, savedAt: new Date().toISOString(), snapshot: currentSnapshot } satisfies ShareEditorDraft));
      setDraftStatus("草稿已自动保存到本机");
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [currentSnapshot, draftPersistenceEnabled, draftStorageKey, recoverableDraft]);

  function restoreDraft() {
    if (!recoverableDraft) return;
    applySnapshot(recoverableDraft.snapshot); resetHistory(initialSnapshot); setRecoverableDraft(null); setDraftPersistenceEnabled(true); setDraftStatus("已恢复本机草稿");
  }

  function discardDraft() {
    localStorage.removeItem(draftStorageKey); setRecoverableDraft(null); setDraftPersistenceEnabled(true); setDraftStatus("已放弃旧草稿；新的修改会自动保存");
  }

  function markSubmitted() { localStorage.setItem(submittedStorageKey, "true"); }
  return { recoverableDraft, draftStatus, restoreDraft, discardDraft, markSubmitted };
}

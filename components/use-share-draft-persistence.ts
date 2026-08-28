import { useEffect, useState } from "react";
import { parseShareEditorDraft, shareEditorDraftVersion, snapshotsEqual, type ShareEditorDraft, type ShareEditorSnapshot } from "@/lib/share-editor-state";
import type { SharePickerCard } from "@/components/share-card-picker";

function readLocalDraft(key: string): { available: boolean; value: string | null } {
  try {
    return { available: true, value: window.localStorage.getItem(key) };
  } catch {
    return { available: false, value: null };
  }
}

function writeLocalDraft(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeLocalDraft(key: string): boolean {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function useShareDraftPersistence({ draftId, cards, error, initialSnapshot, currentSnapshot, applySnapshot, resetHistory }: { draftId: string; cards: SharePickerCard[]; error?: string; initialSnapshot: ShareEditorSnapshot; currentSnapshot: ShareEditorSnapshot; applySnapshot: (snapshot: ShareEditorSnapshot) => void; resetHistory: (snapshot: ShareEditorSnapshot) => void }) {
  const draftStorageKey = `card-vault:share-editor:${shareEditorDraftVersion}:${draftId}`;
  const submittedStorageKey = `${draftStorageKey}:submitted`;
  const [recoverableDraft, setRecoverableDraft] = useState<ShareEditorDraft | null>(null);
  const [draftPersistenceEnabled, setDraftPersistenceEnabled] = useState(false);
  const [draftStatus, setDraftStatus] = useState("正在检查本机草稿...");

  useEffect(() => {
    const submittedRecord = readLocalDraft(submittedStorageKey);
    if (!submittedRecord.available) {
      setDraftPersistenceEnabled(false);
      setDraftStatus("本机草稿不可用；修改仍可保存到分享集");
      return;
    }
    const wasSubmitted = submittedRecord.value === "true";
    if (wasSubmitted && !error) {
      removeLocalDraft(draftStorageKey); removeLocalDraft(submittedStorageKey);
      setDraftPersistenceEnabled(true); setDraftStatus("本机草稿已启用"); return;
    }
    if (wasSubmitted) removeLocalDraft(submittedStorageKey);
    const storedRecord = readLocalDraft(draftStorageKey);
    if (!storedRecord.available) {
      setDraftPersistenceEnabled(false);
      setDraftStatus("本机草稿不可用；修改仍可保存到分享集");
      return;
    }
    const stored = storedRecord.value;
    const parsed = stored ? parseShareEditorDraft(stored, cards.map((card) => card.id)) : null;
    if (parsed && !snapshotsEqual(parsed.snapshot, initialSnapshot)) {
      setRecoverableDraft(parsed); setDraftStatus(`发现 ${new Date(parsed.savedAt).toLocaleString()} 的本机草稿`); return;
    }
    if (stored) removeLocalDraft(draftStorageKey);
    setDraftPersistenceEnabled(true); setDraftStatus("本机草稿已启用");
  }, [cards, draftStorageKey, error, initialSnapshot, submittedStorageKey]);

  useEffect(() => {
    if (!draftPersistenceEnabled || recoverableDraft) return;
    const timeout = window.setTimeout(() => {
      const saved = writeLocalDraft(draftStorageKey, JSON.stringify({ version: shareEditorDraftVersion, savedAt: new Date().toISOString(), snapshot: currentSnapshot } satisfies ShareEditorDraft));
      setDraftStatus(saved ? "草稿已自动保存到本机" : "无法将草稿自动保存到本机");
      if (!saved) setDraftPersistenceEnabled(false);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [currentSnapshot, draftPersistenceEnabled, draftStorageKey, recoverableDraft]);

  function restoreDraft() {
    if (!recoverableDraft) return;
    applySnapshot(recoverableDraft.snapshot); resetHistory(initialSnapshot); setRecoverableDraft(null); setDraftPersistenceEnabled(true); setDraftStatus("已恢复本机草稿");
  }

  function discardDraft() {
    const removed = removeLocalDraft(draftStorageKey);
    setRecoverableDraft(null);
    setDraftPersistenceEnabled(removed);
    setDraftStatus(removed ? "已放弃旧草稿；新的修改会自动保存" : "本机草稿不可用；修改仍可保存到分享集");
  }

  function markSubmitted() { writeLocalDraft(submittedStorageKey, "true"); }
  return { recoverableDraft, draftStatus, restoreDraft, discardDraft, markSubmitted };
}

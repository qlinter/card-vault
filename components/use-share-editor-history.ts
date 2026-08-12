import { useRef, useState } from "react";
import { snapshotsEqual, type ShareEditorSnapshot } from "@/lib/share-editor-state";

function cloneSnapshot(snapshot: ShareEditorSnapshot): ShareEditorSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as ShareEditorSnapshot;
}

export function useShareEditorHistory(currentSnapshot: ShareEditorSnapshot, applySnapshot: (snapshot: ShareEditorSnapshot) => void) {
  const historyRef = useRef<{ past: ShareEditorSnapshot[]; future: ShareEditorSnapshot[] }>({ past: [], future: [] });
  const [, setHistoryVersion] = useState(0);
  const bump = () => setHistoryVersion((value) => value + 1);

  function recordHistory() {
    const history = historyRef.current;
    if (!history.past.length || !snapshotsEqual(history.past.at(-1)!, currentSnapshot)) history.past = [...history.past.slice(-79), cloneSnapshot(currentSnapshot)];
    history.future = [];
    bump();
  }

  function undo() {
    const history = historyRef.current;
    const previous = history.past.at(-1);
    if (!previous) return;
    history.past = history.past.slice(0, -1);
    history.future = [cloneSnapshot(currentSnapshot), ...history.future].slice(0, 80);
    applySnapshot(previous);
    bump();
  }

  function redo() {
    const history = historyRef.current;
    const next = history.future[0];
    if (!next) return;
    history.future = history.future.slice(1);
    history.past = [...history.past.slice(-79), cloneSnapshot(currentSnapshot)];
    applySnapshot(next);
    bump();
  }

  function resetHistory(initialSnapshot: ShareEditorSnapshot) {
    historyRef.current = { past: [cloneSnapshot(initialSnapshot)], future: [] };
    bump();
  }

  return { recordHistory, undo, redo, resetHistory, canUndo: historyRef.current.past.length > 0, canRedo: historyRef.current.future.length > 0 };
}

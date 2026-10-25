"use client";

import { useEffect } from "react";
import { acknowledgeShareDraft } from "@/lib/share-draft-storage";

export function ShareSaveConfirmation({ draftId, token }: { draftId: string; token: string }) {
  useEffect(() => {
    try { acknowledgeShareDraft(window.localStorage, draftId, token); } catch { /* Optional local storage. */ }
  }, [draftId, token]);
  return null;
}

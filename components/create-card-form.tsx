"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent
} from "react";
import { createCardFormAction, type CreateCardFormState } from "@/app/actions/cards";
import { CardForm } from "@/components/card-form";
import {
  cardEntryDraftTitle,
  hasCardEntryDraftContent,
  readCardFormValues
} from "@/lib/card-entry-domain";
import type { CardEntryDraftSummary } from "@/lib/card-entry-drafts";
import type { CardEntryQueueItemSummary } from "@/lib/card-entry-queue-domain";
import type { CardFormValues } from "@/lib/card-form-values";

type CreateCardFormProps = {
  initialValues: CardFormValues;
  initialDraftId?: string;
  initialMessage?: string;
  recentDrafts: CardEntryDraftSummary[];
  queueItem?: CardEntryQueueItemSummary;
  queueNavigation?: { previousId?: string; nextId?: string };
};

type DraftSaveResponse = {
  id?: string;
  updatedAt?: string;
  error?: string;
};

function formatDraftTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("zh-CN", { hour12: false });
}

export function CreateCardForm({
  initialValues,
  initialDraftId,
  initialMessage,
  recentDrafts,
  queueItem,
  queueNavigation = {}
}: CreateCardFormProps) {
  const initialState: CreateCardFormState = {
    error: undefined,
    values: initialValues
  };
  const [state, formAction, isPending] = useActionState(
    createCardFormAction,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);
  const draftIdRef = useRef(initialDraftId);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const preparingSubmitRef = useRef(false);
  const submittingRef = useRef(false);
  const navigatingRef = useRef(false);
  const mountedRef = useRef(true);
  const [draftId, setDraftId] = useState(initialDraftId);
  const [draftStatus, setDraftStatus] = useState(
    initialDraftId
      ? "已恢复草稿，修改后会自动保存。"
      : queueItem
        ? "队列图片已就绪；填写内容会自动保存为草稿。"
        : ""
  );
  const [drafts, setDrafts] = useState(recentDrafts);

  const persistDraft = useCallback(async (
    values: CardFormValues,
    announce = true
  ): Promise<string | undefined> => {
    if (!hasCardEntryDraftContent(values) && !draftIdRef.current) return;
    if (announce && mountedRef.current) setDraftStatus("正在保存草稿...");

    const response = await fetch("/api/card-entry/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: draftIdRef.current, values })
    });
    const result = (await response.json()) as DraftSaveResponse;
    if (!response.ok || !result.id || !result.updatedAt) {
      throw new Error(result.error || "草稿保存失败。");
    }

    draftIdRef.current = result.id;
    if (!mountedRef.current) return result.id;
    setDraftId(result.id);
    setDraftStatus(
      queueItem
        ? "草稿已保存；队列图片会继续保留。"
        : "草稿已保存；图片仍需在正式提交时重新选择。"
    );
    setDrafts((current) => {
      const next: CardEntryDraftSummary = {
        id: result.id!,
        title: cardEntryDraftTitle(values),
        updatedAt: result.updatedAt!
      };
      return [next, ...current.filter((draft) => draft.id !== next.id)].slice(
        0,
        8
      );
    });

    const url = new URL(window.location.href);
    url.searchParams.set("draft", result.id);
    url.searchParams.delete("copyFrom");
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
    return result.id;
  }, [queueItem]);

  const navigateAfterSaving = useCallback(async (href: string) => {
    if (navigatingRef.current) return;
    const form = formRef.current;
    if (!form) return;
    navigatingRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setDraftStatus("正在保存当前草稿...");
    const values = readCardFormValues(new FormData(form));
    saveChainRef.current = saveChainRef.current
      .catch(() => undefined)
      .then(async () => { await persistDraft(values, false); });
    try {
      await saveChainRef.current;
      let destination = href;
      if (/^\/cards\/[^/?#]+$/.test(href)) {
        const returnTo = `${window.location.pathname}${window.location.search}`;
        const params = new URLSearchParams({ returnTo });
        destination = `${href}?${params.toString()}`;
      }
      window.location.assign(destination);
    } catch (error) {
      setDraftStatus(error instanceof Error ? error.message : "切换前保存草稿失败。");
      navigatingRef.current = false;
    }
  }, [persistDraft]);

  const navigateToQueueItem = useCallback(async (id: string) => {
    await navigateAfterSaving(`/cards/new?queue=${encodeURIComponent(id)}`);
  }, [navigateAfterSaving]);

  useEffect(() => {
    function handleEntryNavigation(event: Event) {
      const href = (event as CustomEvent<unknown>).detail;
      if (typeof href === "string" && href.startsWith("/")) {
        void navigateAfterSaving(href);
      }
    }
    window.addEventListener("card-entry:navigate", handleEntryNavigation);
    return () => window.removeEventListener("card-entry:navigate", handleEntryNavigation);
  }, [navigateAfterSaving]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    mountedRef.current = true;

    function scheduleSave() {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const values = readCardFormValues(new FormData(form ?? undefined));
        saveChainRef.current = saveChainRef.current
          .catch(() => undefined)
          .then(async () => {
            try {
              await persistDraft(values);
            } catch (error) {
              if (mountedRef.current) {
                setDraftStatus(
                  error instanceof Error ? error.message : "草稿保存失败。"
                );
              }
            }
          });
      }, 700);
    }

    form.addEventListener("input", scheduleSave);
    form.addEventListener("change", scheduleSave);
    return () => {
      mountedRef.current = false;
      form.removeEventListener("input", scheduleSave);
      form.removeEventListener("change", scheduleSave);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [persistDraft]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const activeForm = form;
    function handleKeyboard(event: KeyboardEvent) {
      if (event.ctrlKey && event.altKey && event.key === "ArrowLeft" && queueNavigation.previousId) {
        event.preventDefault();
        void navigateToQueueItem(queueNavigation.previousId);
        return;
      }
      if (event.ctrlKey && event.altKey && event.key === "ArrowRight" && queueNavigation.nextId) {
        event.preventDefault();
        void navigateToQueueItem(queueNavigation.nextId);
        return;
      }
      if (!event.ctrlKey || event.altKey || event.key !== "Enter" || isPending) return;
      event.preventDefault();
      const intent = event.shiftKey ? "view" : "continue";
      const button = activeForm.querySelector<HTMLButtonElement>(
        `button[name="saveIntent"][value="${intent}"]`
      );
      if (button) activeForm.requestSubmit(button);
    }
    form.addEventListener("keydown", handleKeyboard);
    return () => form.removeEventListener("keydown", handleKeyboard);
  }, [isPending, navigateToQueueItem, queueNavigation.nextId, queueNavigation.previousId]);

  async function deleteDraft(id: string) {
    const response = await fetch(
      `/api/card-entry/drafts/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setDraftStatus(result.error || "草稿删除失败。");
      return;
    }

    if (draftIdRef.current === id) {
      window.location.assign("/cards/new");
      return;
    }
    setDrafts((current) => current.filter((draft) => draft.id !== id));
  }

  async function prepareSubmit(event: FormEvent<HTMLFormElement>) {
    if (submittingRef.current) {
      submittingRef.current = false;
      return;
    }

    event.preventDefault();
    if (preparingSubmitRef.current) return;
    preparingSubmitRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const values = readCardFormValues(new FormData(form));
    setDraftStatus("正在同步最新草稿...");
    saveChainRef.current = saveChainRef.current
      .catch(() => undefined)
      .then(async () => {
        await persistDraft(values, false);
      });

    try {
      await saveChainRef.current;
      if (draftIdRef.current) {
        let input = form.elements.namedItem("draftId") as HTMLInputElement | null;
        if (!input) {
          input = document.createElement("input");
          input.type = "hidden";
          input.name = "draftId";
          form.appendChild(input);
        }
        input.value = draftIdRef.current;
      }
    } catch (error) {
      setDraftStatus(
        error instanceof Error ? error.message : "提交前草稿同步失败。"
      );
    } finally {
      preparingSubmitRef.current = false;
    }

    if (!form.isConnected) return;
    submittingRef.current = true;
    if (submitter instanceof HTMLElement) {
      form.requestSubmit(submitter as HTMLButtonElement);
    } else {
      form.requestSubmit();
    }
  }

  return (
    <div className="entry-workbench-layout">
      <aside className="entry-draft-panel panel" aria-label="录入草稿">
        <div className="entry-draft-heading">
          <div>
            <strong>录入草稿</strong>
            <p className="muted">最多显示最近 8 项</p>
          </div>
          <a href="/cards/new" className="btn btn-secondary">
            新建空白
          </a>
        </div>

        {drafts.length > 0 ? (
          <div className="entry-draft-list">
            {drafts.map((draft) => (
              <div
                className={`entry-draft-item${
                  draft.id === draftId ? " is-active" : ""
                }`}
                key={draft.id}
              >
                <a href={`/cards/new?draft=${encodeURIComponent(draft.id)}`}>
                  <strong>{draft.title}</strong>
                  <span>{formatDraftTime(draft.updatedAt)}</span>
                </a>
                <button
                  type="button"
                  onClick={() => deleteDraft(draft.id)}
                  aria-label={`删除草稿 ${draft.title}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">暂无草稿。开始填写后会自动创建。</p>
        )}
      </aside>

      <div className="entry-form-column">
        {initialMessage ? (
          <p className="note-ok">{initialMessage}</p>
        ) : null}
        {draftStatus || queueNavigation.previousId || queueNavigation.nextId || isPending ? (
          <div className="entry-draft-status" aria-live="polite">
            {draftStatus ? <span>{draftStatus}</span> : null}
            <div className="entry-queue-navigation">
              {queueNavigation.previousId ? (
                <button type="button" onClick={() => navigateToQueueItem(queueNavigation.previousId!)} title="Ctrl + Alt + ←">← 上一项</button>
              ) : null}
              {queueNavigation.nextId ? (
                <button type="button" onClick={() => navigateToQueueItem(queueNavigation.nextId!)} title="Ctrl + Alt + →">下一项 →</button>
              ) : null}
              {isPending ? <strong>正在创建卡片...</strong> : null}
            </div>
          </div>
        ) : null}
        <CardForm
          mode="create"
          action={formAction}
          error={state.error}
          values={state.values}
          formRef={formRef}
          draftId={draftId}
          onSubmit={prepareSubmit}
          onInvalid={(event) => {
            const target = event.target;
            const firstInvalid = event.currentTarget.querySelector<HTMLElement>(":invalid");
            if (target instanceof HTMLElement && target === firstInvalid) {
              target.scrollIntoView({ behavior: "smooth", block: "center" });
              target.focus({ preventScroll: true });
            }
          }}
          submitDisabled={isPending}
          queueItemId={queueItem?.id}
          queueRecognition={queueItem?.recognition}
          queuedImages={queueItem?.images.flatMap((image) =>
            image.url
              ? [{
                  id: image.id,
                  url: image.url,
                  side: image.side,
                  originalName: image.originalName
                }]
              : []
          )}
        />
      </div>
    </div>
  );
}

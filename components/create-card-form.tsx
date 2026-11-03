"use client";

import { UiElement, UiText } from "@/components/ui-text";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode
} from "react";
import { createCardFormAction, type CreateCardFormState } from "@/app/actions/cards";
import { CardForm } from "@/components/card-form";
import { CardEntryTemplatePanel } from "@/components/card-entry-template-panel";
import {
  cardEntryDraftTitle,
  hasCardEntryDraftContent,
  readCardFormValues
} from "@/lib/card-entry-domain";
import type { CardEntryDraftSummary } from "@/lib/card-entry-drafts";
import type { CardEntryQueueItemSummary } from "@/lib/card-entry-queue-domain";
import type { CardFormValues } from "@/lib/card-form-values";
import type { DraftImage } from "@/lib/card-entry-draft-images.js";
import { cardImageSelectionError } from "@/lib/card-image-limits.js";

type CreateCardFormProps = {
  submissionId: string;
  initialValues: CardFormValues;
  initialDraftId?: string;
  initialImages?: DraftImage[];
  initialMessage?: string;
  recentDrafts: CardEntryDraftSummary[];
  queueItem?: CardEntryQueueItemSummary;
  queueNavigation?: { previousId?: string; nextId?: string };
  queuePanel?: ReactNode;
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
  submissionId,
  initialValues,
  initialDraftId,
  initialImages = [],
  initialMessage,
  recentDrafts,
  queueItem,
  queueNavigation = {},
  queuePanel
}: CreateCardFormProps) {
  const initialState: CreateCardFormState = {
    error: undefined,
    values: initialValues,
    submissionId
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
  const savedImages = useRef<string | undefined>(initialImages.length ? undefined : "[]");
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
    const imageInput = formRef.current?.elements.namedItem("images") as HTMLInputElement | null;
    const images = Array.from(imageInput?.files ?? []);
    if (!hasCardEntryDraftContent(values) && !draftIdRef.current && !images.length) return;
    const imageError = cardImageSelectionError(images);
    if (imageError) throw new Error(imageError);
    const signature = JSON.stringify(images.map(file => [file.name, file.size, file.lastModified]));
    const restored = imageInput?.dataset.draftRestored === "restored";
    if (savedImages.current === undefined && restored) savedImages.current = signature;
    const manageImages = !initialImages.length || Boolean(imageInput?.dataset.draftRestored) || images.length > 0;
    const changedImages = manageImages && savedImages.current !== signature;
    const rotations = manageImages ? JSON.parse(String((formRef.current?.elements.namedItem("newImageRotations") as HTMLInputElement | null)?.value || "[]")) : undefined;
    if (announce && mountedRef.current) setDraftStatus("正在保存草稿...");

    const body = new FormData();
    if (draftIdRef.current) body.set("id", draftIdRef.current);
    body.set("values", JSON.stringify(values));
    body.set("imageRotations", JSON.stringify(rotations || []));
    if (changedImages) images.forEach(file => body.append("images", file));
    const response = await fetch("/api/card-entry/drafts", changedImages ? { method: "POST", body } : {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: draftIdRef.current, values, imageRotations: rotations })
    });
    const result = (await response.json()) as DraftSaveResponse;
    if (!response.ok || !result.id || !result.updatedAt) {
      throw new Error(result.error || "草稿保存失败。");
    }

    draftIdRef.current = result.id;
    if (changedImages) savedImages.current = signature;
    if (!mountedRef.current) return result.id;
    setDraftId(result.id);
    setDraftStatus(
      queueItem
        ? "草稿已保存；队列图片会继续保留。"
        : images.length ? "草稿和图片已保存，可在重新打开后继续录入。" : "草稿已保存。"
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
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
    return result.id;
  }, [queueItem, initialImages.length]);

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
      // A later retry must keep the same draft identity, including when this
      // page is opened elsewhere. Do not commit while draft preparation failed.
      return;
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
    <div className="entry-workbench-layout" data-card-entry-workspace>
      {drafts.some(draft => draft.id !== draftId) ? <details className="entry-draft-panel panel">
        <summary><UiText text="未完成草稿" /> · {drafts.length}</summary>
        <div className="entry-draft-heading">
          <div>
            <strong><UiText text={"录入草稿"} /></strong>
          </div>
          <a href="/cards/new" className="btn btn-secondary"><UiText text={"新建空白"} /></a>
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
                <UiElement as="button" uiMessages={{"aria-label": {text:"删除草稿 {0}",values:[draft.title],translateValues:[]}}}
                  type="button"
                  onClick={() => deleteDraft(draft.id)}

                >
                  ×
                </UiElement>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted"><UiText text={"暂无草稿。开始填写后会自动创建。"} /></p>
        )}
      </details> : null}

      <div className="entry-form-column">
        {initialMessage ? (
          <p className="note-ok"><UiText text={initialMessage} /></p>
        ) : null}
        {draftStatus || queueNavigation.previousId || queueNavigation.nextId || isPending ? (
          <div className="entry-draft-status" aria-live="polite">
            {draftStatus ? <span><UiText text={draftStatus} /></span> : null}
            <div className="entry-queue-navigation">
              {queueNavigation.previousId ? (
                <button type="button" onClick={() => navigateToQueueItem(queueNavigation.previousId!)} title="Ctrl + Alt + ←"><UiText text={"← 上一项"} /></button>
              ) : null}
              {queueNavigation.nextId ? (
                <button type="button" onClick={() => navigateToQueueItem(queueNavigation.nextId!)} title="Ctrl + Alt + →"><UiText text={"下一项 →"} /></button>
              ) : null}
              {isPending ? <strong><UiText text={"正在创建卡片..."} /></strong> : null}
            </div>
          </div>
        ) : null}
        <details className="entry-tools" open={Boolean(queueItem) || undefined}><summary><UiText text="录入工具" /></summary><CardEntryTemplatePanel />{queuePanel}</details>
        <CardForm
          mode="create"
          action={formAction}
          error={state.error}
          values={state.values}
          formRef={formRef}
          draftId={draftId}
          draftImages={initialImages}
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

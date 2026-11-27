"use client";

import { UiElement, UiText } from "@/components/ui-text";
import {
  useActionState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode
} from "react";
import { createCardFormAction, type CreateCardFormState } from "@/app/actions/cards";
import { CardForm } from "@/components/card-form";
import { CardEntryTemplatePanel } from "@/components/card-entry-template-panel";
import {
  cardEntryDraftTitle,
  draftConflictMessage,
  hasCardEntryDraftContent,
  readCardFormValues
} from "@/lib/card-entry-domain";
import type { CardEntryDraftSummary } from "@/lib/card-entry-drafts";
import type { CardEntryQueueItemSummary } from "@/lib/card-entry-queue-domain";
import type { CardFormValues } from "@/lib/card-form-values";
import type { DraftImage } from "@/lib/card-entry-draft-images.js";
import { cardImageSelectionError } from "@/lib/card-image-limits.js";
import { clearCardFieldError, focusCardField, isCardFormControl, markCardFieldInvalid } from "@/lib/card-form-display";
import { useLanguage } from "./language-provider";

type CreateCardFormProps = {
  submissionId: string;
  initialValues: CardFormValues;
  initialDraftId?: string;
  initialDraftVersion?: string;
  initialQueueRotations?: Record<string, number>;
  initialImages?: DraftImage[];
  initialFrontChoice?: string;
  initialMessage?: string;
  recentDrafts: CardEntryDraftSummary[];
  queueItem?: CardEntryQueueItemSummary;
  queueNavigation?: { previousId?: string; nextId?: string };
  queuePanel?: ReactNode;
};

type DraftSaveResponse = {
  id?: string;
  updatedAt?: string;
  version?: string;
  error?: string;
};

const requiredEntryMessages: Record<string, string> = {
  images: "至少上传 1 张图片。",
  playerName: "请填写卡牌主体。",
  cardTitle: "请填写卡牌名称。",
  sport: "请填写运动类型。"
};

const subscribeToClientTime = () => () => {};

function DraftTime({ value }: { value: string }) {
  const { locale } = useLanguage();
  const hydrated = useSyncExternalStore(subscribeToClientTime, () => true, () => false);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const timestamp = date.toISOString();
  // SSR and the first client render share the serialized instant. Local time
  // is only available after hydration, independently of the server's timezone.
  return <time dateTime={timestamp}>{hydrated ? date.toLocaleString(locale, { hour12: false }) : timestamp}</time>;
}

export function CreateCardForm({
  submissionId,
  initialValues,
  initialDraftId,
  initialDraftVersion,
  initialQueueRotations,
  initialImages = [],
  initialFrontChoice,
  initialMessage,
  recentDrafts,
  queueItem,
  queueNavigation = {},
  queuePanel
}: CreateCardFormProps) {
  const deletingDraftRef = useRef(false);
  const [deletingDraft, setDeletingDraft] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CardEntryDraftSummary | null>(null);
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
  const versionRef = useRef(initialDraftVersion);
  const conflictRef = useRef(false);
  const [conflict, setConflict] = useState(false);
  const copyingRef = useRef(false);
  const [copying, setCopying] = useState(false);
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
  const [formIssue, setFormIssue] = useState<{ message: string; field?: string } | null>(null);
  useEffect(() => {
    if (state.error === draftConflictMessage) {
      conflictRef.current = true;
      setConflict(true);
      setDraftStatus(draftConflictMessage);
    }
  }, [state]);
  const formError = isPending ? undefined : formIssue?.message ?? (state.error === draftConflictMessage ? undefined : state.error);

  useLayoutEffect(() => {
    if (!formError) return;
    const feedback = formRef.current?.querySelector<HTMLElement>(".card-form-error");
    if (feedback) focusCardField(feedback);
  }, [formError, formIssue, state]);

  const persistDraft = useCallback(async (
    values: CardFormValues,
    announce = true,
    asCopy = false
  ): Promise<string | undefined> => {
    if (conflictRef.current && !asCopy) throw new Error(draftConflictMessage);
    const imageInput = formRef.current?.elements.namedItem("images") as HTMLInputElement | null;
    const images = Array.from(imageInput?.files ?? []);
    if (!hasCardEntryDraftContent(values) && !draftIdRef.current && !images.length && !queueItem) return;
    const imageError = cardImageSelectionError(images);
    if (imageError) throw new Error(imageError);
    const signature = JSON.stringify(images.map(file => [file.name, file.size, file.lastModified]));
    const restored = imageInput?.dataset.draftRestored === "restored";
    if (savedImages.current === undefined && restored) savedImages.current = signature;
    const manageImages = !initialImages.length || Boolean(imageInput?.dataset.draftRestored) || images.length > 0;
    if (asCopy && initialImages.length && !manageImages) throw new Error("草稿图片尚未恢复，请稍候或重新选择图片。");
    const changedImages = asCopy ? images.length > 0 : manageImages && savedImages.current !== signature;
    const frontChoice = manageImages ? (formRef.current?.elements.namedItem("frontChoice") as HTMLInputElement | null)?.value : undefined;
    const rotations = manageImages ? JSON.parse(String((formRef.current?.elements.namedItem("newImageRotations") as HTMLInputElement | null)?.value || "[]")) : undefined;
    if (announce && mountedRef.current) setDraftStatus("正在保存草稿...");

    const body = new FormData();
    const id = asCopy ? undefined : draftIdRef.current;
    if (id) {
      body.set("id", id);
      body.set("expectedVersion", versionRef.current ?? "");
    }
    body.set("values", JSON.stringify(values));
    if (frontChoice !== undefined) body.set("frontChoice", frontChoice);
    body.set("imageRotations", JSON.stringify(rotations || []));
    const queueRotations = queueItem ? JSON.parse(String((formRef.current?.elements.namedItem("queuedImageRotations") as HTMLInputElement)?.value || "{}")) : undefined;
    if (queueItem && !asCopy) {
      body.set("queueItemId", queueItem.id);
      body.set("queuedImageRotations", JSON.stringify(queueRotations));
    }
    if (asCopy && queueItem) {
      // Detach the copy from its single-use queue item and keep the displayed image order.
      const keys = [...queueItem.images.map(image => "queued:" + image.id), ...images.map((_, index) => "new:" + index)];
      const frontIndex = keys.indexOf(frontChoice ?? "");
      body.set("frontChoice", "new:" + Math.max(0, frontIndex));
      body.set("imageRotations", JSON.stringify([...queueItem.images.map(image => queueRotations[image.id] ?? 0), ...(rotations ?? [])]));
      for (const image of queueItem.images) {
        if (!image.url) throw new Error("队列图片读取失败，请重试。");
        const response = await fetch(image.url);
        if (!response.ok) throw new Error("队列图片读取失败，请重试。");
        body.append("images", await response.blob(), image.originalName);
      }
    }
    if (changedImages) images.forEach(file => body.append("images", file));
    const response = await fetch("/api/card-entry/drafts", changedImages || (asCopy && queueItem) ? { method: "POST", body } : {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, expectedVersion: asCopy ? undefined : versionRef.current, queueItemId: asCopy ? undefined : queueItem?.id, queuedImageRotations: asCopy ? undefined : queueRotations, values, frontChoice, imageRotations: rotations })
    });
    const result = (await response.json()) as DraftSaveResponse;
    if (response.status === 409) {
      conflictRef.current = true;
      if (mountedRef.current) setConflict(true);
    }
    if (!response.ok || !result.id || !result.updatedAt || !result.version) {
      throw new Error(result.error || "草稿保存失败。");
    }

    versionRef.current = result.version;
    draftIdRef.current = result.id;
    conflictRef.current = false;
    if (mountedRef.current) setConflict(false);
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
        id: result.id!, version: result.version!,
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
    if (asCopy && queueItem) {
      url.searchParams.delete("queue");
      window.location.replace(url);
      return result.id;
    }
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
    return result.id;
  }, [queueItem, initialImages.length]);

  async function saveCopy() {
    if (copyingRef.current || !formRef.current) return;
    copyingRef.current = true;
    formRef.current.inert = true;
    setCopying(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveChainRef.current = saveChainRef.current.catch(() => undefined).then(async () => {
      if (formRef.current) await persistDraft(readCardFormValues(new FormData(formRef.current)), true, true);
    });
    try {
      await saveChainRef.current;
      setFormIssue(null);
    } catch (error) {
      setDraftStatus(error instanceof Error ? error.message : "草稿保存失败。");
    } finally {
      copyingRef.current = false;
      if (formRef.current) formRef.current.inert = false;
      setCopying(false);
    }
  }

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

    function scheduleSave(event: Event) {
      if (event.target instanceof HTMLElement && event.target.matches(":valid")) {
        clearCardFieldError(event.target);
      }
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

  async function deleteDraft(draft: CardEntryDraftSummary) {
    const {id, version} = draft;
    if (deletingDraftRef.current) return;
    deletingDraftRef.current = true;
    setDeletingDraft(true);
    try {
      const response = await fetch(
        `/api/card-entry/drafts/${encodeURIComponent(id)}`,
        { method: "DELETE", headers: {"x-draft-version": version} }
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string; latest?: CardEntryDraftSummary };
        if (response.status === 409 && result.latest?.id === id) {
          const latest = result.latest;
          setDrafts(items => items.map(item => item.id === id ? latest : item));
          setConfirmDelete(latest);
        } else setDraftStatus(result.error || "草稿删除失败。");
        return;
      }

      setConfirmDelete(null);
      if (draftIdRef.current === id) {
        window.location.assign("/cards/new");
        return;
      }
      setDrafts((current) => current.filter((draft) => draft.id !== id));
    } catch {
      setDraftStatus("草稿删除失败，请重试。");
    } finally {
      deletingDraftRef.current = false;
      if (mountedRef.current) setDeletingDraft(false);
    }
  }

  async function prepareSubmit(event: FormEvent<HTMLFormElement>) {
    if (submittingRef.current) {
      submittingRef.current = false;
      return;
    }

    event.preventDefault();
    if (preparingSubmitRef.current) return;
    const form = event.currentTarget;
    const values = readCardFormValues(new FormData(form));
    for (const name of ["playerName", "cardTitle", "sport"] as const) {
      if (!values[name].trim()) {
        setFormIssue({ message: requiredEntryMessages[name], field: name });
        return;
      }
    }
    setFormIssue(null);
    preparingSubmitRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    const submitter = (event.nativeEvent as SubmitEvent).submitter;
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
        (form.elements.namedItem("draftVersion") as HTMLInputElement).value = versionRef.current ?? "";
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "提交前草稿同步失败。";
      setDraftStatus(message);
      setFormIssue({ message });
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
                  <span><DraftTime value={draft.updatedAt} /></span>
                </a>
                {confirmDelete?.id === draft.id ? <div className="draft-delete-review">
                  <span role="status"><UiText text="草稿已更新，请核对后再删除。" /></span>
                  <div>
                    <button type="button" className="btn btn-secondary" disabled={deletingDraft} onClick={() => setConfirmDelete(null)}><UiText text="取消" /></button>
                    <button type="button" className="btn btn-danger" disabled={deletingDraft} onClick={() => deleteDraft(confirmDelete)}><UiText text="确认删除" /></button>
                  </div>
                </div> : <UiElement as="button" uiMessages={{"aria-label": {text:"删除草稿 {0}",values:[draft.title],translateValues:[]}}}
                  type="button"
                  disabled={deletingDraft}
                  onClick={() => deleteDraft(draft)}

                >
                  ×
                </UiElement>}
              </div>
            ))}
          </div>
      </details> : null}

      <div className="entry-form-column">
        {initialMessage ? (
          <p className="note-ok"><UiText text={initialMessage} /></p>
        ) : null}
        {draftStatus || queueNavigation.previousId || queueNavigation.nextId || isPending ? (
          <div className="entry-draft-status" aria-live="polite">
            {draftStatus ? <span><UiText text={draftStatus} /></span> : null}
            <div className="entry-queue-navigation">
              {conflict && <>
                <button type="button" disabled={copying} onClick={() => window.location.reload()}><UiText text="载入最新草稿" /></button>
                <button type="button" disabled={copying} onClick={saveCopy}><UiText text="另存为新草稿" /></button>
              </>}
              {queueNavigation.previousId ? (
                <button type="button" onClick={() => navigateToQueueItem(queueNavigation.previousId!)} title="Ctrl + Alt + ←"><UiText text={"← 上一项"} /></button>
              ) : null}
              {queueNavigation.nextId ? (
                <button type="button" onClick={() => navigateToQueueItem(queueNavigation.nextId!)} title="Ctrl + Alt + →"><UiText text={"下一项 →"} /></button>
              ) : null}
              {isPending ? <strong><UiText text={"正在创建卡牌..."} /></strong> : null}
            </div>
          </div>
        ) : null}
        <details className="entry-tools" open={Boolean(queueItem) || undefined}><summary><UiText text="录入工具" /></summary><CardEntryTemplatePanel />{queuePanel}</details>
        <CardForm
          mode="create"
          action={formAction}
          error={formError}
          errorField={formIssue?.field}
          values={state.values}
          formRef={formRef}
          draftId={draftId} draftVersion={initialDraftVersion}
          draftImages={initialImages} initialFrontChoice={initialFrontChoice}
          onSubmit={prepareSubmit}
          onInvalid={(event) => {
            event.preventDefault();
            const target = event.target;
            const firstInvalid = event.currentTarget.querySelector<HTMLElement>(":invalid");
            if (isCardFormControl(target) && target === firstInvalid) {
              const message = target.validity.customError ? target.validationMessage
                : target.validity.valueMissing ? requiredEntryMessages[target.name] ?? "请检查必填项。" : "请检查输入格式后再保存。";
              markCardFieldInvalid(target);
              setFormIssue({ message, field: target.name });
            }
          }}
          submitDisabled={isPending || conflict || copying}
          queueItemId={queueItem?.id}
          queueRecognition={queueItem?.recognition}
          queuedImages={queueItem?.images.flatMap((image) =>
            image.url
              ? [{
                  id: image.id,
                  rotation: initialQueueRotations?.[image.id],
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

import Link from "next/link";
import { hasStudioKey } from "@/lib/ai-settings";
import { UiText } from "@/components/ui-text";
import { CreateCardForm } from "@/components/create-card-form";
import { CardEntryQueuePanel } from "@/components/card-entry-queue-panel";
import {
  getCardEntryQueueItemSummary,
  getReadyCardEntryQueueNavigation,
  listCardEntryQueueItems
} from "@/lib/card-entry-queue-service";
import {
  normalizeCardEntryId,
  normalizeCardFormValues
} from "@/lib/card-entry-domain";
import {
  getCardEntryDraft,
  getQueueDraft,
  listRecentCardEntryDrafts
} from "@/lib/card-entry-drafts";
import { emptyCardFormValues } from "@/lib/card-form-values";
import { toScalar } from "@/lib/query-params";
import { randomUUID } from "node:crypto";

type NewCardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewCardPage({ searchParams }: NewCardPageProps) {
  const query = await searchParams;
  const requestedDraftId = toScalar(query.draft)?.trim();
  const requestedQueueId = toScalar(query.queue)?.trim();
  const draftId = normalizeCardEntryId(requestedDraftId);
  const requestedQueue = normalizeCardEntryId(requestedQueueId);
  const success = toScalar(query.success);

  const [recentDrafts, draft, queueItems] = await Promise.all([
    listRecentCardEntryDrafts(),
    draftId ? getCardEntryDraft(draftId) : requestedQueue ? getQueueDraft(requestedQueue) : null,
    listCardEntryQueueItems()
  ]);
  const queueId = draft?.queueItemId ?? requestedQueue;
  const [requestedQueueItem, queueNavigation] = await Promise.all([
    queueId ? getCardEntryQueueItemSummary(queueId) : Promise.resolve(null),
    queueId ? getReadyCardEntryQueueNavigation(queueId) : Promise.resolve({})
  ]);
  const queueItem = requestedQueueItem?.status === "ready"
    ? requestedQueueItem
    : undefined;

  if (draft?.missingQueue || (draft && queueId && (!queueItem || !queueItem.images.length || queueItem.images.some(image => !image.url)))) {
    return <div className="page entry-page"><p className="note-error" role="alert"><UiText text="草稿关联的队列图片不可用，草稿已保留。" /></p>
      <Link href="/cards/new" className="btn btn-secondary"><UiText text="返回录入页" /></Link></div>;
  }

  const initialValues = draft
    ? draft.values
    : queueItem?.recognition?.status === "review"
      ? normalizeCardFormValues(queueItem.recognition.suggestion)
      : normalizeCardFormValues(emptyCardFormValues);
  const initialMessage = success === "created"
    ? "上一张卡牌已保存，可以继续录入。"
    : requestedDraftId && !draft
      ? "该草稿不存在或已经完成，已打开空白录入页。"
      : requestedQueueId && !queueItem
        ? "该队列项目不存在、尚未准备完成或已经完成。"
        : undefined;

  return (
    <div className="page entry-page">
      <h1 className="h1 sr-only"><UiText text="新增卡牌" /></h1>
      {success === "created" && !hasStudioKey() ? <p className="muted"><UiText text="未配置 OpenAI Key，展馆暂用首图。可在设置中补生成。" /></p> : null}
      <CreateCardForm
        submissionId={randomUUID()}
        queuePanel={<CardEntryQueuePanel items={queueItems} activeItemId={queueItem?.id} />}
        initialValues={initialValues}
        initialDraftId={draft?.id} initialDraftVersion={draft?.version}
        initialQueueRotations={draft?.queuedImageRotations}
        initialImages={draft?.images ?? []} initialFrontChoice={draft?.frontChoice}
        initialMessage={initialMessage}
        recentDrafts={recentDrafts}
        queueItem={queueItem}
        queueNavigation={queueNavigation}
      />
    </div>
  );
}

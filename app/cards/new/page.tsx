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
  listRecentCardEntryDrafts
} from "@/lib/card-entry-drafts";
import { emptyCardFormValues } from "@/lib/card-form-values";
import { toScalar } from "@/lib/query-params";

type NewCardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewCardPage({ searchParams }: NewCardPageProps) {
  const query = await searchParams;
  const requestedDraftId = toScalar(query.draft)?.trim();
  const requestedQueueId = toScalar(query.queue)?.trim();
  const draftId = normalizeCardEntryId(requestedDraftId);
  const queueId = normalizeCardEntryId(requestedQueueId);
  const success = toScalar(query.success);

  const [recentDrafts, draft, queueItems, requestedQueueItem, queueNavigation] = await Promise.all([
    listRecentCardEntryDrafts(),
    draftId ? getCardEntryDraft(draftId) : Promise.resolve(null),
    listCardEntryQueueItems(),
    queueId ? getCardEntryQueueItemSummary(queueId) : Promise.resolve(null),
    queueId ? getReadyCardEntryQueueNavigation(queueId) : Promise.resolve({})
  ]);
  const queueItem = requestedQueueItem?.status === "ready"
    ? requestedQueueItem
    : undefined;

  const initialValues = draft
    ? draft.values
    : queueItem?.recognition?.status === "review"
      ? normalizeCardFormValues(queueItem.recognition.suggestion)
      : normalizeCardFormValues(emptyCardFormValues);
  const initialMessage = success === "created"
    ? "上一张卡片已保存，可以继续录入。"
    : requestedDraftId && !draft
      ? "该草稿不存在或已经完成，已打开空白录入页。"
      : requestedQueueId && !queueItem
        ? "该队列项目不存在、尚未准备完成或已经完成。"
        : undefined;

  return (
    <div className="page entry-page">
      <div className="title-row">
        <div>
          <h1 className="h1"><UiText text={"录入工作台"} /></h1>
        </div>
      </div>
      <CardEntryQueuePanel items={queueItems} activeItemId={queueItem?.id} />
      <CreateCardForm
        initialValues={initialValues}
        initialDraftId={draft?.id}
        initialMessage={initialMessage}
        recentDrafts={recentDrafts}
        queueItem={queueItem}
        queueNavigation={queueNavigation}
      />
    </div>
  );
}

import { CreateCardForm } from "@/components/create-card-form";
import { CardEntryQueuePanel } from "@/components/card-entry-queue-panel";
import {
  getCardEntryQueueItemSummary,
  getReadyCardEntryQueueNavigation,
  listCardEntryQueueItems
} from "@/lib/card-entry-queue-service";
import {
  copyCommonCardValues,
  normalizeCardEntryId,
  normalizeCardFormValues
} from "@/lib/card-entry-domain";
import {
  getCardEntryDraft,
  listRecentCardEntryDrafts
} from "@/lib/card-entry-drafts";
import { emptyCardFormValues } from "@/lib/card-form-values";
import { prisma } from "@/lib/prisma";
import { toScalar } from "@/lib/query-params";

type NewCardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewCardPage({ searchParams }: NewCardPageProps) {
  const query = await searchParams;
  const requestedDraftId = toScalar(query.draft)?.trim();
  const requestedCopyFrom = toScalar(query.copyFrom)?.trim();
  const requestedQueueId = toScalar(query.queue)?.trim();
  const draftId = normalizeCardEntryId(requestedDraftId);
  const copyFrom = normalizeCardEntryId(requestedCopyFrom);
  const queueId = normalizeCardEntryId(requestedQueueId);
  const success = toScalar(query.success);

  const [recentDrafts, draft, copySource, queueItems, requestedQueueItem, queueNavigation] = await Promise.all([
    listRecentCardEntryDrafts(),
    draftId ? getCardEntryDraft(draftId) : Promise.resolve(null),
    !draftId && copyFrom
      ? prisma.card.findUnique({
          where: { id: copyFrom },
          select: {
            sport: true,
            team: true,
            year: true,
            brand: true,
            productLine: true,
            subsetName: true,
            visibility: true,
            collectionStatus: true
          }
        })
      : Promise.resolve(null),
    listCardEntryQueueItems(),
    queueId ? getCardEntryQueueItemSummary(queueId) : Promise.resolve(null),
    queueId ? getReadyCardEntryQueueNavigation(queueId) : Promise.resolve({})
  ]);
  const queueItem = requestedQueueItem?.status === "ready"
    ? requestedQueueItem
    : undefined;

  const initialValues = draft
    ? draft.values
    : copySource
      ? copyCommonCardValues(copySource)
      : queueItem?.recognition?.status === "review"
        ? normalizeCardFormValues(queueItem.recognition.suggestion)
        : normalizeCardFormValues(emptyCardFormValues);
  const initialMessage = success === "created"
    ? copySource
      ? "上一张卡片已保存，已复制通用字段，可直接录入下一张。"
      : "上一张卡片已保存，可以继续录入。"
    : requestedDraftId && !draft
      ? "该草稿不存在或已经完成，已打开空白录入页。"
      : requestedCopyFrom && !copySource
        ? "复制来源不存在，已打开空白录入页。"
        : requestedQueueId && !queueItem
          ? "该队列项目不存在、尚未准备完成或已经完成。"
          : undefined;

  return (
    <div className="page">
      <div className="title-row">
        <div>
          <h1 className="h1">录入工作台</h1>
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

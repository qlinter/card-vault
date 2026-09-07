import { UiText } from "@/components/ui-text";

import { EditCardForm } from "@/components/edit-card-form";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { normalizeReturnTo, toScalar } from "@/lib/query-params";

type EditProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditCardPage({ params, searchParams }: EditProps) {
  const { id } = await params;
  const query = await searchParams;
  const card = await prisma.card.findUnique({
    where: { id },
    include: { images: { orderBy: { createdAt: "asc" } } }
  });

  if (!card) {
    notFound();
  }

  const error = toScalar(query.error);
  const returnTo = normalizeReturnTo(toScalar(query.returnTo));

  return (
    <div className="page entry-page">
      <div className="title-row">
        <div>
          <h1 className="h1"><UiText text={"编辑球星卡"} /></h1>
          <p className="muted"><UiText text={"支持更新字段，并可替换、新增或删除图片，总数需保留 1-5 张。"} /></p>
        </div>
      </div>
      <EditCardForm card={card} error={error} returnTo={returnTo} />
    </div>
  );
}

import { EditCardForm } from "@/components/edit-card-form";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { normalizeReturnTo, toScalar } from "@/lib/query-params";
import { CardFinancialHistory } from "@/components/card-financial-history";
import { cardEditVersions } from "@/lib/card-write-guards";
import { updateCardFormAction } from "@/app/actions/cards";

type EditProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditCardPage({ params, searchParams }: EditProps) {
  const { id } = await params;
  const query = await searchParams;
  const card = await prisma.card.findUnique({
    where: { id },
    include: { images: { orderBy: { createdAt: "asc" } }, transactions: { where: { kind: "sale" }, select: { id: true, kind: true, quantity: true, amountMinor: true, currency: true, occurredAt: true } } }
  });

  if (!card) {
    notFound();
  }

  const error = toScalar(query.error);
  const returnTo = normalizeReturnTo(toScalar(query.returnTo));
  const { transactions, ...archive } = card;

  return (
    <div className="page entry-page">
      <EditCardForm card={archive} action={updateCardFormAction.bind(null, card.id)} {...cardEditVersions(archive)} error={error} returnTo={returnTo} />
      <CardFinancialHistory editorOnly cardId={card.id} returnTo={returnTo} transactions={transactions} />
    </div>
  );
}

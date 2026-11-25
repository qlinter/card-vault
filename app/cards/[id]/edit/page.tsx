import { cardImageOrder } from "@/lib/card-image-order";
import { EditCardForm } from "@/components/edit-card-form";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { normalizeReturnTo, toScalar } from "@/lib/query-params";
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
    include: { images: { orderBy: cardImageOrder } }
  });

  if (!card) {
    notFound();
  }

  const error = toScalar(query.error);
  const returnTo = normalizeReturnTo(toScalar(query.returnTo));

  return (
    <div className="page entry-page">
      <EditCardForm card={card} action={updateCardFormAction.bind(null, card.id)} {...cardEditVersions(card)} error={error} returnTo={returnTo} />
    </div>
  );
}

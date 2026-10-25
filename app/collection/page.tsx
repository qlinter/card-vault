import { ScoutWorkspace } from "@/components/scout-workspace";
import { prisma } from "@/lib/prisma";
import { toScalar } from "@/lib/query-params";
import { scoutIdentity } from "@/lib/scout-identity";
import { ensureScoutReady } from "@/lib/scout-ready";

export const dynamic = "force-dynamic";

export default async function CollectionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  ensureScoutReady();
  const query = await searchParams;
  const cardId = toScalar(query.cardId);
  const card = cardId ? await prisma.card.findUnique({ where: { id: cardId } }) : null;
  const keyword = card ? [card.playerName, card.year, card.brand, card.productLine, card.parallel, card.cardNumber, card.gradingCompany, card.grade].filter(Boolean).join(" ") : "";
  return <ScoutWorkspace identity={scoutIdentity()} initialQuery={{ keyword }} />;
}

import { ScoutWorkspace } from "@/components/scout-workspace";
import { prisma } from "@/lib/prisma";
import { toScalar } from "@/lib/query-params";
import { scoutIdentity } from "@/lib/scout-identity";
export default async function CollectionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const cardId = toScalar(query.cardId);
  const card = cardId ? await prisma.card.findUnique({ where: { id: cardId } }) : null;
  const watchId = toScalar(query.watch)?.slice(0, 128);
  const tab = toScalar(query.tab);
  const wishId = toScalar(query.wish)?.slice(0, 160);
  return <ScoutWorkspace identity={scoutIdentity()} initialWatchId={watchId} initialWishId={wishId} initialTab={tab === "wishlist" || wishId ? "wishlist" : "query"} initialQuery={card ? { keyword: [card.playerName, card.year, card.brand, card.productLine, card.parallel, card.cardNumber, card.gradingCompany, card.grade].filter(Boolean).join(" ") } : undefined} />;
}

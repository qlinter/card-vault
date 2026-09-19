import { cardCollectionStatuses } from "./card-domain.ts";

const ownedCollectionStatuses: ReadonlySet<string> = new Set(cardCollectionStatuses.filter(status => status !== "sold"));

export function isOwnedCollectionStatus(status: string): boolean {
  return ownedCollectionStatuses.has(status);
}

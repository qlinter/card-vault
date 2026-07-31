const ownedCollectionStatuses = new Set(["holding", "listed", "grading"]);

type CardValueRecord = {
  collectionStatus: string;
  currentValue: number | null;
};

export function isOwnedCollectionStatus(status: string): boolean {
  return ownedCollectionStatuses.has(status);
}

export function calculateOwnedCardsValue(cards: CardValueRecord[]): number {
  return cards.reduce(
    (sum, card) => sum + (isOwnedCollectionStatus(card.collectionStatus) ? (card.currentValue ?? 0) : 0),
    0
  );
}

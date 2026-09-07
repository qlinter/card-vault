const ownedCollectionStatuses = new Set(["holding", "listed", "grading"]);

export function isOwnedCollectionStatus(status: string): boolean {
  return ownedCollectionStatuses.has(status);
}

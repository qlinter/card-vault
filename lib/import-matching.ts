export type ImportValues = Record<string, string | boolean>;
export type ImportMatch = { kind: "id"; id: string } | { kind: "certificate"; certNumber: string } | {
  kind: "archive"; playerName: string; cardTitle: string; sport: string; year: string | null; parallel: string | null; serialNumber: string | null;
};

export function importMatch(values: ImportValues): ImportMatch {
  if (values.id) return { kind: "id", id: String(values.id) };
  if (values.certNumber) return { kind: "certificate", certNumber: String(values.certNumber) };
  return { kind: "archive", playerName: String(values.playerName ?? ""), cardTitle: String(values.cardTitle ?? ""), sport: String(values.sport ?? ""),
    year: values.year ? String(values.year) : null, parallel: values.parallel ? String(values.parallel) : null, serialNumber: values.serialNumber ? String(values.serialNumber) : null };
}
export function importMatchKey(value: ImportMatch): string { return JSON.stringify(value); }
export function cardMatchesImport(card: { id: string; certNumber: string | null; playerName: string; cardTitle: string; sport: string; year: string | null; parallel: string | null; serialNumber: string | null }, match: ImportMatch): boolean {
  if (match.kind === "id") return card.id === match.id;
  if (match.kind === "certificate") return card.certNumber === match.certNumber;
  return card.playerName === match.playerName && card.cardTitle === match.cardTitle && card.sport === match.sport && card.year === match.year && card.parallel === match.parallel && card.serialNumber === match.serialNumber;
}

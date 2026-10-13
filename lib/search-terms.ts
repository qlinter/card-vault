/** Every word must match; words may occur in different fields. */
export function searchTerms(value: string = ""): string[] {
  return [...new Set(value.trim().toLowerCase().split(/\s+/).filter(Boolean))];
}
export function matchesSearch(value: string, query: string): boolean {
  const text = value.toLowerCase();
  return searchTerms(query).every(term => text.includes(term));
}

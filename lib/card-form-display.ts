export function pickCardField(value: string | undefined, fallback: string): string { return value ?? fallback; }
export function hasOptionalCardData(values: object | undefined, card: object | undefined, fields: readonly string[]): boolean {
  return fields.some(field => {
    const value = (values as Record<string, unknown> | undefined)?.[field] ?? (card as Record<string, unknown> | undefined)?.[field];
    return typeof value === "string" ? Boolean(value.trim()) : value === true;
  });
}

export function revealCardField(field: HTMLElement): void {
  let parent = field.parentElement;
  while (parent && parent.tagName !== "FORM") {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
    parent = parent.parentElement;
  }
}

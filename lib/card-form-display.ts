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

export function isCardFormControl(value: unknown): value is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  return value instanceof HTMLInputElement || value instanceof HTMLSelectElement || value instanceof HTMLTextAreaElement;
}

export function focusCardField(field: HTMLElement): void {
  revealCardField(field);
  field.scrollIntoView({ block: "center" });
  field.focus({ preventScroll: true });
}

export const CARD_ENTRY_ERROR_ID = "card-entry-save-error";

export function markCardFieldInvalid(field: HTMLElement): void {
  field.setAttribute("aria-invalid", "true");
  const descriptions = new Set((field.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
  descriptions.add(CARD_ENTRY_ERROR_ID);
  field.setAttribute("aria-describedby", [...descriptions].join(" "));
}

export function clearCardFieldError(field: HTMLElement): void {
  const descriptions = (field.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
  if (!descriptions.includes(CARD_ENTRY_ERROR_ID)) return;
  field.removeAttribute("aria-invalid");
  const remaining = descriptions.filter(id => id !== CARD_ENTRY_ERROR_ID);
  if (remaining.length) field.setAttribute("aria-describedby", remaining.join(" "));
  else field.removeAttribute("aria-describedby");
}

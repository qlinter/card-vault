type TextFormControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function textFormControl(form: HTMLFormElement, field: string): TextFormControl | undefined {
  const element = form.elements.namedItem(field);
  return element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
    ? element
    : undefined;
}

function dispatchControlChange(element: TextFormControl | HTMLInputElement, includeInput = false): void {
  if (includeInput) element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

export function closestCardForm(element: HTMLElement | null): HTMLFormElement | null {
  return element?.closest("form") ?? null;
}

export function setCardFormText(
  form: HTMLFormElement,
  field: string,
  value: string,
  overwrite = true
): boolean {
  const element = textFormControl(form, field);
  if (!element || (!overwrite && element.value.trim())) return false;
  element.value = value;
  dispatchControlChange(element, true);
  return true;
}

export function setCardFormCheckbox(
  form: HTMLFormElement,
  field: string,
  value: boolean,
  overwrite = true
): boolean {
  const element = form.elements.namedItem(field);
  if (!(element instanceof HTMLInputElement) || element.type !== "checkbox") return false;
  if (!overwrite && (!value || element.checked)) return false;
  element.checked = value;
  dispatchControlChange(element);
  return true;
}

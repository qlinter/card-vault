export function optionalText(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

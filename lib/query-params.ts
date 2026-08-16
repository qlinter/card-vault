export function toScalar(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function normalizeReturnTo(value: string | undefined): string | undefined {
  if (value === "/" || value?.startsWith("/?")) {
    return value;
  }

  return undefined;
}

export function encodeReturnTo(value: string | undefined): string {
  return value ? `?returnTo=${encodeURIComponent(value)}` : "";
}

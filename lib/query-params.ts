export function toScalar(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function buildQueryHref(pathname: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  return params.size ? `${pathname}?${params}` : pathname;
}

export function normalizeReturnTo(value: string | undefined): string | undefined {
  if (
    value === "/" ||
    value?.startsWith("/?") ||
    value === "/settings#data-export" ||
    value?.startsWith("/settings?") ||
    value === "/settings/data#data-export" ||
    value?.startsWith("/settings/data?") ||
    value === "/portfolio" ||
    value?.startsWith("/portfolio?") ||
    value === "/cards/new" ||
    value?.startsWith("/cards/new?")
  ) {
    return value;
  }

  return undefined;
}

export function encodeReturnTo(value: string | undefined): string {
  return value ? `?returnTo=${encodeURIComponent(value)}` : "";
}

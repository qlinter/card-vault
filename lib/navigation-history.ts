export type NavigationVisit = { key: string; url: string };
export type NavigationTrail = { visits: NavigationVisit[]; current: number };
export const NAVIGATION_TRAIL_KEY = "card-vault-navigation-v1";
export const NAVIGATION_STATE_KEY = "cardVaultNavigationKey";

export function isEditingUrl(value: string, origin: string): boolean {
  try { const url = new URL(value, origin); return url.origin === origin && /^\/(?:cards|shares)\/[^/]+\/edit\/?$/.test(url.pathname); } catch { return false; }
}
function pageIdentity(value: string, origin: string) {
  const url = new URL(value, origin);
  url.searchParams.delete("success"); url.searchParams.delete("error");
  // The saved detail page and its pre-edit detail page represent one destination.
  return /^\/cards\/[^/]+\/?$/.test(url.pathname) ? url.pathname : url.pathname + url.search + url.hash;
}
export function previousNavigation(trail: NavigationTrail, currentUrl: string, origin: string): { delta: number; url: string } | null {
  const identity = pageIdentity(currentUrl, origin);
  for (let index = trail.current - 1; index >= 0; index--) {
    const visit = trail.visits[index];
    try {
      const url = new URL(visit.url, origin);
      if (url.origin !== origin || isEditingUrl(url.href, origin) || pageIdentity(url.href, origin) === identity) continue;
      return { delta: index - trail.current, url: url.pathname + url.search + url.hash };
    } catch { /* Ignore unreadable entries. */ }
  }
  return null;
}

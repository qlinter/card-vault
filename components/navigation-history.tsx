"use client";

import { useEffect } from "react";
import { NAVIGATION_STATE_KEY, NAVIGATION_TRAIL_KEY, type NavigationTrail } from "@/lib/navigation-history";

export function NavigationHistory() {
  useEffect(() => {
    const originalPush = window.history.pushState;
    const originalReplace = window.history.replaceState;
    function record(key: string, url: string, replace = false) {
      try {
        const stored = JSON.parse(sessionStorage.getItem(NAVIGATION_TRAIL_KEY) ?? "null") as NavigationTrail | null;
        const trail: NavigationTrail = stored && Array.isArray(stored.visits) ? stored : { visits: [], current: -1 };
        const existing = trail.visits.findIndex(visit => visit.key === key);
        if (existing >= 0) { trail.current = existing; trail.visits[existing].url = url; }
        else if (replace && trail.current >= 0) trail.visits[trail.current] = { key, url };
        else { trail.visits = trail.visits.slice(0, trail.current + 1); trail.visits.push({ key, url }); trail.current = trail.visits.length - 1; }
        sessionStorage.setItem(NAVIGATION_TRAIL_KEY, JSON.stringify(trail));
      } catch { /* BackButton uses the explicit return context when storage is blocked. */ }
    }
    const initialKey = window.history.state?.[NAVIGATION_STATE_KEY] ?? crypto.randomUUID();
    originalReplace.call(window.history, { ...window.history.state, [NAVIGATION_STATE_KEY]: initialKey }, "");
    record(initialKey, window.location.href);
    window.history.pushState = function (data, unused, url) {
      const key = crypto.randomUUID();
      originalPush.call(this, { ...data, [NAVIGATION_STATE_KEY]: key }, unused, url);
      record(key, window.location.href);
    };
    window.history.replaceState = function (data, unused, url) {
      const key = window.history.state?.[NAVIGATION_STATE_KEY] ?? crypto.randomUUID();
      originalReplace.call(this, { ...data, [NAVIGATION_STATE_KEY]: key }, unused, url);
      record(key, window.location.href, true);
    };
    const onPop = () => { const key = window.history.state?.[NAVIGATION_STATE_KEY]; if (key) record(key, window.location.href); };
    window.addEventListener("popstate", onPop);
    return () => { window.history.pushState = originalPush; window.history.replaceState = originalReplace; window.removeEventListener("popstate", onPop); };
  }, []);
  return null;
}

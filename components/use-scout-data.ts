"use client";
import { useCallback, useEffect, useRef } from "react";
import type { ScoutData, ScoutReferences } from "@/lib/scout-service";
import { readWorkspaceJson, useWorkspaceData } from "./use-workspace-data";

type References = { controller: AbortController; promise?: Promise<ScoutReferences> };
/** Reference reuse is local to this mounted workspace; committed writes always invalidate it. */
export function useScoutData(source: string, identity: string, pendingSearch: boolean) {
  const cache = useRef<References | null>(null);
  const scope = useRef(identity);
  const invalidate = useCallback(() => { cache.current?.controller.abort(); cache.current = null; }, []);
  const references = useCallback(() => {
    const entry = cache.current ??= { controller: new AbortController() };
    return entry.promise ??= readWorkspaceJson<ScoutReferences>("/api/scout?references=1", AbortSignal.any([entry.controller.signal, AbortSignal.timeout(30000)]))
      .catch(error => { if (cache.current === entry) cache.current = null; throw error; });
  }, []);
  const reader = useCallback(async (url: string, signal?: AbortSignal, committed = false): Promise<ScoutData> => {
    if (committed || scope.current !== identity) { invalidate(); scope.current = identity; }
    const [page, index] = await Promise.all([readWorkspaceJson<ScoutData>(url, signal), references()]);
    if (page.identity === index.identity) return { ...page, ...index };
    invalidate();
    const replacement = await references();
    if (page.identity !== replacement.identity) throw new Error("寻卡数据已变化，请刷新后重试。");
    return { ...page, ...replacement };
  }, [identity, invalidate, references]);
  const request = useWorkspaceData<ScoutData>(source, "/api/scout", reader);
  const refreshPage = request.refresh;
  const busy = request.busy || pendingSearch;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const refresh = useCallback(() => { invalidate(); return refreshPage(); }, [invalidate, refreshPage]);
  useEffect(() => {
    const focus = () => { if (!busyRef.current) void refresh(); };
    window.addEventListener("focus", focus);
    return () => { window.removeEventListener("focus", focus); invalidate(); };
  }, [identity, invalidate, refresh]);
  return { ...request, busy, refresh, mutate: (body: Record<string, unknown>) => pendingSearch ? Promise.resolve(null) : request.mutate(body) };
}

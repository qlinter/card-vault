"use client";
import { useEffect } from "react";
import type { ScoutData } from "@/lib/scout-service";
import { useWorkspaceData } from "./use-workspace-data";

export function useScoutData(source: string, pendingSearch: boolean) {
  const request = useWorkspaceData<ScoutData>(source, "/api/scout");
  const refresh = request.refresh;
  useEffect(() => {
    const focus = () => { void refresh(); };
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [refresh]);
  return { ...request, busy: request.busy || pendingSearch, mutate: (body: Record<string, unknown>) => pendingSearch ? Promise.resolve(null) : request.mutate(body) };
}

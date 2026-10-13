"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type WorkspaceIssue = { kind: "load" | "save" | "refresh"; message: string };
export type WorkspaceMutationResult = { id?: string; undo?: import("@/lib/scout-domain").WishUndo };
export type WorkspaceMutation = (body: Record<string, unknown>) => Promise<WorkspaceMutationResult | null>;

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "读取失败。");
  return result as T;
}

/** Keep a committed write distinct from a failed read, so retry never repeats a write. */
export function useWorkspaceData<T>(source: string, mutationPath: string) {
  const [data, setData] = useState<T | null>(null);
  const [dataSource, setDataSource] = useState("");
  const [issue, setIssue] = useState<WorkspaceIssue | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const committedRefresh = useRef(false);
  const currentSource = useRef(source);

  const refresh = useCallback(async (signal?: AbortSignal, committed = false) => {
    if (committed) committedRefresh.current = true;
    const request = ++generation.current;
    setLoading(true);
    try {
      const requestedSource = currentSource.current;
      const result = await readJson<T>(requestedSource, { signal });
      if (!mounted.current || signal?.aborted || request !== generation.current) return false;
      setData(result);
      setDataSource(requestedSource);
      setIssue(null);
      committedRefresh.current = false;
      return true;
    } catch (error) {
      if (mounted.current && !signal?.aborted && request === generation.current) {
        setIssue({ kind: committedRefresh.current ? "refresh" : "load", message: error instanceof Error ? error.message : String(error) });
      }
      return false;
    } finally {
      if (mounted.current && request === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    currentSource.current = source;
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => { mounted.current = false; controller.abort(); };
  }, [source, refresh]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(false), 1800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const mutate: WorkspaceMutation = async body => {
    if (lock.current || loading || dataSource !== source || issue?.kind === "refresh") return null;
    lock.current = true;
    setSubmitting(true);
    setIssue(null);
    setNotice(false);
    try {
      const result = await readJson<WorkspaceMutationResult>(mutationPath, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
      if (!mounted.current) return result;
      if (await refresh(undefined, true)) setNotice(true);
      // The write succeeded even when the following list refresh failed.
      return result;
    } catch (error) {
      if (mounted.current) setIssue({ kind: "save", message: error instanceof Error ? error.message : String(error) });
      return null;
    } finally {
      lock.current = false;
      if (mounted.current) setSubmitting(false);
    }
  };

  return { data, dataSource, issue, loading, submitting, notice, mutate, refresh, setIssue, busy: loading || dataSource !== source || submitting || issue?.kind === "refresh" };
}

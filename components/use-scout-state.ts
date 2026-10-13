"use client";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

function sameShape(value: unknown, sample: unknown): boolean {
  if (sample === null) return value === null;
  if (typeof sample !== "object") return typeof value === typeof sample && (typeof value !== "number" || Number.isFinite(value));
  if (!value || typeof value !== "object" || Array.isArray(value) !== Array.isArray(sample)) return false;
  if (Array.isArray(sample)) return Array.isArray(value);
  const expected = sample as Record<string, unknown>, stored = value as Record<string, unknown>;
  return Object.keys(expected).length ? Object.entries(expected).every(([key, entry]) => sameShape(stored[key], entry)) : Object.values(stored).every(entry => typeof entry === "string");
}
export function useScoutState<T>(identity: string, name: string, initial: T, session = false, valid: (value: unknown) => boolean = value => sameShape(value, initial)) {
  const key = `card-vault:scout:2:${identity}:${name}`;
  const [value, setValue] = useState(initial), [loadedKey, setLoadedKey] = useState(""), [available, setAvailable] = useState(true);
  const ready = loadedKey === key;
  const initialRef = useRef(initial), validRef = useRef(valid);
  const setters = useRef(new Map<keyof T, Dispatch<SetStateAction<T[keyof T]>>>());
  useEffect(() => {
    let restored = initialRef.current, readable = true;
    try {
      const raw = (session ? window.sessionStorage : window.localStorage).getItem(key);
      if (raw && raw.length < 2000000) { const parsed: unknown = JSON.parse(raw); if (validRef.current(parsed)) restored = parsed as T; }
    } catch { readable = false; }
    const frame = requestAnimationFrame(() => { setValue(restored); setLoadedKey(key); setAvailable(readable); });
    return () => cancelAnimationFrame(frame);
  }, [key, session]);
  useEffect(() => {
    if (!ready) return;
    try { (session ? window.sessionStorage : window.localStorage).setItem(key, JSON.stringify(value)); }
    catch { queueMicrotask(() => setAvailable(false)); }
  }, [key, session, ready, value]);
  function field<K extends keyof T>(name: K): Dispatch<SetStateAction<T[K]>> {
    if (!setters.current.has(name)) setters.current.set(name, update => setValue(current => ({ ...current, [name]: typeof update === "function" ? (update as (previous: T[keyof T]) => T[keyof T])(current[name]) : update })));
    return setters.current.get(name)! as Dispatch<SetStateAction<T[K]>>;
  }
  return { value, setValue, field, ready, available };
}

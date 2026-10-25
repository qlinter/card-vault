"use client";
import { useEffect, useState } from "react";

export function CardEntrySuggestions() {
  const [options, setOptions] = useState<Record<string, string[]>>({});
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/cards/options", { signal: controller.signal }).then(async response => {
      if (response.ok) setOptions(await response.json());
    }).catch(() => { /* Suggestions are optional; free-form input remains available. */ });
    return () => controller.abort();
  }, []);
  return <>{["year", "brand", "productLine"].map(field => <datalist key={field} id={`card-entry-${field}-options`}>{(options[field] || []).map(value => <option key={value} value={value} />)}</datalist>)}</>;
}

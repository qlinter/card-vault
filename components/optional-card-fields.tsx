"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { UiText } from "./ui-text";

export function OptionalCardFields({ title, initialOpen, children }: { title: string; initialOpen: boolean; children: ReactNode }) {
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (initialOpen && details.current) details.current.open = true; }, [initialOpen]);
  useEffect(() => {
    const section = details.current, form = section?.closest("form");
    function reveal(event: Event) {
      const target = event.target;
      if (!section || !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) || !section.contains(target)) return;
      if (target instanceof HTMLInputElement && target.type === "checkbox" ? target.checked : target.value.trim()) section.open = true;
    }
    form?.addEventListener("input", reveal); form?.addEventListener("change", reveal);
    return () => { form?.removeEventListener("input", reveal); form?.removeEventListener("change", reveal); };
  }, []);
  return <details ref={details} className="card-optional-fields full" open={initialOpen || undefined}>
    <summary><UiText text={title} /></summary><div className="form-grid">{children}</div>
  </details>;
}

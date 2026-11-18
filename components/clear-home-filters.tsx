"use client";

import { useEffect, useRef, useState } from "react";
import { UiText } from "./ui-text";

export function ClearHomeFilters({ applied, href }: { applied: boolean; href: string }) {
  const button = useRef<HTMLButtonElement>(null);
  const [hasInput, setHasInput] = useState(false);

  useEffect(() => {
    const form = button.current?.form;
    if (!form) return;
    const sync = () => setHasInput(Array.from(new FormData(form)).some(([name, value]) =>
      name !== "export" && typeof value === "string" && value.trim() !== ""
    ));
    sync();
    form.addEventListener("input", sync);
    form.addEventListener("change", sync);
    window.addEventListener("pageshow", sync);
    return () => {
      form.removeEventListener("input", sync);
      form.removeEventListener("change", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, [applied]);

  return <button ref={button} type="button" className="btn btn-secondary btn-quiet" disabled={!applied && !hasInput} onClick={() => {
    if (applied) window.location.assign(href);
    else {
      button.current?.form?.reset();
      setHasInput(false);
    }
  }}><UiText text="清空条件" /></button>;
}

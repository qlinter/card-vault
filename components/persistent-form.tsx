"use client";

import { useActionState, useLayoutEffect, useRef, type ComponentProps } from "react";
import { UiText } from "./ui-text";

export type PersistentFormAction = (previous: { error: string }, data: FormData) => Promise<{ error: string }>;
type Props = Omit<ComponentProps<"form">, "action"> & { action: PersistentFormAction };
export function PersistentForm({ action, children, ...props }: Props) {
  const ref = useRef<HTMLFormElement>(null);
  const failedValues = useRef<FormData | null>(null);
  const [state, submit] = useActionState(action, { error: "" });
  useLayoutEffect(() => {
    if (!state.error || !failedValues.current || !ref.current) return;
    const restore = () => {
      for (const element of Array.from(ref.current?.elements ?? [])) {
        if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) continue;
        if (!element.name || element instanceof HTMLInputElement && ["hidden", "file", "submit"].includes(element.type)) continue;
        const values = failedValues.current?.getAll(element.name) ?? [];
        if (element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)) element.checked = values.includes(element.value);
        else element.value = String(values[0] ?? "");
      }
    };
    restore();
    const frame = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(frame);
  }, [state]);
  return <form {...props} ref={ref} action={submit} onSubmit={(event) => { failedValues.current = new FormData(event.currentTarget); props.onSubmit?.(event); }}>{state.error ? <p className="note-error" role="alert"><UiText text={state.error} /></p> : null}{children}</form>;
}

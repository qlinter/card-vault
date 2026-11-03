"use client";

import { useActionState, type ComponentProps } from "react";
import { UiText } from "./ui-text";

export type PersistentFormAction = (previous: { error: string }, data: FormData) => Promise<{ error: string }>;
type Props = Omit<ComponentProps<"form">, "action"> & { action: PersistentFormAction };
export function PersistentForm({ action, children, ...props }: Props) {
  const [state, submit] = useActionState(action, { error: "" });
  // Successful financial forms redirect or are remounted by their owner with a new key.
  // Prevent automatic resets so failure recovery cannot overwrite a user's later edits.
  return <form {...props} action={submit} onReset={event => { event.preventDefault(); props.onReset?.(event); }}>{state.error ? <p className="note-error" role="alert"><UiText text={state.error} /></p> : null}{children}</form>;
}

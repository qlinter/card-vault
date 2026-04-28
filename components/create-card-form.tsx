"use client";

import { useActionState } from "react";
import { createCardFormAction, CreateCardFormState } from "@/app/actions/cards";
import { CardForm } from "@/components/card-form";
import { emptyCardFormValues } from "@/lib/card-form-values";

const initialState: CreateCardFormState = {
  error: undefined,
  values: emptyCardFormValues
};

export function CreateCardForm() {
  const [state, formAction] = useActionState(createCardFormAction, initialState);

  return <CardForm mode="create" action={formAction} error={state.error} values={state.values} />;
}

"use client";

import { useActionState, useLayoutEffect, useRef } from "react";
import type { Card, CardImage } from "@prisma/client";
import { updateCardFormAction, type CreateCardFormState } from "@/app/actions/cards";
import { CardForm } from "./card-form";
import { normalizeCardFormValues } from "@/lib/card-entry-domain";

export function EditCardForm({ card, error, returnTo }: { card: Card & { images: CardImage[] }; error?: string; returnTo?: string }) {
  const initial: CreateCardFormState = { values: normalizeCardFormValues(card), error };
  const [state, action, pending] = useActionState(updateCardFormAction.bind(null, card.id), initial);
  const form = useRef<HTMLFormElement>(null);
  const previousStatus = useRef(card.collectionStatus);
  useLayoutEffect(() => {
    if (previousStatus.current !== card.collectionStatus) {
      const field = form.current?.elements.namedItem("collectionStatus");
      if (field instanceof HTMLSelectElement) field.value = card.collectionStatus;
      previousStatus.current = card.collectionStatus;
    }
  }, [card.collectionStatus]);
  return <CardForm formRef={form} mode="edit" card={card} action={action} error={state.error} values={state.error ? state.values : undefined} returnTo={returnTo} submitDisabled={pending} />;
}

"use client";

import { useActionState } from "react";
import type { Card, CardImage } from "@prisma/client";
import { updateCardFormAction, type CreateCardFormState } from "@/app/actions/cards";
import { CardForm } from "./card-form";
import { normalizeCardFormValues } from "@/lib/card-entry-domain";

export function EditCardForm({ card, error, returnTo }: { card: Card & { images: CardImage[] }; error?: string; returnTo?: string }) {
  const initial: CreateCardFormState = { values: normalizeCardFormValues(card), error };
  const [state, action, pending] = useActionState(updateCardFormAction.bind(null, card.id), initial);
  return <CardForm mode="edit" card={card} action={action} error={state.error} values={state.error ? state.values : undefined} returnTo={returnTo} submitDisabled={pending} />;
}

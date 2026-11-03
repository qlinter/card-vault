"use client";

import { useActionState, useLayoutEffect, useRef, useState } from "react";
import type { Card, CardImage } from "@prisma/client";
import type { CreateCardFormState } from "@/app/actions/cards";
import { CardForm } from "./card-form";
import { normalizeCardFormValues } from "@/lib/card-entry-domain";

export function EditCardForm({ card, action: saveAction, version, archiveVersion, error, returnTo }: { card: Card & { images: CardImage[] }; action: (previous: CreateCardFormState, data: FormData) => Promise<CreateCardFormState>; version: string; archiveVersion: string; error?: string; returnTo?: string }) {
  const initial: CreateCardFormState = { values: normalizeCardFormValues(card), error };
  const [state, action, pending] = useActionState(saveAction, initial);
  const [expectedVersion, setExpectedVersion] = useState(state.expectedVersion ?? version);
  const form = useRef<HTMLFormElement>(null);
  const previous = useRef({ status: card.collectionStatus, version, archiveVersion });
  useLayoutEffect(() => {
    if (previous.current.status !== card.collectionStatus) {
      const field = form.current?.elements.namedItem("collectionStatus");
      if (field instanceof HTMLSelectElement) field.value = card.collectionStatus;
      // Rebase only a financial status change. Other archive/image changes keep the
      // old baseline so an untouched input cannot silently overwrite refreshed data.
      if (previous.current.archiveVersion === archiveVersion && expectedVersion === previous.current.version) setExpectedVersion(version);
    }
    previous.current = { status: card.collectionStatus, version, archiveVersion };
  }, [card.collectionStatus, version, archiveVersion, expectedVersion]);
  return <CardForm formRef={form} mode="edit" card={card} editVersion={expectedVersion} action={action} error={state.error} values={state.error ? state.values : undefined} returnTo={returnTo} submitDisabled={pending} />;
}

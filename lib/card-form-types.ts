import type { Card, CardImage } from "@prisma/client";
import type { FormEventHandler, Ref } from "react";
import type { CardFormValues } from "./card-form-values";
import type { CardEntryRecognitionSummary } from "./card-entry-queue-domain";
import type { DraftImage } from "./card-entry-draft-images.js";

export type CardFieldSource = { card?: Card; values?: CardFormValues };
export type QueuedCardImage = { id: string; url: string; side: "front" | "back"; originalName: string };
export type CardFormProps = CardFieldSource & {
  mode: "create" | "edit"; action: (formData: FormData) => void | Promise<void>; error?: string; errorField?: string;
  card?: Card & { images: CardImage[] }; returnTo?: string; formRef?: Ref<HTMLFormElement>; draftId?: string; draftImages?: DraftImage[];
  onSubmit?: FormEventHandler<HTMLFormElement>; onInvalid?: FormEventHandler<HTMLFormElement>; submitDisabled?: boolean;
  editVersion?: string;
  queueItemId?: string; queuedImages?: QueuedCardImage[]; queueRecognition?: CardEntryRecognitionSummary;
};

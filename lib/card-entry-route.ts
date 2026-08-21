import { NextResponse } from "next/server";
import { normalizeCardEntryId } from "./card-entry-domain.ts";
import { errorMessage } from "./feedback-messages.ts";

export type CardEntryRouteContext = {
  params: Promise<{ id: string }>;
};

export async function requireCardEntryRouteId(
  context: CardEntryRouteContext,
  invalidMessage: string
): Promise<string> {
  const id = normalizeCardEntryId((await context.params).id);
  if (!id) throw new Error(invalidMessage);
  return id;
}

export function cardEntryErrorResponse(
  error: unknown,
  fallbackMessage: string,
  status = 400
) {
  return NextResponse.json(
    { error: errorMessage(error, fallbackMessage) },
    { status }
  );
}

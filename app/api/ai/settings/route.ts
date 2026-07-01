import { NextResponse } from "next/server";
import { getPublicAzureOpenAISettings } from "@/lib/azure-openai-settings";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getPublicAzureOpenAISettings());
}

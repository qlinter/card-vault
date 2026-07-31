import { NextResponse } from "next/server";
import { getPublicAiSettings } from "@/lib/ai-settings";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getPublicAiSettings());
}

import { cookies } from "next/headers";
import { showcaseSourceCookie } from "./showcase-source";

export async function prefersStudioImages(guest = false) {
  return (await cookies()).get(showcaseSourceCookie(guest))?.value !== "original";
}

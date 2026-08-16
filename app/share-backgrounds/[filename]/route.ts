import { createImageFileRoute } from "@/lib/image-response";
import { getShareBackgroundsDir } from "@/lib/storage-paths";

export const GET = createImageFileRoute(getShareBackgroundsDir());

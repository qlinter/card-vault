import { createImageFileRoute } from "@/lib/image-response";
import { getShareCoversDir } from "@/lib/storage-paths";

export const GET = createImageFileRoute(getShareCoversDir());

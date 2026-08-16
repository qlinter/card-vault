import { createImageFileRoute } from "@/lib/image-response";
import { getUploadsDir } from "@/lib/storage-paths";

export const GET = createImageFileRoute(getUploadsDir());

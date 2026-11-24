import { authorizeCardImage, readImageFile } from "@/lib/image-response";
import { getUploadsDir } from "@/lib/storage-paths";

const uploadsDir = getUploadsDir();
export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  return (await authorizeCardImage(filename)) ?? readImageFile(uploadsDir, filename);
}

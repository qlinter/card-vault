type ZipEntry = { name: string } & ({ path: string; content?: never } | { content: string; path?: never });
export function writeStreamingZip(output: string, entries: Iterable<ZipEntry>, signal?: AbortSignal): Promise<void>;

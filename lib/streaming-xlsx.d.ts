export function bufferedFile(file: string, signal?: AbortSignal): Promise<{ append(text: string): Promise<void>; close(): Promise<void>; abort(): Promise<void> }>;
export function writeStreamingXlsx(directory: string, sources: Array<{ name: string; headers: string[]; rows: AsyncIterable<unknown[]> }>, signal?: AbortSignal, rowLimit?: number): Promise<string>;

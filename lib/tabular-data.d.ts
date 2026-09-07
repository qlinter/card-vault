export function parseCsv(text: string): { headers: string[]; rows: string[][] };
export function validateTable(rows: string[][]): { headers: string[]; rows: string[][] };
export function encodeCsv(rows: unknown[][]): string;
export function validateXlsxArchive(buffer: Buffer): void;
export const maxRows: number;
export const maxColumns: number;

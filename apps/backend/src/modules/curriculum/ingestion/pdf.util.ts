export interface ExtractedPdf {
  text: string;
  pageCount: number;
}

/**
 * Extract plain text from a PDF buffer. pdf-parse is loaded lazily so its module
 * side effects never run during unrelated test suites.
 */
export async function extractPdf(buffer: Buffer): Promise<ExtractedPdf> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = (await import('pdf-parse')).default as (
    data: Buffer,
  ) => Promise<{ text: string; numpages: number }>;
  const result = await pdfParse(buffer);
  return { text: result.text, pageCount: result.numpages };
}

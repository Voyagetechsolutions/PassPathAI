export interface TextChunk {
  content: string;
  tokenCount: number;
}

/**
 * Split raw text into retrieval-sized chunks on paragraph boundaries, falling
 * back to hard splits for very long paragraphs. Token count is estimated at
 * ~4 chars/token (good enough for budgeting; exact counts come from the model).
 */
export function chunkText(text: string, maxChars = 1000, overlapChars = 100): TextChunk[] {
  const normalised = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!normalised) {
    return [];
  }

  const paragraphs = normalised.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) {
      chunks.push(trimmed);
    }
    current = '';
  };

  for (const para of paragraphs) {
    if (para.length > maxChars) {
      flush();
      for (let i = 0; i < para.length; i += maxChars - overlapChars) {
        chunks.push(para.slice(i, i + maxChars).trim());
      }
      continue;
    }
    if ((current + '\n\n' + para).length > maxChars) {
      flush();
    }
    current = current ? `${current}\n\n${para}` : para;
  }
  flush();

  return chunks
    .filter((c) => c.length > 0)
    .map((content) => ({ content, tokenCount: Math.ceil(content.length / 4) }));
}

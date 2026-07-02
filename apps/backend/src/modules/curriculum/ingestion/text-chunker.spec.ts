import { chunkText } from './text-chunker';

describe('chunkText', () => {
  it('returns no chunks for empty input', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\n  ')).toEqual([]);
  });

  it('keeps small text as a single chunk', () => {
    const chunks = chunkText('Algebra is the study of symbols.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it('splits long text into multiple chunks under the size cap', () => {
    const para = 'x'.repeat(2500);
    const chunks = chunkText(para, 1000, 100);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(1000);
    }
  });

  it('groups paragraphs without exceeding the cap', () => {
    const text = ['a'.repeat(400), 'b'.repeat(400), 'c'.repeat(400)].join('\n\n');
    const chunks = chunkText(text, 1000);
    for (const c of chunks) {
      expect(c.content.length).toBeLessThanOrEqual(1000);
    }
  });
});

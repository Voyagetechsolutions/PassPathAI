-- Compact OpenAI v3 embeddings to 256 dimensions. Cosine distance is unchanged
-- by normalization, so existing Matryoshka embeddings can be shortened safely.
ALTER TABLE "knowledge_chunks"
  ALTER COLUMN "embedding" TYPE vector(256)
  USING subvector("embedding", 1, 256)::vector(256);

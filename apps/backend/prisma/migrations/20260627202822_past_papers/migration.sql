-- CreateTable
CREATE TABLE "past_papers" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject_id" TEXT,
    "grade" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "past_papers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "past_papers_grade_subject_id_idx" ON "past_papers"("grade", "subject_id");

-- AddForeignKey
ALTER TABLE "past_papers" ADD CONSTRAINT "past_papers_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

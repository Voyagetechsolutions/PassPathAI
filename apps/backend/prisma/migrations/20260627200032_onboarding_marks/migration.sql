-- CreateEnum
CREATE TYPE "Syllabus" AS ENUM ('CAPS', 'IEB');

-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "onboarded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "syllabus" "Syllabus";

-- CreateTable
CREATE TABLE "subject_marks" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "subject_name" TEXT NOT NULL,
    "mark" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_marks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subject_marks_student_id_idx" ON "subject_marks"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "subject_marks_student_id_subject_name_key" ON "subject_marks"("student_id", "subject_name");

-- AddForeignKey
ALTER TABLE "subject_marks" ADD CONSTRAINT "subject_marks_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

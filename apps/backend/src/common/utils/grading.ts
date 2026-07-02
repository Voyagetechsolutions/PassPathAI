import { QuestionType } from '@prisma/client';

const normalise = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Deterministic auto-grading shared by diagnostics and exams.
 * - MCQ: response label must match the correct option label.
 * - SHORT_ANSWER / EXAM_STYLE: normalised exact match against the marking memo.
 *   (Free-text marking is intentionally strict; richer rubric grading is future work.)
 */
export function gradeResponse(
  type: QuestionType,
  response: string,
  correctLabel: string | null,
  modelAnswer: string | null,
): boolean {
  if (type === QuestionType.MULTIPLE_CHOICE) {
    return correctLabel !== null && response.trim().toUpperCase() === correctLabel.toUpperCase();
  }
  return (
    modelAnswer !== null && modelAnswer.length > 0 && normalise(response) === normalise(modelAnswer)
  );
}

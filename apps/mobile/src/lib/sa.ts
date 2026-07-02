export const GRADES = [8, 9, 10, 11, 12];

/**
 * Map a student's grade to the curriculum phase grade the backend holds subjects
 * at: Senior Phase (8–9) → 9, FET (10–12) → 10. Used to fetch the right subject
 * list for the student's grade.
 */
export function phaseGrade(grade: number): number {
  return grade <= 9 ? 9 : 10;
}

export const SYLLABI: Array<{ value: 'CAPS' | 'IEB'; label: string; sub: string }> = [
  { value: 'CAPS', label: 'CAPS', sub: 'National curriculum (most schools)' },
  { value: 'IEB', label: 'IEB', sub: 'Independent Examinations Board' },
];

/**
 * CAPS subjects across the Senior (8–9) and FET (10–12) phases. Students pick the
 * ones they take during onboarding.
 */
export const SUBJECTS = [
  // Compulsory / common
  'Mathematics',
  'Mathematical Literacy',
  'English Home Language',
  'English First Additional Language',
  'Afrikaans',
  'isiZulu',
  'isiXhosa',
  'Sesotho',
  'Setswana',
  'Life Orientation',
  // Senior phase (8–9)
  'Natural Sciences',
  'Social Sciences',
  'Economic and Management Sciences',
  'Technology',
  'Creative Arts',
  // Sciences
  'Physical Sciences',
  'Life Sciences',
  'Agricultural Sciences',
  // Commerce
  'Accounting',
  'Business Studies',
  'Economics',
  // Humanities
  'Geography',
  'History',
  'Religious Studies',
  // Technology & computers
  'Computer Applications Technology',
  'Information Technology',
  'Engineering Graphics and Design',
  // Arts
  'Visual Arts',
  'Dramatic Arts',
  'Music',
  // Services / practical
  'Consumer Studies',
  'Hospitality Studies',
  'Tourism',
];

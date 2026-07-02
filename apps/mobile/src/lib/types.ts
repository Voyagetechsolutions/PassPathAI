export interface AuthUser {
  id: string;
  email: string;
  role: 'student' | 'parent' | 'admin';
  emailVerified: boolean;
  studentProfileId?: string;
}

export interface DashboardView {
  predictedScore: number;
  predictionConfidence: number;
  masteryScore: number;
  completedTopics: number;
  totalTrackedTopics: number;
  weakTopics: Array<{ topicId: string; title: string; weaknessScore: number }>;
  streak: { currentStreak: number; longestStreak: number; lastActiveDate: string | null };
}

export interface PredictionPoint {
  id: string;
  predictedScore: number;
  confidence: number;
  createdAt: string;
}

export interface DailyMission {
  id: string;
  title: string;
  description: string | null;
  status: 'PENDING' | 'COMPLETED' | 'SKIPPED';
  priority: number;
  topic?: { id: string; title: string } | null;
}

export interface AskResult {
  answered: boolean;
  /** true → answer cites ingested CAPS sources; false → taught from CAPS knowledge. */
  grounded: boolean;
  answer: string;
  citations: Array<{ chunkId: string; score: number; preview: string }>;
}

export interface ExamCountdown {
  id: string;
  title: string;
  date: string;
  daysRemaining: number;
  subject?: { id: string; name: string } | null;
}

export interface CountdownView {
  yearEnd: { date: string; daysRemaining: number };
  nextExam: ExamCountdown | null;
  matricFinals: { date: string; daysRemaining: number; year: number };
  exams: ExamCountdown[];
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  grade: number;
}

export interface SubjectMark {
  subjectName: string;
  mark: number;
}

export type Syllabus = 'CAPS' | 'IEB';

export interface ProfileSummary {
  id: string;
  firstName: string;
  surname: string;
  grade: number;
  school: string | null;
  syllabus: Syllabus | null;
  onboarded: boolean;
  subjects: Subject[];
  marks: SubjectMark[];
}

export interface CareerMatch {
  careerId: string;
  title: string;
  description: string;
  faculty: string | null;
  eligible: boolean;
  admissionLikelihood: number;
  computedAps: number;
  unmetSubjects: string[];
  programmes: Array<{
    university: string;
    programmeName: string;
    minAps: number;
    apsMet: boolean;
    requirementsMet: boolean;
  }>;
}

export interface CareerDetail {
  id: string;
  title: string;
  description: string;
  faculty: string | null;
  subjectRequirements: Array<{ subjectName: string; minPercent: number }>;
  programmes: Array<{
    id: string;
    university: string;
    programmeName: string;
    minAps: number;
    requirements: Array<{ subjectName: string; minPercent: number }>;
  }>;
}

export interface PastPaper {
  id: string;
  title: string;
  grade: number;
  year: number;
  kind: string;
  mimeType: string;
  subject: { id: string; name: string } | null;
  fileUrl: string;
}

export interface AdminStats {
  content: { subjects: number; questions: number; lessons: number; careers: number };
  users: { total: number; students: number; parents: number; onboarded: number };
  engagement: {
    activeToday: number;
    activeThisWeek: number;
    diagnosticAttempts: number;
    avgDiagnosticScore: number;
    avgStreak: number;
    longestStreak: number;
    aiQueries: number;
  };
}

export interface DailyGoal {
  goalCount: number;
  completedCount: number;
  allDone: boolean;
  activeToday: boolean;
  streak: { current: number; longest: number };
  tasks: Array<{
    missionId: string;
    topicId: string | null;
    title: string;
    subjectId: string | null;
    subjectName: string | null;
    done: boolean;
  }>;
}

export interface TopicNode {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
  importance: number;
}

export interface SubjectTree {
  id: string;
  name: string;
  code: string;
  grade: number;
  topics: TopicNode[];
}

export interface Lesson {
  id: string;
  topicId: string;
  learningObjective: string;
  introduction: string;
  sections: Array<{ heading: string; content: string }>;
  workedExamples: Array<{ problem: string; solution: string }>;
  commonMistakes: string[];
  memoryTricks: string[];
  examTips: string[];
  revisionSummary: string;
  grounded: boolean;
  status: string;
  helpfulCount: number;
  notHelpfulCount: number;
}

export interface TutorMessage {
  role: 'assistant' | 'user';
  content: string;
}

export interface TutorStarter {
  key: string;
  label: string;
}

export interface TutorStart {
  conversationId: string;
  topicTitle: string;
  subjectName: string;
  understandingScore: number | null;
  starters: TutorStarter[];
  messages: TutorMessage[];
  messagesRemaining: number;
  limitReached: boolean;
  requiresPremium: boolean;
}

export interface TutorReply {
  reply: string;
  userContent: string;
  messagesRemaining: number;
  limitReached: boolean;
  requiresPremium: boolean;
}

export interface SubscriptionStatus {
  isPremium: boolean;
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | 'FREE';
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  priceLabel: string;
}

export interface TutorRating {
  score: number;
  feedback: string;
  strengths: string[];
  gaps: string[];
  understandingScore: number;
}

export interface CalendarLearnedDay {
  date: string;
  topics: Array<{ topicId: string; title: string; subjectName: string }>;
}

export interface CalendarExam {
  id: string;
  date: string;
  title: string;
  subjectName: string | null;
  editable: boolean;
}

export interface CalendarMonth {
  month: string;
  learned: CalendarLearnedDay[];
  exams: CalendarExam[];
}

export interface ExamPaperSummary {
  id: string;
  title: string;
  durationMins: number;
  totalMarks: number;
  grade: number;
  questionCount: number;
}

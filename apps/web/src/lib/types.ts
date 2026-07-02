export type Role = 'student' | 'parent' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  studentProfileId?: string;
  parentProfileId?: string;
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

export interface ProfileSummary {
  id: string;
  firstName: string;
  surname: string;
  grade: number;
  school: string | null;
  subjects: Array<{ id: string; name: string; code: string }>;
}

export interface CountdownView {
  yearEnd: { date: string; daysRemaining: number };
  exams: Array<{
    id: string;
    title: string;
    date: string;
    daysRemaining: number;
    subject?: { id: string; name: string } | null;
  }>;
}

export interface TodayMission {
  id: string;
  title: string;
  description: string | null;
  status: 'PENDING' | 'COMPLETED' | 'SKIPPED';
  priority: number;
  topic?: { id: string; title: string } | null;
}

export interface AdminStats {
  users: number;
  students: number;
  parents: number;
  subjects: number;
  questions: number;
  documents: number;
  careers: number;
  aiQueries: number;
}

export interface AdminUser {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  studentProfile?: { firstName: string; surname: string; grade: number } | null;
  parentProfile?: { firstName: string; surname: string } | null;
}

export interface AiSetting {
  id: string;
  key: string;
  value: string;
}

export interface ChildSummary {
  id: string;
  firstName: string;
  surname: string;
  grade: number;
  school: string | null;
}

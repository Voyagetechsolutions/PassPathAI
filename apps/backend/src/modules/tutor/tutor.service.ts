import { ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OpenAiService } from '../../infra/openai/openai.service';
import { AiService } from '../ai/ai.service';
import { WeaknessService } from '../weakness/weakness.service';
import { SubscriptionService } from '../subscription/subscription.service';
import {
  buildTutorRatingPrompt,
  buildTutorSystemPrompt,
  TUTOR_STARTERS,
  tutorStarterInstruction,
} from '../ai/prompts';
import { TutorMessageDto } from './dto/tutor-message.dto';
import { TutorRateDto } from './dto/tutor-rate.dto';

const HISTORY_LIMIT = 24; // cap tokens — keep the recent back-and-forth
/**
 * Per-topic budget of student messages. The conversation is rich enough to master a
 * topic within this many turns; the cap keeps OpenAI spend predictable and nudges
 * the student toward "explain it back" + practice rather than endless chatting.
 */
const MAX_TUTOR_TURNS = 25;
/**
 * Free accounts get a small taste of the AI tutor (lifetime, across all topics)
 * before hitting the Premium paywall — enough to feel the product work, not
 * enough to substitute for subscribing.
 */
const FREE_TRIAL_MESSAGES = 5;
const STYLE_LABEL = new Map(TUTOR_STARTERS.map((s) => [s.key, s.label]));

export interface RatingResult {
  score: number;
  feedback: string;
  strengths: string[];
  gaps: string[];
}

interface TutorTopic {
  id: string;
  title: string;
  subject: { code: string; name: string; grade: number };
}

/**
 * The conversational tutor. A real back-and-forth per topic: the AI teaches one
 * small idea at a time, adapts to how the learner understands (remembered across
 * sessions), and can rate the student's own explanation of the topic out of 10.
 */
@Injectable()
export class TutorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAiService,
    private readonly ai: AiService,
    private readonly weakness: WeaknessService,
    private readonly subscription: SubscriptionService,
  ) {}

  private requireStudent(studentId: string | undefined): string {
    if (!studentId) {
      throw new ForbiddenException('Only students can use the tutor');
    }
    return studentId;
  }

  private requireAi(): void {
    if (!this.openai.isConfigured) {
      throw new ServiceUnavailableException('The tutor is not available right now.');
    }
  }

  // ─── Start / resume a topic chat ───────────────────────────────────────────────

  async start(studentId: string | undefined, topicId: string) {
    const sid = this.requireStudent(studentId);
    const topic = await this.loadTopic(topicId);

    const conversation = await this.prisma.tutorConversation.upsert({
      where: { studentId_topicId: { studentId: sid, topicId } },
      create: { studentId: sid, topicId },
      update: {},
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    let messages = conversation.messages;

    // First time on this topic → the tutor opens the conversation warmly (unless
    // this free account has spent its trial — no point spending an OpenAI call
    // just to show a paywall).
    if (messages.length === 0) {
      const gate = await this.checkEntitlement(sid);
      if (!gate.allowed) {
        return {
          conversationId: conversation.id,
          topicTitle: topic.title,
          subjectName: topic.subject.name,
          understandingScore: conversation.understandingScore,
          starters: TUTOR_STARTERS.map((s) => ({ key: s.key, label: s.label })),
          messages: [],
          messagesRemaining: 0,
          limitReached: false,
          requiresPremium: true,
        };
      }
      this.requireAi();
      const opener = await this.generateOpener(sid, topic);
      const created = await this.prisma.tutorMessage.create({
        data: { conversationId: conversation.id, role: 'assistant', content: opener },
      });
      messages = [created];
    }

    const used = messages.filter((m) => m.role === 'user').length;
    return {
      conversationId: conversation.id,
      topicTitle: topic.title,
      subjectName: topic.subject.name,
      understandingScore: conversation.understandingScore,
      starters: TUTOR_STARTERS.map((s) => ({ key: s.key, label: s.label })),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      messagesRemaining: Math.max(0, MAX_TUTOR_TURNS - used),
      limitReached: used >= MAX_TUTOR_TURNS,
      requiresPremium: false,
    };
  }

  // ─── A turn in the conversation ────────────────────────────────────────────────

  async message(studentId: string | undefined, topicId: string, dto: TutorMessageDto) {
    const sid = this.requireStudent(studentId);
    this.requireAi();
    const topic = await this.loadTopic(topicId);

    const starterInstruction = tutorStarterInstruction(dto.starter);
    const typed = dto.content?.trim();
    if (!starterInstruction && !typed) {
      throw new NotFoundException('Nothing to send');
    }
    // What the model is told to do this turn vs. what we show in the student's bubble.
    const modelContent = starterInstruction ?? (typed as string);
    const displayContent = dto.starter ? (STYLE_LABEL.get(dto.starter) ?? typed ?? '') : (typed as string);

    const conversation = await this.prisma.tutorConversation.upsert({
      where: { studentId_topicId: { studentId: sid, topicId } },
      create: { studentId: sid, topicId },
      update: {},
      include: { messages: { orderBy: { createdAt: 'asc' }, take: HISTORY_LIMIT } },
    });

    // Budget guard — never call the model once the topic's message budget is spent.
    const used = await this.prisma.tutorMessage.count({ where: { conversationId: conversation.id, role: 'user' } });
    if (used >= MAX_TUTOR_TURNS) {
      return {
        reply:
          'We’ve covered a lot on this topic together! 🎉 The best next step now is to tap “Explain it back” so I can see how well it’s landed, then practise a few questions. You can always come back to revise.',
        userContent: displayContent,
        messagesRemaining: 0,
        limitReached: true,
        requiresPremium: false,
      };
    }

    const gate = await this.checkEntitlement(sid);
    if (!gate.allowed) {
      return {
        reply: '',
        userContent: displayContent,
        messagesRemaining: Math.max(0, MAX_TUTOR_TURNS - used),
        limitReached: false,
        requiresPremium: true,
      };
    }

    const system = await this.buildSystem(sid, topic);
    const history = conversation.messages.map((m) => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: m.content,
    }));
    history.push({ role: 'user', content: modelContent });

    const result = await this.openai.chatMessages(system, history, { temperature: 0.6 });
    const reply = result.content || 'Let’s try that again — could you tell me what part is tricky?';

    // Persist both turns; bump the conversation's updatedAt.
    await this.prisma.tutorMessage.createMany({
      data: [
        { conversationId: conversation.id, role: 'user', content: displayContent || modelContent, starter: dto.starter ?? null },
        { conversationId: conversation.id, role: 'assistant', content: reply },
      ],
    });
    await this.prisma.tutorConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

    // Remember which framings this learner reaches for.
    if (dto.starter) {
      await this.recordStyle(sid, dto.starter);
    }

    const remaining = Math.max(0, MAX_TUTOR_TURNS - (used + 1));
    return { reply, userContent: displayContent, messagesRemaining: remaining, limitReached: remaining === 0, requiresPremium: false };
  }

  // ─── Teach-it-back: the student explains, the tutor rates /10 ───────────────────

  async rate(studentId: string | undefined, topicId: string, dto: TutorRateDto): Promise<RatingResult & { understandingScore: number }> {
    const sid = this.requireStudent(studentId);
    this.requireAi();
    const topic = await this.loadTopic(topicId);

    const { context } = await this.gatherContext(topic);
    const rating = await this.openai.chatJson<Partial<RatingResult>>(
      buildTutorRatingPrompt(topic.subject.grade, topic.subject.name, topic.title, context),
      `The student's explanation of "${topic.title}":\n\n${dto.explanation}`,
    );

    const score = Math.max(0, Math.min(10, Math.round(Number(rating.score) || 0)));
    const strengths = Array.isArray(rating.strengths) ? rating.strengths.filter((s) => typeof s === 'string') : [];
    const gaps = Array.isArray(rating.gaps) ? rating.gaps.filter((s) => typeof s === 'string') : [];
    const feedback = typeof rating.feedback === 'string' ? rating.feedback : 'Good effort — keep building on it.';

    await this.prisma.tutorConversation.upsert({
      where: { studentId_topicId: { studentId: sid, topicId } },
      create: { studentId: sid, topicId, understandingScore: score, ratedAt: new Date() },
      update: { understandingScore: score, ratedAt: new Date() },
    });

    // A confident explanation is real evidence of mastery; feed the weakness engine.
    await this.weakness.recordResults(sid, [{ topicId, attempts: 1, correct: score >= 6 ? 1 : 0 }], 'tutor');

    // Grow the tutor's memory of what this learner still needs.
    if (gaps.length > 0) {
      await this.appendNote(sid, `On "${topic.title}" (scored ${score}/10): revisit ${gaps.join('; ')}.`);
    }

    return { score, feedback, strengths, gaps, understandingScore: score };
  }

  // ─── Internals ─────────────────────────────────────────────────────────────────

  /** Premium accounts always pass. Free accounts get FREE_TRIAL_MESSAGES lifetime. */
  private async checkEntitlement(studentId: string): Promise<{ allowed: boolean }> {
    if (await this.subscription.isPremium(studentId)) {
      return { allowed: true };
    }
    const usedLifetime = await this.prisma.tutorMessage.count({
      where: { role: 'user', conversation: { studentId } },
    });
    return { allowed: usedLifetime < FREE_TRIAL_MESSAGES };
  }

  private async loadTopic(topicId: string) {
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId }, include: { subject: true } });
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }
    return topic;
  }

  private async buildSystem(studentId: string, topic: TutorTopic): Promise<string> {
    const [{ context }, memory, student] = await Promise.all([
      this.gatherContext(topic),
      this.learnerMemory(studentId),
      this.prisma.studentProfile.findUnique({ where: { id: studentId }, select: { firstName: true } }),
    ]);
    return buildTutorSystemPrompt({
      grade: topic.subject.grade,
      subjectName: topic.subject.name,
      topicTitle: topic.title,
      syllabusContext: context,
      learnerMemory: memory,
      studentName: student?.firstName,
    });
  }

  /**
   * Build the teaching context for a topic. A topic with a hand-authored, reviewed
   * PassPath Lesson uses that as the trusted spine; retrieval extracts are layered
   * on for breadth. Topics without an authored lesson fall back to retrieval alone.
   */
  private async gatherContext(topic: TutorTopic): Promise<{ context: string; grounded: boolean }> {
    const [lesson, retrieval] = await Promise.all([
      this.prisma.lesson.findUnique({ where: { topicId: topic.id } }),
      this.ai.topicContext(topic.subject.code, `${topic.subject.name}: ${topic.title}`),
    ]);
    const parts: string[] = [];
    if (lesson) {
      parts.push(
        `AUTHORED PASSPATH LESSON — your trusted, reviewed teaching material. Use this as the spine of what you teach (in your own conversational words):\n${this.formatLesson(lesson)}`,
      );
    }
    parts.push(`ADDITIONAL SYLLABUS EXTRACTS:\n${retrieval.context}`);
    return { context: parts.join('\n\n'), grounded: retrieval.grounded || !!lesson };
  }

  private formatLesson(lesson: {
    learningObjective: string;
    introduction: string;
    sections: unknown;
    workedExamples: unknown;
    commonMistakes: unknown;
    memoryTricks: unknown;
    examTips: unknown;
    revisionSummary: string;
  }): string {
    const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
    const list = (v: unknown) => arr<string>(v).map((x) => `- ${x}`).join('\n');
    const sections = arr<{ heading: string; content: string }>(lesson.sections)
      .map((s) => `- ${s.heading}: ${s.content}`)
      .join('\n');
    const worked = arr<{ problem: string; solution: string }>(lesson.workedExamples)
      .map((w) => `Problem: ${w.problem}\nSolution: ${w.solution}`)
      .join('\n\n');
    return [
      `LEARNING OBJECTIVE: ${lesson.learningObjective}`,
      `INTRODUCTION: ${lesson.introduction}`,
      sections && `KEY POINTS:\n${sections}`,
      worked && `WORKED EXAMPLES:\n${worked}`,
      arr(lesson.commonMistakes).length && `COMMON MISTAKES:\n${list(lesson.commonMistakes)}`,
      arr(lesson.memoryTricks).length && `MEMORY TRICKS:\n${list(lesson.memoryTricks)}`,
      arr(lesson.examTips).length && `EXAM TIPS:\n${list(lesson.examTips)}`,
      lesson.revisionSummary && `REVISION SUMMARY: ${lesson.revisionSummary}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private async generateOpener(studentId: string, topic: TutorTopic): Promise<string> {
    const system = await this.buildSystem(studentId, topic);
    const result = await this.openai.chatMessages(
      system,
      [{ role: 'user', content: 'Begin the lesson. Greet the student warmly by name if you know it, say in one short line what this topic is about and why it’s worth knowing, then ask how they’d like to start — or to just say "go". Keep it to 3 short sentences.' }],
      { temperature: 0.7 },
    );
    return result.content || `Hi! Let’s learn ${topic.title} together. We’ll take it one small step at a time — ready to start?`;
  }

  private async learnerMemory(studentId: string): Promise<string> {
    const profile = await this.prisma.learnerProfile.findUnique({ where: { studentId } });
    if (!profile || (profile.preferredStyles.length === 0 && !profile.notes)) {
      return "You're still getting to know this learner. Notice what makes a concept click for them and lean into it.";
    }
    const styles = profile.preferredStyles.map((k) => STYLE_LABEL.get(k) ?? k);
    const parts: string[] = [];
    if (styles.length > 0) {
      parts.push(`This learner understands best through: ${styles.join(', ')}. Reach for these framings first.`);
    }
    if (profile.notes) {
      parts.push(`Notes from past sessions: ${profile.notes.trim()}`);
    }
    return parts.join('\n');
  }

  private async recordStyle(studentId: string, key: string): Promise<void> {
    const profile = await this.prisma.learnerProfile.findUnique({ where: { studentId } });
    const existing = profile?.preferredStyles ?? [];
    const next = [key, ...existing.filter((s) => s !== key)].slice(0, 5);
    await this.prisma.learnerProfile.upsert({
      where: { studentId },
      create: { studentId, preferredStyles: next },
      update: { preferredStyles: next },
    });
  }

  private async appendNote(studentId: string, note: string): Promise<void> {
    const profile = await this.prisma.learnerProfile.findUnique({ where: { studentId } });
    // Keep the running note bounded so it never bloats the prompt.
    const merged = [profile?.notes, note].filter(Boolean).join(' ').slice(-600);
    await this.prisma.learnerProfile.upsert({
      where: { studentId },
      create: { studentId, notes: merged },
      update: { notes: merged },
    });
  }
}

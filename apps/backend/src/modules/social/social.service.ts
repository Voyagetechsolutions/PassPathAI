import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { FriendshipStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class SocialService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: AuthenticatedUser) {
    const studentId = this.studentId(user);
    const [friendships, pending, outgoing, student, rewards, studiedToday] = await Promise.all([
      this.prisma.friendship.findMany({
        where: { status: FriendshipStatus.ACCEPTED, OR: [{ requesterId: studentId }, { addresseeId: studentId }] },
        include: {
          requester: { include: { user: { select: { email: true } } } },
          addressee: { include: { user: { select: { email: true } } } },
          streak: true,
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.friendship.findMany({
        where: { addresseeId: studentId, status: FriendshipStatus.PENDING },
        include: { requester: { include: { user: { select: { email: true } } } } },
      }),
      this.prisma.friendship.findMany({
        where: { requesterId: studentId, status: FriendshipStatus.PENDING },
        include: { addressee: { include: { user: { select: { email: true } } } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.studentProfile.findUniqueOrThrow({ where: { id: studentId }, select: { rewardPoints: true } }),
      this.prisma.studentReward.findMany({ where: { studentId }, include: { reward: true }, orderBy: { earnedAt: 'desc' } }),
      this.prisma.studyActivity.findUnique({ where: { studentId_studyDate: { studentId, studyDate: this.today() } } }),
    ]);
    return {
      studiedToday: Boolean(studiedToday),
      rewardPoints: student.rewardPoints,
      rewards: rewards.map((item) => ({ ...item.reward, earnedAt: item.earnedAt })),
      pending: pending.map((item) => ({ id: item.id, friend: this.person(item.requester) })),
      outgoing: outgoing.map((item) => ({ id: item.id, friend: this.person(item.addressee) })),
      friends: friendships.map((item) => {
        const friend = item.requesterId === studentId ? item.addressee : item.requester;
        return { id: item.id, friend: this.person(friend), streak: item.streak, lastMessage: item.messages[0] ?? null };
      }),
    };
  }

  async requestFriend(user: AuthenticatedUser, emailInput: string) {
    const studentId = this.studentId(user);
    const target = await this.prisma.user.findUnique({
      where: { email: emailInput.trim().toLowerCase() }, select: { studentProfile: { select: { id: true } } },
    });
    if (!target?.studentProfile) throw new NotFoundException('No student account found with that email');
    if (target.studentProfile.id === studentId) throw new BadRequestException('You cannot add yourself');
    const existing = await this.prisma.friendship.findFirst({
      where: { OR: [
        { requesterId: studentId, addresseeId: target.studentProfile.id },
        { requesterId: target.studentProfile.id, addresseeId: studentId },
      ] },
    });
    if (existing) throw new BadRequestException('A friend request or friendship already exists');
    return this.prisma.friendship.create({ data: { requesterId: studentId, addresseeId: target.studentProfile.id } });
  }

  async acceptFriend(user: AuthenticatedUser, friendshipId: string) {
    const studentId = this.studentId(user);
    const result = await this.prisma.friendship.updateMany({
      where: { id: friendshipId, addresseeId: studentId, status: FriendshipStatus.PENDING },
      data: { status: FriendshipStatus.ACCEPTED },
    });
    if (!result.count) throw new NotFoundException('Friend request not found');
    await this.prisma.friendStudyStreak.upsert({
      where: { friendshipId }, update: {}, create: { friendshipId },
    });
    return { accepted: true };
  }

  async removeFriend(user: AuthenticatedUser, friendshipId: string) {
    const studentId = this.studentId(user);
    const result = await this.prisma.friendship.deleteMany({
      where: {
        id: friendshipId,
        OR: [{ requesterId: studentId }, { addresseeId: studentId }],
      },
    });
    if (!result.count) throw new NotFoundException('Friend request or friendship not found');
    return { removed: true };
  }

  async messages(user: AuthenticatedUser, friendshipId: string, after?: string) {
    const studentId = this.studentId(user);
    await this.requireFriendship(friendshipId, studentId);
    return this.prisma.peerMessage.findMany({
      where: { friendshipId, ...(after ? { createdAt: { gt: new Date(after) } } : {}) },
      orderBy: { createdAt: 'asc' }, take: 100,
    });
  }

  async sendMessage(user: AuthenticatedUser, friendshipId: string, contentInput: string) {
    const studentId = this.studentId(user);
    await this.requireFriendship(friendshipId, studentId);
    const content = contentInput.trim();
    if (!content) throw new BadRequestException('Message cannot be empty');
    return this.prisma.peerMessage.create({ data: { friendshipId, senderId: studentId, content } });
  }

  async checkIn(user: AuthenticatedUser, minutes: number) {
    const studentId = this.studentId(user);
    const today = this.today();
    await this.prisma.studyActivity.upsert({
      where: { studentId_studyDate: { studentId, studyDate: today } },
      update: { minutes: { increment: minutes } }, create: { studentId, studyDate: today, minutes },
    });
    const totalSessions = await this.prisma.studyActivity.count({ where: { studentId } });
    await this.award(studentId, 'sessions', totalSessions);
    const friendships = await this.prisma.friendship.findMany({
      where: { status: FriendshipStatus.ACCEPTED, OR: [{ requesterId: studentId }, { addresseeId: studentId }] },
      include: { streak: true },
    });
    for (const friendship of friendships) {
      const otherId = friendship.requesterId === studentId ? friendship.addresseeId : friendship.requesterId;
      const otherStudied = await this.prisma.studyActivity.findUnique({
        where: { studentId_studyDate: { studentId: otherId, studyDate: today } }, select: { id: true },
      });
      if (!otherStudied || friendship.streak?.lastSharedDate?.getTime() === today.getTime()) continue;
      const yesterday = new Date(today); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const current = friendship.streak?.lastSharedDate?.getTime() === yesterday.getTime()
        ? (friendship.streak.currentStreak + 1) : 1;
      await this.prisma.friendStudyStreak.upsert({
        where: { friendshipId: friendship.id },
        update: { currentStreak: current, longestStreak: Math.max(current, friendship.streak?.longestStreak ?? 0), lastSharedDate: today },
        create: { friendshipId: friendship.id, currentStreak: current, longestStreak: current, lastSharedDate: today },
      });
      await Promise.all([this.award(studentId, 'friend_streak', current), this.award(otherId, 'friend_streak', current)]);
    }
    return this.summary(user);
  }

  private async award(studentId: string, category: string, progress: number) {
    const definitions = await this.prisma.rewardDefinition.findMany({ where: { category, threshold: { lte: progress } } });
    for (const reward of definitions) {
      const exists = await this.prisma.studentReward.findUnique({ where: { studentId_rewardId: { studentId, rewardId: reward.id } } });
      if (!exists) await this.prisma.$transaction([
        this.prisma.studentReward.create({ data: { studentId, rewardId: reward.id } }),
        this.prisma.studentProfile.update({ where: { id: studentId }, data: { rewardPoints: { increment: reward.points } } }),
      ]);
    }
  }

  private async requireFriendship(id: string, studentId: string) {
    const friendship = await this.prisma.friendship.findFirst({
      where: { id, status: FriendshipStatus.ACCEPTED, OR: [{ requesterId: studentId }, { addresseeId: studentId }] },
    });
    if (!friendship) throw new ForbiddenException('This conversation is not available');
    return friendship;
  }

  private studentId(user: AuthenticatedUser): string {
    if (!user.studentProfileId) throw new ForbiddenException('Student account required');
    return user.studentProfileId;
  }

  private today(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private person(profile: { id: string; firstName: string; surname: string; user: { email: string } }) {
    return { id: profile.id, firstName: profile.firstName, surname: profile.surname, email: profile.user.email };
  }
}

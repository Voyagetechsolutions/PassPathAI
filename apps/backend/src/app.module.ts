import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DbRetryInterceptor } from './common/interceptors/db-retry.interceptor';
import configuration, { AppConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { FirebaseModule } from './infra/firebase/firebase.module';
import { StorageModule } from './infra/storage/storage.module';
import { OpenAiModule } from './infra/openai/openai.module';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { FirebaseAuthGuard } from './modules/auth/guards/firebase-auth.guard';
import { HealthModule } from './modules/health/health.module';
import { ProfileModule } from './modules/profile/profile.module';
import { CurriculumModule } from './modules/curriculum/curriculum.module';
import { AiModule } from './modules/ai/ai.module';
import { WeaknessModule } from './modules/weakness/weakness.module';
import { DiagnosticModule } from './modules/diagnostic/diagnostic.module';
import { QuestionGenerationModule } from './modules/question-generation/question-generation.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { PracticeModule } from './modules/practice/practice.module';
import { TutorModule } from './modules/tutor/tutor.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { RoadmapModule } from './modules/roadmap/roadmap.module';
import { ExamModule } from './modules/exam/exam.module';
import { CountdownModule } from './modules/countdown/countdown.module';
import { CareerModule } from './modules/career/career.module';
import { ParentModule } from './modules/parent/parent.module';
import { AdminModule } from './modules/admin/admin.module';
import { PastPapersModule } from './modules/past-papers/past-papers.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const rl = config.get('rateLimit', { infer: true });
        return { throttlers: [{ ttl: rl.ttl * 1000, limit: rl.limit }] };
      },
    }),
    // Infrastructure (global)
    PrismaModule,
    RedisModule,
    FirebaseModule,
    StorageModule,
    OpenAiModule,
    // Domain modules
    AuthModule,
    HealthModule,
    ProfileModule,
    CurriculumModule,
    AiModule,
    WeaknessModule,
    DiagnosticModule,
    QuestionGenerationModule,
    LessonsModule,
    PracticeModule,
    TutorModule,
    CalendarModule,
    DashboardModule,
    RoadmapModule,
    ExamModule,
    CountdownModule,
    CareerModule,
    ParentModule,
    AdminModule,
    PastPapersModule,
    SubscriptionModule,
  ],
  providers: [
    // Retry transient DB-wake failures before anything else runs.
    { provide: APP_INTERCEPTOR, useClass: DbRetryInterceptor },
    // Order matters: authentication → rate limit → RBAC.
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

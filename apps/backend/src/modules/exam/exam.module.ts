import { Module } from '@nestjs/common';
import { WeaknessModule } from '../weakness/weakness.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { ExamController } from './exam.controller';
import { ExamService } from './exam.service';

@Module({
  imports: [WeaknessModule, SubscriptionModule],
  controllers: [ExamController],
  providers: [ExamService],
  exports: [ExamService],
})
export class ExamModule {}

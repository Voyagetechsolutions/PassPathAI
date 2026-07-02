import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { WeaknessModule } from '../weakness/weakness.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { TutorController } from './tutor.controller';
import { TutorService } from './tutor.service';

@Module({
  imports: [AiModule, WeaknessModule, SubscriptionModule],
  controllers: [TutorController],
  providers: [TutorService],
})
export class TutorModule {}

import { Module } from '@nestjs/common';
import { WeaknessModule } from '../weakness/weakness.module';
import { QuestionGenerationModule } from '../question-generation/question-generation.module';
import { PracticeController } from './practice.controller';
import { PracticeService } from './practice.service';

@Module({
  imports: [WeaknessModule, QuestionGenerationModule],
  controllers: [PracticeController],
  providers: [PracticeService],
})
export class PracticeModule {}

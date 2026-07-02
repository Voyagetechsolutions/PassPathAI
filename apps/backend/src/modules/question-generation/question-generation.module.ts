import { Module } from '@nestjs/common';
import { QuestionGenerationController } from './question-generation.controller';
import { QuestionGenerationService } from './question-generation.service';

@Module({
  controllers: [QuestionGenerationController],
  providers: [QuestionGenerationService],
  exports: [QuestionGenerationService],
})
export class QuestionGenerationModule {}

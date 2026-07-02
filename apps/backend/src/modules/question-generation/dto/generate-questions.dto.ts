import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Difficulty, QuestionType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GenerateQuestionsDto {
  @ApiProperty({ description: 'Topic to generate questions for' })
  @IsString()
  topicId!: string;

  @ApiProperty({ enum: QuestionType })
  @IsEnum(QuestionType)
  type!: QuestionType;

  @ApiProperty({ enum: Difficulty })
  @IsEnum(Difficulty)
  difficulty!: Difficulty;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 10, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  count?: number;
}

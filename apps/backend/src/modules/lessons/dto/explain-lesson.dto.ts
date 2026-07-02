import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsIn, IsString } from 'class-validator';
import { LessonStatus } from '@prisma/client';

export const EXPLAIN_STYLES = ['struggling', 'simple', 'analogy', 'visual', 'advanced'] as const;

export class ExplainLessonDto {
  @ApiProperty({ enum: EXPLAIN_STYLES })
  @IsString()
  @IsIn(EXPLAIN_STYLES as unknown as string[])
  style!: string;
}

export class SetLessonStatusDto {
  @ApiProperty({ enum: LessonStatus })
  @IsEnum(LessonStatus)
  status!: LessonStatus;
}

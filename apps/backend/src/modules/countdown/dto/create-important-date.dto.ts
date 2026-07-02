import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ImportantDateType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateImportantDateDto {
  @ApiProperty({ enum: ImportantDateType })
  @IsEnum(ImportantDateType)
  type!: ImportantDateType;

  @ApiProperty({ example: 'Mathematics Paper 1' })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty({ example: '2026-11-04T09:00:00.000Z' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ description: 'Scope to a subject (for SUBJECT_EXAM)' })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ example: 12, minimum: 8, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(12)
  grade?: number;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateExamDateDto {
  @ApiProperty({ example: 'Mathematics Paper 1' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  title!: string;

  @ApiProperty({ example: '2026-11-04', description: 'Exam date (ISO yyyy-mm-dd)' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ description: 'Optional subject this exam is for' })
  @IsOptional()
  @IsString()
  subjectId?: string;
}

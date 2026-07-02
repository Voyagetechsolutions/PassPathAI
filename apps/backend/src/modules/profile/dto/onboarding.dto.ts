import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Syllabus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SubjectMarkInput {
  @ApiProperty({ example: 'Mathematics' })
  @IsString()
  @MinLength(1)
  subjectName!: string;

  @ApiProperty({ example: 72, minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  mark!: number;
}

export class OnboardingDto {
  @ApiPropertyOptional({ example: 10, minimum: 8, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(12)
  grade?: number;

  @ApiProperty({ enum: Syllabus, example: Syllabus.CAPS })
  @IsEnum(Syllabus)
  syllabus!: Syllabus;

  @ApiProperty({ type: [SubjectMarkInput] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubjectMarkInput)
  subjects!: SubjectMarkInput[];
}

export class SetMarksDto {
  @ApiProperty({ type: [SubjectMarkInput] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubjectMarkInput)
  subjects!: SubjectMarkInput[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ImportSubtopicDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  orderIndex?: number;
}

export class ImportTopicDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  orderIndex?: number;

  @ApiPropertyOptional({ description: 'Relative importance 0–1 for roadmap prioritisation' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  importance?: number;

  @ApiPropertyOptional({ type: [ImportSubtopicDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportSubtopicDto)
  subtopics?: ImportSubtopicDto[];
}

export class ImportSubjectDto {
  @ApiProperty({ example: 'Mathematics' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 'MATH-G10' })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty({ example: 10, minimum: 8, maximum: 12 })
  @IsInt()
  @Min(8)
  @Max(12)
  grade!: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  weighting?: number;

  @ApiProperty({ type: [ImportTopicDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportTopicDto)
  topics!: ImportTopicDto[];
}

export class ImportCurriculumDto {
  @ApiProperty({ type: [ImportSubjectDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportSubjectDto)
  subjects!: ImportSubjectDto[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SubjectRequirementInput {
  @ApiProperty({ example: 'Mathematics' })
  @IsString()
  @MinLength(1)
  subjectName!: string;

  @ApiProperty({ example: 60, minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  minPercent!: number;
}

export class AdmissionRequirementInput extends SubjectRequirementInput {}

export class ProgrammeInput {
  @ApiProperty({ example: 'University of Cape Town' })
  @IsString()
  university!: string;

  @ApiProperty({ example: 'BSc Civil Engineering' })
  @IsString()
  programmeName!: string;

  @ApiProperty({ example: 42, description: 'Minimum Admission Point Score' })
  @IsInt()
  @Min(0)
  @Max(56)
  minAps!: number;

  @ApiPropertyOptional({ type: [AdmissionRequirementInput] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdmissionRequirementInput)
  requirements?: AdmissionRequirementInput[];
}

export class CreateCareerDto {
  @ApiProperty({ example: 'Civil Engineer' })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiProperty({ example: 'Designs and builds infrastructure.' })
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiPropertyOptional({ type: [SubjectRequirementInput] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubjectRequirementInput)
  subjectRequirements?: SubjectRequirementInput[];

  @ApiPropertyOptional({ type: [ProgrammeInput] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProgrammeInput)
  programmes?: ProgrammeInput[];
}

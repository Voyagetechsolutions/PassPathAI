import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GenerateExamDto {
  @ApiProperty()
  @IsString()
  subjectId!: string;

  @ApiPropertyOptional({ example: 90, minimum: 10, maximum: 240, default: 60 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(240)
  durationMins?: number;

  @ApiPropertyOptional({ example: 15, minimum: 1, maximum: 80, default: 15 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(80)
  questionCount?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isMock?: boolean;
}

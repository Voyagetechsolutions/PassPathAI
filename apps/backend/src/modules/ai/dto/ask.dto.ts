import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class AskDto {
  @ApiProperty({ example: 'Explain how to factorise a difference of two squares.' })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  question!: string;

  @ApiPropertyOptional({ example: 'MATH-G10', description: 'Restrict retrieval to a subject' })
  @IsOptional()
  @IsString()
  subjectCode?: string;

  @ApiPropertyOptional({ example: 10, minimum: 8, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(12)
  grade?: number;
}

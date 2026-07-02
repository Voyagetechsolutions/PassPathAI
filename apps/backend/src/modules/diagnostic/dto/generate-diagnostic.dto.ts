import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GenerateDiagnosticDto {
  @ApiProperty({ description: 'Subject to assess' })
  @IsString()
  subjectId!: string;

  @ApiPropertyOptional({ description: 'Restrict the test to a single topic (topic check)' })
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 50, default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  questionCount?: number;
}

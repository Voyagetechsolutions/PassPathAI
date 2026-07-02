import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class GenerateRoadmapDto {
  @ApiPropertyOptional({ example: 14, minimum: 1, maximum: 90, default: 14 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number;

  @ApiPropertyOptional({ example: 2, minimum: 1, maximum: 6, default: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  dailyMissionCount?: number;
}

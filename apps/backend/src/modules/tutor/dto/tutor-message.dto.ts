import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TutorMessageDto {
  @ApiPropertyOptional({ description: 'The student’s typed message' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @ApiPropertyOptional({ description: 'A starter chip key, e.g. "story" or "eli5"' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  starter?: string;
}

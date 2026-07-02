import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class LessonFeedbackDto {
  @ApiProperty({ description: 'Whether the student found the lesson helpful' })
  @IsBoolean()
  helpful!: boolean;
}

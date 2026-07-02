import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LessonDto {
  @ApiProperty({ description: 'The topic to teach', example: 'ckxyz...' })
  @IsString()
  @MinLength(1)
  topicId!: string;
}

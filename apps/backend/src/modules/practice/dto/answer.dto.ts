import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AnswerDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  questionId!: string;

  @ApiProperty({ description: 'Selected option label, e.g. "A"' })
  @IsString()
  response!: string;
}

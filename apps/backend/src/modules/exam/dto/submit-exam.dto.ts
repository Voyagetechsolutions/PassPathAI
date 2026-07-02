import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsString, ValidateNested } from 'class-validator';

export class ExamResponseInput {
  @ApiProperty()
  @IsString()
  examItemId!: string;

  @ApiProperty({ description: 'Selected option label or free-text answer' })
  @IsString()
  response!: string;
}

export class SubmitExamDto {
  @ApiProperty({ type: [ExamResponseInput] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExamResponseInput)
  responses!: ExamResponseInput[];
}

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsString, ValidateNested } from 'class-validator';

export class DiagnosticAnswerInput {
  @ApiProperty()
  @IsString()
  questionId!: string;

  @ApiProperty({ description: 'Selected option label (e.g. "A") or free-text response' })
  @IsString()
  response!: string;
}

export class SubmitDiagnosticDto {
  @ApiProperty({ type: [DiagnosticAnswerInput] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DiagnosticAnswerInput)
  answers!: DiagnosticAnswerInput[];
}

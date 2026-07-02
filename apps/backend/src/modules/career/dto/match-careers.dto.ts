import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SubjectMarkInput {
  @ApiProperty({ example: 'Mathematics' })
  @IsString()
  @MinLength(1)
  subjectName!: string;

  @ApiProperty({ example: 72, minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  percent!: number;
}

export class MatchCareersDto {
  @ApiProperty({ type: [SubjectMarkInput] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubjectMarkInput)
  marks!: SubjectMarkInput[];
}

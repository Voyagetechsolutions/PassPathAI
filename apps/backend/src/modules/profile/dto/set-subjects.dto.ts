import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsString } from 'class-validator';

export class SetSubjectsDto {
  @ApiProperty({ type: [String], description: 'Subject ids to enrol the student in' })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  subjectIds!: string[];
}

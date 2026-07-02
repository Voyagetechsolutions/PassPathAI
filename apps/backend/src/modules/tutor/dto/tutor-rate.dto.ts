import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class TutorRateDto {
  @ApiProperty({ description: 'The student explaining the whole topic back in their own words' })
  @IsString()
  @MinLength(10)
  explanation!: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateSubjectDto {
  @ApiProperty({ example: 'Physical Sciences' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 'PHSC-G11' })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty({ example: 11, minimum: 8, maximum: 12 })
  @IsInt()
  @Min(8)
  @Max(12)
  grade!: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  weighting?: number;
}

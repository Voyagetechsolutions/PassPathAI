import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

/**
 * Metadata accompanying a past-paper upload (multipart form fields).
 */
export class UploadPastPaperDto {
  @ApiProperty({ example: 'Mathematics Paper 1' })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional({ description: 'Link to a curriculum subject' })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiProperty({ example: 10, minimum: 8, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(8)
  @Max(12)
  grade!: number;

  @ApiProperty({ example: 2024, minimum: 2000, maximum: 2100 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiProperty({ example: 'Paper 1', description: 'Paper 1 / Paper 2 / Memo' })
  @IsString()
  @MinLength(1)
  kind!: string;
}

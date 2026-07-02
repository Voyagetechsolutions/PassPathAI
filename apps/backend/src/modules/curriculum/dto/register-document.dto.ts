import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

/**
 * Metadata accompanying a curriculum document upload (multipart form fields).
 */
export class RegisterDocumentDto {
  @ApiProperty({ example: 'CAPS Mathematics Grade 10' })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional({ example: 'MATH-G10' })
  @IsOptional()
  @IsString()
  subjectCode?: string;

  @ApiPropertyOptional({ example: 10, minimum: 8, maximum: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(8)
  @Max(12)
  grade?: number;
}

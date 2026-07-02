import { ApiPropertyOptional } from '@nestjs/swagger';
import { Province } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Thabo' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Mokoena' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  surname?: string;

  @ApiPropertyOptional({ example: 11, minimum: 8, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(12)
  grade?: number;

  @ApiPropertyOptional({ example: 'Hoërskool Pretoria' })
  @IsOptional()
  @IsString()
  school?: string;

  @ApiPropertyOptional({ enum: Province })
  @IsOptional()
  @IsEnum(Province)
  province?: Province;
}

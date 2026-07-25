import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Province, Role } from '@prisma/client';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

/**
 * Creates a credential and profile directly in the application's PostgreSQL database.
 */
export class RegisterDto {
  @ApiProperty({ example: 'thabo@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: Role, default: Role.student })
  @IsEnum(Role)
  role!: Role;

  @ApiProperty({ example: 'Thabo' })
  @IsString()
  @MinLength(1)
  firstName!: string;

  @ApiProperty({ example: 'Mokoena' })
  @IsString()
  @MinLength(1)
  surname!: string;

  @ApiPropertyOptional({ example: 10, description: 'Required for students (8–12)' })
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

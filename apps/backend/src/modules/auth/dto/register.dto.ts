import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Province, Role } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

/**
 * Registration completes a Firebase sign-up by provisioning the local account.
 * The client first creates the Firebase user (email/password) and passes the
 * resulting ID token in the Authorization header.
 */
export class RegisterDto {
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

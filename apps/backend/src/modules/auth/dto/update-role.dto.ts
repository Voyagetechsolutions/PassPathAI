import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class UpdateRoleDto {
  @ApiProperty({ description: 'Target user id (local PK)' })
  @IsString()
  userId!: string;

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role!: Role;
}

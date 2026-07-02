import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class AuthUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: Role })
  role!: Role;

  @ApiProperty()
  emailVerified!: boolean;

  @ApiPropertyOptional()
  studentProfileId?: string;

  @ApiPropertyOptional()
  parentProfileId?: string;
}

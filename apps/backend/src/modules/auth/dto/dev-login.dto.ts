import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

/**
 * Dev-only demo login. Disabled in production.
 */
export class DevLoginDto {
  @ApiProperty({ example: 'student@demo.passpath.app' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'passpath-demo' })
  @IsString()
  password!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({ description: 'false suspends the account (blocks all access)' })
  @IsBoolean()
  isActive!: boolean;
}

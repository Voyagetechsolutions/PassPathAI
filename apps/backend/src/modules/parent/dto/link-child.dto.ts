import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class LinkChildDto {
  @ApiProperty({ example: 'thabo@example.com', description: 'The child student’s account email' })
  @IsEmail()
  studentEmail!: string;
}

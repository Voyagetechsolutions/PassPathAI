import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpsertAiSettingDto {
  @ApiProperty({ example: 'min_similarity' })
  @IsString()
  @MinLength(1)
  key!: string;

  @ApiProperty({ example: '0.78' })
  @IsString()
  value!: string;
}

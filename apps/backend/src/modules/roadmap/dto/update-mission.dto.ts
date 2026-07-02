import { ApiProperty } from '@nestjs/swagger';
import { MissionStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateMissionDto {
  @ApiProperty({ enum: [MissionStatus.COMPLETED, MissionStatus.SKIPPED] })
  @IsEnum(MissionStatus)
  status!: MissionStatus;
}

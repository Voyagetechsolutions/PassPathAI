import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CheckInDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  minutes?: number;
}

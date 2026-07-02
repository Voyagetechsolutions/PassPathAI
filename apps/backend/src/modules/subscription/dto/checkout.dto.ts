import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CheckoutDto {
  @ApiPropertyOptional({ description: 'Deep link Paystack redirects back to once checkout finishes' })
  @IsOptional()
  @IsString()
  callbackUrl?: string;
}

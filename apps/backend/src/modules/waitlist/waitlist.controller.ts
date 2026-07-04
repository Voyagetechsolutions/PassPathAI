import { Body, Controller, HttpCode, HttpStatus, Logger, Post, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../infra/prisma/prisma.service';

class JoinWaitlistDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(12)
  grade?: number;
}

/**
 * Public early-access waitlist for the marketing site. Duplicate emails are
 * fine — the signup is upserted, so re-submitting never errors at the user.
 */
@ApiTags('waitlist')
@Controller('waitlist')
export class WaitlistController {
  private readonly logger = new Logger(WaitlistController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } }) // 10/hour per IP
  @ApiOperation({ summary: 'Join the early-access waitlist' })
  async join(@Body() dto: JoinWaitlistDto): Promise<{ ok: true }> {
    const email = dto.email.trim().toLowerCase();
    try {
      await this.prisma.waitlistSignup.upsert({
        where: { email },
        create: { email, grade: dto.grade },
        update: { ...(dto.grade ? { grade: dto.grade } : {}) },
      });
    } catch (e) {
      this.logger.error(`Waitlist signup failed: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Could not save your signup — please try again in a minute.');
    }
    return { ok: true };
  }
}

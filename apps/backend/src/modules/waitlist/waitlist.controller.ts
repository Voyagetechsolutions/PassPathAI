import { Body, Controller, HttpCode, HttpStatus, Logger, Post, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';

class JoinWaitlistDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } }) // 10/hour per IP
  @ApiOperation({ summary: 'Join the early-access waitlist' })
  async join(@Body() dto: JoinWaitlistDto): Promise<{ ok: true }> {
    const email = dto.email.trim().toLowerCase();
    const name = dto.name.trim();

    try {
      await this.prisma.waitlistSignup.upsert({
        where: { email },
        create: { email, name, grade: dto.grade },
        update: { name, ...(dto.grade ? { grade: dto.grade } : {}) },
      });
      return { ok: true };
    } catch (e) {
      // A real person just handed us their details from a poster or an ad —
      // losing that is unacceptable. If the table is unavailable (e.g. the
      // database is at its storage cap), fall back to object storage so the
      // lead is still captured and can be imported later.
      this.logger.error(`Waitlist DB write failed, falling back to storage: ${(e as Error).message}`);
      await this.captureToStorage({ name, email, grade: dto.grade });
      return { ok: true };
    }
  }

  /** Fail-safe capture: one small JSON object per signup in the bucket. */
  private async captureToStorage(signup: { name: string; email: string; grade?: number }): Promise<void> {
    const safeEmail = signup.email.replace(/[^a-z0-9]+/gi, '_');
    const key = `waitlist/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${safeEmail}.json`;
    try {
      await this.storage.put(
        key,
        Buffer.from(JSON.stringify({ ...signup, capturedAt: new Date().toISOString() }, null, 2), 'utf8'),
        'application/json',
      );
      this.logger.warn(`Waitlist signup captured to storage: ${key}`);
    } catch (e) {
      // Both paths failed — surface it so the visitor can retry rather than
      // believing they signed up when nothing was recorded.
      this.logger.error(`Waitlist storage fallback ALSO failed: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Could not save your signup — please try again in a minute.');
    }
  }
}

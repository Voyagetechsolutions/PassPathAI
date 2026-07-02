import { plainToInstance } from 'class-transformer';
import { IsNumberString, IsOptional, IsString, validateSync } from 'class-validator';

/**
 * Fail-fast validation of the environment at boot. Only variables that the app
 * cannot start without are marked required.
 */
class EnvironmentVariables {
  @IsString()
  DATABASE_URL!: string;

  @IsOptional()
  @IsNumberString()
  PORT?: string;

  @IsOptional()
  @IsString()
  NODE_ENV?: string;

  // Redis is an optional cache — the app degrades gracefully without it
  // (RedisService already tolerates a missing server), so deployments that
  // don't provision Redis must still boot.
  @IsOptional()
  @IsString()
  REDIS_HOST?: string;

  @IsOptional()
  @IsNumberString()
  REDIS_PORT?: string;
}

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${errors
        .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
        .join('\n')}`,
    );
  }
  return config;
}

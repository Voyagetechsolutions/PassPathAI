import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '../../config/configuration';

interface AccessTokenPayload { sub: string; iat: number; exp: number }

@Injectable()
export class TokenService {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  sign(userId: string): string {
    const now = Math.floor(Date.now() / 1000);
    const ttl = this.config.get('auth.tokenTtlSeconds', { infer: true });
    const header = this.encode({ alg: 'HS256', typ: 'JWT' });
    const payload = this.encode({ sub: userId, iat: now, exp: now + ttl });
    const data = `${header}.${payload}`;
    return `${data}.${this.signature(data)}`;
  }

  verify(token: string): AccessTokenPayload {
    const [header, payload, supplied] = token.split('.');
    if (!header || !payload || !supplied) throw new UnauthorizedException('Invalid or expired token');
    const expected = Buffer.from(this.signature(`${header}.${payload}`));
    const actual = Buffer.from(supplied);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    try {
      const parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString()) as { alg?: string };
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as AccessTokenPayload;
      if (parsedHeader.alg !== 'HS256' || !claims.sub || claims.exp <= Math.floor(Date.now() / 1000)) {
        throw new Error('invalid claims');
      }
      return claims;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private encode(value: object): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private signature(data: string): string {
    const secret = this.config.get('auth.tokenSecret', { infer: true });
    return createHmac('sha256', secret).update(data).digest('base64url');
  }
}

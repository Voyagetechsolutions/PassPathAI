import 'reflect-metadata';
import { join } from 'node:path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  // rawBody: true keeps the exact request bytes on req.rawBody, needed to verify
  // the Paystack webhook HMAC signature (a re-serialized JSON body wouldn't match).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false, rawBody: true });
  const config = app.get(ConfigService<AppConfig, true>);

  const apiPrefix = config.get('apiPrefix', { infer: true });
  const port = config.get('port', { infer: true });
  const corsOrigins = config.get('corsOrigins', { infer: true });

  app.setGlobalPrefix(apiPrefix);
  // Extend the default CSP so the static admin page can call Firebase Auth
  // (email/password sign-in) directly from the browser.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'connect-src': [
            "'self'",
            'https://identitytoolkit.googleapis.com',
            'https://securetoken.googleapis.com',
          ],
        },
      },
    }),
  );
  // One deployment, one domain: the marketing site (public/) is served at /,
  // the API stays under /api. Registered after helmet so pages get its headers.
  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PassPath API')
    .setDescription('Curriculum-aligned exam-preparation platform')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port, '0.0.0.0');
  Logger.log(`PassPath API on http://localhost:${port}/${apiPrefix} (docs: /docs)`, 'Bootstrap');
}

void bootstrap();

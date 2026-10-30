import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { API_PREFIX, configureApp, setupSwagger } from './app.setup';
import { mountWebClient } from './infrastructure/web-client/web-client';

async function bootstrap(): Promise<void> {
  // rawBody keeps the exact request bytes available for webhook signature verification.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  configureApp(app);
  setupSwagger(app);
  await mountWebClient(app);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(
    `Listening on http://localhost:${port} (web client at /, API at /${API_PREFIX}, docs at /${API_PREFIX}/docs)`,
    'Bootstrap',
  );
}

void bootstrap();

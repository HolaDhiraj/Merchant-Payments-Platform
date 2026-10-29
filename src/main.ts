import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './app.setup';

async function bootstrap(): Promise<void> {
  // rawBody keeps the exact request bytes available for webhook signature verification.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureApp(app);
  setupSwagger(app);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(`API listening on port ${port}, docs at /docs`, 'Bootstrap');
}

void bootstrap();

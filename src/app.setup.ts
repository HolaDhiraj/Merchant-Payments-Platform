import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './shared/presentation/filters/global-exception.filter';
import { RequestLoggingInterceptor } from './shared/presentation/interceptors/request-logging.interceptor';

// Applies the global HTTP pipeline. Shared by main.ts and the integration tests,
// so tests exercise exactly the same validation, error handling and security headers.
export function configureApp(app: INestApplication): void {
  app.use(helmet());
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      // Unknown properties are rejected, which blocks mass assignment (e.g. sending "status").
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());
}

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Merchant Payments Platform API')
    .setDescription(
      'Merchant onboarding with asynchronous risk review, role/object-level authorization and an audit trail.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}

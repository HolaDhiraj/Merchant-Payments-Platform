import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './shared/presentation/filters/global-exception.filter';
import { RequestLoggingInterceptor } from './shared/presentation/interceptors/request-logging.interceptor';

// Every HTTP API route lives under this prefix; everything else is served by the web client.
export const API_PREFIX = 'api';

// Applies the global HTTP pipeline. Shared by main.ts and the integration tests,
// so tests exercise exactly the same validation, error handling and security headers.
export function configureApp(app: INestApplication): void {
  app.use(helmet({ contentSecurityPolicy: { directives: contentSecurityDirectives() } }));
  app.enableShutdownHooks();
  app.setGlobalPrefix(API_PREFIX);

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
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, SwaggerModule.createDocument(app, config));
}

// Helmet's strict defaults, plus the one relaxation the Vite dev server needs: its React
// refresh preamble is an inline script. Production bundles only load scripts from 'self'.
function contentSecurityDirectives(): Record<string, string[]> {
  const isDevelopment = (process.env.NODE_ENV ?? 'development') === 'development';
  return {
    scriptSrc: isDevelopment ? ["'self'", "'unsafe-inline'"] : ["'self'"],
  };
}

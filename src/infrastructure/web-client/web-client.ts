import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import type { Plugin, ViteDevServer } from 'vite';
import { API_PREFIX } from '../../app.setup';

// Serves the React web client from the same HTTP server (and port) as the API.
//  - development: Vite runs in middleware mode, sharing the server for hot module reload.
//  - production:  the pre-built bundle in dist/client is served as static files.
// Anything under /api is left to Nest, so API routes and their 404s behave exactly as before.

const CLIENT_SOURCE_DIR = join(process.cwd(), 'client');
const CLIENT_BUILD_DIR = join(process.cwd(), 'dist', 'client');

const logger = new Logger('WebClient');

export async function mountWebClient(app: NestExpressApplication): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    mountStaticBuild(app);
  } else {
    await mountViteDevServer(app);
  }
}

function mountStaticBuild(app: NestExpressApplication): void {
  const indexHtml = join(CLIENT_BUILD_DIR, 'index.html');
  if (!existsSync(indexHtml)) {
    logger.warn(`No client build at ${CLIENT_BUILD_DIR}; serving the API only`);
    return;
  }

  // Hashed assets can be cached forever; index.html must always be revalidated.
  app.useStaticAssets(CLIENT_BUILD_DIR, { index: false, immutable: true, maxAge: '1y' });
  app.use(
    unlessApi((req, res, next) => {
      if (!acceptsHtml(req)) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    }),
  );
  logger.log('Serving pre-built web client');
}

async function mountViteDevServer(app: NestExpressApplication): Promise<void> {
  if (!existsSync(join(CLIENT_SOURCE_DIR, 'index.html'))) {
    logger.warn('No client sources found; serving the API only');
    return;
  }

  const httpServer = app.getHttpServer() as Server;
  const vite = await createViteServer(httpServer);
  app.use(unlessApi(vite.middlewares));
  app.use(
    unlessApi(async (req, res, next) => {
      if (!acceptsHtml(req)) return next();
      try {
        const template = readFileSync(join(CLIENT_SOURCE_DIR, 'index.html'), 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).setHeader('Content-Type', 'text/html').end(html);
      } catch (error) {
        vite.ssrFixStacktrace(error as Error);
        next(error);
      }
    }),
  );
  // Stops Vite's file watcher together with the API on shutdown or watch-mode restarts.
  httpServer.once('close', () => void vite.close());
  logger.log('Vite dev server attached (hot reload enabled)');
}

// Vite is ESM-only and a dev dependency, so it is loaded lazily and never in production.
// The Function wrapper stops TypeScript from compiling import() down to require().
async function createViteServer(httpServer: Server): Promise<ViteDevServer> {
  const importEsm = new Function('specifier', 'return import(specifier)') as (
    specifier: string,
  ) => Promise<typeof import('vite')>;
  const { createServer } = await importEsm('vite');
  return createServer({
    configFile: join(CLIENT_SOURCE_DIR, 'vite.config.mts'),
    appType: 'custom',
    server: { middlewareMode: true, hmr: { server: httpServer } },
    plugins: [survivesWatcherErrors()],
  });
}

// An unhandled watcher error would crash the whole API, e.g. ENOSPC when the machine runs out
// of inotify watches (IDEs use many). Losing hot reload is acceptable; losing the server is not.
// The handler is attached in configureServer, which runs as soon as the watcher exists.
function survivesWatcherErrors(): Plugin {
  return {
    name: 'merchant-desk:survive-watcher-errors',
    configureServer(server) {
      server.watcher.on('error', (error) => {
        const code = (error as NodeJS.ErrnoException).code;
        const hint =
          code === 'ENOSPC'
            ? ' The system file-watcher limit is reached; raise fs.inotify.max_user_watches (see README).'
            : '';
        logger.warn(`Client file watching failed, hot reload may miss changes: ${String(error)}.${hint}`);
      });
    },
  };
}

type Middleware = (req: Request, res: Response, next: NextFunction) => void;

function unlessApi(middleware: Middleware): Middleware {
  const apiPath = `/${API_PREFIX}`;
  return (req, res, next) => {
    const isApi = req.path === apiPath || req.path.startsWith(`${apiPath}/`);
    return isApi ? next() : middleware(req, res, next);
  };
}

function acceptsHtml(req: Request): boolean {
  return req.method === 'GET' && (req.headers.accept ?? '').includes('text/html');
}

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The client has no dev server of its own: in development the NestJS app mounts Vite as
// middleware, and `npm run build` writes the bundle to dist/client for Nest to serve.
const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(root, 'src') },
  },
  build: {
    outDir: resolve(root, '../dist/client'),
    emptyOutDir: true,
    sourcemap: true,
  },
});

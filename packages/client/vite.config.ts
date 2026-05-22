import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { chatApiPlugin } from './vite-plugin-chat-api.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.resolve(dir, '../..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootEnv, '');
  const base = env.VITE_BASE_PATH || '/';

  return {
    base,
    root: dir,
    envDir: rootEnv,
    resolve: {
      alias: {
        '@tokemons/kernel': path.resolve(dir, '../kernel/src/index.ts'),
        '@tokemons/tokemon-gen': path.resolve(dir, '../tokemon-gen/src/index.ts'),
      },
    },
    plugins: [chatApiPlugin(env.OPENROUTER_API_KEY)],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: true,
    },
    server: {
      port: 5173,
    },
  };
});

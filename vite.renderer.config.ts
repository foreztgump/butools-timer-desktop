import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig((env) => {
  const { mode } = env;

  return {
    root: path.resolve(__dirname),
    build: {
      outDir: path.resolve(__dirname, '.vite/renderer/main_window'),
      emptyOutDir: true,
      sourcemap: true,
    },
    plugins: [
      react(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
}); 
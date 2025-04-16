import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig((env) => {
  const { mode } = env;

  return {
    build: {
      rollupOptions: {
        external: [
          'electron',
        ],
      },
    },
  };
}); 
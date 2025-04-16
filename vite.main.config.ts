import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig((env) => {
  const { mode } = env;

  return {
    // Explicitly configure build options for main process
    build: {
      // Ensure Node.js built-ins are handled correctly
      commonjsOptions: {
        ignoreTryCatch: false, // Recommended for Electron
        // Setting nodeIntegration might help preserve require behavior for build
        // but doesn't affect the final renderer security.
        nodeIntegration: true, 
      },
      // Keep rollupOptions commented out unless needed later
      // rollupOptions: {
      //   external: [], 
      // },
    },
    resolve: {
      // Some libs that can run in both Web and Node.js, such as `axios`, we need to tell Vite to build them in Node.js.
      browserField: false,
      mainFields: ['module', 'jsnext:main', 'jsnext'],
    },
  };
}); 
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  define: {
    // ES11 build - BUILD_TARGET_ES6 is undefined, so it will use ES11 implementation
    'BUILD_TARGET_ES6': 'false',
  },
  build: {
    target: 'es2020',
    lib: {
      entry: resolve(__dirname, '../../eka-sdk/ekascribe-v2rx/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    outDir: 'dist',
    rollupOptions: {
      output: {
        assetFileNames: '[name][extname]',
        chunkFileNames: '[name].js',
      },
    },
  },
  worker: {
    format: 'iife',
    rollupOptions: {
      output: {
        entryFileNames: 'worker.bundle.js',
      },
    },
  },
  plugins: [
    dts({
      rollupTypes: true,
      outDir: 'dist',
    }),
  ],
});

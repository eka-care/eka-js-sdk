import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import babel from 'vite-plugin-babel';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  build: {
    target: 'es2015',
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
    babel({
      babelConfig: {
        presets: [
          [
            '@babel/preset-env',
            {
              targets: {
                browsers: ['> 0.5%', 'last 2 versions', 'not dead', 'not IE 11'],
              },
              useBuiltIns: 'usage',
              corejs: {
                version: 3,
                proposals: true,
              },
              modules: false,
            },
          ],
        ],
      },
    }),
    dts({
      rollupTypes: true,
      outDir: 'dist',
    }),
  ],
});

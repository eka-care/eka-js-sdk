import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: false, // Don't clear dist folder (main build already created it)
    lib: {
      entry: resolve(__dirname, '../../eka-sdk/ekascribe-v2rx/shared-worker/s3-file-upload.ts'),
      formats: ['iife'],
      name: 'EkaS3Worker',
      fileName: () => 'worker.bundle.js', // Force exact filename
    },
    rollupOptions: {
      output: {
        format: 'iife',
        entryFileNames: 'worker.bundle.js',
      },
    },
  },
});

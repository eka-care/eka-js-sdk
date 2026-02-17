import * as esbuild from 'esbuild';

const sharedConfig = {
  entryPoints: ['../../eka-sdk/ekascribe-v2rx/index.ts'],
  bundle: true,
  platform: 'browser',
  target: ['es6'],
  sourcemap: true,
  minify: true,
  treeShaking: true,
  drop: ['console', 'debugger'],
  define: {
    'global': 'globalThis',
    'process.env.NODE_ENV': '"production"',
    'process.env.NODE_DEBUG': 'false',
    'process': '{"env": {}}',
  },
  banner: {
    js: `
      if (typeof globalThis === 'undefined') {
        var globalThis = typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {};
      }
    `,
  },
};

// CommonJS build
await esbuild.build({
  ...sharedConfig,
  outfile: 'dist/index.js',
  format: 'cjs',
});

// ESM build
await esbuild.build({
  ...sharedConfig,
  outfile: 'dist/index.esm.js',
  format: 'esm',
});

// SharedWorker build (IIFE format, matching ES11 worker bundle)
await esbuild.build({
  entryPoints: ['../../eka-sdk/ekascribe-v2rx/shared-worker/s3-file-upload.ts'],
  bundle: true,
  platform: 'browser',
  target: ['es6'],
  minify: true,
  treeShaking: true,
  drop: ['console', 'debugger'],
  format: 'iife',
  globalName: 'EkaS3Worker',
  outfile: 'dist/worker.bundle.js',
  define: {
    'global': 'globalThis',
    'process.env.NODE_ENV': '"production"',
    'process.env.NODE_DEBUG': 'false',
    'process': '{"env": {}}',
  },
  banner: {
    js: `
      if (typeof globalThis === 'undefined') {
        var globalThis = typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {};
      }
    `,
  },
});

console.log('Build complete!');

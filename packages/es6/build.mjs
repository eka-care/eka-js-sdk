import * as esbuild from 'esbuild';

const sharedConfig = {
  entryPoints: ['./entry.ts'],
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

console.log('Build complete!');

import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['eka-sdk/ekascribe-v2rx/shared-worker/s3-file-upload.ts'],
  bundle: true,
  outfile: 'dist/shared-worker/s3-file-upload.js',
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  minify: true,
  sourcemap: false,
});

console.log('SharedWorker bundled successfully!');

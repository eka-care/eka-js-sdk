import { defineConfig } from 'vite';
import fs from 'fs';
import { resolve } from 'path';

// Dev server for the HTML files in example/ which import the SDK source directly.
// Serves over HTTPS on https://sanika.eka.care so secure-context APIs
// (getUserMedia / SharedWorker) and prod-like cookies behave correctly.
export default defineConfig({
  root: resolve(__dirname),
  server: {
    host: 'sanika.eka.care',
    port: 443,
    allowedHosts: ['sanika.eka.care'],
    https: {
      key: fs.readFileSync('./certificates/sanika.eka.care-key.pem'),
      cert: fs.readFileSync('./certificates/sanika.eka.care.pem'),
    },
  },
});

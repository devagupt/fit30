import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const keyPath = process.env.FIT30_HTTPS_KEY;
const certPath = process.env.FIT30_HTTPS_CERT;
if (Boolean(keyPath) !== Boolean(certPath)) {
  throw new Error('Set both FIT30_HTTPS_KEY and FIT30_HTTPS_CERT for HTTPS preview.');
}

export default defineConfig({
  plugins: [react()],
  server: { strictPort: true },
  preview: {
    strictPort: true,
    https: keyPath && certPath ? { key: readFileSync(keyPath), cert: readFileSync(certPath) } : undefined,
  },
  test: { include: ['src/**/*.test.{ts,tsx}'] },
});

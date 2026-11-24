import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import path from 'path';

export default defineConfig({
  plugins: [react(), wasm()],
  resolve: {
    dedupe: ['@midnight-ntwrk/compact-runtime', '@midnight-ntwrk/onchain-runtime-v4'],
    alias: {
      '@assize/crypto': path.resolve(__dirname, 'src/generated/crypto.ts'),
      '@assize/contract': path.resolve(__dirname, 'src/generated/contract/index.js'),
      '@midnight-ntwrk/compact-runtime': path.resolve(
        __dirname,
        'node_modules/@midnight-ntwrk/compact-runtime'
      ),
      '@midnight-ntwrk/onchain-runtime-v4': path.resolve(
        __dirname,
        'node_modules/@midnight-ntwrk/onchain-runtime-v4'
      ),
    },
  },
  optimizeDeps: {
    exclude: ['@midnight-ntwrk/compact-runtime', '@midnight-ntwrk/onchain-runtime-v4'],
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
  build: {
    target: 'esnext',
  },
});

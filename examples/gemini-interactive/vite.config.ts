import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: '.',
  server: {
    port: 3000,
    open: true
  },
  resolve: {
    alias: {
      'web-agent-sdk': path.resolve(__dirname, '../../src/index.ts'),
      'zod': path.resolve(__dirname, 'node_modules/zod'),
      '@langchain/google-genai': path.resolve(__dirname, 'node_modules/@langchain/google-genai'),
      '@langchain/core': path.resolve(__dirname, 'node_modules/@langchain/core'),
    }
  },
  // Ensure vite doesn't try to optimize deps from outside root weirdly
  optimizeDeps: {
    include: ['zod', '@langchain/google-genai', '@langchain/core']
  }
});

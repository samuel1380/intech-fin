import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';
export default defineConfig({
  server: { port: 3000, host: '127.0.0.1' },
  preview: { port: 3000, host: '127.0.0.1' },
  plugins: [react()],
  resolve: { alias: { '@': path.resolve('.') } },
});

import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';
export default defineConfig({
  server: { port: 3000, host: '0.0.0.0' },
  preview: { port: Number(process.env.PORT) || 3000, host: '0.0.0.0', allowedHosts: ['intech-fin.onrender.com'] },
  plugins: [react()],
  resolve: { alias: { '@': path.resolve('.') } },
});

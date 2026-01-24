import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      preview: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: ['intech-fin.onrender.com']
      },
      plugins: [react()],
      define: {
        'process.env.AI_BASE_URL': JSON.stringify(env.AI_BASE_URL),
        'process.env.AI_MODEL': JSON.stringify(env.AI_MODEL),
        'process.env.AI_PROVIDER': JSON.stringify(env.AI_PROVIDER),
        'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY),
        'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
        'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

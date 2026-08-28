import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname), '');

  if (mode === 'production') {
    if (!env.VITE_PSP_PUBLIC_KEY?.trim()) {
      throw new Error(
        'VITE_PSP_PUBLIC_KEY is required for production builds (set in CI / .env)',
      );
    }
    if (!env.VITE_PSP_TOKENIZATION_URL?.trim()) {
      throw new Error(
        'VITE_PSP_TOKENIZATION_URL is required for production builds (set in CI / .env)',
      );
    }
    if (!env.VITE_API_TOKEN?.trim()) {
      throw new Error(
        'VITE_API_TOKEN is required for production builds (set in CI / .env)',
      );
    }
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    define: {
      'process.env.VITE_API_BASE_URL': JSON.stringify(
        env.VITE_API_BASE_URL ?? '/api',
      ),
      'process.env.VITE_API_TOKEN': JSON.stringify(env.VITE_API_TOKEN ?? ''),
      'process.env.VITE_PSP_PUBLIC_KEY': JSON.stringify(
        env.VITE_PSP_PUBLIC_KEY ?? '',
      ),
      'process.env.VITE_PSP_TOKENIZATION_URL': JSON.stringify(
        env.VITE_PSP_TOKENIZATION_URL ?? '',
      ),
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            redux: ['@reduxjs/toolkit', 'react-redux'],
          },
        },
      },
    },
  };
});

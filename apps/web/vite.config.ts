import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_BFF_PROXY_TARGET ?? 'http://127.0.0.1:8787',
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@wos/domain': path.resolve(__dirname, '../../packages/domain/src/index.ts')
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('react-konva') || id.includes('konva')) {
            return 'editor-canvas';
          }

          if (id.includes('@supabase/supabase-js') || id.includes('@tanstack/react-query')) {
            return 'supabase-query';
          }

          if (id.includes('react-router-dom') || id.includes('react-dom') || id.includes('/react/')) {
            return 'react-vendor';
          }

          if (id.includes('lucide-react')) {
            return 'icons';
          }

          return undefined;
        }
      }
    }
  },
  test: {
    environment: 'node',
    environmentMatchGlobs: [['src/**/*.test.tsx', 'jsdom']],
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test/setup-env.ts']
  }
});

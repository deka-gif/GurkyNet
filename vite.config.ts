import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          // Do NOT force lucide-react into one chunk — that disabled tree-shaking
          // and modulepreloaded ~830KB of unused icons on /login (perf audit 2026-09-14).
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            recharts: ['recharts'],
            motion: ['motion'],
          },
        },
      },
    },
  };
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Root defaults to process.cwd() (project root), so outDir 'dist' lands at
// /project-root/dist/ — exactly where the deployment platform expects it.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'client/dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: false,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3002',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});

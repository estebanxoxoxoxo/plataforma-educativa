import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // /api → backend (server/src/index.ts)
  server: { proxy: { '/api': 'http://localhost:8787' } },
});

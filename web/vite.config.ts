import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Encaminha chamadas /api para a API (evita problemas de CORS no dev).
    proxy: {
      '/api': 'http://localhost:3333',
    },
  },
});

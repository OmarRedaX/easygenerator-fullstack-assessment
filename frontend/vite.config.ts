import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// The browser only ever talks to /api on its own origin. In development this proxy plays the role of the
// production reverse proxy: it keeps the /api prefix (no rewrite) and forwards the Origin header untouched
// (no changeOrigin), which the backend's CSRF guard compares with CORS_ORIGIN.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.API_PROXY_TARGET ?? 'http://localhost:3000';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // The origin is a security setting (CORS_ORIGIN): never silently move to another port.
      strictPort: true,
      proxy: { '/api': { target: apiTarget } },
    },
    test: {
      environment: 'jsdom',
      globals: false,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        include: ['src/lib/**', 'src/features/**'],
        exclude: ['**/*.test.{ts,tsx}'],
        thresholds: { lines: 80 },
      },
    },
  };
});

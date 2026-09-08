import { defineConfig } from 'vite';

// Static HTML stays the production format. Vite is only the local preview server.
export default defineConfig({
  publicDir: false,
  server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] },
});

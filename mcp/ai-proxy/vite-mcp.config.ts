// Vite config for MCP server (extends main config with @/ alias + Vite globals)
import { defineConfig } from 'vite';
import path from 'path';
import pkg from '../../package.json';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_NAME__: JSON.stringify(pkg.name),
    __APP_DESCRIPTION__: JSON.stringify(pkg.description),
    __APP_AUTHOR__: JSON.stringify(pkg.author),
    __APP_LICENSE__: JSON.stringify(pkg.license),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});

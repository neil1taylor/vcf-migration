// Vite config for preview scripts (extends main config with chart mock)
import { defineConfig, type Plugin } from 'vite';
import path from 'path';
import pkg from '../package.json';

const MOCK_CHARTS_PATH = path.resolve(__dirname, 'mock-charts.ts');
const MOCK_TITLE_SLIDE_PATH = path.resolve(__dirname, 'mock-titleSlide.ts');

function mockChartsPlugin(): Plugin {
  return {
    name: 'mock-charts',
    enforce: 'pre',
    resolveId(source, importer) {
      // Intercept any import of the charts module (DOCX)
      if (source.endsWith('/utils/charts') && importer?.includes('export/docx')) {
        return MOCK_CHARTS_PATH;
      }
      // Intercept title slide import (PPTX) — avoids window.location HTTP fetch
      if (
        (source === './titleSlide' || source.endsWith('/titleSlide')) &&
        importer?.includes('export/pptx')
      ) {
        return MOCK_TITLE_SLIDE_PATH;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [mockChartsPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
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

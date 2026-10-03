import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  // GitHub Pages needs an absolute repository base, while Capacitor's
  // Android WebView must use relative asset URLs. The build workflow
  // explicitly sets VITE_BASE for each target.
  const base = process.env.VITE_BASE
    || (process.env.GITHUB_ACTIONS === 'true' ? '/Guardian/' : './');

  return {
    base,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Keep the Android WebView bundle compatible with older device WebViews.
      target: 'es2019',
      cssTarget: 'chrome80',
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

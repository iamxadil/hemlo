import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// The demo store is a single-page app: the shop loads first and small; the control panel (src/admin) is its own chunk,
// fetched only when someone opens it.
export default defineConfig({
  plugins: [preact()],
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    modulePreload: { polyfill: false },
    reportCompressedSize: true,
  },
});

// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://account.hemlohq.com',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
  server: { port: 4321 },
  vite: { plugins: [tailwindcss()] },
});

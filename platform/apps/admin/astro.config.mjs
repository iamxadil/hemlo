// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  site: 'https://admin.hemlohq.com',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'always' },
  vite: { plugins: [tailwindcss()] },
});

// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://studio.hemlohq.com',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  integrations: [sitemap({ i18n: { defaultLocale: 'ar', locales: { ar: 'ar-IQ', en: 'en' } }, filter: (p) => !p.includes('404') })],
  vite: { plugins: [tailwindcss()] },
});

# Hemlo Studio · studio.hemlohq.com

One-page Astro site for the Studio branch, in Arabic (`/`) and English (`/en/`): describe the project as a sentence, and a paper receipt prices it live. Below it: the price list, our own work, how it goes. Old `/pricing/` and `/quote/` links redirect (see `worker/index.js`).

- **Prices:** `src/pricing.ts` is the single source. Change a number there and the plan cards, tables and quote builder all update.
- **Copy:** `src/i18n.ts`. **Page:** `src/views/Studio.astro`.
- **Look:** `src/styles/base.css` (the Hemlo system, copied from `../website`) + `src/styles/studio.css` (dark, Studio teal).
- `npm run dev` · `npm run build` · `npm run deploy` (Cloudflare Worker `hemlo-studio`, custom domain studio.hemlohq.com).

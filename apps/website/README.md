# hemlohq.com

The Hemlo website: Astro 7 (static), Tailwind v4 with the Hemlo design tokens, and view transitions between pages. Arabic is the default at `/` and English lives at `/en/`.

| Where | What |
|---|---|
| `src/styles/global.css` | The design system: tokens (colour, type scale, motion), light/dark themes, base components |
| `src/i18n/strings.ts` | **All copy**, Arabic and English. Edit text here |
| `src/brand/` | The H mark, the lockup and the branch logos (generated from the brand kit) |
| `src/views/` | One file per page (Home, Systems, School, About, Contact; Studio lives at studio.hemlohq.com), shared by both languages |
| `src/pages/` | Routes: `/`, `/systems/` … and `/en/…` |
| `worker/index.js` | Cloudflare Worker: serves `dist/`, redirects www, adds security and cache headers |

```
npm run dev      # local preview at http://localhost:4321
npm run build    # static site in dist/
npm run deploy   # build and publish to hemlohq.com
```

Kurdish (`/ckb/`) is added in `strings.ts` once a native speaker has reviewed the copy.

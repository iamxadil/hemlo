# Hemlo Studio · demo store (demo.hemlohq.com)

A live online store, **Nafha (نفحة)**, and its control panel. Hemlo Studio uses it to show clients how a custom store
works: change anything in the panel and watch the store update. Everything runs in the visitor's browser, so there is
no server, no cost, and every visitor gets their own private copy that they can reset.

## Links to share
- `/` the store · `/admin` the control panel · `/how` "How does your store work?"
- `?market=jo` opens it as a Jordanian store (JOD, Amman); `?market=iq` as an Iraqi one (IQD, Baghdad). `?lang=ar|en` picks the language.

## How it's built
- **Preact + signals**, Vite, plain CSS. Shop download ≈ 35 kB gzip JS + 11 kB CSS; the control panel (~11 kB), the
  "how it works" page and the starting catalogue load only when needed.
- **Photography**: 32 real photographs from Unsplash (credited on /how). `node scripts/photos.ts` downloads the
  originals once (photos-src/, not committed), makes AVIF + WebP at 400–2800 px in public/photos/, and writes
  src/data/photos.ts (size, focal point, colour, a 12 px blurred preview) and src/data/photo-credits.ts.
  `<Img>` serves the right size for the screen, crops around the subject, and fades in over the blurred preview;
  banners can carry a portrait version for phones (only one is ever downloaded). Uploads are shrunk to WebP in the
  browser and kept in IndexedDB.
- **Motion** (Apple's "fluid interfaces"): `lib/motion.ts` has springs (damping + response, start from the current
  position, carry velocity), momentum projection, rubber-banding, reveals and the fly-to-bag. Page changes use the View
  Transitions API (a product's photo morphs from its card into its page). The bag is a sheet you can drag and throw
  away on phones. Scroll-linked moments (hero drift, spotlight zoom, parallax) use CSS scroll timelines where supported.
  Everything respects reduced motion and reduced transparency.
- `src/lib/store.ts` — the one live document (`types.ts`). All changes go through `change()`: saved to IndexedDB
  (batched; orders at once) and broadcast to other tabs, so the panel and an open store tab stay in sync.
- `src/lib/actions.ts` (panel) and `src/lib/order.ts` (checkout) — every rule that changes the store lives there.
- `src/lib/pricing.ts` — one calculation for bag, checkout and saved order (discount codes, free delivery).
- `src/lib/money.ts` — IQD (no decimals), JOD (fils, 3 decimals), USD (cents); switching currency converts every price.
- `src/data/seed.ts` — the starting shop. Bump `src/data/version.ts` when it changes shape.
- `src/store/*` — the shop; `src/admin/*` — the control panel (its own words in `admin/strings.ts`).

## Commands
- `npm run dev` · `npm run build` · `npm run preview` (port 4501)
- `node scripts/look.ts [en|ar]` — design-review screenshots of key pages on a laptop and a phone.
- `node scripts/e2e.ts` — 16 steps in a real browser (needs `npm run preview` running): bag, code, checkout, search,
  the pinned story, the panel changing a price, a photo, an order and the colour while a store tab is open, reload,
  the bag sheet dragged away on a phone, Arabic, Jordan, photo credits. `BASE=https://demo.hemlohq.com` tests the live site.
- `npm run deploy` — Cloudflare Worker `hemlo-demo-store` on demo.hemlohq.com.

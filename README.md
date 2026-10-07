# Hemlo · هيملو

Hemlo is an Iraqi software company: free tools, ready-made business systems (gyms, dental clinics, stores), and websites and apps built to order. Arabic first, priced in dinars, made for a weak connection.

Everything Hemlo runs lives in this one repository.

```
apps/                 the public sites, each deployed on its own (Cloudflare Workers)
  website/            hemlohq.com: the company site and the product pages (/gym, /dental, /store) · Astro
  studio/             studio.hemlohq.com: custom websites and apps, the price builder, our work · Astro
  tools/              tools.hemlohq.com: free tools (invoice maker, repair receipt, salary, landed cost) · plain JS, works offline
  demo-store/         demo.hemlohq.com: Nafha, a demo perfume store with its own admin panel · Preact + Vite
  coming-soon/        the old holding page (kept for reference)
platform/             Hemlo Systems and Hemlo ID: one workspace (npm workspaces)
  apps/api/           api.hemlohq.com: Hono on Workers, Postgres (Neon) through Hyperdrive
  apps/system/        system.hemlohq.com: the business app (store, dental, gym) · React
  apps/account/       account.hemlohq.com: sign in, sign up, invites · Astro
  apps/admin/         admin.hemlohq.com: Hemlo staff (passkeys only)
  packages/           shared code: core, db (Drizzle + migrations), auth, notify
brand/                the visual identity kit: the founder's H, logos, icons, tokens, print, poster
video/demo-shop/      the product video of the demo store (Remotion)
docs/                 decisions and designs
  architecture/       system design, auth design, tech stack
  brand/              the brand book (source of the guidelines PDF)
  pricing/            Hemlo Systems pricing page
  tools/              md-to-pdf: turns a doc into a branded A4 PDF
.claude/skills/       project skills for Claude Code (premium storefront, etc.)
```

## Working on a project

Each folder under `apps/`, plus `platform/` and `video/demo-shop/`, is its own npm project. Install and run it from its folder:

```sh
cd apps/website
npm install
npm run dev
npm run deploy      # build + wrangler deploy (needs a Cloudflare login)
```

The system app deploys with `npx vite build && npx wrangler deploy` from `platform/apps/system`. The rest of the platform's commands are in [`platform/README.md`](platform/README.md).

## Secrets

No secret lives in this repository. Keys (database, email, AI) are Cloudflare Worker secrets, set with `wrangler secret put`. The `.env.production` files only hold public web addresses.

## Not in the repository

`node_modules`, build output, local databases, screenshots, rendered videos (`video/demo-shop/out`), the original product photos (`apps/demo-store/photos-src`) and the old identity explorations (`brand/_archive`) stay on the working machine only.

# Hemlo platform

The shared foundation for every Hemlo product. It starts with **Hemlo ID**: one account, no passwords, organizations and roles, counter mode for shared shop devices. Design: [`../docs/architecture/auth-system-design.md`](../docs/architecture/auth-system-design.md).

```
packages/
  core/      phone numbers (+964), PINs, return-URL checks, WebCrypto helpers
  db/        Drizzle schema (Better Auth tables + Hemlo tables), migrations incl. row-level security
  notify/    messages: email (Resend) · WhatsApp and SMS slots (not connected yet)
  auth/      Better Auth configuration, permissions (roles → resource:action), audit log
apps/
  api/       api.hemlohq.com: Hono on Cloudflare Workers (worker.ts) or Node (dev.ts)
  account/   account.hemlohq.com: sign-in, account, business, invitations, counter, consent (Astro, ar + en)
tests/       API end-to-end tests on a real Postgres (PGlite)
scripts/     ui-e2e.ts (browser test with headless Edge), migrate.ts (Neon)
```

## Run it locally

```bash
npm install
npm run dev:api        # http://localhost:8787  (sign-in codes are printed in this terminal)
npm run dev:account    # http://localhost:4321
```

Local data is kept in `.data/dev-db` (delete the folder to start fresh).

## Tests

```bash
npm test               # 60 API tests: codes, passkey rules, orgs, invitations, roles, counter, RLS, API keys, sessions
npm run test:ui        # the real screens in headless Edge, with a virtual fingerprint for passkeys
npm run typecheck
```

## What's connected, and what isn't

| Channel | Status |
|---|---|
| Email codes | Ready (needs `RESEND_API_KEY` in production) |
| Passkeys | Ready (they work on every `*.hemlohq.com` site) |
| Google | Ready when `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set |
| Phone codes | Built and tested; **switched off** (`PHONE_SIGN_IN=0`) until WhatsApp or SMS is connected in `packages/notify` |
| Staff invitations by phone | Work now: the owner shares the link through their own WhatsApp (free `wa.me` link) |

## Deploy

**Live since 28 September 2026:**
- `api.hemlohq.com` (Worker `hemlo-api`, Hyperdrive `hemlo-db` → Neon eu-central-1, role `hemlo_app`)
- `account.hemlohq.com` (Worker `hemlo-account`)

Email codes are sent through Resend (domain hemlohq.com verified).

### From scratch

1. Create a free Neon Postgres project and copy its connection string.
2. `DATABASE_URL=… npm run db:migrate` (as the owner role)
3. Create a login for the app that **cannot bypass row-level security** (Neon's owner role can):
   - `create role hemlo_app login nobypassrls password '…'`
   - `grant select, insert, update, delete` on all tables to it, plus default privileges for new tables.
4. `npx wrangler hyperdrive create hemlo-db --connection-string="postgresql://hemlo_app:…"` (direct host, not the -pooler one), and put the id in `apps/api/wrangler.jsonc`.
5. Set the secrets:
   - `npx wrangler secret put AUTH_SECRET -c apps/api/wrangler.jsonc` (a long random string)
   - `RESEND_API_KEY`, the same way.
6. Deploy the API: `npx wrangler deploy -c apps/api/wrangler.jsonc`.
7. Deploy the account screens: `npm run build -w @hemlo/account && npx wrangler deploy -c apps/account/wrangler.jsonc`.

## Using Hemlo ID from another Hemlo app

- **Browser apps on `*.hemlohq.com`:**
  - Call `https://api.hemlohq.com/v1/…` with `credentials: 'include'`. The session cookie is shared.
  - Send people to `https://account.hemlohq.com/sign-in/?return_to=<url>` to sign in.
- **Asking "may they?":** `GET /v1/can?resource=sales&action=refund` returns `{ allowed, organizationId, as }`.
- **Counter screens:** send the header `x-hemlo-as: counter`. Requests then act as the unlocked staff member of that device.
- **Integrations:** send the header `x-api-key: hk_…`. Keys are created in *Manage business*.
- **Mobile apps and custom domains:** use OpenID Connect at `https://api.hemlohq.com/.well-known/openid-configuration` (authorization code + PKCE).

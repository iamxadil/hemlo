# Solvra Tech Stack

*Decision record · 2026-09-27. Versions are as of today. This supersedes the architecture sketch in `01-product-discovery.md`.*

## The shape of the problem

Solvra is **a platform with several products on it**. It starts with Solvra Shipments; Service, Workshop and School may follow. What the stack must handle:

| Requirement | Consequence for the stack |
|---|---|
| Several products sharing one account, billing, files, notifications, audit | A **shared platform core** plus product modules, in one repository |
| Money, deposits, ledgers, reconciliation | **PostgreSQL**, integer money, append-only ledgers, transactions everywhere |
| Arabic, Kurdish (Sorani), English; right-to-left | i18n and RTL built into the design system from day one |
| Iraqi networks: patchy signal, mobile-first | PWA, small payloads, offline outbox for field products |
| Iraqi payments and messaging | FIB / ZainCash / cash, WhatsApp, SMS OTP. No Stripe, no Twilio dependency. |
| A solo founder today, a team later | A modular monolith with hard boundaries, not microservices |
| Possible future data-localization rules | **Portability**: containers, vanilla Postgres, S3 API. Moving to an Iraqi data center must be a configuration change. |
| Regional risk | Host in **Europe**, not the Gulf |

"Large scale" for Iraqi B2B means thousands of organizations and hundreds of thousands of users over years. One well-designed Postgres plus stateless app servers handles that comfortably. The architecture below is designed so that growth means **adding capacity**, never **rewriting**.

---

## Decisions

### Language and runtime

- **TypeScript (strict) everywhere.** One language across web, API, workers, and later mobile.
- **Node.js 24 LTS** (Active LTS until May 2028). Pin the version in `.nvmrc` and in Docker images.
- **pnpm workspaces + Turborepo** monorepo.

### Frontend

| Choice | Why |
|---|---|
| **Next.js 16** (App Router, Turbopack) | You know it. Server components for fast first loads on slow networks. The same framework serves the marketing site and the product app. |
| **Tailwind CSS v4** + `tokens.css` from the brand kit | Tokens already exist. Logical properties (`ps-*`, `me-*`) make RTL automatic. |
| **React Aria Components** as the base of `@solvra/ui` | Best-in-class RTL, locale-aware date, number and calendar components, and accessibility. Arabic date pickers and number inputs are exactly where other libraries break. |
| **next-intl** (ICU messages) | `ar`, `ckb`, `en`; plurals and gender done properly for Arabic |
| **TanStack Query** + **TanStack Table** | Server-state caching and serious data tables (shipments, ledgers) |
| **React Hook Form + Zod** | Zod schemas shared with the API |
| **Serwist** (service worker) + **Dexie** (IndexedDB) | PWA install, offline cache, outbox sync. Field products need it; Shipments benefits from it. |

### Backend

| Choice | Why |
|---|---|
| **Separate API app: Fastify 5 + Zod + OpenAPI** | Keeps business logic out of Next.js. The same API later serves the PWA's offline sync, a mobile app, partner integrations and payment webhooks. A typed client is generated from the OpenAPI spec. |
| **Domain logic in framework-free packages** (`@solvra/shipments`, `@solvra/billing`, …) | Products are modules with public interfaces. Any module can later become its own service without a rewrite. |
| **Better Auth** (organization + phone-number plugins), self-hosted | Users, orgs, roles and sessions live **in your own Postgres**, not in a US SaaS. Phone login is how Iraqi users sign in. One Solvra account works across all products (cookie on `.solvra.iq`). |
| **Background jobs: pg-boss** (Postgres-backed queue) | Jobs are enqueued **in the same transaction** as the business write, so no lost or phantom jobs. No extra infrastructure. Move to BullMQ + Valkey only if throughput ever demands it. |
| **Transactional outbox** table | Every domain event (shipment created, deposit recorded) is written in the same transaction and processed by workers. It feeds notifications, audit and integrations, and is the seam for extracting services later. |
| **PDF generation: Playwright (Chromium)** in the worker | Correct Arabic shaping. The brand kit already renders this way. React-PDF and similar tools handle Arabic poorly. |

### Data

| Choice | Why |
|---|---|
| **PostgreSQL 18** | Ledgers and reconciliation need transactions, constraints and joins. Native `uuidv7()` and async I/O. **Not MongoDB**: document stores make financial integrity your problem instead of the database's. |
| **Drizzle ORM** (pin the version; 1.0 is in beta) | SQL-first, tiny, migrations are plain SQL, works naturally with Row-Level Security. Prisma 7 is fine too, but heavier, and its abstraction fights RLS and advanced SQL. |
| **Multi-tenancy: shared schema + `org_id` + Postgres RLS** | Every tenant table has `org_id`. Each request runs in a transaction with `SET LOCAL app.org_id`, and RLS policies enforce isolation even if application code has a bug. |
| **Search: Postgres full-text + `pg_trgm`** with an Arabic normalization function | Strip diacritics; unify أ إ آ → ا, ى → ي, ة → ه. Normalize Eastern Arabic digits to Latin. Add Meilisearch or Typesense only if search outgrows this. |
| **Object storage: Cloudflare R2** (S3 API) | No egress fees. The S3 API means you can move to MinIO in an Iraqi data center without code changes. Presigned uploads, per-org key prefixes. |

### Integrations (Iraq-specific)

| Need | Choice |
|---|---|
| OTP / SMS | An Iraqi OTP gateway (e.g., OTPIQ: SMS + WhatsApp) behind `@solvra/notify` |
| WhatsApp messages | Meta WhatsApp Cloud API (utility templates), direct; no middleman |
| Email | Resend or Amazon SES (EU region) |
| Payments | **FIB** (documented REST API + webhooks), **ZainCash**, Qi via a local gateway, plus manual cash/transfer invoices. Behind `@solvra/payments` with provider adapters. Billing and entitlements are built in-house (per org, per product). |
| AI (later, optional) | Claude API behind `@solvra/ai`, e.g. extracting fields from supplier invoices and certificates of origin. Not a day-one dependency. |

### Infrastructure

| Choice | Why |
|---|---|
| **Region: Germany (Nuremberg/Falkenstein + Frankfurt)** | Stable. About 70–90 ms from Baghdad. Gulf regions carry physical war risk in 2026. |
| **Compute: Hetzner Cloud** VMs running Docker | Very cost-efficient; no lock-in |
| **Deploys: Kamal 2** | Zero-downtime Docker deploys from Git, configuration as code, no Kubernetes |
| **Database: managed Postgres 18 in Frankfurt (Neon)** | Backups, point-in-time recovery and branching without running a DBA job yourself. Rule: **vanilla Postgres features only**, so you can move to Crunchy Bridge, RDS, self-hosted or an Iraqi data center. |
| **Cloudflare** in front (DNS, CDN, WAF, rate limits, R2) | It has a point of presence in Baghdad, so static assets are served inside Iraq |
| **Observability**: Sentry (errors), OpenTelemetry + pino logs → Grafana Cloud, an uptime monitor, PostHog (product analytics) | You can't fix what you can't see |
| **CI**: GitHub Actions (typecheck, Biome, Vitest, Playwright, migrations check); Renovate for dependency updates | |

Expected starting cost: under about **$100/month**. Hetzner VMs cost tens of euros, Neon, R2, Cloudflare and Sentry have free or low tiers, and PostHog is free at the start.

---

## Lean mode: spend almost nothing until revenue

The stack is entirely open source. The only real costs are hosting and per-message fees, so spending follows revenue:

| Stage | Setup | Monthly cost |
|---|---|---|
| **Validation** (the 30-day plan) | No servers. Spreadsheets + a shared folder. | **$0** |
| **MVP / first pilots** (0–10 customers) | **One Hetzner ARM VM** (CAX11: 2 vCPU, 4 GB) running web, API, worker **and Postgres 18** in Docker via Kamal. Nightly `pg_dump` + WAL archiving to **R2** (10 GB free). Cloudflare free, Sentry free (5K errors), GitHub free. No Redis (pg-boss uses Postgres). | **≈ €6–8** |
| **Paying customers** (10–50) | Move Postgres to managed (Neon paid or similar) for point-in-time recovery without operational work; add a second VM if needed | **≈ $30–60**, paid from revenue |
| Growth | Follow the growth path below | Scales with revenue |

The **code structure stays identical** at every stage. Only the deployment changes. Lean-mode rules:

- **Messaging costs per message.** Early on, use free WhatsApp click-to-chat links (`wa.me`) and email magic links. Add paid phone OTP and WhatsApp templates when customers pay.
- **Test the backup restore** once a month. On a single VM, backups are the whole safety net.
- **Don't** use "always free" hobby tiers (Oracle Free, Vercel Hobby) for customer data. Accounts can be suspended, and Vercel Hobby forbids commercial use.

---

## Repository layout

```
solvra/
├─ apps/
│  ├─ web/            Next.js 16: app.solvra.iq (product shell, product switcher, all product UIs)
│  ├─ site/           Next.js 16: solvra.iq marketing site (static)
│  ├─ api/            Fastify 5: /v1 REST + OpenAPI, auth, webhooks, sync
│  └─ worker/         pg-boss workers: outbox, notifications, PDFs, reminders, imports
├─ packages/
│  ├─ core/           shared kernel: ids, money, time, errors, result types, Arabic normalization
│  ├─ db/             Drizzle schema, migrations, RLS helpers, tenant transaction wrapper
│  ├─ auth/           Better Auth config (orgs, roles, phone OTP)
│  ├─ billing/        plans, entitlements, invoices, payment-provider adapters
│  ├─ notify/         WhatsApp / SMS / email / push behind one interface
│  ├─ files/          presigned uploads, storage adapter (R2 / MinIO)
│  ├─ audit/          append-only audit log
│  ├─ i18n/           messages (ar, ckb, en), formatters (IQD, dates, digits)
│  ├─ ui/             @solvra/ui: React Aria + Tailwind + brand tokens
│  ├─ api-client/     generated from OpenAPI
│  └─ shipments/      first product's domain module (more products added the same way)
└─ infra/             Kamal config, Dockerfiles, backup scripts
```

**Boundary rule:** a product module may depend on `core`, `db`, `billing`, `notify`, `files` and `audit`. It never imports another product. Cross-product needs go through events or the platform core.

---

## Conventions that matter at scale (set on day one, painful to retrofit)

1. **IDs:** `uuidv7()` primary keys. Human-readable references per org (`SHP-2026-0142`) come from per-org counters, never exposed sequences.
2. **Money:** `bigint` in minor units + ISO currency code (IQD has 0 decimals, USD has 2). Never floats. Exchange rates are stored per transaction with date and source (CBI official vs market). **Ledger entries are append-only**: corrections are new entries.
3. **Time:** `timestamptz` in UTC, displayed in `Asia/Baghdad`. Business dates (e.g., "renewal due by 25 December") use the `date` type.
4. **Tenancy:** `org_id` on every tenant table, enforced by RLS. There is no "global" query path in product code.
5. **Idempotency keys** on every write endpoint. Offline sync, retries and payment webhooks all depend on it.
6. **Outbox events** for every state change that someone else cares about.
7. **Audit log** for every financial or document change (who, what, when, before/after).
8. **API versioning:** `/v1`; additive changes only; OpenAPI is the contract.
9. **i18n:** no hard-coded strings. Latin digits by default, configurable per org. Arabic normalization on every searchable field.
10. **Portability:** anything cloud-specific lives behind an adapter.

---

## Growth path: what changes, and when

| Trigger | Change |
|---|---|
| Day one | Everything above; 1–2 VMs; managed Postgres; R2; Cloudflare |
| Sustained database CPU above ~60%, or heavy reporting | Add a read replica; send reporting to it |
| Rate limiting or caching becomes a real need | Add **Valkey** (open Redis fork) for cache, rate limits and sessions |
| Job volume exceeds what pg-boss comfortably handles | Move the hot queues to BullMQ + Valkey; keep the outbox |
| Audit or event tables pass ~100M rows | Partition by month |
| A product has a very different load profile, or the team passes ~8 engineers | Extract that module into its own service (its boundaries already exist) |
| Iraqi data-localization law | Move the Docker services to an Iraqi data center, Postgres to self-managed or a local provider, R2 to MinIO. Configuration, not a rewrite. |
| A field product needs strong offline sync | Evaluate a Postgres sync engine (PowerSync / ElectricSQL) for that product only |
| Native app features the PWA can't offer | Expo (React Native), reusing `core`, `api-client` and the Zod schemas |

## Deliberately not used

- **MongoDB** for anything financial
- **Microservices / Kubernetes** before there's a team and a reason
- **Backend-as-a-service** (Firebase, Supabase auth) for core data: lock-in and data held abroad
- **Hosted auth** (Clerk, Auth0): your users' identities belong in your database
- **GraphQL**: OpenAPI REST is simpler for a small team and for partner integrations
- **Edge/serverless runtimes** for database-heavy logic: containers next to the database are faster and cheaper
- **Gulf cloud regions**, for now

## First steps

1. Create the monorepo skeleton (pnpm, Turborepo, TypeScript strict, Biome, Vitest).
2. Build `packages/core` (money, ids, time, Arabic normalization) and `packages/db` (Drizzle, RLS, tenant transaction wrapper) **with tests**. Everything else stands on these two.
3. Set up `packages/ui` from `tokens.css`, with RTL and dark mode from the first component.
4. Auth with orgs and phone OTP in `apps/api`, and the session shared with `apps/web`.
5. Only then the first Shipments screens, and only for what the validation interviews showed customers will pay for.

## Sources

- Next.js 16: https://nextjs.org/blog/next-16
- Node.js release schedule: https://endoflife.date/nodejs
- PostgreSQL 18 (uuidv7, async I/O): https://www.postgresql.org/docs/release/18.0/
- Drizzle vs Prisma 2026: https://makerkit.dev/blog/tutorials/drizzle-vs-prisma
- Better Auth: organization and phone-number plugins: https://better-auth.com/docs/plugins/organization , https://better-auth.com/docs/plugins/phone-number
- AWS me-central-1 drone strikes and advice to move data out: https://www.thestack.technology/get-your-data-out-now-says-aws-on-me-central-1/ , https://www.infoq.com/news/2026/03/aws-multiaz-conflict-outage/
- Iraq data-center plan (Sept 2026): https://www.iraqinews.com/iraq/iraq-communications-ministry-plans-data-centers-baghdad-basra-mosul-2026/
- Hetzner locations: https://docs.hetzner.com/cloud/general/locations/
- FIB payments API: https://fib.iq/integrations/web-payments/

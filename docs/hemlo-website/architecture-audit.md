# Hemlo Website architecture audit

**Audit date:** 9 October 2026  
**Repository:** Hemlo monorepo, with emphasis on `platform/`  
**Working-tree note:** This audit includes the Website-related, uncommitted files that were already present at the start of this task. The worktree also contains unrelated edits in API, System, auth, database schema and school UI files. Those edits are user work and were not reset.

## Executive summary

Hemlo Systems already has the right foundation for an integrated add-on: one Hemlo ID session, organizations as business workspaces, organization-scoped database access with forced PostgreSQL row-level security, system-specific plans, a subscription table, and a manual billing process in which Hemlo staff confirms payments. Real Estate already owns public property projections, public pages and a lead workflow.

The repository also has an in-progress Website engine in the current worktree: a `web_site` and `web_page` schema, authenticated management routes, a public HTML renderer, a React dashboard chunk, and tests. It is not yet a properly entitled or billed add-on. Website activation currently creates a setup site directly, without a compatible-system check, core-subscription validation, an add-on request, a trusted add-on price, or a confirmed entitlement. The editor's `website:manage` permission is currently granted to owners and managers across all editions, but authorization is not tied to Website activation. The Real Estate renderer can read published listings and the existing public lead workflow exists, but Website listings currently link to the platform's generic property page rather than a detail page on the business website; the adapter is incomplete.

## 1. What exists and works

### Runtime, routing, and deployment

- The platform is a TypeScript npm workspace. The API is Hono, deploys to Cloudflare Workers, and uses Postgres on Neon through Hyperdrive. The business app is React/Vite; the account site is Astro.
- API routes are mounted centrally in `platform/apps/api/src/app.ts`. Public real-estate pages and the Website public renderer are unauthenticated routes; management routes use the standard principal and actor/permission checks.
- Production uses shared Hemlo subdomains, Cloudflare Workers, and R2-backed files. This is enough for the current `*.hemlohq.com` site URL convention; custom-domain provisioning is not demonstrated by the current implementation.

### Identity, workspace, permissions, and tenant isolation

- Better Auth owns sign-in, session, organization membership, invitations, and active-organization selection. There is no separate Website identity or workspace.
- Business tables carry `organization_id`. `withOrg()` opens a transaction, sets `app.org_id`, and disables system access. `withSystem()` is for trusted system operations. Existing tenant tables use forced RLS and organization policies.
- `actor()` authorizes resource/action access for the active organization. `website:manage` is an existing permission, currently added in the Website worktree changes. Owner and manager receive it; other roles do not by default. It presently means edit access whether or not an add-on is active.

### Plans, subscriptions, and billing

- `hemlo_plan` stores edition-specific public/active plans, monthly and annual prices, limits, and display metadata. `hemlo_subscription` stores one core subscription per organization, its edition, state, selected plan, term, agreed price, trial/paid dates and seats.
- Existing plan list prices are database-backed and admin-editable. Tests verify system-specific prices, including Real Estate Office 35,000 IQD/month, Agency 69,000, Group 129,000, and the other editions' distinct plans. Existing values must be preserved.
- `hemlo_plan_request` is a manual request workflow. Hemlo staff records a payment through admin routes, which activates/extends the core subscription. There is no automated customer payment provider for these subscriptions. Annual pricing is supported.
- `subscriptionGuard` enforces core-plan status and usage limits on the system routes. Website routes are not mounted behind that guard and do not check the core subscription.

### Real Estate data and conversion workflow

- `re_property` is the authoritative listing source. It records draft/available/reserved/negotiating/sold/rented/archived state, publication timestamp, public and internal fields, price, geography, features, and media. Existing public property routes use selected columns and status/publication filters.
- `reLead` is the existing inquiry workflow and includes `source = website`. Public property inquiries create leads and activity records; attribution and property association are supported there.
- Existing public real-estate listing pages, search/filtering, property details, SEO/social metadata, and lead inquiry UI are implemented independently of the Website add-on.

### Website work already present in the worktree

- `website-schema.ts` defines one `web_site` per organization, page rows with typed section JSON, theme/settings, domain fields and lifecycle state. Migration `0019_website.sql` adds both tables, indexes and organization RLS policies.
- `routes/website/index.ts` has authenticated site/page CRUD and publish/unpublish endpoints. `routes/website/public.ts` renders HTML, reads system products or published Real Estate listings, provides metadata/robots/sitemap, and accepts inquiries. The UI is lazily loaded at `apps/system/src/website/` and there are website API tests.
- Public Website HTML escapes rendered text, queries through organization scope, and selects a limited set of Real Estate fields. The current Website inquiry path writes into `reLead` for Real Estate and into `sysCustomer` for other editions.

## 2. What partially exists

- **Website add-on model:** The schema and UI call Website an add-on, but only a site row represents it. There is no add-on catalog, compatibility record, price, purchase/request, or entitlement.
- **Activation and authorization:** `/v1/web/site/enable` creates a site directly. Site update can also upsert a site. Publish checks only that a home page exists. None of these verify add-on entitlement, compatibility, or the core subscription. Existing business role checks are present, but paid-feature checks are not.
- **Pricing and admin:** Core plans have central pricing and an admin editor. Website has no configured price or admin path and cannot be presented as a confirmed purchase. Current billing can only request and record the core plan.
- **Vertical adapters:** The renderer branches by `site.vertical` and includes a store product projection plus an initial Real Estate projection. This is a set of inline branches, not a documented adapter contract. Other possible verticals can fall into the generic services template even when no supported data adapter exists.
- **Real Estate website experience:** It can display up to 12 published properties in a `listings` section. It does not yet implement Website-owned listing/detail routes, search/filter controls, robust paging, or property-level inquiries from the Website. Its listing card href points to the existing generic property page, not the tenant's published Website.
- **Inquiries:** The Website public form validates basic name/phone and applies a per-IP rate limit/honeypot. Real Estate inquiries do not retain a property association, email is not validated server-side in this path, and generic system inquiries become customers rather than a documented lead entity. The pre-existing Real Estate public inquiry flow is richer and associates leads with a property.
- **SEO/publishing:** Basic per-page title/description, canonical, OG, JSON-LD, robots and sitemap code exists. Sitemap currently contains every page, including pages with a `noindex` flag. Custom domain fields exist, but no verification/provisioning route is evident. The public route returns a `noindex` holding page for unpublished sites.
- **Design/editor:** The React dashboard and CSS are present as uncommitted files, with API tests. This audit has not established that every editor control is connected, that the screen is in the system navigation for each supported edition, or that the build/type checks pass.

## 3. What is missing

- A first-class add-on catalog/price record with compatibility by edition, monthly/annual price configuration, and an explicit unconfigured state.
- A workspace-owned add-on request/entitlement lifecycle that uses the existing manual billing model honestly (pending until staff confirms activation; active, cancelled/expired states as supported).
- Admin controls and audit events for changing add-on pricing/availability and confirming/cancelling an add-on entitlement.
- Server-side entitlement checks on every Website management and publishing operation, plus compatibility and core-subscription checks before activation.
- A customer pricing flow that shows the current core plan, separately configured Website price, and recurring total without presenting an unconfigured price as purchasable.
- A stable, documented vertical adapter interface and a complete Real Estate adapter, including Website property detail/search routes and property-linked lead creation.
- End-to-end security coverage for incompatible systems, unentitled users, unpublished pages/listings, cross-tenant access, cancellation/expiry, and trusted totals.
- A validated custom-domain process or an explicit unsupported/manual status flow; domain columns alone do not make a domain connected.

## 4. What can be reused

- Better Auth organization/session model, active workspace, RLS, `withOrg()` and `withSystem()`.
- Existing `hemlo_plan`, `hemlo_subscription`, admin pricing authorization, audit log, core plan request/payment conventions and cache invalidation.
- Existing billing settings UI and localized system shell/navigation patterns.
- Real Estate `re_property` public eligibility rules, safe projection conventions, `reLead`, source attribution, activity logging, inquiry spam controls, media/file URLs, and existing public SEO/page patterns.
- Existing R2 file storage, `sysFile`, React Query, shared UI components/tokens, and the website dashboard chunk.

## 5. What must be modified

1. Add a separate add-on catalog and workspace entitlement/request model; do not add Website as a core edition or alter existing core plans.
2. Extend the current manual staff billing workflow to confirm an add-on only after staff records/approves it. Client-supplied price values must never determine the amount or entitlement.
3. Add a centralized server helper for compatibility, core subscription eligibility, and active add-on entitlement. Use it on Website edit/publish operations.
4. Change Website enablement to request/initialize only after the supported flow allows it; remove any upsert or publish path that bypasses entitlement.
5. Make the UI display only configured, compatible offers and reflect `pending` versus `active` distinctly.
6. Replace inline vertical branches with adapter boundaries and complete the Real Estate adapter against actual property/lead records.
7. Align public listing eligibility, detail pages, inquiry attribution, sitemap indexing, and domain status with actual publication state.

## 6. Architectural and security risks

- **Paid access bypass:** Any organization member with `website:manage` can currently create and publish a Website without a confirmed add-on or active core subscription. This is the highest-priority issue.
- **Edition compatibility bypass:** Website site creation takes `subscriptionOf(...).edition`, but no compatibility check exists. A free/missing subscription state may resolve to the default `store`; no compatibility matrix exists.
- **RLS scope for public rendering:** The public route first resolves a site by public subdomain using trusted `withSystem()`, then scopes content reads through that site's organization ID with `withOrg()`. This is a reasonable public lookup boundary, but must remain a narrow projection. The test-only `x-hemlo-site` header can choose the public site's subdomain; it does not bypass publication filtering, but production routing must derive host correctly and should not treat arbitrary caller-supplied tenant IDs as authority.
- **Publication validation:** A home page row alone is enough to publish, even if business identity/contact/content is empty. There is no explicit publication checklist.
- **Inquiry fidelity:** Website Real Estate inquiries do not link to a property and differ from the existing public property inquiry workflow. Dedupe-by-phone can append public text to an existing lead/customer without an explicit attribution event.
- **Sitemap indexing:** `noindex` pages are still put in the sitemap. Public pages are selected from all `web_page` rows regardless of per-page index setting.
- **Domain trust:** `domain` and `domainStatus` are persisted fields; no domain challenge or verification process is visible. They must not be shown as active absent verification.
- **Worktree state:** Website work is uncommitted and mixed with unrelated changes. Migration `0019_website.sql` and Website files must be reviewed as existing user work; new migration numbering must follow the current journal.

## Implementation sequence

1. **Phase 1 — Add-on and entitlement foundation:** preserve core plans/billing; add configurable add-on offers and workspace-owned request/entitlement state; use the existing manual confirmation process; enforce checks server-side; test price trust, compatibility, workspace ownership and pending/active state.
2. **Phase 2 — Pricing:** make the add-on visible in the correct system billing context and calculate totals from server-returned prices.
3. **Phase 3 — Dashboard integration:** expose Website in the supported workspace navigation, with honest inactive/pending/active states and activation/setup entry points.
4. **Phase 4 — Engine and adapter contract:** consolidate vertical capabilities behind explicit adapters and keep unsupported verticals unavailable.
5. **Phase 5 — Real Estate completion:** use published properties and the existing lead workflow, including Website detail/search paths and linked inquiries.
6. **Phases 6–7 — Quality, publishing, SEO and domains:** refine responsive editor/public UX, publication validation and indexing; implement only domain workflow supported by current deployment.
7. **Phase 8 — Production readiness:** exercise the full customer journey and run existing build/type/test suites. Do not claim completion until evidence is observed.

The current repository does not require a new billing provider, service, queue or database. The add-on should remain in the existing Postgres/Drizzle and manual Hemlo billing workflow.

## Implementation status (9 October 2026)

The audit above records the starting worktree. The phased implementation now adds a configurable add-on catalog and workspace entitlement/request/payment records, server-side compatibility and paid-access checks, a manual confirmation workflow, and an owner-facing add-on pricing panel. The offer is deliberately unpriced until staff configures its month/year values; the seeded compatibility is Real Estate only. Existing core plan records and prices were left unchanged.

The Website dashboard is available in Real Estate workspaces. It uses the existing organization and property records, a documented adapter boundary, safe public property DTOs, Website-native listing/detail routes, search filters and property-attributed leads. Published URLs use `https://{workspace}.hemlohq.com`. A wildcard Worker route dispatches reserved Hemlo app hosts through service bindings to their existing Workers, while tenant hosts go to the public website renderer. The zone needs a proxied wildcard DNS record for tenant hostnames to resolve. The editor can change supported section types and text, page SEO fields, and appearance. Publishing snapshots authored site/page configuration, so edits remain private until republished; eligible property data stays live. Publishing checks for a home page, business name and a contact method. Sitemap excludes pages marked `noindex`. Custom domains remain unsupported and are not represented as connected.

Verification observed: `npm run typecheck` passed; all 306 tests across 24 test files passed; and `npm run build -w @hemlo/system` produced a production build. The Website-specific server/admin APIs are implemented, but there is no visual staff editor for add-on catalog prices. The customer editor covers page identity, supported sections, appearance and search metadata, but does not yet provide a pre-publication rendered preview or a Website-specific media upload manager. The project does not currently provide an automated billing gateway, custom domain provisioning, domain verification, or an end-to-end browser journey test for Website. These are explicit follow-up limitations rather than claims of completed support.

# Hemlo Website add-on and entitlement design

## Product boundary

Hemlo Website is an optional capability attached to an existing Hemlo Systems organization. It is not a core edition or a second subscription. The organization's `hemlo_subscription` remains authoritative for its core edition and plan. Website access is recorded separately in `hemlo_addon_entitlement` and always belongs to the same `organization_id`.

The existing core plans, prices, trial/grace rules, plan requests, payments and staff workflows remain unchanged. The current billing system is manual: a customer submits a request, Hemlo confirms the payment out of band, and the server records it. Website follows that same rule and never treats a customer click as payment confirmation.

## Data model

- `hemlo_addon` is the central system-only offer catalog. It stores the add-on code/name/description, compatible editions, monthly and annual IQD prices, visibility, availability, and last administrator update. A null period price means unconfigured and is never shown as a purchasable price.
- `hemlo_addon_request` is tenant-scoped and records an activation or cancellation request, the core edition, billing period, a trusted catalog price snapshot for activation, and a manual handling state (`new`, `done`, `dismissed`). An open request grants no access.
- `hemlo_addon_entitlement` is tenant-scoped and unique per organization/add-on. It records the confirmed edition, status, billing period, agreed recurring price, and paid-through date.
- `hemlo_addon_payment` is tenant-scoped and stores the manual receipt, method/reference, number of periods and new paid-through date.

All tenant tables use forced RLS and `withOrg()` access. Catalog reads and Hemlo staff operations use `withSystem()`.

## Compatibility and current offer

The Website catalog is seeded with `code = website`, initially compatible only with `realestate`. That is the only edition currently configured for purchase. Existing inline store rendering does not make Store a compatible product: the offer stays unavailable there until a safe, complete Store adapter is approved. Dental, Gym and School remain unavailable as well.

The launch price is 15,000 IQD a month or 150,000 IQD a year (ten months, like the core plans), set by migration `0022_website_price.sql` only where no price was set yet. Hemlo changes it in admin → Billing → Add-ons (or `PATCH /v1/admin/addons/website`). Clearing either period makes the offer unconfigured again, and there is no customer purchase button while it is. Compatible editions and public/active status are managed in the same place.

## Activation and cancellation

1. The signed-in business owner views only offers compatible with the active workspace edition.
2. The server checks that the offer is active, the edition is compatible, the core subscription is in trial/active/grace, and the selected period has a configured price.
3. The server snapshots the database price into a pending request. A repeated request is rejected while one is open.
4. Website management and publishing continue to return `ADDON_NOT_ACTIVE` until Hemlo confirms the manual payment.
5. Staff confirms activation in the admin request workflow with a permitted payment method and an amount that exactly matches the trusted snapshot. The server creates or extends the entitlement, records the receipt and closes the request in the same flow.
6. An owner can request cancellation. Access remains active while Hemlo reviews the request. Staff cancellation marks the entitlement canceled; public rendering, SEO endpoints and writes stop serving the Website.

Activation and use also require the core subscription to remain in trial/active/grace. Once the core subscription ends, public pages become unavailable even if the Website's own paid-through date has not elapsed. Records stay intact for possible reactivation.

## Trusted prices and totals

The public catalog (`GET /v1/plans/addons?edition=…`) and workspace billing response (`GET /v1/billing/addons`) return prices from `hemlo_addon`. Client totals are display estimates only. Requests send only a billing-period choice, never an amount; the server loads and snapshots the trusted value. Staff confirmation rejects a receipt amount that does not match the snapshot multiplied by confirmed periods.

The launch price (15,000 / 150,000 IQD) is the catalog default; staff can change it at any time and existing entitlements keep their agreed price.

## Authorization boundaries

- Only an organization user with `billing:manage` can request activation or cancellation. This remains the owner-only billing role.
- Website editing uses the existing `website:manage` permission and additionally checks the confirmed entitlement server-side on site/page writes and publication.
- Cancellation/expiry and core subscription expiry also gate public HTML, inquiries, robots and sitemap output.
- The public Website resolver derives its tenant from the configured public hostname/subdomain and renders only selected public fields under that organization's RLS context.

## APIs added

- `GET /v1/plans/addons?edition=realestate` — compatible public catalog entries with `configured` state.
- `GET /v1/billing/addons` — compatible offer, entitlement, requests and receipts for the active workspace.
- `POST /v1/billing/addons/website/request` — request manual activation (`billing: month | year`).
- `POST /v1/billing/addons/website/cancel-request` — request reviewed cancellation.
- `GET /v1/admin/addons`, `PATCH /v1/admin/addons/website` — staff catalog configuration.
- `GET /v1/admin/addon-requests`, `PATCH /v1/admin/addon-requests/:id` — staff confirmation, dismissal or cancellation.

## Explicit limitations

- There is no automated payment gateway or automatic renewal. The customer is told that Hemlo confirms manual payment.
- Staff handle the catalog and the open requests in admin → Billing → Add-ons: set prices and compatible systems, record a payment to activate (the amount is the request's snapshot × periods), dismiss, or confirm a cancellation.
- Price changes affect new requests; existing entitlements retain their agreed price snapshot.
- Website compatibility is intentionally limited to Real Estate. Other integrations should be enabled only after their adapter and public-data behavior are complete.
- Custom-domain verification, DNS provisioning and SSL issuance are not available in the current deployment workflow. The shared routed business hostname is used for customer Websites.
- Direct `https://{workspace}.hemlohq.com` URLs are enabled through the zone wildcard Worker route. Reserved Hemlo app hosts must be forwarded through service bindings so the wildcard does not replace existing apps.
- Publishing captures a versioned configuration/page snapshot. Subsequent edits remain private until the next publish. Real Estate listing eligibility and property details continue to read live source records.
- The editor provides structured content, theme and per-page search controls, but a rendered draft preview and Website-specific media upload controls remain follow-up work.

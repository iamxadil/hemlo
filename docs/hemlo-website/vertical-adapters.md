# Website vertical adapters

The shared Website renderer owns site identity, themes, pages, sections, navigation, SEO and public request handling. It must not infer a vertical's data model. A vertical adapter is the only boundary that can read system records for public Website sections or convert a public inquiry into that system's existing workflow.

## Current interface

`platform/apps/api/src/routes/website/adapters.ts` defines `WebsiteAdapter`:

- `edition` identifies the compatible Hemlo System edition.
- `sections` lists the content blocks the adapter can populate.
- `publicProjection` documents the exact fields/tables allowed to contribute to its public DTO.
- `refreshOn` lists source changes that make rendered content stale.
- `load()` runs within the site's organization-scoped transaction and returns renderer DTOs, never database records.
- `createInquiry()` maps validated public contact data into the vertical's existing lead/conversion workflow.

The renderer resolves adapters through `websiteAdapterFor(edition)`. An unknown edition is unavailable. Compatibility must also be enabled in the central add-on catalog; an adapter's existence alone does not sell or grant the add-on.

## Real Estate adapter

The first adapter reads `re_property` only where `published_at` is set and status is in the existing `PUBLIC_STATUSES` set. It selects the public card fields directly and uses `re_media`/R2 public URLs for approved covers. It excludes owner, agent, exact address, owner minimum, internal notes, documents, private stats, and tenant identifiers from the returned DTO.

Inquiry writes use `reLead` with `source = website`, a normalized visitor phone, and the existing organization scope. Property detail inquiries also link through `reLeadProperty` and record the property ID and Website page attribution in the existing activity history. No second Website-owned lead table is created.

Relevant changes include the listing's public text, price, public state, publication timestamp and media. The public renderer uses the API's short shared cache policy; no queue or Redis service is introduced. Listing and detail queries read current eligible property data on request, and the sitemap includes published property slugs.

## Unsupported editions

Store, Dental, Gym and School do not currently have Website adapters. The system navigation only exposes Website in Real Estate, and the catalog is seeded with Real Estate compatibility only. Existing renderer block types such as `products` or `services` do not establish an integration: they remain empty unless an adapter explicitly supplies a safe DTO.

## Adding a future adapter

1. Identify the existing source-of-truth tables and existing lead/conversion workflow.
2. Define the exact public fields and eligibility rules; exclude private and tenant-only data at query time.
3. Implement a `WebsiteAdapter` with supported sections, projection, refresh triggers, loader and inquiry mapper.
4. Add isolated tests for public projection, lifecycle eligibility, tenant scope and conversion attribution.
5. Only after the implementation is complete, update the catalog's compatible editions and expose the Website navigation for that edition.

Do not copy system records into Website tables. Only the site's authored content and structured presentation settings belong in Website storage.

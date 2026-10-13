// Every Hemlo system gets a website of its own character, not one template recoloured. A design is a layer over the
// shared frame (theme.ts): its own stylesheet and the moments only that trade needs (an agency's home search, a clinic's
// booking, a shop's shelves). The section model, the data adapters and the business's few theme choices stay shared,
// so a design can never produce a broken page; it only decides how the same content is staged. A design that leaves a
// hook out (or returns null from `section`) gets the shared rendering for that part.
import type { WebSection, WebTheme } from '@hemlo/db/schema';
import type { WebsiteListing, WebsiteProperty } from './adapters';
import type { Ctx } from './context';
import type { Lang } from './theme';
import { estateCss, estateSection, estateHeader, estateFooter, estateChrome, estateBar, estateProperty, estateScript } from './estate';
import { shopCss, shopSection, shopHeader, shopFooter, shopChrome, shopBar, shopScript } from './shop';

export type DesignId = 'studio' | 'estate' | 'shop';
export type Design = {
  id: DesignId;
  /** added after the shared stylesheet; `fontBase` is where this site's own fonts are served */
  css: (theme: WebTheme, fontBase: string) => string;
  section?: (ctx: Ctx, sec: WebSection, first: boolean) => string | null;
  header?: (ctx: Ctx, current: string, altHref: string) => string;
  footer?: (ctx: Ctx) => string;
  /** sheets and dialogs every page carries */
  chrome?: (ctx: Ctx, altHref: string) => string;
  /** the phone's bottom bar on ordinary pages */
  bar?: (ctx: Ctx) => string;
  property?: (ctx: Ctx, p: WebsiteProperty, similar: WebsiteListing[], canonical: string) => { main: string; bar: string };
  script?: (lang: Lang) => string;
};

/** The baseline every system starts from: warm paper, one serif, hairlines (theme.ts). */
const studio: Design = { id: 'studio', css: () => '' };

/** Real estate: a storefront for homes (estate.ts). */
const estate: Design = {
  id: 'estate', css: estateCss, section: estateSection, header: estateHeader, footer: estateFooter, chrome: estateChrome,
  bar: estateBar, property: estateProperty, script: estateScript,
};

/** A shop: an online store for its own products (shop.ts), with a bag, checkout and order tracking. */
const shop: Design = { id: 'shop', css: shopCss, section: shopSection, header: shopHeader, footer: shopFooter, chrome: shopChrome, bar: shopBar, script: shopScript };

const DESIGNS: Record<string, Design> = { realestate: estate, store: shop };
export const designFor = (vertical: string): Design => DESIGNS[vertical] ?? studio;

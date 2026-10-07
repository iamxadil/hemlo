// The demo store's whole world, as one document: what the owner edits in the control panel and what the shop shows.
// It lives in the visitor's browser (see store.ts); nothing here talks to a server.

export type Lang = 'ar' | 'en';
/** Text the owner writes in both languages. */
export type T = { ar: string; en: string };

/** The shop's one currency. Money is kept as whole minor units of it: dinars for IQD, fils for JOD, cents for USD. */
export type Currency = 'IQD' | 'JOD' | 'USD';

/**
 * A picture. `photo:<key>` is one of the store's photographs (data/photos.ts, served as AVIF/WebP in sizes);
 * `idb:<id>` is a photo the visitor uploaded, kept in the browser's database (media.ts); `art:<seed>` is a drawn bottle.
 */
export type Pic = string;

export interface Category { id: string; slug: string; name: T; blurb: T; pic: Pic; order: number }

export interface Product {
  id: string; slug: string; categoryId: string;
  name: T; short: T; body: T;
  /** Notes of the scent: top, heart, base (perfume) or key ingredients (care). */
  notes: T[];
  /** A photograph for each note, in the same order; when present the home page tells the scent as a story. */
  notePics?: Pic[];
  price: number; compareAt: number | null;   // minor units; compareAt shows a struck-out "was" price
  stock: number; sku: string;
  pics: Pic[];
  size: string;                              // "100 ml"
  featured: boolean; active: boolean;
  createdAt: number;
}

/** A home banner. `picTall` is an optional portrait version of the picture for phones. */
export interface Banner { id: string; title: T; sub: T; cta: T; href: string; pic: Pic; picTall?: Pic; tone: 'dark' | 'light'; active: boolean }

export interface Discount { id: string; code: string; kind: 'percent' | 'fixed'; value: number; minTotal: number; active: boolean; uses: number }

export type OrderStatus = 'new' | 'preparing' | 'shipped' | 'delivered' | 'canceled';
export interface OrderLine { productId: string; name: T; price: number; qty: number; pic: Pic }
export interface Order {
  id: string; no: number; createdAt: number; status: OrderStatus;
  customer: { name: string; phone: string; city: string; address: string; note: string };
  lines: OrderLine[]; subtotal: number; discount: number; code: string | null; delivery: number; total: number;
  pay: 'cod' | 'card' | 'wallet';
  history: { status: OrderStatus; at: number }[];
}

export interface Settings {
  name: T; tagline: T;
  currency: Currency;
  phone: string; whatsapp: string; email: string; city: T;
  delivery: { fee: number; freeOver: number };
  theme: { accent: string; ink: string; paper: string; radius: number };
  announcement: T & { on: boolean };
  instagram: string;
}

export interface Doc {
  v: number;            // the seed version this document was made from (store.ts re-seeds when it changes)
  rev: number;          // goes up on every change, so tabs know who is newer
  settings: Settings;
  categories: Category[];
  products: Product[];
  banners: Banner[];
  discounts: Discount[];
  orders: Order[];
  nextOrderNo: number;
}

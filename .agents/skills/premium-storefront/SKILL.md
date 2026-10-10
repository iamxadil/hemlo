---
name: premium-storefront
description: Build or polish a premium, Apple-grade online store front-end — typography (Poppins + Arabic pairing), a beautiful floating glass navbar, add-to-cart feedback that feels delightful, native-feeling phone drawers/bottom sheets and mobile menus, product cards and pages, RTL/Arabic, and a screenshot-driven review loop. Use this whenever the user works on an e-commerce site, shop, storefront, cart/bag, navbar/header, mobile menu, drawer or sheet, or says things like "make it look premium/elegant/Apple-like", "the cart animation is bad", "polish the mobile drawer", "redesign the navbar", even if they don't say "storefront". Especially for Hemlo Studio client sites and the demo store (Desktop/Solvra/demo-store).
---

# Premium storefront

A store feels premium when nothing is accidental: one typeface used with discipline, chrome that floats quietly
over photography, feedback that answers every tap within a frame, and phone surfaces that behave like the OS
(sheets you can grab, menus that grow from where you tapped). This skill is the standard for Hemlo Studio stores.
Pair it with `apple-design` (springs, gestures, materials) and `emil-design-eng` (easing, durations, review format);
this file is about *how those apply to a shop*.

## 1. Typography: Poppins, used with restraint

Poppins is the Hemlo brand face. Geometric and wide, so it needs different handling from a serif or SF:

- Self-host the Latin subset as woff2 (300/400/500/600, ~8 kB each); `font-display: swap`; preload only 400 and 600.
  Arabic gets its own face via `unicode-range` (Vazirmatn) — Poppins has no Arabic, and a separate face per script
  means each language downloads only what it shows.
- Display (hero, product names, section titles): weight 600, letter-spacing −0.035em to −0.04em, line-height ~1.02.
  Poppins is ~25% wider than a serif at the same size, so cap hero type around `clamp(2.6rem, 6.8vw, 6rem)` —
  oversized Poppins looks shouty, not luxurious.
- Body 16–17px, weight 400, letter-spacing −0.005em, line-height 1.55. Secondary text uses colour, not weight 300 —
  thin Poppins at small sizes breaks up on Windows.
- Eyebrows: 500, 0.72–0.78rem, uppercase, +0.12em tracking. In Arabic: no uppercase, no tracking, ~1.15× size.
- Numbers (prices, counts): `font-variant-numeric: tabular-nums` so they don't jitter when they change.
- Arabic headings are weight 600–700 with `letter-spacing: 0` and line-height ≥ 1.3 (ascenders/descenders need room).

## 2. The navbar: a floating glass capsule

The header is the most-seen element; it should feel like a lens over the page, not a strip glued to it.

- **Shape**: a capsule floating ~12px below the top (sticky), max-width aligned to the content grid, radius 999px on
  desktop / ~22px on phones, glass material (paper at ~70% + `backdrop-filter: blur(24px) saturate(180%)`), a 1px
  inner highlight (`inset 0 0 0 1px rgb(255 255 255 / .5)`) and a soft long shadow. Over dark sections it switches
  to dark glass with light text (detect with an IntersectionObserver band, never on every scroll event).
- **Condenses on scroll**: after ~40px the capsule tightens (padding and shadow change) via a class toggled by an
  IntersectionObserver sentinel — never a scroll listener that sets styles every frame.
- **Links**: centred, 500 weight, ~0.86rem. A single highlight pill slides between links on hover/focus (measure
  the link, move one absolutely-positioned element with `transform`, ease-out ~350ms) — one moving object reads as
  craft; per-link hover backgrounds read as a template. Current page gets a persistent dot or pill.
- **Actions**: icon buttons 40px round; the bag is a distinct glossy pill (a soft top highlight, inset edge, small
  shadow) because it's the one action that matters: "[bag] Bag" on desktop, a round button on phones. Draw the bag
  yourself: an outline when empty; with items it fills and carries the count *inside* it (like Apple), "9+" past
  nine. No separate coloured badge. The handle lifts on hover; the bag dips and tilts when something is added.
  Users called a plain letter button for language and a badge chip "not nice".
- **Language**: a two-way switch "EN | ع" with a sliding white thumb, forced  so EN stays left and the
  thumb travels (otherwise the labels swap places when the page flips to RTL). Never a lone "ع"/"EN" letter.
- **Phone**: logo start, bag pill + menu button end (the thumb zone). The menu button's two lines morph into ×.

## 3. Add to cart: confirm in place, then show the bag — no flying clones

Flying a thumbnail across the screen into an icon is the classic "template" animation: it's slow, it competes
with the page, and on phones the icon is often off-screen. Apple Store and the best boutiques do this instead:

1. **The button itself answers, within one frame**: pressed state on pointer-down (`scale(.97)`), then its label
   cross-fades (with a 2px blur bridge) to a drawn check + "Added" for ~1.6s, then back. Disable double-adds
   during that window. The quick-add "+" on cards rotates into a ✓ the same way.
2. **The bag announces itself**: the count inside the bag rolls (old number slides up and out, new one slides in)
   and the bag glyph dips and tilts — spatially tied to where the bag lives.
3. **A mini-bag popover drops from the bag** (desktop: anchored under the bag pill, `transform-origin` at the
   pill; phone: slides down from the header): thumbnail, name, size, price, "View bag" and "Checkout". Spring in
   (scale .96→1 + opacity + 6px), auto-dismiss after ~4s, paused while hovered/focused, dismissible by tap outside
   or swipe up. Re-adding while open updates it in place rather than stacking.
4. Optional light haptic (`navigator.vibrate(8)`) on phones at the moment of commit. Everything degrades to a
   simple fade with reduced motion.

## 4. Phone drawers and sheets: behave like the OS

A phone surface is judged in the first 100ms of touch. Make it physical:

- **Bottom sheet (bag, filters)**: radius 28px top corners, a grab handle, glass header that stays put while the
  list scrolls, sticky footer with the total and the primary action. It follows the finger 1:1 from the handle or
  header, rubber-bands past the top, and on release uses velocity projection to decide close vs. return
  (springs from `apple-design`). **The page behind recedes** — scale ~0.94, rounded corners, slight dim — tied to the
  sheet's position, exactly like iOS card presentation. This one detail sells "native" more than anything else.
- **Lists inside sheets**: rows swipe left to reveal Delete (rubber-banded, snaps open/closed by velocity);
  removal collapses the row height instead of popping. Quantity steppers are 44px targets.
- **Mobile menu**: grows out of the navbar capsule (same surface, morphs to full height) rather than a separate
  layer appearing. Big 600-weight links with category thumbnails and chevrons, staggered 30–40ms; utility row
  at the bottom (language segmented control, contact). Closes by the × morph, tap on a link, Esc, or swipe up.
- Lock body scroll while open (`overflow: hidden` on body, not html — html breaks sticky headers), return focus to
  the opener, `inert` the hidden surface, and respect `env(safe-area-inset-bottom)`.

## 5. Everything else that makes it feel expensive

- Photography leads: real photos, AVIF + WebP, `srcset` per screen, focal-point crops, blurred preview → fade in.
- One accent colour, used for state (badges, progress, focus) — not decoration.
- Hover effects only under `(hover: hover) and (pointer: fine)`; press feedback everywhere.
- Prices: show "was" prices struck through in muted colour; never let currency wrap away from the number.
- RTL: mirror directional icons and layout with logical properties; mirror lifestyle photos when copy sits on
  the side the subject faces; keep Latin strings ("100 ml") isolated with `<bdi>`.

## 6. Review loop (do this every time — design bugs only show up visually)

1. Build, serve, and capture screenshots: desktop 1440×900 and phone 390×844 @2x, English and Arabic, top of page
   and mid-scroll, plus each open state (menu open, mini-bag showing, sheet open, sheet half-dragged).
2. Look at every screenshot. Check: type sizes don't overflow at 390px; nothing hides behind floating chrome;
   header tone matches what's under it; counts and prices align; RTL mirrors correctly.
3. Exercise the interactions in a real browser script (add to bag → popover appears → badge updates; drag the sheet
   halfway and release slowly → it returns; flick → it closes; swipe a row → Delete shows).
4. Check reduced motion (`prefers-reduced-motion: reduce`) leaves fades only, and that no console errors appear.
5. Report what changed in plain words; when reviewing someone else's UI, use the Before/After/Why table from
   `emil-design-eng`.

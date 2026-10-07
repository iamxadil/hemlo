# Hemlo: Visual Identity Kit

The logo: the founder's **H**, v1, with the name in Poppins. Tagline: **Elegantly solved. / حلولٌ بإتقان.** Supporting line: *Software that earns its place.*

- Guidelines: `guidelines/hemlo-brand-guidelines.pdf`
- Source of the guidelines: `docs/brand/hemlo-brand-book.html`

## Start here

| I need… | Use |
|---|---|
| **The announcement poster** | `poster/hemlo-poster-4x5.png` (Instagram, LinkedIn, WhatsApp), `poster/hemlo-poster-a3.pdf` (print) |
| The logo on a light background | `logo/svg/hemlo-lockup.svg` (H + Hemlo) |
| The logo on a dark background | `logo/svg/hemlo-lockup-on-dark.svg` |
| Arabic / bilingual logo | `logo/svg/hemlo-lockup-ar.svg`, `hemlo-lockup-bilingual.svg`, `hemlo-lockup-stacked-bilingual.svg` |
| Profile picture | `logo/png/hemlo-avatar-1080.png` |
| Website icons | Everything in `icons/`, plus `icons/head-snippet.html` |
| Colours, fonts and spacing in code | `tokens/tokens.css`, `tokens/tailwind.preset.js`, `tokens/tokens.json` |
| Printing cards and letterhead | `print/` |

## The mark

- **The mark is the founder's H**: one soft shape, two swelling stems joined by a crossbar that slopes down to the right. It is used exactly as drawn and is always one solid colour.
- **The name** "Hemlo" is set beside it in **Poppins SemiBold** (−1%), outlined. In the lockup the H is 1.4 × the cap height, centred on the capitals, 0.44 × cap height away.
- **Colours:** ink on light, white on dark, brass for brand moments (foil, signage, the app icon on ink if wanted), and the product colour in product lockups (the name stays ink).
- **Branches:** the branch name goes **under** "Hemlo" in **Poppins Light**, and the H (in the branch colour) grows to span both lines. Files: `logo/svg/branches/` (Tools, Studio, Systems, School; English and Arabic, light and dark, plus one-colour).
- **Type:** Poppins (the logo only) · Readex Pro (display) · IBM Plex Sans + Mono (text, data) · **Vazirmatn** (Arabic and Kurdish, all Sorani letters).
- **Master file:** `source/hemlo-logo-master.svg` (the founder's drawing). `source/mark.js` reads it, and every script builds from it. Replace the master and rebuild to update the whole kit.
- Colours: Kohl Ink `#0E1420` · Safafeer Brass `#B38B3A` · Brass 300 `#D7B46A` (on dark backgrounds).
- Latin wordmark: Schibsted Grotesk SemiBold, −2% tracking, outlined.
- Arabic and Kurdish wordmarks: Noto Kufi Arabic (weight 600), shaped with HarfBuzz and outlined.
- All logo files are pure vector paths, so no fonts need to be installed.

## Folders

| Folder | Contents |
|---|---|
| `logo/svg` | **Mark (the H):** `hemlo-mark` (+ `-ink`, `-white`, `-on-dark`, `-small`, `-small-ink`). **Primary lockup (H + Hemlo):** `hemlo-lockup` (+ `-ink`, `-on-dark`, `-white`). **Stacked (H above Hemlo):** `hemlo-lockup-stacked`. **Bilingual (H Hemlo | هيملو):** `hemlo-lockup-bilingual`, `hemlo-lockup-stacked-bilingual`. **Arabic:** `hemlo-lockup-ar`. **Kurdish Sorani:** `hemlo-lockup-ckb`. **Wordmarks:** `hemlo-wordmark` (+ `-ar`, `-ckb`, white versions). **App icons:** `hemlo-app-icon`. **Animated:** `hemlo-logo-animated.svg` (the name settles, then the H slides into place; for websites). Colour variants throughout: default, `-on-dark`, `-ink`, `-white`. |
| `logo/png` | Transparent PNGs of the main marks and lockups (1024px marks, 1600–2000px lockups), app icon and avatar |
| `icons` | `favicon.ico` (16/32/48), `favicon.svg` (switches colour in dark mode), `favicon-16/32/48.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `site.webmanifest`, `head-snippet.html` |
| `pattern` | The brand pattern (the H monogram in offset rows): `hemlo-pattern-tile.svg` plus 2400×1600 PNGs on ink, stone and brass. Use at low opacity, never behind body text. |
| `social` | `linkedin-banner-1584x396.png`, `x-header-1500x500.png`. The left side is kept clear for the profile photo. |
| `poster` | The announcement poster: `hemlo-poster-4x5.png` (2160×2700), `hemlo-poster-a3.pdf` (vector, print), `hemlo-poster-a3-preview.png` |
| `print` | `hemlo-business-card.pdf`: 91×61 mm including 3 mm bleed (trim to 85×55). Page 1 front, page 2 back, page 3 foil plate. `hemlo-letterhead-a4.pdf` |
| `email` | `signature.html` (paste into Gmail or Outlook) and `hemlo-lockup-email.png` (host it online and update the image link) |
| `tokens` | `tokens.css` (light + `[data-theme="dark"]`), `tailwind.preset.js`, `tokens.json` |
| `guidelines` | `hemlo-brand-guidelines.pdf`: the full brand book as a PDF |
| `mockups/png` | Flat mockups: cover, social square, story, cards, app icon, website, identity sheet |
| `mockups/realistic/png` | Realistic mockups at 3200×2000: stationery, company stamp, reception sign, phone, embossed paper, website display |
| `source` | `hemlo-logo-master.svg` (the founder's H), `wordmark.js` (outlines "Hemlo" and the branch names in Poppins into `wordmark.json`), `mark.js` (reads both; used by every script), `build.js` (marks, lockups, flat mockups), `realistic.js` (realistic mockups), `complete.js` (everything else), plus the fonts they use (Poppins, Readex Pro, Vazirmatn) and `explorations/` (earlier logo work) |

### Rebuilding

```
npm i harfbuzzjs@0.4.7
node source/wordmark.js
node source/build.js
node source/realistic.js
node source/complete.js
node source/complete.js ico
```

The HTML pages these scripts generate are rendered to PNG and PDF with headless Edge: `node source/render.js jobs.json` (see `render-jobs.json` for the format).

## Print notes

- **Business card:**
  - Stock: 350–400 gsm uncoated cotton or matt.
  - The back is ink `#0E1420` with the mark in brass foil. Page 3 of the PDF is the foil plate: 100% black marks where the foil goes.
  - Without foil, print the mark in `#D7B46A` / CMYK approx. 15 25 65 0.
  - Ink in CMYK is approx. 85 75 50 70. Ask the printer for a proof.
- **Letterhead:** A4, 100–120 gsm. The header and footer are printed; letter text goes in the white area.
- **Company stamp (رسمي):** the mark in the centre, with "HEMLO · ELEGANTLY SOLVED · IRAQ · 2026" around the ring and «هيملو» below. This is the one approved exception to the "no ring around the mark" rule.

## Placeholders to replace

Business card, letterhead and email signature show "Your Name", `+964 7XX XXX XXXX` and `hemlohq.com`. Put your details into `source/complete.js` and `source/realistic.js`, then rebuild. **hemlohq.com** is the domain; register it (with WHOIS privacy and auto-renew) before printing anything that shows it.

## Announcement

**English**

> **Hemlo, coming soon.**
> I'm building Hemlo: a family of small, focused software products for the everyday work of Iraqi businesses. Each one starts with time spent inside real shops, offices and workshops, and does one job properly.
> The name comes from the hem: the folded, stitched edge that keeps fabric from fraying. The mark is a single soft H, two panels joined by one seam. Software with no loose threads.
> Elegantly solved.

**Arabic**

> **هيملو — قريباً.**
> أعمل على هيملو: مجموعة برامج صغيرة ومركّزة للشغل اليومي للشركات والمحلات في العراق. كل منتج يبدأ من وقت نقضيه داخل المحلات والمكاتب والورش، ويؤدي مهمة واحدة بشكل صحيح.
> الاسم مأخوذ من «الهِم» (Hem): حافة القماش المطويّة والمخيطة التي تمنع الخيوط من الانفلات. الشعار حرف H واحد ناعم: لوحان تجمعهما درزة واحدة. برامج بلا خيوط سائبة.
> حلولٌ بإتقان.

**Suggested carousel:**

1. `poster/hemlo-poster-4x5.png`
2. `mockups/realistic/png/03-reception-sign.png`
3. `01-stationery`
4. `05-embossed`
5. `02-company-stamp`
6. `04-phone-desk`
7. `06-website-display`
8. `mockups/png/07-identity-sheet.png`

# Hemlo Tools

Free, genuinely useful tools for Iraqi businesses. They will live at **tools.hemlohq.com**.

Every tool follows the same rules:

- **It runs in the browser.** No account, no server and nothing to pay for hosting. Data stays on the user's device.
- **It is Arabic first,** with English (and Kurdish where it matters). Money is in IQD and USD.
- **It solves one real, recurring task in under two minutes.**
- **Every output carries a quiet "Made with Hemlo Tools" line** and leads to the right paid branch.

## The apps

| Folder | Tool | Status | Leads to |
|---|---|---|---|
| `invoice-maker/` | **Invoice & quotation maker** · صانع الفواتير وعروض الأسعار | **v1 built** | Systems |
| `salary-calculator/` | Salary & social-security calculator · حاسبة الراتب والضمان | Next | Studio (payroll), Systems |
| `landed-cost/` | Import landed-cost estimator · حاسبة كلفة الاستيراد | Planned | Studio |
| `repair-receipt/` | Repair receipt & warranty card · وصل التصليح وكارت الضمان | **v1 built** | Systems (Workshops) |
| `shop-page/` | Free one-page site for a shop · صفحة محلك مجاناً | Later (needs light storage) | Studio |
| `shared/` | Brand assets and shared code (`tafqit.js`: amounts in words) | — | — |

**Deliberately not built:**

- **Standalone تفقيط:** at least five free Iraqi-dinar tools already exist. It lives inside the invoice maker instead.
- **A debt notebook:** Daftari, دفتر ديوني, Teajar and Dofaa already cover it.
- **QR makers and date converters:** they're everywhere.

## Work on a tool

Open `invoice-maker/index.html` in a browser. There is no build step while editing.

Two demo links fill in a sample document in either tool:

- `#demo` (Arabic)
- `#demo-en` (English)

## Build

```
node build.js
```

**`dist/` is the optimised site for tools.hemlohq.com:**

- Each tool is **one minified file** with its CSS and JS inlined. The invoice maker is about 40 KB, roughly 10 KB compressed.
- **Self-hosted fonts:** only Vazirmatn (Arabic, including Kurdish letters) and Readex Pro (Latin), 76 KB in total, cached for 30 days.
- **Offline:** a service worker keeps the tools working after the first visit, even with no signal.
- **An installable app** (`manifest.webmanifest`), so it can be added to the phone's home screen.
- **For search and sharing:** the hub page, `robots.txt`, `sitemap.xml`, structured data, and a share image (`og.png`) per tool.
- **`_headers`:** caching and security headers.

**`dist-offline/`** has one self-contained `.html` per tool, with fonts and images embedded, to send on WhatsApp or put on a USB stick.

## Publish

```
node build.js
npx wrangler deploy
```

This serves `dist/` at **tools.hemlohq.com** as free Cloudflare static assets. The config is in `wrangler.jsonc`.

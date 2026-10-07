# Hemlo Ecosystem Design

**One brand, four branches: what each one does, how they connect, how they make money, and the system that runs them at $0 until the first subscriber**

Version 1 · 27 September 2026 · Builds on the brand book, `tech-stack-plan.md` and the $0 launch decision.

---

## 1. The ecosystem at a glance

Hemlo is the parent brand. Under it sit **four branches**, each with its own job, audience, address and colour, all sharing one account system, one design language and one platform.

<div style="margin:5mm 0 6mm">
<svg viewBox="0 0 680 330" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;font-family:'IBM Plex Sans',sans-serif">
  <defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#8A919C"/></marker></defs>
  <rect x="235" y="110" width="210" height="110" rx="12" fill="#0E1420"/>
  <g transform="translate(252 124) scale(1.15)"><path d="M16.298 3.894L15.781 3.547C14.576 2.739 12.958 3.602 12.958 5.053L12.958 11.671L11.742 11.2C11.32 11.037 11.042 10.631 11.042 10.178L11.042 7.162C11.042 5.289 10.109 3.539 8.553 2.496L6.602 1.187C5.874 0.699 4.896 1.221 4.896 2.097L4.896 15.368C4.896 17.605 6.037 19.687 7.923 20.89L9.357 21.805C10.087 22.271 11.042 21.747 11.042 20.882L11.042 14.878C11.042 14.108 11.815 13.578 12.533 13.856L12.958 14.021L12.958 16.586C12.958 19.068 14.224 21.378 16.317 22.713C17.523 23.483 19.104 22.616 19.104 21.184L19.104 9.155C19.104 7.043 18.052 5.07 16.298 3.894Z" fill="#F4F3EF"/></g>
  <text x="288" y="147" font-family="Schibsted Grotesk" font-weight="600" font-size="17" fill="#F4F3EF">Hemlo Core</text>
  <text x="252" y="172" font-size="9.5" fill="#A3ABB8">Hemlo ID · organizations · plans &amp; billing</text>
  <text x="252" y="187" font-size="9.5" fill="#A3ABB8">payments · notifications · files · audit</text>
  <text x="252" y="202" font-size="9.5" fill="#A3ABB8">design system · Arabic / Kurdish / English</text>
  <g><rect x="20" y="20" width="190" height="84" rx="10" fill="#FFFFFF" stroke="#E2E2DB"/><rect x="20" y="20" width="6" height="84" rx="3" fill="#3B5BC4"/>
  <text x="38" y="46" font-family="Schibsted Grotesk" font-weight="600" font-size="15" fill="#0E1420">Hemlo Tools</text>
  <text x="38" y="64" font-size="9.5" fill="#5E6776">Free tools · tools.hemlohq.com</text>
  <text x="38" y="80" font-size="9.5" fill="#5E6776">Brings people in</text>
  <text x="196" y="94" text-anchor="end" font-family="IBM Plex Mono" font-size="8.5" fill="#3B5BC4">FREE</text></g>
  <g><rect x="470" y="20" width="190" height="84" rx="10" fill="#FFFFFF" stroke="#E2E2DB"/><rect x="470" y="20" width="6" height="84" rx="3" fill="#0F766E"/>
  <text x="488" y="46" font-family="Schibsted Grotesk" font-weight="600" font-size="15" fill="#0E1420">Hemlo Studio</text>
  <text x="488" y="64" font-size="9.5" fill="#5E6776">Custom work · studio.hemlohq.com</text>
  <text x="488" y="80" font-size="9.5" fill="#5E6776">Websites, apps, systems</text>
  <text x="646" y="94" text-anchor="end" font-family="IBM Plex Mono" font-size="8.5" fill="#0F766E">QUOTED</text></g>
  <g><rect x="20" y="226" width="190" height="84" rx="10" fill="#FFFFFF" stroke="#E2E2DB"/><rect x="20" y="226" width="6" height="84" rx="3" fill="#A8532E"/>
  <text x="38" y="252" font-family="Schibsted Grotesk" font-weight="600" font-size="15" fill="#0E1420">Hemlo Systems</text>
  <text x="38" y="270" font-size="9.5" fill="#5E6776">Systems per trade · systems.hemlohq.com</text>
  <text x="38" y="286" font-size="9.5" fill="#5E6776">Subscription plans</text>
  <text x="196" y="300" text-anchor="end" font-family="IBM Plex Mono" font-size="8.5" fill="#A8532E">PLANS</text></g>
  <g><rect x="470" y="226" width="190" height="84" rx="10" fill="#FFFFFF" stroke="#E2E2DB"/><rect x="470" y="226" width="6" height="84" rx="3" fill="#6E4A86"/>
  <text x="488" y="252" font-family="Schibsted Grotesk" font-weight="600" font-size="15" fill="#0E1420">Hemlo School</text>
  <text x="488" y="270" font-size="9.5" fill="#5E6776">School management · school.hemlohq.com</text>
  <text x="488" y="286" font-size="9.5" fill="#5E6776">Subscription plans</text>
  <text x="646" y="300" text-anchor="end" font-family="IBM Plex Mono" font-size="8.5" fill="#6E4A86">PLANS</text></g>
  <path d="M210 62 C 250 62 250 110 262 110" fill="none" stroke="#C9CDD3" stroke-width="1.4"/>
  <path d="M470 62 C 430 62 430 110 418 110" fill="none" stroke="#C9CDD3" stroke-width="1.4"/>
  <path d="M210 268 C 250 268 250 220 262 220" fill="none" stroke="#C9CDD3" stroke-width="1.4"/>
  <path d="M470 268 C 430 268 430 220 418 220" fill="none" stroke="#C9CDD3" stroke-width="1.4"/>
  <path d="M110 104 L110 222" fill="none" stroke="#8A919C" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#ar)"/>
  <text x="118" y="168" font-size="8.5" fill="#5E6776">upgrade</text>
  <path d="M210 290 C 330 312 350 312 470 290" fill="none" stroke="#8A919C" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#ar)"/>
  <text x="340" y="326" text-anchor="middle" font-size="8.5" fill="#5E6776">"Custom plan" → Studio</text>
  <path d="M565 226 L565 108" fill="none" stroke="#8A919C" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#ar)"/>
  <text x="572" y="168" font-size="8.5" fill="#5E6776">custom</text>
</svg>
</div>

| Branch | Arabic | Address | Colour | Job in the business | How it earns |
|---|---|---|---|---|---|
| **Hemlo** (parent) | هيملو | `hemlohq.com` | Ink + Brass | The hub: brand, trust, routes people to branches | Doesn't sell anything itself |
| **Hemlo Tools** | هيملو · الأدوات | `tools.hemlohq.com` | Cobalt `#3B5BC4` | Free, useful tools that bring businesses in and show which branch they need | **Free forever**; leads to paid branches |
| **Hemlo Studio** | هيملو · ستوديو | `studio.hemlohq.com` | Teal `#0F766E` | Custom websites, apps and systems, including custom plans for other branches | **Quoted per project** + maintenance retainers |
| **Hemlo Systems** | هيملو · الأنظمة | `systems.hemlohq.com` | Rust `#A8532E` | Ready-made systems, one edition per trade; first edition: repair workshops (inventory, job cards, warranty) | **Monthly / annual plans** |
| **Hemlo School** | هيملو · المدارس | `school.hemlohq.com` | Plum `#6E4A86` | Complete management for private schools and kindergartens | **Plans by student count** |

### How the branches feed each other

1. **Tools brings people in.** A workshop owner uses the free receipt generator, and a school accountant uses the fee-schedule tool.
2. **Every tool has a natural next step** into a paid branch: "Save your receipts and track stock → try Hemlo Systems."
3. **Every paid branch has a "Custom" plan** that sends the customer to **Studio** with their details already filled in.
4. **Studio earns money from day one** (custom work needs no servers). That revenue funds building the products.
5. **One Hemlo account (Hemlo ID)** works everywhere, so a customer who joins one branch can add another in two clicks.

---

## 2. The brand rules for branches

- **Naming:** "Hemlo" + one descriptor word. In Arabic the descriptor is a label after a middle dot (`هيملو · الأنظمة`), so it never reads like a company name.
- **Logo:** the founder's **H** with "Hemlo" in Poppins SemiBold. In a branch logo **the branch name goes under "Hemlo" in Poppins Light**, and the H takes the branch colour (the parent keeps ink or brass). The H alone, on a tile in the branch colour, is each branch's app icon. Files: `brand/logo/svg/branches/`.
- **One design system (`@hemlo/ui`)** for every branch. A branch changes only its accent colour, its icons and its content.
- **Tools always carries a "Free" badge,** so it's never mistaken for a paid product.
- **Custom work always says Studio.** "Custom plan" buttons in Systems and School open a Studio brief, never a hidden sales process.

| Branch | H colour | Branch name | Logo files |
|---|---|---|---|
| Hemlo | Ink (brass for brand moments) | none | `hemlo-lockup.svg` |
| Tools | Cobalt `#3B5BC4` | "Tools" under "Hemlo", Poppins Light · *Free* badge | `branches/hemlo-tools*.svg` |
| Studio | Teal `#0F766E` | "Studio" under "Hemlo", Poppins Light | `branches/hemlo-studio*.svg` |
| Systems | Rust `#A8532E` | "Systems" under "Hemlo", Poppins Light | `branches/hemlo-systems*.svg` |
| School | Plum `#6E4A86` | "School" under "Hemlo", Poppins Light | `branches/hemlo-school*.svg` |

---

## 3. Hemlo Tools: free, forever (`tools.hemlohq.com`)

### Purpose
Genuinely useful, Iraq-specific tools that cost **$0 to run**, because they work entirely in the visitor's browser. They bring businesses to Hemlo, build trust, rank in search, and tell you which paid branch attracts the most interest.

### Rules for every tool
- It must solve a **real, recurring Iraqi task** in under two minutes.
- It **runs in the browser**: no account, no server, no cost. Accounts are optional, only to *save* results.
- Arabic first, with English and Kurdish where relevant. Documents come out as **clean PDFs** (browser print with correct Arabic shaping).
- Every result carries a small "Made with Hemlo Tools" line, and a **next step** to the right branch.
- Estimates are clearly labelled as estimates. No tool gives legal or tax advice.

### The tools

**Launch set (build first):**

| Tool | Arabic | What it does | Why Iraqis need it | Leads to |
|---|---|---|---|---|
| **Invoice & quotation maker** | صانع الفواتير وعروض الأسعار | Bilingual invoices and quotes in IQD/USD, with logo, stamp area and QR; exports to PDF | Most small businesses still write these by hand or in Word | Systems |
| **Amount in words (تفقيط)** | تفقيط المبالغ | Converts numbers to written Arabic and English words ("مليون ومئتان وخمسون ألف دينار عراقي فقط لا غير") | Required on cheques, invoices and contracts; people type it by hand and make mistakes | Systems, School |
| **Repair receipt & warranty card** | وصل التصليح وكارت الضمان | Job receipt with the customer's device and fault, warranty period and QR; prints on A5 or thermal paper | Systems lose track of what they received and what's under warranty | Systems |
| **School fee instalment planner** | مخطط أقساط المدرسة | Splits annual fees into instalments, with due dates, a family statement and receipts | School accountants rebuild this every year in Excel | School |
| **Import landed-cost estimator** | حاسبة كلفة الاستيراد | Estimates duties, tax deposits, shipping and fees for a shipment in IQD/USD | New 2026 customs rules made import costs hard to predict | Studio (custom import systems) |

**Second wave:**

| Tool | Arabic | What it does | Leads to |
|---|---|---|---|
| Salary & social-security calculator | حاسبة الرواتب والضمان | Employee net pay and Daman contributions (12% employer / 5% employee) | Studio (payroll), Systems |
| Stock count sheet | ورقة جرد المخزون | A printable or phone checklist for counting stock, with a totals summary | Systems |
| Class timetable builder | منظم الجدول الدراسي | Drag-and-drop weekly timetable per class, exported to PDF | School |
| Report card maker | صانع الشهادات المدرسية | Bilingual report cards from a simple grade table | School |
| Hijri ↔ Gregorian date converter | محول التاريخ | Fast, with printable calendars | Everyone (search traffic) |
| QR maker for businesses | صانع رمز QR | WhatsApp, location and menu QR codes with a clean frame | Systems |
| Project cost estimator | حاسبة كلفة المشروع البرمجي | Choose what you need (site, app, system) and get a price range | **Studio** (becomes a real brief) |

### Growth mechanics
- Every tool page is a **search landing page** in Arabic ("برنامج فواتير مجاني", "تفقيط المبالغ", "حاسبة كلفة الاستيراد العراق").
- Results are **shareable** (PDF or link), which spreads the brand through WhatsApp.
- An optional free **Hemlo ID** saves history, templates and your logo. That's the bridge to paid branches.
- Track which tools convert to which branch; build more of what converts.

---

## 4. Hemlo Studio: custom work (`studio.hemlohq.com`)

### Purpose
Custom websites, web apps, mobile apps and business systems for organizations whose needs don't fit a standard plan, **including "Custom" plans of Systems and School**. Studio is also the fastest route to revenue: it needs no infrastructure and pays for building the products.

### Services

| Service | Arabic | Typical scope |
|---|---|---|
| Business websites | مواقع الشركات | Bilingual site, pages, contact/WhatsApp, basic search optimisation |
| Online stores & catalogues | المتاجر الإلكترونية | Catalogue, orders, COD, FIB/ZainCash payment links |
| Web applications | تطبيقات الويب | Portals, dashboards, booking, internal tools |
| Mobile apps | تطبيقات الموبايل | Built once for iOS and Android |
| Custom business systems | الأنظمة المخصصة | ERP-style modules, approvals, reporting, integrations |
| Custom plans for Systems / School | الخطط المخصصة | Extra modules, integrations, migration, on-site training on top of a Hemlo product |
| Care plans (maintenance) | خطط الرعاية | Hosting, updates, backups, small changes, support hours |

### Flexible pricing (how quotes are built)
Studio prices are **quoted, not listed**, using one transparent formula so they stay consistent:

> **Quote = base package + modules + complexity + integrations + delivery speed**, then an optional **monthly care plan**.

| Part | How it works |
|---|---|
| **Base package** | A fixed starting price per service type (site, store, web app, mobile app, system) |
| **Modules** | Each extra feature has a price (e.g., booking, payments, multi-language, admin roles, reports) |
| **Complexity** | ×1.0 simple · ×1.3 moderate · ×1.6 complex (data migration, approvals, heavy logic) |
| **Integrations** | Priced per integration (FIB/ZainCash, WhatsApp API, SMS, accounting export) |
| **Delivery speed** | Standard, or rush (+25%) |
| **Payment terms** | 50% deposit, 30% at the midpoint milestone, 20% on delivery; larger projects by milestone |
| **Care plan** | Monthly retainer tiers (Basic / Business / Priority) by included hours and response time |

Starting prices are **hypotheses to calibrate after the first five quotes**. Keep a quote log (brief → price → hours actually spent) and adjust the base prices every quarter.

### The Studio website and portal
- **Public site:** services, portfolio (starting with Hemlo's own branches and brand kit), the process, and a **"Build your quote" configurator**. The configurator is the Project cost estimator from Tools, which turns into a brief.
- **Client portal (after sign-in):** project status and milestones, shared files, change requests, invoices and payment links, and care-plan hours.
- **The process:** brief → estimate → discovery call → fixed quote → deposit → milestones → delivery → care plan.

### Guardrails
- Studio must **not** swallow product time. Cap Studio at a fixed share of the week (e.g., 50%) and review monthly.
- Reusable work from Studio projects feeds the shared platform (`@hemlo/ui`, core packages). Customer-specific code stays in the customer's project.
- Every project has a written scope. Changes go through change requests with a price.

---

## 5. Hemlo Systems: one core, an edition per trade (`systems.hemlohq.com`)

### Editions
One shared core (customers and WhatsApp, stock, checkout/POS and receipts, payments, staff and permissions, reports, offline sync) with an **edition** per kind of business on top. Editions are built **one at a time**, and the next starts only when the current one has about 10 paying customers.

| Order | Edition | Adds on top of the core | Status |
|---|---|---|---|
| 1 | **Workshops** (repair, installation, service) | Job cards, device status, "ready" WhatsApp, parts per job, warranty | First |
| 2 | Appointment businesses (salons, clinics, car services) | Appointments and services; reuses most of the workshop screens | Planned; check Iraqi competitors first |
| 3 | Cafés and restaurants | Tables, kitchen orders, menu | Planned; crowded market (QR Iraq, Ejaf, RA8M) |
| 4 | Stores | Barcode, fast checkout, suppliers | Planned; crowded market (RA8M, Geno) |
| 5 | Hotels | Rooms, bookings calendar, check-in/out, housekeeping | Last; custom Studio projects until then |

POS is not a separate product: it is the core checkout, fitted to each edition. The rest of this section describes the first edition.

### Positioning
Generic inventory and point-of-sale software is crowded in Iraq (Geno, Giturn, Al-Ameen, Daftra, Invent ERP and others). Systems wins by being **built for businesses that repair, install and service**: mechanics, AC and refrigeration, phone and electronics repair, generators, solar installers, carpentry and metal shops. They need **stock + jobs + warranty** in one place, which generic tools don't do well.

### What's in it

**MVP (first release):**
- **Items & stock:** parts and products, barcodes/QR, units, cost and sale price in IQD/USD, minimum stock alerts
- **Stock movements:** receive, sell, use in a job, adjust, transfer; a full history per item
- **Job cards:** customer, device or vehicle, reported fault, parts used (deducted from stock), labour, status, pickup
- **Warranty:** a warranty period per job or part, a QR warranty card, and a warranty lookup
- **Sales & receipts:** quick sale, bilingual receipt, cash / FIB / ZainCash / credit
- **Customers & credit:** balances, WhatsApp statement links
- **Reports:** stock value, low stock, jobs by status, sales by day

**Later:**
- Purchase orders and suppliers
- Multiple branches and stock transfers
- Technician app with offline use
- Thermal printer support
- Accounting export
- A public API

### Plans (starting hypotheses in IQD; validate before launch)

| Plan | For | Includes | Price / month |
|---|---|---|---|
| **Free trial** | Everyone | Full Pro plan for 30 days | 0 |
| **Starter** | One-person shop | 1 location · 2 users · up to 1,000 items · jobs · receipts | ≈ 25,000 |
| **Pro** | Growing workshop | 1 location · 5 users · unlimited items · warranty · WhatsApp statements · reports | ≈ 50,000 |
| **Business** | Several branches | Up to 3 locations · 15 users · transfers · purchase orders · priority support | ≈ 100,000 |
| **Custom** | Special needs | Anything beyond Business | **→ Hemlo Studio** (quoted) |

Annual billing gets two months free. Anchor for comparison: Geno Cloud ERP charges about $9 per user per month with a minimum of 5 users.

---

## 6. Hemlo School: school management (`school.hemlohq.com`)

### Positioning
School management systems exist in the region. School wins by being **Iraq-native and parent-friendly**:
- Arabic-first, with Kurdish for the Kurdistan Region.
- Fee instalments and reminders built around how Iraqi families actually pay.
- Parents get **WhatsApp links**, not another app to install.
- Report cards follow the Iraqi grading conventions each school uses (configurable).

### What's in it

**MVP (first release):**
- **Students & families:** profiles, guardians, documents, siblings linked
- **Admissions:** applications, interviews, acceptance, enrolment
- **Classes & sections:** grades, sections, class teachers, subjects
- **Fees:** fee plans, instalments, discounts (siblings, staff), receipts, overdue lists, **WhatsApp reminders with statement links**, and FIB/ZainCash/cash payments
- **Attendance:** daily by class, from a teacher's phone (works offline), with absence alerts to parents
- **Grades & report cards:** configurable grading scales, bilingual report cards as PDFs
- **Announcements:** to classes, grades or the whole school, delivered as links

**Later:**
- Timetables
- Staff and payroll
- Exams and question banks
- Transport routes and bus fees
- Library
- A parent portal with a family login
- Ministry reports

### Plans (starting hypotheses in IQD; validate with schools)

| Plan | For | Includes | Price |
|---|---|---|---|
| **Free trial** | Every school | Full Pro plan for 30 days | 0 |
| **Kindergarten** | Up to 150 students | Students, fees, attendance, announcements | ≈ 100,000 / month |
| **Pro** | Up to 600 students | Everything in the MVP | ≈ 200,000 / month |
| **Campus** | Up to 1,500 students, several campuses | Pro + multi-campus + priority support | ≈ 350,000 / month |
| **Custom** | Larger groups or special needs | Integrations, migration, on-site training | **→ Hemlo Studio** (quoted) |

Annual plans are paid per term or per year (schools budget by year). Sell before the school year starts.

---

## 7. The shared platform: Hemlo Core

Every branch uses the same core services. This is what makes four branches possible for one person.

| Core service | What it does | Used by |
|---|---|---|
| **Hemlo ID** (`account.hemlohq.com`) | One login for all branches. Phone or email codes, organizations, members, roles | All |
| **Organizations & roles** | A business, school or client, with members, roles (owner, admin, staff, teacher, parent) and branch access | All |
| **Plans, subscriptions & entitlements** | Which organization has which branch and plan, trials, limits (users, items, students) | Systems, School, Studio care plans |
| **Billing & payments** | Invoices in IQD/USD; FIB, ZainCash, bank transfer and cash (recorded); receipts; reminders | All paid branches |
| **Notifications** | WhatsApp links / Cloud API, SMS codes, email, in-app | All |
| **Files** | Uploads (documents, photos, logos) to R2 with signed links | All |
| **Audit log** | Who changed what and when, for money and records | All |
| **Documents engine** | Bilingual PDF templates (invoices, receipts, report cards, warranty cards) | Tools, Systems, School, Studio |
| **Design system** (`@hemlo/ui`) | Components, tokens, right-to-left, dark mode, branch accents | All |
| **i18n** | Arabic, Kurdish, English; IQD formatting; amount in words; Hijri/Gregorian | All |
| **Leads & briefs** | "Custom plan" requests and tool-to-branch sign-ups, handed to Studio or sales | Tools, Studio, all "Custom" buttons |

---

## 8. System architecture

### Addresses

| Address | What lives there |
|---|---|
| `hemlohq.com` | The parent website (hub), in Arabic and English |
| `tools.hemlohq.com` | All free tools (static and browser-only) |
| `studio.hemlohq.com` | The Studio website + the client portal |
| `systems.hemlohq.com` | The Systems website + the app (`/app`) |
| `school.hemlohq.com` | The School website + the app (`/app`) |
| `account.hemlohq.com` | Hemlo ID: login, organizations, billing, plans |
| `api.hemlohq.com` | The one shared API (all branches) |
| `admin.hemlohq.com` | Your internal back office (customers, plans, payments, support) |
| `status.hemlohq.com` | A public status page (later) |

The login cookie is set on `.hemlohq.com`, so signing in once works on every branch.

### How it runs at $0

```
 Visitors (Iraq)
      │
 ┌────▼──────────────────── Cloudflare (free) ─────────────────────────────┐
 │  DNS · TLS · CDN (Baghdad PoP) · WAF                                     │
 │                                                                           │
 │  Websites & apps (Next.js 16)        API (Hono on Workers)               │
 │   hemlohq.com  tools.  studio.        api.hemlohq.com                    │
 │   systems.    school.  account.        /v1/core  /v1/systems             │
 │   admin.                               /v1/school /v1/studio             │
 │                                                                           │
 │  Queues + scheduled jobs (reminders, WhatsApp, PDFs)   R2 (files)        │
 └──────────────────────────────┬──────────────────────────────────────────┘
                                │ Hyperdrive / serverless driver
                     ┌──────────▼──────────┐
                     │  Neon Postgres (free)│  one database, one schema per branch
                     └─────────────────────┘
```

| Layer | Technology | Why |
|---|---|---|
| Websites & apps | **Next.js 16** on Cloudflare (OpenNext) | One framework for every site and app; free hosting |
| Free tools | Next.js static pages, logic in the browser | Zero server cost, works even at scale |
| API | **Hono** on Cloudflare Workers | Runs free on Workers now, and on a normal Node server later with no rewrite |
| Database | **PostgreSQL (Neon free)** + **Drizzle** | Real transactions for money; the same database when you upgrade |
| Login | **Better Auth** (organizations, phone/email codes) | Your own users in your own database. Codes instead of passwords keep CPU use inside the free limit. |
| Files | **Cloudflare R2** | 10 GB free, no download fees |
| Background work | **Cloudflare Queues + Cron** | Reminders, messages and scheduled reports inside the free limits |
| Documents | HTML templates → PDF (browser print for Tools; a rendering service later for apps) | Correct Arabic shaping |
| Design | **Tailwind v4** + **React Aria** + brand tokens | One consistent Hemlo look, right-to-left by default |

### One database, a schema per branch

| Schema | Holds |
|---|---|
| `core` | users, organizations, members, roles, plans, subscriptions, invoices, payments, files, audit, notifications, leads |
| `systems` | items, stock movements, locations, job cards, warranties, sales, customers, credit |
| `school` | students, guardians, classes, sections, subjects, fee plans, instalments, attendance, grades, report cards |
| `studio` | clients, briefs, quotes, projects, milestones, change requests, care plans, time logs |
| `tools` | (optional) saved results and templates for signed-in users |

- Every business table has `org_id`, and **row-level security** keeps organizations apart.
- Branches never read each other's tables directly. They go through Core (for example, a Systems "Custom plan" creates a **lead** in Core, which Studio picks up).
- Because each branch has its own schema, API routes and app, any branch can later **move to its own service or database** without touching the others.

### Codebase (one repository)

```
hemlo/
├─ apps/
│  ├─ hub/         hemlohq.com
│  ├─ tools/       tools.hemlohq.com     (static, browser-only)
│  ├─ studio/      studio.hemlohq.com    (site + client portal)
│  ├─ systems/     systems.hemlohq.com   (site + /app)
│  ├─ school/      school.hemlohq.com    (site + /app)
│  ├─ account/     account.hemlohq.com   (Hemlo ID, billing)
│  ├─ admin/       admin.hemlohq.com     (internal)
│  └─ api/         api.hemlohq.com       (Hono: /v1/core, /v1/systems, /v1/school, /v1/studio)
└─ packages/
   ├─ ui/          design system + branch themes
   ├─ core/        money (IQD/USD), ids, dates (Hijri/Gregorian), amount-in-words, Arabic search
   ├─ db/          Drizzle schemas (core, systems, school, studio), migrations, security rules
   ├─ auth/        Better Auth setup
   ├─ billing/     plans, entitlements, invoices, payment adapters (FIB, ZainCash, cash)
   ├─ notify/      WhatsApp, SMS, email
   ├─ documents/   bilingual PDF templates
   ├─ i18n/        ar, ckb, en
   └─ branch-*/    each branch's business rules (systems, school, studio)
```

### Plans and entitlements (how one system sells four branches)

- An **organization** holds **subscriptions**, one per branch (e.g., Systems Pro + a Studio care plan).
- Each plan defines **entitlements**: limits (users, items, students, locations) and features (warranty, transfers, multi-campus).
- The app checks entitlements, never plan names. Changing a price or plan never requires code changes.
- **Trials** are subscriptions with an end date. Downgrades keep data read-only instead of deleting it.
- Invoices are generated monthly or annually and paid by FIB/ZainCash links or recorded as cash or bank transfer. Unpaid invoices get WhatsApp reminders, then a grace period, then read-only mode.

### The "Custom plan" flow (Systems or School → Studio)

1. The customer clicks **Custom** on a pricing page.
2. A short brief opens, pre-filled with their organization, current plan, size and branch.
3. A **lead** is created in Core, and you get a WhatsApp/email notification.
4. Studio replies with a discovery call and a quote. If accepted, it becomes a **Studio project**.
5. Delivered custom modules are enabled for that one organization through **entitlements** (feature flags). The product stays one codebase.

---

## 9. Money: $0 until the first subscriber

| Stage | Trigger | What you pay for | Monthly |
|---|---|---|---|
| **Launch** | Now | Nothing. Cloudflare free, Neon free, R2 free, free email tier. (Domain: hemlohq.com, about $12 a year.) | **$0** |
| **First Studio client** | A signed quote | Nothing new. Studio work is invoiced and paid, and funds the next step. | **$0** |
| **First subscriber** (Systems or School) | First payment | Cloudflare Workers paid (≈ $5) for higher limits; paid messaging only as needed | **≈ $5–10** |
| **~10–20 paying organizations** | Revenue covers it | Neon paid (backups, more storage); a PDF rendering service | **≈ $30–60** |
| **Growth** | Limits reached | Follow the growth path in `tech-stack-plan.md`: more capacity, a separate branch service if needed, possibly a server or an Iraqi data center | Scales with revenue |

**Free-tier limits to watch** (September 2026):
- Workers: 100,000 requests a day and 10 ms of CPU per request.
- Queues: 10,000 operations a day.
- Cron: 3 schedules.
- R2: 10 GB.
- Neon: 0.5 GB of storage and 100 compute-hours a month.

Upgrade *before* hitting a limit, not after, once revenue allows.

---

## 10. Build order

| Step | What | Why first | Cost |
|---|---|---|---|
| **1** | `hemlohq.com` hub (Arabic + English), with the four branches presented and "notify me" sign-ups | The brand goes live; you can announce | $0 |
| **2** | `tools.hemlohq.com` with the **launch set of 5 tools** | Brings people in and shows which branch has demand | $0 |
| **3** | `studio.hemlohq.com`: services, portfolio, quote configurator, brief form | **Earns money soonest** with no infrastructure | $0 |
| **4** | Hemlo Core: Hemlo ID, organizations, plans, billing, notifications | Needed before any paid product | $0 |
| **5** | **Systems MVP**, or **School MVP** (whichever Tools and conversations show more demand for) | Deliberately one at a time | $0 until the first subscriber |
| **6** | The second product | After the first has paying customers | Paid from revenue |

**Rule:** don't build two products at the same time. Let the free tools and Studio conversations decide which product comes first.

---

## 11. Metrics per branch

| Branch | What to measure |
|---|---|
| Hub | Visits → branch clicks; "notify me" sign-ups per branch |
| Tools | Uses per tool per week; PDFs created; shares; tool → branch sign-up rate |
| Studio | Briefs received; quote acceptance rate; average project value; care-plan retention; hours per project vs quoted |
| Systems | Trials started; trial → paid; active locations; monthly churn; job cards per week |
| School | Schools in trial; students under management; fee collection rate after reminders; renewals per year |
| Core | Monthly recurring revenue; payment success (FIB/ZainCash/cash); support requests per customer |

---

## 12. Risks and how the design handles them

| Risk | Mitigation |
|---|---|
| Four branches spread one person too thin | One product at a time (step 5). Tools are small and static. Studio is capped. |
| Systems and School face existing competitors | Niche positioning: stock + jobs + warranty for trades; Iraq-native fees and WhatsApp for schools. Validate with 10 conversations each before building. |
| Studio work crowds out product work | A weekly cap, a monthly review, and only reusable parts flow into the platform |
| Free-tier limits or price changes | Hono and Postgres are portable. Moving to paid tiers or a €6 server needs no rewrite. |
| Tools give wrong numbers (customs, salaries) | Clearly labelled estimates, a sources note on each tool, a "last updated" date |
| Payment collection in cash | Invoices with FIB/ZainCash links, reminders, a grace period, then read-only mode, never data deletion |
| Data-localization rules | Containers and Postgres move to an Iraqi data center when required |

---

## 13. Summary

- **Hemlo** is the parent and the hub at `hemlohq.com`.
- **Hemlo Tools** is free forever. It brings businesses in at $0 cost.
- **Hemlo Studio** does custom work at quoted prices, earns money first, and receives every "Custom plan".
- **Hemlo Systems** is one core with an edition per trade, starting with repair workshops (stock, jobs, warranty), on plans.
- **Hemlo School** is complete school management with Iraq-native fees and parent links, on plans.
- **Hemlo Core** is one login, one billing system and one design system for all of them.
- It runs on **Cloudflare + Neon Postgres at $0** until the first subscriber. Then it grows only as revenue allows.

# Invoice & quotation maker · صانع الفواتير وعروض الأسعار

A free tool for making a professional invoice or quotation in under two minutes, and saving it as a PDF or sending it on WhatsApp.

## What it does (v1)

- **Invoice or quotation,** with automatic numbering (INV-0001, Q-0001).
- **Document language:** Arabic, English, or bilingual Arabic + English.
- **Money:** IQD or USD, with an optional equivalent in the other currency at the user's exchange rate.
- **Your business:** name, phone, address, an extra line, a logo and a stamp or signature. These are saved on the device and reused every time.
- **Line items** (description, quantity, price), plus a discount, a tax %, and the amount paid with the balance.
- **تفقيط, the amount in words,** in the form used on Iraqi documents: «فقط مليون ومئتان وخمسون ألف دينار عراقي لا غير». English wording is included too.
- **Output:**
  - **Save PDF / Print** gives a clean A4 page with correct Arabic shaping.
  - **WhatsApp** sends a text summary to the customer's number (07xx is converted to +9647xx).
- **Privacy:** nothing leaves the device. The draft and the business profile are stored in the browser.

## Files

| File | Contents |
|---|---|
| `index.html` | The editor and the preview |
| `styles.css` | UI and A4 document styles; the print styles show only the page |
| `app.js` | State, form binding, rendering, PDF/print, WhatsApp |
| `../shared/tafqit.js` | Amounts in words, Arabic and English. Tested on 0 to trillions |

## Next (v1.1)

- Kurdish (Sorani) document labels, after a native speaker reviews them.
- A saved history of documents, and duplicating an old invoice.
- A QR code on the document, linking to the business's WhatsApp.
- Thermal-receipt (80 mm) layout.
- Optional "Save to Hemlo ID" to sync across devices. This is the bridge to Hemlo Systems.

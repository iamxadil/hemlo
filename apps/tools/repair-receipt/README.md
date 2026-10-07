# Repair receipt & warranty card · وصل التصليح وكارت الضمان

**Status:** v1 built and live at https://tools.hemlohq.com/repair-receipt/

**Why:** phone, AC, electronics and car workshops write receipts by hand. The only digital options are full paid systems.

## What v1 does

- **Two documents** from one job: the receipt (وصل استلام) and the warranty card (كارت ضمان), switched in the toolbar.
- **Receipt:** customer, device (type, brand, model, serial/IMEI), the fault as reported, the diagnosis, the work done, the accessories taken in, and a condition checklist.
- **Condition checklist:** tick what was already on the device (cracked screen, scratches, water damage, previous repair, missing parts). Ticking "no damage" clears the rest. This is the part that prevents the argument at collection.
- **Warranty card:** work done, parts fitted, warranty period in days or months, the expiry date worked out from the document date, and editable terms.
- **Parts and labour** with a total and the amount in words (تفقيط), reused from the invoice maker.
- **Paper sizes:** A5 and 80 mm thermal. The print page size is set at runtime, so one sheet serves both.
- **WhatsApp:** sends the job, or the warranty expiry, to the customer.
- **The upsell:** a job-board panel showing what Hemlo Systems (Workshops edition) replaces.

## Shared with the invoice maker

- The workshop profile is stored under `hemlo.invoice.business.v1`, the same key the invoice maker uses. Fill it in once in either tool and it appears in both.

## Deliberately not in v1

- **The status QR.** It needs a QR encoder inlined in the page, and a wrong QR is worse than no QR. The WhatsApp button already gets the customer to the shop. Worth adding once we can depend on a tested encoder.
- **Printing both documents in one go.** The toolbar switches which one you print; printing both at once is a small follow-up.
- **Thermal paper width is fixed at 80 mm** in print. Some shops use 58 mm.

## Rules

- Nothing is sent anywhere. The profile, the current job and the document number counter live in `localStorage` on the device.
- The job number is a per-device counter (`J-0001`), not a real job number. It is not shared between devices or with anyone else.
- Nothing here is an invoice, a tax document, or a legal record of a repair.
-- Hemlo Website + Hemlo Connect Pro, sold together below the price of the two (100,000 → 90,000 IQD a month).
INSERT INTO "hemlo_addon" ("id", "code", "name", "description", "compatible_editions", "price_month", "price_year", "public", "active")
VALUES ('web-connect', 'web-connect', '{"ar":"Hemlo Website + Connect Pro","en":"Hemlo Website + Connect Pro"}', '{"ar":"الباقة الكاملة: موقع يملأ نفسه بنفسه، وواتساب بمساعد ذكي يرد ويتابع عنك، بسعر أقل من الاثنين منفصلين.","en":"The full set: a website that fills itself, and WhatsApp with an AI assistant that answers and follows up for you, for less than the two apart."}', '["realestate"]', 90000, 900000, true, true)
ON CONFLICT ("code") DO NOTHING;

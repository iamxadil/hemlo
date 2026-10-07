# Import landed-cost estimator · حاسبة كلفة الاستيراد

**Status:** planned.

**Why:** 2026 brought 15% VAT on the CIF value of imports, with no threshold. The only calculators are foreign and in English. Iraqi importers want their real cost before they order.

**v1 scope:**

- **Inputs:**
  - goods value, shipping and insurance (CIF),
  - currency and exchange rate,
  - the product category's duty rate (the user picks it, or types it in), and
  - clearance, broker and local transport fees.
- **Outputs:** the landed cost per shipment and per unit, and the suggested selling price for a target margin. Exported as a PDF.

**Rules:**

- The tariff schedule is not hard-coded as fact. Rates are editable and every figure is labelled "estimate".
- Link to Hemlo Studio for custom import-tracking systems.

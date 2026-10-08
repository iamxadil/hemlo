// Hemlo Systems: the shared core every edition uses (Stores & Markets first). Every table belongs to one business:
// organization_id + row-level security (migration 0005), queried inside withOrg(). Money is whole Iraqi dinars (integer).
import { pgTable, text, timestamp, integer, numeric, boolean, jsonb, index, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';

const qty = (name: string) => numeric(name, { precision: 12, scale: 3, mode: 'number' });
const at = (name: string) => timestamp(name, { withTimezone: true });

/** Something the business sells. Stock is tracked unless trackStock is false (services, bulk bread…). */
export const sysProduct = pgTable('sys_product', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  name: text('name').notNull(),
  barcode: text('barcode'),
  category: text('category'),
  unit: text('unit').notNull().default('piece'),        // piece | kg | g | l | box | pack
  price: integer('price').notNull(),                       // selling price, IQD
  cost: integer('cost'),                                   // last purchase cost, IQD (for profit)
  stock: qty('stock').notNull().default(0),
  lowStock: qty('low_stock'),                              // warn at or below this
  trackStock: boolean('track_stock').notNull().default(true),
  packSize: integer('pack_size'),                          // pieces in a carton/pack (V2)
  packBarcode: text('pack_barcode'),                       // the carton's own barcode
  packPrice: integer('pack_price'),                        // price for a whole carton
  scaleCode: text('scale_code'),                           // the item code a label scale prints in its barcodes
  imageId: text('image_id'),                               // a sys_file (purpose 'product')
  archivedAt: at('archived_at'),
  createdAt: at('created_at').notNull().defaultNow(),
  updatedAt: at('updated_at').notNull().defaultNow(),
}, (t) => [index('sys_product_org').on(t.organizationId), uniqueIndex('sys_product_barcode').on(t.organizationId, t.barcode), uniqueIndex('sys_product_pack_barcode').on(t.organizationId, t.packBarcode)]);

/** A customer of the business. balance > 0 means they owe the shop (the debt book, دفتر الديون). */
export const sysCustomer = pgTable('sys_customer', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  note: text('note'),
  balance: integer('balance').notNull().default(0),
  archivedAt: at('archived_at'),
  createdAt: at('created_at').notNull().defaultNow(),
  updatedAt: at('updated_at').notNull().defaultNow(),
}, (t) => [index('sys_customer_org').on(t.organizationId)]);

/** A finished sale. Numbers count up per business (#1, #2 …). clientId makes retries and offline sync safe. */
export const sysSale = pgTable('sys_sale', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  number: integer('number').notNull(),
  clientId: text('client_id'),
  createdAt: at('created_at').notNull().defaultNow(),
  userId: text('user_id'),                 // who sold it
  deviceId: text('device_id'),             // the counter device, when sold on one
  customerId: text('customer_id'),
  subtotal: integer('subtotal').notNull(),
  discount: integer('discount').notNull().default(0),
  total: integer('total').notNull(),
  paid: integer('paid').notNull(),         // received now (cash or card)
  due: integer('due').notNull().default(0),// added to the customer's debt
  method: text('method').notNull(),        // cash | card | credit | mixed
  cost: integer('cost').notNull().default(0), // cost of the goods, for profit
  note: text('note'),
  shiftId: text('shift_id'),               // the cash drawer session it belongs to
  returned: integer('returned').notNull().default(0), // refunded so far, IQD
  fibPaymentId: text('fib_payment_id'),     // paid through FIB (method = fib)
  voidedAt: at('voided_at'),
  voidedBy: text('voided_by'),
}, (t) => [index('sys_sale_org_time').on(t.organizationId, t.createdAt), uniqueIndex('sys_sale_number').on(t.organizationId, t.number), uniqueIndex('sys_sale_client').on(t.organizationId, t.clientId)]);

export const sysSaleLine = pgTable('sys_sale_line', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  saleId: text('sale_id').notNull(),
  productId: text('product_id'),
  name: text('name').notNull(),            // as it was when sold
  qty: qty('qty').notNull(),               // as sold: cartons when packSize is set
  packSize: integer('pack_size'),          // null = single units
  baseQty: qty('base_qty'),                // in stock units (qty × packSize); null on V1 lines means qty
  returnedQty: qty('returned_qty').notNull().default(0),
  price: integer('price').notNull(),
  cost: integer('cost').notNull().default(0),
  total: integer('total').notNull(),
}, (t) => [index('sys_sale_line_sale').on(t.saleId), index('sys_sale_line_product').on(t.organizationId, t.productId)]);

/** Every change to a customer's balance: sales on credit, payments, corrections. */
export const sysLedger = pgTable('sys_ledger', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  customerId: text('customer_id').notNull(),
  at: at('at').notNull().defaultNow(),
  kind: text('kind').notNull(),            // sale | payment | void | adjust
  amount: integer('amount').notNull(),     // + adds to what they owe, − reduces it
  balance: integer('balance').notNull(),   // their balance after this line
  saleId: text('sale_id'),
  method: text('method'),                  // payments: cash | card
  shiftId: text('shift_id'),
  note: text('note'),
  userId: text('user_id'),
}, (t) => [index('sys_ledger_customer').on(t.customerId, t.at)]);

/** Every change to stock: sales, deliveries, counts, damage. */
export const sysStockMove = pgTable('sys_stock_move', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  productId: text('product_id').notNull(),
  at: at('at').notNull().defaultNow(),
  kind: text('kind').notNull(),            // sale | receive | count | damage | void
  qty: qty('qty').notNull(),               // + in, − out
  stock: qty('stock').notNull(),           // stock after
  cost: integer('cost'),
  saleId: text('sale_id'),
  note: text('note'),
  userId: text('user_id'),
}, (t) => [index('sys_stock_move_product').on(t.productId, t.at)]);

// ---------------- V2 ----------------

/** A return against a sale: some items back, money back in cash or onto the customer's account. */
export const sysReturn = pgTable('sys_return', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  saleId: text('sale_id').notNull(),
  createdAt: at('created_at').notNull().defaultNow(),
  userId: text('user_id'),
  total: integer('total').notNull(),
  cost: integer('cost').notNull().default(0),
  refund: text('refund').notNull(),        // cash | account
  shiftId: text('shift_id'),
  reason: text('reason'),
}, (t) => [index('sys_return_org_time').on(t.organizationId, t.createdAt), index('sys_return_sale').on(t.saleId)]);

export const sysReturnLine = pgTable('sys_return_line', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  returnId: text('return_id').notNull(),
  saleLineId: text('sale_line_id').notNull(),
  productId: text('product_id'),
  name: text('name').notNull(),
  qty: qty('qty').notNull(),               // in the sale line's units
  baseQty: qty('base_qty').notNull(),
  price: integer('price').notNull(),
  total: integer('total').notNull(),
}, (t) => [index('sys_return_line_return').on(t.returnId)]);

/** The cash drawer (تسليم الصندوق): opened with a float, closed with a count. One open drawer per business. */
export const sysShift = pgTable('sys_shift', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  deviceId: text('device_id'),             // the till (shop device); null = the main till (people signed in on their own)
  openedAt: at('opened_at').notNull().defaultNow(),
  openedBy: text('opened_by'),
  openingCash: integer('opening_cash').notNull().default(0),
  closedAt: at('closed_at'),
  closedBy: text('closed_by'),
  expectedCash: integer('expected_cash'),
  countedCash: integer('counted_cash'),
  note: text('note'),
}, (t) => [index('sys_shift_org').on(t.organizationId, t.openedAt)]);

/** A wholesaler. balance > 0 means the shop owes them. */
export const sysSupplier = pgTable('sys_supplier', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  note: text('note'),
  kind: text('kind'),                                // null = a supplier of goods; 'lab' = a dental lab
  balance: integer('balance').notNull().default(0),
  archivedAt: at('archived_at'),
  createdAt: at('created_at').notNull().defaultNow(),
  updatedAt: at('updated_at').notNull().defaultNow(),
}, (t) => [index('sys_supplier_org').on(t.organizationId)]);

/** A delivery invoice: stock in, costs updated, and anything unpaid goes on the supplier's account. */
export const sysPurchase = pgTable('sys_purchase', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  number: integer('number').notNull(),
  supplierId: text('supplier_id'),
  createdAt: at('created_at').notNull().defaultNow(),
  userId: text('user_id'),
  reference: text('reference'),            // the supplier's own invoice number
  total: integer('total').notNull(),
  paid: integer('paid').notNull().default(0),
  due: integer('due').notNull().default(0),
  fromDrawer: boolean('from_drawer').notNull().default(false),
  shiftId: text('shift_id'),
  note: text('note'),
}, (t) => [index('sys_purchase_org_time').on(t.organizationId, t.createdAt), uniqueIndex('sys_purchase_number').on(t.organizationId, t.number)]);

export const sysPurchaseLine = pgTable('sys_purchase_line', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  purchaseId: text('purchase_id').notNull(),
  productId: text('product_id').notNull(),
  name: text('name').notNull(),
  qty: qty('qty').notNull(),               // as received: cartons when packSize is set
  packSize: integer('pack_size'),
  baseQty: qty('base_qty').notNull(),
  cost: integer('cost').notNull(),         // per unit as received (per carton when packSize is set)
  total: integer('total').notNull(),
}, (t) => [index('sys_purchase_line_purchase').on(t.purchaseId)]);

/** Every change to what the shop owes a supplier. */
export const sysSupplierLedger = pgTable('sys_supplier_ledger', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  supplierId: text('supplier_id').notNull(),
  at: at('at').notNull().defaultNow(),
  kind: text('kind').notNull(),            // purchase | payment | adjust
  amount: integer('amount').notNull(),     // + the shop owes more, − less
  balance: integer('balance').notNull(),
  purchaseId: text('purchase_id'),
  fromDrawer: boolean('from_drawer').notNull().default(false),
  shiftId: text('shift_id'),
  note: text('note'),
  userId: text('user_id'),
}, (t) => [index('sys_supplier_ledger_supplier').on(t.supplierId, t.at)]);

/** Money out that isn't stock: rent, the generator, salaries… */
export const sysExpense = pgTable('sys_expense', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  at: at('at').notNull().defaultNow(),
  category: text('category').notNull(),    // rent | generator | electricity | salaries | transport | supplies | other
  amount: integer('amount').notNull(),
  note: text('note'),
  fromDrawer: boolean('from_drawer').notNull().default(false),
  shiftId: text('shift_id'),
  userId: text('user_id'),
}, (t) => [index('sys_expense_org_time').on(t.organizationId, t.at)]);

// ---------------- the till ----------------

/** Per-business settings: the shop's own FIB connection (secret sealed at rest), the label-scale barcode format. */
export const sysSettings = pgTable('sys_settings', {
  organizationId: text('organization_id').primaryKey(),
  fib: jsonb('fib').$type<{ env: 'sandbox' | 'production'; clientId: string; secret: string; connectedAt: string } | null>(),
  scale: jsonb('scale').$type<{ enabled: boolean; prefixes: string[]; mode: 'weight' | 'price' } | null>(),
  logoId: text('logo_id'),                                 // a sys_file (purpose 'logo'): on receipts, the customer display, the app
  aiOff: boolean('ai_off').notNull().default(false),        // the owner switched Hemlo's AI features off for this business
  updatedAt: at('updated_at').notNull().defaultNow(),
});

/** A payment request sent to FIB (QR code at the till). Becomes a sale once FIB says PAID, checked with FIB itself. */
export const sysFibPayment = pgTable('sys_fib_payment', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  fibPaymentId: text('fib_payment_id').notNull(),
  env: text('env').notNull(),
  amount: integer('amount').notNull(),
  status: text('status').notNull().default('UNPAID'),   // UNPAID | PAID | DECLINED | CANCELLED
  readableCode: text('readable_code'),
  qrCode: text('qr_code'),
  personalAppLink: text('personal_app_link'),
  validUntil: at('valid_until'),
  paidAt: at('paid_at'),
  paidBy: text('paid_by'),
  declineReason: text('decline_reason'),
  checkedAt: at('checked_at'),
  saleId: text('sale_id'),
  refundedAt: at('refunded_at'),
  refundStatus: text('refund_status'),                    // requested | failed
  userId: text('user_id'),
  deviceId: text('device_id'),
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [uniqueIndex('sys_fib_payment_fib').on(t.fibPaymentId), index('sys_fib_payment_org').on(t.organizationId, t.createdAt)]);

/** Per-business counters (sale numbers). */
export const sysSequence = pgTable('sys_sequence', {
  organizationId: text('organization_id').notNull(),
  name: text('name').notNull(),
  value: integer('value').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.organizationId, t.name] })]);

/** An uploaded image, stored in R2 at o/{organization}/{id}. A logo, a product photo, or a photo attached to a purchase or expense (ref_id). */
export const sysFile = pgTable('sys_file', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  purpose: text('purpose').notNull(),       // logo | product | purchase | expense
  refId: text('ref_id'),                    // the product, purchase or expense it belongs to (null until attached)
  mime: text('mime').notNull(),
  bytes: integer('bytes').notNull(),
  width: integer('width'),
  height: integer('height'),
  createdBy: text('created_by'),
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [index('sys_file_ref').on(t.organizationId, t.refId)]);

/** Every AI task a business ran (invoice read, a question…): what it cost, how long it took, whether it worked. The
 *  monthly allowance counts these rows; the pilot reads them to measure accuracy and cost per task. */
export const aiUsage = pgTable('ai_usage', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  userId: text('user_id'),
  feature: text('feature').notNull(),              // 'invoice' | 'ask'
  engine: text('engine').notNull(),                // 'workers-ai' | 'claude' | 'sample' (a ready-made demo result, free)
  model: text('model'),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  costMicros: integer('cost_micros').notNull().default(0), // US dollars × 1,000,000 (0 on the free engine)
  ms: integer('ms').notNull().default(0),
  ok: boolean('ok').notNull(),
  counted: boolean('counted').notNull().default(true),     // counts toward the monthly allowance (samples don't)
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [index('ai_usage_org_month').on(t.organizationId, t.createdAt)]);

/** A reminder a business sent a customer on WhatsApp: a membership about to end (renewal), one that ended (lapsed), or a
 *  debt. Kept so Hemlo can show what the reminders brought back (a renewal or a payment soon after). One a person per kind
 *  per day: tapping "remind" twice doesn't count twice. */
export const sysReminder = pgTable('sys_reminder', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  customerId: text('customer_id').notNull(),
  kind: text('kind').notNull(),            // renewal | lapsed | debt
  refId: text('ref_id'),                   // the membership reminded about
  amount: integer('amount'),               // debt: what they owed when reminded
  sentOn: text('sent_on').notNull(),       // 'YYYY-MM-DD', Baghdad
  at: at('at').notNull().defaultNow(),
  userId: text('user_id'),
}, (t) => [uniqueIndex('sys_reminder_once').on(t.customerId, t.kind, t.sentOn), index('sys_reminder_org_at').on(t.organizationId, t.at)]);

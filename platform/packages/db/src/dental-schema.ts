// Hemlo Systems · Dental edition. Built on the shared core: a patient is a sys_customer (so balances, payments, the debt
// book and WhatsApp come for free) with a clinical profile here; a visit is billed as a sys_sale (so the cash drawer,
// receipts, FIB and reports work unchanged). Every table belongs to one clinic: organization_id + row-level security.
// Money is whole IQD; USD prices are whole dollars, converted at the clinic's rate when charged.
import { pgTable, text, timestamp, integer, boolean, jsonb, date, index, uniqueIndex } from 'drizzle-orm/pg-core';

const at = (name: string) => timestamp(name, { withTimezone: true });
const org = () => text('organization_id').notNull();

/** The clinic's own settings. */
export const dentSettings = pgTable('dent_settings', {
  organizationId: text('organization_id').primaryKey(),
  usdRate: integer('usd_rate').notNull().default(1450),          // IQD for 1 USD, today
  slotMinutes: integer('slot_minutes').notNull().default(15),
  hours: jsonb('hours').$type<Record<string, [string, string] | null>>(), // '0'..'6' (Sunday..Saturday) → ['10:00', '21:00'] or null (closed)
  recallMonths: integer('recall_months').notNull().default(6),
  rxHeader: text('rx_header'),                                    // prescription header: doctor's titles, licence, phone
  reminderText: text('reminder_text'),                            // WhatsApp reminder template
  screenKey: text('screen_key'),                                  // the waiting-room screen's link key (display only; reset to cut a screen off)
  updatedAt: at('updated_at').notNull().defaultNow(),
});

export const dentChair = pgTable('dent_chair', {
  id: text('id').primaryKey(),
  organizationId: org(),
  name: text('name').notNull(),
  sort: integer('sort').notNull().default(0),
  archivedAt: at('archived_at'),
}, (t) => [index('dent_chair_org').on(t.organizationId)]);

/** A dentist working in the clinic (a member of the business), with their share of what they bring in. */
export const dentDentist = pgTable('dent_dentist', {
  id: text('id').primaryKey(),
  organizationId: org(),
  memberId: text('member_id'),                    // their Hemlo account in this clinic (null: a visiting dentist without one)
  name: text('name').notNull(),
  specialty: text('specialty'),                   // general | endo | ortho | perio | prostho | surgery | pedo | implant
  color: text('color').notNull().default('#A8532E'),
  sharePercent: integer('share_percent').notNull().default(0), // 0 = owner / salaried; 30–50 is typical for associates
  shareBasis: text('share_basis').notNull().default('collected'), // collected (paid in) | billed (charged)
  labDeduct: boolean('lab_deduct').notNull().default(true),     // lab costs come off before the share
  active: boolean('active').notNull().default(true),
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [index('dent_dentist_org').on(t.organizationId), uniqueIndex('dent_dentist_member').on(t.organizationId, t.memberId)]);

/** The price list. */
export const dentProcedure = pgTable('dent_procedure', {
  id: text('id').primaryKey(),
  organizationId: org(),
  code: text('code'),
  name: text('name').notNull(),
  category: text('category').notNull(),           // diagnostic | preventive | restorative | endo | surgery | prostho | implant | ortho | perio | cosmetic | pedo
  currency: text('currency').notNull().default('IQD'),
  price: integer('price').notNull().default(0),   // in that currency (IQD, or whole USD)
  minutes: integer('minutes').notNull().default(30),
  scope: text('scope').notNull().default('tooth'), // tooth | surface | arch | mouth
  mark: text('mark'),                              // what the chart shows once it's done (filling, crown, rct, missing, implant…)
  labWork: boolean('lab_work').notNull().default(false), // needs a lab (crowns, dentures…)
  active: boolean('active').notNull().default(true),
  sort: integer('sort').notNull().default(0),
}, (t) => [index('dent_procedure_org').on(t.organizationId)]);

/** A patient's clinical profile. customer_id is the sys_customer (name, phone, balance). */
export const dentPatient = pgTable('dent_patient', {
  customerId: text('customer_id').primaryKey(),
  organizationId: org(),
  fileNo: integer('file_no').notNull(),
  gender: text('gender'),                          // f | m
  birthDate: date('birth_date'),
  address: text('address'),
  occupation: text('occupation'),
  referral: text('referral'),                      // how they found the clinic
  guardian: text('guardian'),                      // for children
  medical: jsonb('medical').$type<Record<string, unknown>>().notNull().default({}), // the medical history form
  alerts: jsonb('alerts').$type<string[]>().notNull().default([]),                  // derived: what everyone must see
  recallDue: date('recall_due'),
  notes: text('notes'),
  createdAt: at('created_at').notNull().defaultNow(),
  updatedAt: at('updated_at').notNull().defaultNow(),
}, (t) => [index('dent_patient_org').on(t.organizationId), uniqueIndex('dent_patient_file').on(t.organizationId, t.fileNo)]);

export const dentAppointment = pgTable('dent_appointment', {
  id: text('id').primaryKey(),
  organizationId: org(),
  patientId: text('patient_id').notNull(),
  dentistId: text('dentist_id'),
  chairId: text('chair_id'),
  startsAt: at('starts_at').notNull(),
  endsAt: at('ends_at').notNull(),
  status: text('status').notNull().default('booked'), // booked | confirmed | arrived | seated | done | no_show | canceled
  reason: text('reason'),
  note: text('note'),
  bookedBy: text('booked_by'),
  remindedAt: at('reminded_at'),
  arrivedAt: at('arrived_at'),
  seatedAt: at('seated_at'),
  finishedAt: at('finished_at'),
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [index('dent_appt_day').on(t.organizationId, t.startsAt), index('dent_appt_patient').on(t.patientId)]);

/** What's on (or planned for) a tooth: one row per finding, kept as history. */
export const dentFinding = pgTable('dent_finding', {
  id: text('id').primaryKey(),
  organizationId: org(),
  patientId: text('patient_id').notNull(),
  tooth: integer('tooth').notNull(),               // FDI: 11–48 permanent, 51–85 primary
  surfaces: text('surfaces'),                      // M O D B L (I for incisal), e.g. 'MO'
  kind: text('kind').notNull(),                    // caries | filling | crown | rct | missing | implant | bridge | veneer | sealant | fracture | extraction | pulpotomy | post | impacted | mobility
  status: text('status').notNull(),                // existing | planned | done
  note: text('note'),
  planItemId: text('plan_item_id'),
  visitId: text('visit_id'),
  createdBy: text('created_by'),
  createdAt: at('created_at').notNull().defaultNow(),
  removedAt: at('removed_at'),
}, (t) => [index('dent_finding_patient').on(t.patientId, t.tooth)]);

export const dentPlan = pgTable('dent_plan', {
  id: text('id').primaryKey(),
  organizationId: org(),
  patientId: text('patient_id').notNull(),
  title: text('title').notNull(),
  kind: text('kind').notNull().default('general'), // general | ortho | implant
  status: text('status').notNull().default('proposed'), // proposed | accepted | in_progress | completed | declined
  optionGroup: text('option_group'),               // plans sharing a group are alternatives (implant or bridge)
  discount: integer('discount').notNull().default(0),
  note: text('note'),
  dentistId: text('dentist_id'),
  createdBy: text('created_by'),
  createdAt: at('created_at').notNull().defaultNow(),
  decidedAt: at('decided_at'),
}, (t) => [index('dent_plan_patient').on(t.patientId)]);

export const dentPlanItem = pgTable('dent_plan_item', {
  id: text('id').primaryKey(),
  organizationId: org(),
  planId: text('plan_id').notNull(),
  procedureId: text('procedure_id'),
  name: text('name').notNull(),
  tooth: integer('tooth'),
  surfaces: text('surfaces'),
  phase: integer('phase').notNull().default(1),
  currency: text('currency').notNull().default('IQD'),
  price: integer('price').notNull(),               // in that currency
  status: text('status').notNull().default('planned'), // planned | done | canceled
  visitId: text('visit_id'),
  sort: integer('sort').notNull().default(0),
}, (t) => [index('dent_plan_item_plan').on(t.planId)]);

/** A visit: what was found and done, the notes, and its bill (a sys_sale). Notes lock after a day; changes are appended. */
export const dentVisit = pgTable('dent_visit', {
  id: text('id').primaryKey(),
  organizationId: org(),
  patientId: text('patient_id').notNull(),
  appointmentId: text('appointment_id'),
  dentistId: text('dentist_id'),
  at: at('at').notNull().defaultNow(),
  complaint: text('complaint'),
  notes: text('notes'),
  anesthesia: text('anesthesia'),
  amendments: jsonb('amendments').$type<{ at: string; by: string | null; text: string }[]>().notNull().default([]),
  saleId: text('sale_id'),
  createdBy: text('created_by'),
}, (t) => [index('dent_visit_patient').on(t.patientId, t.at)]);

export const dentVisitItem = pgTable('dent_visit_item', {
  id: text('id').primaryKey(),
  organizationId: org(),
  visitId: text('visit_id').notNull(),
  procedureId: text('procedure_id'),
  name: text('name').notNull(),
  tooth: integer('tooth'),
  surfaces: text('surfaces'),
  currency: text('currency').notNull().default('IQD'),
  priceOriginal: integer('price_original').notNull(), // in its currency
  usdRate: integer('usd_rate'),
  amount: integer('amount').notNull(),               // IQD charged
  dentistId: text('dentist_id'),
  planItemId: text('plan_item_id'),
  labCost: integer('lab_cost').notNull().default(0),
}, (t) => [index('dent_visit_item_visit').on(t.visitId)]);

export const dentRx = pgTable('dent_rx', {
  id: text('id').primaryKey(),
  organizationId: org(),
  patientId: text('patient_id').notNull(),
  visitId: text('visit_id'),
  dentistId: text('dentist_id'),
  items: jsonb('items').$type<{ drug: string; dose?: string; how?: string; days?: number; note?: string }[]>().notNull(),
  note: text('note'),
  createdBy: text('created_by'),
  createdAt: at('created_at').notNull().defaultNow(),
}, (t) => [index('dent_rx_patient').on(t.patientId)]);

/** Work sent to a dental lab (a sys_supplier). Its cost is owed to the lab once the work comes back. */
export const dentLabOrder = pgTable('dent_lab_order', {
  id: text('id').primaryKey(),
  organizationId: org(),
  patientId: text('patient_id').notNull(),
  labId: text('lab_id'),                          // sys_supplier
  dentistId: text('dentist_id'),
  work: text('work').notNull(),                   // PFM crown, zirconia bridge, complete denture…
  teeth: text('teeth'),                           // '36' or '14-16'
  shade: text('shade'),
  material: text('material'),
  note: text('note'),
  status: text('status').notNull().default('sent'), // sent | in_progress | received | fitted | remake | canceled
  cost: integer('cost').notNull().default(0),
  sentAt: at('sent_at').notNull().defaultNow(),
  dueAt: at('due_at'),
  receivedAt: at('received_at'),
  fittedAt: at('fitted_at'),
  visitItemId: text('visit_item_id'),
  createdBy: text('created_by'),
}, (t) => [index('dent_lab_org').on(t.organizationId, t.status)]);

/** A gum chart: pocket depths (6 sites), bleeding, mobility, furcation, per tooth. */
export const dentPerio = pgTable('dent_perio', {
  id: text('id').primaryKey(),
  organizationId: org(),
  patientId: text('patient_id').notNull(),
  dentistId: text('dentist_id'),
  at: at('at').notNull().defaultNow(),
  data: jsonb('data').$type<Record<string, { pd?: number[]; bop?: boolean[]; mob?: number; furc?: number; missing?: boolean }>>().notNull(),
  note: text('note'),
  createdBy: text('created_by'),
}, (t) => [index('dent_perio_patient').on(t.patientId)]);

/** A payment schedule (braces, implants): what's due when. Paid by ordinary payments on the patient's account. */
export const dentInstallment = pgTable('dent_installment', {
  id: text('id').primaryKey(),
  organizationId: org(),
  patientId: text('patient_id').notNull(),
  planId: text('plan_id'),
  dueDate: date('due_date').notNull(),
  amount: integer('amount').notNull(),
  paidAt: at('paid_at'),
  note: text('note'),
}, (t) => [index('dent_inst_org').on(t.organizationId, t.dueDate)]);

/** A signed consent (extraction, implant surgery, whitening…): the text as signed, and the signature image. */
export const dentConsent = pgTable('dent_consent', {
  id: text('id').primaryKey(),
  organizationId: org(),
  patientId: text('patient_id').notNull(),
  kind: text('kind').notNull(),
  text: text('text').notNull(),
  signedName: text('signed_name').notNull(),
  signatureFileId: text('signature_file_id'),
  signedAt: at('signed_at').notNull().defaultNow(),
  createdBy: text('created_by'),
}, (t) => [index('dent_consent_patient').on(t.patientId)]);

/** X-rays, photos and documents on a patient's file (the bytes are a sys_file in R2). */
export const dentImage = pgTable('dent_image', {
  fileId: text('file_id').primaryKey(),
  organizationId: org(),
  patientId: text('patient_id').notNull(),
  kind: text('kind').notNull(),                    // periapical | bitewing | panoramic | cbct | photo | document
  teeth: jsonb('teeth').$type<number[]>().notNull().default([]),
  visitId: text('visit_id'),
  takenAt: at('taken_at').notNull().defaultNow(),
  note: text('note'),
  createdBy: text('created_by'),
}, (t) => [index('dent_image_patient').on(t.patientId, t.takenAt)]);

/** Who opened which patient's file, and when: medical records are watched. Append-only. */
export const dentAccessLog = pgTable('dent_access_log', {
  id: text('id').primaryKey(),
  organizationId: org(),
  patientId: text('patient_id').notNull(),
  userId: text('user_id'),
  action: text('action').notNull(),                // open | chart | notes | images | export | print
  at: at('at').notNull().defaultNow(),
}, (t) => [index('dent_access_patient').on(t.patientId, t.at)]);

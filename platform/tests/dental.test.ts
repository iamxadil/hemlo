// Hemlo Systems · Dental: a clinic from its first day of trial to a paid plan. The schedule, the chart, plans with
// options, visits billed in IQD and USD, dentists' shares traced to the money that came in, lab work, prescriptions,
// the gum chart, consents, X-rays — and who may see what.
import { describe, it, expect, beforeAll } from 'vitest';
import { setup, Browser, signInEmail, signInPhone } from './helpers';
import { allocate } from '../apps/api/src/routes/dental/reports';
import { forgetSubscription } from '../apps/api/src/subscription';

let t: Awaited<ReturnType<typeof setup>>;
let owner: Browser, reception: Browser, associate: Browser, founder: Browser;
let clinicId: string;
const ids: Record<string, any> = {};
const PNG = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
const system = async (q: string, params: unknown[] = []) => t.client.transaction(async (tx: any) => { await tx.query("select set_config('app.system', 'on', true)"); return (await tx.query(q, params)).rows; });
const join = async (role: string, phone: string, name: string) => {
  const inv = await owner.post('/v1/invites', { phone, role, name });
  expect(inv.status).toBe(201);
  const b = new Browser(t.app);
  await signInPhone(b, '+964' + phone.slice(1));
  await b.post(`/v1/invites/by-token/${encodeURIComponent(new URL(inv.json.url).searchParams.get('t')!)}/accept`);
  await b.post('/v1/auth/organization/set-active', { organizationId: clinicId });
  return b;
};

beforeAll(async () => {
  t = await setup();
  owner = new Browser(t.app);
  await signInEmail(owner, 'dr.sara@clinic.iq');
  await owner.post('/v1/auth/update-user', { name: 'Sara Kareem' });
  founder = new Browser(t.app);
  await signInEmail(founder, 'founder@hemlohq.com');
  await t.client.query(`update "user" set role = 'admin' where email = 'founder@hemlohq.com'`);
  await signInEmail(founder, 'founder@hemlohq.com');
});

describe('starting a clinic', () => {
  it('a dentist starts a 30-day free trial on their own, with a ready price list', async () => {
    const r = await owner.post('/v1/dent/start', { name: 'Smile Dental', city: 'Baghdad', lang: 'en', specialty: 'endo' });
    expect(r.status).toBe(201);
    clinicId = r.json.organizationId;
    await owner.post('/v1/auth/organization/set-active', { organizationId: clinicId });
    const me = (await owner.get('/v1/sys/me')).json;
    expect(me.business).toMatchObject({ name: 'Smile Dental', kind: 'dental', city: 'Baghdad' });
    expect(me.subscription).toMatchObject({ edition: 'dental', status: 'trial', daysLeft: 30 });
    expect(me.can['clinical.write']).toBe(true);
    const s = (await owner.get('/v1/dent/setup')).json;
    expect(s.chairs).toHaveLength(2);
    expect(s.dentists).toHaveLength(1);
    expect(s.dentists[0]).toMatchObject({ name: 'Sara Kareem', specialty: 'endo', sharePercent: 0 });
    expect(s.procedures.length).toBeGreaterThan(25);
    expect(s.procedures.find((p: any) => p.name === 'Dental implant')).toMatchObject({ currency: 'USD', price: 450, mark: 'implant' });
    expect(s.settings.hours['5']).toBeNull(); // Friday
    Object.assign(ids, { chair1: s.chairs[0].id, chair2: s.chairs[1].id, sara: s.dentists[0].id, proc: Object.fromEntries(s.procedures.map((p: any) => [p.name, p.id])) });
  });

  it('one free trial per person', async () => {
    expect((await owner.post('/v1/dent/start', { name: 'Second Clinic' })).json.error).toBe('TRIAL_USED');
  });

  it('the team: a receptionist, and an associate dentist on 40% of what they collect', async () => {
    reception = await join('receptionist', '07701110001', 'Noor');
    associate = await join('dentist', '07701110002', 'Dr Ali');
    const members = (await owner.get('/v1/dent/setup')).json.members;
    const ali = members.find((m: any) => m.role === 'dentist');
    const d = await owner.post('/v1/dent/dentists', { name: 'Dr Ali', memberId: ali.id, sharePercent: 40, shareBasis: 'collected', labDeduct: true, specialty: 'implant', color: '#2F5DA8' });
    expect(d.status).toBe(201);
    ids.ali = d.json.dentist.id;
    expect((await owner.post('/v1/dent/dentists', { name: 'Dup', memberId: ali.id })).json.error).toBe('ALREADY_A_DENTIST');
    expect((await reception.post('/v1/dent/dentists', { name: 'X' })).status).toBe(403);
    await owner.put('/v1/dent/settings', { usdRate: 1450 });
  });
});

describe('patients', () => {
  it('reception registers patients with their medical history; alerts are worked out', async () => {
    const r = await reception.post('/v1/dent/patients', { name: 'Hussein Ali', phone: '0770 123 4567', gender: 'm', birthDate: '1980-05-01', referral: 'Instagram',
      medical: { anticoagulants: true, diabetes: true, allergies: { penicillin: true }, medications: 'Warfarin 5mg', smoker: true } });
    expect(r.status).toBe(201);
    expect(r.json.patient.fileNo).toBe(1);
    expect(r.json.patient.alerts).toEqual(['allergy_penicillin', 'anticoagulants', 'diabetes']);
    ids.hussein = r.json.patient.id;
    // a mother books her son on her own phone: same number is fine
    ids.son = (await reception.post('/v1/dent/patients', { name: 'Zaid Hussein', phone: '07701234567', birthDate: '2016-01-01', guardian: 'Hussein Ali' })).json.patient.id;
    const found = (await reception.get('/v1/dent/patients?q=4567')).json.patients;
    expect(found.map((p: any) => p.name).sort()).toEqual(['Hussein Ali', 'Zaid Hussein']);
    expect((await reception.get('/v1/dent/patients?q=1')).json.patients[0].name).toBe('Hussein Ali'); // by file number
    expect((await reception.get('/v1/dent/patients?q=zaid')).json.patients).toHaveLength(1);
  });

  it('the file opens with alerts; opening it is logged', async () => {
    const f = (await associate.get(`/v1/dent/patients/${ids.hussein}`)).json;
    expect(f.patient.medical.medications).toBe('Warfarin 5mg');
    const log = (await owner.get(`/v1/dent/patients/${ids.hussein}/access`)).json.access;
    expect(log.some((x: any) => x.action === 'open' && x.name === 'Dr Ali')).toBe(true);
    expect((await reception.get(`/v1/dent/patients/${ids.hussein}/access`)).status).toBe(403);
  });
});

describe('the schedule', () => {
  it('books without double-booking the chair or the dentist', async () => {
    const at = new Date(Date.now() + 2 * 3600_000); at.setUTCMinutes(0, 0, 0);
    const a = await reception.post('/v1/dent/appointments', { patientId: ids.hussein, dentistId: ids.ali, chairId: ids.chair1, startsAt: at.toISOString(), minutes: 45, reason: 'Implant consult' });
    expect(a.status).toBe(201);
    ids.appt = a.json.appointment.id;
    expect(a.json.appointment.patient.alerts).toContain('anticoagulants');
    const clash = { patientId: ids.son, chairId: ids.chair1, startsAt: new Date(+at + 15 * 60_000).toISOString(), minutes: 30 };
    expect((await reception.post('/v1/dent/appointments', clash)).json.error).toBe('SLOT_TAKEN');
    expect((await reception.post('/v1/dent/appointments', { ...clash, chairId: ids.chair2, dentistId: ids.ali })).json.error).toBe('SLOT_TAKEN'); // same dentist
    expect((await reception.post('/v1/dent/appointments', { ...clash, chairId: ids.chair2 })).status).toBe(201);
    expect((await reception.post('/v1/dent/appointments', { ...clash, force: true })).status).toBe(201); // a deliberate double-booking
  });

  it('a WhatsApp reminder, then the day: arrived → in the chair (the waiting room sees it)', async () => {
    const rem = (await reception.post(`/v1/dent/appointments/${ids.appt}/remind`, { lang: 'en' })).json;
    expect(rem.message).toContain('Smile Dental');
    expect(rem.message).toContain('Dr Ali');
    expect(rem.whatsappUrl).toMatch(/^https:\/\/wa\.me\/9647701234567\?text=/);
    const arrived = (await reception.req('PATCH', `/v1/dent/appointments/${ids.appt}`, { status: 'arrived' })).json.appointment;
    expect(arrived.arrivedAt).toBeTruthy();
    expect((await reception.get('/v1/dent/queue')).json.queue[0]).toMatchObject({ name: 'Hussein Ali', status: 'arrived', chair: 'Chair 1' });
    await associate.req('PATCH', `/v1/dent/appointments/${ids.appt}`, { status: 'seated' });
  });

  it('the waiting-room screen: a display-only link that shows short names, and a reset cuts it off', async () => {
    const { key } = (await reception.get('/v1/dent/screen-link')).json;
    expect((await owner.get('/v1/dent/screen-link')).json.key).toBe(key); // one link per clinic
    expect((await owner.get('/v1/dent/setup')).json.settings.screenKey).toBeUndefined();
    const tv = new Browser(t.app); // nobody signed in
    const s = (await tv.get(`/v1/dent/screen?k=${encodeURIComponent(key)}`)).json;
    expect(s.clinic.name).toBe('Smile Dental');
    expect(s.chairs.map((c: any) => c.name)).toContain('Chair 1');
    expect(s.queue[0]).toMatchObject({ name: 'Hussein A.', status: 'seated', dentist: 'Dr Ali' });
    expect(JSON.stringify(s)).not.toContain('Hussein Ali'); // never the full name, phone or file number
    expect(JSON.stringify(s)).not.toMatch(/phone|fileNo|07701/);
    expect((await tv.get(`/v1/dent/screen?k=${encodeURIComponent(key.slice(0, -2) + 'xx')}`)).status).toBe(404);
    expect((await reception.post('/v1/dent/screen-link/reset')).status).toBe(403); // only who sets up the clinic
    const fresh = (await owner.post('/v1/dent/screen-link/reset')).json.key;
    expect((await tv.get(`/v1/dent/screen?k=${encodeURIComponent(key)}`)).status).toBe(404);
    expect((await tv.get(`/v1/dent/screen?k=${encodeURIComponent(fresh)}`)).status).toBe(200);
  });
});

describe('the chart and treatment plans', () => {
  it('findings on several teeth; teeth and surfaces are checked', async () => {
    const f = await associate.post(`/v1/dent/patients/${ids.hussein}/findings`, { teeth: [18, 28, 38, 48], kind: 'missing' });
    expect(f.json.findings).toHaveLength(4);
    const car = await associate.post(`/v1/dent/patients/${ids.hussein}/findings`, { tooth: 36, kind: 'caries', surfaces: 'om' });
    expect(car.json.findings[0].surfaces).toBe('MO');
    expect((await associate.post(`/v1/dent/patients/${ids.hussein}/findings`, { tooth: 19, kind: 'caries' })).json.error).toBe('BAD_TOOTH');
    expect((await reception.post(`/v1/dent/patients/${ids.hussein}/findings`, { tooth: 11, kind: 'caries' })).status).toBe(403);
    expect((await reception.get(`/v1/dent/patients/${ids.hussein}/chart`)).status).toBe(403); // reception never sees the clinical file
  });

  it('two options for a missing tooth; accepting one declines the other', async () => {
    const implant = await associate.post('/v1/dent/plans', { patientId: ids.hussein, title: 'Option A: implant', optionGroup: '46', dentistId: ids.ali,
      items: [{ procedureId: ids.proc['Dental implant'], tooth: 46 }, { procedureId: ids.proc['Implant crown'], tooth: 46, phase: 2 }] });
    expect(implant.status).toBe(201);
    expect(implant.json.plan.totals).toMatchObject({ usd: 650, iqd: 942500, count: 2 }); // 450 + 200 USD at 1,450
    const bridge = await associate.post('/v1/dent/plans', { patientId: ids.hussein, title: 'Option B: bridge', optionGroup: '46',
      items: [45, 46, 47].map((tooth) => ({ procedureId: ids.proc['Zirconia crown'], tooth })) });
    let chart = (await associate.get(`/v1/dent/patients/${ids.hussein}/chart`)).json.findings;
    expect(chart.filter((f: any) => f.status === 'planned')).toHaveLength(5);
    await reception.req('PATCH', `/v1/dent/plans/${implant.json.plan.id}`, { status: 'accepted' });
    const plans = (await reception.get(`/v1/dent/patients/${ids.hussein}/plans`)).json.plans;
    expect(plans.find((p: any) => p.id === bridge.json.plan.id).status).toBe('declined');
    chart = (await associate.get(`/v1/dent/patients/${ids.hussein}/chart`)).json.findings;
    expect(chart.filter((f: any) => f.status === 'planned').map((f: any) => f.kind).sort()).toEqual(['crown', 'implant']);
    ids.plan = implant.json.plan;
  });

  it('a payment schedule: a first payment, then equal months', async () => {
    const r = await reception.post(`/v1/dent/plans/${ids.plan.id}/installments`, { months: 4, downPayment: 342500, firstDue: '2026-10-01' });
    const inst = r.json.plan.installments;
    expect(inst).toHaveLength(5);
    expect(inst[0]).toMatchObject({ dueDate: '2026-10-01', amount: 342500 });
    expect(inst.slice(1).map((i: any) => i.amount)).toEqual([150000, 150000, 150000, 150000]);
    expect(inst[4].dueDate).toBe('2027-02-01');
  });
});

describe('visits and billing', () => {
  it('the implant is placed: billed in dinars at today’s rate, part paid; chart, plan and appointment move on', async () => {
    const v = await associate.post('/v1/dent/visits', { patientId: ids.hussein, appointmentId: ids.appt, complaint: 'Missing 46', notes: 'Implant 4.1×10 placed at 46. Good primary stability.', anesthesia: 'Lidocaine 2% × 2',
      items: [{ planItemId: ids.plan.items[0].id }, { procedureId: ids.proc['Periapical X-ray'], tooth: 46 }], paid: 300000, method: 'cash' });
    expect(v.status).toBe(201);
    expect(v.json.items[0]).toMatchObject({ name: 'Dental implant', currency: 'USD', priceOriginal: 450, usdRate: 1450, amount: 652500, dentistId: ids.ali });
    expect(v.json.sale).toMatchObject({ total: 657500, paid: 300000, due: 357500, method: 'mixed', note: 'dental' });
    expect(v.json.customer.balance).toBe(357500);
    ids.visit = v.json.visit.id;
    const chart = (await associate.get(`/v1/dent/patients/${ids.hussein}/chart`)).json.findings;
    expect(chart.find((f: any) => f.tooth === 46 && f.kind === 'implant').status).toBe('done');
    const plan = (await reception.get(`/v1/dent/patients/${ids.hussein}/plans`)).json.plans.find((p: any) => p.id === ids.plan.id);
    expect(plan.status).toBe('in_progress');
    expect((await reception.get(`/v1/dent/appointments?from=${new Date(Date.now() - 86400_000).toISOString()}`)).json.appointments.find((x: any) => x.id === ids.appt).status).toBe('done');
  });

  it('a filling on the cavity clears the caries mark; a cleaning sets the next check-up', async () => {
    await associate.post('/v1/dent/visits', { patientId: ids.hussein, items: [{ procedureId: ids.proc['Composite filling, back'], tooth: 36, surfaces: 'MO' }, { procedureId: ids.proc['Scaling & polishing'] }], paid: 65000 });
    const chart = (await associate.get(`/v1/dent/patients/${ids.hussein}/chart`)).json.findings.filter((f: any) => f.tooth === 36);
    expect(chart.map((f: any) => f.kind)).toEqual(['filling']);
    expect((await reception.get(`/v1/dent/patients/${ids.hussein}`)).json.patient.recallDue).toBeTruthy();
  });

  it('notes: the author edits them for a day; anyone else (or later) adds a correction below', async () => {
    const edit = await associate.req('PATCH', `/v1/dent/visits/${ids.visit}`, { notes: 'Implant 4.1×10 placed at 46. ISQ 72.' });
    expect(edit.json.visit.notes).toContain('ISQ 72');
    const other = await owner.req('PATCH', `/v1/dent/visits/${ids.visit}`, { notes: 'Checked by Dr Sara.' });
    expect(other.json.visit.notes).toContain('ISQ 72');
    expect(other.json.visit.amendments[0].text).toBe('Checked by Dr Sara.');
  });

  it('reception sees the visits and money, not the clinical notes', async () => {
    const visits = (await reception.get(`/v1/dent/patients/${ids.hussein}/visits`)).json.visits;
    expect(visits[0].sale).toBeTruthy();
    expect(visits[0].notes).toBeUndefined();
    expect((await associate.get(`/v1/dent/patients/${ids.hussein}/visits`)).json.visits.find((v: any) => v.id === ids.visit).notes).toContain('ISQ');
  });

  it('a later payment on the account, and the dentist’s share traced to it', async () => {
    const pay = await reception.post(`/v1/sys/customers/${ids.hussein}/payments`, { amount: 200000, method: 'cash' });
    expect(pay.status).toBe(201);
    const lab = await associate.post('/v1/dent/labs', { name: 'Al-Rafidain Lab', phone: '07801112222' });
    const order = await associate.post('/v1/dent/lab', { patientId: ids.hussein, labId: lab.json.lab.id, work: 'Implant crown, zirconia', teeth: '46', shade: 'A2', cost: 90000, dueAt: new Date(Date.now() + 7 * 86400_000).toISOString() });
    expect((await associate.req('PATCH', `/v1/dent/lab/${order.json.order.id}`, { status: 'received' })).json.order.receivedAt).toBeTruthy();
    expect((await owner.get('/v1/sys/suppliers')).json.suppliers.find((s: any) => s.name === 'Al-Rafidain Lab').balance).toBe(90000);
    expect((await associate.req('PATCH', `/v1/dent/lab/${order.json.order.id}`, { cost: 1 })).json.error).toBe('ALREADY_BILLED');

    const rep = (await owner.get(`/v1/dent/reports?from=${new Date(Date.now() - 86400_000).toISOString()}&to=${new Date(Date.now() + 60_000).toISOString()}`)).json;
    const ali = rep.byDentist.find((x: any) => x.dentistId === ids.ali);
    // Ali billed 657,500 + 65,000 (the filling visit had no dentist chosen → Ali, whose account made it) … collected = what was paid toward his work
    expect(ali.collected).toBe(300000 + 65000 + 200000);
    expect(ali.labCost).toBe(90000);
    expect(ali.share).toBe(Math.round((565000 - 90000) * 0.4));
    expect(rep.collected).toBe(565000);
    expect(rep.byProcedure[0].name).toBe('Dental implant');
    expect(rep.outstanding.total).toBe(157500);
    expect(rep.referral[0]).toMatchObject({ source: 'Instagram' });
  });

  it('tracing payments: at-visit money pays that visit; later money pays the oldest work first', () => {
    const ch = (saleId: string, dentistId: string, at: number, amount: number) => ({ patient: 'p', saleId, dentistId, at, amount, left: amount });
    const out = allocate([ch('s1', 'A', 1, 100), ch('s2', 'B', 2, 100)], [{ saleId: 's2', amount: 50, at: 2 }], [{ patient: 'p', amount: 120, at: 3 }]);
    const by = (id: string) => out.filter((x) => x.dentistId === id).reduce((s, x) => s + x.amount, 0);
    expect(by('A')).toBe(100);
    expect(by('B')).toBe(70);
  });
});

describe('the rest of the file', () => {
  it('prescriptions', async () => {
    const rx = await associate.post('/v1/dent/rx', { patientId: ids.hussein, visitId: ids.visit, items: [{ drug: 'Amoxicillin 500mg', how: '1 × 3 daily', days: 5 }, { drug: 'Ibuprofen 400mg', how: 'when needed' }] });
    expect(rx.status).toBe(201);
    expect((await reception.get(`/v1/dent/patients/${ids.hussein}/rx`)).status).toBe(403);
  });

  it('the gum chart', async () => {
    expect((await associate.post('/v1/dent/perio', { patientId: ids.hussein, data: { '16': { pd: [3, 2, 4, 5, 3, 2], bop: [0, 0, 1, 1, 0, 0], mob: 1 } } })).status).toBe(201);
    expect((await associate.post('/v1/dent/perio', { patientId: ids.hussein, data: { '16': { pd: [3, 2] } } })).json.error).toBe('BAD_PERIO');
    expect((await associate.post('/v1/dent/perio', { patientId: ids.hussein, data: { '19': {} } })).json.error).toBe('BAD_PERIO');
  });

  it('X-rays: uploaded to the file, described, shown through a link that lasts about an hour', async () => {
    const up = await associate.upload(`/v1/sys/files?purpose=clinical&ref=${ids.hussein}`, PNG);
    expect(up.status).toBe(201);
    await associate.put(`/v1/dent/images/${up.json.file.id}`, { kind: 'periapical', teeth: [46], visitId: ids.visit });
    const imgs = (await associate.get(`/v1/dent/patients/${ids.hussein}/images`)).json.images;
    expect(imgs[0]).toMatchObject({ kind: 'periapical', teeth: [46] });
    const exp = Number(new URL(imgs[0].url).searchParams.get('e'));
    expect(exp * 1000 - Date.now()).toBeLessThan(75 * 60_000);
    expect((await reception.upload(`/v1/sys/files?purpose=clinical&ref=${ids.hussein}`, PNG)).status).toBe(403);
  });

  it('a signed consent is kept: the text as signed, the signature, never deleted', async () => {
    const sig = await reception.upload(`/v1/sys/files?purpose=consent&ref=${ids.hussein}`, PNG);
    const c = await reception.post('/v1/dent/consents', { patientId: ids.hussein, kind: 'implant', text: 'I agree to implant surgery…', signedName: 'Hussein Ali', signatureFileId: sig.json.file.id });
    expect(c.status).toBe(201);
    expect((await reception.get(`/v1/dent/patients/${ids.hussein}/consents`)).json.consents[0].signatureUrl).toBeTruthy();
    expect((await owner.del(`/v1/sys/files/${sig.json.file.id}`)).json.error).toBe('CONSENT_IS_KEPT');
  });

  it('the timeline tells the story; the dashboard sums up the day', async () => {
    const ev = (await reception.get(`/v1/dent/patients/${ids.hussein}/timeline`)).json.events;
    expect(ev.map((e: any) => e.type)).toEqual(expect.arrayContaining(['visit', 'payment', 'plan', 'lab', 'consent']));
    expect(ev.find((e: any) => e.type === 'visit').notes).toBeUndefined();
    const dash = (await reception.get('/v1/dent/dashboard')).json;
    expect(dash.collected).toBe(565000);
    expect(dash.outstanding).toBe(157500);
    expect(dash.lab.ready).toBe(1);
  });

  it('another clinic sees nothing', async () => {
    const other = new Browser(t.app);
    await signInEmail(other, 'dr.omar@other.iq');
    const oc = (await other.post('/v1/dent/start', { name: 'Omar Dental' })).json.organizationId;
    await other.post('/v1/auth/organization/set-active', { organizationId: oc });
    expect((await other.get(`/v1/dent/patients/${ids.hussein}`)).status).toBe(404);
    expect((await other.get('/v1/dent/patients?q=Hussein')).json.patients).toHaveLength(0);
  });
});

describe('the trial ends', () => {
  it('reading still works; changing needs Hemlo to activate the clinic', async () => {
    await system(`update hemlo_subscription set trial_ends_at = now() - interval '1 minute' where organization_id = $1`, [clinicId]);
    forgetSubscription(clinicId);
    expect((await owner.get('/v1/sys/me')).json.subscription.status).toBe('ended');
    expect((await reception.post('/v1/dent/patients', { name: 'New' })).json.error).toBe('TRIAL_ENDED');
    expect((await reception.get(`/v1/dent/patients/${ids.hussein}`)).status).toBe(200);
    const act = await founder.req('PATCH', `/v1/admin/subscriptions/${clinicId}`, { action: 'activate', months: 1, seats: 2, priceNote: '$35/month, 2 dentists' });
    expect(act.json.subscription.state).toMatchObject({ status: 'active', seats: 2 });
    forgetSubscription(clinicId);
    expect((await reception.post('/v1/dent/patients', { name: 'New' })).status).toBe(201);
    const usage = (await founder.get('/v1/admin/usage')).json;
    expect(usage.shops.find((s: any) => s.id === clinicId).subscription).toMatchObject({ status: 'active', seats: 2, dentists: 2, priceNote: '$35/month, 2 dentists' });
  });
});

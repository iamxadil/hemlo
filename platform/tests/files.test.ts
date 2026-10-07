// Images: the shop logo, product photos, invoice and receipt photos. Real images only, each shop's to itself,
// shown through signed links, and cleaned up when replaced, deleted, never used, or when a demo shop goes.
import { describe, it, expect, beforeAll } from 'vitest';
import { setup, Browser, signInEmail, signInPhone, createOrg } from './helpers';
import { purgeOrphanFiles } from '../apps/api/src/routes/files';
import { purgeDemos } from '../apps/api/src/routes/demo';

let t: Awaited<ReturnType<typeof setup>>;
let owner: Browser, cashier: Browser, other: Browser;
const PNG = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0xff, 0xd9]);
const path = (url: string) => url.replace('http://localhost:8787', '');
const system = async (q: string, params: unknown[] = []) => t.client.transaction(async (tx: any) => { await tx.query("select set_config('app.system', 'on', true)"); return (await tx.query(q, params)).rows; });

beforeAll(async () => {
  t = await setup();
  owner = new Browser(t.app);
  await signInEmail(owner, 'owner@noor.iq');
  await createOrg(owner, 'Noor Market');
  const inv = await owner.post('/v1/invites', { phone: '07705550001', role: 'cashier', name: 'Hassan' });
  cashier = new Browser(t.app);
  await signInPhone(cashier, '+9647705550001');
  await cashier.post(`/v1/invites/by-token/${encodeURIComponent(new URL(inv.json.url).searchParams.get('t')!)}/accept`);
  other = new Browser(t.app);
  await signInEmail(other, 'owner@other.iq');
  await createOrg(other, 'Other Shop');
});

describe('the shop logo', () => {
  it('uploads, becomes the logo, and shows through a signed link that needs no sign-in', async () => {
    const up = await owner.upload('/v1/sys/files?purpose=logo&w=512&h=512', PNG);
    expect(up.status).toBe(201);
    expect(up.json.file).toMatchObject({ width: 512, height: 512 });
    expect((await owner.put('/v1/sys/files/logo', { fileId: up.json.file.id })).json.logoUrl).toMatch(/\/v1\/files\/.+\?e=\d+&s=/);
    const me = (await owner.get('/v1/sys/me')).json;
    const img = await new Browser(t.app).get(path(me.business.logoUrl)); // a stranger with the link, no cookie
    expect(img.status).toBe(200);
    expect(img.headers.get('content-type')).toBe('image/png');
    expect(img.headers.get('cache-control')).toMatch(/max-age=\d+/);
    expect(img.headers.get('access-control-allow-origin')).toMatch(/^(\*|http:\/\/localhost:4321)$/); // so a receipt can draw it
  });

  it('a changed or expired link shows nothing', async () => {
    const url = path((await owner.get('/v1/sys/me')).json.business.logoUrl);
    expect((await new Browser(t.app).get(url.replace(/s=[^&]+/, 's=' + 'a'.repeat(43)))).status).toBe(404);
    expect((await new Browser(t.app).get(url.replace(/e=\d+/, 'e=1000'))).status).toBe(404);
  });

  it('a new logo replaces the old one; the old image is deleted', async () => {
    const before = t.files.size();
    const up = await owner.upload('/v1/sys/files?purpose=logo', JPEG, 'image/jpeg');
    await owner.put('/v1/sys/files/logo', { fileId: up.json.file.id });
    expect(t.files.size()).toBe(before); // one in, one out
    expect((await owner.get('/v1/sys/settings')).json.logoUrl).toContain(up.json.file.id);
  });

  it('a cashier cannot change the logo', async () => {
    expect((await cashier.upload('/v1/sys/files?purpose=logo', PNG)).status).toBe(403);
  });
});

describe('uploads are checked', () => {
  it('only real images, of a sane size', async () => {
    expect((await owner.upload('/v1/sys/files?purpose=product', new TextEncoder().encode('<script>alert(1)</script>'), 'image/png')).json.error).toBe('NOT_AN_IMAGE');
    expect((await owner.upload('/v1/sys/files?purpose=product', new Uint8Array(4 * 1024 * 1024 + 10).fill(0xff))).status).toBe(413);
    expect((await owner.upload('/v1/sys/files?purpose=nonsense', PNG)).json.error).toBe('BAD_PURPOSE');
  });
});

describe('product photos', () => {
  it('a product gets a photo; changing it deletes the old one; another shop cannot use it', async () => {
    const a = (await owner.upload('/v1/sys/files?purpose=product', PNG)).json.file;
    const created = await owner.post('/v1/sys/products', { name: 'Pepsi', price: 500, imageId: a.id });
    expect(created.status).toBe(201);
    expect(created.json.product.imageUrl).toContain(a.id);
    const list = (await cashier.get('/v1/sys/products')).json.products;
    expect(list.find((p: any) => p.name === 'Pepsi').imageUrl).toContain(a.id);

    const b = (await owner.upload('/v1/sys/files?purpose=product', JPEG, 'image/jpeg')).json.file;
    const before = t.files.size();
    await owner.req('PATCH', `/v1/sys/products/${created.json.product.id}`, { imageId: b.id });
    expect(t.files.size()).toBe(before - 1);
    expect((await system('select id from sys_file where id = $1', [a.id]))).toHaveLength(0);

    // another shop can't point its product at this shop's photo, nor delete it
    expect((await other.post('/v1/sys/products', { name: 'Stolen', price: 1, imageId: b.id })).json.error).toBe('BAD_FILE');
    expect((await other.del(`/v1/sys/files/${b.id}`)).status).toBe(404);

    // removing the photo
    await owner.req('PATCH', `/v1/sys/products/${created.json.product.id}`, { imageId: null });
    expect((await owner.get('/v1/sys/products')).json.products.find((p: any) => p.name === 'Pepsi').imageUrl).toBeNull();
  });
});

describe('photos on purchases and expenses', () => {
  it('a delivery invoice photo, attached when saving or later', async () => {
    const product = (await owner.post('/v1/sys/products', { name: 'Rice', price: 2000, stock: 0 })).json.product;
    const photo = (await owner.upload('/v1/sys/files?purpose=purchase', JPEG, 'image/jpeg')).json.file;
    const p = await owner.post('/v1/sys/purchases', { lines: [{ productId: product.id, qty: 10, cost: 1500 }], attachmentIds: [photo.id] });
    expect(p.status).toBe(201);
    const later = await owner.upload(`/v1/sys/files?purpose=purchase&ref=${p.json.purchase.id}`, PNG);
    expect(later.status).toBe(201);
    const detail = (await owner.get(`/v1/sys/purchases/${p.json.purchase.id}`)).json;
    expect(detail.attachments.map((x: any) => x.id)).toEqual([photo.id, later.json.file.id]);
    // a photo already on one purchase can't be moved to another
    expect((await owner.post('/v1/sys/purchases', { lines: [{ productId: product.id, qty: 1, cost: 1500 }], attachmentIds: [photo.id] })).json.error).toBe('BAD_FILE');
  });

  it('an expense receipt photo; deleting the expense deletes the photo', async () => {
    const photo = (await owner.upload('/v1/sys/files?purpose=expense', JPEG, 'image/jpeg')).json.file;
    const e = await owner.post('/v1/sys/expenses', { category: 'generator', amount: 25000, attachmentIds: [photo.id] });
    expect(e.json.expense.attachments).toHaveLength(1);
    const list = (await owner.get('/v1/sys/expenses')).json.expenses;
    expect(list[0].attachments[0].id).toBe(photo.id);
    const before = t.files.size();
    await owner.del(`/v1/sys/expenses/${e.json.expense.id}`);
    expect(t.files.size()).toBe(before - 1);
  });
});

describe('clean-up', () => {
  it('photos uploaded but never used are deleted after a day', async () => {
    const orphan = (await owner.upload('/v1/sys/files?purpose=product', PNG)).json.file;
    const logoInUse = (await owner.get('/v1/sys/me')).json.business.logoUrl;
    await system(`update sys_file set created_at = now() - interval '2 days'`);
    const before = t.files.size();
    expect(await purgeOrphanFiles(t.db, t.files)).toBe(1);
    expect(t.files.size()).toBe(before - 1);
    expect(await system('select id from sys_file where id = $1', [orphan.id])).toHaveLength(0);
    expect((await new Browser(t.app).get(path(logoInUse))).status).toBe(200); // the logo in use stays
  });

  it('a demo shop takes its images with it', async () => {
    const visitor = new Browser(t.app);
    const token = (await visitor.post('/v1/demo/start', { lang: 'en' })).json.token;
    const up = await visitor.upload('/v1/sys/files?purpose=logo', PNG, 'image/png', { authorization: `Bearer ${token}` });
    expect(up.status).toBe(201);
    const before = t.files.size();
    await purgeDemos(t.db, 0, t.files);
    expect(t.files.size()).toBe(before - 1);
  });
});

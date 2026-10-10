// WhatsApp, behind one small interface. Two kinds:
//   meta:    the WhatsApp Business Platform (Cloud API), the only official way for a business to automate WhatsApp.
//   sandbox: nothing leaves Hemlo. A business tries Connect (and the tests run) without a number or Meta's approval.
// Every call is one HTTPS request; nothing is retried here (the outbox retries, so a send is never doubled by accident).

export const GRAPH = 'https://graph.facebook.com/v23.0';

export type WaSend =
  | { to: string; text: string }
  | { to: string; template: string; lang: 'ar' | 'en'; params: string[] };
export type WaResult = { id: string };
export type WaTemplateDef = { name: string; category: 'UTILITY' | 'MARKETING'; lang: 'ar' | 'en'; body: string; example: string[] };

export interface WaProvider {
  kind: 'sandbox' | 'meta';
  send(m: WaSend): Promise<WaResult>;
  /** the blue ticks: the business has read the customer's message */
  markRead(waId: string): Promise<void>;
  /** the business's templates at WhatsApp, by name: approved, pending or rejected */
  templates(): Promise<Record<string, { status: string; reason?: string | null }>>;
  submitTemplate(t: WaTemplateDef): Promise<void>;
}
export class WaError extends Error {
  constructor(message: string, public code?: number) { super(message); }
}

/** WhatsApp wants the number without "+". */
const digits = (phone: string) => phone.replace(/[^\d]/g, '');

export function sandboxWa(): WaProvider {
  return {
    kind: 'sandbox',
    async send() { return { id: `sandbox.${crypto.randomUUID()}` }; },
    async markRead() {},
    async templates() { return {}; }, // the sandbox needs no approval: every template counts as approved
    async submitTemplate() {},
  };
}

export function metaWa(o: { token: string; phoneNumberId: string; wabaId?: string | null; fetch?: typeof fetch }): WaProvider {
  const f = o.fetch ?? fetch;
  const call = async (path: string, init?: { method?: string; body?: unknown }) => {
    const res = await f(`${GRAPH}/${path}`, {
      method: init?.method ?? (init?.body ? 'POST' : 'GET'),
      headers: { authorization: `Bearer ${o.token}`, ...(init?.body ? { 'content-type': 'application/json' } : {}) },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || json?.error) throw new WaError(String(json?.error?.message ?? `HTTP ${res.status}`).slice(0, 300), json?.error?.code);
    return json;
  };
  return {
    kind: 'meta',
    async send(m) {
      const body = 'text' in m
        ? { messaging_product: 'whatsapp', to: digits(m.to), type: 'text', text: { body: m.text, preview_url: true } }
        : { messaging_product: 'whatsapp', to: digits(m.to), type: 'template',
            template: { name: m.template, language: { code: m.lang }, components: m.params.length ? [{ type: 'body', parameters: m.params.map((text) => ({ type: 'text', text: text || '-' })) }] : [] } };
      const out = await call(`${o.phoneNumberId}/messages`, { body });
      const id = out?.messages?.[0]?.id;
      if (!id) throw new WaError('NO_MESSAGE_ID');
      return { id };
    },
    async markRead(waId) { await call(`${o.phoneNumberId}/messages`, { body: { messaging_product: 'whatsapp', status: 'read', message_id: waId } }).catch(() => {}); },
    async templates() {
      if (!o.wabaId) return {};
      const out = await call(`${o.wabaId}/message_templates?fields=name,status,language,rejected_reason&limit=200`);
      const map: Record<string, { status: string; reason?: string | null }> = {};
      for (const t of out?.data ?? []) map[`${t.name}:${t.language}`] = { status: String(t.status).toLowerCase(), reason: t.rejected_reason && t.rejected_reason !== 'NONE' ? t.rejected_reason : null };
      return map;
    },
    async submitTemplate(t) {
      if (!o.wabaId) throw new WaError('NO_WABA');
      await call(`${o.wabaId}/message_templates`, { body: { name: t.name, language: t.lang, category: t.category,
        components: [{ type: 'BODY', text: t.body, example: { body_text: [t.example] } }] } });
    },
  };
}

/** Meta's signature on a webhook: HMAC-SHA256 of the raw body with the app secret ("sha256=<hex>"), compared in constant time. */
export async function validSignature(appSecret: string, raw: string, header: string | null | undefined) {
  if (!header?.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
  const want = Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join(''), got = header.slice(7).toLowerCase();
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

/** What a webhook carries that Connect uses: messages in, and delivery updates for messages out. */
export type WaInbound = { phoneNumberId: string; from: string; name: string | null; waId: string; at: Date; type: string; text: string };
export type WaStatus = { phoneNumberId: string; waId: string; status: string; error: string | null };
export function parseWebhook(body: any): { messages: WaInbound[]; statuses: WaStatus[] } {
  const messages: WaInbound[] = [], statuses: WaStatus[] = [];
  for (const entry of Array.isArray(body?.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const v = change?.value, pid = String(v?.metadata?.phone_number_id ?? '');
      if (!pid) continue;
      const names = new Map<string, string>((v.contacts ?? []).map((x: any) => [String(x.wa_id), String(x.profile?.name ?? '').slice(0, 80)]));
      for (const m of v.messages ?? []) {
        const text = m.type === 'text' ? m.text?.body : m.type === 'button' ? m.button?.text : m.type === 'interactive' ? (m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title)
          : m.type === 'location' ? [m.location?.name, m.location?.address].filter(Boolean).join(' · ') || '📍' : m[m.type]?.caption ?? '';
        messages.push({ phoneNumberId: pid, from: `+${String(m.from).replace(/[^\d]/g, '')}`, name: names.get(String(m.from)) || null, waId: String(m.id),
          at: new Date(Number(m.timestamp) * 1000 || Date.now()), type: String(m.type), text: String(text ?? '').slice(0, 4000) });
      }
      for (const s of v.statuses ?? []) statuses.push({ phoneNumberId: pid, waId: String(s.id), status: String(s.status), error: s.errors?.[0]?.title ? String(s.errors[0].title).slice(0, 200) : null });
    }
  }
  return { messages, statuses };
}

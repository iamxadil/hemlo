// The AI engine behind every Hemlo AI feature: one small interface ("give me JSON in this shape"), three kinds of engine.
//   workers-ai: Cloudflare's own models on its free daily allowance (Llama 4 Scout reads Arabic invoices well).
//   claude:     Anthropic's Claude (better on messy, handwritten paper). Paid per use.
//   openai:     any OpenAI-compatible service: OpenAI, OpenRouter (hundreds of models, some free), Google Gemini, Groq…
// Which engine and model does which job in which system is chosen in the admin dashboard (ai/router.ts).
// Features never call a model directly; they ask the engine, and the meter records what each call cost.
// The call waits on the network, which doesn't count toward the Worker's CPU limit.

export type JsonSchema = Record<string, unknown>;
export type AskJson = {
  system: string;
  text: string;
  /** a photo, as a data URL (data:image/jpeg;base64,…): the app shrinks it on the phone first */
  image?: string;
  schema: JsonSchema;
  maxTokens?: number;
};
export type JsonResult<T> = { data: T; model: string; inputTokens: number; outputTokens: number; costMicros: number };
export interface Engine {
  /** the provider ('workers-ai', 'claude', 'openrouter'…), shown and recorded */
  name: string;
  /** the model it runs */
  model?: string;
  /** costs money per call (the monthly AI budget guards these); the free ones don't */
  paid?: boolean;
  json<T>(req: AskJson): Promise<JsonResult<T>>;
}
export class AiError extends Error {}

/** The model's answer as JSON: tolerant of code fences and of text around the object. */
export function parseJson<T>(raw: unknown): T {
  if (raw && typeof raw === 'object') return raw as T;
  const s = String(raw ?? '').replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '');
  const start = s.indexOf('{'), end = s.lastIndexOf('}');
  if (start < 0 || end <= start) throw new AiError('NOT_JSON');
  return JSON.parse(s.slice(start, end + 1)) as T;
}

// ---------- Cloudflare Workers AI (free daily allowance) ----------
type WorkersAiBinding = { run(model: string, input: Record<string, unknown>): Promise<any> };
const WORKERS_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';

export function workersAi(binding: WorkersAiBinding, model = WORKERS_MODEL): Engine {
  return {
    name: 'workers-ai', model, paid: false,
    async json<T>(req: AskJson) {
      const content = req.image ? [{ type: 'text', text: req.text }, { type: 'image_url', image_url: { url: req.image } }] : req.text;
      const out = await binding.run(model, {
        messages: [{ role: 'system', content: req.system }, { role: 'user', content }],
        response_format: { type: 'json_schema', json_schema: req.schema },
        max_tokens: req.maxTokens ?? 1500,
        temperature: 0,
      });
      return { data: parseJson<T>(out?.response), model, inputTokens: out?.usage?.prompt_tokens ?? 0, outputTokens: out?.usage?.completion_tokens ?? 0, costMicros: 0 };
    },
  };
}

// ---------- Claude (paid per use) ----------
// Claude Opus 5.5 at low effort for these short, structured tasks. $4 per million tokens in, $20 out (2026-09 list price).
export const CLAUDE_MODEL = 'claude-opus-5-5';
const PRICE = { input: 4, output: 20 }; // US$ per million tokens (another model: its route in the dashboard carries its price)

export function claude(apiKey: string, model = CLAUDE_MODEL, price: { input: number; output: number } = PRICE): Engine {
  // the SDK is loaded on first use only, so a server start without the paid engine doesn't pay for it
  let client: any = null;
  return {
    name: 'claude', model, paid: true,
    async json<T>(req: AskJson) {
      if (!client) { const { default: Anthropic } = await import('@anthropic-ai/sdk'); client = new Anthropic({ apiKey, maxRetries: 1, timeout: 60_000 }); }
      const content: any[] = [];
      if (req.image) {
        const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(req.image);
        if (!m) throw new AiError('BAD_IMAGE');
        content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
      }
      content.push({ type: 'text', text: req.text });
      // a decline by the safety checks is retried on a fallback model by Anthropic (server-side fallback)
      const res: any = await (client.beta.messages.create as any)({
        model, max_tokens: req.maxTokens ?? 4000,
        betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
        system: req.system,
        messages: [{ role: 'user', content }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema: req.schema } },
      });
      if (res.stop_reason === 'refusal') throw new AiError('REFUSED');
      const text = (res.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
      const inputTokens = (res.usage?.input_tokens ?? 0) + (res.usage?.cache_read_input_tokens ?? 0);
      const outputTokens = res.usage?.output_tokens ?? 0;
      return { data: parseJson<T>(text), model: res.model ?? model, inputTokens, outputTokens, costMicros: Math.round(inputTokens * price.input + outputTokens * price.output) };
    },
  };
}

// ---------- any OpenAI-compatible service (OpenAI, OpenRouter, Gemini, Groq, …) ----------
export type CompatOptions = { name: string; baseUrl: string; apiKey: string; model: string; headers?: Record<string, string>; paid: boolean;
  price?: { input: number; output: number } | null; fetch?: typeof fetch };

/** Chat completions with a JSON schema. A service that doesn't take the schema gets a plain "JSON object" request, with the
 *  shape written into the instructions. OpenRouter reports what each call cost; for the others, the route's price. */
export function openaiCompat(o: CompatOptions): Engine {
  const call = o.fetch ?? fetch;
  const url = `${o.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const send = async (req: AskJson, strict: boolean) => {
    const content = req.image ? [{ type: 'text', text: req.text }, { type: 'image_url', image_url: { url: req.image } }] : req.text;
    const system = strict ? req.system : `${req.system}\n\nReply with one JSON object only, matching this JSON Schema:\n${JSON.stringify(req.schema)}`;
    const body: Record<string, unknown> = {
      model: o.model, messages: [{ role: 'system', content: system }, { role: 'user', content }], max_tokens: req.maxTokens ?? 1500, temperature: 0,
      response_format: strict ? { type: 'json_schema', json_schema: { name: 'answer', strict: true, schema: req.schema } } : { type: 'json_object' },
    };
    if (o.name === 'openrouter') body.usage = { include: true };
    return call(url, { method: 'POST', headers: { authorization: `Bearer ${o.apiKey}`, 'content-type': 'application/json', ...(o.headers ?? {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(90_000) });
  };
  return {
    name: o.name, model: o.model, paid: o.paid,
    async json<T>(req: AskJson) {
      let res = await send(req, true);
      if (res.status === 400 || res.status === 422) { await res.body?.cancel(); res = await send(req, false); } // no JSON-schema support: ask for a JSON object
      if (!res.ok) { const why = (await res.text()).slice(0, 300); throw new AiError(`HTTP_${res.status}: ${why}`); }
      const out: any = await res.json();
      const msg = out?.choices?.[0]?.message;
      if (msg?.refusal) throw new AiError('REFUSED');
      const u = out?.usage ?? {}, inputTokens = u.prompt_tokens ?? 0, outputTokens = u.completion_tokens ?? 0;
      const costMicros = typeof u.cost === 'number' ? Math.round(u.cost * 1_000_000) : o.price ? Math.round(inputTokens * o.price.input + outputTokens * o.price.output) : 0;
      return { data: parseJson<T>(msg?.content), model: out?.model ?? o.model, inputTokens, outputTokens, costMicros };
    },
  };
}

/** One engine, and another to try when it fails (not when it refuses: that answer stands). */
export function withFallback(first: Engine, second: Engine | undefined): Engine {
  if (!second) return first;
  return {
    name: first.name, model: first.model, paid: first.paid || second.paid,
    async json<T>(req: AskJson) {
      try { return await first.json<T>(req); }
      catch (e) { if (e instanceof AiError && e.message === 'REFUSED') throw e; console.error('[ai] falling back', first.name, e instanceof Error ? e.message : e); return second.json<T>(req); }
    },
  };
}

/** The engine for this deployment: Claude when a key is set, else the free Workers AI binding, else none. */
export function engineFrom(env: { ANTHROPIC_API_KEY?: string; AI?: unknown; AI_OFF?: string }): Engine | undefined {
  if (env.AI_OFF === '1') return undefined;
  if (env.ANTHROPIC_API_KEY) return claude(env.ANTHROPIC_API_KEY);
  if (env.AI && typeof (env.AI as WorkersAiBinding).run === 'function') return workersAi(env.AI as WorkersAiBinding);
  return undefined;
}

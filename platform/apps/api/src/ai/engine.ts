// The AI engine behind every Hemlo AI feature: one small interface ("give me JSON in this shape"), two engines.
//   workers-ai: Cloudflare's own models on its free daily allowance (Llama 4 Scout reads Arabic invoices well).
//   claude:     Anthropic's Claude, when ANTHROPIC_API_KEY is set (better on messy, handwritten paper). Paid per use.
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
  name: 'workers-ai' | 'claude' | 'test';
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
    name: 'workers-ai',
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
const CLAUDE_MODEL = 'claude-opus-5-5';
const PRICE = { input: 4, output: 20 }; // US$ per million tokens

export function claude(apiKey: string, model = CLAUDE_MODEL): Engine {
  // the SDK is loaded on first use only, so a server start without the paid engine doesn't pay for it
  let client: any = null;
  return {
    name: 'claude',
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
      return { data: parseJson<T>(text), model: res.model ?? model, inputTokens, outputTokens, costMicros: Math.round(inputTokens * PRICE.input + outputTokens * PRICE.output) };
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

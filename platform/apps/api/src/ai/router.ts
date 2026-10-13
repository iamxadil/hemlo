// Which model does which AI job in which system. The Hemlo team chooses in the admin dashboard (the AI page): a provider
// and model for each job, and one to fall back on. Remembered per server for 30 seconds (one query for both tables), so
// an AI call never waits on it. A job with nothing chosen uses the default engine (Claude when its key is set, else the
// free Workers AI). Providers' keys come from Worker secrets, or from the dashboard (kept encrypted, see ai/keys.ts).
import { withSystem } from '@hemlo/db';
import { hemloAiProvider, hemloAiRoute } from '@hemlo/db/schema';
import { claude, workersAi, openaiCompat, withFallback, type Engine } from './engine';
import { openKey, masterSecret } from './keys';
import type { Deps } from '../types';

export type ProviderKind = 'workers-ai' | 'anthropic' | 'openai';
export type ProviderDef = { id: string; kind: ProviderKind; label: string; baseUrl?: string; envKey?: string; headers?: Record<string, string>; keyUrl?: string; custom?: boolean };

/** The providers Hemlo knows. The team can add any other OpenAI-compatible service in the dashboard. */
export const BUILT_IN: ProviderDef[] = [
  { id: 'workers-ai', kind: 'workers-ai', label: 'Workers AI' },
  { id: 'anthropic', kind: 'anthropic', label: 'Anthropic', envKey: 'ANTHROPIC_API_KEY', keyUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'openai', kind: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', envKey: 'OPENAI_API_KEY', keyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'openrouter', kind: 'openai', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', envKey: 'OPENROUTER_API_KEY', keyUrl: 'https://openrouter.ai/keys',
    headers: { 'HTTP-Referer': 'https://hemlohq.com', 'X-Title': 'Hemlo' } },
  { id: 'gemini', kind: 'openai', label: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', envKey: 'GEMINI_API_KEY', keyUrl: 'https://aistudio.google.com/apikey' },
  { id: 'groq', kind: 'openai', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', envKey: 'GROQ_API_KEY', keyUrl: 'https://console.groq.com/keys' },
];

/** Every AI job, by system: whether it reads a photo (only models that see images can do those), and what it makes:
 *  text (JSON), an image or a video. Image and video jobs are priced per item (the route's price), not per token. */
export type JobKind = 'text' | 'image' | 'video';
export const AI_JOBS: { edition: string; feature: string; vision: boolean; kind?: JobKind }[] = [
  { edition: 'store', feature: 'invoice', vision: true },
  { edition: 'store', feature: 'ask', vision: false },
  { edition: 'gym', feature: 'members', vision: true },
  { edition: 'realestate', feature: 're_describe', vision: false },
  { edition: 'realestate', feature: 're_ask', vision: false },
  { edition: 'realestate', feature: 'connect_reply', vision: false },
  { edition: 'realestate', feature: 'connect_assist', vision: false },
  { edition: 'realestate', feature: 'studio_copy', vision: false },
  { edition: 'realestate', feature: 'studio_image', vision: false, kind: 'image' },
  { edition: 'realestate', feature: 'studio_video', vision: false, kind: 'video' },
];
export const kindOf = (feature: string): JobKind => AI_JOBS.find((j) => j.feature === feature)?.kind ?? 'text';
export const EDITIONS_WITH_AI = ['store', 'dental', 'gym', 'realestate', 'school'] as const;

/** A business's edition from its subscription, or (a demo, no subscription yet) from the kind of business it is. */
export const editionOf = (sub: { status: string; edition: string }, kind: string | null | undefined) =>
  sub.status === 'free' && kind ? (['gym', 'dental', 'realestate', 'school'].includes(kind) ? kind : 'store') : sub.edition;

export type Provider = { def: ProviderDef; enabled: boolean; key: string | null; hint: string | null; source: 'env' | 'dashboard' | 'built-in' | null };
export type Route = typeof hemloAiRoute.$inferSelect;
type Cfg = { at: number; providers: Map<string, Provider>; routes: Map<string, Route> };
let cache: Cfg | null = null;
/** After the dashboard changes something: the next call reads it again. */
export const forgetAiConfig = () => { cache = null; };

export async function aiConfig(d: Deps): Promise<Cfg> {
  if (cache && Date.now() - cache.at < 30_000) return cache;
  const [rows, routes] = await withSystem(d.db, (tx) => Promise.all([tx.select().from(hemloAiProvider), tx.select().from(hemloAiRoute)]));
  const env = d.env as unknown as Record<string, unknown>, secret = masterSecret(d.env);
  const defs: ProviderDef[] = [...BUILT_IN, ...rows.filter((x) => x.id.startsWith('custom-') && x.kind === 'openai' && x.baseUrl)
    .map((x) => ({ id: x.id, kind: 'openai' as const, label: x.label, baseUrl: x.baseUrl!, custom: true }))];
  const providers = new Map<string, Provider>();
  for (const def of defs) {
    const row = rows.find((x) => x.id === def.id);
    const fromEnv = def.envKey && typeof env[def.envKey] === 'string' && env[def.envKey] ? String(env[def.envKey]) : null;
    const fromDash = fromEnv ? null : await openKey(secret, row?.keyEnc);
    const key = fromEnv ?? fromDash;
    providers.set(def.id, { def, enabled: row?.enabled ?? true, key, hint: key ? key.slice(-4) : null,
      source: def.kind === 'workers-ai' ? (env.AI ? 'built-in' : null) : fromEnv ? 'env' : fromDash ? 'dashboard' : null });
  }
  cache = { at: Date.now(), providers, routes: new Map(routes.map((x) => [x.id, x])) };
  return cache;
}

/** An engine for one provider and model, or nothing (switched off, no key, unknown). */
export function engineOf(d: Deps, p: Provider | undefined, model: string, price?: { input: number; output: number } | null, each?: number | null): Engine | undefined {
  if (!p || !p.enabled || !model) return undefined;
  const ai = (d.env as unknown as { AI?: { run(model: string, input: Record<string, unknown>): Promise<any> } }).AI;
  switch (p.def.kind) {
    case 'workers-ai': return ai ? workersAi(ai, model, each) : undefined;
    case 'anthropic': return p.key ? claude(p.key, model, price ?? undefined) : undefined;
    case 'openai': return p.key && p.def.baseUrl
      ? openaiCompat({ name: p.def.id, baseUrl: p.def.baseUrl, apiKey: p.key, model, headers: p.def.headers, paid: !model.endsWith(':free'), price: price ?? null, each })
      : undefined;
  }
}

/** The engine for one job: this business's own choice (set for it in admin), else its system's, else the default engine. */
export async function engineFor(d: Deps, edition: string, feature: string, org?: string | null): Promise<Engine | undefined> {
  const cfg = await aiConfig(d);
  const route = (org ? cfg.routes.get(`org:${org}:${feature}`) : undefined) ?? cfg.routes.get(`${edition}:${feature}`);
  const media = kindOf(feature) !== 'text';
  if (!route) return media ? undefined : d.ai; // an image or video job runs only on a model the team chose
  const price = media ? null : route.priceIn != null && route.priceOut != null ? { input: route.priceIn, output: route.priceOut } : null;
  const each = media && route.priceIn != null ? route.priceIn : null; // an image or video job: US$ per item, as entered
  const first = engineOf(d, cfg.providers.get(route.provider), route.model, price, each);
  const second = route.fallbackProvider && route.fallbackModel ? engineOf(d, cfg.providers.get(route.fallbackProvider), route.fallbackModel, null, each) : undefined;
  if (first) return withFallback(first, second);
  return second ?? (media ? undefined : d.ai); // the chosen one can't run: the fallback, else the default (text only)
}

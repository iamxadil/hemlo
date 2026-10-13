// The interface a person chose on this device: which sidebar, how wide. One small store every frame reads, so a new
// choice (a theme, a density, another layout) is one more key here and one more option in Settings → Appearance,
// never a fork of the frames. Kept per device (a shop's counter and the owner's laptop can differ), in localStorage.
//
// Adding a choice later:
//   1. add the key and its default to `Interface` / DEFAULTS (and its allowed values to ALLOWED);
//   2. if it changes the page's look, `apply()` writes it to <html> as data-<key> so CSS can follow it;
//   3. add it to the Appearance section (views/Appearance.tsx) with its words.
// A theme follows the same path: data-theme on <html>, and each edition's colours under :root[data-theme=…].
import { useSyncExternalStore } from 'react';

export interface Interface {
  /** 'rail': the Hemlo sidebar (shared by every system); 'classic': each system's original one. */
  sidebar: 'rail' | 'classic';
  /** The Hemlo sidebar as icons only. */
  compact: boolean;
}
const DEFAULTS: Interface = { sidebar: 'rail', compact: false };
const ALLOWED: { [K in keyof Interface]: readonly Interface[K][] } = { sidebar: ['rail', 'classic'], compact: [true, false] };
const KEY = 'hemlo.interface';

function read(): Interface {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
    const out = { ...DEFAULTS };
    for (const k of Object.keys(DEFAULTS) as (keyof Interface)[]) if ((ALLOWED[k] as readonly unknown[]).includes(raw[k])) (out as any)[k] = raw[k];
    return out;
  } catch { return { ...DEFAULTS }; }
}

let state = read();
const listeners = new Set<() => void>();
function apply() { const el = document.documentElement; el.dataset.sidebar = state.sidebar; el.dataset.compact = String(state.compact); }
apply();

export function setInterface(patch: Partial<Interface>) {
  state = { ...state, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  apply();
  listeners.forEach((f) => f());
}
const subscribe = (f: () => void) => { listeners.add(f); return () => listeners.delete(f); };
export const useInterface = () => useSyncExternalStore(subscribe, () => state);

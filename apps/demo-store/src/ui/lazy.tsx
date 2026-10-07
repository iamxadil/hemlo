// Loads a part of the app only when it's first shown (the control panel, the "how it works" page). Five lines instead
// of preact/compat's lazy/Suspense, which would add ~4 kB to every shopper's download.
import { signal } from '@preact/signals';
import type { ComponentType, JSX } from 'preact';

export function lazy<P extends object>(load: () => Promise<{ default: ComponentType<P> }>) {
  const ready = signal<ComponentType<P> | null>(null);
  let started = false;
  const start = () => { if (!started) { started = true; load().then((m) => (ready.value = m.default)); } };
  const Lazy = (props: P): JSX.Element => { start(); const C = ready.value; return C ? <C {...props} /> : <div class="boot" />; };
  return Object.assign(Lazy, { preload: start });
}

// The Nafha mark: an arch (a doorway, the curve of a flacon's shoulders) holding a single drop of scent.
// Drawn open, as a line: a solid shape with a hole in it reads as the Arabic digit ٥ at small sizes.
// The name beside it comes from the settings, so a renamed shop still gets the mark.
import { tx } from '../lib/i18n';
import { settings } from '../lib/store';

export const Mark = ({ class: c = 'mark' }: { class?: string }) => (
  <svg class={c} viewBox="0 0 32 32" aria-hidden="true">
    <path d="M8.6 30.5V12.4a7.4 7.4 0 0 1 14.8 0v18.1" fill="none" stroke="currentColor" stroke-width="2.9" />
    <path d="M16 12.2s-3.3 5.5-3.3 8.7a3.3 3.3 0 0 0 6.6 0c0-3.2-3.3-8.7-3.3-8.7Z" fill="currentColor" />
  </svg>
);

export function Logo({ onClick }: { onClick?(): void }) {
  const name = tx(settings.value.name);
  return <a href="/" class="logo" aria-label={name} onClick={onClick}><Mark /><span>{name}</span></a>;
}

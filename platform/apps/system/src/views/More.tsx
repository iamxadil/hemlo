// Phones: everything that isn't in the tab bar (each edition passes its own pages).
import { Icon } from '../components/ui';

export function More({ links = [] }: { links?: { href: string; icon: string; label: string }[] }) {
  return (
    <div className="panel rows overflow-clip">
      {links.map((l) => <a key={l.href} className="row" href={l.href}><span className="thumb"><Icon n={l.icon} className="h-5 w-5" /></span><span className="flex-1 font-medium">{l.label}</span><Icon n="back" className="h-4 w-4 muted ltr:rotate-180" /></a>)}
    </div>
  );
}

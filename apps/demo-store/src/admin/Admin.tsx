// The control panel: a side menu (a tab bar on phones), the page for the URL, and — on wide screens — the live store
// beside it, so every change can be seen the moment it's made.
import { useSignal } from '@preact/signals';
import { lang, tx } from '../lib/i18n';
import { match, path } from '../lib/router';
import { newOrders, saving, settings } from '../lib/store';
import { Icon, type IconName } from '../ui/kit';
import { Mark } from '../store/Logo';
import { a, type AStrings } from './strings';
import { Dashboard } from './Dashboard';
import { Orders, OrderView } from './Orders';
import { Products } from './Products';
import { ProductEdit } from './ProductEdit';
import { Categories } from './Categories';
import { StorefrontEditor } from './StorefrontEditor';
import { Discounts } from './Discounts';
import { Settings } from './Settings';
import { previewAt } from './state';
import './admin.css';

const NAV: [string, keyof AStrings['nav'], IconName][] = [
  ['/admin', 'home', 'chart'], ['/admin/orders', 'orders', 'list'], ['/admin/products', 'products', 'box'], ['/admin/categories', 'categories', 'tag'],
  ['/admin/storefront', 'storefront', 'layout'], ['/admin/discounts', 'discounts', 'gift'], ['/admin/settings', 'settings', 'gear'],
];

function Page() {
  const p = path.value;
  let m: Record<string, string> | null;
  if (p === '/admin' || p === '/admin/') return <Dashboard />;
  if (p === '/admin/orders') return <Orders />;
  if ((m = match('/admin/orders/:no'))) return <OrderView key={m.no} no={Number(m.no)} />;
  if (p === '/admin/products') return <Products />;
  if ((m = match('/admin/products/:id'))) return <ProductEdit key={m.id} id={m.id} />;
  if (p === '/admin/categories') return <Categories />;
  if (p === '/admin/storefront') return <StorefrontEditor />;
  if (p === '/admin/discounts') return <Discounts />;
  if (p === '/admin/settings') return <Settings />;
  return <Dashboard />;
}

const isOn = (href: string) => (href === '/admin' ? path.value === '/admin' || path.value === '/admin/' : path.value.startsWith(href));

export default function Admin() {
  const preview = useSignal(true), t = a.value;
  return (
    <div class={`adm${preview.value ? ' with-preview' : ''}`}>
      <aside class="adm-side">
        <a href="/admin" class="adm-brand"><span class="adm-mark"><Mark class="" /></span><span><b>{tx(settings.value.name)}</b><small>{t.panel}</small></span></a>
        <nav class="adm-nav">
          {NAV.map(([href, key, icon]) => (
            <a href={href} aria-current={isOn(href) ? 'page' : undefined}><Icon n={icon} /><span>{t.nav[key]}</span>{key === 'orders' && newOrders.value > 0 && <em class="num">{newOrders.value}</em>}</a>
          ))}
        </nav>
        <div class="adm-side-foot">
          <button class="btn btn-ghost btn-sm" onClick={() => (lang.value = lang.value === 'ar' ? 'en' : 'ar')}><Icon n="globe" />{lang.value === 'ar' ? 'English' : 'العربية'}</button>
          <a href="/" class="btn btn-line btn-sm"><Icon n="store" />{t.viewStore}</a>
        </div>
      </aside>
      <div class="adm-main">
        <div class="adm-top">
          <p class="adm-note">{t.demoNote}</p>
          <span class={`adm-save${saving.value ? ' busy' : ''}`} role="status">{saving.value ? t.saving : <><Icon n="check" />{t.saved}</>}</span>
          <button class="btn btn-ghost btn-sm adm-preview-toggle" onClick={() => (preview.value = !preview.value)}><Icon n="eye" />{preview.value ? t.hidePreview : t.preview}</button>
          <a href="/" class="btn btn-line btn-sm adm-top-store"><Icon n="store" />{t.viewStore}</a>
        </div>
        <main class="adm-page"><Page /></main>
      </div>
      {preview.value && (
        <aside class="adm-preview" aria-label={t.preview}>
          <div class="adm-preview-bar"><span class="dot" /><span class="dot" /><span class="dot" /><span>{t.preview}</span></div>
          <iframe src={previewAt.value} title={t.preview} />
        </aside>
      )}
    </div>
  );
}

// Start: read the shop from the browser's database (or make it, the first time), then draw. The shop is in this
// bundle; the control panel is fetched only when someone opens /admin.
import { render } from 'preact';
import './styles/base.css';
import './styles/store.css';
import { boot } from './lib/store';
import { path, startRouter } from './lib/router';
import { startTheme } from './lib/format';
import { Toast } from './ui/kit';
import { Storefront } from './store/Storefront';
import { AdminPage } from './lib/preload';

function App() {
  const inAdmin = path.value === '/admin' || path.value.startsWith('/admin/');
  return (
    <>
      {inAdmin ? <AdminPage /> : <Storefront />}
      <Toast />
    </>
  );
}

boot().then(() => {
  startRouter();
  startTheme();
  render(<App />, document.getElementById('app')!);
});

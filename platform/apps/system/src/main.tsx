import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles/app.css';
import { App } from './App';
import { Display } from './views/Display';

const Waiting = lazy(() => import('./dental/Waiting').then((x) => ({ default: x.Waiting })));
const Door = lazy(() => import('./gym/Door').then((x) => ({ default: x.Door })));

// networkMode 'always': never pause while offline. A sale must reach our own offline queue (lib/api outbox), and
// lists fall back to what the device already has.
const queries = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: true, networkMode: 'always' }, mutations: { networkMode: 'always' } } });

// keep the app on the device so it opens without internet (production only)
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {location.hash.startsWith('#/display') ? <Display /> : location.hash.startsWith('#/waiting') ? <Suspense fallback={null}><Waiting /></Suspense> : location.hash.startsWith('#/door') ? <Suspense fallback={null}><Door /></Suspense> : <QueryClientProvider client={queries}><App /></QueryClientProvider>}
  </StrictMode>,
);

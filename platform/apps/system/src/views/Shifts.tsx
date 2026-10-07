// Drawer history: every close, what should have been there, what was counted, and who.
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useApp, fill } from '../lib/app';
import { Empty, Money } from '../components/ui';

export function Shifts() {
  const { t, dateTime, time } = useApp();
  const q = useQuery({ queryKey: ['shifts'], queryFn: async () => (await api('/v1/sys/shifts')).shifts as any[] });
  const rows = q.data ?? [];
  return (
    <div className="panel rows overflow-clip">
      {q.isLoading ? <div className="skeleton m-4 h-40" /> : !rows.length ? <Empty icon="drawer" text={t.drawer.none} /> : rows.map((s) => (
        <div key={s.id} className="row">
          <span className="min-w-0 flex-1">
            <b className="block font-medium">{dateTime(s.openedAt)}{s.closedAt ? ` → ${time(s.closedAt)}` : ''}</b>
            <span className="sub">{s.deviceName ? `${s.deviceName} · ` : ''}{fill(t.drawer.by, { a: s.openedByName ?? '—', b: s.closedByName ?? '—' })}{s.note ? ` · ${s.note}` : ''}</span>
          </span>
          {s.closedAt ? <>
            <span className="hidden text-end sm:block"><span className="sub block">{t.drawer.expected}</span><Money v={s.expectedCash} /></span>
            <span className="text-end"><span className="sub block">{t.drawer.counted}</span><Money v={s.countedCash} className="font-semibold" /></span>
            <span className={`pill ${s.difference < 0 ? 'bad' : s.difference > 0 ? 'warn' : 'ok'}`}>{s.difference === 0 ? t.drawer.exact : <><span>{s.difference < 0 ? t.drawer.short : t.drawer.over}</span><Money v={Math.abs(s.difference)} /></>}</span>
          </> : <span className="pill info">{t.drawer.openSince.replace('{t}', time(s.openedAt))}</span>}
        </div>
      ))}
    </div>
  );
}

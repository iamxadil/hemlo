// Small pieces of the gym's look: a member's face (photo or initials, with their state as a ring), the "what's left"
// arc, the state pill, the member picker, a floating panel, the camera that reads cards.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { initials } from '../lib/app';
import { Icon, toLatin } from '../components/ui';
import { useG } from './i18n';
import { tone, type MemberRow } from './data';

export { HMark, SlideSeg, useCountUp } from '../dental/ui';

/** A member's face: their photo, or their initials; the ring shows their state at a glance. */
export function Face({ name, url, state, size = 'md' }: { name: string; url?: string | null; state?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  return (
    <span className={`gy-face gy-face-${size}${state ? ` tn-${tone(state)}` : ''}`}>
      {url ? <img src={url} alt="" loading="lazy" decoding="async" /> : <span>{initials(name)}</span>}
    </span>
  );
}

/** What's left of a membership, as an arc around a number (days, or visits). */
export function LeftArc({ value, size = 120, stroke = 9, state, children }: { value: number; size?: number; stroke?: number; state: string; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className={`gy-arc tn-${tone(state)}`} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="gy-arc-track" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} className="gy-arc-fill" strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${Math.max(0.001, value) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ ['--c' as any]: c }} />
      </svg>
      <div className="gy-arc-in">{children}</div>
    </div>
  );
}

export function StatePill({ state }: { state: string }) {
  const { g } = useG();
  return <span className={`gy-pill tn-${tone(state)}`}><i />{g.state[state] ?? state}</span>;
}

/** Find a member as you type (name, phone, number, or a scanned card). */
export function MemberPicker({ onPick, autoFocus = true, placeholder }: { onPick(m: MemberRow): void; autoFocus?: boolean; placeholder?: string }) {
  const { g, num } = useG();
  const [q, setQ] = useState('');
  const [d, setD] = useState('');
  useEffect(() => { const t = setTimeout(() => setD(toLatin(q.trim())), 140); return () => clearTimeout(t); }, [q]);
  const found = useQuery({ queryKey: ['gym-members', 'pick', d], queryFn: async () => (await api(`/v1/gym/members?q=${encodeURIComponent(d)}`)).members as MemberRow[], enabled: d.length >= 1, placeholderData: (x) => x });
  return (
    <div className="grid gap-2">
      <div className="search"><Icon n="search" /><input className="input" autoFocus={autoFocus} placeholder={placeholder ?? g.shell.searchLong} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {d && (
        <div className="panel rows max-h-72 overflow-y-auto">
          {(found.data ?? []).slice(0, 8).map((m) => (
            <button type="button" key={m.id} className="row w-full text-start" onClick={() => onPick(m)}>
              <Face name={m.name} url={m.photoUrl} state={m.state} size="sm" />
              <span className="min-w-0 flex-1"><b className="block truncate font-medium">{m.name}</b><span className="sub" dir="auto">{g.members.no.replace('{n}', num(m.memberNo))}{m.phone ? ` · ${m.phone.replace(/^\+964/, '0')}` : ''}</span></span>
              <StatePill state={m.state} />
            </button>
          ))}
          {found.data && !found.data.length && <p className="sub p-4">{g.members.none}</p>}
        </div>
      )}
    </div>
  );
}

/** A floating panel: next to the rail on bigger screens, a bottom sheet on phones. Closes on Esc or a tap outside. */
export function Panel({ children, onClose, className = '' }: { children: ReactNode; onClose(): void; className?: string }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return createPortal(<><div className="gy-scrim" onClick={onClose} /><div className={`gy-panel ${className}`} role="dialog" aria-modal="true">{children}</div></>, document.body);
}

/** Can this browser read QR codes from the camera by itself? (Chrome on Android and Mac: yes; elsewhere a USB scanner does it.) */
export const canScan = () => typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;

/** The camera, reading member cards. Calls onCode once per card (the same card is ignored for 4 s). */
export function CameraScan({ onCode, facing = 'environment', className = '' }: { onCode(code: string): void; facing?: 'user' | 'environment'; className?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let stream: MediaStream | null = null, stop = false, raf = 0, last = '', lastAt = 0;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 } }, audio: false });
        if (stop) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = video.current!; v.srcObject = stream; await v.play();
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        let busy = false, frame = 0;
        const tick = async () => {
          if (stop) return;
          raf = requestAnimationFrame(tick);
          if (busy || ++frame % 6) return; // ~10 reads a second is plenty, and keeps a tablet cool
          busy = true;
          try {
            const [hit] = await detector.detect(v);
            const code = hit?.rawValue as string | undefined;
            if (code && (code !== last || Date.now() - lastAt > 4000)) { last = code; lastAt = Date.now(); onCode(code); }
          } catch { /* a frame it couldn't read */ }
          busy = false;
        };
        raf = requestAnimationFrame(tick);
      } catch { setError(true); }
    })();
    return () => { stop = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [facing]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`gy-cam ${className}`}>
      {error ? <p className="gy-cam-err"><Icon n="camera" />—</p> : <video ref={video} playsInline muted />}
      <span className="gy-cam-frame" aria-hidden="true" />
    </div>
  );
}


/** Short sounds made on the spot: a bright two-note "in", a low "no". */
let audio: AudioContext | null = null;
export function beep(kind: 'ok' | 'bad') {
  try {
    audio ??= new AudioContext();
    if (audio.state !== 'running') audio.resume();
    const t = audio.currentTime, notes = kind === 'ok' ? [[880, 0], [1318.5, 0.09]] : [[220, 0], [196, 0.14]];
    for (const [f, at] of notes) {
      const o = audio.createOscillator(), gn = audio.createGain();
      o.type = kind === 'ok' ? 'sine' : 'triangle'; o.frequency.value = f;
      gn.gain.setValueAtTime(0, t + at); gn.gain.linearRampToValueAtTime(0.16, t + at + 0.015); gn.gain.exponentialRampToValueAtTime(0.0001, t + at + (kind === 'ok' ? 0.5 : 0.35));
      o.connect(gn).connect(audio.destination); o.start(t + at); o.stop(t + at + 0.6);
    }
  } catch { /* no sound on this device */ }
}

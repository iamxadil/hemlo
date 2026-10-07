// Keyframes: a list of [frame, value] stops, eased between, held after the last one.
import { interpolate } from 'remotion';
import { camEase } from './theme';

export type Rect = { x: number; y: number; w: number; h: number };
export const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
export const union = (...rs: Rect[]): Rect => {
  const x = Math.min(...rs.map((r) => r.x)), y = Math.min(...rs.map((r) => r.y));
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
};

export type Cam = { f: number; x: number; y: number; z: number };
/** Frame a rect: its centre, and the zoom that makes it fill most of the view (within limits). */
export const fit = (f: number, r: Rect, pad = 60, max = 1.7, min = 1): Cam => {
  const c = center(r);
  return { f, x: c.x, y: c.y, z: Math.max(min, Math.min(max, 1440 / (r.w + pad * 2), 900 / (r.h + pad * 2))) };
};

/** Where the camera is at `frame`: eased between stops (zoom eased in log space, so it feels even). */
export function camAt(frame: number, keys: Cam[]): Cam {
  if (frame <= keys[0].f) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (frame < b.f) {
      const t = camEase((frame - a.f) / Math.max(1, b.f - a.f));
      const lz = Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * t;
      return { f: frame, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: Math.exp(lz) };
    }
  }
  return keys[keys.length - 1];
}

export type Pt = { f: number; x: number; y: number; click?: boolean };
/** The cursor: travels on a gentle arc between points, like a hand does. */
export function cursorAt(frame: number, pts: Pt[]) {
  if (frame <= pts[0].f) return pts[0];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (frame < b.f) {
      const t = camEase((frame - a.f) / Math.max(1, b.f - a.f));
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), bow = Math.sin(Math.PI * t) * Math.min(80, len * 0.12);
      return { f: frame, x: a.x + dx * t + (-dy / (len || 1)) * bow, y: a.y + dy * t + (dx / (len || 1)) * bow };
    }
  }
  return pts[pts.length - 1];
}

/** 0→1 over [a, b], clamped. */
export const ramp = (frame: number, a: number, b: number, easing?: (t: number) => number) =>
  interpolate(frame, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });
/** Fade in over [a, a+len], out over [b-len, b]. */
export const window01 = (frame: number, a: number, b: number, lenIn = 14, lenOut = 14) =>
  Math.min(ramp(frame, a, a + lenIn), 1 - ramp(frame, b - lenOut, b));

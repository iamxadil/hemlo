// The dental chart, drawn like the mouth: every tooth in its real shape (incisors, canines, premolars, molars; one,
// two or three roots), shaded enamel, roots seen through the gum, the upper arch over the lower as the dentist faces
// the patient, and each tooth's biting surface between the arches (tap it to pick surfaces). FDI numbering.
// What's on a tooth is drawn the way it looks: fillings on their surfaces, crowns as caps, root canals in the canals,
// implants as titanium screws, missing teeth as ghosts. Colours: existing work blue, planned red, done green, decay brown.
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ARCHES, isUpper, isAnterior, type Finding } from './data';

export const CHART_COLORS = { existing: '#2F6FD0', planned: '#D63A46', done: '#17975A', caries: '#5B361C' } as const;
const colorOf = (f: Pick<Finding, 'kind' | 'status'>) => (f.kind === 'caries' && f.status === 'existing' ? CHART_COLORS.caries : CHART_COLORS[f.status]);

type Crown = 'incisor' | 'canine' | 'premolar' | 'molar';
type Geo = { w: number; C: number; R: number; roots: 1 | 2 | 3; crown: Crown; nk: number };
const G = (w: number, C: number, R: number, roots: 1 | 2 | 3, crown: Crown, nk = 0.7): Geo => ({ w, C, R, roots, crown, nk });
// widths and heights (crown, root) roughly in proportion to real teeth; position 1 = central incisor … 8 = wisdom tooth
const ADULT_UP: Record<number, Geo> = { 1: G(30, 40, 52, 1, 'incisor'), 2: G(25, 36, 48, 1, 'incisor'), 3: G(28, 42, 66, 1, 'canine', .64), 4: G(26, 34, 52, 2, 'premolar'), 5: G(26, 33, 52, 1, 'premolar'), 6: G(38, 30, 46, 3, 'molar', .8), 7: G(35, 29, 44, 3, 'molar', .8), 8: G(31, 27, 38, 3, 'molar', .8) };
const ADULT_LO: Record<number, Geo> = { 1: G(21, 34, 46, 1, 'incisor', .72), 2: G(22, 35, 48, 1, 'incisor', .72), 3: G(26, 40, 62, 1, 'canine', .64), 4: G(25, 33, 52, 1, 'premolar'), 5: G(26, 32, 52, 1, 'premolar'), 6: G(40, 30, 46, 2, 'molar', .82), 7: G(37, 29, 44, 2, 'molar', .82), 8: G(34, 27, 38, 2, 'molar', .82) };
const CHILD_UP: Record<number, Geo> = { 1: G(22, 26, 32, 1, 'incisor'), 2: G(19, 24, 30, 1, 'incisor'), 3: G(22, 27, 36, 1, 'canine', .64), 4: G(27, 22, 26, 3, 'molar', .8), 5: G(31, 23, 28, 3, 'molar', .8) };
const CHILD_LO: Record<number, Geo> = { 1: G(17, 24, 30, 1, 'incisor', .72), 2: G(18, 25, 32, 1, 'incisor', .72), 3: G(21, 27, 34, 1, 'canine', .64), 4: G(29, 22, 26, 2, 'molar', .82), 5: G(33, 23, 28, 2, 'molar', .82) };
export const geoOf = (t: number): Geo => {
  const q = Math.floor(t / 10), p = t % 10, primary = q >= 5, up = isUpper(t);
  return (primary ? (up ? CHILD_UP : CHILD_LO) : (up ? ADULT_UP : ADULT_LO))[p] ?? ADULT_UP[1];
};
/** The side of the tooth each surface faces on screen (as the dentist faces the patient). */
export function sides(t: number) {
  const q = Math.floor(t / 10) % 4 || 4;
  const upper = isUpper(t), mesialRight = q === 1 || q === 4;
  return { top: upper ? 'B' : 'L', bottom: upper ? 'L' : 'B', left: mesialRight ? 'D' : 'M', right: mesialRight ? 'M' : 'D', center: isAnterior(t) ? 'I' : 'O' };
}
/** Viewer's-left teeth (patient's right) are drawn with mesial on the right; the others are mirrored. */
const mirrored = (t: number) => { const q = Math.floor(t / 10) % 4 || 4; return q === 2 || q === 3; };

// ---------- one tooth, in "tooth space": x 0…w, the biting edge at y = 0, the crown up to -C, roots beyond ----------
const f2 = (n: number) => Math.round(n * 10) / 10;
function crownPath({ w, C, crown, nk }: Geo) {
  const nL = (w * (1 - nk)) / 2, nR = w - nL, y0 = -C, mid = -C * 0.45;
  const side = `M${f2(nL)},${f2(y0)} C${f2(nL * 0.3)},${f2(y0 + C * 0.08)} 0,${f2(y0 + C * 0.3)} 0,${f2(mid)}`;
  const edge: Record<Crown, string> = {
    incisor: `C0,${f2(-C * .2)} ${f2(w * .02)},${f2(-C * .05)} ${f2(w * .1)},-1.2 L${f2(w * .9)},-1.2 C${f2(w * .98)},${f2(-C * .05)} ${w},${f2(-C * .2)} ${w},${f2(mid)}`,
    canine: `C0,${f2(-C * .28)} ${f2(w * .18)},${f2(-C * .17)} ${f2(w * .33)},${f2(-C * .09)} L${f2(w * .46)},${f2(-C * .015)} Q${f2(w * .5)},${f2(C * .03)} ${f2(w * .54)},${f2(-C * .015)} L${f2(w * .67)},${f2(-C * .09)} C${f2(w * .82)},${f2(-C * .17)} ${w},${f2(-C * .28)} ${w},${f2(mid)}`,
    premolar: `C0,${f2(-C * .2)} ${f2(w * .24)},${f2(-C * .08)} ${f2(w * .43)},${f2(-C * .01)} Q${f2(w * .5)},${f2(C * .025)} ${f2(w * .57)},${f2(-C * .01)} C${f2(w * .76)},${f2(-C * .08)} ${w},${f2(-C * .2)} ${w},${f2(mid)}`,
    molar: `C0,${f2(-C * .2)} ${f2(w * .07)},${f2(-C * .05)} ${f2(w * .22)},${f2(-C * .01)} Q${f2(w * .29)},${f2(C * .025)} ${f2(w * .37)},${f2(-C * .03)} Q${f2(w * .5)},${f2(-C * .17)} ${f2(w * .63)},${f2(-C * .03)} Q${f2(w * .71)},${f2(C * .025)} ${f2(w * .78)},${f2(-C * .01)} C${f2(w * .93)},${f2(-C * .05)} ${w},${f2(-C * .2)} ${w},${f2(mid)}`,
  };
  return `${side} ${edge[crown]} C${w},${f2(y0 + C * 0.3)} ${f2(w - nL * 0.3)},${f2(y0 + C * 0.08)} ${f2(nR)},${f2(y0)} Q${f2(w / 2)},${f2(y0 - C * 0.14)} ${f2(nL)},${f2(y0)} Z`;
}
function rootPaths({ w, C, R, roots, nk }: Geo): { back?: string; main: string; canals: [number, number][][] } {
  const nL = (w * (1 - nk)) / 2, nR = w - nL, y0 = -C, top = y0 + C * 0.22;
  if (roots === 1) {
    return {
      main: `M${f2(nL)},${f2(y0)} C${f2(nL - w * .03)},${f2(y0 - R * .45)} ${f2(w * .41)},${f2(y0 - R * .92)} ${f2(w * .46)},${f2(y0 - R)} Q${f2(w * .49)},${f2(y0 - R * 1.03)} ${f2(w * .52)},${f2(y0 - R * .99)} C${f2(w * .6)},${f2(y0 - R * .9)} ${f2(nR + w * .03)},${f2(y0 - R * .45)} ${f2(nR)},${f2(y0)} Z`,
      canals: [[[w * .5, top], [w * .49, y0 - R * .5], [w * .47, y0 - R * .95]]],
    };
  }
  const two = `M${f2(nL)},${f2(y0)} C${f2(nL - w * .05)},${f2(y0 - R * .4)} ${f2(w * .1)},${f2(y0 - R * .86)} ${f2(w * .19)},${f2(y0 - R)} Q${f2(w * .25)},${f2(y0 - R * 1.04)} ${f2(w * .3)},${f2(y0 - R * .96)} C${f2(w * .36)},${f2(y0 - R * .7)} ${f2(w * .41)},${f2(y0 - R * .42)} ${f2(w * .5)},${f2(y0 - R * .36)} C${f2(w * .59)},${f2(y0 - R * .42)} ${f2(w * .63)},${f2(y0 - R * .68)} ${f2(w * .69)},${f2(y0 - R * .92)} Q${f2(w * .75)},${f2(y0 - R * .99)} ${f2(w * .8)},${f2(y0 - R * .9)} C${f2(w * .88)},${f2(y0 - R * .66)} ${f2(nR + w * .05)},${f2(y0 - R * .38)} ${f2(nR)},${f2(y0)} Z`;
  const canals: [number, number][][] = [[[w * .47, top], [w * .38, y0 - R * .35], [w * .23, y0 - R * .94]], [[w * .53, top], [w * .62, y0 - R * .35], [w * .75, y0 - R * .88]]];
  if (roots === 2) return { main: two, canals };
  // upper molars: the palatal root sits behind the two buccal roots
  const back = `M${f2(w * .3)},${f2(y0 - R * .2)} C${f2(w * .3)},${f2(y0 - R * .6)} ${f2(w * .42)},${f2(y0 - R * 1.02)} ${f2(w * .5)},${f2(y0 - R * 1.08)} C${f2(w * .58)},${f2(y0 - R * 1.02)} ${f2(w * .7)},${f2(y0 - R * .6)} ${f2(w * .7)},${f2(y0 - R * .2)} Z`;
  return { back, main: two, canals: [...canals, [[w * .5, top], [w * .5, y0 - R * .6], [w * .5, y0 - R * 1.02]]] };
}
const line = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${f2(x)},${f2(y)}`).join(' L')}`;
const curve = (pts: [number, number][]) => pts.length === 3 ? `M${f2(pts[0][0])},${f2(pts[0][1])} Q${f2(pts[1][0])},${f2(pts[1][1])} ${f2(pts[2][0])},${f2(pts[2][1])}` : line(pts);
/** Where a surface sits on the crown seen from the front (tooth space, mesial on the right). */
function surfaceSpot(s: string, { w, C }: Geo): [number, number, number, number] {
  if (s === 'M') return [w * .8, -C * .5, w * .15, C * .2];
  if (s === 'D') return [w * .2, -C * .5, w * .15, C * .2];
  if (s === 'O' || s === 'I') return [w * .5, -C * .13, w * .26, C * .1];
  if (s === 'L') return [w * .5, -C * .32, w * .14, C * .1];
  return [w * .5, -C * .55, w * .22, C * .16]; // B
}

type Ids = { hatch: string; fade: string; clip: string };
const idsFor = (uid: string): Ids => ({ hatch: `h${uid}`, fade: `f${uid}`, clip: `c${uid}` });
type State = {
  missing: boolean; ghostPlanned: boolean; xOut?: string; implant?: string; implantPlanned: boolean; crown?: string; bridge?: string; veneer?: string; rct?: string; post?: string;
  pulp?: string; fracture?: string; sealant?: string; impacted: boolean; mobility?: string; watch?: string; spots: { s: string; color: string; decay: boolean }[];
};
export function stateOf(fs: Finding[]): State {
  const live = fs.filter((f) => !f.removedAt);
  const col = (k: string) => { const f = [...live].reverse().find((x) => x.kind === k); return f ? colorOf(f) : undefined; };
  const gone = live.some((f) => (f.kind === 'missing' && f.status !== 'planned') || (f.kind === 'extraction' && f.status === 'done'));
  const plannedOut = live.find((f) => (f.kind === 'extraction' || f.kind === 'missing') && f.status === 'planned');
  const implantF = [...live].reverse().find((f) => f.kind === 'implant');
  const spots: State['spots'] = [];
  for (const f of live) if (f.kind === 'caries' || f.kind === 'filling') {
    for (const s of (f.surfaces || 'O').split('')) spots.push({ s, color: colorOf(f), decay: f.kind === 'caries' && f.status === 'existing' });
  }
  return {
    missing: gone && !implantF, ghostPlanned: !!plannedOut, xOut: plannedOut ? CHART_COLORS.planned : undefined,
    implant: implantF ? colorOf(implantF) : undefined, implantPlanned: implantF?.status === 'planned', crown: col('crown'), bridge: col('bridge'), veneer: col('veneer'),
    rct: col('rct'), post: col('post'), pulp: col('pulpotomy'), fracture: col('fracture'), sealant: col('sealant'), impacted: live.some((f) => f.kind === 'impacted'),
    mobility: col('mobility'), watch: col('watch'), spots,
  };
}

/** The crown's surface detail seen from the front, as a dental illustrator draws it: lobe lines on incisors, the
 *  cusp ridge on canines and premolars, the buccal groove (ending in its pit) and cusp lobes on molars. */
function crownDetail({ w, C, crown }: Geo) {
  if (crown === 'incisor') return `M${f2(w * .35)},${f2(-C * .1)} Q${f2(w * .33)},${f2(-C * .33)} ${f2(w * .37)},${f2(-C * .52)} M${f2(w * .65)},${f2(-C * .1)} Q${f2(w * .67)},${f2(-C * .33)} ${f2(w * .63)},${f2(-C * .52)}`;
  if (crown === 'canine') return `M${f2(w * .5)},${f2(-C * .06)} Q${f2(w * .46)},${f2(-C * .4)} ${f2(w * .5)},${f2(-C * .74)}`;
  if (crown === 'premolar') return `M${f2(w * .5)},${f2(-C * .07)} Q${f2(w * .47)},${f2(-C * .34)} ${f2(w * .5)},${f2(-C * .6)}`;
  return `M${f2(w * .5)},${f2(-C * .16)} Q${f2(w * .49)},${f2(-C * .34)} ${f2(w * .5)},${f2(-C * .46)} M${f2(w * .27)},${f2(-C * .07)} Q${f2(w * .25)},${f2(-C * .3)} ${f2(w * .29)},${f2(-C * .52)} M${f2(w * .73)},${f2(-C * .07)} Q${f2(w * .75)},${f2(-C * .3)} ${f2(w * .71)},${f2(-C * .52)}`;
}
/** The pulp chamber, shown only when it matters (root canal, pulpotomy). */
function pulpPath({ w, C, crown }: Geo) {
  const y0 = -C * 1.02;
  if (crown === 'molar') return `M${f2(w * .28)},${f2(y0)} L${f2(w * .27)},${f2(-C * .66)} Q${f2(w * .28)},${f2(-C * .47)} ${f2(w * .34)},${f2(-C * .53)} Q${f2(w * .5)},${f2(-C * .64)} ${f2(w * .66)},${f2(-C * .53)} Q${f2(w * .72)},${f2(-C * .47)} ${f2(w * .73)},${f2(-C * .66)} L${f2(w * .72)},${f2(y0)} Z`;
  if (crown === 'incisor') return `M${f2(w * .43)},${f2(y0)} Q${f2(w * .38)},${f2(-C * .62)} ${f2(w * .47)},${f2(-C * .36)} Q${f2(w * .5)},${f2(-C * .32)} ${f2(w * .53)},${f2(-C * .36)} Q${f2(w * .62)},${f2(-C * .62)} ${f2(w * .57)},${f2(y0)} Z`;
  return `M${f2(w * .38)},${f2(y0)} Q${f2(w * .34)},${f2(-C * .62)} ${f2(w * .46)},${f2(-C * .46)} Q${f2(w * .5)},${f2(-C * .4)} ${f2(w * .54)},${f2(-C * .46)} Q${f2(w * .66)},${f2(-C * .62)} ${f2(w * .62)},${f2(y0)} Z`;
}

/** A tooth seen from the front (tooth space), drawn in ink: outline, hatched shading on one side, surface detail. */
function ToothSide({ g, st, ids }: { g: Geo; st: State; ids: Ids }) {
  const { w, C, R } = g;
  const rp = rootPaths(g);
  const crown = crownPath(g);
  const nL = (w * (1 - g.nk)) / 2, nR = w - nL;
  if (st.missing && !st.bridge) return <g className="o-ghost"><path d={rp.main} /><path d={crown} /></g>;
  const pontic = st.missing && !!st.bridge; // a bridge over a gap: a crown with no roots
  const cap = st.crown ?? (pontic ? st.bridge : undefined);
  const shade = (d: string) => <path d={d} fill={`url(#${ids.hatch})`} mask={`url(#${ids.fade})`} className="o-shade" />;
  return (
    <g transform={st.impacted ? `rotate(${g.crown === 'molar' ? 22 : 12} ${w / 2} ${-C})` : undefined}>
      {!pontic && (st.implant ? (
        <g className={st.implantPlanned ? 'o-planned' : undefined}>
          <path d={`M${f2(w * .35)},${f2(-C)} L${f2(w * .65)},${f2(-C)} L${f2(w * .6)},${f2(-C - R * .12)} L${f2(w * .4)},${f2(-C - R * .12)} Z`} className="o-metal" />
          <path d={`M${f2(w * .28)},${f2(-C - R * .12)} L${f2(w * .72)},${f2(-C - R * .12)} L${f2(w * .62)},${f2(-C - R * .9)} Q${f2(w * .5)},${f2(-C - R * .99)} ${f2(w * .38)},${f2(-C - R * .9)} Z`}
            className="o-metal" stroke={st.implant} strokeWidth="1.1" strokeDasharray={st.implantPlanned ? '3 2' : undefined} />
          {Array.from({ length: 7 }, (_, i) => { const y = -C - R * (0.2 + i * 0.1), k = 0.28 + i * 0.016; return <path key={i} d={`M${f2(w * k)},${f2(y)} L${f2(w * (1 - k))},${f2(y - 2.6)}`} className="o-thread" />; })}
        </g>
      ) : (
        <g>
          {rp.back && <path d={rp.back} className="o-root back" style={{ fill: `url(#${ids.fade}r)` }} />}
          <path d={rp.main} className="o-root" style={{ fill: `url(#${ids.fade}r)` }} />
          {shade(rp.main)}
          <path d={rp.main} className="o-sketch" transform="translate(.45,-.35)" />
          {st.rct && <path d={pulpPath(g)} fill={st.rct} fillOpacity=".25" stroke={st.rct} strokeWidth=".7" />}
          {st.rct && rp.canals.map((c, i) => <path key={i} d={curve(c)} stroke={st.rct} strokeWidth="2.2" strokeLinecap="round" fill="none" />)}
          {st.post && <path d={curve([[w * .5, -C * .75], [w * .49, -C - R * .2], [w * .48, -C - R * .42]])} stroke={st.post} strokeWidth="3.6" strokeLinecap="round" fill="none" />}
        </g>
      ))}
      <path d={crown} className="o-crown" style={cap ? undefined : { fill: `url(#${ids.fade}v)` }} />
      {cap ? (
        <>
          <path d={crown} fill={cap} fillOpacity=".2" />
          {shade(crown)}
          <path d={crown} fill="none" stroke={cap} strokeWidth="1.7" strokeLinejoin="round" />
          <path d={crownPath({ ...g, w: w * .84, C: C * .86 })} transform={`translate(${f2(w * .08)},${f2(-C * .05)})`} fill="none" stroke={cap} strokeWidth=".6" opacity=".7" />
        </>
      ) : (
        <>
          {shade(crown)}
          <ellipse cx={f2(w * .44)} cy={f2(-C * .5)} rx={f2(w * .2)} ry={f2(C * .26)} fill={`url(#${ids.fade}h)`} pointerEvents="none" />
          <path d={crownDetail(g)} className="o-detail" />
          <path d={crown} className="o-sketch" transform="translate(-.4,.3)" />
        </>
      )}
      {st.pulp && <path d={pulpPath(g)} fill={st.pulp} fillOpacity=".55" stroke={st.pulp} strokeWidth=".7" />}
      {st.veneer && <path d={`M${f2(w * .14)},${f2(-C * .82)} Q${f2(w / 2)},${f2(-C * .9)} ${f2(w * .86)},${f2(-C * .82)} L${f2(w * .88)},${f2(-C * .1)} Q${f2(w / 2)},${f2(-C * .02)} ${f2(w * .12)},${f2(-C * .1)} Z`} fill={st.veneer} fillOpacity=".22" stroke={st.veneer} strokeWidth="1.1" />}
      {!cap && st.spots.map((x, i) => {
        const [cx, cy, rx, ry] = surfaceSpot(x.s, g);
        return x.decay
          ? <g key={i}><path d={`M${f2(cx - rx)},${f2(cy)} Q${f2(cx - rx * .6)},${f2(cy - ry * 1.2)} ${f2(cx)},${f2(cy - ry)} Q${f2(cx + rx * 1.1)},${f2(cy - ry * .6)} ${f2(cx + rx * .9)},${f2(cy + ry * .3)} Q${f2(cx + rx * .2)},${f2(cy + ry * 1.3)} ${f2(cx - rx * .7)},${f2(cy + ry * .7)} Z`} fill={x.color} fillOpacity=".78" stroke={x.color} strokeWidth=".5" />
              <circle cx={f2(cx + rx * .2)} cy={f2(cy - ry * .1)} r={f2(Math.min(rx, ry) * .28)} fill="#1E140C" opacity=".6" /></g>
          : <rect key={i} x={f2(cx - rx)} y={f2(cy - ry)} width={f2(rx * 2)} height={f2(ry * 2)} rx={f2(Math.min(rx, ry) * .7)} fill={x.color} fillOpacity=".72" stroke={x.color} strokeWidth=".8" />;
      })}
      {st.fracture && <path d={line([[w * .3, -C * .95], [w * .55, -C * .62], [w * .38, -C * .45], [w * .66, -C * .12]])} stroke={st.fracture} strokeWidth="1.5" fill="none" strokeLinejoin="round" />}
      {st.bridge && <path d={`M${f2(-3)},${f2(-C * .5)} L${f2(w + 3)},${f2(-C * .5)}`} stroke={st.bridge} strokeWidth="2.4" strokeLinecap="round" />}
      {st.mobility && <g stroke={st.mobility} strokeWidth="1.1" fill="none" strokeLinecap="round"><path d={`M-4,${f2(-C * .7)} q-3,${f2(C * .2)} 0,${f2(C * .4)}`} /><path d={`M${w + 4},${f2(-C * .7)} q3,${f2(C * .2)} 0,${f2(C * .4)}`} /></g>}
      {st.xOut && <g stroke={st.xOut} strokeWidth="2.2" strokeLinecap="round"><path d={`M${f2(nL - 4)},${f2(-C - R * .8)} L${f2(nR + 4)},-2`} /><path d={`M${f2(nR + 4)},${f2(-C - R * .8)} L${f2(nL - 4)},-2`} /></g>}
    </g>
  );
}

/** The biting surface (seen from above), split into its five surfaces. Centred on 0,0. */
function occSize({ w, crown }: Geo) { const r = { incisor: .5, canine: .72, premolar: .82, molar: .9 }[crown]; return [w * .94, w * r] as const; }
function occOutline(g: Geo, upper = true) {
  const [ow, oh] = occSize(g), x = ow / 2, y = oh / 2;
  if (g.crown === 'incisor') return `M${-x},0 C${-x},${-y} ${-x * .5},${-y} 0,${-y} C${x * .5},${-y} ${x},${-y} ${x},0 C${x},${y} ${x * .4},${y} 0,${y} C${-x * .4},${y} ${-x},${y} ${-x},0 Z`;
  if (g.crown === 'canine') return `M${-x},0 C${-x},${-y * .7} ${-x * .35},${-y} 0,${-y} C${x * .35},${-y} ${x},${-y * .7} ${x},0 C${x},${y * .7} ${x * .35},${y} 0,${y} C${-x * .35},${y} ${-x},${y * .7} ${-x},0 Z`;
  if (g.crown === 'premolar') return `M${-x},0 C${-x},${-y * 1.18} ${x},${-y * 1.18} ${x},0 C${x},${y * 1.02} ${-x},${y * 1.02} ${-x},0 Z`;
  const k = upper ? x * .09 : 0; // the upper molar's rhomboid lean (buccal edge toward mesial)
  const P = (px: number, py: number) => `${f2(px)},${f2(py)}`;
  return `M${P(-x * .7 + k, -y)} Q${P(k, -y * 1.09)} ${P(x * .7 + k, -y)} Q${P(x + k, -y)} ${P(x + k * .5, -y * .55)} Q${P(x * 1.05, 0)} ${P(x - k * .5, y * .55)} Q${P(x - k, y)} ${P(x * .7 - k, y)} Q${P(-k, y * 1.07)} ${P(-x * .7 - k, y)} Q${P(-x - k, y)} ${P(-x - k * .5, y * .55)} Q${P(-x * 1.05, 0)} ${P(-x + k * .5, -y * .55)} Q${P(-x + k, -y)} ${P(-x * .7 + k, -y)} Z`;
}
function occRegions(g: Geo) {
  const [ow, oh] = occSize(g), x = ow / 2 + 2, y = oh / 2 + 2, a = .36;
  const P = (pts: [number, number][]) => pts.map(([px, py]) => `${f2(px)},${f2(py)}`).join(' ');
  const ix = x * a * 1.1, iy = y * a * 1.2;
  return {
    top: P([[-x, -y], [x, -y], [ix, -iy], [-ix, -iy]]), bottom: P([[-x, y], [x, y], [ix, iy], [-ix, iy]]),
    left: P([[-x, -y], [-ix, -iy], [-ix, iy], [-x, y]]), right: P([[x, -y], [ix, -iy], [ix, iy], [x, y]]), center: P([[-ix, -iy], [ix, -iy], [ix, iy], [-ix, iy]]),
  } as const;
}
/** The biting-surface anatomy, in a frame where buccal is up (-y) and mesial is right (+x): fissures, pits, ridges.
 *  Upper first molars get the oblique ridge, lower molars the five-cusp pattern, premolars their central groove. */
function occAnatomy(g: Geo, upper: boolean): { fissures: string; pits: [number, number][]; ridges: string } {
  const [ow, oh] = occSize(g), x = ow / 2, y = oh / 2;
  const P = (px: number, py: number) => `${f2(px)},${f2(py)}`;
  if (g.crown === 'molar' && upper) return {
    fissures: `M${P(x * .52, -y * .1)} Q${P(x * .3, 0)} ${P(x * .06, y * .06)} Q${P(-x * .04, -y * .3)} ${P(x * .04, -y * .74)} M${P(x * .06, y * .06)} Q${P(-x * .02, y * .1)} ${P(-x * .1, y * .12)} M${P(-x * .42, y * .24)} Q${P(-x * .26, y * .52)} ${P(-x * .14, y * .8)} M${P(-x * .42, y * .24)} Q${P(-x * .56, y * .06)} ${P(-x * .6, -y * .2)}`,
    pits: [[x * .5, -y * .08], [x * .06, y * .06], [-x * .42, y * .22]],
    ridges: `M${P(x * .44, y * .56)} Q${P(x * .05, y * .25)} ${P(-x * .34, -y * .5)}`,
  };
  if (g.crown === 'molar') return {
    fissures: `M${P(x * .62, -y * .02)} Q${P(x * .3, y * .08)} ${P(0, 0)} Q${P(-x * .3, -y * .06)} ${P(-x * .62, y * .06)} M${P(x * .2, y * .04)} L${P(x * .22, -y * .8)} M${P(-x * .34, -y * .03)} L${P(-x * .44, -y * .8)} M${P(-x * .05, y * .01)} L${P(-x * .02, y * .82)}`,
    pits: [[x * .62, -y * .02], [0, 0], [-x * .62, y * .06]],
    ridges: '',
  };
  if (g.crown === 'premolar' && upper) return {
    fissures: `M${P(x * .5, 0)} Q${P(0, y * .1)} ${P(-x * .5, 0)}`, pits: [[x * .5, 0], [-x * .5, 0]],
    ridges: `M${P(0, -y * .72)} L${P(0, -y * .14)} M${P(0, y * .72)} L${P(0, y * .2)}`,
  };
  if (g.crown === 'premolar') return {
    fissures: `M${P(x * .45, -y * .22)} L${P(0, y * .1)} L${P(-x * .45, -y * .22)} M${P(0, y * .1)} L${P(0, y * .62)}`, pits: [[0, y * .1]],
    ridges: `M${P(0, -y * .75)} L${P(0, -y * .3)}`,
  };
  if (g.crown === 'canine') return { fissures: '', pits: [[0, -y * .22]], ridges: `M${P(x * .82, 0)} L${P(0, -y * .22)} L${P(-x * .82, 0)} M${P(0, -y * .22)} L${P(0, y * .62)}` };
  return {
    fissures: '', pits: [],
    ridges: `M${P(-x * .86, -y * .3)} Q${P(0, -y * .52)} ${P(x * .86, -y * .3)} M${P(-x * .3, y * .5)} Q${P(0, y * .85)} ${P(x * .3, y * .5)} M${P(-x * .78, -y * .15)} Q${P(-x * .55, y * .3)} ${P(-x * .3, y * .5)} M${P(x * .78, -y * .15)} Q${P(x * .55, y * .3)} ${P(x * .3, y * .5)}`,
  };
}
/** Where the cusps rise on the biting surface (buccal up, mesial right): each gets a soft highlight. */
function occCusps(g: Geo, upper: boolean): [number, number, number, number][] {
  const [ow, oh] = occSize(g), x = ow / 2, y = oh / 2;
  if (g.crown === 'molar' && upper) return [[x * .42, -y * .42, x * .36, y * .38], [-x * .42, -y * .44, x * .34, y * .36], [x * .36, y * .42, x * .42, y * .4], [-x * .46, y * .5, x * .28, y * .3]];
  if (g.crown === 'molar') return [[x * .52, -y * .42, x * .32, y * .36], [-x * .05, -y * .48, x * .32, y * .34], [-x * .6, -y * .28, x * .26, y * .3], [x * .45, y * .44, x * .36, y * .38], [-x * .4, y * .46, x * .36, y * .36]];
  if (g.crown === 'premolar' && upper) return [[0, -y * .45, x * .64, y * .4], [0, y * .45, x * .56, y * .38]];
  if (g.crown === 'premolar') return [[0, -y * .42, x * .62, y * .42], [x * .36, y * .42, x * .32, y * .32], [-x * .36, y * .42, x * .32, y * .32]];
  if (g.crown === 'canine') return [[0, -y * .15, x * .58, y * .58]];
  return [[0, -y * .28, x * .82, y * .38], [0, y * .55, x * .32, y * .3]];
}
const centroid = (pts: string): [number, number] => { const xs = pts.split(' ').map((p) => p.split(',').map(Number)); return [f2(xs.reduce((a, p) => a + p[0], 0) / xs.length), f2(xs.reduce((a, p) => a + p[1], 0) / xs.length)]; };
function ToothTop({ t, g, fs, ids, selSurfaces, pick }: { t: number; g: Geo; fs: Finding[]; ids: Ids; selSurfaces?: string; pick?: (s: string) => void }) {
  const clip = `${ids.clip}-${t}`;
  const st = stateOf(fs);
  const sd = sides(t);
  const regions = occRegions(g);
  const [ow, oh] = occSize(g);
  const upper = isUpper(t);
  if (st.missing && !st.bridge) return <path d={occOutline(g, upper)} className="o-ghost" />;
  const onSurf = (letter: string) => fs.filter((f) => !f.removedAt && f.surfaces?.includes(letter) && ['caries', 'filling', 'sealant', 'fracture'].includes(f.kind));
  const fillFor = (letter: string) => { const xs = onSurf(letter), work = xs.filter((f) => f.kind !== 'caries'); const list = work.length ? work : xs; const f = list[list.length - 1]; return f ? colorOf(f) : null; };
  const decayUnder = (letter: string) => { const xs = onSurf(letter); return xs.some((f) => f.kind === 'caries' && f.status === 'existing') && xs.some((f) => f.kind !== 'caries'); };
  const cap = st.crown ?? (st.missing ? st.bridge : undefined);
  const an = occAnatomy(g, upper);
  // anatomy is drawn with buccal up and mesial right; turn it to face the way this tooth sits in the chart
  const frame = `scale(${mirrored(t) ? -1 : 1},${upper ? 1 : -1})`;
  return (
    <g>
      <clipPath id={clip}><path d={occOutline(g, upper)} transform={frame} /></clipPath>
      <path d={occOutline(g, upper)} transform={frame} className="o-occ" style={cap ? undefined : { fill: `url(#${ids.fade}o)` }} />
      <g clipPath={`url(#${clip})`}>
        {!cap && (
          <g transform={frame} pointerEvents="none">
            {occCusps(g, upper).map(([cx, cy, rx, ry], i) => <ellipse key={i} cx={f2(cx)} cy={f2(cy)} rx={f2(rx)} ry={f2(ry)} fill={`url(#${ids.fade}c)`} />)}
            {an.pits.map(([px, py], i) => <circle key={i} cx={f2(px)} cy={f2(py)} r={f2(Math.min(ow, oh) * .2)} fill={`url(#${ids.fade}p)`} />)}
          </g>
        )}
        {(Object.keys(regions) as (keyof typeof regions)[]).map((k) => {
          const letter = sd[k], fill = fillFor(letter), on = !!selSurfaces?.includes(letter);
          return <polygon key={k} points={regions[k]} className={`surf${on ? ' on' : ''}${pick ? ' pickable' : ''}${fill ? ' filled' : ''}`} fill={fill ?? 'transparent'} fillOpacity={fill ? .72 : 1}
            onClick={pick ? (e) => { e.stopPropagation(); pick(letter); } : undefined} />;
        })}
        {(Object.keys(regions) as (keyof typeof regions)[]).filter((k) => decayUnder(sd[k])).map((k) => { const c = centroid(regions[k]); return <circle key={`c${k}`} cx={c[0]} cy={c[1]} r={Math.min(ow, oh) * .09} fill={CHART_COLORS.caries} pointerEvents="none" />; })}
        {cap && <path d={occOutline(g, upper)} transform={frame} fill={cap} fillOpacity=".2" pointerEvents="none" />}
        <path d={occOutline(g, upper)} transform={frame} fill={`url(#${ids.hatch})`} mask={`url(#${ids.fade})`} className="o-shade" />
        <path d={occOutline(g, upper)} transform={`${frame} scale(.74)`} className="o-occ-in" />
        {!cap && <path d={occOutline(g, upper)} transform={`${frame} translate(.4,-.35) scale(1.012)`} className="o-sketch" pointerEvents="none" />}
        {!cap && (
          <g transform={frame} pointerEvents="none">
            {an.ridges && <path d={an.ridges} className="o-ridge" />}
            {an.fissures && <path d={an.fissures} className="o-fis-lit" transform="translate(.45,.45)" />}
            {an.fissures && <path d={an.fissures} className="o-fis" />}
            {an.pits.map(([px, py], i) => <circle key={i} cx={f2(px)} cy={f2(py)} r=".65" className="o-pit" />)}
          </g>
        )}
        {st.sealant && <path d={`M${f2(-ow * .3)},0 L${f2(ow * .3)},0`} stroke={st.sealant} strokeWidth="2" strokeLinecap="round" pointerEvents="none" />}
      </g>
      <path d={occOutline(g, upper)} transform={frame} fill="none" stroke={cap ?? 'transparent'} strokeWidth="1.5" pointerEvents="none" />
      {st.xOut && <g stroke={st.xOut} strokeWidth="1.8" strokeLinecap="round" pointerEvents="none"><path d={`M${-ow / 2},${-oh / 2} L${ow / 2},${oh / 2}`} /><path d={`M${ow / 2},${-oh / 2} L${-ow / 2},${oh / 2}`} /></g>}
    </g>
  );
}

/** The shared ink: a hatch for shading, and the fade that keeps it to one side of each shape. */
function Paints({ ids }: { ids: Ids }) {
  return (
    <defs>
      <pattern id={ids.hatch} width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
        <line x1="0" y1="0" x2="0" y2="2.4" className="o-hatch-line" />
      </pattern>
      <linearGradient id={`${ids.fade}g`} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="1" /><stop offset=".16" stopColor="#fff" stopOpacity=".7" /><stop offset=".36" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${ids.fade}o`} cx=".42" cy=".38" r=".78"><stop offset="0" className="o-occ-s1" /><stop offset=".58" className="o-occ-s2" /><stop offset="1" className="o-occ-s3" /></radialGradient>
      <radialGradient id={`${ids.fade}c`}><stop offset="0" className="o-cusp-s" stopOpacity=".95" /><stop offset=".55" className="o-cusp-s" stopOpacity=".4" /><stop offset="1" className="o-cusp-s" stopOpacity="0" /></radialGradient>
      <radialGradient id={`${ids.fade}p`}><stop offset="0" className="o-pit-s" stopOpacity=".5" /><stop offset="1" className="o-pit-s" stopOpacity="0" /></radialGradient>
      <mask id={ids.fade} maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill={`url(#${ids.fade}g)`} /></mask>
      <radialGradient id={`${ids.fade}v`} cx=".4" cy=".42" r=".72" fx=".36" fy=".36"><stop offset="0" className="o-vol-1" /><stop offset=".5" className="o-vol-2" /><stop offset=".84" className="o-vol-3" /><stop offset="1" className="o-vol-4" /></radialGradient>
      <radialGradient id={`${ids.fade}r`} cx=".5" cy=".45" r=".7"><stop offset="0" className="o-vol-2" /><stop offset=".7" className="o-vol-3" /><stop offset="1" className="o-vol-4" /></radialGradient>
      <radialGradient id={`${ids.fade}h`}><stop offset="0" className="o-hi" stopOpacity=".95" /><stop offset="1" className="o-hi" stopOpacity="0" /></radialGradient>
      <pattern id={`${ids.hatch}b`} width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(62)"><line x1="0" y1="0" x2="0" y2="3.2" className="o-bghatch" /></pattern>
      <linearGradient id={`${ids.fade}bg`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity="1" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
      <mask id={`${ids.fade}bm`} maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill={`url(#${ids.fade}bg)`} /></mask>
      <radialGradient id={`${ids.fade}e`}><stop offset="0" className="o-emb" stopOpacity=".55" /><stop offset=".6" className="o-emb" stopOpacity=".18" /><stop offset="1" className="o-emb" stopOpacity="0" /></radialGradient>
      <linearGradient id={`${ids.fade}m`} x1="0" x2="0" y1="1" y2="0"><stop offset="0" className="o-gumstop" stopOpacity=".7" /><stop offset=".45" className="o-gumstop" stopOpacity=".18" /><stop offset="1" className="o-gumstop" stopOpacity="0" /></linearGradient>
    </defs>
  );
}

// ---------- the whole chart ----------
const GAP = 5, MID = 10, M = 24;
type Placed = { t: number; x: number; g: Geo };
function layout(row: number[]) {
  let x = 0; const out: Placed[] = [];
  row.forEach((t, i) => { const g = geoOf(t); out.push({ t, x, g }); x += g.w + (i === row.length / 2 - 1 ? GAP + MID : GAP); });
  return { teeth: out, width: x - GAP };
}
/** The gum: a scalloped line along the necks of the teeth (dipping between them), with the faintest wash toward the
 *  roots. In tooth space of the arch (roots at negative y). */
function gumPath(teeth: Placed[]) {
  const top = -Math.max(...teeth.map((p) => p.g.C + p.g.R * .45));
  let edge = '';
  teeth.forEach((p, i) => {
    const cej = -p.g.C, nx = teeth[i + 1];
    edge += ` Q${f2(p.x + p.g.w * .5)},${f2(cej - 7)} ${f2(p.x + p.g.w + GAP / 2)},${f2(nx ? Math.max(cej, -nx.g.C) + 6 : cej + 5)}`;
  });
  const start = `${f2(teeth[0].x - 4)},${f2(-teeth[0].g.C + 5)}`;
  const last = teeth[teeth.length - 1];
  return { area: `M${f2(teeth[0].x - 4)},${f2(top)} L${start}${edge} L${f2(last.x + last.g.w + 4)},${f2(top)} Z`, line: `M${start}${edge}` };
}

export function Odontogram({ findings, child = false, selected = [], surfaces = '', onTooth, onSurface, onHover, compact = false }: {
  findings: Finding[]; child?: boolean; selected?: number[]; surfaces?: string; onTooth?(t: number): void; onSurface?(s: string): void; onHover?(t: number | null): void; compact?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const ids = idsFor(`o${uid}`);
  const arch = child ? ARCHES.child : ARCHES.adult;
  const up = useMemo(() => layout(arch.upper), [child]); // eslint-disable-line react-hooks/exhaustive-deps
  const lo = useMemo(() => layout(arch.lower), [child]); // eslint-disable-line react-hooks/exhaustive-deps
  const W = Math.max(up.width, lo.width) + M * 2;
  const upX = (W - up.width) / 2, loX = (W - lo.width) / 2;
  const upH = Math.max(...up.teeth.map((p) => p.g.C + p.g.R * 1.08)), loH = Math.max(...lo.teeth.map((p) => p.g.C + p.g.R));
  const occU = Math.max(...up.teeth.map((p) => occSize(p.g)[1])), occL = Math.max(...lo.teeth.map((p) => occSize(p.g)[1]));
  const NUM = 16;
  const yU = NUM + 8 + upH;                        // upper biting edge
  const yUo = yU + 10 + occU / 2;                   // upper biting-surface row
  const yMid = yU + 20 + occU;                      // the line between the arches
  const yLo = yMid + 10 + occL / 2;                 // lower biting-surface row
  const yL = yMid + 20 + occL;                      // lower biting edge
  const H = yL + loH + NUM + 8;
  const byTooth = useMemo(() => { const m = new Map<number, Finding[]>(); for (const f of findings) (m.get(f.tooth) ?? m.set(f.tooth, []).get(f.tooth)!).push(f); return m; }, [findings]);

  // tap a tooth; drag across teeth to pick several (a bridge span)
  const dragging = useRef(false);
  useEffect(() => { const up2 = () => { dragging.current = false; }; window.addEventListener('pointerup', up2); return () => window.removeEventListener('pointerup', up2); }, []);
  // a tooth that just changed glows for a moment
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  useEffect(() => {
    const now = new Set(findings.map((f) => f.id));
    if (seen.current) { const added = findings.filter((f) => !seen.current!.has(f.id)).map((f) => f.tooth); if (added.length) { setFresh(new Set(added)); setTimeout(() => setFresh(new Set()), 1400); } }
    seen.current = now;
  }, [findings]);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = wrap.current; if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2; }, [child]);

  const tooth = (p: Placed, upper: boolean, originX: number, i: number) => {
    const fs = byTooth.get(p.t) ?? [];
    const st = stateOf(fs);
    const sel = selected.includes(p.t);
    const flip = mirrored(p.t);
    const x = originX + p.x;
    const side = `translate(${f2(x + (flip ? p.g.w : 0))},${f2(upper ? yU : yL)}) scale(${flip ? -1 : 1},${upper ? 1 : -1})`;
    const [, oh] = occSize(p.g);
    const numY = upper ? NUM : H - 8;
    return (
      <g key={p.t} className={`tooth${sel ? ' sel' : ''}${onTooth ? ' tap' : ''}${fresh.has(p.t) ? ' fresh' : ''}${upper ? ' up' : ' lo'}`} style={{ ['--i' as any]: i }}
        onPointerDown={onTooth ? (e) => { if (e.button !== 0) return; dragging.current = true; onTooth(p.t); } : undefined}
        onPointerEnter={() => { onHover?.(p.t); if (dragging.current && onTooth && !selected.includes(p.t)) onTooth(p.t); }}
        onPointerLeave={() => onHover?.(null)}
        role={onTooth ? 'button' : undefined} aria-label={String(p.t)} aria-pressed={onTooth ? sel : undefined}>
        <rect className="tooth-hit" x={f2(x - GAP / 2)} y={upper ? NUM + 2 : yMid + 2} width={f2(p.g.w + GAP)} height={f2(upper ? yMid - NUM - 4 : H - NUM - yMid - 4)} rx="9" />
        <g className="tooth-body" transform={side}><ToothSide g={p.g} st={st} ids={ids} /></g>
        <g transform={`translate(${f2(x + p.g.w / 2)},${f2(upper ? yUo : yLo)})`}>
          <ToothTop t={p.t} g={p.g} fs={fs} ids={ids} selSurfaces={sel ? surfaces : undefined} pick={sel && onSurface ? onSurface : undefined} />
        </g>
        {st.watch && <circle cx={f2(x + p.g.w / 2)} cy={f2(upper ? yUo - oh / 2 - 5 : yLo + oh / 2 + 5)} r="2.6" fill={st.watch} />}
        <text x={f2(x + p.g.w / 2)} y={numY} textAnchor="middle" className="tooth-n">{p.t}</text>
      </g>
    );
  };

  return (
    <div className="odo-wrap" dir="ltr" ref={wrap}>
      <svg viewBox={`0 0 ${f2(W)} ${f2(H)}`} className={`odontogram real${compact ? ' compact' : ''}`} role="img" onPointerLeave={() => onHover?.(null)}>
        <Paints ids={ids} />
        {/* a study drawing's construction lines: the biting edges and the necks, run long past the teeth */}
        {[yU, yU - Math.min(...up.teeth.map((p) => p.g.C)), yL, yL + Math.min(...lo.teeth.map((p) => p.g.C))].map((y, i) => (
          <line key={i} x1={f2(M * .25)} x2={f2(W - M * .25)} y1={f2(y + (i % 2 ? 0 : i ? 1.5 : -1.5))} y2={f2(y + (i % 2 ? 1.2 : 0))} className="o-guide" />
        ))}
        <line x1={f2(W / 2 - 3)} x2={f2(W / 2 + 3)} y1={NUM + 2} y2={H - NUM - 2} className="o-guide" />
        {[[upX, up.width, yU, 1], [loX, lo.width, yL, -1]].map(([ox, wd, y0, k], i) => {
          const cMax = Math.max(...(i ? lo : up).teeth.map((p) => p.g.C)), top = (k as number) > 0 ? (y0 as number) - cMax - 10 : (y0 as number) - 6;
          return <rect key={`bh${i}`} x={f2((ox as number) - 14)} y={f2(top)} width={f2((wd as number) + 28)} height={f2(cMax + 16)} fill={`url(#${ids.hatch}b)`} mask={`url(#${ids.fade}bm)`} pointerEvents="none" />;
        })}
        {[[up.teeth, upX, yU, 1], [lo.teeth, loX, yL, -1]].map(([teeth, ox, oy, k]) => (teeth as Placed[]).slice(0, -1).map((p) => (
          <ellipse key={`e${p.t}`} cx={f2((ox as number) + p.x + p.g.w + GAP / 2)} cy={f2((oy as number) - (k as number) * p.g.C * .52)} rx={f2(GAP * .9 + 2)} ry={f2(p.g.C * .42)} fill={`url(#${ids.fade}e)`} pointerEvents="none" />
        )))}
        <line x1={W / 2} x2={W / 2} y1={NUM + 4} y2={H - NUM - 4} className="midline" />
        <line x1={M / 2} x2={W - M / 2} y1={yMid} y2={yMid} className="midline" />
        {up.teeth.map((p, i) => tooth(p, true, upX, i))}
        {lo.teeth.map((p, i) => tooth(p, false, loX, i + up.teeth.length))}
        {/* the gum over the roots: roots show through it, as on an illustration */}
        {[[up.teeth, upX, yU, 1], [lo.teeth, loX, yL, -1]].map(([teeth, ox, oy, k], i) => { const gp = gumPath(teeth as Placed[]); return (
          <g key={i} transform={`translate(${f2(ox as number)},${f2(oy as number)}) scale(1,${k})`} className="gum"><path d={gp.area} className="o-gumwash" fill={`url(#${ids.fade}m)`} /><path d={gp.line} className="o-gumline" /></g>
        ); })}
      </svg>
    </div>
  );
}

/** One tooth, large: its front and its biting surface (for the inspector), surfaces tappable. */
export function ToothPortrait({ t, findings, surfaces = '', onSurface, size = 1 }: { t: number; findings: Finding[]; surfaces?: string; onSurface?(s: string): void; size?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const ids = idsFor(`p${uid}`);
  const g = geoOf(t), upper = isUpper(t), flip = mirrored(t);
  const [ow, oh] = occSize(g);
  const tall = g.C + g.R * 1.1;
  const w = Math.max(g.w, ow) + 24, h = tall + oh + 34;
  const st = stateOf(findings);
  const yEdge = upper ? tall + 6 : oh + 22;
  return (
    <svg viewBox={`0 0 ${f2(w)} ${f2(h)}`} className="tooth-portrait" style={{ width: `${size * w * 2.4}px`, maxWidth: '100%' }} role="img" aria-label={String(t)}>
      <Paints ids={ids} />
      <g transform={`translate(${f2((w - g.w) / 2 + (flip ? g.w : 0))},${f2(yEdge)}) scale(${flip ? -1 : 1},${upper ? 1 : -1})`}>
        <ToothSide g={g} st={st} ids={ids} />
        {(() => { const gp = gumPath([{ t, x: 0, g }]); return <g className="gum"><path d={gp.area} className="o-gumwash" fill={`url(#${ids.fade}m)`} /><path d={gp.line} className="o-gumline" /></g>; })()}
      </g>
      <g transform={`translate(${f2(w / 2)},${f2(upper ? tall + 20 + oh / 2 : oh / 2 + 6)})`} className="tooth sel">
        <ToothTop t={t} g={g} fs={findings} ids={ids} selSurfaces={surfaces} pick={onSurface} />
      </g>
    </svg>
  );
}

/** A tiny tooth wearing one kind of work, for the "what did you find" buttons. */
export function KindGlyph({ kind, status = 'existing' }: { kind: string; status?: 'existing' | 'planned' | 'done' }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const ids = idsFor(`k${uid}`);
  const g = { ...ADULT_UP[kind === 'veneer' || kind === 'fracture' ? 1 : kind === 'crown' || kind === 'implant' || kind === 'bridge' ? 6 : 4] };
  const f: Finding = { id: 'x', tooth: 16, surfaces: ['caries', 'filling'].includes(kind) ? 'O' : null, kind, status, note: null, planItemId: null, createdAt: '', removedAt: null };
  const st = stateOf([f]);
  const tall = g.C + g.R * 1.1;
  return (
    <svg viewBox={`${-8} ${-4} ${g.w + 16} ${f2(tall + 8)}`} className="kind-glyph" aria-hidden="true">
      <Paints ids={ids} />
      <g transform="scale(1,-1)"><ToothSide g={g} st={kind === 'missing' ? { ...st, missing: true, bridge: undefined } : kind === 'extraction' ? { ...st, xOut: colorOf(f) } : st} ids={ids} /></g>
    </svg>
  );
}

export const toothNameParts = (t: number) => ({ upper: isUpper(t), right: [1, 4, 5, 8].includes(Math.floor(t / 10)), primary: Math.floor(t / 10) >= 5, pos: t % 10 });
export type { ReactNode };

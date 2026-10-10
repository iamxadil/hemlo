// Every Hemlo system gets a website of its own character, not one template recoloured. A design is a layer over the
// shared frame (theme.ts): its own stylesheet and the moments only that trade needs (an agency's home search, a clinic's
// booking, a shop's shelves). The section model, the data adapters and the business's few theme choices stay shared,
// so a design can never produce a broken page; it only decides how the same content is staged.
import type { WebTheme } from '@hemlo/db/schema';

export type DesignId = 'studio' | 'estate';
export type Design = { id: DesignId; css: (theme: WebTheme) => string };

/** The baseline every system starts from: warm paper, one serif, hairlines (theme.ts). */
const studio: Design = { id: 'studio', css: () => '' };

/** Real estate: the home is the shop window. The visitor searches before they read, sees one house large, then the
 *  rest; numbers that prove the office is real; and WhatsApp is always one thumb away. */
const estate: Design = {
  id: 'estate',
  css: () => `
.d-estate .wtop .wcall{margin-inline-start:6px}@media (max-width:900px){.d-estate .wtop .wcall{display:none}}
body.on-photo.d-estate header.wtop:not(.is-stuck) .wcall{background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.35);color:#fff;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
/* the hero: the house, the office's name, and the search, all above the fold */
.d-estate .hero.photo{min-height:min(96svh,900px);padding-bottom:40px}
.d-estate .hero h1{font-size:clamp(44px,7.4vw,104px)}
.esearch{display:grid;gap:8px;margin-top:36px;padding:8px;max-width:880px;border-radius:calc(var(--r) + 8px);background:rgba(246,244,239,.94);color:#1B1A17;box-shadow:0 30px 70px -30px rgba(0,0,0,.6);backdrop-filter:blur(16px) saturate(1.4);-webkit-backdrop-filter:blur(16px) saturate(1.4)}
html[data-dark] .esearch{background:rgba(31,29,26,.94);color:#F1EDE5}
.hero:not(.photo) .esearch{background:var(--card);color:var(--ink);border:1px solid var(--line);box-shadow:0 24px 50px -40px rgba(0,0,0,.35)}
@media (min-width:860px){.esearch{grid-template-columns:auto minmax(0,1fr) minmax(0,1.2fr) auto;align-items:center}}
.eseg{display:flex;gap:2px;padding:4px;border-radius:calc(var(--r) + 2px);background:rgba(27,26,23,.06);border:0;margin:0;min-width:0}
html[data-dark] .eseg{background:rgba(241,237,229,.08)}
.eseg label{position:relative;flex:1}.eseg input{position:absolute;opacity:0;pointer-events:none}
.eseg span{display:grid;place-items:center;height:42px;padding:0 16px;border-radius:var(--r);font-size:14.5px;font-weight:500;white-space:nowrap;cursor:pointer;color:inherit;opacity:.7;transition:background-color .25s var(--ease),opacity .2s,box-shadow .25s}
.eseg input:checked+span{background:#fff;opacity:1;box-shadow:0 1px 2px rgba(0,0,0,.08),0 6px 16px -8px rgba(0,0,0,.25)}
html[data-dark] .eseg input:checked+span{background:#2E2B26}
.eseg input:focus-visible+span{outline:2px solid var(--ring);outline-offset:2px}
.efield{display:grid;gap:2px;min-width:0;padding:6px 14px;border-radius:var(--r);transition:background-color .2s}
.efield:hover,.efield:focus-within{background:rgba(27,26,23,.05)}html[data-dark] .efield:hover,html[data-dark] .efield:focus-within{background:rgba(241,237,229,.06)}
.efield small{font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;color:#8A857B}html[lang=ar] .efield small{letter-spacing:0;font-size:12.5px}
.efield select,.efield input{width:100%;height:28px;padding:0;border:0;background:transparent;color:inherit;font:inherit;font-size:16px;font-weight:500;outline:none;appearance:none;-webkit-appearance:none}
.efield input::placeholder{color:#8A857B;font-weight:400}
@media (min-width:860px){.efield+.efield{border-inline-start:1px solid rgba(27,26,23,.1);border-radius:0 var(--r) var(--r) 0}html[dir=rtl] .efield+.efield{border-radius:var(--r) 0 0 var(--r)}}
.esearch .go{height:52px;padding:0 26px;border-radius:calc(var(--r) + 2px);background:var(--accent);border-color:var(--accent);color:#fff;font-size:15.5px}
.esearch .go:hover{background:color-mix(in oklab,var(--accent) 88%,#000)}
@media (max-width:859px){.esearch .row2{display:grid;grid-template-columns:1fr 1fr;gap:4px}.esearch .go{width:100%}}
@media (min-width:860px){.esearch .row2{display:contents}}
/* the same search, on the properties page: on paper, with the rarer filters folded away */
.esearch.on-page{margin:0 0 40px;max-width:none;background:var(--card);color:var(--ink);border:1px solid var(--line);box-shadow:0 24px 50px -40px rgba(0,0,0,.35);backdrop-filter:none;-webkit-backdrop-filter:none}
@media (min-width:860px){.esearch.on-page{grid-template-columns:auto minmax(0,1fr) minmax(0,1.2fr) auto}}
.emore{grid-column:1/-1;padding:0 6px}.emore summary{display:inline-flex;align-items:center;gap:6px;padding:8px;font-size:14px;color:var(--ink2);cursor:pointer;list-style:none}.emore summary::-webkit-details-marker{display:none}
.emore summary::after{content:"+";font-size:16px;transition:transform .3s var(--ease)}.emore[open] summary::after{transform:rotate(45deg)}
.emore-b{display:grid;gap:4px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));align-items:end;padding:4px 0 10px}.emore-b .link{justify-self:start;margin:0 14px 10px}
.emore-b .efield{border:0!important;border-radius:var(--r)!important}
/* ways in: one tap to the kind of home the visitor came for */
.epaths{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:-12px 0 36px;padding-bottom:2px}.epaths::-webkit-scrollbar{display:none}
.epaths a{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px;border:1px solid var(--line);border-radius:999px;font-size:14.5px;white-space:nowrap;background:var(--card);transition:border-color .2s,background-color .2s,transform .2s var(--ease)}
.epaths a:hover{border-color:var(--ink)}.epaths a:active{transform:scale(.97)}
.epaths .n{font-size:12.5px;color:var(--muted);font-variant-numeric:tabular-nums}
/* one house large, then the rest */
@media (min-width:900px){.d-estate .lgrid{grid-template-columns:repeat(3,minmax(0,1fr))}
.lc.feat{grid-column:span 2;grid-row:span 2}.lc.feat figure{aspect-ratio:auto;flex:1;min-height:520px}
.lc.feat h3{font-size:clamp(28px,2.6vw,36px)}.lc.feat .pr{font-size:21px}}
.lc figure::after{content:"";position:absolute;inset:auto 0 0;height:38%;background:linear-gradient(transparent,rgba(14,13,11,.28));opacity:0;transition:opacity .6s var(--ease)}.lc:hover figure::after{opacity:1}
/* proof: the office in numbers, read from its own book */
.estats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;margin-top:56px;border:1px solid var(--line);border-radius:calc(var(--r) + 4px);overflow:hidden;background:var(--line)}
@media (min-width:760px){.estats{grid-template-columns:repeat(4,minmax(0,1fr))}}
.estats div{padding:24px 22px;background:var(--bg)}.estats b{display:block;font-family:var(--display);font-weight:400;font-size:clamp(34px,4vw,48px);line-height:1}.estats span{display:block;margin-top:10px;font-size:14px;color:var(--ink2)}
.eabout{display:grid;gap:40px 72px;align-items:center}@media (min-width:900px){.eabout{grid-template-columns:5fr 6fr}}
.eabout figure{margin:0;aspect-ratio:4/5;border-radius:calc(var(--r) + 4px);overflow:hidden;background:var(--surface)}.eabout figure img{width:100%;height:100%;object-fit:cover}
.eabout .body{margin-top:22px;font-family:var(--display);font-size:clamp(20px,2.2vw,26px);line-height:1.55}.eabout .body p{margin:0 0 16px}html[lang=ar] .eabout .body{line-height:1.85}
/* the always-there bar on a phone: WhatsApp and a message */
.d-estate.has-bar footer.wfoot{padding-bottom:110px}
@media (max-width:999px){.d-estate.has-bar .hero.photo{padding-bottom:92px}}
@media (min-width:1000px){.d-estate.has-bar footer.wfoot{padding-bottom:40px}}`,
};

const DESIGNS: Record<string, Design> = { realestate: estate };
export const designFor = (vertical: string): Design => DESIGNS[vertical] ?? studio;

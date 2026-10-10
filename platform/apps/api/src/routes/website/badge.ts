// Hemlo Website's own mark: the founder's H in brass on an ink tile, the same everywhere the add-on signs its work
// (the footer of every customer site, the sample, the marketing page). One small inline SVG, no request.
import { attr } from './theme';
import type { Lang } from './theme';

export const MARK_PATH = 'M16.298 3.894L15.781 3.547C14.576 2.739 12.958 3.602 12.958 5.053L12.958 11.671L11.742 11.2C11.32 11.037 11.042 10.631 11.042 10.178L11.042 7.162C11.042 5.289 10.109 3.539 8.553 2.496L6.602 1.187C5.874 0.699 4.896 1.221 4.896 2.097L4.896 15.368C4.896 17.605 6.037 19.687 7.923 20.89L9.357 21.805C10.087 22.271 11.042 21.747 11.042 20.882L11.042 14.878C11.042 14.108 11.815 13.578 12.533 13.856L12.958 14.021L12.958 16.586C12.958 19.068 14.224 21.378 16.317 22.713C17.523 23.483 19.104 22.616 19.104 21.184L19.104 9.155C19.104 7.043 18.052 5.07 16.298 3.894Z';
export const MARK_VIEWBOX = '4.896 1 14.209 22';

/** The emblem alone: an ink tile with a brass H and a soft top light. */
export const hwEmblem = (size = 22) => `<svg class="hw-emblem" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="hwb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F1DCA7"/><stop offset="1" stop-color="#B38B3A"/></linearGradient><linearGradient id="hwi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26303F"/><stop offset="1" stop-color="#0E1420"/></linearGradient></defs><rect width="24" height="24" rx="6.5" fill="url(#hwi)"/><rect x=".5" y=".5" width="23" height="23" rx="6" fill="none" stroke="rgba(241,220,167,.35)"/><svg x="6" y="4.5" width="12" height="15" viewBox="${MARK_VIEWBOX}"><path d="${MARK_PATH}" fill="url(#hwb)"/></svg></svg>`;

/** "Made with Hemlo Website": the signature at the foot of a customer's site, linking to the add-on. */
export function hwBadge(lang: Lang, href: string) {
  const ar = lang === 'ar';
  return `<a class="hw-badge" href="${attr(href)}" rel="noopener" target="_blank">${hwEmblem(20)}<span><small>${ar ? 'صُنع بواسطة' : 'Made with'}</small><b>Hemlo Website</b></span></a>`;
}

export const HW_BADGE_CSS = `.hw-badge{display:inline-flex;align-items:center;gap:9px;padding:5px 14px 5px 6px;border-radius:999px;background:linear-gradient(180deg,#1A2230,#0E1420);color:#F4EEDF;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 0 1px rgba(179,139,58,.35),0 8px 20px -10px rgba(14,20,32,.6);transition:transform .25s cubic-bezier(.23,1,.32,1),box-shadow .25s}
.hw-badge:hover{transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 0 0 1px rgba(227,200,138,.6),0 12px 26px -12px rgba(14,20,32,.7)}
.hw-badge span{display:grid;line-height:1.15}.hw-badge small{font-size:10px;letter-spacing:.06em;opacity:.65;font-weight:500}html[lang=ar] .hw-badge small{letter-spacing:0;font-size:11px}
.hw-badge b{font-size:12.5px;font-weight:600;letter-spacing:.01em;background:linear-gradient(180deg,#F6E7C1,#D2AE66);-webkit-background-clip:text;background-clip:text;color:transparent}
.hw-emblem{flex:none;display:block}`;

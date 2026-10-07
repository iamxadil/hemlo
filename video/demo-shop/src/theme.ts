// Hemlo's look, for video: the Systems terracotta, the warm canvas, the brand fonts, and the motion curves.
import { continueRender, delayRender, Easing, staticFile } from 'remotion';

export const C = {
  canvas: '#F4F1EA', canvas2: '#EDE7DC', surface: '#FFFFFF', fg: '#0E1420', fg2: '#3A4252', muted: '#6B7280',
  accent: '#A8532E', accentDeep: '#8A4122', accentSoft: '#F3E3DA', line: '#E3E1DA', scan: '#E5484D',
};
export const FONT = { en: '"Readex Pro", "Vazirmatn", system-ui, sans-serif', ar: '"Vazirmatn", "Readex Pro", system-ui, sans-serif' };

/** The founder's H mark (never redrawn: the exact path from the brand kit). */
export const MARK_PATH = 'M16.298 3.894L15.781 3.547C14.576 2.739 12.958 3.602 12.958 5.053L12.958 11.671L11.742 11.2C11.32 11.037 11.042 10.631 11.042 10.178L11.042 7.162C11.042 5.289 10.109 3.539 8.553 2.496L6.602 1.187C5.874 0.699 4.896 1.221 4.896 2.097L4.896 15.368C4.896 17.605 6.037 19.687 7.923 20.89L9.357 21.805C10.087 22.271 11.042 21.747 11.042 20.882L11.042 14.878C11.042 14.108 11.815 13.578 12.533 13.856L12.958 14.021L12.958 16.586C12.958 19.068 14.224 21.378 16.317 22.713C17.523 23.483 19.104 22.616 19.104 21.184L19.104 9.155C19.104 7.043 18.052 5.07 16.298 3.894Z';
export const MARK_VIEWBOX = '4.896 1 14.209 22';

// Motion: slow in, slow out; a softer one for the camera.
export const ease = Easing.bezier(0.65, 0, 0.35, 1);
export const camEase = Easing.bezier(0.55, 0, 0.2, 1);
export const outExpo = Easing.bezier(0.16, 1, 0.3, 1);

// The music's grid: 100 BPM → a beat is 36 frames and a bar 144 at 60 fps. Cuts land on it.
export const BEAT = 36, BAR = 144;

// Brand fonts, loaded before the first frame is drawn.
const fontsLoaded = delayRender('brand fonts');
Promise.all([
  new FontFace('Readex Pro', `url(${staticFile('fonts/readex-pro-latin.woff2')}) format("woff2")`, { weight: '300 600' }).load(),
  new FontFace('Vazirmatn', `url(${staticFile('fonts/vazirmatn-arabic.woff2')}) format("woff2")`, { weight: '300 700' }).load(),
]).then((faces) => { faces.forEach((f) => (document.fonts as any).add(f)); continueRender(fontsLoaded); })
  .catch((e) => { console.error(e); continueRender(fontsLoaded); });

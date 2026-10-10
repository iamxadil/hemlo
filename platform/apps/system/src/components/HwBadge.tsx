// Hemlo Website's own mark (the same one that signs every customer site): the founder's H in brass on an ink tile.
const MARK_PATH = 'M16.298 3.894L15.781 3.547C14.576 2.739 12.958 3.602 12.958 5.053L12.958 11.671L11.742 11.2C11.32 11.037 11.042 10.631 11.042 10.178L11.042 7.162C11.042 5.289 10.109 3.539 8.553 2.496L6.602 1.187C5.874 0.699 4.896 1.221 4.896 2.097L4.896 15.368C4.896 17.605 6.037 19.687 7.923 20.89L9.357 21.805C10.087 22.271 11.042 21.747 11.042 20.882L11.042 14.878C11.042 14.108 11.815 13.578 12.533 13.856L12.958 14.021L12.958 16.586C12.958 19.068 14.224 21.378 16.317 22.713C17.523 23.483 19.104 22.616 19.104 21.184L19.104 9.155C19.104 7.043 18.052 5.07 16.298 3.894Z';
const MARK_VIEWBOX = '4.896 1 14.209 22';
export const SAMPLE_SITE = (lang: string) => `https://business.hemlohq.com/s/sample${lang === 'en' ? '?lang=en' : ''}`;

export function HwEmblem({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: 'none', display: 'block' }}>
      <defs>
        <linearGradient id="hw-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F1DCA7" /><stop offset="1" stopColor="#B38B3A" /></linearGradient>
        <linearGradient id="hw-i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#26303F" /><stop offset="1" stopColor="#0E1420" /></linearGradient>
      </defs>
      <rect width="24" height="24" rx="6.5" fill="url(#hw-i)" />
      <rect x=".5" y=".5" width="23" height="23" rx="6" fill="none" stroke="rgba(241,220,167,.35)" />
      <svg x="6" y="4.5" width="12" height="15" viewBox={MARK_VIEWBOX}><path d={MARK_PATH} fill="url(#hw-b)" /></svg>
    </svg>
  );
}

/** The add-on's name as a badge: ink, a brass hairline, the name in brass. */
export function HwBadge({ label }: { label?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px 4px 5px', borderRadius: 999, background: 'linear-gradient(180deg,#1A2230,#0E1420)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08), 0 0 0 1px rgba(179,139,58,.4), 0 8px 20px -12px rgba(14,20,32,.6)', width: 'fit-content' }}>
      <HwEmblem size={20} />
      <b style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '.01em', background: 'linear-gradient(180deg,#F6E7C1,#D2AE66)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{label ?? 'Hemlo Website'}</b>
    </span>
  );
}

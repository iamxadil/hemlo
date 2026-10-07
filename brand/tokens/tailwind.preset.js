// Hemlo Tailwind preset (v3 config). Tailwind v4: map the CSS variables in tokens.css with @theme instead.
module.exports = {
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0E1420', 700: '#2B3445' }, slate: { 400: '#8A919C', 500: '#5E6776' },
        stone: { 50: '#F7F7F4', 100: '#EFEFEA', 200: '#E2E2DB', 300: '#CBCBC2' },
        night: { 600: '#283243', 700: '#1A2230', 800: '#131A26', 900: '#0C111A' },
        brass: { 300: '#D7B46A', 500: '#B38B3A', 700: '#8A6A22' },
        success: '#1F7A4D', warning: '#B8520A', danger: '#B42331', info: '#2F5DA8',
        bg: 'var(--color-bg)', surface: 'var(--color-surface)', border: 'var(--color-border)',
        text: 'var(--color-text)', muted: 'var(--color-text-muted)', primary: 'var(--color-primary)', accent: 'var(--color-accent)',
      },
      fontFamily: {
        display: ['Readex Pro', 'system-ui', 'sans-serif'], sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'], 'ar-display': ['Vazirmatn', 'Tahoma', 'sans-serif'], ar: ['Vazirmatn', 'Tahoma', 'sans-serif'],
      },
      borderRadius: { sm: '6px', md: '10px', lg: '14px', xl: '20px' },
      transitionTimingFunction: { standard: 'cubic-bezier(.2,0,0,1)', exit: 'cubic-bezier(.4,0,1,1)' },
      transitionDuration: { micro: '120ms', standard: '180ms', enter: '240ms', exit: '160ms' },
    },
  },
};

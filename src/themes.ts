/* Motywy: 4 gotowe (zdefiniowane w style.css) + motyw własny,
   który jest generowany tutaj z kilku kolorów wybranych przez użytkownika. */

import { settings, type ThemeName } from './state';

/* ---------- narzędzia do kolorów ---------- */
type RGB = { r: number; g: number; b: number };

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Miesza dwa kolory: amount=0 => a, amount=1 => b. */
export function mix(a: string, b: string, amount: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex({ r: x.r + (y.r - x.r) * amount, g: x.g + (y.g - x.g) * amount, b: x.b + (y.b - x.b) * amount });
}

export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ---------- palety składni dla motywu własnego ---------- */
const SYNTAX: Record<'dark' | 'light' | 'gray' | 'black', Record<string, string>> = {
  dark: {
    '--syn-key': '#c792ea',
    '--syn-type': '#ffcb6b',
    '--syn-str': '#a5e075',
    '--syn-num': '#f78c6c',
    '--syn-com': '#5f6b7e',
    '--syn-fn': '#82aaff',
    '--syn-pre': '#4dd0c8',
    '--syn-op': '#a4b1c4',
  },
  black: {
    '--syn-key': '#ff7edb',
    '--syn-type': '#fede5d',
    '--syn-str': '#72f1b8',
    '--syn-num': '#ff9e64',
    '--syn-com': '#596273',
    '--syn-fn': '#36f9f6',
    '--syn-pre': '#b4a0ff',
    '--syn-op': '#9aa3b2',
  },
  gray: {
    '--syn-key': '#d7a8ff',
    '--syn-type': '#ffd79a',
    '--syn-str': '#b6e39a',
    '--syn-num': '#ffae87',
    '--syn-com': '#99a1ae',
    '--syn-fn': '#9fc1ff',
    '--syn-pre': '#74ded6',
    '--syn-op': '#c7cdd8',
  },
  light: {
    '--syn-key': '#8b29b8',
    '--syn-type': '#0a7f78',
    '--syn-str': '#1a7f37',
    '--syn-num': '#b15c00',
    '--syn-com': '#8a94a6',
    '--syn-fn': '#1d55e0',
    '--syn-pre': '#a3581b',
    '--syn-op': '#4a5568',
  },
};

/** Miniaturki do kafelków wyboru motywu. */
export const THEME_PREVIEW: Record<Exclude<ThemeName, 'custom'>, { bg: string; panel: string; text: string; accent: string }> = {
  light: { bg: '#eef1f7', panel: '#ffffff', text: '#16202f', accent: '#2f6bff' },
  gray: { bg: '#30343b', panel: '#3a3f48', text: '#eef0f4', accent: '#7aa2f7' },
  dark: { bg: '#0f131a', panel: '#161b24', text: '#e7ecf4', accent: '#5b8cff' },
  black: { bg: '#000000', panel: '#0a0a0b', text: '#ededf0', accent: '#22d3ee' },
};

/* ---------- motyw własny ---------- */
function buildCustomCss(): string {
  const c = settings.custom;
  const text = c.text;
  const bg = c.bg;
  const panel = c.panel;
  const ed = c.editor;
  const accent = c.accent;
  const dark = luminance(bg) < 0.4;

  const vars: Record<string, string> = {
    '--bg': bg,
    '--bg-2': mix(bg, dark ? '#000000' : '#ffffff', 0.25),
    '--panel': panel,
    '--panel-2': mix(panel, text, 0.06),
    '--panel-3': mix(panel, text, 0.13),
    '--border': mix(panel, text, 0.2),
    '--border-soft': mix(panel, text, 0.11),
    '--text': text,
    '--text-dim': mix(text, bg, 0.32),
    '--text-faint': mix(text, bg, 0.52),
    '--accent': accent,
    '--accent-2': mix(accent, dark ? '#ffffff' : '#000000', 0.18),
    '--accent-contrast': luminance(accent) > 0.45 ? '#10131a' : '#ffffff',
    '--accent-soft': rgba(accent, 0.15),
    '--shadow': `0 18px 46px ${rgba(dark ? '#000000' : '#1b2a4a', dark ? 0.55 : 0.18)}`,
    '--ed-bg': ed,
    '--ed-text': mix(text, ed, 0.06),
    '--ed-gutter-bg': ed,
    '--ed-gutter-text': mix(text, ed, 0.6),
    '--ed-active-line': rgba(dark ? '#ffffff' : '#000000', 0.045),
    '--ed-selection': rgba(accent, 0.28),
    '--ed-cursor': accent,
    '--ed-bracket': rgba(accent, 0.35),
    '--run': dark ? '#22c55e' : '#16a34a',
    '--run-hover': dark ? '#1eb155' : '#128a3f',
    '--danger': dark ? '#ff6b6b' : '#d92d20',
    '--warn': dark ? '#f0b429' : '#b7791f',
    '--ok': dark ? '#34d399' : '#0f9d58',
    ...SYNTAX[c.base],
    '--syn-var': mix(text, ed, 0.06),
  };

  const body = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return `:root[data-theme='custom'] {\n${body}\n}`;
}

let styleEl: HTMLStyleElement | null = null;

/** Nakłada aktualny motyw na dokument. */
export function applyTheme(): void {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.dataset.anim = settings.animations ? 'on' : 'off';

  if (settings.theme === 'custom') {
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'kompi-custom-theme';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = buildCustomCss();
  } else if (styleEl) {
    styleEl.textContent = '';
  }

  root.style.setProperty('--ed-font-size', `${settings.fontSize}px`);
  root.style.setProperty('--out-font-size', `${settings.outFontSize}px`);
  root.style.setProperty('--mono-font', monoStack(settings.monoFont));

  // kolor paska przeglądarki na telefonie
  const color = getComputedStyle(root).getPropertyValue('--panel').trim() || '#161b24';
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = color;
}

export const MONO_FONTS: Array<{ id: string; label: string }> = [
  { id: 'default', label: '' },
  { id: 'consolas', label: 'Consolas / Menlo' },
  { id: 'courier', label: 'Courier New' },
  { id: 'system', label: 'System UI Mono' },
];

function monoStack(id: string): string {
  switch (id) {
    case 'consolas':
      return "Consolas, Menlo, 'DejaVu Sans Mono', monospace";
    case 'courier':
      return "'Courier New', Courier, monospace";
    case 'system':
      return "ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', monospace";
    default:
      return "ui-monospace, 'SFMono-Regular', 'JetBrains Mono', 'Fira Code', Menlo, Consolas, 'Liberation Mono', monospace";
  }
}

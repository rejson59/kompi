/* Motywy: 4 gotowe (zdefiniowane w style.css) + motyw własny,
   który jest generowany tutaj z kilku kolorów wybranych przez użytkownika
   wraz z wyliczeniem dwukierunkowych cieni neumorficznych. */

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
    '--syn-com': '#69778c',
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
    '--syn-key': '#7c3aed',
    '--syn-type': '#0d7490',
    '--syn-str': '#15803d',
    '--syn-num': '#b45309',
    '--syn-com': '#7c899e',
    '--syn-fn': '#2563eb',
    '--syn-pre': '#9a3412',
    '--syn-op': '#475569',
  },
};

/** Miniaturki do kafelków wyboru motywu. */
export const THEME_PREVIEW: Record<Exclude<ThemeName, 'custom'>, { bg: string; panel: string; text: string; accent: string }> = {
  light: { bg: '#e6ecf4', panel: '#edf2f9', text: '#1e293b', accent: '#3b6ef6' },
  gray: { bg: '#343944', panel: '#3b404d', text: '#eef0f4', accent: '#7aa2f7' },
  dark: { bg: '#222731', panel: '#272d38', text: '#e7ecf4', accent: '#638eff' },
  black: { bg: '#14171d', panel: '#191d24', text: '#ededf0', accent: '#22d3ee' },
};

/* ---------- motyw własny (neumorficzny) ---------- */
function buildCustomCss(): string {
  const c = settings.custom;
  const text = c.text;
  const bg = c.bg;
  const panel = c.panel;
  const ed = c.editor;
  const accent = c.accent;
  const dark = luminance(bg) < 0.4;

  const surfaceHi = mix(panel, '#ffffff', dark ? 0.05 : 0.35);
  const surfaceLo = mix(panel, '#000000', dark ? 0.08 : 0.04);
  const neuLight = mix(bg, '#ffffff', dark ? 0.075 : 0.85);
  const neuDark = mix(bg, '#000000', dark ? 0.38 : 0.16);
  const insetLight = mix(panel, '#ffffff', dark ? 0.065 : 0.85);
  const insetDark = mix(panel, '#000000', dark ? 0.4 : 0.16);
  const edInsetLight = mix(ed, '#ffffff', dark ? 0.06 : 0.82);
  const edInsetDark = mix(ed, '#000000', dark ? 0.44 : 0.17);
  const rimHi = dark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.82)';
  const rimLo = dark ? 'rgba(0, 0, 0, 0.42)' : 'rgba(160, 175, 198, 0.35)';
  const neuRim = `inset 1px 1px 1px ${rimHi}, inset -1px -1px 1px ${rimLo}`;

  const vars: Record<string, string> = {
    '--bg': bg,
    '--bg-2': mix(bg, dark ? '#000000' : '#ffffff', 0.12),
    '--panel': panel,
    '--panel-2': mix(panel, text, 0.04),
    '--panel-3': mix(panel, text, 0.09),
    '--surface-hi': surfaceHi,
    '--surface-lo': surfaceLo,
    '--surface-grad': `linear-gradient(145deg, ${surfaceHi}, ${surfaceLo})`,
    '--border': mix(panel, text, 0.13),
    '--border-soft': mix(panel, text, 0.07),
    '--text': text,
    '--text-dim': mix(text, bg, 0.3),
    '--text-faint': mix(text, bg, 0.5),
    '--accent': accent,
    '--accent-2': mix(accent, dark ? '#ffffff' : '#000000', 0.18),
    '--accent-contrast': luminance(accent) > 0.45 ? '#10131a' : '#ffffff',
    '--accent-soft': rgba(accent, 0.15),
    '--accent-glow': rgba(accent, 0.32),
    '--neu-light': neuLight,
    '--neu-dark': neuDark,
    '--neu-rim': neuRim,
    '--neu-raised-lg': `-8px -8px 18px ${neuLight}, 8px 8px 18px ${neuDark}, ${neuRim}`,
    '--neu-raised': `-5px -5px 12px ${neuLight}, 5px 5px 12px ${neuDark}, ${neuRim}`,
    '--neu-raised-sm': `-3px -3px 7px ${neuLight}, 3px 3px 7px ${neuDark}, ${neuRim}`,
    '--neu-raised-xs': `-2px -2px 5px ${neuLight}, 2px 2px 5px ${neuDark}, ${neuRim}`,
    '--neu-inset-deep': `inset 5px 5px 11px ${edInsetDark}, inset -5px -5px 11px ${edInsetLight}`,
    '--neu-inset': `inset 4px 4px 8px ${insetDark}, inset -4px -4px 8px ${insetLight}`,
    '--neu-inset-sm': `inset 2.5px 2.5px 5px ${insetDark}, inset -2.5px -2.5px 5px ${insetLight}`,
    '--shadow': `-10px -10px 24px ${neuLight}, 14px 18px 36px ${rgba('#000000', dark ? 0.55 : 0.18)}, ${neuRim}`,
    '--ed-bg': ed,
    '--ed-text': mix(text, ed, 0.05),
    '--ed-gutter-bg': ed,
    '--ed-gutter-text': mix(text, ed, 0.58),
    '--ed-active-line': rgba(dark ? '#ffffff' : '#000000', 0.04),
    '--ed-selection': rgba(accent, 0.25),
    '--ed-cursor': accent,
    '--ed-bracket': rgba(accent, 0.32),
    '--run': dark ? '#1ec96b' : '#16a34a',
    '--run-hover': dark ? '#25db77' : '#128a3f',
    '--danger': dark ? '#ff6b6b' : '#d92d20',
    '--warn': dark ? '#f0b429' : '#b7791f',
    '--ok': dark ? '#34d399' : '#0f9d58',
    ...SYNTAX[c.base],
    '--syn-var': mix(text, ed, 0.05),
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
  const color = getComputedStyle(root).getPropertyValue('--bg').trim() || '#222731';
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

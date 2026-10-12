/* Ustawienia aplikacji + zapis w przeglądarce (localStorage). */

export type Lang = 'pl' | 'en';
export type ThemeName = 'dark' | 'light' | 'gray' | 'black' | 'custom';
export type Layout = 'row' | 'column';
export type EngineId = 'auto' | 'piston' | 'wandbox' | 'godbolt' | 'offline';

export interface CustomTheme {
  base: 'dark' | 'light' | 'gray' | 'black';
  bg: string;
  panel: string;
  editor: string;
  text: string;
  accent: string;
}

export interface Settings {
  lang: Lang;
  /* wygląd */
  theme: ThemeName;
  custom: CustomTheme;
  layout: Layout;
  swapped: boolean;
  splitRatio: number;
  fontSize: number;
  outFontSize: number;
  monoFont: string;
  animations: boolean;
  /* edytor */
  autocomplete: boolean;
  tabAccepts: boolean;
  hovers: boolean;
  closeBrackets: boolean;
  lineNumbers: boolean;
  wrap: boolean;
  tabSize: number;
  autoSave: boolean;
  /* uruchamianie */
  clearBeforeRun: boolean;
  engine: EngineId;
  std: string;
  timeoutSec: number;
  /* udostępnianie */
  authorName: string;
  shareIncludeStdin: boolean;
  shareIncludeOutput: boolean;
}

const KEY = 'kompi.settings.v1';
export const CODE_KEY = 'kompi.code.v1';
export const STDIN_KEY = 'kompi.stdin.v1';

export const DEFAULTS: Settings = {
  lang: (navigator.language || 'pl').toLowerCase().startsWith('pl') ? 'pl' : 'en',
  theme: 'dark',
  custom: { base: 'dark', bg: '#101317', panel: '#181c23', editor: '#0e1116', text: '#e8ecf3', accent: '#7c5cff' },
  layout: 'row',
  swapped: false,
  splitRatio: 0.6,
  fontSize: 14,
  outFontSize: 13,
  monoFont: 'default',
  animations: true,
  autocomplete: true,
  tabAccepts: true,
  hovers: true,
  closeBrackets: true,
  lineNumbers: true,
  wrap: false,
  tabSize: 4,
  autoSave: true,
  clearBeforeRun: true,
  engine: 'auto',
  std: 'c++17',
  timeoutSec: 10,
  authorName: '',
  shareIncludeStdin: true,
  shareIncludeOutput: false,
};

type Listener = (s: Settings) => void;

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed, custom: { ...DEFAULTS.custom, ...(parsed.custom ?? {}) } };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings: Settings = read();

const listeners = new Set<Listener>();

/** Zmienia ustawienia, zapisuje je i powiadamia wszystkich słuchaczy. */
export function update(patch: Partial<Settings>): void {
  Object.assign(settings, patch);
  save();
  listeners.forEach((l) => l(settings));
}

export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* np. tryb prywatny — trudno, działamy dalej */
  }
}

export function onSettingsChange(l: Listener): void {
  listeners.add(l);
}

export function resetSettings(): void {
  const lang = settings.lang;
  Object.assign(settings, JSON.parse(JSON.stringify(DEFAULTS)), { lang });
  save();
  listeners.forEach((l) => l(settings));
}

/* ------- zapis kodu użytkownika ------- */
export function loadCode(): string | null {
  try {
    return localStorage.getItem(CODE_KEY);
  } catch {
    return null;
  }
}

export function storeCode(code: string, stdin: string): void {
  if (!settings.autoSave) return;
  try {
    localStorage.setItem(CODE_KEY, code);
    localStorage.setItem(STDIN_KEY, stdin);
  } catch {
    /* ignorujemy */
  }
}

export function loadStdin(): string {
  try {
    return localStorage.getItem(STDIN_KEY) ?? '';
  } catch {
    return '';
  }
}

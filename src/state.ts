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
  custom: { base: 'dark', bg: '#222731', panel: '#222731', editor: '#1c2029', text: '#e8ecf3', accent: '#7c5cff' },
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

/* ------- auto-zapis i lista ostatnio pisanych kodów w przeglądarce ------- */
const SAVED_CODES_KEY = 'kompi.savedCodes.v1';
const ACTIVE_CODE_ID_KEY = 'kompi.activeCodeId.v1';
const MAX_SAVED_CODES = 30;

export interface SavedCodeItem {
  id: string;
  title: string;
  code: string;
  updatedAt: number;
}

export function loadSavedCodes(): SavedCodeItem[] {
  try {
    const raw = localStorage.getItem(SAVED_CODES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSavedCodes(list: SavedCodeItem[]): void {
  try {
    localStorage.setItem(SAVED_CODES_KEY, JSON.stringify(list.slice(0, MAX_SAVED_CODES)));
  } catch {
    /* ignorujemy */
  }
}

export function getActiveCodeId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_CODE_ID_KEY);
  } catch {
    return null;
  }
}

export function setActiveCodeId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_CODE_ID_KEY, id);
  } catch {
    /* ignorujemy */
  }
}

export function normalizeCppTitle(raw: string, fallback = 'przyklad.cpp'): string {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  return trimmed;
}

/** Zwraca aktualnie edytowany kod z historii (lub tworzy pierwszy wpis np. przyklad.cpp). */
export function ensureActiveCodeItem(initialCode: string): SavedCodeItem {
  const list = loadSavedCodes();
  let migrated = false;
  for (const it of list) {
    if (it.title === 'powitanie.cpp' || it.title === 'welcome.cpp') {
      it.title = settings.lang === 'pl' ? 'przyklad.cpp' : 'example.cpp';
      migrated = true;
    }
  }
  if (migrated) writeSavedCodes(list);

  const activeId = getActiveCodeId();

  if (activeId) {
    const found = list.find((it) => it.id === activeId);
    if (found) return found;
  }

  if (list.length > 0) {
    setActiveCodeId(list[0].id);
    return list[0];
  }

  const first: SavedCodeItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: settings.lang === 'pl' ? 'przyklad.cpp' : 'example.cpp',
    code: initialCode,
    updatedAt: Date.now(),
  };
  writeSavedCodes([first]);
  setActiveCodeId(first.id);
  return first;
}

/** Automatycznie zapisuje bieżący kod i tytuł w przeglądarce. */
export function autoSaveActiveCode(code: string, title?: string): SavedCodeItem {
  const list = loadSavedCodes();
  const activeId = getActiveCodeId();
  const now = Date.now();

  const idx = activeId ? list.findIndex((it) => it.id === activeId) : -1;
  if (idx !== -1) {
    const existing = list[idx];
    const updated: SavedCodeItem = {
      ...existing,
      code,
      title: title !== undefined ? normalizeCppTitle(title, existing.title) : existing.title,
      updatedAt: now,
    };
    list.splice(idx, 1);
    list.unshift(updated);
    writeSavedCodes(list);
    return updated;
  }

  const created: SavedCodeItem = {
    id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
    title: normalizeCppTitle(title ?? '', settings.lang === 'pl' ? 'przyklad.cpp' : 'example.cpp'),
    code,
    updatedAt: now,
  };
  list.unshift(created);
  writeSavedCodes(list);
  setActiveCodeId(created.id);
  return created;
}

/** Zmienia tytuł wybranego kodu (np. na nowy1.cpp). */
export function renameSavedCode(id: string, newTitle: string): string {
  const list = loadSavedCodes();
  const item = list.find((it) => it.id === id);
  const finalTitle = normalizeCppTitle(newTitle, item?.title || 'przyklad.cpp');
  if (item) {
    item.title = finalTitle;
    item.updatedAt = Date.now();
    writeSavedCodes(list);
  }
  return finalTitle;
}

/** Tworzy nowy plik w historii (np. nowy1.cpp, nowy2.cpp), zachowując poprzedni na liście. */
export function createNewSavedCode(templateCode: string): SavedCodeItem {
  const list = loadSavedCodes();
  const prefix = settings.lang === 'pl' ? 'nowy' : 'new';
  const existingTitles = new Set(list.map((it) => it.title.toLowerCase()));
  let num = 1;
  while (existingTitles.has(`${prefix}${num}.cpp`) || existingTitles.has(`${prefix}${num}`)) {
    num++;
  }
  const defaultTitle = `${prefix}${num}.cpp`;
  const item: SavedCodeItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: defaultTitle,
    code: templateCode,
    updatedAt: Date.now(),
  };
  list.unshift(item);
  writeSavedCodes(list);
  setActiveCodeId(item.id);
  return item;
}

export function deleteSavedCode(id: string): void {
  const list = loadSavedCodes().filter((item) => item.id !== id);
  writeSavedCodes(list);
}

export function clearAllSavedCodes(): void {
  writeSavedCodes([]);
}

/** Dodaje wczytany z dysku plik .cpp do listy ostatnich kodów i ustawia go jako aktywny. */
export function createSavedCodeWithName(title: string, code: string): SavedCodeItem {
  const list = loadSavedCodes();
  const cleanTitle = normalizeCppTitle(title, settings.lang === 'pl' ? 'przyklad.cpp' : 'example.cpp');
  const item: SavedCodeItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: cleanTitle,
    code,
    updatedAt: Date.now(),
  };
  list.unshift(item);
  writeSavedCodes(list);
  setActiveCodeId(item.id);
  return item;
}


/* Udostępnianie pracy jednym linkiem.
   1) Pełny link: cały kod jest spakowany w adresie (#c=...) — działa zawsze,
      bez żadnych kont i serwerów.
   2) Krótki link: treść ląduje w darmowym schowku w sieci, a w adresie
      zostaje tylko kilka znaków (#s=...). Adres nadal jest Twój (GitHub Pages). */

import LZString from 'lz-string';
import type { Lang } from './state';

export interface SharePayload {
  v: 1;
  c: string;
  i?: string;
  o?: string;
  b?: string;
  s?: string;
  l?: Lang;
}

export function encodePayload(p: SharePayload): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(p));
}

export function decodePayload(data: string): SharePayload | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(data);
    if (!json) return null;
    const obj = JSON.parse(json) as SharePayload;
    return typeof obj?.c === 'string' ? obj : null;
  } catch {
    return null;
  }
}

export function baseUrl(): string {
  return `${location.origin}${location.pathname}`;
}

export function buildLink(hash: string): string {
  return `${baseUrl()}#${hash}`;
}

/* ------------------------------------------------------------------ */
/*  Krótkie linki — kilka niezależnych darmowych usług, po kolei       */
/* ------------------------------------------------------------------ */

interface Provider {
  tag: string;
  put: (data: string, signal: AbortSignal) => Promise<string>;
  get: (id: string, signal: AbortSignal) => Promise<string>;
}

function randomKey(n: number): string {
  const abc = 'abcdefghijkmnopqrstuvwxyz23456789';
  let s = '';
  const buf = new Uint32Array(n);
  crypto.getRandomValues(buf);
  for (let i = 0; i < n; i++) s += abc[buf[i] % abc.length];
  return s;
}

const PROVIDERS: Provider[] = [
  {
    tag: 'p', // paste.rs — najkrótsze identyfikatory
    async put(data, signal) {
      const res = await fetch('https://paste.rs/', { method: 'POST', body: data, signal });
      if (!res.ok) throw new Error(`paste.rs ${res.status}`);
      const url = (await res.text()).trim();
      const id = url.split('/').pop() ?? '';
      if (!/^[A-Za-z0-9]{2,12}$/.test(id)) throw new Error('paste.rs: zła odpowiedź');
      return id;
    },
    async get(id, signal) {
      const res = await fetch(`https://paste.rs/${encodeURIComponent(id)}`, { signal });
      if (!res.ok) throw new Error(`paste.rs ${res.status}`);
      return (await res.text()).trim();
    },
  },
  {
    tag: 't', // textdb.dev — sami wybieramy klucz
    async put(data, signal) {
      const key = `k${randomKey(7)}`;
      const url = `https://textdb.dev/api/data/${key}`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: data }),
        signal,
      });
      const check = await fetch(url, { signal, cache: 'no-store' });
      const saved = (await check.text()).trim();
      if (saved === data) return key;
      // druga próba: formularz
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ value: data }).toString(),
        signal,
      });
      const check2 = await fetch(url, { signal, cache: 'no-store' });
      if ((await check2.text()).trim() === data) return key;
      throw new Error('textdb: nie zapisano');
    },
    async get(id, signal) {
      const res = await fetch(`https://textdb.dev/api/data/${encodeURIComponent(id)}`, { signal, cache: 'no-store' });
      if (!res.ok) throw new Error(`textdb ${res.status}`);
      return (await res.text()).trim();
    },
  },
  {
    tag: 'd', // dpaste.com
    async put(data, signal) {
      const form = new URLSearchParams({ content: data, syntax: 'text', expiry_days: '365' });
      const res = await fetch('https://dpaste.com/api/v2/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        signal,
      });
      if (!res.ok) throw new Error(`dpaste ${res.status}`);
      const id = (await res.text()).trim().split('/').pop() ?? '';
      if (!/^[A-Za-z0-9]{3,12}$/.test(id)) throw new Error('dpaste: zła odpowiedź');
      return id;
    },
    async get(id, signal) {
      const res = await fetch(`https://dpaste.com/${encodeURIComponent(id)}.txt`, { signal });
      if (!res.ok) throw new Error(`dpaste ${res.status}`);
      return (await res.text()).trim();
    },
  },
  {
    tag: 'j', // jsonblob.com
    async put(data, signal) {
      const res = await fetch('https://jsonblob.com/api/jsonBlob', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ d: data }),
        signal,
      });
      if (!res.ok) throw new Error(`jsonblob ${res.status}`);
      const loc = res.headers.get('Location') ?? res.headers.get('location');
      const id = loc?.split('/').pop() ?? '';
      if (!/^\d{5,30}$/.test(id)) throw new Error('jsonblob: brak identyfikatora');
      return id;
    },
    async get(id, signal) {
      const res = await fetch(`https://jsonblob.com/api/jsonBlob/${encodeURIComponent(id)}`, { signal });
      if (!res.ok) throw new Error(`jsonblob ${res.status}`);
      const obj = (await res.json()) as { d?: string };
      if (typeof obj?.d !== 'string') throw new Error('jsonblob: zła treść');
      return obj.d;
    },
  },
];

function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(id) };
}

/** Próbuje zrobić krótki link; zwraca null, gdy żadna usługa nie odpowiada. */
export async function createShortLink(payload: SharePayload): Promise<string | null> {
  const data = encodePayload(payload);
  for (const p of PROVIDERS) {
    const { signal, done } = withTimeout(9000);
    try {
      const id = await p.put(data, signal);
      return buildLink(`s=${p.tag}${id}`);
    } catch {
      /* następna usługa */
    } finally {
      done();
    }
  }
  return null;
}

/** Pobiera pracę ukrytą pod krótkim linkiem. */
export async function resolveShortLink(ref: string): Promise<SharePayload | null> {
  const tag = ref.slice(0, 1);
  const id = ref.slice(1);
  const provider = PROVIDERS.find((p) => p.tag === tag);
  if (!provider || !id) return null;
  const { signal, done } = withTimeout(12000);
  try {
    const data = await provider.get(id, signal);
    return decodePayload(data);
  } catch {
    return null;
  } finally {
    done();
  }
}

/** Czyta pracę z adresu strony (#c=... albo #s=...). */
export async function readFromHash(): Promise<{ payload: SharePayload; short: boolean } | null> {
  const hash = location.hash.replace(/^#/, '');
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const c = params.get('c');
  if (c) {
    const payload = decodePayload(c);
    return payload ? { payload, short: false } : null;
  }
  const s = params.get('s');
  if (s) {
    const payload = await resolveShortLink(s);
    return payload ? { payload, short: true } : null;
  }
  return null;
}

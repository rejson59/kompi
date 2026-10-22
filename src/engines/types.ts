import type { EngineId, ProgLang } from '../state';

export interface RunRequest {
  code: string;
  stdin: string;
  /** język programowania: C++ albo PHP */
  language: ProgLang;
  std: string;
  timeoutMs: number;
  signal: AbortSignal;
}

export interface RunResult {
  engine: EngineId;
  engineLabel: string;
  compileOutput: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signalName?: string | null;
  compileFailed: boolean;
  timedOut?: boolean;
  timeMs: number;
  note?: string;
}

/** Błąd „silnik niedostępny” — pozwala przejść do kolejnego kompilatora. */
export class EngineUnavailable extends Error {
  constructor(public engine: EngineId, message: string) {
    super(message);
    this.name = 'EngineUnavailable';
  }
}

export async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  outer: AbortSignal,
): Promise<{ status: number; data: unknown; text: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs);
  const onAbort = () => ctrl.abort(new DOMException('stopped', 'AbortError'));
  outer.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch {
      /* nie-JSON — zwracamy sam tekst */
    }
    return { status: res.status, data, text };
  } finally {
    clearTimeout(timer);
    outer.removeEventListener('abort', onAbort);
  }
}

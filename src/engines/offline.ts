/* Błyskawiczny lokalny silnik C++ w przeglądarce (utrzymuje gotowy Worker w pamięci). */

import { t } from '../i18n';
import type { RunRequest, RunResult } from './types';

const UNSUPPORTED: Array<{ re: RegExp; what: string }> = [
  { re: /#\s*include\s*<\s*(map|set|queue|stack|list|fstream|sstream)\s*>/, what: 'STL' },
  { re: /(^|[^\w])class\s+[A-Za-z_]/m, what: 'class' },
];

export function unsupportedFeatures(code: string): string[] {
  const found = new Set<string>();
  for (const u of UNSUPPORTED) if (u.re.test(code)) found.add(u.what);
  return [...found];
}

let warmWorker: Worker | null = null;

function getWorker(): Worker {
  if (!warmWorker) {
    warmWorker = new Worker(new URL('./offlineWorker.ts', import.meta.url), { type: 'module' });
  }
  return warmWorker;
}

function resetWorker(): void {
  if (warmWorker) {
    warmWorker.terminate();
    warmWorker = null;
  }
  setTimeout(() => {
    try {
      getWorker();
    } catch {
      /* ignorujemy */
    }
  }, 10);
}

/** Rozgrzewa lokalny kompilator w tle od razu po załadowaniu strony. */
export function prewarmOffline(): void {
  try {
    getWorker();
  } catch {
    /* ignorujemy */
  }
}

export async function run(req: RunRequest): Promise<RunResult> {
  const started = performance.now();
  const worker = getWorker();

  return new Promise<RunResult>((resolve, reject) => {
    const cleanup = () => {
      worker.onmessage = null;
      worker.onerror = null;
      req.signal.removeEventListener('abort', onAbort);
      clearTimeout(timer);
    };
    const onAbort = () => {
      cleanup();
      resetWorker();
      reject(new DOMException('stopped', 'AbortError'));
    };
    req.signal.addEventListener('abort', onAbort, { once: true });

    const timer = setTimeout(() => {
      cleanup();
      resetWorker();
      resolve({
        engine: 'offline',
        engineLabel: t('offline.title'),
        compileOutput: '',
        stdout: '',
        stderr: '',
        exitCode: null,
        compileFailed: false,
        timedOut: true,
        timeMs: Math.round(performance.now() - started),
      });
    }, req.timeoutMs + 1500);

    worker.onmessage = (ev: MessageEvent<{ ok: boolean; out: string; exitCode?: number; error?: string }>) => {
      const data = ev.data;
      cleanup();
      const timedOut = !data.ok && /time limit/i.test(data.error ?? '');
      if (timedOut) resetWorker();
      resolve({
        engine: 'offline',
        engineLabel: t('offline.title'),
        compileOutput: data.ok || timedOut ? '' : data.error ?? '',
        stdout: data.out ?? '',
        stderr: '',
        exitCode: data.ok ? data.exitCode ?? 0 : null,
        compileFailed: !data.ok && !timedOut,
        timedOut,
        timeMs: Math.max(1, Math.round(performance.now() - started)),
      });
    };

    worker.onerror = (e) => {
      cleanup();
      resetWorker();
      resolve({
        engine: 'offline',
        engineLabel: t('offline.title'),
        compileOutput: e.message || 'syntax error',
        stdout: '',
        stderr: '',
        exitCode: null,
        compileFailed: true,
        timeMs: Math.max(1, Math.round(performance.now() - started)),
      });
    };

    worker.postMessage({ code: req.code, stdin: req.stdin, maxTimeout: req.timeoutMs });
  });
}

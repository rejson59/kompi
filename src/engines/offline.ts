/* Tryb offline — działa bez internetu, obsługuje podstawy C++. */

import { t } from '../i18n';
import type { RunRequest, RunResult } from './types';

const UNSUPPORTED: Array<{ re: RegExp; what: string }> = [
  { re: /#\s*include\s*<\s*string\s*>|(^|[^\w.])string\s+[A-Za-z_]/m, what: 'string' },
  { re: /#\s*include\s*<\s*vector\s*>|vector\s*</, what: 'vector' },
  { re: /#\s*include\s*<\s*algorithm\s*>/, what: 'algorithm' },
  { re: /#\s*include\s*<\s*bits\/stdc\+\+\.h\s*>/, what: 'bits/stdc++.h' },
  { re: /#\s*include\s*<\s*(map|set|queue|stack|list|utility|fstream|sstream)\s*>/, what: 'STL' },
  { re: /(^|[^\w])struct\s+[A-Za-z_]/m, what: 'struct' },
  { re: /(^|[^\w])class\s+[A-Za-z_]/m, what: 'class' },
];

export function unsupportedFeatures(code: string): string[] {
  const found = new Set<string>();
  for (const u of UNSUPPORTED) if (u.re.test(code)) found.add(u.what);
  return [...found];
}

export async function run(req: RunRequest): Promise<RunResult> {
  const started = performance.now();
  const missing = unsupportedFeatures(req.code);
  if (missing.length) {
    return {
      engine: 'offline',
      engineLabel: t('offline.title'),
      compileOutput: t('offline.unsupported', { what: missing.join(', ') }),
      stdout: '',
      stderr: '',
      exitCode: null,
      compileFailed: true,
      timeMs: Math.round(performance.now() - started),
      note: t('offline.note'),
    };
  }

  const worker = new Worker(new URL('./offlineWorker.ts', import.meta.url), { type: 'module' });

  return new Promise<RunResult>((resolve, reject) => {
    const cleanup = () => {
      worker.terminate();
      req.signal.removeEventListener('abort', onAbort);
      clearTimeout(timer);
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException('stopped', 'AbortError'));
    };
    req.signal.addEventListener('abort', onAbort, { once: true });

    const timer = setTimeout(() => {
      cleanup();
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
        note: t('offline.note'),
      });
    }, req.timeoutMs + 2000);

    worker.onmessage = (ev: MessageEvent<{ ok: boolean; out: string; exitCode?: number; error?: string }>) => {
      const data = ev.data;
      cleanup();
      const timedOut = !data.ok && /time limit/i.test(data.error ?? '');
      resolve({
        engine: 'offline',
        engineLabel: t('offline.title'),
        compileOutput: data.ok || timedOut ? '' : data.error ?? '',
        stdout: data.out ?? '',
        stderr: '',
        exitCode: data.ok ? data.exitCode ?? 0 : null,
        compileFailed: !data.ok && !timedOut,
        timedOut,
        timeMs: Math.round(performance.now() - started),
        note: t('offline.note'),
      });
    };

    worker.onerror = (e) => {
      cleanup();
      resolve({
        engine: 'offline',
        engineLabel: t('offline.title'),
        compileOutput: e.message || 'offline error',
        stdout: '',
        stderr: '',
        exitCode: null,
        compileFailed: true,
        timeMs: Math.round(performance.now() - started),
        note: t('offline.note'),
      });
    };

    worker.postMessage({ code: req.code, stdin: req.stdin, maxTimeout: req.timeoutMs });
  });
}

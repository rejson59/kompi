/* Lokalny silnik PHP w przeglądarce (php-wasm) — awaryjny, gdy serwery online
   nie odpowiadają. Worker startuje dopiero przy pierwszym użyciu (wasm jest duży). */

import { t } from '../i18n';
import { isPhpParseError, splitPhpDiagnostics } from './phpSupport';
import type { RunRequest, RunResult } from './types';

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./phpWorker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

function resetWorker(): void {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

export async function run(req: RunRequest): Promise<RunResult> {
  const started = performance.now();
  const w = getWorker();

  return new Promise<RunResult>((resolve, reject) => {
    const cleanup = () => {
      w.onmessage = null;
      w.onerror = null;
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
        engineLabel: 'PHP lokalnie · 8.4',
        compileOutput: '',
        stdout: '',
        stderr: '',
        exitCode: null,
        compileFailed: false,
        timedOut: true,
        timeMs: Math.round(performance.now() - started),
      });
    }, req.timeoutMs + 6000);

    w.onmessage = (ev: MessageEvent<{ ok: boolean; out: string; err: string; exit?: number }>) => {
      const data = ev.data;
      cleanup();
      const split = splitPhpDiagnostics(data.out ?? '', data.err ?? '');
      const parseError = isPhpParseError(split.stderr) || isPhpParseError(split.stdout);
      resolve({
        engine: 'offline',
        engineLabel: 'PHP lokalnie · 8.4',
        compileOutput: '',
        stdout: split.stdout,
        stderr: split.stderr,
        exitCode: parseError ? null : data.exit ?? null,
        signalName: null,
        compileFailed: parseError,
        timeMs: Math.round(performance.now() - started),
      });
    };
    w.onerror = () => {
      cleanup();
      resetWorker();
      resolve({
        engine: 'offline',
        engineLabel: 'PHP lokalnie · 8.4',
        compileOutput: '',
        stdout: '',
        stderr: t('run.phpOffline'),
        exitCode: null,
        compileFailed: true,
        timeMs: Math.round(performance.now() - started),
      });
    };

    w.postMessage({ code: req.code, stdin: req.stdin });
  });
}

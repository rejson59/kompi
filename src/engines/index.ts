/* Błyskawiczne i ciche wykonywanie kodu:
   - dla standardowych programów działa natychmiast lokalnie w przeglądarce (~5 ms),
   - dla kodów wymagających pełnego STL (vector, string, algorithm, struct)
     odpytuje równolegle najszybsze kompilatory online bez pokazywania komunikatów technicznych. */

import { settings, type EngineId } from '../state';
import * as piston from './piston';
import * as wandbox from './wandbox';
import * as godbolt from './godbolt';
import * as offline from './offline';
import type { RunRequest, RunResult } from './types';

export type { RunRequest, RunResult } from './types';
export { unsupportedFeatures, prewarmOffline } from './offline';

// Rozgrzej lokalny wątek od razu przy starcie aplikacji
offline.prewarmOffline();

const RUNNERS: Record<Exclude<EngineId, 'auto'>, (req: RunRequest) => Promise<RunResult>> = {
  piston: piston.run,
  wandbox: wandbox.run,
  godbolt: godbolt.run,
  offline: offline.run,
};

export const ENGINE_NAMES: Record<Exclude<EngineId, 'auto'>, string> = {
  piston: 'Piston',
  wandbox: 'Wandbox',
  godbolt: 'Compiler Explorer',
  offline: 'offline',
};

function raceFirstSuccess<T>(promises: Array<Promise<T>>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let failed = 0;
    let lastErr: unknown;
    for (const p of promises) {
      p.then(resolve, (err) => {
        failed++;
        lastErr = err;
        if (failed === promises.length) reject(lastErr);
      });
    }
  });
}

export async function runProgram(req: RunRequest): Promise<RunResult> {
  if (req.signal.aborted) throw new DOMException('stopped', 'AbortError');

  // Jeśli użytkownik wybrał konkretny silnik
  if (settings.engine !== 'auto') {
    try {
      return await RUNNERS[settings.engine](req);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      return await offline.run(req);
    }
  }

  // Tryb domyślny: jeśli kod nie wymaga zaawansowanego STL — wykonaj natychmiast lokalnie (~5 ms)
  const needsOnline = offline.unsupportedFeatures(req.code).length > 0;
  if (!needsOnline) {
    return await offline.run(req);
  }

  // Jeśli kod używa np. vector/string/algorithm — uruchom równolegle kompilatory online i weź najszybszą odpowiedź
  try {
    return await raceFirstSuccess([godbolt.run(req), wandbox.run(req), piston.run(req)]);
  } catch {
    if (req.signal.aborted) throw new DOMException('stopped', 'AbortError');
    return await offline.run(req);
  }
}

/** Szybkie sprawdzenie, czy dany kompilator odpowiada z tej sieci. */
export async function testEngine(id: Exclude<EngineId, 'auto'>): Promise<{ ok: boolean; ms: number; detail: string }> {
  const started = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await RUNNERS[id]({
      code: 'int main(){return 0;}',
      stdin: '',
      std: 'c++17',
      timeoutMs: 5000,
      signal: ctrl.signal,
    });
    return { ok: !res.compileFailed, ms: Math.round(performance.now() - started), detail: res.engineLabel };
  } catch (err) {
    return { ok: false, ms: Math.round(performance.now() - started), detail: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

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

/** Pierwszy silnik, który faktycznie uruchomił program (compileFailed === false).
    Jeśli wszystkie zgłoszą błąd kompilacji — zwraca pierwszy taki błąd;
    jeśli wszystkie zawiodą (brak sieci) — odrzuca. */
function raceBestResult(req: RunRequest, promises: Array<Promise<RunResult>>): Promise<RunResult> {
  return new Promise<RunResult>((resolve, reject) => {
    let pending = promises.length;
    let firstFail: RunResult | null = null;
    let lastErr: unknown;
    let settled = false;
    const finish = () => {
      if (settled || pending > 0) return;
      settled = true;
      if (req.signal.aborted) reject(new DOMException('stopped', 'AbortError'));
      else if (firstFail) resolve(firstFail);
      else reject(lastErr ?? new Error('brak odpowiedzi'));
    };
    for (const p of promises) {
      p.then(
        (res) => {
          pending--;
          if (settled) return;
          if (!res.compileFailed) {
            settled = true;
            resolve(res);
            return;
          }
          if (!firstFail) firstFail = res;
          finish();
        },
        (err) => {
          pending--;
          lastErr = err;
          finish();
        },
      );
    }
  });
}

/** raceBestResult z budżetem czasu — po upływie zwraca wynik zapasowy,
    żeby w szkole z zablokowaną siecią nie czekać w nieskończoność. */
function raceWithBudget(
  req: RunRequest,
  promises: Array<Promise<RunResult>>,
  fallback: RunResult,
  budgetMs: number,
): Promise<RunResult> {
  return new Promise<RunResult>((resolve, reject) => {
    let settled = false;
    const finish = (r: RunResult): void => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    const bail = (err: unknown): void => {
      if (settled) return;
      settled = true;
      if (err instanceof DOMException && err.name === 'AbortError') reject(err);
      else resolve(fallback);
    };
    raceBestResult(req, promises).then(finish, bail);
    setTimeout(() => bail(null), budgetMs);
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

  const onlineRunners = (): Array<Promise<RunResult>> => [godbolt.run(req), wandbox.run(req), piston.run(req)];

  // Tryb domyślny: jeśli kod nie wymaga zaawansowanego STL — wykonaj natychmiast lokalnie (~5 ms)
  const needsOnline = offline.unsupportedFeatures(req.code).length > 0;
  if (!needsOnline) {
    const local = await offline.run(req);
    if (!local.compileFailed) return local;
    // Lokalny silnik nie dał rady — spróbuj prawdziwym g++ online, żeby mimo
    // zgłoszonego błędu wygenerować wynik. Gdy sieć nie działa — zostaje błąd lokalny.
    return await raceWithBudget(req, onlineRunners(), local, 7000);
  }

  // Jeśli kod używa np. vector/string/algorithm — uruchom równolegle kompilatory online i weź najlepszą odpowiedź
  try {
    return await raceBestResult(req, onlineRunners());
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
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

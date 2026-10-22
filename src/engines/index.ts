/* Błyskawiczne i ciche wykonywanie kodu:
   - dla standardowych programów działa natychmiast lokalnie w przeglądarce (~5 ms),
   - dla kodów wymagających pełnego STL (vector, string, algorithm, struct)
     odpytuje równolegle najszybsze kompilatory online bez pokazywania komunikatów technicznych. */

import { settings, type EngineId } from '../state';
import { t } from '../i18n';
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

/** Serwery online zawsze pierwsze — lokalny silnik (JSCPP) bywa błędny,
    więc używamy go tylko awaryjnie: gdy sieć nie działa albo nie odpowiada
    w budżecie czasu (szkoły z zablokowanym internetem). */
function onlineFirst(req: RunRequest, promises: Array<Promise<RunResult>>, budgetMs: number): Promise<RunResult> {
  return new Promise<RunResult>((resolve, reject) => {
    let settled = false;
    const goOffline = () => {
      if (settled) return;
      settled = true;
      offline.run(req).then(
        (r) => resolve({ ...r, note: t('run.fallbackOffline') }),
        (err) => reject(err),
      );
    };
    raceBestResult(req, promises).then(
      (res) => {
        if (!settled) {
          settled = true;
          resolve(res);
        }
      },
      (err) => {
        if (settled) return;
        if (err instanceof DOMException && err.name === 'AbortError') {
          settled = true;
          reject(err);
          return;
        }
        goOffline();
      },
    );
    setTimeout(goOffline, budgetMs);
  });
}

/** Kod PHP bez znacznika <?php nie uruchomi się — dopisujemy go w tej samej linii,
    żeby numeracja linii w błędach się zgadzała. */
function ensurePhpOpenTag(code: string): string {
  return /<\?(php|=)/i.test(code) ? code : `<?php ${code}`;
}

export async function runProgram(req: RunRequest): Promise<RunResult> {
  if (req.signal.aborted) throw new DOMException('stopped', 'AbortError');

  // PHP: tylko przez internet (Piston) — lokalny silnik C++ go nie obsługuje
  if (req.language === 'php') {
    try {
      return await piston.run({ ...req, code: ensurePhpOpenTag(req.code) });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      return {
        engine: 'piston',
        engineLabel: 'Piston · PHP',
        compileOutput: '',
        stdout: '',
        stderr: '',
        exitCode: null,
        compileFailed: true,
        timeMs: 0,
        note: t('run.phpOffline'),
      };
    }
  }

  // Jeśli użytkownik wybrał konkretny silnik C++
  if (settings.engine !== 'auto') {
    try {
      return await RUNNERS[settings.engine](req);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      return await offline.run(req);
    }
  }

  // Auto: prawdziwy g++ online zawsze pierwszy; lokalny silnik tylko awaryjnie
  return await onlineFirst(req, [godbolt.run(req), wandbox.run(req), piston.run(req)], 12000);
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
      language: 'cpp',
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

/* Wybór kompilatora: próbujemy kolejno dostępnych silników,
   a gdy żaden online nie odpowiada — uruchamiamy kod w przeglądarce. */

import { settings, type EngineId } from '../state';
import { t } from '../i18n';
import * as piston from './piston';
import * as wandbox from './wandbox';
import * as godbolt from './godbolt';
import * as offline from './offline';
import type { RunRequest, RunResult } from './types';

export type { RunRequest, RunResult } from './types';
export { unsupportedFeatures } from './offline';

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

export interface RunHooks {
  onProgress: (message: string) => void;
  onEngineFailed: (engineName: string) => void;
}

/** Kolejność prób w trybie automatycznym (ostatnia udana idzie na początek). */
let autoOrder: Array<Exclude<EngineId, 'auto' | 'offline'>> = ['piston', 'godbolt', 'wandbox'];

export async function runProgram(req: RunRequest, hooks: RunHooks): Promise<RunResult> {
  const chain: Array<Exclude<EngineId, 'auto'>> =
    settings.engine === 'auto' ? [...autoOrder, 'offline'] : [settings.engine];

  let lastError: unknown = null;

  for (const id of chain) {
    if (req.signal.aborted) throw new DOMException('stopped', 'AbortError');

    if (id === 'offline' && settings.engine === 'auto') {
      hooks.onProgress(t('run.fallbackOffline'));
    } else {
      hooks.onProgress(t('run.connecting', { engine: ENGINE_NAMES[id] }));
    }

    try {
      const result = await RUNNERS[id](req);
      if (id !== 'offline') {
        autoOrder = [id as 'piston' | 'godbolt' | 'wandbox', ...autoOrder.filter((e) => e !== id)];
      }
      return result;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      lastError = err;
      hooks.onEngineFailed(ENGINE_NAMES[id]);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(t('run.noEngines'));
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

/* Wandbox — publiczne API kompilatora gcc. */

import { EngineUnavailable, fetchJson, type RunRequest, type RunResult } from './types';

const API = 'https://wandbox.org/api/compile.json';
const COMPILERS = ['gcc-13.2.0', 'gcc-12.1.0', 'gcc-head'];
let preferred = 0;

interface WandboxResponse {
  status?: string;
  signal?: string;
  compiler_output?: string;
  compiler_error?: string;
  program_output?: string;
  program_error?: string;
  program_message?: string;
  error?: string;
}

export async function run(req: RunRequest): Promise<RunResult> {
  const started = performance.now();
  let lastError = 'brak odpowiedzi';

  for (let i = 0; i < COMPILERS.length; i++) {
    const compiler = COMPILERS[(preferred + i) % COMPILERS.length];
    const body = {
      code: req.code,
      compiler,
      stdin: req.stdin,
      options: 'warning',
      'compiler-option-raw': `-std=${req.std}`,
      save: false,
    };

    const { status, data, text } = await fetchJson(
      API,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      req.timeoutMs + 15000,
      req.signal,
    );

    if (status >= 400 || !data) {
      lastError = text.slice(0, 200) || `HTTP ${status}`;
      continue;
    }

    preferred = (preferred + i) % COMPILERS.length;
    const r = data as WandboxResponse;
    const compileOut = [r.compiler_output, r.compiler_error].filter(Boolean).join('\n').trim();
    const programOut = r.program_output ?? '';
    const programErr = r.program_error ?? '';
    const exit = r.status != null ? Number(r.status) : null;
    // Wandbox nie rozdziela wyraźnie błędu kompilacji — poznajemy go po treści
    const compileFailed = /\berror\b/i.test(r.compiler_error ?? '') && !programOut && !programErr;

    return {
      engine: 'wandbox',
      engineLabel: `Wandbox · ${compiler}`,
      compileOutput: compileOut,
      stdout: programOut,
      stderr: programErr,
      exitCode: compileFailed ? null : Number.isFinite(exit) ? exit : null,
      signalName: r.signal ?? null,
      compileFailed,
      timeMs: Math.round(performance.now() - started),
    };
  }

  throw new EngineUnavailable('wandbox', lastError);
}

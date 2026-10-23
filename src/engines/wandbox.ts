/* Wandbox — publiczne API kompilatora gcc i PHP. */

import { EngineUnavailable, fetchJson, type RunRequest, type RunResult } from './types';

const API = 'https://wandbox.org/api/compile.json';
const LIST_API = 'https://wandbox.org/api/list.json';
const COMPILERS = ['gcc-13.2.0', 'gcc-12.1.0', 'gcc-head'];
let preferred = 0;
let phpCompilers: string[] | null = null;

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

/** Nazwy kompilatorów PHP bierzemy ze świeżej listy Wandboxa —
    identyfikatory zmieniają się z wersjami, więc nie warto ich zgadywać. */
async function resolvePhpCompilers(signal: AbortSignal): Promise<string[]> {
  if (phpCompilers) return phpCompilers;
  const { data } = await fetchJson(LIST_API, { method: 'GET' }, 8000, signal);
  const list = Array.isArray(data)
    ? (data as Array<{ name: string; language?: string; version?: string }>)
    : [];
  const php = list.filter(
    (c) => (c.language ?? '').toLowerCase() === 'php' || /^php/i.test(c.name),
  );
  php.sort((a, b) =>
    (b.version ?? '').localeCompare(a.version ?? '', undefined, { numeric: true }),
  );
  const names = php.map((c) => c.name);
  phpCompilers = names.length ? names.slice(0, 3) : ['php-8.2.0', 'php-8.1.0'];
  return phpCompilers;
}

/** PHP: bez opcji gcc i bez -std= — tylko kod, stdin i wybrany kompilator. */
async function runPhp(req: RunRequest): Promise<RunResult> {
  const started = performance.now();
  const candidates = await resolvePhpCompilers(req.signal).catch(() => ['php-8.2.0', 'php-8.1.0']);
  let lastError = 'brak odpowiedzi';

  for (const compiler of candidates) {
    const { status, data, text } = await fetchJson(
      API,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: req.code, compiler, stdin: req.stdin, save: false }),
      },
      req.timeoutMs + 15000,
      req.signal,
    );

    if (status >= 400 || !data) {
      lastError = text.slice(0, 200) || `HTTP ${status}`;
      continue;
    }

    const r = data as WandboxResponse;
    const programOut = r.program_output ?? '';
    const programErr = r.program_error ?? '';
    const compileOut = [r.compiler_output, r.compiler_error, r.program_message, r.error]
      .filter(Boolean)
      .join('\n')
      .trim();
    const allErr = [programErr, compileOut].filter(Boolean).join('\n');
    // błąd składni PHP = pewny błąd „kompilacji”
    const compileFailed = /\bParse error\b/.test(allErr);
    const exit = r.status != null ? Number(r.status) : null;

    return {
      engine: 'wandbox',
      engineLabel: `Wandbox · ${compiler}`,
      compileOutput: compileOut,
      stdout: programOut,
      // komunikat błędu musi być w stderr — dla PHP nie ma recenzji Kompiego,
      // która pokazałaby compileOutput
      stderr: programErr || compileOut,
      exitCode: compileFailed ? null : Number.isFinite(exit) ? exit : null,
      signalName: r.signal ?? null,
      compileFailed,
      timeMs: Math.round(performance.now() - started),
    };
  }

  throw new EngineUnavailable('wandbox', lastError);
}

export async function run(req: RunRequest): Promise<RunResult> {
  if (req.language === 'php') return runPhp(req);
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

/* Compiler Explorer (godbolt.org) — tryb „executor”: kompiluje i uruchamia. */

import { EngineUnavailable, fetchJson, type RunRequest, type RunResult } from './types';

const COMPILERS = [
  { id: 'g142', label: 'gcc 14.2' },
  { id: 'g132', label: 'gcc 13.2' },
  { id: 'g122', label: 'gcc 12.2' },
];
let preferred = 0;

interface Line {
  text?: string;
}
interface GodboltResponse {
  code?: number;
  didExecute?: boolean;
  timedOut?: boolean;
  execTime?: string | number;
  stdout?: Line[];
  stderr?: Line[];
  buildResult?: { code?: number; stdout?: Line[]; stderr?: Line[] };
}

const join = (lines?: Line[]): string => (lines ?? []).map((l) => l.text ?? '').join('\n');

export async function run(req: RunRequest): Promise<RunResult> {
  const started = performance.now();
  let lastError = 'brak odpowiedzi';

  for (let i = 0; i < COMPILERS.length; i++) {
    const c = COMPILERS[(preferred + i) % COMPILERS.length];
    const body = {
      source: req.code,
      compiler: c.id,
      lang: 'c++',
      allowStoreCodeDebug: false,
      options: {
        userArguments: `-std=${req.std} -O1`,
        executeParameters: { args: [] as string[], stdin: req.stdin },
        compilerOptions: { executorRequest: true, skipAsm: true },
        filters: { execute: true },
        tools: [] as unknown[],
        libraries: [] as unknown[],
      },
    };

    const { status, data, text } = await fetchJson(
      `https://godbolt.org/api/compiler/${c.id}/compile`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      },
      req.timeoutMs + 20000,
      req.signal,
    );

    if (status >= 400 || !data) {
      lastError = text.slice(0, 200) || `HTTP ${status}`;
      continue;
    }

    preferred = (preferred + i) % COMPILERS.length;
    const r = data as GodboltResponse;
    const build = r.buildResult ?? {};
    const compileOut = [join(build.stdout), join(build.stderr)].filter((s) => s.trim()).join('\n').trim();
    const compileFailed = (build.code ?? 0) !== 0 || r.didExecute === false;

    return {
      engine: 'godbolt',
      engineLabel: `Compiler Explorer · ${c.label}`,
      compileOutput: compileOut,
      stdout: join(r.stdout),
      stderr: join(r.stderr),
      exitCode: compileFailed ? null : r.code ?? null,
      compileFailed,
      timedOut: r.timedOut === true,
      timeMs: Math.round(performance.now() - started),
    };
  }

  throw new EngineUnavailable('godbolt', lastError);
}

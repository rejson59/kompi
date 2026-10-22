/* Piston (emkc.org) — darmowe publiczne API z prawdziwym g++ i PHP. */

import { EngineUnavailable, fetchJson, type RunRequest, type RunResult } from './types';

const API = 'https://emkc.org/api/v2/piston';
const cachedVersions = new Map<string, string>();

const pistonLang = (req: RunRequest): string => (req.language === 'php' ? 'php' : 'c++');

const FALLBACK_VERSIONS: Record<string, string> = { 'c++': '10.2.0', php: '8.2.0' };

interface PistonStage {
  stdout?: string;
  stderr?: string;
  output?: string;
  code?: number | null;
  signal?: string | null;
}
interface PistonResponse {
  language?: string;
  version?: string;
  compile?: PistonStage;
  run?: PistonStage;
  message?: string;
}

async function resolveVersion(req: RunRequest): Promise<string> {
  const lang = pistonLang(req);
  const cached = cachedVersions.get(lang);
  if (cached) return cached;
  const { data } = await fetchJson(`${API}/runtimes`, { method: 'GET' }, 8000, req.signal);
  const list = Array.isArray(data) ? (data as Array<{ language: string; version: string; aliases?: string[] }>) : [];
  const rt =
    lang === 'php'
      ? list.find((r) => r.language === 'php' || (r.aliases ?? []).includes('php'))
      : (list.find((r) => r.language === 'c++' || (r.aliases ?? []).includes('c++')) ??
        list.find((r) => r.language === 'cpp' || (r.aliases ?? []).includes('cpp')));
  const version = rt?.version ?? FALLBACK_VERSIONS[lang];
  cachedVersions.set(lang, version);
  return version;
}

export async function run(req: RunRequest): Promise<RunResult> {
  const started = performance.now();
  const lang = pistonLang(req);
  const version = await resolveVersion(req).catch(() => FALLBACK_VERSIONS[lang]);

  const body = {
    language: lang,
    version,
    files: [{ name: lang === 'php' ? 'main.php' : 'main.cpp', content: req.code }],
    stdin: req.stdin,
    args: [] as string[],
    compile_timeout: 10000,
    run_timeout: Math.min(Math.max(req.timeoutMs, 1000), 10000),
  };

  let { status, data, text } = await fetchJson(
    `${API}/execute`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    req.timeoutMs + 15000,
    req.signal,
  );

  // niektóre instancje nie pozwalają ustawiać limitów — próbujemy bez nich
  if (status >= 400) {
    const retry = await fetchJson(
      `${API}/execute`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang, version, files: body.files, stdin: req.stdin }),
      },
      req.timeoutMs + 15000,
      req.signal,
    );
    status = retry.status;
    data = retry.data;
    text = retry.text;
  }

  if (status >= 400 || !data) {
    const msg = (data as PistonResponse | null)?.message ?? text.slice(0, 200) ?? `HTTP ${status}`;
    throw new EngineUnavailable('piston', msg);
  }

  const r = data as PistonResponse;
  const compile = r.compile ?? {};
  const runStage = r.run ?? {};
  const compileOut = [compile.stdout, compile.stderr].filter(Boolean).join('\n').trim();
  const compileFailed = (compile.code ?? 0) !== 0;

  return {
    engine: 'piston',
    engineLabel: lang === 'php' ? `Piston · PHP ${r.version ?? version}` : `Piston · g++ ${r.version ?? version}`,
    compileOutput: compileOut,
    stdout: runStage.stdout ?? '',
    stderr: runStage.stderr ?? '',
    exitCode: compileFailed ? null : runStage.code ?? null,
    signalName: runStage.signal ?? null,
    compileFailed,
    timeMs: Math.round(performance.now() - started),
  };
}

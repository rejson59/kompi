/// <reference lib="webworker" />
/* Tryb offline: interpreter C++ (JSCPP) uruchamiany w osobnym wątku,
   dzięki czemu nieskończona pętla nie zawiesza całej strony. */

interface RunMsg {
  code: string;
  stdin: string;
  maxTimeout: number;
}

self.onmessage = async (ev: MessageEvent<RunMsg>) => {
  const { code, stdin, maxTimeout } = ev.data;
  let out = '';
  try {
    const mod: any = await import('JSCPP');
    const JSCPP = mod.default ?? mod;
    const exitCode = JSCPP.run(code, stdin, {
      stdio: {
        write: (s: string) => {
          out += s;
        },
      },
      maxTimeout,
      unsigned_overflow: 'warn',
    });
    (self as unknown as Worker).postMessage({ ok: true, out, exitCode: Number(exitCode) || 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    (self as unknown as Worker).postMessage({ ok: false, out, error: message });
  }
};

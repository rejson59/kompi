/* Lokalny silnik PHP w Web Workerze (php-wasm 8.4).
   Osobny wątek — nieskończona pętla nie wiesza strony; świeża instancja
   PHP na każdy program (po exit() instancja bywa zatruta). */

import { PhpWebBase } from 'php-wasm/PhpWebBase.mjs';
import { ensurePhpOpenTag, shimPhpCli } from './phpSupport';

interface PhpRunMessage {
  code: string;
  stdin: string;
}

interface PhpRunResult {
  ok: boolean;
  out: string;
  err: string;
  exit?: number;
}

const ctx = self as unknown as {
  onmessage: ((ev: MessageEvent<PhpRunMessage>) => void) | null;
  postMessage: (data: PhpRunResult) => void;
};

ctx.onmessage = async (ev: MessageEvent<PhpRunMessage>) => {
  const { code, stdin } = ev.data;
  try {
    // tylko PHP 8.4 — pozostałe wersje z pakietu nie są nam potrzebne
    const php = new PhpWebBase(import('php-wasm/php8.4-web.mjs') as never, { version: '8.4' });
    let out = '';
    let err = '';
    php.addEventListener('output', (e: Event) => {
      out += (e as CustomEvent<string[]>).detail[0];
    });
    php.addEventListener('error', (e: Event) => {
      err += (e as CustomEvent<string[]>).detail[0];
    });
    await new Promise<void>((resolve) => php.addEventListener('ready', () => resolve(), { once: true }));
    if (stdin) php.inputString(stdin);
    const exit = await php.run(shimPhpCli(ensurePhpOpenTag(code)));
    ctx.postMessage({ ok: true, out, err, exit: typeof exit === 'number' ? exit : undefined });
  } catch (e) {
    ctx.postMessage({ ok: false, out: '', err: String(e) });
  }
};

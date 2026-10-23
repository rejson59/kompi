/* Wspólne narzędzia dla silników PHP (online i lokalnego php-wasm). */

/** Kod PHP bez znacznika <?php nie uruchomi się — dopisujemy go w tej samej linii,
    żeby numeracja linii w błędach się zgadzała. */
export function ensurePhpOpenTag(code: string): string {
  return /<\?(php|=)/i.test(code) ? code : `<?php ${code}`;
}

/** Stałe CLI STDIN/STDOUT/STDERR nie istnieją w lokalnym silniku (php-wasm),
    więc definiujemy je przez strumienie php:// w tej samej linii co <?php —
    numeracja linii pozostaje bez zmian. Shim tylko wtedy, gdy kod ich używa. */
export function shimPhpCli(code: string): string {
  if (!/\b(STDIN|STDOUT|STDERR)\b/.test(code)) return code;
  const shim = `define('STDIN', fopen('php://stdin','r'));define('STDOUT', fopen('php://output','w'));define('STDERR', fopen('php://stderr','w'));`;
  return code.replace(/^(\s*<\?php\b)([^\n]*)/i, (_m, tag: string, rest: string) => `${tag} ${shim}${rest}`);
}

const DIAG_LINE = /^(Parse error|Fatal error|Warning|Deprecated|Notice):|^(Stack trace:|#\d+\s|\s+thrown in )/;

/** Lokalny silnik zwraca komunikaty PHP (Parse/Fatal/Warning…) na stdout —
    przenosimy je do stderr, żeby interfejs pokazał je na czerwono jak online.
    Klasyfikacja linia po linii, bo komunikaty mieszają się z wyjściem programu. */
export function splitPhpDiagnostics(stdout: string, stderr: string): { stdout: string; stderr: string } {
  const lines = stdout.split('\n');
  const diag = new Array<boolean>(lines.length).fill(false);
  let saw = false;
  for (let i = 0; i < lines.length; i++) {
    if (DIAG_LINE.test(lines[i])) {
      diag[i] = true;
      saw = true;
    }
  }
  if (!saw) return { stdout, stderr };
  // puste linie tuż przed blokiem diagnoz (sztuczka php-wasm) dołączamy do niego
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '' && !diag[i]) {
      let j = i + 1;
      while (j < lines.length && lines[j] === '') j++;
      if (j < lines.length && diag[j]) for (let k = i; k < j; k++) diag[k] = true;
    }
  }
  const outText = lines.filter((_, i) => !diag[i]).join('\n');
  const diagText = lines
    .filter((_, i) => diag[i])
    .join('\n')
    .replace(/^\n+/, '');
  return {
    stdout: outText,
    stderr: [diagText, stderr].filter(Boolean).join('\n'),
  };
}

/** Błąd składni = pewny błąd „kompilacji” PHP (jak w prawdziwym CLI). */
export function isPhpParseError(text: string): boolean {
  return /\bParse error\b/.test(text);
}

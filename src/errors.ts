/* Tłumaczenie komunikatów kompilatora na prosty język. */

import { settings } from './state';
import type { CompileIssue } from './editor';

const pick = (pl: string, en: string): string => (settings.lang === 'pl' ? pl : en);

/** Wyciąga z komunikatów kompilatora numery linii i treść błędów. */
export function parseIssues(text: string): CompileIssue[] {
  const issues: CompileIssue[] = [];
  const re = /(?:^|\n)\s*(?:[\w./<>-]*?(?:main\.cpp|prog\.cc|source\.cpp|<source>|\.code\.tio))?:?(\d+):(\d+):\s*(error|warning|note):\s*([^\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const severity = m[3] === 'error' ? 'error' : 'warning';
    if (m[3] === 'note') continue;
    issues.push({ line: Number(m[1]), col: Number(m[2]), severity, message: m[4].trim() });
  }
  return issues;
}

interface Rule {
  re: RegExp;
  pl: string;
  en: string;
}

const RULES: Rule[] = [
  {
    re: /expected ['‘’"]?;/i,
    pl: 'Brakuje średnika <code>;</code> — najczęściej na końcu linii POWYŻEJ tej, którą wskazał kompilator.',
    en: 'A missing semicolon <code>;</code> — usually at the end of the line ABOVE the one the compiler points at.',
  },
  {
    re: /['‘"]?cout['’"]? was not declared|['‘"]?cin['’"]? was not declared|['‘"]?endl['’"]? was not declared/i,
    pl: 'Dodaj na górze pliku <code>#include &lt;iostream&gt;</code> oraz <code>using namespace std;</code>.',
    en: 'Add <code>#include &lt;iostream&gt;</code> and <code>using namespace std;</code> at the top of the file.',
  },
  {
    re: /['‘"]?string['’"]? (was not declared|does not name a type)/i,
    pl: 'Przy tekstach potrzebny jest <code>#include &lt;string&gt;</code>.',
    en: 'Working with text needs <code>#include &lt;string&gt;</code>.',
  },
  {
    re: /['‘"]?vector['’"]? (was not declared|does not name a type)/i,
    pl: 'Przy <code>vector</code> potrzebny jest <code>#include &lt;vector&gt;</code>.',
    en: '<code>vector</code> needs <code>#include &lt;vector&gt;</code>.',
  },
  {
    re: /['‘"]?(sort|max_element|min_element|reverse)['’"]? was not declared/i,
    pl: 'Funkcje takie jak <code>sort</code> wymagają <code>#include &lt;algorithm&gt;</code>.',
    en: 'Functions like <code>sort</code> need <code>#include &lt;algorithm&gt;</code>.',
  },
  {
    re: /['‘"]?(sqrt|pow|abs|floor|ceil|round)['’"]? was not declared/i,
    pl: 'Funkcje matematyczne wymagają <code>#include &lt;cmath&gt;</code>.',
    en: 'Maths functions need <code>#include &lt;cmath&gt;</code>.',
  },
  {
    re: /was not declared in this scope|undeclared identifier/i,
    pl: 'Kompilator nie zna tej nazwy. Sprawdź literówkę, czy zmienna została wcześniej utworzona i czy nie jest w innym bloku <code>{ }</code>.',
    en: 'The compiler does not know this name. Check for a typo, whether the variable was created earlier, and whether it lives in another <code>{ }</code> block.',
  },
  {
    re: /expected ['‘’"]?\}|at end of input/i,
    pl: 'Prawdopodobnie brakuje zamykającej klamry <code>}</code>. Sprawdź, czy każda <code>{</code> ma swoją parę.',
    en: 'A closing brace <code>}</code> is probably missing. Check that every <code>{</code> has its pair.',
  },
  {
    re: /missing terminating ["']|unterminated/i,
    pl: 'Niedomknięty cudzysłów lub apostrof — tekst musi mieć <code>"</code> z obu stron.',
    en: 'An unclosed quote — text needs <code>"</code> on both sides.',
  },
  {
    re: /expected initializer before/i,
    pl: 'Zwykle oznacza brak średnika w poprzedniej linii albo literówkę w nazwie typu (np. <code>itn</code> zamiast <code>int</code>).',
    en: 'Usually a missing semicolon on the previous line or a typo in a type name (e.g. <code>itn</code> instead of <code>int</code>).',
  },
  {
    re: /redefinition of|redeclaration of/i,
    pl: 'Ta nazwa jest użyta dwa razy — zmienną o tej samej nazwie tworzysz drugi raz.',
    en: 'This name is used twice — you are creating the same variable again.',
  },
  {
    re: /no match for ['‘"]?operator|invalid operands of types/i,
    pl: 'Łączysz ze sobą rzeczy różnych typów (np. tekst i liczbę) w sposób, którego C++ nie rozumie.',
    en: 'You are combining different types (e.g. text and a number) in a way C++ does not understand.',
  },
  {
    re: /no matching function for call to/i,
    pl: 'Funkcja o takiej nazwie istnieje, ale nie przyjmuje takich argumentów — sprawdź ich liczbę i typy.',
    en: 'A function with that name exists but does not take these arguments — check how many and what types.',
  },
  {
    re: /control reaches end of non-void function/i,
    pl: 'Funkcja powinna coś zwrócić — dodaj <code>return</code> z wynikiem.',
    en: 'The function should return something — add a <code>return</code> with the result.',
  },
  {
    re: /undefined reference to ['`]main|undefined reference to `main'/i,
    pl: 'W programie musi być funkcja <code>int main()</code>.',
    en: 'The program must contain an <code>int main()</code> function.',
  },
  {
    re: /assignment of read-only|cannot assign to variable .* with const/i,
    pl: 'Próbujesz zmienić wartość oznaczoną jako <code>const</code> — ona nie może się zmieniać.',
    en: 'You are trying to change a <code>const</code> value — it cannot be changed.',
  },
  {
    re: /suggest parentheses around assignment used as truth value|suggest parentheses/i,
    pl: 'Czy w warunku nie powinno być <code>==</code> (porównanie) zamiast <code>=</code> (przypisanie)?',
    en: 'Should the condition use <code>==</code> (compare) instead of <code>=</code> (assign)?',
  },
  {
    re: /cannot find library/i,
    pl: 'Tryb offline nie ma tej biblioteki. Włącz internet albo użyj prostszych narzędzi (iostream, cmath, tablice).',
    en: 'Offline mode does not have this library. Turn the internet on or use simpler tools (iostream, cmath, arrays).',
  },
  {
    re: /Parsing Failure|syntax error|parse error/i,
    pl: 'Kod ma błąd składni — sprawdź nawiasy, klamry i średniki w okolicy wskazanej linii.',
    en: 'There is a syntax error — check brackets, braces and semicolons around the line shown.',
  },
];

/** Zwraca krótkie wskazówki po polsku/angielsku dla podanych komunikatów. */
export function friendlyHints(text: string): string[] {
  if (!text) return [];
  const hints: string[] = [];
  for (const r of RULES) {
    if (r.re.test(text)) {
      const h = pick(r.pl, r.en);
      if (!hints.includes(h)) hints.push(h);
    }
    if (hints.length >= 3) break;
  }
  return hints;
}

/** Wskazówka po nieudanym uruchomieniu (sygnały, kody wyjścia). */
export function runtimeHint(exitCode: number | null, signalName?: string | null, stderr = ''): string | null {
  const sig = (signalName ?? '').toUpperCase();
  if (sig.includes('SEGV') || exitCode === 139 || /segmentation fault/i.test(stderr)) {
    return pick(
      'Program sięgnął po pamięć, której nie ma — zwykle wyjście poza zakres tablicy (np. <code>t[5]</code> przy <code>int t[5]</code>) albo ujemny indeks.',
      'The program touched memory that does not exist — usually going outside an array (e.g. <code>t[5]</code> for <code>int t[5]</code>) or a negative index.',
    );
  }
  if (sig.includes('ABRT') || exitCode === 134) {
    return pick(
      'Program przerwał sam siebie (abort) — często przez błąd w operacjach na pamięci.',
      'The program aborted itself — often because of a memory mistake.',
    );
  }
  if (sig.includes('FPE') || exitCode === 136) {
    return pick('Dzielenie przez zero!', 'Division by zero!');
  }
  if (exitCode !== null && exitCode !== 0) {
    return pick(
      `Program zakończył się kodem ${exitCode}. Jeśli to nie było zamierzone, upewnij się, że <code>main</code> kończy się <code>return 0;</code>.`,
      `The program exited with code ${exitCode}. If that was not on purpose, make sure <code>main</code> ends with <code>return 0;</code>.`,
    );
  }
  return null;
}

/** Czy program prawdopodobnie czekał na dane wejściowe, których nie było. */
export function looksLikeMissingInput(code: string, stdin: string, stdout: string): boolean {
  const readsInput = /\bcin\s*>>|\bgetline\s*\(|\bscanf\s*\(/.test(code);
  return readsInput && stdin.trim().length === 0 && stdout.trim().length === 0;
}

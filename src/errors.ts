/* Uniwersalna analiza kodu C++ linia po linii przez Kompiego:
   - rozróżnia kontekst wywołań funkcji (...), strumieni (<<, >>), typów i zmiennych,
     dzięki czemu nie myli polskich nazw zmiennych (np. tab, pole, suma, czas) z funkcjami C++,
   - obsługuje wieloczłonowe typy (long long, unsigned int, vector<int>, struct),
   - wykrywa literówki (odległość Damerau-Levenshteina), brakujące średniki, nawiasy i cudzysłowy,
   - precyzyjnie tłumaczy komunikaty kompilatora (GCC/Clang oraz lokalnego silnika JSCPP). */

import { settings } from './state';
import type { CompileIssue } from './editor';

const pick = (pl: string, en: string): string => (settings.lang === 'pl' ? pl : en);

export interface KompiLineIssue {
  line: number;
  codeSnippet: string;
  explanation: string;
}

export interface KompiCodeReview {
  ok: boolean;
  badLines: number[];
  goodLines: number[];
  issues: KompiLineIssue[];
}

/* Słowa kluczowe i typy (występują bez nawiasu wywołania funkcji) */
const CPP_KEYWORDS_AND_TYPES = [
  'include',
  'define',
  'using',
  'namespace',
  'std',
  'int',
  'double',
  'float',
  'char',
  'bool',
  'void',
  'long',
  'short',
  'unsigned',
  'signed',
  'const',
  'auto',
  'struct',
  'class',
  'enum',
  'typedef',
  'size_t',
  'int64_t',
  'uint64_t',
  'int32_t',
  'uint32_t',
  'int16_t',
  'uint16_t',
  'return',
  'if',
  'else',
  'for',
  'while',
  'do',
  'switch',
  'case',
  'default',
  'break',
  'continue',
  'true',
  'false',
  'nullptr',
  'NULL',
  'sizeof',
  'string',
  'vector',
];

/* Strumienie i stałe używane bez nawiasów */
const CPP_STREAMS_AND_CONSTS = [
  'cout',
  'cin',
  'endl',
  'cerr',
  'clog',
  'fixed',
  'boolalpha',
  'INT_MAX',
  'INT_MIN',
  'LLONG_MAX',
  'LLONG_MIN',
  'npos',
];

/* Funkcje i metody (wywoływane z nawiasem okrągłym `(`) */
const CPP_FUNCTIONS_AND_METHODS = [
  'main',
  'getline',
  'sort',
  'reverse',
  'min',
  'max',
  'swap',
  'sqrt',
  'pow',
  'abs',
  'fabs',
  'floor',
  'ceil',
  'round',
  'sin',
  'cos',
  'tan',
  'rand',
  'srand',
  'time',
  'printf',
  'scanf',
  'puts',
  'getchar',
  'strlen',
  'strcmp',
  'strcpy',
  'tolower',
  'toupper',
  'isdigit',
  'isalpha',
  'setprecision',
  'setw',
  'to_string',
  'stoi',
  'stoll',
  'stod',
  'length',
  'size',
  'empty',
  'clear',
  'substr',
  'find',
  'erase',
  'insert',
  'replace',
  'at',
  'front',
  'back',
  'begin',
  'end',
  'c_str',
  'push_back',
  'pop_back',
  'resize',
];

const CPP_HEADERS = [
  'iostream',
  'string',
  'algorithm',
  'vector',
  'cmath',
  'math.h',
  'cstdlib',
  'stdlib.h',
  'ctime',
  'time.h',
  'cstring',
  'string.h',
  'cstdio',
  'stdio.h',
  'cctype',
  'ctype.h',
  'iomanip',
  'climits',
  'limits.h',
  'limits',
  'utility',
  'numeric',
  'cstdint',
  'stdint.h',
  'stdbool.h',
  'cfloat',
  'float.h',
  'cassert',
  'assert.h',
  'sstream',
  'fstream',
  'deque',
  'queue',
  'stack',
  'set',
  'map',
  'unordered_map',
  'unordered_set',
  'list',
  'array',
  'bitset',
  'tuple',
  'functional',
  'bits/stdc++.h',
];

const NON_CALL_STD_WORDS = [...CPP_KEYWORDS_AND_TYPES, ...CPP_STREAMS_AND_CONSTS];
const ALL_STD_WORDS = [...NON_CALL_STD_WORDS, ...CPP_FUNCTIONS_AND_METHODS];
const KNOWN_WORDS_SET = new Set([...ALL_STD_WORDS, ...CPP_HEADERS]);

/** Wyciąga z komunikatów kompilatora (GCC/Clang oraz JSCPP) numery linii i treść błędów. */
export function parseIssues(text: string): CompileIssue[] {
  if (!text) return [];
  const issues: CompileIssue[] = [];

  // 1. Format GCC / Clang: main.cpp:6:5: error: ...
  const gccRe =
    /(?:^|\n)\s*(?:[\w./<>-]*?(?:main\.cpp|prog\.cc|source\.cpp|<source>|\.code\.tio))?:?(\d+):(\d+):\s*(error|warning|note):\s*([^\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = gccRe.exec(text))) {
    if (m[3] === 'note') continue;
    const severity = m[3] === 'error' ? 'error' : 'warning';
    issues.push({ line: Number(m[1]), col: Number(m[2]), severity, message: m[4].trim() });
  }

  // 2. Format JSCPP dla błędów wykonania/nazw: "4:19 variable endll does not exist"
  if (issues.length === 0) {
    const jscppPosRe = /(?:^|\n)\s*(\d+):(\d+)\s+([^\n]+)/g;
    while ((m = jscppPosRe.exec(text))) {
      issues.push({
        line: Number(m[1]),
        col: Number(m[2]),
        severity: 'error',
        message: m[3].trim(),
      });
    }
  }

  // 3. Format JSCPP dla błędów składni: "line 2 (column 7): ..." lub "Line 6, column 24: ..."
  if (issues.length === 0) {
    const jscppLineRe = /\b[Ll]ine\s+(\d+)(?:\s*,\s*column\s+(\d+)|\s*\(\s*column\s+(\d+)\s*\))?\s*:?\s*([^\n]*)/g;
    while ((m = jscppLineRe.exec(text))) {
      const line = Number(m[1]);
      const col = Number(m[2] || m[3] || 1);
      const msg = (m[4] || text.split('\n')[0] || 'syntax error').trim();
      if (line >= 1) {
        issues.push({ line, col, severity: 'error', message: msg });
      }
    }
  }

  return issues;
}

/** Odległość Damerau-Levenshteina (uwzględnia czeskie błędy typu "ctou" -> "cout", "usign" -> "using"). */
function editDistance(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  const n = s.length;
  const m = t.length;
  if (Math.abs(n - m) > 3) return 99;

  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost);
      }
    }
  }
  return dp[n][m];
}

function findClosestWord(word: string, candidates: string[], strict = false): string | null {
  if (!word || word.length < 3) return null;
  const maxDist = strict ? 1 : word.length <= 4 ? 1 : 2;
  let best: string | null = null;
  let bestDist = maxDist + 1;

  for (const cand of candidates) {
    if (cand === word) return null;
    if (Math.abs(cand.length - word.length) > maxDist) continue;
    const d = editDistance(word, cand);
    if (
      d < bestDist ||
      (d === bestDist && best && Math.abs(cand.length - word.length) < Math.abs(best.length - word.length))
    ) {
      bestDist = d;
      best = cand;
    }
  }
  return bestDist <= maxDist ? best : null;
}

/** Wyciąga wszystkie nazwy zmiennych, tablic, struktur i funkcji zadeklarowanych lub użytych przez użytkownika. */
function collectUserIdentifiers(cleanLines: string[]): Set<string> {
  const ids = new Set<string>();
  const structNames = new Set<string>();

  // 1. Nazwy struktur / klas
  for (const rawLine of cleanLines) {
    const sm = rawLine.match(/\b(?:struct|class)\s+([A-Za-z_][A-Za-z0-9_]*)/);
    if (sm && !KNOWN_WORDS_SET.has(sm[1])) {
      structNames.add(sm[1]);
      ids.add(sm[1]);
    }
  }

  const declStartRe =
    /\b(?:(?:const|unsigned|signed|short|long)\s+)*(?:int|double|float|char|bool|long|short|unsigned|string|void|auto|size_t|int64_t|uint64_t|int32_t|uint32_t|vector\s*<[^>]+>)\s+([^;{}]+)/g;

  for (const rawLine of cleanLines) {
    const line = rawLine
      .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""')
      .replace(/\bstd\s*::\s*/g, '');

    // 2. Nagłówki funkcji i ich parametry
    const fnMatch = line.match(
      /^\s*(?:(?:const|unsigned|signed|short|long)\s+)*(?:int|double|float|char|bool|long|short|unsigned|string|void|auto|size_t|vector\s*<[^>]+>)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/,
    );
    if (fnMatch) {
      if (!KNOWN_WORDS_SET.has(fnMatch[1])) ids.add(fnMatch[1]);
      const params = fnMatch[2].split(',');
      for (const p of params) {
        const pm = p.trim().match(/([A-Za-z_][A-Za-z0-9_]*)\s*(?:\[[^\]]*\])?(?:\s*=.*)?$/);
        if (pm && !KNOWN_WORDS_SET.has(pm[1])) ids.add(pm[1]);
      }
    }

    // 3. Deklaracje zmiennych (w tym long long, unsigned int, vector<int>, tablice)
    let m: RegExpExecArray | null;
    declStartRe.lastIndex = 0;
    while ((m = declStartRe.exec(line))) {
      const declPart = m[1];
      // Podziel po przecinkach na poziomie 0 nawiasów
      for (const chunk of splitTopLevelCommas(declPart)) {
        const eqIdx = chunk.indexOf('=');
        const leftSide = (eqIdx >= 0 ? chunk.slice(0, eqIdx) : chunk).trim();
        const vm = leftSide.match(/^[*&\s]*([A-Za-z_][A-Za-z0-9_]*)/);
        if (vm && !KNOWN_WORDS_SET.has(vm[1])) {
          ids.add(vm[1]);
        }
      }
    }

    // 4. Deklaracje zmiennych typu strukturalnego (np. Punkt p;)
    for (const stName of structNames) {
      const stRe = new RegExp(`\\b${stName}\\s+([A-Za-z_][A-Za-z0-9_]*)`, 'g');
      while ((m = stRe.exec(line))) {
        if (!KNOWN_WORDS_SET.has(m[1])) ids.add(m[1]);
      }
    }
  }

  return ids;
}

function splitTopLevelCommas(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '{' || ch === '[' || ch === '<') depth++;
    else if (ch === ')' || ch === '}' || ch === ']' || ch === '>') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

/** Tłumaczy pojedynczy komunikat kompilatora (GCC lub JSCPP) na przyjazne wyjaśnienie Kompiego. */
function explainCompilerMsg(msg: string, allKnownWords: string[]): string {
  // 1. JSCPP / GCC: nieznana zmienna lub polecenie
  const undeclMatch =
    msg.match(/variable\s+([A-Za-z_][A-Za-z0-9_]*)\s+does not exist/i) ||
    msg.match(/['‘"`]([A-Za-z_][A-Za-z0-9_]*)['’"`]\s+was not declared/i) ||
    msg.match(/use of undeclared identifier\s+['‘"`]([A-Za-z_][A-Za-z0-9_]*)['’"`]/i);

  if (undeclMatch) {
    const badName = undeclMatch[1];
    const suggestion = findClosestWord(badName, allKnownWords);
    if (suggestion) {
      return pick(
        `Wygląda na literówkę w słowie <code>${escapeHtml(badName)}</code> — czy chodziło Ci o <code>${escapeHtml(suggestion)}</code>?`,
        `Looks like a typo in <code>${escapeHtml(badName)}</code> — did you mean <code>${escapeHtml(suggestion)}</code>?`,
      );
    }
    return pick(
      `Nazwa <code>${escapeHtml(badName)}</code> nie jest znana — sprawdź czy nie ma w niej literówki albo utwórz wcześniej taką zmienną (np. <code>int ${escapeHtml(badName)} = 0;</code>).`,
      `The name <code>${escapeHtml(badName)}</code> is unknown — check for a typo or declare the variable earlier (e.g. <code>int ${escapeHtml(badName)} = 0;</code>).`,
    );
  }

  // 2. JSCPP / GCC: nieznany typ
  const typeMatch =
    msg.match(/type\s+([A-Za-z_][A-Za-z0-9_]*)\s+is not (?:defined|known)/i) ||
    msg.match(/['‘"`]([A-Za-z_][A-Za-z0-9_]*)['’"`]\s+does not name a type/i);
  if (typeMatch) {
    const badType = typeMatch[1];
    const suggestion = findClosestWord(badType, CPP_KEYWORDS_AND_TYPES);
    if (suggestion) {
      return pick(
        `Literówka w nazwie typu <code>${escapeHtml(badType)}</code> — napisz <code>${escapeHtml(suggestion)}</code>.`,
        `Typo in type name <code>${escapeHtml(badType)}</code> — write <code>${escapeHtml(suggestion)}</code>.`,
      );
    }
    return pick(
      `Nieznany typ <code>${escapeHtml(badType)}</code> — sprawdź pisownię (np. <code>int</code>, <code>double</code>, <code>string</code>, <code>bool</code>).`,
      `Unknown type <code>${escapeHtml(badType)}</code> — check spelling (e.g. <code>int</code>, <code>double</code>, <code>string</code>, <code>bool</code>).`,
    );
  }

  // 3. JSCPP / GCC: nieznana funkcja lub metoda
  const fnMatch =
    msg.match(/function\s+([A-Za-z_][A-Za-z0-9_]*)\s+with signature/i) ||
    msg.match(/method\s+([A-Za-z_][A-Za-z0-9_]*)\s+is not defined/i) ||
    msg.match(/no matching function for call to\s+['‘"`]?([A-Za-z_][A-Za-z0-9_]*)/i) ||
    msg.match(/has no member named\s+['‘"`]([A-Za-z_][A-Za-z0-9_]*)['’"`]/i);
  if (fnMatch) {
    const badFn = fnMatch[1];
    if (badFn === 'main') {
      return pick(
        'W programie brakuje głównej funkcji <code>int main()</code> (sprawdź czy nazwa <code>main</code> nie ma literówki).',
        'The program is missing <code>int main()</code> (check that <code>main</code> is spelled correctly).',
      );
    }
    const suggestion = findClosestWord(badFn, [...CPP_FUNCTIONS_AND_METHODS, ...allKnownWords]);
    if (suggestion) {
      return pick(
        `Wygląda na literówkę w nazwie funkcji/metody <code>${escapeHtml(badFn)}</code> — czy chodziło Ci o <code>${escapeHtml(suggestion)}</code>?`,
        `Looks like a typo in function/method name <code>${escapeHtml(badFn)}</code> — did you mean <code>${escapeHtml(suggestion)}</code>?`,
      );
    }
    return pick(
      `Funkcja <code>${escapeHtml(badFn)}</code> nie istnieje albo podano jej złe argumenty w nawiasie.`,
      `Function <code>${escapeHtml(badFn)}</code> does not exist or was given wrong arguments.`,
    );
  }

  // 4. Nieznana biblioteka #include
  const libMatch =
    msg.match(/cannot find library:\s*([^\s\n]+)/i) ||
    msg.match(/([A-Za-z0-9_./+-]+):\s*No such file or directory/i);
  if (libMatch) {
    const badLib = libMatch[1].trim();
    const suggestion = findClosestWord(badLib, CPP_HEADERS);
    if (suggestion) {
      return pick(
        `Literówka w nazwie biblioteki <code>${escapeHtml(badLib)}</code> — czy chodziło Ci o <code>#include &lt;${escapeHtml(suggestion)}&gt;</code>?`,
        `Typo in library name <code>${escapeHtml(badLib)}</code> — did you mean <code>#include &lt;${escapeHtml(suggestion)}&gt;</code>?`,
      );
    }
    return pick(
      `Nieznana biblioteka <code>${escapeHtml(badLib)}</code> — sprawdź pisownię w <code>#include &lt;...&gt;</code>.`,
      `Unknown library <code>${escapeHtml(badLib)}</code> — check the spelling in <code>#include &lt;...&gt;</code>.`,
    );
  }

  if (/expected ['‘’"]?;/i.test(msg)) {
    return pick(
      'Brakuje średnika <code>;</code> na końcu instrukcji.',
      'Missing a semicolon <code>;</code> at the end of the statement.',
    );
  }
  if (/expected ['‘’"]?\}|at end of input/i.test(msg)) {
    return pick(
      'Brakuje zamykającej klamry <code>}</code> — każda <code>{</code> musi mieć swoją parę.',
      'Missing a closing brace <code>}</code> — every <code>{</code> needs a matching pair.',
    );
  }
  if (/missing terminating ["']|unterminated/i.test(msg)) {
    return pick(
      'Niedomknięty cudzysłów — tekst musi mieć <code>"</code> z obu stron.',
      'Unclosed quote — text must have <code>"</code> on both sides.',
    );
  }
  if (/already defined|redefinition of|redeclaration of/i.test(msg)) {
    return pick(
      'Zmienna lub funkcja o tej nazwie została już wcześniej utworzona w tym samym zasięgu.',
      'A variable or function with this name was already declared in the same scope.',
    );
  }
  if (/operator in ostream cannot accept|operator in istream cannot accept|no match for ['‘"]?operator/i.test(msg)) {
    return pick(
      'Sprawdź kierunek strzałek (<code>cout &lt;&lt; ...</code> oraz <code>cin &gt;&gt; ...</code>) oraz typy łączonych danych.',
      'Check the arrow direction (<code>cout &lt;&lt; ...</code> and <code>cin &gt;&gt; ...</code>) and data types.',
    );
  }

  return pick(
    'W tej linii jest błąd składni — sprawdź dokładnie pisownię poleceń, nawiasy i średnik.',
    'Syntax error on this line — double-check command spelling, parentheses, and the semicolon.',
  );
}

/**
 * Sprawdza cały kod linia po linii po kliknięciu „Uruchom”.
 * Zwraca listę linii poprawnych (zielonych), błędnych (czerwonych)
 * oraz proste wyjaśnienia Kompiego, co użytkownik zrobił nie tak.
 */
export function analyzeCodeWithKompi(
  code: string,
  compileOutput: string,
  compileFailed: boolean,
): KompiCodeReview {
  const rawLines = code.split('\n');
  const cleanLines = stripCommentsPerLine(code);

  const nonEmptyLines: number[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    if (rawLines[i].trim().length > 0) {
      nonEmptyLines.push(i + 1);
    }
  }

  if (!compileFailed) {
    return {
      ok: true,
      badLines: [],
      goodLines: nonEmptyLines,
      issues: [],
    };
  }

  const userIds = collectUserIdentifiers(cleanLines);
  const nonCallCandidates = [...NON_CALL_STD_WORDS, ...userIds];
  const callCandidates = [...CPP_FUNCTIONS_AND_METHODS, ...userIds];
  const allKnownWords = [...ALL_STD_WORDS, ...userIds];

  const issueMap = new Map<number, string>();
  const addIssue = (lineNo: number, explanation: string) => {
    if (lineNo < 1 || lineNo > rawLines.length) return;
    if (!issueMap.has(lineNo)) {
      issueMap.set(lineNo, explanation);
    }
  };

  // 1. Uniwersalna, kontekstowa analiza każdej linii
  for (let idx = 0; idx < cleanLines.length; idx++) {
    const lineNo = idx + 1;
    const line = cleanLines[idx].trim();
    if (!line) continue;

    // a) Niedomknięty cudzysłów "
    if (countUnescapedQuotes(line) % 2 === 1) {
      addIssue(
        lineNo,
        pick(
          'Niedomknięty cudzysłów <code>"</code> — każdy tekst musi zaczynać się i kończyć znakiem <code>"</code>.',
          'Unclosed quote <code>"</code> — every text string must start and end with <code>"</code>.',
        ),
      );
      continue;
    }

    // b) Dyrektywy #include / #define
    if (line.startsWith('#')) {
      const dirMatch = line.match(/^#\s*([A-Za-z_][A-Za-z0-9_]*)/);
      if (dirMatch && !['include', 'define', 'ifdef', 'ifndef', 'endif', 'pragma', 'undef'].includes(dirMatch[1])) {
        const sug = findClosestWord(dirMatch[1], ['include', 'define']);
        if (sug) {
          addIssue(
            lineNo,
            pick(
              `Literówka w dyrektywie <code>#${escapeHtml(dirMatch[1])}</code> — powinno być <code>#${sug}</code>.`,
              `Typo in directive <code>#${escapeHtml(dirMatch[1])}</code> — should be <code>#${sug}</code>.`,
            ),
          );
          continue;
        }
      }
      if (/^#\s*include\b/.test(line)) {
        if (line.endsWith(';')) {
          addIssue(
            lineNo,
            pick(
              'Na końcu linii z <code>#include</code> nie stawiamy średnika <code>;</code>.',
              'Do not put a semicolon <code>;</code> at the end of an <code>#include</code> line.',
            ),
          );
          continue;
        }
        const hdrMatch = line.match(/^#\s*include\s*<\s*([^>\s]+)\s*>$/);
        if (!hdrMatch && !/^#\s*include\s*"[^"]+"$/.test(line)) {
          addIssue(
            lineNo,
            pick(
              'Nazwę biblioteki po <code>#include</code> zapisz w ostrych nawiasach, np. <code>#include &lt;iostream&gt;</code>.',
              'Wrap the library name in angle brackets, e.g. <code>#include &lt;iostream&gt;</code>.',
            ),
          );
          continue;
        }
        if (hdrMatch && !CPP_HEADERS.includes(hdrMatch[1])) {
          const sug = findClosestWord(hdrMatch[1], CPP_HEADERS);
          if (sug) {
            addIssue(
              lineNo,
              pick(
                `Literówka w nazwie biblioteki <code>${escapeHtml(hdrMatch[1])}</code> — czy chodziło Ci o <code>#include &lt;${sug}&gt;</code>?`,
                `Typo in library name <code>${escapeHtml(hdrMatch[1])}</code> — did you mean <code>#include &lt;${sug}&gt;</code>?`,
              ),
            );
            continue;
          }
        }
      }
      continue;
    }

    // c) Odwrócone strzałki przy cout / cin
    if (/\bcout\s*>>/.test(line)) {
      addIssue(
        lineNo,
        pick(
          'Przy <code>cout</code> strzałki muszą iść w lewo: <code>cout &lt;&lt; ...</code> (teraz masz <code>&gt;&gt;</code>).',
          'With <code>cout</code>, arrows must point left: <code>cout &lt;&lt; ...</code> (you wrote <code>&gt;&gt;</code>).',
        ),
      );
      continue;
    }
    if (/\bcin\s*<</.test(line)) {
      addIssue(
        lineNo,
        pick(
          'Przy <code>cin</code> strzałki muszą iść w prawo: <code>cin &gt;&gt; ...</code> (teraz masz <code>&lt;&lt;</code>).',
          'With <code>cin</code>, arrows must point right: <code>cin &gt;&gt; ...</code> (you wrote <code>&lt;&lt;</code>).',
        ),
      );
      continue;
    }

    // d) Literówka w nazwie funkcji main (np. int mian())
    const mainTypo = line.match(/^\s*int\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*\)/);
    if (mainTypo && mainTypo[1] !== 'main' && editDistance(mainTypo[1], 'main') <= 2) {
      addIssue(
        lineNo,
        pick(
          `Literówka w nazwie głównej funkcji: <code>${escapeHtml(mainTypo[1])}</code> — powinno być <code>int main()</code>.`,
          `Typo in main function name: <code>${escapeHtml(mainTypo[1])}</code> — should be <code>int main()</code>.`,
        ),
      );
      continue;
    }

    // e) Kontekstowe sprawdzenie słów w linii:
    //    - jeśli po słowie stoi `(`, sprawdzamy w słowniku funkcji/metod,
    //    - jeśli po słowie NIE stoi `(`, sprawdzamy w słowach kluczowych, strumieniach i zmiennych użytkownika.
    const withoutStrings = line.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
    const tokRe = /\b([A-Za-z_][A-Za-z0-9_]*)\b(\s*\()?/g;
    let tm: RegExpExecArray | null;
    let foundTypoOnLine = false;
    while ((tm = tokRe.exec(withoutStrings))) {
      const tok = tm[1];
      const isCall = Boolean(tm[2]);
      if (KNOWN_WORDS_SET.has(tok) || userIds.has(tok)) continue;

      if (isCall) {
        if (tok.length < 3) continue;
        const sug = findClosestWord(tok, callCandidates);
        if (sug) {
          addIssue(
            lineNo,
            pick(
              `Wygląda na literówkę w wywołaniu funkcji <code>${escapeHtml(tok)}(...)</code> — czy chodziło Ci o <code>${escapeHtml(sug)}</code>?`,
              `Looks like a typo in function call <code>${escapeHtml(tok)}(...)</code> — did you mean <code>${escapeHtml(sug)}</code>?`,
            ),
          );
          foundTypoOnLine = true;
          break;
        }
      } else {
        // Dla krótkich 3-literowych słów sprawdzamy tylko jednoznaczny kontekst składniowy (int, cin, std),
        // żeby nie mylić nazw zmiennych takich jak `tab`, `bok`, `rok` z innymi słowami.
        if (tok.length <= 3) {
          if (tok.length === 3) {
            if (/^\s*[A-Za-z_]{3}\s+[A-Za-z_]/.test(withoutStrings) && editDistance(tok, 'int') === 1) {
              addIssue(
                lineNo,
                pick(
                  `Literówka w nazwie typu <code>${escapeHtml(tok)}</code> — czy chodziło Ci o <code>int</code>?`,
                  `Typo in type name <code>${escapeHtml(tok)}</code> — did you mean <code>int</code>?`,
                ),
              );
              foundTypoOnLine = true;
              break;
            }
            if (new RegExp(`\\b${tok}\\s*>>`).test(withoutStrings) && editDistance(tok, 'cin') === 1) {
              addIssue(
                lineNo,
                pick(
                  `Literówka w <code>${escapeHtml(tok)}</code> — do wczytywania danych służy <code>cin</code>.`,
                  `Typo in <code>${escapeHtml(tok)}</code> — use <code>cin</code> to read input.`,
                ),
              );
              foundTypoOnLine = true;
              break;
            }
            if (/\bnamespace\s+[A-Za-z_]{3}\b/.test(withoutStrings) && editDistance(tok, 'std') === 1) {
              addIssue(
                lineNo,
                pick(
                  `Literówka w <code>${escapeHtml(tok)}</code> — powinno być <code>using namespace std;</code>.`,
                  `Typo in <code>${escapeHtml(tok)}</code> — should be <code>using namespace std;</code>.`,
                ),
              );
              foundTypoOnLine = true;
              break;
            }
          }
          continue;
        }

        const sug = findClosestWord(tok, nonCallCandidates);
        if (sug) {
          addIssue(
            lineNo,
            pick(
              `Wygląda na literówkę w słowie <code>${escapeHtml(tok)}</code> — czy chodziło Ci o <code>${escapeHtml(sug)}</code>?`,
              `Looks like a typo in <code>${escapeHtml(tok)}</code> — did you mean <code>${escapeHtml(sug)}</code>?`,
            ),
          );
          foundTypoOnLine = true;
          break;
        }
      }
    }
    if (foundTypoOnLine) continue;

    // f) Niezgodna liczba nawiasów okrągłych ( ) w linii
    const openParens = (withoutStrings.match(/\(/g) ?? []).length;
    const closeParens = (withoutStrings.match(/\)/g) ?? []).length;
    if (openParens !== closeParens) {
      addIssue(
        lineNo,
        pick(
          openParens > closeParens
            ? 'W tej linii brakuje zamykającego nawiasu <code>)</code>.'
            : 'W tej linii jest o jeden zamykający nawias <code>)</code> za dużo.',
          openParens > closeParens
            ? 'Missing a closing parenthesis <code>)</code> on this line.'
            : 'Extra closing parenthesis <code>)</code> on this line.',
        ),
      );
      continue;
    }

    // g) Brak średnika `;` na końcu zwykłej instrukcji
    if (needsSemicolon(withoutStrings, cleanLines, idx)) {
      addIssue(
        lineNo,
        pick(
          'Na końcu tej linii brakuje średnika <code>;</code>. W C++ każdą taką instrukcję kończymy średnikiem.',
          'Missing a semicolon <code>;</code> at the end of this line.',
        ),
      );
    }
  }

  // 2. Sprawdzenie par klamer { } w całym programie
  let braceDepth = 0;
  let lastOpenBraceLine = 1;
  for (let idx = 0; idx < cleanLines.length; idx++) {
    const withoutStrings = cleanLines[idx].replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '""');
    for (const ch of withoutStrings) {
      if (ch === '{') {
        braceDepth++;
        lastOpenBraceLine = idx + 1;
      } else if (ch === '}') {
        braceDepth--;
        if (braceDepth < 0) {
          addIssue(
            idx + 1,
            pick(
              'Nadmiarowa klamra zamykająca <code>}</code> — nie ma dla niej pasującej <code>{</code>.',
              'Extra closing brace <code>}</code> without a matching <code>{</code>.',
            ),
          );
          braceDepth = 0;
        }
      }
    }
  }
  if (braceDepth > 0) {
    const targetLine = nonEmptyLines[nonEmptyLines.length - 1] ?? lastOpenBraceLine;
    addIssue(
      targetLine,
      pick(
        'Na końcu programu brakuje zamykającej klamry <code>}</code> (każda <code>{</code> musi zostać domknięta).',
        'Missing a closing brace <code>}</code> at the end of the program.',
      ),
    );
  }

  // 3. Błędy zgłoszone bezpośrednio przez kompilator (GCC lub JSCPP)
  const compilerIssues = parseIssues(compileOutput);
  for (const ci of compilerIssues) {
    if (ci.severity !== 'error') continue;
    const prevNonEmpty = findPrevNonEmptyLine(cleanLines, ci.line);

    // Gdy kompilator zgłasza błąd składni w linii N, a linia N-1 już ma brak średnika — nie obwiniaj linii N
    if (
      prevNonEmpty !== null &&
      issueMap.has(prevNonEmpty) &&
      /expected ['‘’"]?;|expected initializer|Parsing Failure|syntax error/i.test(ci.message)
    ) {
      continue;
    }

    addIssue(ci.line, explainCompilerMsg(ci.message, allKnownWords));
  }

  // 4. Fallback: jeśli kompilator zgłosił błąd bez numeru linii
  if (issueMap.size === 0 && nonEmptyLines.length > 0) {
    const mainBodyLine =
      nonEmptyLines.find(
        (l) => !cleanLines[l - 1].trim().startsWith('#') && !/\busing\s+namespace\b/.test(cleanLines[l - 1]),
      ) ?? nonEmptyLines[0];
    addIssue(mainBodyLine, explainCompilerMsg(compileOutput, allKnownWords));
  }

  const badLines = [...issueMap.keys()].sort((a, b) => a - b);
  const badSet = new Set(badLines);
  const goodLines = nonEmptyLines.filter((l) => !badSet.has(l));

  const issues: KompiLineIssue[] = badLines.map((line) => ({
    line,
    codeSnippet: rawLines[line - 1]?.trim() ?? '',
    explanation: issueMap.get(line)!,
  }));

  return {
    ok: false,
    badLines,
    goodLines,
    issues,
  };
}

function findPrevNonEmptyLine(cleanLines: string[], currentLine1Based: number): number | null {
  for (let i = currentLine1Based - 2; i >= 0; i--) {
    if (cleanLines[i]?.trim()) return i + 1;
  }
  return null;
}

/** Sprawdza czy dana linia jest zwykłą instrukcją C++, która powinna kończyć się średnikiem `;`. */
function needsSemicolon(lineNoStrings: string, allCleanLines: string[], idx: number): boolean {
  const s = lineNoStrings.trim();
  if (!s) return false;
  if (s.startsWith('#')) return false;

  // Linie kończące się na ; { } , : \ lub operator kontynuowany w kolejnej linii
  if (/[;{},:\\]$/.test(s)) return false;
  if (/([+\-*/%&|^=<>?!~(\[]|<<|>>|&&|\|\|)$/.test(s)) return false;

  if (/^(if|else\s+if|for|while|switch)\s*\(.*\)$/.test(s)) return false;
  if (/^(else|do|try)\b/.test(s)) return false;
  if (/^catch\s*\(.*\)$/.test(s)) return false;
  if (/^(struct|class|namespace|enum)\b/.test(s) && !s.includes('=')) return false;

  // Nagłówek funkcji np. int main(), long long suma(int a, int b), vector<int> f()
  if (/^[A-Za-z_][A-Za-z0-9_:<>\s*&]*\s+[A-Za-z_][A-Za-z0-9_]*\s*\([^;]*\)\s*(?:const)?$/.test(s)) {
    return false;
  }

  for (let next = idx + 1; next < allCleanLines.length; next++) {
    const nt = allCleanLines[next].trim();
    if (!nt) continue;
    if (/^(<<|>>|[+\-*/%&|^?:.]|\{)/.test(nt)) return false;
    break;
  }

  return true;
}

function countUnescapedQuotes(s: string): number {
  let count = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') {
      i++;
      continue;
    }
    if (s[i] === '"') count++;
  }
  return count;
}

function stripCommentsPerLine(code: string): string[] {
  const lines = code.split('\n');
  let inBlock = false;
  return lines.map((line) => {
    let out = '';
    let inStr = false;
    let strChar = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const next = line[i + 1];
      if (inBlock) {
        if (c === '*' && next === '/') {
          inBlock = false;
          i++;
        }
        continue;
      }
      if (inStr) {
        out += c;
        if (c === '\\') {
          if (next) out += next;
          i++;
        } else if (c === strChar) {
          inStr = false;
        }
        continue;
      }
      if (c === '/' && next === '/') break;
      if (c === '/' && next === '*') {
        inBlock = true;
        i++;
        continue;
      }
      if (c === '"' || c === "'") {
        inStr = true;
        strChar = c;
      }
      out += c;
    }
    return out;
  });
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

export function looksLikeMissingInput(code: string, stdin: string, stdout: string): boolean {
  const readsInput = /\bcin\s*>>|\bgetline\s*\(|\bscanf\s*\(/.test(code);
  return readsInput && stdin.trim().length === 0 && stdout.trim().length === 0;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

/* Autouzupełnianie: słowa kluczowe, gotowe wzorce (snippety),
   funkcje z biblioteki standardowej + nazwy zmiennych z Twojego kodu. */

import { snippetCompletion, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { settings } from './state';
import { TOKEN_INDEX } from './glossary';

interface Item {
  label: string;
  type: string;
  detail?: { pl: string; en: string };
  info?: { pl: string; en: string };
  snippet?: string;
  boost?: number;
}

const KEYWORDS: Item[] = [
  { label: 'int', type: 'type', detail: { pl: 'liczba całkowita', en: 'whole number' } },
  { label: 'double', type: 'type', detail: { pl: 'liczba z przecinkiem', en: 'decimal number' } },
  { label: 'float', type: 'type', detail: { pl: 'liczba z przecinkiem (mniej dokładna)', en: 'decimal number (less precise)' } },
  { label: 'char', type: 'type', detail: { pl: 'pojedynczy znak', en: 'single character' } },
  { label: 'bool', type: 'type', detail: { pl: 'prawda / fałsz', en: 'true / false' } },
  { label: 'string', type: 'type', detail: { pl: 'tekst', en: 'text' } },
  { label: 'long long', type: 'type', detail: { pl: 'bardzo duża liczba całkowita', en: 'very large whole number' } },
  { label: 'void', type: 'type', detail: { pl: 'funkcja nic nie zwraca', en: 'function returns nothing' } },
  { label: 'const', type: 'keyword', detail: { pl: 'wartość nie do zmiany', en: 'value that cannot change' } },
  { label: 'true', type: 'keyword' },
  { label: 'false', type: 'keyword' },
  { label: 'return', type: 'keyword', detail: { pl: 'zwróć wynik', en: 'give back a result' } },
  { label: 'break', type: 'keyword', detail: { pl: 'przerwij pętlę', en: 'leave the loop' } },
  { label: 'continue', type: 'keyword', detail: { pl: 'następny obieg pętli', en: 'next loop round' } },
  { label: 'struct', type: 'keyword' },
  { label: 'class', type: 'keyword' },
  { label: 'using namespace std;', type: 'keyword', boost: 20 },
];

const SNIPPETS: Item[] = [
  {
    label: 'main',
    type: 'function',
    boost: 99,
    detail: { pl: 'szkielet programu', en: 'program skeleton' },
    snippet: '#include <iostream>\nusing namespace std;\n\nint main() {\n\t${}\n\treturn 0;\n}',
  },
  {
    label: 'cout',
    type: 'function',
    boost: 95,
    detail: { pl: 'wypisz na ekran', en: 'print to the screen' },
    snippet: 'cout << ${tekst} << endl;',
  },
  {
    label: 'cin',
    type: 'function',
    boost: 94,
    detail: { pl: 'wczytaj dane', en: 'read data' },
    snippet: 'cin >> ${zmienna};',
  },
  {
    label: 'for',
    type: 'keyword',
    boost: 93,
    detail: { pl: 'pętla licząca', en: 'counting loop' },
    snippet: 'for (int ${i} = 0; ${i} < ${n}; ${i}++) {\n\t${}\n}',
  },
  {
    label: 'forarr',
    type: 'keyword',
    detail: { pl: 'pętla po tablicy', en: 'loop over an array' },
    snippet: 'for (int ${i} = 0; ${i} < ${n}; ${i}++) {\n\tcout << ${t}[${i}] << " ";\n}',
  },
  {
    label: 'while',
    type: 'keyword',
    boost: 90,
    detail: { pl: 'pętla „dopóki”', en: '“while” loop' },
    snippet: 'while (${warunek}) {\n\t${}\n}',
  },
  {
    label: 'dowhile',
    type: 'keyword',
    detail: { pl: 'pętla wykonana min. raz', en: 'loop that runs at least once' },
    snippet: 'do {\n\t${}\n} while (${warunek});',
  },
  {
    label: 'if',
    type: 'keyword',
    boost: 92,
    detail: { pl: 'warunek', en: 'condition' },
    snippet: 'if (${warunek}) {\n\t${}\n}',
  },
  {
    label: 'ifelse',
    type: 'keyword',
    detail: { pl: 'warunek z „w przeciwnym razie”', en: 'condition with “otherwise”' },
    snippet: 'if (${warunek}) {\n\t${}\n} else {\n\t\n}',
  },
  {
    label: 'switch',
    type: 'keyword',
    detail: { pl: 'wybór wariantu', en: 'choose one option' },
    snippet: 'switch (${zmienna}) {\n\tcase ${1}:\n\t\t${}\n\t\tbreak;\n\tdefault:\n\t\tbreak;\n}',
  },
  {
    label: 'func',
    type: 'function',
    detail: { pl: 'własna funkcja', en: 'your own function' },
    snippet: '${int} ${nazwa}(${int a}) {\n\t${}\n\treturn ${0};\n}',
  },
  {
    label: 'array',
    type: 'variable',
    detail: { pl: 'tablica', en: 'array' },
    snippet: 'int ${t}[${5}] = {${0}};',
  },
  {
    label: 'vector',
    type: 'variable',
    detail: { pl: 'tablica, która rośnie', en: 'array that grows' },
    snippet: 'vector<${int}> ${v};',
  },
  {
    label: 'getline',
    type: 'function',
    detail: { pl: 'wczytaj całą linię tekstu', en: 'read a whole line of text' },
    snippet: 'getline(cin, ${tekst});',
  },
  {
    label: 'include',
    type: 'keyword',
    detail: { pl: 'dołącz bibliotekę', en: 'add a library' },
    snippet: '#include <${iostream}>',
  },
];

const FUNCTIONS: Item[] = [
  { label: 'endl', type: 'constant', detail: { pl: 'nowa linia', en: 'new line' }, boost: 80 },
  { label: 'sqrt', type: 'function', detail: { pl: 'pierwiastek (cmath)', en: 'square root (cmath)' } },
  { label: 'pow', type: 'function', detail: { pl: 'potęga (cmath)', en: 'power (cmath)' } },
  { label: 'abs', type: 'function', detail: { pl: 'wartość bezwzględna', en: 'absolute value' } },
  { label: 'round', type: 'function', detail: { pl: 'zaokrąglij', en: 'round' } },
  { label: 'floor', type: 'function', detail: { pl: 'zaokrąglij w dół', en: 'round down' } },
  { label: 'ceil', type: 'function', detail: { pl: 'zaokrąglij w górę', en: 'round up' } },
  { label: 'max', type: 'function', detail: { pl: 'większa z dwóch', en: 'bigger of two' } },
  { label: 'min', type: 'function', detail: { pl: 'mniejsza z dwóch', en: 'smaller of two' } },
  { label: 'swap', type: 'function', detail: { pl: 'zamień miejscami', en: 'swap two values' } },
  { label: 'sort', type: 'function', detail: { pl: 'posortuj (algorithm)', en: 'sort (algorithm)' } },
  { label: 'rand', type: 'function', detail: { pl: 'losowa liczba', en: 'random number' } },
  { label: 'srand', type: 'function', detail: { pl: 'ustaw ziarno losowania', en: 'seed the randomiser' } },
  { label: 'push_back', type: 'method', detail: { pl: 'dodaj na koniec (vector)', en: 'add at the end (vector)' } },
  { label: 'size', type: 'method', detail: { pl: 'ile elementów', en: 'how many elements' } },
  { label: 'length', type: 'method', detail: { pl: 'długość tekstu', en: 'text length' } },
  { label: 'substr', type: 'method', detail: { pl: 'wytnij fragment tekstu', en: 'cut out part of the text' } },
  { label: 'setprecision', type: 'function', detail: { pl: 'miejsca po przecinku (iomanip)', en: 'decimal places (iomanip)' } },
  { label: 'fixed', type: 'constant', detail: { pl: 'stała liczba miejsc po przecinku', en: 'fixed decimal places' } },
];

const HEADERS = ['iostream', 'string', 'vector', 'cmath', 'algorithm', 'iomanip', 'cstdlib', 'ctime', 'cstring', 'cstdio'];

function toCompletion(it: Item): Completion {
  const lang = settings.lang;
  const detail = it.detail?.[lang];
  const gloss = TOKEN_INDEX[it.label];
  const info = it.info?.[lang] ?? gloss?.short[lang];
  const base = { label: it.label, type: it.type, detail, boost: it.boost, info };
  if (it.snippet) {
    return snippetCompletion(it.snippet, { ...base, label: it.label, type: it.type });
  }
  return base;
}

/** Nazwy zmiennych i funkcji znalezione w kodzie użytkownika. */
function localIdentifiers(text: string, skip: string): Completion[] {
  const found = new Set<string>();
  const re = /[A-Za-z_][A-Za-z0-9_]{1,30}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[0] !== skip) found.add(m[0]);
  }
  const known = new Set([...KEYWORDS, ...FUNCTIONS].map((i) => i.label));
  return [...found]
    .filter((w) => !known.has(w))
    .slice(0, 200)
    .map((w) => ({ label: w, type: 'variable', boost: -10 }));
}

export function cppCompletionSource(context: CompletionContext): CompletionResult | null {
  const before = context.state.sliceDoc(Math.max(0, context.pos - 40), context.pos);

  // po "#include <" podpowiadamy nazwy bibliotek
  const inc = /#include\s*<([A-Za-z]*)$/.exec(before);
  if (inc) {
    return {
      from: context.pos - inc[1].length,
      options: HEADERS.map((h) => ({ label: h, type: 'namespace', apply: `${h}>` })),
      validFor: /^[A-Za-z]*$/,
    };
  }

  const word = context.matchBefore(/[A-Za-z_][A-Za-z0-9_]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;

  const options = [
    ...SNIPPETS.map(toCompletion),
    ...KEYWORDS.map(toCompletion),
    ...FUNCTIONS.map(toCompletion),
    ...localIdentifiers(context.state.doc.toString(), word.text),
  ];

  return { from: word.from, options, validFor: /^[A-Za-z_][A-Za-z0-9_]*$/ };
}

/* Słowniczek: krótkie wyjaśnienia prostym językiem (PL + EN).
   `tokens` służą do podpowiedzi po najechaniu myszką w edytorze,
   `match` to dodatkowe słowa, po których działa wyszukiwarka. */

import type { Lang } from './state';

export type GlossCat = 'basics' | 'io' | 'control' | 'data' | 'func' | 'stl' | 'errors' | 'tips';

export interface GlossEntry {
  id: string;
  cat: GlossCat;
  title: Record<Lang, string>;
  short: Record<Lang, string>;
  body: Record<Lang, string>;
  code?: string;
  tokens?: string[];
  match?: string[];
}

export const CATEGORIES: GlossCat[] = ['basics', 'io', 'control', 'data', 'func', 'stl', 'errors', 'tips'];

export const GLOSSARY: GlossEntry[] = [
  /* ------------------------------- PODSTAWY ------------------------------ */
  {
    id: 'main',
    cat: 'basics',
    tokens: ['main'],
    match: ['funkcja główna', 'start', 'program', 'entry point'],
    title: { pl: 'int main() — początek programu', en: 'int main() — the start of the program' },
    short: { pl: 'Tu zaczyna się każdy program w C++.', en: 'Every C++ program starts here.' },
    body: {
      pl: 'Komputer uruchamia instrukcje w kolejności od pierwszej klamry <code>{</code> funkcji <code>main</code> do <code>}</code>. Jeśli kodu nie ma w <code>main</code> (albo w funkcji wywołanej z <code>main</code>), to się nie wykona. <code>return 0;</code> na końcu oznacza „zakończyłem bez błędu”.',
      en: 'The computer runs the statements from the opening <code>{</code> of <code>main</code> to the closing <code>}</code>. Code outside <code>main</code> (or outside a function called from it) never runs. <code>return 0;</code> means “finished with no error”.',
    },
    code: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Start!" << endl;\n    return 0;\n}',
  },
  {
    id: 'include',
    cat: 'basics',
    tokens: ['include', 'iostream'],
    match: ['biblioteka', 'nagłówek', 'header', 'library', '#include'],
    title: { pl: '#include — dołączanie bibliotek', en: '#include — adding libraries' },
    short: { pl: 'Mówi kompilatorowi, z jakich gotowych narzędzi korzystasz.', en: 'Tells the compiler which ready-made tools you use.' },
    body: {
      pl: 'Biblioteka to zestaw gotowych rzeczy. <code>&lt;iostream&gt;</code> daje <code>cin</code> i <code>cout</code>, <code>&lt;cmath&gt;</code> daje <code>sqrt</code>, <code>&lt;string&gt;</code> daje teksty, <code>&lt;vector&gt;</code> daje listy. Bez dołączenia biblioteki kompilator powie, że czegoś „nie zna”.',
      en: 'A library is a set of ready-made things. <code>&lt;iostream&gt;</code> gives you <code>cin</code> and <code>cout</code>, <code>&lt;cmath&gt;</code> gives <code>sqrt</code>, <code>&lt;string&gt;</code> gives text, <code>&lt;vector&gt;</code> gives lists. Without the include the compiler says it does not know the name.',
    },
    code: '#include <iostream>   // cin, cout\n#include <cmath>      // sqrt, pow, abs\n#include <string>     // string',
  },
  {
    id: 'namespace',
    cat: 'basics',
    tokens: ['namespace', 'std', 'using'],
    match: ['std::', 'przestrzeń nazw'],
    title: { pl: 'using namespace std;', en: 'using namespace std;' },
    short: { pl: 'Dzięki temu piszesz cout zamiast std::cout.', en: 'Lets you write cout instead of std::cout.' },
    body: {
      pl: 'Wszystkie gotowe narzędzia z biblioteki standardowej mieszkają w „przestrzeni nazw” <code>std</code>. Ta linijka mówi: „jeśli czegoś nie znajdziesz, poszukaj w std”. Bez niej trzeba pisać <code>std::cout</code>.',
      en: 'Everything from the standard library lives in the namespace <code>std</code>. This line says “if you can’t find a name, look inside std”. Without it you must write <code>std::cout</code>.',
    },
    code: 'using namespace std;\ncout << "bez std::" << endl;\n// albo bez tej linijki:\nstd::cout << "ze std::" << std::endl;',
  },
  {
    id: 'semicolon',
    cat: 'basics',
    tokens: [],
    match: ['średnik', ';', 'semicolon', 'expected'],
    title: { pl: 'Średnik ;', en: 'The semicolon ;' },
    short: { pl: 'Kończy każdą instrukcję — jak kropka w zdaniu.', en: 'Ends every statement — like a full stop in a sentence.' },
    body: {
      pl: 'Po każdej instrukcji stawiamy <code>;</code>. Nie stawiamy go po <code>if (...)</code>, <code>for (...)</code>, <code>while (...)</code> i po klamrze <code>}</code> kończącej funkcję lub pętlę. Brak średnika to najczęstszy błąd kompilacji: <em>expected ‘;’</em>.',
      en: 'Put <code>;</code> after every statement. Do not put it after <code>if (...)</code>, <code>for (...)</code>, <code>while (...)</code>, or after the <code>}</code> that ends a function or loop. A missing semicolon is the most common compile error: <em>expected ‘;’</em>.',
    },
    code: 'int a = 5;        // tak\ncout << a << endl; // tak\nif (a > 3) {      // bez średnika!\n    cout << "duze";\n}',
  },
  {
    id: 'comment',
    cat: 'basics',
    tokens: [],
    match: ['komentarz', 'comment', '//', '/*'],
    title: { pl: 'Komentarze // i /* */', en: 'Comments // and /* */' },
    short: { pl: 'Notatki dla człowieka — komputer je pomija.', en: 'Notes for humans — the computer ignores them.' },
    body: {
      pl: 'Wszystko po <code>//</code> do końca linii jest pomijane. Dłuższy fragment zamykasz w <code>/* ... */</code>. Komentarze służą też do chwilowego „wyłączania” kodu. Skrót: <kbd>Ctrl</kbd>+<kbd>/</kbd>.',
      en: 'Everything after <code>//</code> until the end of the line is ignored. Longer notes go inside <code>/* ... */</code>. Comments are also handy for switching code off temporarily. Shortcut: <kbd>Ctrl</kbd>+<kbd>/</kbd>.',
    },
    code: '// to jest komentarz\nint x = 5; // też komentarz\n/* kilka\n   linii */',
  },
  {
    id: 'compilation',
    cat: 'basics',
    tokens: [],
    match: ['kompilacja', 'kompilator', 'compile', 'build', 'jak to działa'],
    title: { pl: 'Czym jest kompilacja?', en: 'What is compilation?' },
    short: { pl: 'Tłumaczenie Twojego kodu na język, który rozumie komputer.', en: 'Translating your code into something the computer understands.' },
    body: {
      pl: 'Najpierw kompilator sprawdza kod i zamienia go na program (to <strong>kompilacja</strong>). Dopiero potem program jest <strong>uruchamiany</strong>. Dlatego błędy dzielą się na dwa rodzaje: błędy kompilacji (program w ogóle nie powstał) i błędy wykonania (program powstał, ale coś poszło nie tak w trakcie działania).',
      en: 'First the compiler checks your code and turns it into a program (<strong>compilation</strong>). Only then the program is <strong>run</strong>. That is why errors come in two kinds: compile errors (no program was built) and runtime errors (the program was built but something went wrong while running).',
    },
  },
  {
    id: 'variable',
    cat: 'basics',
    tokens: [],
    match: ['zmienna', 'variable', 'deklaracja', 'przypisanie'],
    title: { pl: 'Zmienna', en: 'Variable' },
    short: { pl: 'Pudełko z nazwą, w którym trzymasz jedną wartość.', en: 'A named box that holds one value.' },
    body: {
      pl: 'Tworząc zmienną mówisz, <em>jakiego typu</em> jest wartość i <em>jak się nazywa</em>: <code>int wiek = 15;</code>. Wartość można później zmienić: <code>wiek = 16;</code>. Nazwa nie może zawierać spacji ani zaczynać się od cyfry.',
      en: 'When you create a variable you say <em>what type</em> it holds and <em>what it is called</em>: <code>int age = 15;</code>. You can change the value later: <code>age = 16;</code>. Names cannot contain spaces or start with a digit.',
    },
    code: 'int wiek = 15;\ndouble srednia = 4.75;\nwiek = wiek + 1;   // teraz 16',
  },
  {
    id: 'return',
    cat: 'basics',
    tokens: ['return'],
    match: ['zwracanie', 'return 0'],
    title: { pl: 'return', en: 'return' },
    short: { pl: 'Kończy funkcję i oddaje wynik.', en: 'Ends a function and gives back a result.' },
    body: {
      pl: 'W <code>main</code> <code>return 0;</code> oznacza „program zakończony poprawnie”. W innych funkcjach <code>return</code> oddaje wartość temu, kto funkcję wywołał — i natychmiast kończy jej działanie.',
      en: 'In <code>main</code>, <code>return 0;</code> means “the program finished correctly”. In other functions <code>return</code> hands a value back to the caller — and immediately ends the function.',
    },
    code: 'int kwadrat(int x) {\n    return x * x;   // oddaje wynik\n}',
  },

  /* ---------------------------- WEJŚCIE / WYJŚCIE ------------------------ */
  {
    id: 'cout',
    cat: 'io',
    tokens: ['cout'],
    match: ['wypisywanie', 'drukowanie', 'print', 'output', 'wyświetl'],
    title: { pl: 'cout — wypisywanie na ekran', en: 'cout — printing to the screen' },
    short: { pl: 'Pokazuje tekst albo liczby w oknie wyjścia.', en: 'Shows text or numbers in the output panel.' },
    body: {
      pl: 'Strzałki <code>&lt;&lt;</code> „wkładają” kolejne rzeczy do wyjścia. Tekst zapisujemy w cudzysłowie, a zmienne bez. Można łączyć wiele rzeczy w jednej linii.',
      en: 'The arrows <code>&lt;&lt;</code> push things into the output. Text goes in quotes, variables do not. You can chain several things in one line.',
    },
    code: 'int wynik = 7;\ncout << "Wynik to: " << wynik << endl;',
  },
  {
    id: 'cin',
    cat: 'io',
    tokens: ['cin'],
    match: ['wczytywanie', 'wejście', 'input', 'read', 'dane'],
    title: { pl: 'cin — wczytywanie danych', en: 'cin — reading data' },
    short: { pl: 'Czeka, aż użytkownik poda dane, i zapisuje je do zmiennej.', en: 'Waits for the user to type data and stores it in a variable.' },
    body: {
      pl: 'Strzałki <code>&gt;&gt;</code> „wyciągają” dane do zmiennej. W kompi dane wpisujesz <strong>wcześniej</strong> w zakładce <em>Wejście</em> — program ich tam szuka. Każda wartość w nowej linii albo po spacji.',
      en: 'The arrows <code>&gt;&gt;</code> pull data into a variable. In kompi you type the data <strong>beforehand</strong> in the <em>Input</em> tab — that is where the program reads from. One value per line or separated by spaces.',
    },
    code: 'int a, b;\ncin >> a >> b;\ncout << a + b << endl;',
  },
  {
    id: 'endl',
    cat: 'io',
    tokens: ['endl'],
    match: ['nowa linia', 'enter', 'newline', '\\n'],
    title: { pl: 'endl i "\\n" — nowa linia', en: 'endl and "\\n" — a new line' },
    short: { pl: 'Przenosi wypisywanie do następnej linii.', en: 'Moves the output to the next line.' },
    body: {
      pl: 'Bez <code>endl</code> wszystko wypisuje się w jednym ciągu. <code>"\\n"</code> robi to samo i jest odrobinę szybsze.',
      en: 'Without <code>endl</code> everything is printed in one long line. <code>"\\n"</code> does the same thing and is slightly faster.',
    },
    code: 'cout << "pierwsza" << endl;\ncout << "druga\\n";',
  },
  {
    id: 'getline',
    cat: 'io',
    tokens: ['getline'],
    match: ['cała linia', 'imię i nazwisko', 'spacja w tekście', 'whole line'],
    title: { pl: 'getline — wczytanie całej linii', en: 'getline — reading a whole line' },
    short: { pl: 'cin >> gubi tekst po spacji, getline czyta całą linię.', en: 'cin >> stops at a space, getline reads the entire line.' },
    body: {
      pl: 'Jeśli chcesz wczytać „Jan Kowalski”, użyj <code>getline(cin, zmienna)</code>. Uwaga: po wcześniejszym <code>cin &gt;&gt; liczba</code> trzeba dodać <code>cin.ignore();</code>, bo w buforze zostaje Enter.',
      en: 'To read “John Smith” use <code>getline(cin, variable)</code>. Careful: after an earlier <code>cin &gt;&gt; number</code> add <code>cin.ignore();</code>, because the Enter key is still waiting in the buffer.',
    },
    code: '#include <string>\nstring imie;\ngetline(cin, imie);\ncout << "Czesc, " << imie << "!" << endl;',
  },
  {
    id: 'setprecision',
    cat: 'io',
    tokens: ['setprecision', 'fixed', 'iomanip'],
    match: ['miejsca po przecinku', 'zaokrąglanie wypisywania', 'decimal places'],
    title: { pl: 'Liczby po przecinku na wyjściu', en: 'Decimal places in the output' },
    short: { pl: 'fixed << setprecision(2) pokazuje dokładnie 2 miejsca.', en: 'fixed << setprecision(2) shows exactly 2 decimals.' },
    body: {
      pl: 'Domyślnie C++ pokazuje około 6 cyfr znaczących. Aby pokazać np. cenę z dwoma miejscami, dołącz <code>&lt;iomanip&gt;</code> i użyj <code>fixed</code> oraz <code>setprecision</code>.',
      en: 'By default C++ prints about 6 significant digits. To show e.g. a price with two decimals, include <code>&lt;iomanip&gt;</code> and use <code>fixed</code> and <code>setprecision</code>.',
    },
    code: '#include <iomanip>\ndouble x = 3.14159;\ncout << fixed << setprecision(2) << x << endl; // 3.14',
  },

  /* ------------------------------- DANE ---------------------------------- */
  {
    id: 'int',
    cat: 'data',
    tokens: ['int', 'long'],
    match: ['liczba całkowita', 'integer', 'typ'],
    title: { pl: 'int — liczby całkowite', en: 'int — whole numbers' },
    short: { pl: 'Liczby bez przecinka, np. -3, 0, 42.', en: 'Numbers without a decimal point, e.g. -3, 0, 42.' },
    body: {
      pl: 'Mieści mniej więcej od −2 000 000 000 do 2 000 000 000. Gdy potrzebujesz większych, użyj <code>long long</code>. Uwaga: <code>7 / 2</code> na intach daje <strong>3</strong>, bo reszta jest obcinana.',
      en: 'Holds roughly −2,000,000,000 to 2,000,000,000. For bigger values use <code>long long</code>. Careful: <code>7 / 2</code> with ints gives <strong>3</strong> — the remainder is cut off.',
    },
    code: 'int a = 7, b = 2;\ncout << a / b << endl;        // 3\ncout << (double)a / b << endl; // 3.5',
  },
  {
    id: 'double',
    cat: 'data',
    tokens: ['double', 'float'],
    match: ['liczba rzeczywista', 'ułamek', 'przecinek', 'decimal'],
    title: { pl: 'double — liczby z przecinkiem', en: 'double — numbers with decimals' },
    short: { pl: 'Np. 3.14 albo 0.5 (uwaga: kropka, nie przecinek!).', en: 'E.g. 3.14 or 0.5 (use a dot, not a comma!).' },
    body: {
      pl: 'W kodzie piszemy <code>2.5</code>, nigdy <code>2,5</code>. <code>double</code> jest dokładniejszy niż <code>float</code> i to jego zwykle używamy.',
      en: 'In code write <code>2.5</code>, never <code>2,5</code>. <code>double</code> is more precise than <code>float</code> and is the usual choice.',
    },
    code: 'double srednia = (4 + 5) / 2.0;  // 4.5\ncout << srednia << endl;',
  },
  {
    id: 'char',
    cat: 'data',
    tokens: ['char'],
    match: ['znak', 'litera', 'character'],
    title: { pl: 'char — pojedynczy znak', en: 'char — a single character' },
    short: { pl: 'Jedna litera w apostrofach: \'A\'.', en: 'One letter in single quotes: \'A\'.' },
    body: {
      pl: 'Apostrofy <code>\'a\'</code> to jeden znak, cudzysłów <code>"a"</code> to tekst. Znaki mają też numery (kod ASCII), więc <code>\'A\' + 1</code> daje <code>\'B\'</code>.',
      en: 'Single quotes <code>\'a\'</code> mean one character; double quotes <code>"a"</code> mean text. Characters have numeric codes (ASCII), so <code>\'A\' + 1</code> is <code>\'B\'</code>.',
    },
    code: "char litera = 'A';\ncout << litera << \" \" << (int)litera << endl; // A 65",
  },
  {
    id: 'bool',
    cat: 'data',
    tokens: ['bool', 'true', 'false'],
    match: ['prawda', 'fałsz', 'logiczny', 'boolean'],
    title: { pl: 'bool — prawda albo fałsz', en: 'bool — true or false' },
    short: { pl: 'Przechowuje tylko true (1) albo false (0).', en: 'Holds only true (1) or false (0).' },
    body: {
      pl: 'Wyniki porównań (<code>a &gt; b</code>) są typu <code>bool</code>. Przy wypisywaniu zobaczysz 1 lub 0.',
      en: 'The result of a comparison (<code>a &gt; b</code>) is a <code>bool</code>. When printed it shows as 1 or 0.',
    },
    code: 'bool pelnoletni = (wiek >= 18);\nif (pelnoletni) cout << "tak" << endl;',
  },
  {
    id: 'string',
    cat: 'data',
    tokens: ['string', 'substr', 'length', 'size'],
    match: ['tekst', 'napis', 'text', 'słowo'],
    title: { pl: 'string — tekst', en: 'string — text' },
    short: { pl: 'Przechowuje słowa i zdania. Wymaga #include <string>.', en: 'Holds words and sentences. Needs #include <string>.' },
    body: {
      pl: 'Teksty łączymy plusem: <code>"ala" + "kot"</code>. <code>s.length()</code> podaje liczbę znaków, <code>s[0]</code> to pierwsza litera, <code>s.substr(1, 3)</code> wycina fragment.',
      en: 'Join text with plus: <code>"ala" + "cat"</code>. <code>s.length()</code> gives the number of characters, <code>s[0]</code> is the first letter, <code>s.substr(1, 3)</code> cuts out a piece.',
    },
    code: '#include <string>\nstring s = "Ala ma kota";\ncout << s.length() << endl;   // 11\ncout << s.substr(0, 3) << endl; // Ala',
  },
  {
    id: 'const',
    cat: 'data',
    tokens: ['const'],
    match: ['stała', 'niezmienna', 'constant'],
    title: { pl: 'const — wartość, której nie zmienisz', en: 'const — a value you cannot change' },
    short: { pl: 'Zabezpiecza stałe, np. PI.', en: 'Protects constants, e.g. PI.' },
    body: {
      pl: 'Jeśli spróbujesz zmienić <code>const</code>, kompilator zgłosi błąd. To dobre zabezpieczenie przed pomyłką.',
      en: 'If you try to change a <code>const</code>, the compiler reports an error. It protects you from mistakes.',
    },
    code: 'const double PI = 3.14159;\n// PI = 3; // błąd kompilacji',
  },
  {
    id: 'array',
    cat: 'data',
    tokens: [],
    match: ['tablica', 'array', 'indeks', 'wiele wartości'],
    title: { pl: 'Tablica — wiele wartości pod jedną nazwą', en: 'Array — many values under one name' },
    short: { pl: 'int t[5]; to pięć pudełek: t[0] … t[4].', en: 'int t[5]; is five boxes: t[0] … t[4].' },
    body: {
      pl: 'Numerujemy <strong>od zera</strong>, więc w <code>int t[5]</code> ostatni element to <code>t[4]</code>. Sięgnięcie po <code>t[5]</code> to typowy błąd — program może się wysypać albo pokazać śmieci.',
      en: 'Indexing starts <strong>at zero</strong>, so in <code>int t[5]</code> the last element is <code>t[4]</code>. Touching <code>t[5]</code> is a classic bug — the program may crash or print garbage.',
    },
    code: 'int t[5] = {3, 1, 4, 1, 5};\nfor (int i = 0; i < 5; i++) {\n    cout << t[i] << " ";\n}\ncout << endl;',
  },
  {
    id: 'array2d',
    cat: 'data',
    tokens: [],
    match: ['tablica dwuwymiarowa', 'macierz', '2d', 'matrix', 'wiersze kolumny'],
    title: { pl: 'Tablica dwuwymiarowa', en: 'Two-dimensional array' },
    short: { pl: 'Jak szachownica: [wiersz][kolumna].', en: 'Like a chessboard: [row][column].' },
    body: {
      pl: 'Przechodzimy po niej dwiema pętlami: zewnętrzna po wierszach, wewnętrzna po kolumnach.',
      en: 'You walk through it with two loops: the outer over rows, the inner over columns.',
    },
    code: 'int m[2][3] = {{1,2,3},{4,5,6}};\nfor (int w = 0; w < 2; w++) {\n    for (int k = 0; k < 3; k++) cout << m[w][k] << " ";\n    cout << endl;\n}',
  },
  {
    id: 'vector',
    cat: 'data',
    tokens: ['vector', 'push_back'],
    match: ['lista', 'dynamiczna tablica', 'rosnąca tablica'],
    title: { pl: 'vector — tablica, która rośnie', en: 'vector — an array that grows' },
    short: { pl: 'Nie musisz z góry znać liczby elementów.', en: 'You do not need to know the number of elements upfront.' },
    body: {
      pl: 'Dodajesz elementy przez <code>push_back</code>, a <code>v.size()</code> mówi ile ich jest. Wymaga <code>#include &lt;vector&gt;</code>.',
      en: 'Add elements with <code>push_back</code>; <code>v.size()</code> tells you how many there are. Needs <code>#include &lt;vector&gt;</code>.',
    },
    code: '#include <vector>\nvector<int> v;\nv.push_back(10);\nv.push_back(20);\nfor (int i = 0; i < v.size(); i++) cout << v[i] << " ";',
  },
  {
    id: 'cast',
    cat: 'data',
    tokens: [],
    match: ['rzutowanie', 'konwersja', 'cast', 'zamiana typu'],
    title: { pl: 'Rzutowanie typów', en: 'Type casting' },
    short: { pl: 'Zamiana liczby jednego typu na inny: (double)a.', en: 'Changing a value from one type to another: (double)a.' },
    body: {
      pl: 'Najczęściej potrzebne przy dzieleniu: <code>(double)suma / ile</code>, żeby średnia nie została obcięta do liczby całkowitej.',
      en: 'Most often needed when dividing: <code>(double)sum / count</code>, so the average is not cut down to a whole number.',
    },
    code: 'int suma = 7, ile = 2;\ncout << suma / ile << endl;            // 3\ncout << (double)suma / ile << endl;    // 3.5',
  },
  {
    id: 'operators',
    cat: 'data',
    tokens: [],
    match: ['operatory', 'dodawanie', 'mnożenie', 'dzielenie', 'kolejność działań'],
    title: { pl: 'Działania + − * / %', en: 'Operations + − * / %' },
    short: { pl: 'Zwykła matematyka; * i / są wykonywane przed + i −.', en: 'Plain maths; * and / happen before + and −.' },
    body: {
      pl: 'Kolejność jak w matematyce, nawiasy ją zmieniają. <code>%</code> to reszta z dzielenia (modulo). Dzielenie dwóch liczb całkowitych obcina wynik.',
      en: 'The usual order of operations; brackets change it. <code>%</code> is the remainder (modulo). Dividing two integers cuts off the fraction.',
    },
    code: 'cout << 2 + 3 * 4 << endl;   // 14\ncout << (2 + 3) * 4 << endl; // 20\ncout << 7 % 3 << endl;       // 1',
  },
  {
    id: 'modulo',
    cat: 'data',
    tokens: [],
    match: ['modulo', 'reszta z dzielenia', 'parzysta', 'nieparzysta', '%'],
    title: { pl: '% — reszta z dzielenia', en: '% — the remainder' },
    short: { pl: 'Sprawdza podzielność, np. czy liczba jest parzysta.', en: 'Checks divisibility, e.g. whether a number is even.' },
    body: {
      pl: '<code>liczba % 2 == 0</code> oznacza „parzysta”. <code>% 10</code> daje ostatnią cyfrę, a <code>/ 10</code> obcina ostatnią cyfrę.',
      en: '<code>number % 2 == 0</code> means “even”. <code>% 10</code> gives the last digit and <code>/ 10</code> removes it.',
    },
    code: 'int n = 1234;\ncout << n % 10 << endl; // 4 (ostatnia cyfra)\ncout << n / 10 << endl; // 123',
  },
  {
    id: 'increment',
    cat: 'data',
    tokens: [],
    match: ['++', '--', 'inkrementacja', 'zwiększanie', '+='],
    title: { pl: 'i++ oraz i += 1', en: 'i++ and i += 1' },
    short: { pl: 'Skrócony zapis zwiększania zmiennej o 1.', en: 'A short way of adding 1 to a variable.' },
    body: {
      pl: '<code>i++</code> to to samo co <code>i = i + 1</code>. Podobnie <code>suma += x</code> znaczy <code>suma = suma + x</code>.',
      en: '<code>i++</code> is the same as <code>i = i + 1</code>. Likewise <code>sum += x</code> means <code>sum = sum + x</code>.',
    },
    code: 'int i = 0;\ni++;        // 1\ni += 5;     // 6',
  },
  {
    id: 'assign-vs-equal',
    cat: 'data',
    tokens: [],
    match: ['= czy ==', 'przypisanie porównanie', 'equals'],
    title: { pl: '= to nie to samo co ==', en: '= is not the same as ==' },
    short: { pl: '= przypisuje wartość, == porównuje.', en: '= assigns a value, == compares.' },
    body: {
      pl: '<code>x = 5</code> wpisuje 5 do x. <code>x == 5</code> pyta „czy x równa się 5?”. Napisanie <code>if (x = 5)</code> jest klasyczną pułapką — warunek zawsze będzie prawdziwy.',
      en: '<code>x = 5</code> puts 5 into x. <code>x == 5</code> asks “is x equal to 5?”. Writing <code>if (x = 5)</code> is a classic trap — the condition is always true.',
    },
    code: 'int x = 5;        // przypisanie\nif (x == 5) {     // porównanie\n    cout << "piec" << endl;\n}',
  },

  /* --------------------------- WARUNKI I PĘTLE --------------------------- */
  {
    id: 'if',
    cat: 'control',
    tokens: ['if', 'else'],
    match: ['warunek', 'jeżeli', 'condition'],
    title: { pl: 'if / else — warunek', en: 'if / else — a condition' },
    short: { pl: 'Wykonuje kod tylko wtedy, gdy coś jest prawdą.', en: 'Runs code only when something is true.' },
    body: {
      pl: 'Po <code>if</code> w nawiasie dajemy pytanie, na które odpowiedź brzmi tak/nie. <code>else</code> to „w przeciwnym razie”, a <code>else if</code> sprawdza kolejny wariant.',
      en: 'Inside the <code>if</code> brackets you ask a yes/no question. <code>else</code> means “otherwise”, and <code>else if</code> checks the next case.',
    },
    code: 'int ocena = 4;\nif (ocena >= 5) {\n    cout << "swietnie" << endl;\n} else if (ocena >= 3) {\n    cout << "dobrze" << endl;\n} else {\n    cout << "popraw" << endl;\n}',
  },
  {
    id: 'comparison',
    cat: 'control',
    tokens: [],
    match: ['porównanie', 'większe', 'mniejsze', 'różne', '!=', '>=' ],
    title: { pl: 'Porównania: == != < > <= >=', en: 'Comparisons: == != < > <= >=' },
    short: { pl: 'Odpowiadają na pytanie prawda/fałsz.', en: 'They answer a true/false question.' },
    body: {
      pl: '<code>==</code> równe, <code>!=</code> różne, <code>&lt;=</code> mniejsze lub równe. Pamiętaj o podwójnym znaku przy „równe”.',
      en: '<code>==</code> equal, <code>!=</code> not equal, <code>&lt;=</code> less or equal. Remember the double sign for “equal”.',
    },
    code: 'if (a != b) cout << "rozne" << endl;',
  },
  {
    id: 'logic',
    cat: 'control',
    tokens: [],
    match: ['&&', '||', 'and', 'or', 'nie', 'logika', 'oraz', 'lub'],
    title: { pl: '&& (i), || (lub), ! (nie)', en: '&& (and), || (or), ! (not)' },
    short: { pl: 'Łączenie kilku warunków w jeden.', en: 'Joining several conditions into one.' },
    body: {
      pl: '<code>&&</code> wymaga, by <strong>oba</strong> warunki były prawdziwe. <code>||</code> wystarczy, że <strong>jeden</strong>. <code>!</code> odwraca warunek.',
      en: '<code>&&</code> needs <strong>both</strong> conditions to be true. <code>||</code> needs <strong>at least one</strong>. <code>!</code> flips the condition.',
    },
    code: 'if (wiek >= 13 && wiek <= 19) cout << "nastolatek" << endl;\nif (dzien == 6 || dzien == 7) cout << "weekend" << endl;',
  },
  {
    id: 'for',
    cat: 'control',
    tokens: ['for'],
    match: ['pętla', 'loop', 'powtarzanie', 'iteracja'],
    title: { pl: 'for — pętla ze licznikiem', en: 'for — a counting loop' },
    short: { pl: 'Powtarza kod ustaloną liczbę razy.', en: 'Repeats code a fixed number of times.' },
    body: {
      pl: 'W nawiasie są trzy części: start (<code>int i = 0</code>), warunek (<code>i &lt; 5</code>) i krok (<code>i++</code>). Pętla kręci się, dopóki warunek jest prawdziwy.',
      en: 'The brackets hold three parts: the start (<code>int i = 0</code>), the condition (<code>i &lt; 5</code>) and the step (<code>i++</code>). The loop spins while the condition is true.',
    },
    code: 'for (int i = 1; i <= 5; i++) {\n    cout << i << " ";\n}\ncout << endl;  // 1 2 3 4 5',
  },
  {
    id: 'while',
    cat: 'control',
    tokens: ['while'],
    match: ['pętla dopóki', 'while loop', 'nieskończona pętla'],
    title: { pl: 'while — pętla „dopóki”', en: 'while — a “while” loop' },
    short: { pl: 'Powtarza, dopóki warunek jest prawdziwy.', en: 'Repeats while the condition is true.' },
    body: {
      pl: 'Używamy, gdy nie wiemy z góry, ile razy coś się powtórzy. <strong>Uwaga:</strong> jeśli w środku nic nie zmienia warunku, pętla nigdy się nie skończy.',
      en: 'Use it when you do not know in advance how many repetitions you need. <strong>Careful:</strong> if nothing inside changes the condition, the loop never ends.',
    },
    code: 'int n = 10;\nwhile (n > 0) {\n    cout << n << " ";\n    n = n - 2;   // bez tego pętla nie skończy się nigdy\n}',
  },
  {
    id: 'dowhile',
    cat: 'control',
    tokens: ['do'],
    match: ['do while', 'przynajmniej raz'],
    title: { pl: 'do … while — wykona się choć raz', en: 'do … while — runs at least once' },
    short: { pl: 'Najpierw wykonuje, potem sprawdza warunek.', en: 'It runs first and checks the condition afterwards.' },
    body: {
      pl: 'Przydatne np. przy prośbie o poprawne dane: najpierw pytamy, a potem sprawdzamy, czy odpowiedź była dobra.',
      en: 'Handy when asking for valid data: ask first, then check whether the answer was good.',
    },
    code: 'int x;\ndo {\n    cin >> x;\n} while (x < 0);   // powtarzaj, póki ujemne',
  },
  {
    id: 'break',
    cat: 'control',
    tokens: ['break', 'continue'],
    match: ['przerwij pętlę', 'pomiń', 'skip'],
    title: { pl: 'break i continue', en: 'break and continue' },
    short: { pl: 'break kończy pętlę, continue przeskakuje do następnego obiegu.', en: 'break ends the loop, continue jumps to the next round.' },
    body: {
      pl: '<code>break</code> natychmiast wychodzi z pętli (lub z <code>switch</code>). <code>continue</code> pomija resztę bieżącego obiegu i zaczyna następny.',
      en: '<code>break</code> leaves the loop immediately (or a <code>switch</code>). <code>continue</code> skips the rest of this round and starts the next one.',
    },
    code: 'for (int i = 1; i <= 10; i++) {\n    if (i % 2 == 0) continue; // pomiń parzyste\n    if (i > 7) break;         // zakończ\n    cout << i << " ";\n}',
  },
  {
    id: 'switch',
    cat: 'control',
    tokens: ['switch', 'case', 'default'],
    match: ['wybór wariantu', 'menu'],
    title: { pl: 'switch — wybór jednego z wariantów', en: 'switch — choosing one of several options' },
    short: { pl: 'Czytelniejszy niż wiele if-ów przy prostym menu.', en: 'Cleaner than many ifs for a simple menu.' },
    body: {
      pl: 'Każdy wariant kończymy <code>break;</code>, inaczej wykonają się także kolejne. <code>default</code> to „żaden z powyższych”.',
      en: 'End each case with <code>break;</code>, otherwise the following cases also run. <code>default</code> means “none of the above”.',
    },
    code: 'int opcja = 2;\nswitch (opcja) {\n    case 1: cout << "jeden"; break;\n    case 2: cout << "dwa";   break;\n    default: cout << "inne";\n}',
  },

  /* ------------------------------ FUNKCJE -------------------------------- */
  {
    id: 'function',
    cat: 'func',
    tokens: ['void'],
    match: ['funkcja', 'function', 'procedura', 'metoda'],
    title: { pl: 'Funkcja — własne polecenie', en: 'Function — your own command' },
    short: { pl: 'Fragment kodu z nazwą, który można wywoływać wiele razy.', en: 'A named piece of code you can call many times.' },
    body: {
      pl: 'Budowa: <code>typ nazwa(parametry) { ... }</code>. Typ to rodzaj wyniku (<code>int</code>, <code>double</code>…), a <code>void</code> oznacza „nic nie zwraca”. Funkcję trzeba zdefiniować <strong>powyżej</strong> miejsca użycia.',
      en: 'Shape: <code>type name(parameters) { ... }</code>. The type is the kind of result (<code>int</code>, <code>double</code>…), and <code>void</code> means “returns nothing”. Define the function <strong>above</strong> the place where you use it.',
    },
    code: 'int suma(int a, int b) {\n    return a + b;\n}\n\nint main() {\n    cout << suma(2, 3) << endl; // 5\n    return 0;\n}',
  },
  {
    id: 'params',
    cat: 'func',
    tokens: [],
    match: ['parametry', 'argumenty', 'parameters', 'arguments'],
    title: { pl: 'Parametry i argumenty', en: 'Parameters and arguments' },
    short: { pl: 'Dane, które podajesz funkcji do pracy.', en: 'The data you hand to a function.' },
    body: {
      pl: 'Parametry to „puste miejsca” w definicji funkcji, a argumenty to konkretne wartości przy wywołaniu. Domyślnie funkcja dostaje <strong>kopię</strong> wartości, więc zmiana w środku nie wpływa na oryginał.',
      en: 'Parameters are the blanks in the definition; arguments are the actual values you pass. By default the function gets a <strong>copy</strong>, so changes inside do not affect the original.',
    },
    code: 'void pokaz(int x) { cout << x << endl; }\npokaz(42);  // 42 to argument',
  },
  {
    id: 'reference',
    cat: 'func',
    tokens: [],
    match: ['referencja', 'przez referencję', 'reference', '&'],
    title: { pl: 'Przekazywanie przez referencję (&)', en: 'Passing by reference (&)' },
    short: { pl: 'Funkcja może zmienić oryginalną zmienną.', en: 'The function can change the original variable.' },
    body: {
      pl: 'Dodanie <code>&</code> przy parametrze sprawia, że funkcja pracuje na oryginale, a nie na kopii. Przydaje się np. przy zamianie dwóch wartości miejscami.',
      en: 'Adding <code>&</code> to a parameter makes the function work on the original instead of a copy. Useful e.g. for swapping two values.',
    },
    code: 'void zwieksz(int &x) { x = x + 1; }\nint a = 5;\nzwieksz(a);\ncout << a << endl; // 6',
  },

  /* ---------------------------- GOTOWE NARZĘDZIA ------------------------- */
  {
    id: 'sort',
    cat: 'stl',
    tokens: ['sort', 'algorithm'],
    match: ['sortowanie', 'porządkowanie', 'rosnąco'],
    title: { pl: 'sort — sortowanie', en: 'sort — sorting' },
    short: { pl: 'Układa elementy rosnąco jedną linijką.', en: 'Puts elements in increasing order in one line.' },
    body: {
      pl: 'Wymaga <code>#include &lt;algorithm&gt;</code>. Dla tablicy: <code>sort(t, t + n)</code>, dla vectora: <code>sort(v.begin(), v.end())</code>.',
      en: 'Needs <code>#include &lt;algorithm&gt;</code>. For an array: <code>sort(t, t + n)</code>; for a vector: <code>sort(v.begin(), v.end())</code>.',
    },
    code: '#include <algorithm>\nint t[5] = {3, 1, 4, 1, 5};\nsort(t, t + 5);\nfor (int i = 0; i < 5; i++) cout << t[i] << " "; // 1 1 3 4 5',
  },
  {
    id: 'minmax',
    cat: 'stl',
    tokens: ['max', 'min', 'swap'],
    match: ['największa', 'najmniejsza', 'zamiana miejscami'],
    title: { pl: 'max, min, swap', en: 'max, min, swap' },
    short: { pl: 'Większa / mniejsza z dwóch wartości, zamiana miejscami.', en: 'The bigger / smaller of two values, and swapping.' },
    body: {
      pl: '<code>max(a, b)</code> i <code>min(a, b)</code> zwracają wartość, <code>swap(a, b)</code> zamienia zawartość dwóch zmiennych.',
      en: '<code>max(a, b)</code> and <code>min(a, b)</code> return a value; <code>swap(a, b)</code> exchanges the contents of two variables.',
    },
    code: '#include <algorithm>\nint a = 3, b = 8;\ncout << max(a, b) << endl; // 8\nswap(a, b);                // teraz a = 8, b = 3',
  },
  {
    id: 'cmath',
    cat: 'stl',
    tokens: ['sqrt', 'pow', 'abs', 'round', 'floor', 'ceil'],
    match: ['pierwiastek', 'potęga', 'wartość bezwzględna', 'zaokrąglanie', 'matematyka'],
    title: { pl: 'Matematyka: sqrt, pow, abs', en: 'Maths: sqrt, pow, abs' },
    short: { pl: 'Pierwiastek, potęga, wartość bezwzględna, zaokrąglanie.', en: 'Square root, power, absolute value, rounding.' },
    body: {
      pl: 'Wymaga <code>#include &lt;cmath&gt;</code>. <code>pow(2, 10)</code> to 2 do potęgi 10, <code>floor</code> zaokrągla w dół, <code>ceil</code> w górę.',
      en: 'Needs <code>#include &lt;cmath&gt;</code>. <code>pow(2, 10)</code> is 2 to the power of 10, <code>floor</code> rounds down, <code>ceil</code> rounds up.',
    },
    code: '#include <cmath>\ncout << sqrt(16) << endl;  // 4\ncout << pow(2, 10) << endl; // 1024\ncout << abs(-7) << endl;    // 7',
  },
  {
    id: 'rand',
    cat: 'stl',
    tokens: ['rand', 'srand'],
    match: ['losowanie', 'losowa liczba', 'random'],
    title: { pl: 'Losowanie liczb', en: 'Random numbers' },
    short: { pl: 'rand() % 6 + 1 to rzut kostką.', en: 'rand() % 6 + 1 rolls a die.' },
    body: {
      pl: 'Wymaga <code>&lt;cstdlib&gt;</code> i <code>&lt;ctime&gt;</code>. Bez <code>srand(time(0))</code> program losowałby za każdym razem to samo.',
      en: 'Needs <code>&lt;cstdlib&gt;</code> and <code>&lt;ctime&gt;</code>. Without <code>srand(time(0))</code> the program would draw the same numbers every run.',
    },
    code: '#include <cstdlib>\n#include <ctime>\nsrand(time(0));\ncout << rand() % 6 + 1 << endl; // 1..6',
  },

  /* ------------------------------- BŁĘDY --------------------------------- */
  {
    id: 'err-semicolon',
    cat: 'errors',
    tokens: [],
    match: ['expected', 'brak średnika', 'błąd składni'],
    title: { pl: 'Błąd: expected ‘;’', en: 'Error: expected ‘;’' },
    short: { pl: 'Brakuje średnika — najczęściej w linii POWYŻEJ wskazanej.', en: 'A missing semicolon — usually one line ABOVE the one shown.' },
    body: {
      pl: 'Kompilator pokazuje miejsce, w którym <em>zauważył</em> problem, a nie zawsze to, gdzie go popełniłeś. Sprawdź koniec poprzedniej linii.',
      en: 'The compiler points at the place where it <em>noticed</em> the problem, which is not always where you made it. Check the end of the previous line.',
    },
  },
  {
    id: 'err-declared',
    cat: 'errors',
    tokens: [],
    match: ['was not declared', 'nie zadeklarowano', 'undeclared', 'nieznana nazwa'],
    title: { pl: 'Błąd: ‘x’ was not declared in this scope', en: 'Error: ‘x’ was not declared in this scope' },
    short: { pl: 'Używasz nazwy, której kompilator nie zna.', en: 'You use a name the compiler does not know.' },
    body: {
      pl: 'Typowe przyczyny: literówka w nazwie, brak <code>#include</code> (np. <code>&lt;string&gt;</code> przy <code>string</code>), brak <code>using namespace std;</code> albo zmienna utworzona w innym bloku <code>{ }</code>.',
      en: 'Common causes: a typo, a missing <code>#include</code> (e.g. <code>&lt;string&gt;</code> for <code>string</code>), a missing <code>using namespace std;</code>, or a variable created inside a different <code>{ }</code> block.',
    },
  },
  {
    id: 'err-segfault',
    cat: 'errors',
    tokens: [],
    match: ['segmentation fault', 'program się wysypał', 'crash', 'sigsegv'],
    title: { pl: 'Segmentation fault', en: 'Segmentation fault' },
    short: { pl: 'Program sięgnął po pamięć, która do niego nie należy.', en: 'The program touched memory that is not its own.' },
    body: {
      pl: 'Najczęściej: wyjście poza zakres tablicy (<code>t[5]</code> przy <code>int t[5]</code>), ujemny indeks albo nieskończona rekurencja. Sprawdź warunki w pętlach.',
      en: 'Most often: going outside an array (<code>t[5]</code> when you declared <code>int t[5]</code>), a negative index, or endless recursion. Check your loop conditions.',
    },
  },
  {
    id: 'err-infinite',
    cat: 'errors',
    tokens: [],
    match: ['nieskończona pętla', 'program nie kończy', 'time limit', 'infinite loop', 'zawiesza się'],
    title: { pl: 'Program się nie kończy', en: 'The program never ends' },
    short: { pl: 'Najpewniej pętla, której warunek nigdy nie przestaje być prawdziwy.', en: 'Most likely a loop whose condition never becomes false.' },
    body: {
      pl: 'Sprawdź, czy wewnątrz pętli zmienia się to, co jest w warunku (np. <code>i++</code>). Uwaga na średnik po <code>while (...)</code> — tworzy pustą pętlę. Inna częsta przyczyna: program czeka na dane z zakładki <em>Wejście</em>, a tam nic nie ma.',
      en: 'Check that something inside the loop changes what the condition tests (e.g. <code>i++</code>). Watch out for a semicolon right after <code>while (...)</code> — it creates an empty loop. Another common cause: the program waits for data from the <em>Input</em> tab and finds nothing there.',
    },
  },

  /* ------------------------------- PORADY -------------------------------- */
  {
    id: 'tip-debug',
    cat: 'tips',
    tokens: [],
    match: ['debugowanie', 'szukanie błędu', 'debug', 'nie działa'],
    title: { pl: 'Jak szukać błędu w programie?', en: 'How to hunt down a bug?' },
    short: { pl: 'Wypisuj wartości zmiennych przez cout w kilku miejscach.', en: 'Print variable values with cout in a few places.' },
    body: {
      pl: 'Dodaj tymczasowo <code>cout &lt;&lt; "tu jestem, i = " &lt;&lt; i &lt;&lt; endl;</code> w kilku miejscach. Zobaczysz, dokąd program dochodzi i jakie ma wartości — zwykle błąd ujawnia się sam.',
      en: 'Temporarily add <code>cout &lt;&lt; "here, i = " &lt;&lt; i &lt;&lt; endl;</code> in several places. You will see how far the program gets and what the values are — the bug usually shows itself.',
    },
  },
  {
    id: 'tip-style',
    cat: 'tips',
    tokens: [],
    match: ['wcięcia', 'formatowanie', 'czytelność', 'styl'],
    title: { pl: 'Czytelny kod = mniej błędów', en: 'Readable code = fewer bugs' },
    short: { pl: 'Wcięcia i sensowne nazwy zmiennych naprawdę pomagają.', en: 'Indentation and sensible names really help.' },
    body: {
      pl: 'Każdy blok <code>{ }</code> przesuwaj o jedno wcięcie w prawo (Tab). Nazywaj zmienne tak, by było widać, co trzymają (<code>suma</code>, a nie <code>s1</code>). Nauczyciele to doceniają.',
      en: 'Shift every <code>{ }</code> block one indent to the right (Tab). Name variables so their purpose is obvious (<code>sum</code>, not <code>s1</code>). Teachers appreciate it.',
    },
  },
  {
    id: 'tip-input',
    cat: 'tips',
    tokens: [],
    match: ['zakładka wejście', 'program czeka', 'cin nic nie robi'],
    title: { pl: 'Program czeka na dane — co robić?', en: 'The program waits for data — what now?' },
    short: { pl: 'Dane dla cin wpisuje się w zakładce „Wejście” przed uruchomieniem.', en: 'Data for cin goes into the “Input” tab before you run.' },
    body: {
      pl: 'Kompilator online nie ma klawiatury w trakcie działania programu. Wszystkie dane przygotuj wcześniej w zakładce <em>Wejście</em> — każda wartość w osobnej linii. Program przeczyta je po kolei.',
      en: 'An online compiler has no keyboard while the program runs. Prepare all the data beforehand in the <em>Input</em> tab — one value per line. The program reads them in order.',
    },
  },
];

/** Mapa token -> hasło (do podpowiedzi po najechaniu myszką). */
export const TOKEN_INDEX: Record<string, GlossEntry> = (() => {
  const map: Record<string, GlossEntry> = {};
  for (const e of GLOSSARY) for (const tk of e.tokens ?? []) map[tk] = e;
  return map;
})();

/** Proste wyszukiwanie z oceną trafności. */
export function searchGlossary(query: string, lang: Lang, cat: GlossCat | 'all'): GlossEntry[] {
  const q = normalize(query);
  const pool = GLOSSARY.filter((e) => cat === 'all' || e.cat === cat);
  if (!q) return pool;

  const scored = pool
    .map((e) => {
      const title = normalize(e.title[lang]);
      const short = normalize(e.short[lang]);
      const body = normalize(e.body[lang]);
      const keys = [...(e.tokens ?? []), ...(e.match ?? []), e.id].map(normalize);
      let score = 0;
      if (keys.some((k) => k === q)) score += 100;
      if (title.startsWith(q)) score += 60;
      if (keys.some((k) => k.includes(q))) score += 40;
      if (title.includes(q)) score += 30;
      if (short.includes(q)) score += 14;
      if (body.includes(q)) score += 6;
      return { e, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((x) => x.e);
}

/** Usuwa polskie znaki i wielkość liter, żeby „petla” znalazło „pętla”. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .trim();
}

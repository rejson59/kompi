# kompi

**Prosty kompilator C++ online dla uczniów.** Piszesz kod, klikasz „Uruchom”, widzisz wynik —
a gotową pracę wysyłasz nauczycielowi jednym linkiem. Działa w przeglądarce, nic nie trzeba instalować.

🔗 **Strona:** https://rejson59.github.io/kompi/

---

## Co potrafi

| | |
|---|---|
| ▶️ **Uruchamianie kodu** | Prawdziwy `g++` przez darmowe serwery (Piston → Compiler Explorer → Wandbox). Gdy internet nie działa albo szkoła blokuje serwery — automatycznie włącza się **tryb offline** liczony w przeglądarce (podstawy C++). |
| ⌨️ **Edytor** | Kolorowanie składni, numery linii, zwijanie bloków, szukanie (`Ctrl+F`), komentowanie (`Ctrl+/`), podkreślanie błędów kompilatora w kodzie. |
| 💡 **Autouzupełnianie** | Podpowiedzi podczas pisania (zatwierdzasz **Tab**), gotowe wzorce (`for`, `if`, `main`, `cout`…) i nazwy Twoich własnych zmiennych. Można wyłączyć w ustawieniach. |
| 📖 **Słowniczek** | Ikona książki z pytajnikiem. Wpisujesz, czego nie rozumiesz (np. „pętla”, „tablica”, „cout”) i dostajesz krótkie wyjaśnienie prostym językiem + przykład do wklejenia. Działa też po najechaniu myszką na słowo w kodzie. |
| 🧯 **Błędy po ludzku** | Komunikaty `g++` są tłumaczone na zrozumiałe wskazówki („brakuje średnika w linii wyżej”, „dodaj `#include <string>`”). |
| 🎨 **Wygląd** | Ikona pędzla: motyw **jasny / szary / ciemny / ultra ciemny (deep black) / własny** (własne kolory), układ **obok siebie** albo **jeden pod drugim**, zamiana stron, wielkość i krój czcionki. |
| 🌍 **Język** | Pełne PL / EN (interfejs, słowniczek, podpowiedzi, komunikaty błędów). |
| 🔗 **Udostępnianie** | Link z całym kodem (działa zawsze, bez kont) + przycisk „Skróć link”. Możesz dołączyć dane wejściowe, wynik programu i swój podpis (imię i klasa) — nauczyciel zobaczy go na górze strony. |
| ⌨️ **Wejście programu** | Pole „Wejście” nad wynikiem (pokazuje się, gdy program czyta `cin`) — tam wpisujesz dane dla programu. |
| 💾 **Zapamiętywanie** | Kod i ustawienia zostają w przeglądarce po odświeżeniu. Można też pobrać plik `main.cpp` lub wczytać własny. |

## Skróty klawiszowe

| Skrót | Działanie |
|---|---|
| `Ctrl` + `Enter` | uruchom program |
| `Tab` | zatwierdź podpowiedź / wcięcie |
| `Ctrl` + `Space` | pokaż podpowiedzi |
| `Ctrl` + `F` | szukaj w kodzie |
| `Ctrl` + `/` | zakomentuj linię |
| `Ctrl` + `S` | pobierz `main.cpp` |

## Jak udostępnić pracę nauczycielowi

1. Kliknij **Udostępnij**.
2. Wpisz podpis (np. `Jan Kowalski, 2B`) — pojawi się u nauczyciela na górze strony.
3. Skopiuj link (lub kliknij **Skróć link**, żeby był krótszy) i wyślij.

Link zawsze prowadzi na Twoją stronę `rejson59.github.io/kompi/` — cały kod jest zapisany
w samym adresie, więc nie trzeba żadnego serwera ani logowania.

## Publikacja (GitHub Pages)

Strona publikuje się sama: po każdym `push` na gałąź `main` workflow
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) buduje projekt i wrzuca go na GitHub Pages.
W razie potrzeby można go uruchomić ręcznie: **Actions → Deploy na GitHub Pages → Run workflow**.

Jednorazowa konfiguracja w repozytorium: **Settings → Pages → Source: GitHub Actions**.

## Uruchomienie lokalnie (dla ciekawskich)

```bash
npm install
npm run dev      # podgląd na http://localhost:5173
npm run build    # gotowa strona ląduje w katalogu dist/
```

## Jak to działa w środku

- **Frontend:** Vite + TypeScript, edytor [CodeMirror 6](https://codemirror.net/), zero frameworków.
- **Kompilacja online:** publiczne API [Piston](https://github.com/engineer-man/piston),
  [Compiler Explorer](https://godbolt.org/) i [Wandbox](https://wandbox.org/) — próbowane po kolei,
  ostatnio działające idzie na początek listy.
- **Tryb offline:** [JSCPP](https://github.com/felixhao28/JSCPP) uruchamiany w Web Workerze
  (osobny wątek, więc nieskończona pętla nie zawiesza strony). Obsługuje `iostream`, `cmath`,
  `cstring`, `cstdio`, zmienne, tablice, pętle, warunki i funkcje — bez `string`, `vector` i klas.
- **Linki:** kod jest pakowany (LZ-String) do adresu po `#`, więc nigdy nie trafia na żaden serwer.
  „Skróć link” korzysta z darmowych schowków w sieci, a gdy żaden nie działa — zostaje pełny link.

---

### English in short

**kompi** is a small online C++ compiler built for a school class: an editor, an output panel,
Polish/English interface, a plain-language glossary (book icon), Tab autocompletion, themes
(light / gray / dark / deep black / custom), a horizontal or vertical layout, and one-link sharing
of your work. It is a static site hosted on GitHub Pages; code is compiled by free public
`g++` services, with an in-browser fallback when the network is unavailable.

MIT © rejson59

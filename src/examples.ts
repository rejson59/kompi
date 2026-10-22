/* Gotowe przykłady do wstawienia jednym kliknięciem. */

import type { Lang } from './state';

export interface Example {
  id: string;
  title: Record<Lang, string>;
  code: string;
  stdin?: string;
}

export const EXAMPLES: Example[] = [
  {
    id: 'hello',
    title: { pl: 'Pierwszy program', en: 'First program' },
    code: `#include <iostream>
using namespace std;

int main() {
    cout << "Czesc, swiecie!" << endl;
    return 0;
}
`,
  },
  {
    id: 'suma',
    title: { pl: 'Suma dwóch liczb (cin)', en: 'Sum of two numbers (cin)' },
    code: `#include <iostream>
using namespace std;

int main() {
    int a, b;
    cout << "Podaj dwie liczby:" << endl;
    cin >> a >> b;
    cout << "Suma: " << a + b << endl;
    cout << "Roznica: " << a - b << endl;
    return 0;
}
`,
    stdin: '12\n8\n',
  },
  {
    id: 'parzysta',
    title: { pl: 'Parzysta czy nieparzysta?', en: 'Even or odd?' },
    code: `#include <iostream>
using namespace std;

int main() {
    int n;
    cin >> n;

    if (n % 2 == 0) {
        cout << n << " jest parzysta" << endl;
    } else {
        cout << n << " jest nieparzysta" << endl;
    }
    return 0;
}
`,
    stdin: '7\n',
  },
  {
    id: 'petla',
    title: { pl: 'Pętla: tabliczka mnożenia', en: 'Loop: multiplication table' },
    code: `#include <iostream>
using namespace std;

int main() {
    int n = 5;
    for (int i = 1; i <= 10; i++) {
        cout << n << " x " << i << " = " << n * i << endl;
    }
    return 0;
}
`,
  },
  {
    id: 'tablica',
    title: { pl: 'Tablica i średnia', en: 'Array and average' },
    code: `#include <iostream>
using namespace std;

int main() {
    int oceny[5] = {4, 5, 3, 5, 4};
    int suma = 0;

    for (int i = 0; i < 5; i++) {
        suma += oceny[i];
    }

    cout << "Suma ocen: " << suma << endl;
    cout << "Srednia: " << (double)suma / 5 << endl;
    return 0;
}
`,
  },
  {
    id: 'funkcja',
    title: { pl: 'Własna funkcja', en: 'Your own function' },
    code: `#include <iostream>
using namespace std;

int wiekszy(int a, int b) {
    if (a > b) return a;
    return b;
}

int main() {
    cout << wiekszy(3, 9) << endl;
    cout << wiekszy(12, 7) << endl;
    return 0;
}
`,
  },
  {
    id: 'gwiazdki',
    title: { pl: 'Choinka z gwiazdek', en: 'Star triangle' },
    code: `#include <iostream>
using namespace std;

int main() {
    int wysokosc = 5;

    for (int i = 1; i <= wysokosc; i++) {
        for (int j = 0; j < i; j++) {
            cout << "*";
        }
        cout << endl;
    }
    return 0;
}
`,
  },
  {
    id: 'tekst',
    title: { pl: 'Tekst (string)', en: 'Text (string)' },
    code: `#include <iostream>
#include <string>
using namespace std;

int main() {
    string imie;
    cout << "Jak masz na imie?" << endl;
    getline(cin, imie);

    cout << "Czesc, " << imie << "!" << endl;
    cout << "Twoje imie ma " << imie.length() << " liter." << endl;
    return 0;
}
`,
    stdin: 'Ania\n',
  },
  {
    id: 'sortowanie',
    title: { pl: 'Sortowanie liczb', en: 'Sorting numbers' },
    code: `#include <iostream>
#include <algorithm>
using namespace std;

int main() {
    int t[6] = {7, 2, 9, 1, 5, 3};
    sort(t, t + 6);

    for (int i = 0; i < 6; i++) {
        cout << t[i] << " ";
    }
    cout << endl;
    return 0;
}
`,
  },
  {
    id: 'kostka',
    title: { pl: 'Rzut kostką (losowanie)', en: 'Dice roll (random)' },
    code: `#include <iostream>
#include <cstdlib>
#include <ctime>
using namespace std;

int main() {
    srand(time(0));

    for (int i = 1; i <= 5; i++) {
        cout << "Rzut " << i << ": " << rand() % 6 + 1 << endl;
    }
    return 0;
}
`,
  },
];

export const DEFAULT_CODE = EXAMPLES[0].code;

/** Domyślny kod dla języka PHP (znacznik <?php może być na początku —
    silnik online dopisze go sam, gdy go brakuje). */
export const DEFAULT_PHP_CODE = `<?php
// Mój pierwszy program w PHP
echo "Cześć, ze świata PHP!\\n";

$imie = "Ania";
$wiek = 15;
echo "Nazywam się $imie i mam $wiek lat.\\n";
`;

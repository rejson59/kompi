/// <reference lib="webworker" />
/* Lokalny silnik C++ (JSCPP) w osobnym wątku — rozszerzony o obsługę:
   - <string>, <vector>, <algorithm>, <bits/stdc++.h>, <climits>, <cmath>, <cstdlib>, <ctime>, <iomanip>,
   - struktur (struct), przedrostka std::, nullptr, size_t, int64_t, auto oraz sufiksów LL/ULL. */

interface RunMsg {
  code: string;
  stdin: string;
  maxTimeout: number;
}

interface ParsedStructField {
  name: string;
  type: string;
}

interface ParsedStruct {
  name: string;
  fields: ParsedStructField[];
}

let activeUserStructs: ParsedStruct[] = [];

/**
 * Zamienia zachowanie JSCPP bliższe prawdziwemu C++:
 * - niezainicjalizowana zmienna liczbowa dostaje 0 zamiast NaN (NaN psuł potem działania),
 * - dzielenie całkowite ucina w stronę zera (jak w C++), a nie w dół,
 * - brak danych wejściowych nie wysadza programu.
 */
function patchRuntimeSemantics(rt: any): void {
  if (rt._kompiSemanticsPatched) return;
  rt._kompiSemanticsPatched = true;
  const origVal = rt.val.bind(rt);
  rt.val = function (t: any, v: any, left?: boolean, isInitializing?: boolean) {
    if (t && t.type === 'primitive' && typeof v === 'number' && Number.isNaN(v)) v = 0;
    return origVal(t, v, left, isInitializing);
  };
  // W C++ iloraz dwóch całkowitych ucina ułamek w stronę zera: -160/9 == -17 (nie -18)
  for (const sig of Object.keys(rt.types)) {
    const div = rt.types[sig]?.handlers?.['o(/)'];
    if (!div || typeof div.default !== 'function' || div._kompiTruncDiv) continue;
    const origDiv = div.default;
    div.default = function (rtInst: any, l: any, r: any) {
      if (l && r && rtInst.isIntegerType(l.t) && rtInst.isIntegerType(r.t) && Number(r.v) !== 0) {
        const q = Math.trunc(rtInst.booleanToNumber(l.v) / rtInst.booleanToNumber(r.v));
        return rtInst.val(rtInst.promoteNumeric(l.t, r.t), q);
      }
      return origDiv(rtInst, l, r);
    };
    div._kompiTruncDiv = true;
  }
}

/**
 * Zamienia konstrukcje C++ nieobsługiwane bezpośrednio przez parser PEG w JSCPP
 * na równoważny kod z zachowaniem dokładnej numeracji linii (1:1).
 */
function preprocessCppForJscpp(rawCode: string): { code: string; structs: ParsedStruct[] } {
  const structs: ParsedStruct[] = [];

  // 1. Wyciągnij definicje struct Nazwa { ... }; z zachowaniem liczby linii
  const codeWithoutStructs = rawCode.replace(
    /\bstruct\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*?)\}\s*;/g,
    (fullMatch, structName: string, body: string) => {
      const fields: ParsedStructField[] = [];
      const cleanBody = body.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const stmt of cleanBody.split(';')) {
        const trimmed = stmt.trim();
        if (!trimmed) continue;
        const m = trimmed.match(
          /^(?:std::)?(long\s+long|unsigned\s+int|int|double|float|char|bool|long|short|string)\s+(.+)$/,
        );
        if (m) {
          const fType = m[1].replace(/\s+/g, ' ');
          for (const part of m[2].split(',')) {
            const eqIdx = part.indexOf('=');
            const varName = (eqIdx >= 0 ? part.slice(0, eqIdx) : part).trim();
            if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(varName)) {
              fields.push({ name: varName, type: fType });
            }
          }
        }
      }
      if (fields.length > 0) {
        structs.push({ name: structName, fields });
        // Zachowaj dokładnie tyle samo znaków nowej linii, żeby numery linii błędów się zgadzały
        return fullMatch.replace(/[^\n]/g, ' ');
      }
      return fullMatch;
    },
  );

  // 2. Przetwarzanie linia po linii (poza napisami i komentarzami)
  const lines = codeWithoutStructs.split('\n');
  let inBlockComment = false;

  const transformedLines = lines.map((line) => {
    let codePart = '';
    const literals: string[] = [];
    let i = 0;

    while (i < line.length) {
      const c = line[i];
      const next = line[i + 1];

      if (inBlockComment) {
        if (c === '*' && next === '/') {
          inBlockComment = false;
          codePart += '  ';
          i += 2;
        } else {
          codePart += ' ';
          i++;
        }
        continue;
      }

      if (c === '/' && next === '/') {
        // Komentarz jednoliniowy do końca linii
        break;
      }
      if (c === '/' && next === '*') {
        inBlockComment = true;
        codePart += '  ';
        i += 2;
        continue;
      }

      if (c === '"' || c === "'") {
        const quote = c;
        let lit = c;
        i++;
        while (i < line.length) {
          const ch = line[i];
          lit += ch;
          if (ch === '\\' && i + 1 < line.length) {
            i++;
            lit += line[i];
          } else if (ch === quote) {
            i++;
            break;
          }
          i++;
        }
        const idx = literals.length;
        literals.push(lit);
        codePart += `__KOMPI_LIT_${idx}__`;
        continue;
      }

      codePart += c;
      i++;
    }

    // Jeśli to dyrektywa preprocesora (#include, #define), zostawiamy oryginał
    if (/^\s*#/.test(codePart)) {
      return line;
    }

    let s = codePart;

    // Usuń przedrostek std:: (np. std::cout, std::vector, std::string, std::endl)
    s = s.replace(/\bstd\s*::\s*/g, '');

    // Stała string::npos
    s = s.replace(/\bstring\s*::\s*npos\b/g, '-1');

    // nullptr -> 0
    s = s.replace(/\bnullptr\b/g, '0');

    // Aliasy typów całkowitych
    s = s.replace(/\bsize_t\b/g, 'unsigned int');
    s = s.replace(/\buint64_t\b/g, 'unsigned long long');
    s = s.replace(/\bint64_t\b/g, 'long long');
    s = s.replace(/\buint32_t\b/g, 'unsigned int');
    s = s.replace(/\bint32_t\b/g, 'int');
    s = s.replace(/\buint16_t\b/g, 'unsigned short');
    s = s.replace(/\bint16_t\b/g, 'short');

    // Sufiksy liczbowe LL / ULL / UL / L (np. 10000000000LL -> 10000000000)
    s = s.replace(/\b(\d+)[uU]?[lL]{1,2}\b/g, '$1');

    // Zamiana vector<T> na klasy obsługiwane przez nasz runtime
    s = s.replace(/\bvector\s*<\s*(?:long\s+long|long|int64_t)\s*>/g, '__vec_long');
    s = s.replace(/\bvector\s*<\s*(?:int|unsigned\s+int|unsigned|short|size_t)\s*>/g, '__vec_int');
    s = s.replace(/\bvector\s*<\s*(?:double|long\s+double)\s*>/g, '__vec_double');
    s = s.replace(/\bvector\s*<\s*float\s*>/g, '__vec_float');
    s = s.replace(/\bvector\s*<\s*char\s*>/g, '__vec_char');
    s = s.replace(/\bvector\s*<\s*bool\s*>/g, '__vec_bool');
    s = s.replace(/\bvector\s*<\s*string\s*>/g, '__vec_string');

    // Obsługa inicjalizacji: __vec_T v = {a, b, c}; lub __vec_T v{a, b, c};
    s = s.replace(
      /\b(__vec_[a-z]+)\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:=\s*)?\{([^}]*)\}\s*;/g,
      (_m, vecType: string, varName: string, itemsRaw: string) => {
        const items = itemsRaw
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
        const pushes = items.map((it) => `${varName}.push_back(${it});`).join(' ');
        return `${vecType} ${varName}; ${pushes}`;
      },
    );

    // Obsługa konstruktora: __vec_T v(n); lub __vec_T v(n, val);
    s = s.replace(
      /\b(__vec_[a-z]+)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]+)\)\s*;/g,
      (_m, vecType: string, varName: string, argsRaw: string) => {
        return `${vecType} ${varName}; ${varName}.resize(${argsRaw});`;
      },
    );

    // Prosta dedukcja typu dla `auto x = ...;`
    s = s.replace(/^(\s*)auto\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^;]+);/, (_m, indent: string, name: string, expr: string) => {
      const trimmedExpr = expr.trim();
      let inferred = 'int';
      if (/^__KOMPI_LIT_\d+__$/.test(trimmedExpr)) {
        const litIdx = Number(trimmedExpr.replace(/\D+/g, ''));
        const litVal = literals[litIdx] ?? '';
        inferred = litVal.startsWith('"') ? 'string' : 'char';
      } else if (/^(?:true|false)\b/.test(trimmedExpr)) {
        inferred = 'bool';
      } else if (/\d+\.\d+/.test(trimmedExpr)) {
        inferred = 'double';
      }
      return `${indent}${inferred} ${name} = ${expr};`;
    });

    // Przywróć literały znakowe i napisowe
    s = s.replace(/__KOMPI_LIT_(\d+)__/g, (_m, idxStr: string) => literals[Number(idxStr)] ?? '');

    return s;
  });

  return { code: transformedLines.join('\n'), structs };
}

function registerVectorClass(rt: any, className: string, elemType: any, defaultValFactory: (rtInst: any) => any): void {
  const ptrT = rt.normalPointerType(elemType);
  const vecT = rt.newClass(className, [
    {
      name: '_arr',
      type: ptrT,
      initialize() {
        return { t: ptrT, v: { target: [], position: 0 }, left: false };
      },
    },
  ]);
  const sig = rt.getTypeSignature(vecT);
  rt.types[sig].father = 'object';

  const getArr = (_this: any): any[] => {
    if (!_this.v.members._arr.v.target) {
      _this.v.members._arr.v.target = [];
    }
    return _this.v.members._arr.v.target;
  };

  const cloneElem = (_rt: any, x: any) => {
    if (!x) return defaultValFactory(_rt);
    if (elemType.type === 'class' && elemType.name === 'string') {
      const cloned = defaultValFactory(_rt);
      const str =
        x.v && x.v.members && x.v.members._str
          ? _rt.getStringFromCharArray(x.v.members._str)
          : _rt.isStringType(x.t)
            ? _rt.getStringFromCharArray(x)
            : '';
      cloned.v._raw = str;
      cloned.v.members._str = _rt.makeCharArrayFromString(str);
      return cloned;
    }
    return _rt.val(elemType, x.v, true);
  };

  rt.regFunc(
    (_rt: any, _this: any, x: any) => {
      getArr(_this).push(cloneElem(_rt, x));
    },
    vecT,
    'push_back',
    ['?'],
    rt.voidTypeLiteral,
  );

  rt.regFunc(
    (_rt: any, _this: any) => {
      getArr(_this).pop();
    },
    vecT,
    'pop_back',
    [],
    rt.voidTypeLiteral,
  );

  const sizeFn = (_rt: any, _this: any) => _rt.val(_rt.intTypeLiteral, getArr(_this).length);
  rt.regFunc(sizeFn, vecT, 'size', [], rt.intTypeLiteral);
  rt.regFunc(sizeFn, vecT, 'length', [], rt.intTypeLiteral);

  rt.regFunc(
    (_rt: any, _this: any) => _rt.val(_rt.boolTypeLiteral, getArr(_this).length === 0 ? 1 : 0),
    vecT,
    'empty',
    [],
    rt.boolTypeLiteral,
  );

  rt.regFunc(
    (_rt: any, _this: any) => {
      _this.v.members._arr.v.target = [];
    },
    vecT,
    'clear',
    [],
    rt.voidTypeLiteral,
  );

  rt.regFunc(
    (_rt: any, _this: any, nVal: any, fillVal: any) => {
      const arr = getArr(_this);
      const n = nVal ? Number(nVal.v) || 0 : 0;
      while (arr.length < n) {
        arr.push(fillVal ? cloneElem(_rt, fillVal) : defaultValFactory(_rt));
      }
      if (arr.length > n) arr.length = n;
    },
    vecT,
    'resize',
    ['?'],
    rt.voidTypeLiteral,
  );

  const indexAccess = (_rt: any, _this: any, idxVal: any) => {
    const arr = getArr(_this);
    const idx = idxVal ? Number(idxVal.v) || 0 : 0;
    while (arr.length <= idx) {
      arr.push(defaultValFactory(_rt));
    }
    arr[idx].left = true;
    return arr[idx];
  };

  rt.regFunc(indexAccess, vecT, 'at', ['?'], elemType);
  rt.regOperator(indexAccess, vecT, '[]', [rt.intTypeLiteral], elemType);
  rt.types[sig].handlers['o([])'].default = indexAccess;

  rt.regFunc(
    (_rt: any, _this: any) => {
      const arr = getArr(_this);
      if (arr.length === 0) arr.push(defaultValFactory(_rt));
      arr[0].left = true;
      return arr[0];
    },
    vecT,
    'front',
    [],
    elemType,
  );

  rt.regFunc(
    (_rt: any, _this: any) => {
      const arr = getArr(_this);
      if (arr.length === 0) arr.push(defaultValFactory(_rt));
      const last = arr[arr.length - 1];
      last.left = true;
      return last;
    },
    vecT,
    'back',
    [],
    elemType,
  );

  rt.regFunc(
    (_rt: any, _this: any) => ({ t: ptrT, v: { target: getArr(_this), position: 0 }, left: false }),
    vecT,
    'begin',
    [],
    ptrT,
  );

  rt.regFunc(
    (_rt: any, _this: any) => {
      const arr = getArr(_this);
      return { t: ptrT, v: { target: arr, position: arr.length }, left: false };
    },
    vecT,
    'end',
    [],
    ptrT,
  );
}

function registerStandardLibraries(JSCPP: any): void {
  if (JSCPP._kompiPatched) return;
  JSCPP._kompiPatched = true;

  const stringInclude = {
    load(rt: any) {
      patchRuntimeSemantics(rt);
      if (!rt.config.loadedLibraries.includes('iostream')) {
        rt.include('iostream');
      }
      const pchar = rt.normalPointerType(rt.charTypeLiteral);
      const strType = rt.newClass('string', [
        {
          name: '_str',
          type: pchar,
          initialize(rtInstance: any) {
            return rtInstance.makeCharArrayFromString('');
          },
        },
      ]);
      const sig = rt.getTypeSignature(strType);
      rt.types[sig].father = 'object';

      const getStr = (s: any): string => {
        if (!s || !s.v) return '';
        if (s.v.members && s.v.members._str) return rt.getStringFromCharArray(s.v.members._str);
        if (typeof s.v._raw === 'string') return s.v._raw;
        if (rt.isStringType(s.t)) return rt.getStringFromCharArray(s);
        if (s.t && rt.isCharType && rt.isCharType(s.t)) return String.fromCharCode(s.v);
        return '';
      };

      const makeStrVal = (text: string, left = false) => {
        const val = rt.defaultValue(strType, left);
        const clean = String(text);
        val.v._raw = clean;
        val.v.members._str = rt.makeCharArrayFromString(clean);
        return val;
      };

      const setStr = (target: any, text: string) => {
        const clean = String(text);
        target.v._raw = clean;
        target.v.members._str = rt.makeCharArrayFromString(clean);
        return target;
      };

      const origCast = rt.cast.bind(rt);
      rt.cast = function (type: any, value: any) {
        if (type && type.type === 'class' && type.name === 'string') {
          if (value && value.t && value.t.type === 'class' && value.t.name === 'string') {
            return makeStrVal(getStr(value), value.left);
          }
          if (value && rt.isStringType(value.t)) {
            return makeStrVal(rt.getStringFromCharArray(value));
          }
        }
        return origCast(type, value);
      };

      const _len = (_rt: any, _this: any) => rt.val(rt.intTypeLiteral, getStr(_this).length);
      rt.regFunc(_len, strType, 'length', [], rt.intTypeLiteral);
      rt.regFunc(_len, strType, 'size', [], rt.intTypeLiteral);
      rt.regFunc(
        (_rt: any, _this: any) => rt.val(rt.boolTypeLiteral, getStr(_this).length === 0 ? 1 : 0),
        strType,
        'empty',
        [],
        rt.boolTypeLiteral,
      );
      rt.regFunc((_rt: any, _this: any) => setStr(_this, ''), strType, 'clear', [], rt.voidTypeLiteral);
      rt.regFunc((_rt: any, _this: any) => rt.makeCharArrayFromString(getStr(_this)), strType, 'c_str', [], pchar);

      // substr(pos) i substr(pos, count) — z podpisem ['?'] działa dla int i unsigned int
      rt.regFunc(
        (_rt: any, _this: any, pos: any, count: any) => {
          const s = getStr(_this);
          const p = pos ? Number(pos.v) || 0 : 0;
          const c = count !== undefined ? Number(count.v) : s.length;
          return makeStrVal(s.substr(p, c));
        },
        strType,
        'substr',
        ['?'],
        strType,
      );

      // find(sub, pos = 0)
      rt.regFunc(
        (_rt: any, _this: any, sub: any, pos: any) => {
          const s = getStr(_this);
          const needle = getStr(sub);
          const from = pos ? Number(pos.v) || 0 : 0;
          return rt.val(rt.intTypeLiteral, s.indexOf(needle, from));
        },
        strType,
        'find',
        ['?'],
        rt.intTypeLiteral,
      );

      // push_back(char) / pop_back() / front() / back()
      rt.regFunc(
        (_rt: any, _this: any, ch: any) => {
          const cur = getStr(_this);
          const add = ch && typeof ch.v === 'number' ? String.fromCharCode(ch.v) : getStr(ch);
          setStr(_this, cur + add);
        },
        strType,
        'push_back',
        ['?'],
        rt.voidTypeLiteral,
      );

      rt.regFunc(
        (_rt: any, _this: any) => {
          const cur = getStr(_this);
          setStr(_this, cur.slice(0, -1));
        },
        strType,
        'pop_back',
        [],
        rt.voidTypeLiteral,
      );

      // erase(pos, len) / insert(pos, str) / replace(pos, len, str)
      rt.regFunc(
        (_rt: any, _this: any, pos: any, len: any) => {
          const cur = getStr(_this);
          const p = pos ? Number(pos.v) || 0 : 0;
          const l = len !== undefined ? Number(len.v) : cur.length - p;
          return setStr(_this, cur.slice(0, p) + cur.slice(p + l));
        },
        strType,
        'erase',
        ['?'],
        strType,
      );

      rt.regFunc(
        (_rt: any, _this: any, pos: any, sub: any) => {
          const cur = getStr(_this);
          const p = pos ? Number(pos.v) || 0 : 0;
          const ins = getStr(sub);
          return setStr(_this, cur.slice(0, p) + ins + cur.slice(p));
        },
        strType,
        'insert',
        ['?'],
        strType,
      );

      rt.regFunc(
        (_rt: any, _this: any, pos: any, len: any, sub: any) => {
          const cur = getStr(_this);
          const p = pos ? Number(pos.v) || 0 : 0;
          const l = len ? Number(len.v) || 0 : 0;
          const rep = getStr(sub);
          return setStr(_this, cur.slice(0, p) + rep + cur.slice(p + l));
        },
        strType,
        'replace',
        ['?'],
        strType,
      );

      // begin() / end() dla sort(s.begin(), s.end()) oraz reverse(s.begin(), s.end())
      rt.regFunc(
        (_rt: any, _this: any) => ({
          t: pchar,
          v: { target: _this.v.members._str.v.target, position: 0 },
          left: false,
        }),
        strType,
        'begin',
        [],
        pchar,
      );
      rt.regFunc(
        (_rt: any, _this: any) => {
          const len = getStr(_this).length;
          return {
            t: pchar,
            v: { target: _this.v.members._str.v.target, position: len },
            left: false,
          };
        },
        strType,
        'end',
        [],
        pchar,
      );

      // Indeksowanie s[i] oraz s.at(i) — obsługuje zarówno odczyt, jak i zapis (np. s[0] = 'A')
      const charAtRef = (_rt: any, l: any, r: any) => {
        const arr = l.v.members._str.v.target;
        const idx = r ? Number(r.v) || 0 : 0;
        if (idx >= 0 && idx < arr.length) {
          arr[idx].left = true;
          return arr[idx];
        }
        return rt.val(rt.charTypeLiteral, 0, true);
      };
      rt.regFunc(charAtRef, strType, 'at', ['?'], rt.charTypeLiteral);
      rt.regOperator(charAtRef, strType, '[]', [rt.intTypeLiteral], rt.charTypeLiteral);
      rt.types[sig].handlers['o([])'].default = charAtRef;

      rt.regFunc(
        (_rt: any, _this: any) => charAtRef(_rt, _this, { v: 0 }),
        strType,
        'front',
        [],
        rt.charTypeLiteral,
      );
      rt.regFunc(
        (_rt: any, _this: any) => {
          const len = getStr(_this).length;
          return charAtRef(_rt, _this, { v: Math.max(0, len - 1) });
        },
        strType,
        'back',
        [],
        rt.charTypeLiteral,
      );

      // Operatory dla klasy string (z obsługą .default dla dowolnych typów tekstowych/znakowych)
      const assignOp = (_rt: any, l: any, r: any) => setStr(l, getStr(r));
      rt.regOperator(assignOp, strType, '=', [strType], strType);
      rt.types[sig].handlers['o(=)'].default = assignOp;

      const plusOp = (_rt: any, l: any, r: any) => makeStrVal(getStr(l) + getStr(r));
      rt.regOperator(plusOp, strType, '+', [strType], strType);
      rt.types[sig].handlers['o(+)'].default = plusOp;

      const plusEqOp = (_rt: any, l: any, r: any) => setStr(l, getStr(l) + getStr(r));
      rt.regOperator(plusEqOp, strType, '+=', [strType], strType);
      rt.types[sig].handlers['o(+=)'].default = plusEqOp;

      const eqOp = (_rt: any, l: any, r: any) => rt.val(rt.boolTypeLiteral, getStr(l) === getStr(r) ? 1 : 0);
      rt.regOperator(eqOp, strType, '==', [strType], rt.boolTypeLiteral);
      rt.types[sig].handlers['o(==)'].default = eqOp;

      const neqOp = (_rt: any, l: any, r: any) => rt.val(rt.boolTypeLiteral, getStr(l) !== getStr(r) ? 1 : 0);
      rt.regOperator(neqOp, strType, '!=', [strType], rt.boolTypeLiteral);
      rt.types[sig].handlers['o(!=)'].default = neqOp;

      const ltOp = (_rt: any, l: any, r: any) => rt.val(rt.boolTypeLiteral, getStr(l) < getStr(r) ? 1 : 0);
      rt.regOperator(ltOp, strType, '<', [strType], rt.boolTypeLiteral);
      rt.types[sig].handlers['o(<)'].default = ltOp;

      const gtOp = (_rt: any, l: any, r: any) => rt.val(rt.boolTypeLiteral, getStr(l) > getStr(r) ? 1 : 0);
      rt.regOperator(gtOp, strType, '>', [strType], rt.boolTypeLiteral);
      rt.types[sig].handlers['o(>)'].default = gtOp;

      const lteOp = (_rt: any, l: any, r: any) => rt.val(rt.boolTypeLiteral, getStr(l) <= getStr(r) ? 1 : 0);
      rt.regOperator(lteOp, strType, '<=', [strType], rt.boolTypeLiteral);
      rt.types[sig].handlers['o(<=)'].default = lteOp;

      const gteOp = (_rt: any, l: any, r: any) => rt.val(rt.boolTypeLiteral, getStr(l) >= getStr(r) ? 1 : 0);
      rt.regOperator(gteOp, strType, '>=', [strType], rt.boolTypeLiteral);
      rt.types[sig].handlers['o(>=)'].default = gteOp;

      // Funkcje konwersji to_string / stoi / stod / stoll
      rt.regFunc(
        (_rt: any, _this: any, n: any) => makeStrVal(String(n ? n.v : '')),
        'global',
        'to_string',
        ['?'],
        strType,
      );
      rt.regFunc(
        (_rt: any, _this: any, s: any) => rt.val(rt.intTypeLiteral, parseInt(getStr(s), 10) || 0),
        'global',
        'stoi',
        ['?'],
        rt.intTypeLiteral,
      );
      rt.regFunc(
        (_rt: any, _this: any, s: any) => rt.val(rt.longTypeLiteral, parseInt(getStr(s), 10) || 0),
        'global',
        'stoll',
        ['?'],
        rt.longTypeLiteral,
      );
      rt.regFunc(
        (_rt: any, _this: any, s: any) => rt.val(rt.doubleTypeLiteral, parseFloat(getStr(s)) || 0),
        'global',
        'stod',
        ['?'],
        rt.doubleTypeLiteral,
      );

      // Obsługa cout << string
      const cout = rt.scope[0].variables['cout'];
      if (cout) {
        const coutSig = rt.getTypeSignature(cout.t);
        const origLeftShift = rt.types[coutSig].handlers['o(<<)'].default;
        rt.types[coutSig].handlers['o(<<)'].default = function (rtInst: any, _cout: any, t: any) {
          if (t && t.t && t.t.type === 'class' && t.t.name === 'string') {
            _cout.v.ostream.write(getStr(t));
            return _cout;
          }
          return origLeftShift(rtInst, _cout, t);
        };
      }

      // Obsługa cin >> string oraz getline(cin, string)
      const cin = rt.scope[0].variables['cin'];
      if (cin) {
        const cinSig = rt.getTypeSignature(cin.t);
        const origRightShift = rt.types[cinSig].handlers['o(>>)'].default;
        // Brak danych w Wejściu albo zły format nie przerywają programu —
        // zmienna dostaje 0 (jak w C++11 przy nieudanej konwersji) i program leci dalej.
        const zeroFill = (target: any) => {
          if (!target || !target.t) return;
          if (target.t.name === 'bool') target.v = false;
          else target.v = 0;
        };
        rt.types[cinSig].handlers['o(>>)'].default = function (rtInst: any, _cin: any, t: any) {
          if (t && t.t && t.t.type === 'class' && t.t.name === 'string') {
            const b = (_cin.v.buf || '').replace(/^\s+/, '');
            const m = /^\S*/.exec(b);
            const word = m ? m[0] : '';
            _cin.v.buf = b.slice(word.length);
            setStr(t, word);
            return _cin;
          }
          try {
            const res = origRightShift(rtInst, _cin, t);
            if (_cin.v && _cin.v.failbit) zeroFill(t);
            else if (t && typeof t.v === 'number' && Number.isNaN(t.v)) zeroFill(t);
            return res;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (/input format mismatch/i.test(msg)) {
              if (_cin.v) _cin.v.failbit = true;
              zeroFill(t);
              return _cin;
            }
            throw err;
          }
        };

        rt.regFunc(
          function (_rtInst: any, _this: any, _cin: any, s: any) {
            const b = _cin.v.buf || '';
            const nlIdx = b.indexOf('\n');
            let line = nlIdx >= 0 ? b.slice(0, nlIdx) : b;
            if (line.endsWith('\r')) line = line.slice(0, -1);
            _cin.v.buf = nlIdx >= 0 ? b.slice(nlIdx + 1) : '';
            setStr(s, line);
            return _cin;
          },
          'global',
          'getline',
          ['?'],
          cin.t,
        );
      }

      // Rejestracja klas vector<T>
      registerVectorClass(rt, '__vec_int', rt.intTypeLiteral, (r) => r.val(r.intTypeLiteral, 0, true));
      registerVectorClass(rt, '__vec_long', rt.primitiveType('long long'), (r) =>
        r.val(r.primitiveType('long long'), 0, true),
      );
      registerVectorClass(rt, '__vec_double', rt.doubleTypeLiteral, (r) => r.val(r.doubleTypeLiteral, 0, true));
      registerVectorClass(rt, '__vec_float', rt.floatTypeLiteral, (r) => r.val(r.floatTypeLiteral, 0, true));
      registerVectorClass(rt, '__vec_char', rt.charTypeLiteral, (r) => r.val(r.charTypeLiteral, 0, true));
      registerVectorClass(rt, '__vec_bool', rt.boolTypeLiteral, (r) => r.val(r.boolTypeLiteral, 0, true));
      registerVectorClass(rt, '__vec_string', strType, () => makeStrVal('', true));

      // Rejestracja struktur zdefiniowanych przez użytkownika (struct Nazwa { ... };)
      const resolveFieldType = (typeName: string) => {
        switch (typeName) {
          case 'double':
            return {
              t: rt.doubleTypeLiteral,
              init: (r: any) => r.val(r.doubleTypeLiteral, 0, true),
            };
          case 'float':
            return {
              t: rt.floatTypeLiteral,
              init: (r: any) => r.val(r.floatTypeLiteral, 0, true),
            };
          case 'char':
            return {
              t: rt.charTypeLiteral,
              init: (r: any) => r.val(r.charTypeLiteral, 0, true),
            };
          case 'bool':
            return {
              t: rt.boolTypeLiteral,
              init: (r: any) => r.val(r.boolTypeLiteral, 0, true),
            };
          case 'long long':
          case 'long':
            return {
              t: rt.primitiveType('long long'),
              init: (r: any) => r.val(r.primitiveType('long long'), 0, true),
            };
          case 'string':
            return {
              t: strType,
              init: () => makeStrVal('', true),
            };
          default:
            return {
              t: rt.intTypeLiteral,
              init: (r: any) => r.val(r.intTypeLiteral, 0, true),
            };
        }
      };

      for (const st of activeUserStructs) {
        const members = st.fields.map((f) => {
          const resolved = resolveFieldType(f.type);
          return {
            name: f.name,
            type: resolved.t,
            initialize(rtInst: any) {
              return resolved.init(rtInst);
            },
          };
        });
        const stType = rt.newClass(st.name, members);
        const stSig = rt.getTypeSignature(stType);
        rt.types[stSig].father = 'object';
      }
    },
  };

  const algorithmInclude = {
    load(rt: any) {
      patchRuntimeSemantics(rt);
      rt.regFunc(
        (_rt: any, _this: any, first: any, last: any) => {
          if (first && first.v && Array.isArray(first.v.target)) {
            const arr = first.v.target;
            const start = first.v.position || 0;
            const end = last && last.v && typeof last.v.position === 'number' ? last.v.position : arr.length;
            const slice = arr.slice(start, end);
            slice.sort((a: any, b: any) => {
              if (a.v && a.v.members && a.v.members._str && b.v && b.v.members && b.v.members._str) {
                const sa = _rt.getStringFromCharArray(a.v.members._str);
                const sb = _rt.getStringFromCharArray(b.v.members._str);
                return sa < sb ? -1 : sa > sb ? 1 : 0;
              }
              return (Number(a.v) || 0) - (Number(b.v) || 0);
            });
            const vals = slice.map((x: any) => ({ v: x.v, t: x.t }));
            for (let i = 0; i < vals.length; i++) {
              arr[start + i].v = vals[i].v;
            }
          }
        },
        'global',
        'sort',
        ['?'],
        rt.voidTypeLiteral,
      );

      rt.regFunc(
        (_rt: any, _this: any, first: any, last: any) => {
          if (first && first.v && Array.isArray(first.v.target)) {
            const arr = first.v.target;
            const start = first.v.position || 0;
            const end = last && last.v && typeof last.v.position === 'number' ? last.v.position : arr.length;
            const vals = arr
              .slice(start, end)
              .map((x: any) => x.v)
              .reverse();
            for (let i = 0; i < vals.length; i++) {
              arr[start + i].v = vals[i];
            }
          }
        },
        'global',
        'reverse',
        ['?'],
        rt.voidTypeLiteral,
      );

      rt.regFunc(
        (_rt: any, _this: any, a: any, b: any) => (a.v <= b.v ? a : b),
        'global',
        'min',
        ['?'],
        rt.doubleTypeLiteral,
      );
      rt.regFunc(
        (_rt: any, _this: any, a: any, b: any) => (a.v >= b.v ? a : b),
        'global',
        'max',
        ['?'],
        rt.doubleTypeLiteral,
      );
      rt.regFunc(
        (_rt: any, _this: any, a: any, b: any) => {
          const tmp = a.v;
          a.v = b.v;
          b.v = tmp;
        },
        'global',
        'swap',
        ['?'],
        rt.voidTypeLiteral,
      );
    },
  };

  const climitsInclude = {
    load(rt: any) {
      rt.scope[0].variables['INT_MAX'] = rt.val(rt.intTypeLiteral, 2147483647);
      rt.scope[0].variables['INT_MIN'] = rt.val(rt.intTypeLiteral, -2147483648);
      rt.scope[0].variables['LLONG_MAX'] = rt.val(rt.primitiveType('long long'), 9007199254740991);
      rt.scope[0].variables['LLONG_MIN'] = rt.val(rt.primitiveType('long long'), -9007199254740991);
    },
  };

  const vectorInclude = {
    load(rt: any) {
      if (!rt.config.loadedLibraries.includes('string')) {
        rt.config.loadedLibraries.push('string');
        stringInclude.load(rt);
      }
    },
  };

  const bitsInclude = {
    load(rt: any) {
      for (const lib of [
        'iostream',
        'cmath',
        'cstring',
        'cstdlib',
        'cstdio',
        'ctime',
        'cctype',
        'iomanip',
        'string',
        'algorithm',
        'vector',
        'climits',
      ]) {
        if (!rt.config.loadedLibraries.includes(lib) && JSCPP.includes[lib]) {
          rt.include(lib);
        }
      }
    },
  };

  const noopInclude = {
    load(_rt: any) {
      /* biblioteka pomocnicza */
    },
  };

  // Automatycznie ładuj podstawowe biblioteki przy dołączeniu iostream,
  // żeby standardowe funkcje (string, vector, sort, abs, sqrt, pow, rand) działały od ręki
  const origIostream = JSCPP.includes.iostream;
  JSCPP.includes.iostream = {
    load(rt: any) {
      patchRuntimeSemantics(rt);
      origIostream.load(rt);
      for (const extra of ['cmath', 'cstdlib', 'ctime', 'cstring', 'cctype', 'iomanip']) {
        if (!rt.config.loadedLibraries.includes(extra) && JSCPP.includes[extra]) {
          rt.config.loadedLibraries.push(extra);
          JSCPP.includes[extra].load(rt);
        }
      }
      if (!rt.config.loadedLibraries.includes('string')) {
        rt.config.loadedLibraries.push('string');
        stringInclude.load(rt);
      }
      if (!rt.config.loadedLibraries.includes('algorithm')) {
        rt.config.loadedLibraries.push('algorithm');
        algorithmInclude.load(rt);
      }
      if (!rt.config.loadedLibraries.includes('climits')) {
        rt.config.loadedLibraries.push('climits');
        climitsInclude.load(rt);
      }
    },
  };

  JSCPP.includes.string = stringInclude;
  JSCPP.includes.algorithm = algorithmInclude;
  JSCPP.includes.vector = vectorInclude;
  JSCPP.includes.climits = climitsInclude;
  JSCPP.includes['limits.h'] = climitsInclude;
  JSCPP.includes.limits = climitsInclude;
  JSCPP.includes['bits/stdc++.h'] = bitsInclude;

  for (const h of [
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
  ]) {
    if (!JSCPP.includes[h]) {
      JSCPP.includes[h] = noopInclude;
    }
  }
}

const jscppReady = import('JSCPP').then((mod: any) => {
  const JSCPP = mod.default ?? mod;
  registerStandardLibraries(JSCPP);
  return JSCPP;
});

/* Błędy kodu (kompilacja) — czerwony przegląd linii ma tu sens.
   Reszta (błędy wykonania, np. przepełnienie liczby, brak danych wejściowych) —
   program już się wykonywał, więc pokazujemy jego wynik i ostrzeżenie,
   a nie „źle napisany kod”. */
const COMPILE_ERROR_RE =
  /Parsing Failure|does not exist|is not (?:defined|known)|cannot find library|already (?:defined|declared)|redefinition|redeclaration|expected |no method|with signature|cannot cast|you must return|you cannot return|only left value|does not support|operator in ostream cannot accept|operator in istream cannot accept|type .+ is unknown/i;
const RUNTIME_ERROR_RE =
  /overflow|mismatch|Memory overflow|Time limit|out of (?:bound|range)|division by zero|devide by zero|stack overflow|segmentation/i;

self.onmessage = async (ev: MessageEvent<RunMsg>) => {
  const { code, stdin, maxTimeout } = ev.data;
  let out = '';
  try {
    const JSCPP = await jscppReady;
    const prep = preprocessCppForJscpp(code);
    activeUserStructs = prep.structs;
    const exitCode = JSCPP.run(prep.code, stdin, {
      stdio: {
        write: (s: string) => {
          out += s;
        },
      },
      maxTimeout,
      unsigned_overflow: 'ignore',
    });
    (self as unknown as Worker).postMessage({ ok: true, out, exitCode: Number(exitCode) || 0 });
  } catch (err) {
    let message = err instanceof Error ? err.message : String(err);
    // Przywróć czytelne nazwy vector<...> w komunikatach błędów
    message = message.replace(/\b__vec_([a-z]+)\b/g, 'vector<$1>');
    const runtimeError = !COMPILE_ERROR_RE.test(message) && (RUNTIME_ERROR_RE.test(message) || out.length > 0);
    (self as unknown as Worker).postMessage({ ok: false, out, error: message, runtimeError });
  }
};

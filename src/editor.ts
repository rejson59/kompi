/* Edytor kodu (CodeMirror 6):
   - Podczas pisania cały kod ma jednolity, spokojny biały kolor (bez tęczowego kolorowania składni),
   - Po kliknięciu „Uruchom” Kompi podświetla poprawne linie na zielono, a błędne na czerwono,
   - Gdy użytkownik zacznie pisać/poprawiać kod, kolory sprawdzania znikają i kod znów jest biały. */

import { EditorState, Compartment, StateEffect, StateField, RangeSetBuilder, type Extension } from '@codemirror/state';
import {
  EditorView,
  Decoration,
  type DecorationSet,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  hoverTooltip,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab, toggleComment } from '@codemirror/commands';
import {
  bracketMatching,
  indentOnInput,
  indentUnit,
  foldGutter,
  foldKeymap,
} from '@codemirror/language';
import { cpp } from '@codemirror/lang-cpp';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, acceptCompletion, completionStatus } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches, search } from '@codemirror/search';
import { lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint';

import { settings } from './state';
import { cppCompletionSource } from './completions';
import { TOKEN_INDEX } from './glossary';
import { t } from './i18n';
import { luminance } from './themes';

/* -------- Dekoracje linii po sprawdzeniu przez Kompiego (zielone / czerwone) -------- */
const setLineReviewEffect = StateEffect.define<{ goodLines: number[]; badLines: number[] } | null>();

const okLineDeco = Decoration.line({ class: 'cm-line-ok' });
const badLineDeco = Decoration.line({ class: 'cm-line-bad' });

const lineReviewField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decos, tr) {
    // Gdy użytkownik zaczyna pisać/edytować kod, wracamy do czystego białego tekstu
    if (tr.docChanged) {
      return Decoration.none;
    }
    for (const ef of tr.effects) {
      if (ef.is(setLineReviewEffect)) {
        if (!ef.value) return Decoration.none;
        const { goodLines, badLines } = ef.value;
        const goodSet = new Set(goodLines);
        const badSet = new Set(badLines);
        const builder = new RangeSetBuilder<Decoration>();
        const maxLines = tr.state.doc.lines;
        for (let lineNo = 1; lineNo <= maxLines; lineNo++) {
          if (badSet.has(lineNo)) {
            const line = tr.state.doc.line(lineNo);
            builder.add(line.from, line.from, badLineDeco);
          } else if (goodSet.has(lineNo)) {
            const line = tr.state.doc.line(lineNo);
            builder.add(line.from, line.from, okLineDeco);
          }
        }
        return builder.finish();
      }
    }
    return decos;
  },
  provide: (f) => EditorView.decorations.from(f),
});

function baseTheme(dark: boolean): Extension {
  return EditorView.theme(
    {
      '&': { backgroundColor: 'transparent', color: 'var(--ed-text)', height: '100%' },
      '.cm-content': { caretColor: 'var(--ed-cursor)', padding: '12px 0', color: 'var(--ed-text)' },
      '.cm-line': { color: 'var(--ed-text)' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--ed-cursor)', borderLeftWidth: '2px' },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: 'var(--ed-selection)',
      },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        color: 'var(--ed-gutter-text)',
        border: 'none',
        borderRight: '1px solid var(--border-soft)',
      },
      '.cm-activeLineGutter': { backgroundColor: 'var(--ed-active-line)', color: 'var(--accent)' },
      '.cm-activeLine': { backgroundColor: 'var(--ed-active-line)' },
      '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
        backgroundColor: 'var(--ed-bracket)',
        color: 'var(--ed-text)',
        outline: 'none',
        borderRadius: '4px',
      },
      '.cm-selectionMatch': { backgroundColor: 'var(--accent-soft)' },
      '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 14px' },
      '.cm-foldGutter .cm-gutterElement': { opacity: 0.6 },
      '.cm-panels': { backgroundColor: 'var(--panel)', color: 'var(--text)', borderBottom: '1px solid var(--border-soft)' },
      '.cm-panel.cm-search': { padding: '8px 12px' },
      '.cm-panel.cm-search input, .cm-panel.cm-search button': {
        backgroundColor: 'var(--bg)',
        color: 'var(--text)',
        border: 'none',
        borderRadius: '8px',
        boxShadow: 'var(--neu-inset-sm)',
        padding: '4px 10px',
      },
      '.cm-panel.cm-search button': {
        background: 'var(--surface-grad)',
        boxShadow: 'var(--neu-raised-xs)',
        cursor: 'pointer',
      },
      '.cm-tooltip': { border: 'none' },
      '.cm-scroller': { overflow: 'auto' },
    },
    { dark },
  );
}

/* ------------------------- przedziały konfiguracji ------------------------ */
const cThemeDark = new Compartment();
const cCompletion = new Compartment();
const cTabKeys = new Compartment();
const cHover = new Compartment();
const cGutter = new Compartment();
const cWrap = new Compartment();
const cIndent = new Compartment();
const cBrackets = new Compartment();

export interface EditorHooks {
  onChange: (code: string) => void;
  onCursor: (line: number, col: number, lines: number) => void;
  onRun: () => void;
  onSave: () => void;
}

function hoverExtension(): Extension {
  return hoverTooltip((view, pos) => {
    const { from, to, text } = view.state.doc.lineAt(pos);
    let start = pos;
    let end = pos;
    const isWord = (ch: string) => /[A-Za-z0-9_]/.test(ch);
    while (start > from && isWord(text[start - from - 1])) start--;
    while (end < to && isWord(text[end - from])) end++;
    if (start === end) return null;

    const word = text.slice(start - from, end - from);
    const entry = TOKEN_INDEX[word];
    if (!entry) return null;

    return {
      pos: start,
      end,
      above: true,
      create() {
        const dom = document.createElement('div');
        dom.className = 'hover-card';
        const title = document.createElement('b');
        title.textContent = entry.title[settings.lang];
        const p = document.createElement('p');
        p.textContent = entry.short[settings.lang];
        dom.append(title, p);
        if (entry.code) {
          const pre = document.createElement('pre');
          pre.textContent = entry.code.split('\n').slice(0, 4).join('\n');
          dom.append(pre);
        }
        const more = document.createElement('div');
        more.className = 'hover-more';
        more.textContent = t('gloss.hoverMore');
        dom.append(more);
        return { dom };
      },
    };
  });
}

function tabKeymap(hooks: EditorHooks): Extension {
  const runOrIndent = settings.tabAccepts
    ? [
        {
          key: 'Tab',
          run: (view: EditorView) => {
            if (completionStatus(view.state) === 'active') return acceptCompletion(view);
            return indentWithTab.run!(view);
          },
          shift: indentWithTab.shift,
        },
      ]
    : [indentWithTab];

  return keymap.of([
    ...runOrIndent,
    { key: 'Mod-Enter', run: () => (hooks.onRun(), true), preventDefault: true },
    { key: 'Shift-Enter', run: () => (hooks.onRun(), true), preventDefault: true },
    { key: 'Mod-s', run: () => (hooks.onSave(), true), preventDefault: true },
    { key: 'Mod-/', run: toggleComment, preventDefault: true },
  ]);
}

export function createEditor(parent: HTMLElement, doc: string, hooks: EditorHooks): EditorView {
  const state = EditorState.create({
    doc,
    extensions: [
      cGutter.of(gutterExt()),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      bracketMatching(),
      cBrackets.of(settings.closeBrackets ? closeBrackets() : []),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      search({ top: true }),
      lintGutter(),
      lineReviewField,
      cpp(),
      cCompletion.of(completionExt()),
      cHover.of(settings.hovers ? hoverExtension() : []),
      cWrap.of(settings.wrap ? EditorView.lineWrapping : []),
      cIndent.of([indentUnit.of(' '.repeat(settings.tabSize)), EditorState.tabSize.of(settings.tabSize)]),
      cTabKeys.of(tabKeymap(hooks)),
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap, ...searchKeymap, ...foldKeymap]),
      cThemeDark.of(baseTheme(isDarkEditor())),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) hooks.onChange(u.state.doc.toString());
        if (u.docChanged || u.selectionSet) {
          const head = u.state.selection.main.head;
          const line = u.state.doc.lineAt(head);
          hooks.onCursor(line.number, head - line.from + 1, u.state.doc.lines);
        }
      }),
    ],
  });

  return new EditorView({ state, parent });
}

function gutterExt(): Extension {
  return settings.lineNumbers ? [lineNumbers(), highlightActiveLineGutter(), foldGutter()] : [];
}

function completionExt(): Extension {
  if (!settings.autocomplete) return [];
  return autocompletion({
    override: [cppCompletionSource],
    activateOnTyping: true,
    defaultKeymap: true,
    maxRenderedOptions: 18,
    icons: true,
  });
}

export function isDarkEditor(): boolean {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--ed-bg').trim();
  if (!bg.startsWith('#')) return true;
  return luminance(bg) < 0.4;
}

/** Przeładowuje te części edytora, które zależą od ustawień. */
export function refreshEditor(view: EditorView, hooks: EditorHooks): void {
  view.dispatch({
    effects: [
      cGutter.reconfigure(gutterExt()),
      cCompletion.reconfigure(completionExt()),
      cHover.reconfigure(settings.hovers ? hoverExtension() : []),
      cWrap.reconfigure(settings.wrap ? EditorView.lineWrapping : []),
      cIndent.reconfigure([indentUnit.of(' '.repeat(settings.tabSize)), EditorState.tabSize.of(settings.tabSize)]),
      cBrackets.reconfigure(settings.closeBrackets ? closeBrackets() : []),
      cTabKeys.reconfigure(tabKeymap(hooks)),
      cThemeDark.reconfigure(baseTheme(isDarkEditor())),
    ],
  });
}

export function setCode(view: EditorView, code: string): void {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } });
}

export function insertAtCursor(view: EditorView, text: string): void {
  const sel = view.state.selection.main;
  view.dispatch({ changes: { from: sel.from, to: sel.to, insert: text }, selection: { anchor: sel.from + text.length } });
  view.focus();
}

export interface CompileIssue {
  line: number;
  col: number;
  severity: 'error' | 'warning';
  message: string;
}

/** Podkreśla w kodzie błędy zgłoszone przez kompilator. */
export function showIssues(view: EditorView, issues: CompileIssue[]): void {
  const doc = view.state.doc;
  const diags: Diagnostic[] = [];
  for (const it of issues) {
    const lineNo = Math.min(Math.max(1, it.line), doc.lines);
    const line = doc.line(lineNo);
    const from = Math.min(line.from + Math.max(0, it.col - 1), line.to);
    diags.push({
      from,
      to: Math.max(from + 1, line.to),
      severity: it.severity,
      message: it.message,
    });
  }
  view.dispatch(setDiagnostics(view.state, diags));
}

/** Koloruje linie w edytorze po kliknięciu „Uruchom”: zielone = poprawne, czerwone = błędne. */
export function showLineReview(view: EditorView, goodLines: number[], badLines: number[]): void {
  view.dispatch({
    effects: setLineReviewEffect.of({ goodLines, badLines }),
  });
}

export function clearIssues(view: EditorView): void {
  view.dispatch({
    ...setDiagnostics(view.state, []),
    effects: setLineReviewEffect.of(null),
  });
}

export function goToLine(view: EditorView, line: number): void {
  const n = Math.min(Math.max(1, line), view.state.doc.lines);
  const l = view.state.doc.line(n);
  view.dispatch({ selection: { anchor: l.from }, scrollIntoView: true });
  view.focus();
}

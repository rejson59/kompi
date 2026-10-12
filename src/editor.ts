/* Edytor kodu (CodeMirror 6) — motyw oparty o zmienne CSS,
   autouzupełnianie, podpowiedzi po najechaniu myszką i podkreślanie błędów. */

import { EditorState, Compartment, type Extension } from '@codemirror/state';
import {
  EditorView,
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
  syntaxHighlighting,
  HighlightStyle,
  foldGutter,
  foldKeymap,
} from '@codemirror/language';
import { cpp } from '@codemirror/lang-cpp';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, acceptCompletion, completionStatus } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches, search } from '@codemirror/search';
import { lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint';
import { tags as tg } from '@lezer/highlight';

import { settings } from './state';
import { cppCompletionSource } from './completions';
import { TOKEN_INDEX } from './glossary';
import { t } from './i18n';
import { luminance } from './themes';

const kompiHighlight = HighlightStyle.define([
  { tag: [tg.keyword, tg.controlKeyword, tg.operatorKeyword, tg.modifier, tg.self], color: 'var(--syn-key)' },
  { tag: [tg.typeName, tg.className, tg.standard(tg.typeName), tg.namespace], color: 'var(--syn-type)' },
  { tag: [tg.string, tg.special(tg.string), tg.character], color: 'var(--syn-str)' },
  { tag: [tg.number, tg.bool, tg.atom, tg.literal], color: 'var(--syn-num)' },
  { tag: [tg.comment, tg.lineComment, tg.blockComment, tg.docComment], color: 'var(--syn-com)', fontStyle: 'italic' },
  { tag: [tg.function(tg.variableName), tg.function(tg.propertyName), tg.labelName], color: 'var(--syn-fn)' },
  { tag: [tg.processingInstruction, tg.meta, tg.macroName], color: 'var(--syn-pre)' },
  { tag: [tg.operator, tg.punctuation, tg.separator, tg.bracket], color: 'var(--syn-op)' },
  { tag: [tg.variableName, tg.propertyName, tg.definition(tg.variableName)], color: 'var(--syn-var)' },
  { tag: tg.invalid, color: 'var(--danger)' },
]);

function baseTheme(dark: boolean): Extension {
  return EditorView.theme(
    {
      '&': { backgroundColor: 'var(--ed-bg)', color: 'var(--ed-text)', height: '100%' },
      '.cm-content': { caretColor: 'var(--ed-cursor)', padding: '10px 0' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--ed-cursor)', borderLeftWidth: '2px' },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: 'var(--ed-selection)',
      },
      '.cm-gutters': {
        backgroundColor: 'var(--ed-gutter-bg)',
        color: 'var(--ed-gutter-text)',
        border: 'none',
        borderRight: '1px solid var(--border-soft)',
      },
      '.cm-activeLineGutter': { backgroundColor: 'var(--ed-active-line)', color: 'var(--text-dim)' },
      '.cm-activeLine': { backgroundColor: 'var(--ed-active-line)' },
      '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
        backgroundColor: 'var(--ed-bracket)',
        outline: 'none',
        borderRadius: '3px',
      },
      '.cm-selectionMatch': { backgroundColor: 'var(--accent-soft)' },
      '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 12px' },
      '.cm-foldGutter .cm-gutterElement': { opacity: 0.6 },
      '.cm-panels': { backgroundColor: 'var(--panel-2)', color: 'var(--text)' },
      '.cm-panel.cm-search input, .cm-panel.cm-search button': {
        backgroundColor: 'var(--panel-3)',
        color: 'var(--text)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
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
      syntaxHighlighting(kompiHighlight, { fallback: true }),
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

export function clearIssues(view: EditorView): void {
  view.dispatch(setDiagnostics(view.state, []));
}

export function goToLine(view: EditorView, line: number): void {
  const n = Math.min(Math.max(1, line), view.state.doc.lines);
  const l = view.state.doc.line(n);
  view.dispatch({ selection: { anchor: l.from }, scrollIntoView: true });
  view.focus();
}

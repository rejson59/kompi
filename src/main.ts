/* kompi — prosty kompilator C++ online.
   Ten plik spina wszystko w całość: edytor, uruchamianie, panele i linki. */

import './style.css';

import { EditorView } from '@codemirror/view';
import { applyI18n, t } from './i18n';
import {
  autoSaveActiveCode,
  createSavedCodeWithName,
  ensureActiveCodeItem,
  loadCode,
  loadStdin,
  normalizeCppTitle,
  settings,
  storeCode,
  update,
} from './state';
import { applyTheme } from './themes';
import { clearIssues, createEditor, goToLine, insertAtCursor, refreshEditor, setCode, showIssues, showLineReview, type EditorHooks } from './editor';
import { DEFAULT_CODE } from './examples';
import { runProgram, type RunResult } from './engines';
import { analyzeCodeWithKompi, looksLikeMissingInput, runtimeHint, type KompiCodeReview } from './errors';
import { readFromHash, type SharePayload } from './share';
import { closeDrawer, closeModal, currentDrawer, h, icon, isModalOpen, openDrawer, rerenderDrawer, toast } from './ui';
import { glossaryPanel } from './panels/glossary';
import { appearancePanel } from './panels/appearance';
import { settingsPanel } from './panels/settings';
import { openShareModal } from './panels/share';
import { openSavedCodesModal } from './panels/saved';
import { closeTutorial, isTutorialOpen, kompiMascotSvg, maybeAutoStartTutorial, rerenderTutorialIfOpen, startTutorial } from './mascot';

/* ----------------------------- elementy DOM ----------------------------- */
const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

const splitEl = $('split');
const paneEditor = $('pane-editor');
const splitter = $('splitter');
const outputEl = $('output');
const inputPanel = $('input-panel');
const stdinArea = $<HTMLTextAreaElement>('stdin-input');
const tabOutputBtn = $<HTMLButtonElement>('tab-output');
const tabInputBtn = $<HTMLButtonElement>('tab-input');
const runBtn = $<HTMLButtonElement>('btn-run');
const stopBtn = $<HTMLButtonElement>('btn-stop');
const runStatus = $('run-status');
const titleInput = $<HTMLInputElement>('code-title-input');
const banner = $('shared-banner');
const bannerText = $('shared-banner-text');

let view: EditorView;
let running = false;
let controller: AbortController | null = null;
let saveTimer: number | undefined;
/** kod, który był w edytorze przed otwarciem cudzego linku */
let myOwnCode: string | null = null;
/** ostatni wynik programu — dołączany do udostępnianej pracy */
let lastRunOutput = '';

/* ------------------------- zakładki Wyjście / Wejście ------------------- */
function selectPaneTab(which: 'output' | 'input'): void {
  const isOut = which === 'output';
  tabOutputBtn.classList.toggle('is-active', isOut);
  tabInputBtn.classList.toggle('is-active', !isOut);
  tabOutputBtn.setAttribute('aria-selected', String(isOut));
  tabInputBtn.setAttribute('aria-selected', String(!isOut));
  outputEl.classList.toggle('is-hidden', !isOut);
  inputPanel.classList.toggle('is-hidden', isOut);
}

tabOutputBtn.addEventListener('click', () => selectPaneTab('output'));
tabInputBtn.addEventListener('click', () => {
  selectPaneTab('input');
  stdinArea.focus();
});
stdinArea.addEventListener('input', () => scheduleSave());

/* ------------------------------- wyjście -------------------------------- */
function clearOutput(): void {
  outputEl.innerHTML = '';
}

function outText(text: string, cls = ''): void {
  if (!text) return;
  outputEl.append(h('span', { class: cls, text }));
  outputEl.scrollTop = outputEl.scrollHeight;
}

function outSys(text: string, cls = 'out-sys'): void {
  outputEl.append(h('div', { class: cls, text }));
  outputEl.scrollTop = outputEl.scrollHeight;
}

function outSpinner(text: string): HTMLElement {
  const el = h('div', { class: 'out-sys' }, h('span', { class: 'out-spinner' }), h('span', { text }));
  outputEl.append(el);
  outputEl.scrollTop = outputEl.scrollHeight;
  return el;
}

function outBlock(title: string, htmlBody: string, kind: 'tip' | 'err' = 'tip'): void {
  const block = h(
    'div',
    { class: `out-block is-${kind}` },
    h('div', { class: 'tip-title' }, icon(kind === 'err' ? 'close' : 'spark'), h('span', { text: title })),
    h('div', { html: htmlBody }),
  );
  outputEl.append(block);
  outputEl.scrollTop = outputEl.scrollHeight;
}

function setStatus(text: string, kind: '' | 'ok' | 'err' = ''): void {
  runStatus.textContent = text;
  runStatus.className = `run-status${kind ? ` is-${kind}` : ''}`;
}

/* ----------------------------- uruchamianie ----------------------------- */
function setRunning(on: boolean): void {
  running = on;
  runBtn.classList.toggle('is-busy', on);
  runBtn.disabled = on;
  stopBtn.classList.toggle('is-hidden', !on);
}

async function run(): Promise<void> {
  if (running) return;
  const code = view.state.doc.toString();
  if (!code.trim()) {
    toast(t('run.emptyCode'), 'err');
    return;
  }

  // Automatyczny zapis bieżącego kodu i tytułu w przeglądarce
  autoSaveActiveCode(code, titleInput.value);
  storeCode(code, stdinArea.value);

  if (settings.clearBeforeRun) clearOutput();
  clearIssues(view);
  selectPaneTab('output');
  setRunning(true);
  setStatus('');

  let spinner = null as HTMLElement | null;
  const spinnerTimer = window.setTimeout(() => {
    spinner = outSpinner(t('run.running'));
  }, 180);

  controller = new AbortController();

  try {
    const result = await runProgram({
      code,
      stdin: stdinArea.value,
      std: settings.std,
      timeoutMs: settings.timeoutSec * 1000,
      signal: controller.signal,
    });
    window.clearTimeout(spinnerTimer);
    if (spinner) spinner.remove();
    renderResult(result);
  } catch (err) {
    window.clearTimeout(spinnerTimer);
    if (spinner) spinner.remove();
    if (err instanceof DOMException && err.name === 'AbortError') {
      outSys(t('run.stopped'));
      setStatus(t('run.stopped'));
    } else {
      setStatus('✕', 'err');
    }
  } finally {
    controller = null;
    setRunning(false);
  }
}

function renderKompiReview(review: KompiCodeReview): void {
  const isPl = settings.lang === 'pl';

  if (review.ok) {
    const okCard = h(
      'div',
      { class: 'kompi-review-card is-ok' },
      h('div', { class: 'kompi-review-avatar-wrap' }, kompiMascotSvg('happy', 'kompi-review-svg-sm')),
      h(
        'div',
        { class: 'kompi-review-body' },
        h('div', {
          class: 'kompi-review-title',
          text: isPl
            ? 'Kompi sprawdził kod: wszystko napisane poprawnie!'
            : 'Kompi checked your code: everything looks right!',
        }),
      ),
    );
    outputEl.append(okCard);
    return;
  }

  const listEl = h('div', { class: 'kompi-issue-list' });
  for (const item of review.issues) {
    const row = h(
      'div',
      {
        class: 'kompi-issue-item',
        onclick: () => goToLine(view, item.line),
        title: isPl ? 'Kliknij, aby przejść do tej linii' : 'Click to jump to this line',
      },
      h(
        'div',
        { class: 'kompi-issue-top' },
        h('span', { class: 'kompi-issue-badge', text: t('err.line', { line: item.line }) }),
        item.codeSnippet
          ? h('code', { class: 'kompi-issue-code', text: item.codeSnippet })
          : null,
      ),
      h('div', { class: 'kompi-issue-exp', html: item.explanation }),
    );
    listEl.append(row);
  }

  const legendEl = h(
    'div',
    { class: 'kompi-review-legend' },
    h('span', { class: 'legend-pill is-ok', text: isPl ? 'Zielony = poprawne' : 'Green = correct' }),
    h('span', { class: 'legend-pill is-bad', text: isPl ? 'Czerwony = do poprawy' : 'Red = needs fix' }),
  );

  const badCard = h(
    'div',
    { class: 'kompi-review-card is-bad' },
    h('div', { class: 'kompi-review-head' },
      h('div', { class: 'kompi-review-avatar-wrap' }, kompiMascotSvg('help', 'kompi-review-svg')),
      h(
        'div',
        { class: 'kompi-review-head-text' },
        h('div', {
          class: 'kompi-review-title',
          text: isPl
            ? 'Kompi sprawdził Twój kod — zobacz, co poszło nie tak:'
            : 'Kompi checked your code — here’s what went wrong:',
        }),
        legendEl,
      ),
    ),
    listEl,
  );

  outputEl.append(badCard);
}

function stripHtmlTags(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function renderResult(r: RunResult): void {
  const code = view.state.doc.toString();
  const review = analyzeCodeWithKompi(code, r.compileOutput, r.compileFailed);

  /* Podświetl w edytorze poprawne linie na zielono, a błędne na czerwono */
  showLineReview(view, review.goodLines, review.badLines);

  if (!review.ok) {
    showIssues(
      view,
      review.issues.map((it) => ({
        line: it.line,
        col: 1,
        severity: 'error',
        message: stripHtmlTags(it.explanation),
      })),
    );
  }

  /* Pokaż wyjaśnienie Kompiego z boku (w panelu Wyjście) */
  renderKompiReview(review);

  lastRunOutput = r.stdout ?? '';

  /* Wspólne wypisanie wyniku programu — nawet gdy coś się nie udało,
     wygenerowany wcześniej wynik nie może przepaść. */
  const printProgramOutput = (label?: string): void => {
    if (!r.stdout && !r.stderr) return;
    if (label) outSys(label);
    if (r.stdout) outText(r.stdout.endsWith('\n') ? r.stdout : `${r.stdout}\n`);
    if (r.stderr) outText(r.stderr.endsWith('\n') ? r.stderr : `${r.stderr}\n`, 'out-err');
  };

  const maybeMissingInput = (): void => {
    if (looksLikeMissingInput(code, stdinArea.value, r.stdout)) {
      outBlock(t('tip.title'), t('run.waitingInput'));
    }
  };

  /* --- błąd kompilacji --- */
  if (r.compileFailed) {
    printProgramOutput(r.stdout || r.stderr ? t('out.partial') : undefined);
    setStatus(t('status.compileFailed'), 'err');
    return;
  }

  /* --- przekroczony czas --- */
  if (r.timedOut) {
    printProgramOutput(r.stdout ? t('out.partial') : undefined);
    outBlock(t('err.title'), escapeHtml(t('run.timeout', { sec: settings.timeoutSec })), 'err');
    setStatus('⏱', 'err');
    return;
  }

  /* --- wynik programu --- */
  printProgramOutput();
  if (!r.stdout && !r.stderr) outSys(t('out.noOutput'));

  const hint = runtimeHint(r.exitCode, r.signalName, r.stderr);
  if (hint && r.exitCode !== 0) outBlock(t('tip.title'), hint);
  maybeMissingInput();

  const time = r.timeMs >= 1000 ? `${(r.timeMs / 1000).toFixed(1)} s` : `${r.timeMs} ms`;
  if (r.exitCode === 0 || r.exitCode === null) {
    outSys(`${t('status.exitOk')} · ${t('status.time', { t: time })}`, 'out-sys out-ok');
    setStatus(`✓ ${time}`, 'ok');
  } else {
    outSys(`${t('status.exitBad', { code: r.exitCode })} · ${t('status.time', { t: time })}`, 'out-sys out-warn');
    setStatus(`✕ ${t('status.exitBad', { code: r.exitCode })}`, 'err');
  }
}

/* -------------------------------- układ --------------------------------- */
function applyLayout(): void {
  splitEl.className = `split split-${settings.layout}${settings.swapped ? ' is-swapped' : ''}`;
  const pct = Math.round(Math.min(0.85, Math.max(0.15, settings.splitRatio)) * 100);
  paneEditor.style.flex = `0 0 ${pct}%`;
}

function initSplitter(): void {
  let dragging = false;

  const onMove = (e: PointerEvent): void => {
    if (!dragging) return;
    const rect = splitEl.getBoundingClientRect();
    const vertical = settings.layout === 'column' || window.innerWidth <= 640;
    let ratio = vertical ? (e.clientY - rect.top) / rect.height : (e.clientX - rect.left) / rect.width;
    if (settings.swapped) ratio = 1 - ratio;
    settings.splitRatio = Math.min(0.85, Math.max(0.15, ratio));
    applyLayout();
  };

  splitter.addEventListener('pointerdown', (e) => {
    dragging = true;
    splitter.classList.add('is-dragging');
    splitter.setPointerCapture(e.pointerId);
    document.body.style.userSelect = 'none';
  });
  splitter.addEventListener('pointermove', onMove);
  splitter.addEventListener('pointerup', (e) => {
    dragging = false;
    splitter.classList.remove('is-dragging');
    splitter.releasePointerCapture(e.pointerId);
    document.body.style.userSelect = '';
    update({ splitRatio: settings.splitRatio });
  });
  splitter.addEventListener('dblclick', () => {
    update({ splitRatio: 0.6 });
    applyLayout();
  });
}

/* ------------------------------- zapisy ---------------------------------- */
function scheduleSave(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const code = view.state.doc.toString();
    storeCode(code, stdinArea.value);
    autoSaveActiveCode(code, titleInput.value);
  }, 400);
}

/* ------------------------------- panele ---------------------------------- */
function openGlossary(): void {
  openDrawer('glossary', t('gloss.title'), glossaryPanel((code) => {
    insertAtCursor(view, `${code}\n`);
    toast(t('toast.exampleInserted'), 'ok');
  }), true);
}

function openAppearance(): void {
  openDrawer('appearance', t('app.title'), appearancePanel(
    () => {
      applyTheme();
      applyLayout();
      refreshEditor(view, editorHooks);
    },
    () => rerenderDrawer(),
  ));
}

function openSettings(): void {
  openDrawer('settings', t('set.title'), settingsPanel({
    refreshEditor: () => refreshEditor(view, editorHooks),
    refreshAll: () => {
      applyI18n();
      applyTheme();
      applyLayout();
      refreshEditor(view, editorHooks);
      rerenderTutorialIfOpen();
    },
    rerender: () => rerenderDrawer(t('set.title')),
  }));
}

/* ------------------------- udostępniona praca ---------------------------- */
function showBanner(payload: SharePayload): void {
  banner.classList.remove('is-hidden');
  bannerText.innerHTML = payload.b
    ? t('banner.sharedBy', { name: `<strong>${escapeHtml(payload.b)}</strong>` })
    : t('banner.shared');
}

function hideBanner(): void {
  banner.classList.add('is-hidden');
}

async function loadFromHash(initial: boolean): Promise<boolean> {
  const found = await readFromHash();
  if (!found) return false;
  const p = found.payload;
  if (myOwnCode === null) myOwnCode = view.state.doc.toString();
  setCode(view, p.c);
  if (typeof p.i === 'string') {
    stdinArea.value = p.i;
    scheduleSave();
  }
  if (p.s) update({ std: p.s });
  if (p.o) {
    clearOutput();
    outSys('— ' + t('share.includeOutput') + ' —');
    outText(p.o.endsWith('\n') ? p.o : `${p.o}\n`);
    lastRunOutput = p.o;
  }
  showBanner(p);
  if (!initial) toast(t('toast.loadedShared'), 'ok');
  return true;
}

/* -------------------------------- edytor --------------------------------- */
const editorHooks: EditorHooks = {
  onChange: () => {
    scheduleSave();
  },
  onCursor: () => {
    /* minimalistyczny widok */
  },
  onRun: () => void run(),
  onSave: () => {
    const code = view.state.doc.toString();
    storeCode(code, stdinArea.value);
    autoSaveActiveCode(code, titleInput.value);
  },
};

/* --------------------------------- start --------------------------------- */
async function boot(): Promise<void> {
  /* wstawienie maskotki Kompi jako logo w górnym pasku */
  const mascotSlot = document.getElementById('brand-mascot-slot');
  if (mascotSlot) {
    mascotSlot.innerHTML = '';
    mascotSlot.append(kompiMascotSvg('happy', 'kompi-logo-svg'));
  }

  applyTheme();
  applyI18n();
  applyLayout();

  const savedRaw = loadCode();
  const activeItem = ensureActiveCodeItem(savedRaw ?? DEFAULT_CODE);
  titleInput.value = activeItem.title;
  stdinArea.value = loadStdin();
  view = createEditor($('editor'), activeItem.code, editorHooks);

  initSplitter();

  /* kliknięcie w logo Kompi uruchamia samouczek */
  $('btn-brand-kompi').addEventListener('click', () => startTutorial(0));

  /* zmiana tytułu kodu (np. przyklad.cpp) i lista ostatnich kodów */
  titleInput.addEventListener('change', () => {
    const clean = normalizeCppTitle(titleInput.value, settings.lang === 'pl' ? 'przyklad.cpp' : 'example.cpp');
    titleInput.value = clean;
    autoSaveActiveCode(view.state.doc.toString(), clean);
  });
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      titleInput.blur();
      view.focus();
    }
  });

  const fileUploadInput = $('file-upload-cpp') as HTMLInputElement;
  const loadCppFile = async (file: File) => {
    try {
      const text = await file.text();
      const item = createSavedCodeWithName(file.name || 'przyklad.cpp', text);
      titleInput.value = item.title;
      setCode(view, item.code);
      storeCode(item.code, stdinArea.value);
      clearOutput();
      clearIssues(view);
      toast(`${t('toast.fileLoaded')}: ${item.title}`, 'ok');
    } catch {
      /* ignorujemy błąd odczytu */
    }
  };

  $('btn-upload-cpp').addEventListener('click', () => fileUploadInput.click());
  fileUploadInput.addEventListener('change', () => {
    const file = fileUploadInput.files?.[0];
    if (file) void loadCppFile(file);
    fileUploadInput.value = '';
  });

  /* obsługa przeciągnięcia pliku .cpp na panel Kod */
  const editorPane = $('pane-editor');
  editorPane.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  editorPane.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) void loadCppFile(file);
  });

  $('btn-saved-list').addEventListener('click', () =>
    openSavedCodesModal({
      onSelect: (item) => {
        titleInput.value = item.title;
        setCode(view, item.code);
        storeCode(item.code, stdinArea.value);
        clearOutput();
        clearIssues(view);
      },
      onRenameActive: (newTitle) => {
        titleInput.value = newTitle;
      },
      onUploadClick: () => fileUploadInput.click(),
    }),
  );

  /* przyciski górnego paska */
  runBtn.addEventListener('click', () => void run());
  stopBtn.addEventListener('click', () => controller?.abort(new DOMException('stopped', 'AbortError')));
  $('btn-share').addEventListener('click', () =>
    openShareModal(() => ({
      code: view.state.doc.toString(),
      title: titleInput.value,
      stdin: stdinArea.value,
      output: lastRunOutput,
    })),
  );
  $('btn-glossary').addEventListener('click', openGlossary);
  $('btn-appearance').addEventListener('click', openAppearance);
  $('btn-settings').addEventListener('click', openSettings);

  /* szuflada / modal */
  $('drawer-close').addEventListener('click', closeDrawer);
  $('drawer-scrim').addEventListener('click', closeDrawer);
  $('modal-close').addEventListener('click', closeModal);
  $('modal-scrim').addEventListener('click', (e) => {
    if (e.target === $('modal-scrim')) closeModal();
  });

  /* baner udostępnionej pracy */
  $('shared-banner-close').addEventListener('click', hideBanner);
  $('shared-banner-new').addEventListener('click', () => {
    history.replaceState(null, '', location.pathname);
    setCode(view, myOwnCode ?? DEFAULT_CODE);
    myOwnCode = null;
    clearOutput();
    hideBanner();
  });

  /* skróty globalne */
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void run();
    } else if (e.key === 'Escape') {
      if (isTutorialOpen()) closeTutorial(true);
      else if (isModalOpen()) closeModal();
      else if (currentDrawer()) closeDrawer();
    }
  });

  window.addEventListener('hashchange', () => void loadFromHash(false));

  /* praca otwarta z linku */
  const loaded = await loadFromHash(true);
  if (loaded) {
    toast(t('toast.loadedShared'), 'ok');
  } else {
    maybeAutoStartTutorial();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

void boot();

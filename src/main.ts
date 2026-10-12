/* kompi — prosty kompilator C++ online.
   Ten plik spina wszystko w całość: edytor, uruchamianie, panele i linki. */

import './style.css';

import { EditorView } from '@codemirror/view';
import { applyI18n, t } from './i18n';
import { loadCode, loadStdin, settings, storeCode, update, type Lang } from './state';
import { applyTheme } from './themes';
import { clearIssues, createEditor, goToLine, insertAtCursor, refreshEditor, setCode, showIssues, type EditorHooks } from './editor';
import { DEFAULT_CODE, EXAMPLES } from './examples';
import { runProgram, type RunResult } from './engines';
import { friendlyHints, looksLikeMissingInput, parseIssues, runtimeHint } from './errors';
import { readFromHash, type SharePayload } from './share';
import { closeDrawer, closeModal, copyText, currentDrawer, h, icon, isModalOpen, openDrawer, rerenderDrawer, toast } from './ui';
import { glossaryPanel } from './panels/glossary';
import { appearancePanel } from './panels/appearance';
import { settingsPanel } from './panels/settings';
import { openShareModal } from './panels/share';

/* ----------------------------- elementy DOM ----------------------------- */
const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

const splitEl = $('split');
const paneEditor = $('pane-editor');
const splitter = $('splitter');
const outputEl = $('output');
const stdinEl = $<HTMLTextAreaElement>('stdin');
const runBtn = $<HTMLButtonElement>('btn-run');
const stopBtn = $<HTMLButtonElement>('btn-stop');
const runStatus = $('run-status');
const engineLabel = $('engine-label');
const cursorPos = $('cursor-pos');
const codeStats = $('code-stats');
const dirtyDot = $('dirty-dot');
const stdinBadge = $('stdin-badge');
const banner = $('shared-banner');
const bannerText = $('shared-banner-text');
const examplesSel = $<HTMLSelectElement>('examples');

let view: EditorView;
let running = false;
let controller: AbortController | null = null;
let saveTimer: number | undefined;
/** kod, który był w edytorze przed otwarciem cudzego linku */
let myOwnCode: string | null = null;

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

  showTab('out');
  if (settings.clearBeforeRun) clearOutput();
  clearIssues(view);
  setRunning(true);
  setStatus(t('run.compiling'));

  const spinner = outSpinner(t('run.compiling'));
  controller = new AbortController();

  try {
    const result = await runProgram(
      {
        code,
        stdin: stdinEl.value,
        std: settings.std,
        timeoutMs: settings.timeoutSec * 1000,
        signal: controller.signal,
      },
      {
        onProgress: (msg) => {
          spinner.querySelector('span:last-child')!.textContent = msg;
        },
        onEngineFailed: (name) => outSys(t('run.engineFailed', { engine: name }), 'out-sys out-warn'),
      },
    );
    spinner.remove();
    renderResult(result, code);
  } catch (err) {
    spinner.remove();
    if (err instanceof DOMException && err.name === 'AbortError') {
      outSys(t('run.stopped'));
      setStatus(t('run.stopped'));
    } else {
      const detail = err instanceof Error ? err.message : String(err);
      outBlock(t('err.title'), `${escapeHtml(t('run.noEngines'))}<br><span class="out-dim">${escapeHtml(detail)}</span>`, 'err');
      setStatus('✕', 'err');
    }
  } finally {
    controller = null;
    setRunning(false);
  }
}

function renderResult(r: RunResult, code: string): void {
  engineLabel.textContent = `${t('foot.engine')}: ${r.engineLabel}`;

  /* --- komunikaty kompilatora --- */
  const issues = parseIssues(r.compileOutput);
  if (r.compileOutput.trim()) {
    outSys(t('out.compilerMsg'), 'out-sys');
    if (issues.length) {
      for (const it of issues) {
        const line = h(
          'div',
          { class: it.severity === 'error' ? 'out-err' : 'out-warn' },
          h('span', {
            class: 'out-err-link',
            text: `${t('err.line', { line: it.line })}`,
            onclick: () => goToLine(view, it.line),
          }),
          h('span', { text: `  ${it.message}` }),
        );
        outputEl.append(line);
      }
    } else {
      outText(`${r.compileOutput.trim()}\n`, r.compileFailed ? 'out-err' : 'out-warn');
    }
    if (issues.length) showIssues(view, issues);
  }

  /* --- błąd kompilacji --- */
  if (r.compileFailed) {
    const hints = friendlyHints(r.compileOutput);
    if (hints.length) outBlock(t('tip.title'), hints.map((x) => `• ${x}`).join('<br>'));
    if (r.note) outSys(r.note);
    setStatus(t('status.compileFailed'), 'err');
    return;
  }

  /* --- przekroczony czas --- */
  if (r.timedOut) {
    outBlock(t('err.title'), escapeHtml(t('run.timeout', { sec: settings.timeoutSec })), 'err');
    setStatus('⏱', 'err');
    return;
  }

  /* --- wynik programu --- */
  if (r.stdout) outText(r.stdout.endsWith('\n') ? r.stdout : `${r.stdout}\n`);
  if (r.stderr) outText(r.stderr.endsWith('\n') ? r.stderr : `${r.stderr}\n`, 'out-err');
  if (!r.stdout && !r.stderr) outSys(t('out.noOutput'));

  if (looksLikeMissingInput(code, stdinEl.value, r.stdout)) {
    outBlock(t('tip.title'), escapeHtml(t('run.waitingInput')));
  }

  const hint = runtimeHint(r.exitCode, r.signalName, r.stderr);
  if (hint && r.exitCode !== 0) outBlock(t('tip.title'), hint);

  const time = r.timeMs >= 1000 ? `${(r.timeMs / 1000).toFixed(1)} s` : `${r.timeMs} ms`;
  if (r.exitCode === 0 || r.exitCode === null) {
    outSys(`${t('status.exitOk')} · ${t('status.time', { t: time })}`, 'out-sys out-ok');
    setStatus(`✓ ${time}`, 'ok');
  } else {
    outSys(`${t('status.exitBad', { code: r.exitCode })} · ${t('status.time', { t: time })}`, 'out-sys out-warn');
    setStatus(`✕ ${t('status.exitBad', { code: r.exitCode })}`, 'err');
  }
  if (r.note && r.engine === 'offline') outSys(r.note);
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

/* -------------------------------- zakładki ------------------------------- */
function showTab(id: 'out' | 'in'): void {
  document.querySelectorAll<HTMLElement>('.tab').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === id));
  $('tab-out').classList.toggle('is-hidden', id !== 'out');
  $('tab-in').classList.toggle('is-hidden', id !== 'in');
  if (id === 'in') stdinEl.focus();
}

function updateStdinBadge(): void {
  const lines = stdinEl.value.trim() ? stdinEl.value.trim().split('\n').length : 0;
  stdinBadge.textContent = String(lines);
  stdinBadge.classList.toggle('is-hidden', lines === 0);
}

/* ------------------------------- zapisy ---------------------------------- */
function scheduleSave(): void {
  dirtyDot.classList.add('is-on');
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    storeCode(view.state.doc.toString(), stdinEl.value);
    dirtyDot.classList.remove('is-on');
  }, 500);
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
      refreshLangToggle();
      fillExamples();
    },
    rerender: () => rerenderDrawer(t('set.title')),
  }));
}

/* ------------------------------- język ----------------------------------- */
function refreshLangToggle(): void {
  document.querySelectorAll<HTMLElement>('#lang-toggle button').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.lang === settings.lang);
  });
}

function setLang(lang: Lang): void {
  update({ lang });
  applyI18n();
  refreshLangToggle();
  fillExamples();
  const open = currentDrawer();
  if (open === 'glossary') rerenderDrawer(t('gloss.title'));
  else if (open === 'appearance') rerenderDrawer(t('app.title'));
  else if (open === 'settings') rerenderDrawer(t('set.title'));
  if (!running) setStatus('');
}

/* ------------------------------ przykłady -------------------------------- */
function fillExamples(): void {
  examplesSel.innerHTML = '';
  examplesSel.append(h('option', { value: '', text: t('examples.placeholder') }));
  for (const ex of EXAMPLES) examplesSel.append(h('option', { value: ex.id, text: ex.title[settings.lang] }));
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
  if (p.i != null) {
    stdinEl.value = p.i;
    updateStdinBadge();
  }
  if (p.s) update({ std: p.s });
  if (p.o) {
    clearOutput();
    outSys('— ' + t('share.includeOutput') + ' —');
    outText(p.o.endsWith('\n') ? p.o : `${p.o}\n`);
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
  onCursor: (line, col, lines) => {
    cursorPos.textContent = `${line} : ${col}`;
    codeStats.textContent = `${lines} ${t('foot.lines')}`;
  },
  onRun: () => void run(),
  onSave: () => downloadCode(),
};

function downloadCode(): void {
  const blob = new Blob([view.state.doc.toString()], { type: 'text/plain;charset=utf-8' });
  const a = h('a', { href: URL.createObjectURL(blob), download: 'main.cpp' }) as HTMLAnchorElement;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(t('toast.downloaded'), 'ok');
}

/* --------------------------------- start --------------------------------- */
async function boot(): Promise<void> {
  applyTheme();
  applyI18n();
  refreshLangToggle();
  fillExamples();
  applyLayout();

  const saved = loadCode();
  view = createEditor($('editor'), saved ?? DEFAULT_CODE, editorHooks);
  stdinEl.value = loadStdin();
  updateStdinBadge();
  engineLabel.textContent = `${t('foot.engine')}: ${settings.engine === 'auto' ? 'auto' : settings.engine}`;

  initSplitter();

  /* przyciski górnego paska */
  runBtn.addEventListener('click', () => void run());
  stopBtn.addEventListener('click', () => controller?.abort(new DOMException('stopped', 'AbortError')));
  $('btn-share').addEventListener('click', () =>
    openShareModal(() => ({ code: view.state.doc.toString(), stdin: stdinEl.value, output: outputEl.innerText })),
  );
  $('btn-glossary').addEventListener('click', openGlossary);
  $('btn-appearance').addEventListener('click', openAppearance);
  $('btn-settings').addEventListener('click', openSettings);
  document.querySelectorAll<HTMLElement>('#lang-toggle button').forEach((b) =>
    b.addEventListener('click', () => setLang(b.dataset.lang as Lang)),
  );

  /* szuflada / modal */
  $('drawer-close').addEventListener('click', closeDrawer);
  $('drawer-scrim').addEventListener('click', closeDrawer);
  $('modal-close').addEventListener('click', closeModal);
  $('modal-scrim').addEventListener('click', (e) => {
    if (e.target === $('modal-scrim')) closeModal();
  });

  /* zakładki wyjścia */
  document.querySelectorAll<HTMLElement>('.tab').forEach((b) =>
    b.addEventListener('click', () => showTab(b.dataset.tab as 'out' | 'in')),
  );
  stdinEl.addEventListener('input', () => {
    updateStdinBadge();
    scheduleSave();
  });

  $('btn-copy-out').addEventListener('click', async () => {
    const ok = await copyText(outputEl.innerText);
    toast(ok ? t('toast.copied') : t('toast.copyFail'), ok ? 'ok' : 'err');
  });
  $('btn-clear-out').addEventListener('click', () => {
    clearOutput();
    setStatus('');
    toast(t('toast.outputCleared'));
  });

  /* pliki */
  $('btn-download').addEventListener('click', downloadCode);
  $('btn-upload').addEventListener('click', () => $<HTMLInputElement>('file-input').click());
  $<HTMLInputElement>('file-input').addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    setCode(view, await file.text());
    toast(`${t('toast.fileLoaded')}: ${file.name}`, 'ok');
    (e.target as HTMLInputElement).value = '';
  });

  /* przykłady */
  examplesSel.addEventListener('change', () => {
    const ex = EXAMPLES.find((x) => x.id === examplesSel.value);
    examplesSel.value = '';
    if (!ex) return;
    setCode(view, ex.code);
    stdinEl.value = ex.stdin ?? '';
    updateStdinBadge();
    clearIssues(view);
    toast(`${t('toast.exampleInserted')}: ${ex.title[settings.lang]}`, 'ok');
  });

  /* baner udostępnionej pracy */
  $('shared-banner-close').addEventListener('click', hideBanner);
  $('shared-banner-new').addEventListener('click', () => {
    history.replaceState(null, '', location.pathname);
    setCode(view, myOwnCode ?? DEFAULT_CODE);
    myOwnCode = null;
    stdinEl.value = '';
    updateStdinBadge();
    clearOutput();
    hideBanner();
  });

  /* skróty globalne */
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void run();
    } else if (e.key === 'Escape') {
      if (isModalOpen()) closeModal();
      else if (currentDrawer()) closeDrawer();
    }
  });

  window.addEventListener('hashchange', () => void loadFromHash(false));

  /* praca otwarta z linku */
  const loaded = await loadFromHash(true);
  if (loaded) toast(t('toast.loadedShared'), 'ok');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

void boot();

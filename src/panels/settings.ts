/* Panel „Ustawienia” — edytor, uruchamianie, podpis, skróty. */

import { t } from '../i18n';
import { resetSettings, settings, update } from '../state';
import { group, h, rowRange, rowSelect, rowSwitch, rowText, toast } from '../ui';
import { ENGINE_NAMES, testEngine } from '../engines';

export interface SettingsPanelHooks {
  /** przeładowanie konfiguracji edytora */
  refreshEditor: () => void;
  /** odświeżenie całego UI (np. po resecie) */
  refreshAll: () => void;
  rerender: () => void;
}

const SHORTCUTS: Array<[string, string]> = [
  ['Ctrl + Enter', 'sc.run'],
  ['Tab / Ctrl + Space', 'sc.complete'],
  ['Ctrl + F', 'sc.search'],
  ['Ctrl + /', 'sc.comment'],
  ['Tab / Shift + Tab', 'sc.indent'],
  ['Ctrl + S', 'sc.save'],
];

/** Szybki test: który kompilator odpowiada z tej sieci. */
function engineTester(): HTMLElement {
  const results = h('div', { class: 'share-meta', style: { flexDirection: 'column', alignItems: 'flex-start', gap: '4px' } });
  const btn = h('button', {
    class: 'btn btn-ghost btn-block',
    text: t('set.testEngines'),
    onclick: async () => {
      (btn as HTMLButtonElement).disabled = true;
      btn.textContent = t('set.testing');
      results.innerHTML = '';
      for (const id of ['piston', 'godbolt', 'wandbox', 'offline'] as const) {
        const row = h('span', { class: 'badge', text: `${ENGINE_NAMES[id]}: …` });
        results.append(row);
        const r = await testEngine(id);
        row.className = `badge${r.ok ? ' is-ok' : ''}`;
        row.textContent = `${r.ok ? '✓' : '✕'} ${ENGINE_NAMES[id]}: ${r.ok ? `${t('set.testOk')} (${r.ms} ms)` : t('set.testFail')}`;
      }
      (btn as HTMLButtonElement).disabled = false;
      btn.textContent = t('set.testEngines');
    },
  });
  return h('div', { style: { padding: '10px 0 2px' } },
    h('div', { class: 'row-label', style: { marginBottom: '8px' } }, h('span', { text: t('set.testEnginesDesc') })),
    btn, results);
}

export function settingsPanel(hooks: SettingsPanelHooks) {
  return (body: HTMLElement): void => {
    /* ------------------------- edytor ------------------------- */
    body.append(
      group(
        t('set.group.editor'),
        rowSwitch(t('set.autocomplete'), t('set.autocompleteDesc'), settings.autocomplete, (v) => {
          update({ autocomplete: v });
          hooks.refreshEditor();
        }),
        rowSwitch(t('set.tabAccepts'), t('set.tabAcceptsDesc'), settings.tabAccepts, (v) => {
          update({ tabAccepts: v });
          hooks.refreshEditor();
        }),
        rowSwitch(t('set.hovers'), t('set.hoversDesc'), settings.hovers, (v) => {
          update({ hovers: v });
          hooks.refreshEditor();
        }),
        rowSwitch(t('set.closeBrackets'), t('set.closeBracketsDesc'), settings.closeBrackets, (v) => {
          update({ closeBrackets: v });
          hooks.refreshEditor();
        }),
        rowSwitch(t('set.lineNumbers'), undefined, settings.lineNumbers, (v) => {
          update({ lineNumbers: v });
          hooks.refreshEditor();
        }),
        rowSwitch(t('set.wrap'), undefined, settings.wrap, (v) => {
          update({ wrap: v });
          hooks.refreshEditor();
        }),
        rowSelect(
          t('set.tabSize'),
          undefined,
          [
            { value: '2', label: '2' },
            { value: '4', label: '4' },
            { value: '8', label: '8' },
          ],
          String(settings.tabSize),
          (v) => {
            update({ tabSize: Number(v) });
            hooks.refreshEditor();
          },
        ),
        rowSwitch(t('set.autoSave'), t('set.autoSaveDesc'), settings.autoSave, (v) => update({ autoSave: v })),
      ),
    );

    /* ------------------------ uruchamianie ------------------------ */
    body.append(
      group(
        t('set.group.run'),
        rowSelect(
          t('set.engine'),
          t('set.engineDesc'),
          [
            { value: 'auto', label: t('engine.auto') },
            { value: 'piston', label: t('engine.piston') },
            { value: 'godbolt', label: t('engine.godbolt') },
            { value: 'wandbox', label: t('engine.wandbox') },
            { value: 'offline', label: t('engine.offline') },
          ],
          settings.engine,
          (v) => {
            update({ engine: v as typeof settings.engine });
            hooks.rerender();
          },
        ),
        h('div', { class: 'hint-box', text: settings.engine === 'offline' ? t('offline.note') : t('engine.autoDesc') }),
        rowSelect(
          t('set.std'),
          t('set.stdDesc'),
          ['c++11', 'c++14', 'c++17', 'c++20'].map((s) => ({ value: s, label: s.toUpperCase() })),
          settings.std,
          (v) => update({ std: v }),
        ),
        rowRange(t('set.timeout'), undefined, 3, 30, 1, settings.timeoutSec, (v) => update({ timeoutSec: v }), (v) => `${v} s`),
        rowSwitch(t('set.clearBeforeRun'), undefined, settings.clearBeforeRun, (v) => update({ clearBeforeRun: v })),
        engineTester(),
      ),
    );

    /* --------------------------- inne --------------------------- */
    body.append(
      group(
        t('set.group.other'),
        rowText(t('set.author'), t('set.authorDesc'), t('set.authorPlaceholder'), settings.authorName, (v) =>
          update({ authorName: v }),
        ),
      ),
    );

    /* ------------------------- skróty ------------------------- */
    const list = h('div', {});
    for (const [keys, labelKey] of SHORTCUTS) {
      list.append(
        h(
          'div',
          { class: 'row' },
          h('div', { class: 'row-label' }, h('b', { text: t(labelKey as never) })),
          h('div', { class: 'row-control' }, ...keys.split(' + ').map((k) => h('kbd', { text: k }))),
        ),
      );
    }
    body.append(group(t('set.group.shortcuts'), list));

    /* ------------------------- o programie ------------------------- */
    body.append(
      group(
        t('set.group.about'),
        h('div', { class: 'hint-box', text: t('set.aboutText') }),
        h('button', {
          class: 'btn btn-ghost btn-block',
          text: t('set.reset'),
          onclick: () => {
            resetSettings();
            hooks.refreshAll();
            hooks.rerender();
            toast(t('set.resetDone'), 'ok');
          },
        }),
      ),
    );
  };
}

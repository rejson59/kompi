/* Panel „Ustawienia” — uproszczony, przejrzysty zestaw najważniejszych opcji (w tym język). */

import { t } from '../i18n';
import { resetSettings, settings, update, type Lang } from '../state';
import { closeDrawer, group, h, rowSelect, rowSwitch, toast } from '../ui';
import { kompiMascotSvg, startTutorial } from '../mascot';

export interface SettingsPanelHooks {
  /** przeładowanie konfiguracji edytora */
  refreshEditor: () => void;
  /** odświeżenie całego UI (np. po zmianie języka lub resecie) */
  refreshAll: () => void;
  rerender: () => void;
}

export function settingsPanel(hooks: SettingsPanelHooks) {
  return (body: HTMLElement): void => {
    /* ------------------------- język i edytor ------------------------- */
    body.append(
      group(
        t('set.group.editor'),
        rowSelect(
          t('set.lang'),
          undefined,
          [
            { value: 'pl', label: 'Polski' },
            { value: 'en', label: 'English' },
          ],
          settings.lang,
          (v) => {
            update({ lang: v as Lang });
            hooks.refreshAll();
            hooks.rerender();
          },
        ),
        rowSwitch(
          t('set.smartHints'),
          t('set.smartHintsDesc'),
          settings.autocomplete && settings.hovers,
          (v) => {
            update({ autocomplete: v, hovers: v });
            hooks.refreshEditor();
          },
        ),
        rowSwitch(t('set.lineNumbers'), undefined, settings.lineNumbers, (v) => {
          update({ lineNumbers: v });
          hooks.refreshEditor();
        }),
        rowSwitch(t('set.wrap'), undefined, settings.wrap, (v) => {
          update({ wrap: v });
          hooks.refreshEditor();
        }),
      ),
    );

    /* ------------------------ kompilator ------------------------ */
    body.append(
      group(
        t('set.group.run'),
        rowSelect(
          t('set.engine'),
          undefined,
          [
            { value: 'auto', label: t('engine.auto') },
            { value: 'offline', label: t('engine.offline') },
          ],
          settings.engine === 'offline' ? 'offline' : 'auto',
          (v) => {
            update({ engine: v as typeof settings.engine });
            hooks.rerender();
          },
        ),
      ),
    );

    /* -------------------- samouczek i reset -------------------- */
    body.append(
      group(
        t('set.tutorialGroup'),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-block tut-replay-btn',
            onclick: () => {
              closeDrawer();
              startTutorial(0);
            },
          },
          kompiMascotSvg('wave', 'kompi-mini-svg'),
          h('span', { text: t('set.tutorialBtn') }),
        ),
        h('button', {
          type: 'button',
          class: 'btn btn-ghost btn-block',
          style: { marginTop: '10px' },
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

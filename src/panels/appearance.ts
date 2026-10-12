/* Panel „Wygląd” — motywy, kolory, układ, czcionki. */

import { t, type I18nKey } from '../i18n';
import { DEFAULTS, settings, update, type ThemeName } from '../state';
import { THEME_PREVIEW } from '../themes';
import { group, h, icon, rowColor, rowRange, rowSelect, rowSwitch } from '../ui';
import { MONO_FONTS } from '../themes';

const THEMES: Array<Exclude<ThemeName, 'custom'>> = ['light', 'gray', 'dark', 'black'];

export function appearancePanel(apply: () => void, rerender: () => void) {
  return (body: HTMLElement): void => {
    /* ---------------- motyw ---------------- */
    const grid = h('div', { class: 'theme-grid' });
    for (const name of THEMES) grid.append(themeCard(name, apply, rerender));
    grid.append(customCard(apply, rerender));
    body.append(group(t('app.theme'), grid));

    /* ---------------- własne kolory ---------------- */
    if (settings.theme === 'custom') {
      const colors = h('div', {});
      colors.append(h('div', { class: 'hint-box', text: t('app.customHint') }));
      const set = (key: keyof typeof settings.custom) => (v: string) => {
        update({ custom: { ...settings.custom, [key]: v } });
        apply();
      };
      colors.append(rowColor(t('app.color.bg'), settings.custom.bg, set('bg')));
      colors.append(rowColor(t('app.color.panel'), settings.custom.panel, set('panel')));
      colors.append(rowColor(t('app.color.editor'), settings.custom.editor, set('editor')));
      colors.append(rowColor(t('app.color.text'), settings.custom.text, set('text')));
      colors.append(rowColor(t('app.color.accent'), settings.custom.accent, set('accent')));
      colors.append(
        rowSelect(
          t('app.color.base'),
          undefined,
          [
            { value: 'dark', label: t('app.base.dark') },
            { value: 'light', label: t('app.base.light') },
          ],
          settings.custom.base === 'light' ? 'light' : 'dark',
          (v) => {
            update({ custom: { ...settings.custom, base: v as 'dark' | 'light' } });
            apply();
          },
        ),
      );
      body.append(group(t('app.customColors'), colors));
    }

    /* ---------------- układ ---------------- */
    const layout = h('div', { class: 'layout-grid' });
    layout.append(
      layoutCard('row', 'layout-h', t('app.layout.row'), apply, rerender),
      layoutCard('column', 'layout-v', t('app.layout.column'), apply, rerender),
    );
    body.append(
      group(
        t('app.layout'),
        layout,
        rowSwitch(t('app.swap'), t('app.swapDesc'), settings.swapped, (v) => {
          update({ swapped: v });
          apply();
        }),
      ),
    );

    /* ---------------- czcionki ---------------- */
    body.append(
      group(
        t('app.font'),
        rowRange(t('app.fontSize'), undefined, 11, 24, 1, settings.fontSize, (v) => {
          update({ fontSize: v });
          apply();
        }, (v) => `${v} px`),
        rowRange(t('app.outFontSize'), undefined, 11, 22, 1, settings.outFontSize, (v) => {
          update({ outFontSize: v });
          apply();
        }, (v) => `${v} px`),
        rowSelect(
          t('app.font'),
          undefined,
          MONO_FONTS.map((f) => ({ value: f.id, label: f.label || t('app.font.default') })),
          settings.monoFont,
          (v) => {
            update({ monoFont: v });
            apply();
          },
        ),
        rowSwitch(t('app.anim'), t('app.animDesc'), settings.animations, (v) => {
          update({ animations: v });
          apply();
        }),
      ),
    );

    body.append(
      h('button', {
        class: 'btn btn-ghost btn-block',
        text: t('app.resetLook'),
        onclick: () => {
          update({
            theme: DEFAULTS.theme,
            custom: { ...DEFAULTS.custom },
            layout: DEFAULTS.layout,
            swapped: DEFAULTS.swapped,
            fontSize: DEFAULTS.fontSize,
            outFontSize: DEFAULTS.outFontSize,
            monoFont: DEFAULTS.monoFont,
            animations: DEFAULTS.animations,
            splitRatio: DEFAULTS.splitRatio,
          });
          apply();
          rerender();
        },
      }),
    );
  };
}

function themeCard(name: Exclude<ThemeName, 'custom'>, apply: () => void, rerender: () => void): HTMLElement {
  const p = THEME_PREVIEW[name];
  const card = h(
    'button',
    {
      class: `theme-card${settings.theme === name ? ' is-active' : ''}`,
      onclick: () => {
        update({ theme: name });
        apply();
        rerender();
      },
    },
    h(
      'div',
      { class: 'theme-prev', style: { background: p.bg } },
      h('div', { class: 'tp-side', style: { background: p.panel } }),
      h(
        'div',
        { class: 'tp-main' },
        h('div', { class: 'tp-line', style: { background: p.accent } }),
        h('div', { class: 'tp-line m', style: { background: p.text, opacity: '0.55' } }),
        h('div', { class: 'tp-line s', style: { background: p.text, opacity: '0.3' } }),
      ),
    ),
    h('div', { class: 'theme-name', text: t(`app.theme.${name}` as I18nKey) }),
  );
  return card;
}

function customCard(apply: () => void, rerender: () => void): HTMLElement {
  const c = settings.custom;
  return h(
    'button',
    {
      class: `theme-card${settings.theme === 'custom' ? ' is-active' : ''}`,
      onclick: () => {
        update({ theme: 'custom' });
        apply();
        rerender();
      },
    },
    h(
      'div',
      { class: 'theme-prev', style: { background: c.bg } },
      h('div', { class: 'tp-side', style: { background: c.panel } }),
      h(
        'div',
        { class: 'tp-main' },
        h('div', { class: 'tp-line', style: { background: c.accent } }),
        h('div', { class: 'tp-line m', style: { background: c.text, opacity: '0.55' } }),
        h('div', { class: 'tp-line s', style: { background: c.text, opacity: '0.3' } }),
      ),
    ),
    h('div', { class: 'theme-name' }, icon('brush', 'i'), h('span', { text: ` ${t('app.theme.custom')}` })),
  );
}

function layoutCard(
  value: 'row' | 'column',
  iconName: string,
  label: string,
  apply: () => void,
  rerender: () => void,
): HTMLElement {
  return h(
    'button',
    {
      class: `layout-card${settings.layout === value ? ' is-active' : ''}`,
      onclick: () => {
        update({ layout: value });
        apply();
        rerender();
      },
    },
    icon(iconName),
    h('span', { text: label }),
  );
}

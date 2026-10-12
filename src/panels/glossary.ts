/* Panel „Słowniczek” — wyszukiwarka prostych wyjaśnień. */

import { CATEGORIES, GLOSSARY, searchGlossary, type GlossCat, type GlossEntry } from '../glossary';
import { t, type I18nKey } from '../i18n';
import { settings } from '../state';
import { copyText, h, icon, toast } from '../ui';

let query = '';
let activeCat: GlossCat | 'all' = 'all';
let openId: string | null = null;

export function setGlossaryQuery(q: string): void {
  query = q;
  activeCat = 'all';
  openId = null;
}

export function glossaryPanel(onInsert: (code: string) => void) {
  return (body: HTMLElement): void => {
    const lang = settings.lang;

    body.append(h('div', { class: 'hint-box', text: t('gloss.intro') }));

    /* --- wyszukiwarka --- */
    const input = h('input', {
      type: 'search',
      placeholder: t('gloss.searchPlaceholder'),
      value: query,
      autocomplete: 'off',
      spellcheck: 'false',
    }) as HTMLInputElement;
    const results = h('div', { class: 'gloss-list' });

    input.addEventListener('input', () => {
      query = input.value;
      renderResults();
    });
    body.append(h('div', { class: 'gloss-search' }, icon('search'), input));

    /* --- kategorie --- */
    const chips = h('div', { class: 'chips' });
    const mkChip = (id: GlossCat | 'all', label: string) => {
      const chip = h('button', {
        class: `chip${activeCat === id ? ' is-active' : ''}`,
        text: label,
        onclick: () => {
          activeCat = id;
          chips.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-active'));
          chip.classList.add('is-active');
          renderResults();
        },
      });
      return chip;
    };
    chips.append(mkChip('all', t('gloss.all')));
    for (const c of CATEGORIES) chips.append(mkChip(c, t(`gloss.cat.${c}` as I18nKey)));
    body.append(chips);

    const counter = h('div', { class: 'share-meta' });
    body.append(counter, results);

    function renderResults(): void {
      const list = searchGlossary(query, lang, activeCat);
      results.innerHTML = '';
      counter.textContent = t('gloss.results', { n: list.length });

      if (!list.length) {
        results.append(h('div', { class: 'empty-state', text: t('gloss.empty') }));
        return;
      }
      for (const e of list) results.append(entryEl(e));
    }

    function entryEl(e: GlossEntry): HTMLElement {
      const isOpen = openId === e.id;
      const wrap = h('article', { class: `gloss-item${isOpen ? ' is-open' : ''}` });

      const head = h(
        'button',
        {
          class: 'gloss-head',
          onclick: () => {
            openId = openId === e.id ? null : e.id;
            renderResults();
          },
        },
        h('span', { class: 'gloss-term', text: e.title[lang] }),
        !isOpen ? h('span', { class: 'gloss-short', text: e.short[lang] }) : null,
      );
      wrap.append(head);

      if (isOpen) {
        const bodyEl = h('div', { class: 'gloss-body' });
        bodyEl.append(h('p', { html: `<strong>${escapeHtml(e.short[lang])}</strong>` }));
        bodyEl.append(h('p', { html: e.body[lang] }));
        if (e.code) {
          bodyEl.append(h('pre', { class: 'gloss-code', text: e.code }));
          bodyEl.append(
            h(
              'div',
              { class: 'gloss-actions' },
              h('button', {
                class: 'btn btn-mini btn-primary',
                text: t('gloss.insert'),
                onclick: () => onInsert(e.code!),
              }),
              h('button', {
                class: 'btn btn-mini',
                text: t('common.copy'),
                onclick: async () => {
                  const ok = await copyText(e.code!);
                  toast(ok ? t('toast.copied') : t('toast.copyFail'), ok ? 'ok' : 'err');
                },
              }),
            ),
          );
        }
        wrap.append(bodyEl);
      }
      return wrap;
    }

    renderResults();
    if (!query) setTimeout(() => input.focus(), 50);
  };
}

export function glossaryCount(): number {
  return GLOSSARY.length;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

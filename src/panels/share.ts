/* Okno „Udostępnij pracę” — link do wysłania nauczycielowi. */

import { t } from '../i18n';
import { settings, update } from '../state';
import { buildLink, createShortLink, encodePayload, type SharePayload } from '../share';
import { closeModal, copyText, h, icon, openModal, toast } from '../ui';

export interface ShareContext {
  code: string;
  stdin: string;
  output: string;
}

export function openShareModal(getCtx: () => ShareContext): void {
  openModal(t('share.title'), (body) => {
    const ctx = getCtx();
    let currentLink = '';
    let isShort = false;

    const linkInput = h('input', { type: 'text', readonly: 'readonly', spellcheck: 'false' }) as HTMLInputElement;
    const meta = h('div', { class: 'share-meta' });

    const buildPayload = (): SharePayload => ({
      v: 1,
      c: ctx.code,
      i: settings.shareIncludeStdin && ctx.stdin.trim() ? ctx.stdin : undefined,
      o: settings.shareIncludeOutput && ctx.output.trim() ? ctx.output.slice(0, 4000) : undefined,
      b: settings.authorName.trim() || undefined,
      s: settings.std,
      l: settings.lang,
    });

    const refresh = (): void => {
      currentLink = buildLink(`c=${encodePayload(buildPayload())}`);
      isShort = false;
      linkInput.value = currentLink;
      renderMeta();
    };

    const renderMeta = (): void => {
      meta.innerHTML = '';
      meta.append(
        h('span', { class: `badge${isShort ? ' is-ok' : ''}`, text: isShort ? t('share.short') : t('share.full') }),
        h('span', { text: t('share.length', { n: currentLink.length }) }),
      );
      if (!isShort && currentLink.length > 7000) {
        meta.append(h('span', { class: 'badge', text: '⚠ ' + t('toast.linkTooLong') }));
      }
    };

    /* --------- opis --------- */
    body.append(h('div', { class: 'hint-box', text: t('share.desc') }));

    /* --------- podpis --------- */
    const author = h('input', {
      class: 'txt',
      type: 'text',
      placeholder: t('set.authorPlaceholder'),
      value: settings.authorName,
      style: { width: '100%', height: '38px' },
    }) as HTMLInputElement;
    author.addEventListener('input', () => {
      update({ authorName: author.value });
      refresh();
    });
    body.append(h('label', { class: 'row-label', style: { marginBottom: '6px', display: 'block' } }, h('b', { text: t('share.author') })), author);

    /* --------- opcje --------- */
    const optStdin = checkbox(t('share.includeStdin'), settings.shareIncludeStdin, (v) => {
      update({ shareIncludeStdin: v });
      refresh();
    });
    const optOut = checkbox(t('share.includeOutput'), settings.shareIncludeOutput, (v) => {
      update({ shareIncludeOutput: v });
      refresh();
    });
    body.append(h('div', { style: { display: 'flex', gap: '18px', margin: '14px 0 16px', flexWrap: 'wrap' } }, optStdin, optOut));

    /* --------- link --------- */
    body.append(h('label', { class: 'row-label', style: { marginBottom: '6px', display: 'block' } }, h('b', { text: t('share.linkLabel') })));

    const copyBtn = h(
      'button',
      {
        class: 'btn btn-primary',
        onclick: async () => {
          const ok = await copyText(currentLink);
          toast(ok ? t('toast.copied') : t('toast.copyFail'), ok ? 'ok' : 'err');
        },
      },
      icon('copy'),
      h('span', { text: t('common.copy') }),
    );
    body.append(h('div', { class: 'share-link' }, linkInput, copyBtn), meta);

    /* --------- akcje --------- */
    const shortBtn = h(
      'button',
      {
        class: 'btn btn-ghost',
        onclick: async () => {
          const label = shortBtn.querySelector('span')!;
          const old = label.textContent ?? '';
          label.textContent = t('share.shortening');
          (shortBtn as HTMLButtonElement).disabled = true;
          const link = await createShortLink(buildPayload());
          (shortBtn as HTMLButtonElement).disabled = false;
          label.textContent = old;
          if (link) {
            currentLink = link;
            isShort = true;
            linkInput.value = link;
            renderMeta();
            const ok = await copyText(link);
            toast(ok ? `${t('share.shortOk')} ${t('toast.copied')}` : t('share.shortOk'), 'ok', 4000);
          } else {
            toast(t('share.shortFail'), 'err', 5000);
          }
        },
      },
      icon('share'),
      h('span', { text: t('share.shorten') }),
    );

    body.append(
      h(
        'div',
        { style: { display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' } },
        shortBtn,
        h('button', {
          class: 'btn btn-ghost',
          text: t('share.open'),
          onclick: () => window.open(currentLink, '_blank', 'noopener'),
        }),
        h('div', { class: 'spacer', style: { flex: '1 1 auto' } }),
        h('button', { class: 'btn btn-ghost', text: t('common.close'), onclick: () => closeModal() }),
      ),
    );

    refresh();
    setTimeout(() => {
      linkInput.focus();
      linkInput.select();
    }, 60);
  });
}

function checkbox(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const input = h('input', { type: 'checkbox' }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  return h(
    'label',
    { style: { display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' } },
    h('span', { class: 'switch', style: { transform: 'scale(.85)' } }, input, h('span', { class: 'track' }), h('span', { class: 'thumb' })),
    h('span', { text: label }),
  );
}

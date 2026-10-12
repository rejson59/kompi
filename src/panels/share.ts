/* Okno „Udostępnij pracę” — prosty link do wysłania nauczycielowi oraz opcja pobrania pliku .cpp. */

import { t } from '../i18n';
import { settings, update } from '../state';
import { buildLink, createShortLink, encodePayload, type SharePayload } from '../share';
import { closeModal, copyText, h, icon, openModal, toast } from '../ui';

export interface ShareContext {
  code: string;
  title: string;
  stdin: string;
  output: string;
}

function ensureCppFileName(rawTitle: string): string {
  const clean = (rawTitle || 'powitanie.cpp').trim().replace(/[\\/:*?"<>|]+/g, '_');
  if (/\.(cpp|cc|cxx|c|h|hpp)$/i.test(clean)) return clean;
  return `${clean}.cpp`;
}

export function openShareModal(getCtx: () => ShareContext): void {
  openModal(t('share.title'), (body) => {
    const ctx = getCtx();
    const fileName = ensureCppFileName(ctx.title);
    let currentLink = '';

    const linkInput = h('input', { type: 'text', readonly: 'readonly', spellcheck: 'false' }) as HTMLInputElement;

    const buildPayload = (): SharePayload => ({
      v: 1,
      c: ctx.code,
      b: settings.authorName.trim() || undefined,
      s: settings.std,
      l: settings.lang,
    });

    const refresh = (): void => {
      currentLink = buildLink(`c=${encodePayload(buildPayload())}`);
      linkInput.value = currentLink;
    };

    /* --------- opis --------- */
    body.append(h('div', { class: 'hint-box', text: t('share.desc') }));

    /* --------- podpis --------- */
    const author = h('input', {
      class: 'txt',
      type: 'text',
      placeholder: t('set.authorPlaceholder'),
      value: settings.authorName,
      style: { width: '100%', height: '38px', marginBottom: '14px' },
    }) as HTMLInputElement;
    author.addEventListener('input', () => {
      update({ authorName: author.value });
      refresh();
    });
    body.append(
      h('label', { class: 'row-label', style: { marginBottom: '6px', display: 'block' } }, h('b', { text: t('share.author') })),
      author,
    );

    /* --------- link --------- */
    body.append(
      h('label', { class: 'row-label', style: { marginBottom: '6px', display: 'block' } }, h('b', { text: t('share.linkLabel') })),
    );

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
    body.append(h('div', { class: 'share-link' }, linkInput, copyBtn));

    /* --------- pobieranie pliku + skracanie linku --------- */
    const downloadBtn = h(
      'button',
      {
        type: 'button',
        class: 'btn',
        onclick: () => {
          const blob = new Blob([ctx.code], { type: 'text/plain;charset=utf-8' });
          const a = h('a', { href: URL.createObjectURL(blob), download: fileName }) as HTMLAnchorElement;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          toast(t('toast.downloaded'), 'ok');
        },
      },
      icon('download'),
      h('span', { text: `${t('share.downloadFile')} (${fileName})` }),
    );

    const shortBtn = h(
      'button',
      {
        type: 'button',
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
            linkInput.value = link;
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
        { style: { display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap', alignItems: 'center' } },
        downloadBtn,
        shortBtn,
        h('div', { class: 'spacer', style: { flex: '1 1 auto' } }),
        h('button', { type: 'button', class: 'btn btn-ghost', text: t('common.close'), onclick: () => closeModal() }),
      ),
    );

    refresh();
    setTimeout(() => {
      linkInput.focus();
      linkInput.select();
    }, 60);
  });
}

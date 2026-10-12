/* Okno „Ostatnie kody” — automatycznie zapisywane kody w przeglądarce
   z możliwością zmiany tytułu (np. przyklad.cpp, nowy1.cpp), wczytania, usunięcia lub utworzenia nowego kodu. */

import { DEFAULT_CODE } from '../examples';
import { t } from '../i18n';
import {
  clearAllSavedCodes,
  createNewSavedCode,
  deleteSavedCode,
  ensureActiveCodeItem,
  getActiveCodeId,
  loadSavedCodes,
  renameSavedCode,
  setActiveCodeId,
  settings,
  type SavedCodeItem,
} from '../state';
import { closeModal, h, icon, openModal, toast } from '../ui';

export interface SavedModalCallbacks {
  onSelect: (item: SavedCodeItem) => void;
  onRenameActive: (newTitle: string) => void;
  onUploadClick: () => void;
}

export function openSavedCodesModal(cb: SavedModalCallbacks): void {
  openModal(t('saved.title'), (body) => {
    const topActions = h('div', { class: 'saved-top-actions' });
    const topBar = h(
      'div',
      { class: 'saved-top-bar' },
      h('span', { class: 'saved-auto-hint', text: t('saved.autoHint') }),
      topActions,
    );

    const listWrap = h('div', { class: 'saved-list' });
    body.append(topBar, listWrap);

    function renderList(): void {
      listWrap.innerHTML = '';
      topActions.innerHTML = '';

      const items = loadSavedCodes();
      const activeId = getActiveCodeId();

      topActions.append(
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-mini btn-primary',
            onclick: () => {
              const created = createNewSavedCode(DEFAULT_CODE);
              cb.onSelect(created);
              closeModal();
            },
          },
          icon('plus'),
          h('span', { text: t('saved.newCode') }),
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-mini',
            onclick: () => {
              closeModal();
              cb.onUploadClick();
            },
          },
          icon('upload'),
          h('span', { text: t('saved.uploadBtn') }),
        ),
      );

      if (items.length > 1) {
        topActions.append(
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn-mini btn-danger-soft',
              onclick: () => {
                clearAllSavedCodes();
                const fresh = ensureActiveCodeItem(DEFAULT_CODE);
                cb.onSelect(fresh);
                renderList();
              },
            },
            icon('trash'),
            h('span', { text: t('saved.deleteAll') }),
          ),
        );
      }

      if (items.length === 0) {
        listWrap.append(h('div', { class: 'empty-state', text: t('saved.empty') }));
        return;
      }

      for (const item of items) {
        const isCurrent = item.id === activeId;
        const previewLines = item.code
          .split('\n')
          .map((l) => l.trimEnd())
          .filter((l) => l.trim().length > 0)
          .slice(0, 3)
          .join('\n');

        const titleInput = h('input', {
          type: 'text',
          class: 'saved-title-edit',
          value: item.title,
          maxlength: '40',
          spellcheck: 'false',
          title: t('saved.titleTooltip'),
          onchange: () => {
            const finalTitle = renameSavedCode(item.id, titleInput.value);
            titleInput.value = finalTitle;
            if (isCurrent) cb.onRenameActive(finalTitle);
          },
        }) as HTMLInputElement;

        const card = h(
          'div',
          { class: `saved-item${isCurrent ? ' is-current' : ''}` },
          h(
            'div',
            { class: 'saved-item-head' },
            h(
              'div',
              { class: 'saved-item-title-wrap' },
              titleInput,
              h('span', { class: 'saved-item-time', text: formatTime(item.updatedAt) }),
            ),
            h(
              'div',
              { class: 'saved-item-actions' },
              isCurrent
                ? h('span', { class: 'badge saved-active-badge', text: t('saved.activeTag') })
                : h(
                    'button',
                    {
                      type: 'button',
                      class: 'btn btn-mini btn-primary',
                      onclick: () => {
                        setActiveCodeId(item.id);
                        cb.onSelect(item);
                        closeModal();
                        toast(t('toast.loadedLocal'), 'ok');
                      },
                    },
                    h('span', { text: t('saved.load') }),
                  ),
              h(
                'button',
                {
                  type: 'button',
                  class: 'btn btn-mini btn-danger-soft',
                  title: t('saved.delete'),
                  onclick: () => {
                    deleteSavedCode(item.id);
                    const remaining = loadSavedCodes();
                    if (remaining.length === 0) {
                      const fresh = ensureActiveCodeItem(DEFAULT_CODE);
                      cb.onSelect(fresh);
                    } else if (isCurrent && remaining[0]) {
                      setActiveCodeId(remaining[0].id);
                      cb.onSelect(remaining[0]);
                    }
                    renderList();
                  },
                },
                icon('trash'),
                h('span', { text: t('saved.delete') }),
              ),
            ),
          ),
          h('pre', { class: 'saved-code-preview', text: previewLines }),
        );

        listWrap.append(card);
      }
    }

    renderList();
  });
}

function formatTime(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  const isPl = settings.lang === 'pl';
  if (diffSec < 45) return isPl ? 'przed chwilą' : 'just now';
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return isPl ? `${m} min temu` : `${m}m ago`;
  }
  const d = new Date(ts);
  const now = new Date();
  const timeStr = d.toLocaleTimeString(isPl ? 'pl-PL' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) {
    return isPl ? `dziś, ${timeStr}` : `today, ${timeStr}`;
  }
  const dateStr = d.toLocaleDateString(isPl ? 'pl-PL' : 'en-US', { day: 'numeric', month: 'short' });
  return `${dateStr}, ${timeStr}`;
}

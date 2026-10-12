/* Maskotka „Kompi” — SVG w kilku nastrojach + interaktywny samouczek krok po kroku
   z ostrym wycięciem (spotlight) i przyciemnieniem reszty ekranu. */

import { t } from './i18n';
import { h } from './ui';

export type KompiMood = 'happy' | 'wave' | 'code' | 'run' | 'help';

const TUTORIAL_KEY = 'kompi.tutorial.done.v1';

/**
 * Zwraca wektorową ilustrację maskotki Kompi w wybranym nastroju.
 * Używana zarówno jako logo w pasku górnym, jak i duża animowana postać w samouczku.
 */
export function kompiMascotSvg(mood: KompiMood = 'happy', cls = 'kompi-svg'): HTMLElement {
  let eyes = '';
  let mouth = '';
  let extra = '';
  let antennaColor = '#34d399';

  switch (mood) {
    case 'wave':
      antennaColor = '#638eff';
      eyes = `
        <path d="M27 39c1.5-2.8 4.5-2.8 6 0" fill="none" stroke="#67e8f9" stroke-width="2.8" stroke-linecap="round"/>
        <path d="M47 39c1.5-2.8 4.5-2.8 6 0" fill="none" stroke="#67e8f9" stroke-width="2.8" stroke-linecap="round"/>
      `;
      mouth = `<path d="M35 46.5c2 2.8 8 2.8 10 0" fill="none" stroke="#67e8f9" stroke-width="2.5" stroke-linecap="round"/>`;
      extra = `
        <g class="kompi-paw-wave">
          <rect x="63" y="29" width="11" height="15" rx="5.5" fill="url(#k-body)" stroke="#4c586e" stroke-width="1.2"/>
        </g>
      `;
      break;

    case 'code':
      antennaColor = '#82aaff';
      eyes = `
        <path d="M32 36l-4 3.2 4 3.2" fill="none" stroke="#82aaff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M48 36l4 3.2-4 3.2" fill="none" stroke="#82aaff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      `;
      mouth = `<rect x="36.5" y="46.5" width="7" height="2.4" rx="1.2" fill="#34d399"/>`;
      break;

    case 'run':
      antennaColor = '#22c55e';
      eyes = `
        <path d="M30 34.5l1.3 3.2 3.2 1.3-3.2 1.3-1.3 3.2-1.3-3.2-3.2-1.3 3.2-1.3z" fill="#34d399"/>
        <path d="M50 34.5l1.3 3.2 3.2 1.3-3.2 1.3-1.3 3.2-1.3-3.2-3.2-1.3 3.2-1.3z" fill="#34d399"/>
      `;
      mouth = `<path d="M34.5 45.5c2.2 3.5 8.8 3.5 11 0z" fill="#34d399"/>`;
      break;

    case 'help':
      antennaColor = '#f5b83d';
      eyes = `
        <circle cx="30" cy="39" r="3.4" fill="#67e8f9"/>
        <circle cx="31.1" cy="37.8" r="1.1" fill="#ffffff"/>
        <circle cx="50" cy="39" r="3.4" fill="#67e8f9"/>
        <circle cx="51.1" cy="37.8" r="1.1" fill="#ffffff"/>
      `;
      mouth = `<path d="M36 46.5c1.8 2.2 6.2 2.2 8 0" fill="none" stroke="#67e8f9" stroke-width="2.4" stroke-linecap="round"/>`;
      extra = `
        <circle cx="65" cy="20" r="7" fill="#f5b83d" opacity="0.22"/>
        <circle cx="65" cy="20" r="4.2" fill="#f5b83d"/>
      `;
      break;

    case 'happy':
    default:
      antennaColor = '#34d399';
      eyes = `
        <g class="kompi-eyes">
          <circle cx="30" cy="39" r="3.4" fill="#67e8f9"/>
          <circle cx="31.2" cy="37.8" r="1.15" fill="#ffffff"/>
          <circle cx="50" cy="39" r="3.4" fill="#67e8f9"/>
          <circle cx="51.2" cy="37.8" r="1.15" fill="#ffffff"/>
        </g>
      `;
      mouth = `<path d="M35.5 46.2c1.8 2.4 7.2 2.4 9 0" fill="none" stroke="#67e8f9" stroke-width="2.4" stroke-linecap="round"/>`;
      break;
  }

  const wrap = h('span', { class: `kompi-mascot is-${mood}` });
  wrap.innerHTML = `
    <svg class="${cls}" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="k-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f0f5fc"/>
          <stop offset="55%" stop-color="#d8e2f0"/>
          <stop offset="100%" stop-color="#b8c6db"/>
        </linearGradient>
        <linearGradient id="k-ear" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#7c9fff"/>
          <stop offset="100%" stop-color="#4b74e8"/>
        </linearGradient>
        <linearGradient id="k-visor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#141923"/>
          <stop offset="100%" stop-color="#1e2636"/>
        </linearGradient>
      </defs>

      <!-- Antenka -->
      <g class="kompi-antenna">
        <path d="M40 19V10" stroke="#7c8da6" stroke-width="3.2" stroke-linecap="round"/>
        <circle cx="40" cy="8.5" r="5" fill="${antennaColor}"/>
        <circle cx="38.5" cy="7" r="1.6" fill="#ffffff" opacity="0.8"/>
      </g>

      <!-- Uszka / słuchawki boczne -->
      <rect x="9" y="33" width="8" height="18" rx="4" fill="url(#k-ear)"/>
      <rect x="63" y="33" width="8" height="18" rx="4" fill="url(#k-ear)"/>

      <!-- Główna bryła główki (neumorficzna kapsuła) -->
      <rect x="14" y="18" width="52" height="48" rx="18" fill="url(#k-body)" stroke="#ffffff" stroke-opacity="0.65" stroke-width="1.2"/>

      <!-- Wklęsły ekranik twarzy -->
      <rect x="20" y="25" width="40" height="31" rx="12" fill="url(#k-visor)" stroke="#0e121a" stroke-width="1.2"/>

      <!-- Delikatny odblask na szybce -->
      <path d="M25 28.5h14" stroke="#ffffff" stroke-opacity="0.16" stroke-width="2" stroke-linecap="round"/>

      <!-- Rumieńce -->
      <ellipse cx="25.5" cy="44.5" rx="2.6" ry="1.4" fill="#ff7eb6" opacity="0.45"/>
      <ellipse cx="54.5" cy="44.5" rx="2.6" ry="1.4" fill="#ff7eb6" opacity="0.45"/>

      <!-- Oczy i uśmiech -->
      ${eyes}
      ${mouth}

      <!-- Mały znaczek C++ na brzuszku/brodzie -->
      <circle cx="40" cy="61" r="2.2" fill="#638eff" opacity="0.75"/>

      ${extra}
    </svg>
  `;
  return wrap;
}

/* =========================================================================
   Interaktywny samouczek z Kompim
   ========================================================================= */

interface TutorialStep {
  mood: KompiMood;
  titleKey: string;
  bodyKey: string;
  targetSelector?: string;
  pad?: number;
  radius?: number;
  cardPlacement?: 'center' | 'right' | 'left' | 'top-center' | 'top-right';
}

const STEPS: TutorialStep[] = [
  {
    mood: 'wave',
    titleKey: 'tut.0.title',
    bodyKey: 'tut.0.body',
    cardPlacement: 'center',
  },
  {
    mood: 'code',
    titleKey: 'tut.1.title',
    bodyKey: 'tut.1.body',
    targetSelector: '#pane-editor',
    pad: 4,
    radius: 24,
    cardPlacement: 'right',
  },
  {
    mood: 'run',
    titleKey: 'tut.2.title',
    bodyKey: 'tut.2.body',
    targetSelector: '.topbar-center',
    pad: 5,
    radius: 18,
    cardPlacement: 'top-center',
  },
  {
    mood: 'happy',
    titleKey: 'tut.3.title',
    bodyKey: 'tut.3.body',
    targetSelector: '#pane-output',
    pad: 4,
    radius: 24,
    cardPlacement: 'left',
  },
  {
    mood: 'help',
    titleKey: 'tut.4.title',
    bodyKey: 'tut.4.body',
    targetSelector: '.topbar-actions',
    pad: 6,
    radius: 16,
    cardPlacement: 'top-right',
  },
  {
    mood: 'happy',
    titleKey: 'tut.5.title',
    bodyKey: 'tut.5.body',
    targetSelector: '.topbar-actions',
    pad: 6,
    radius: 16,
    cardPlacement: 'top-right',
  },
];

let currentStep = 0;
let overlayEl: HTMLElement | null = null;
let spotlightEl: HTMLElement | null = null;
let cardWrapEl: HTMLElement | null = null;

function updateSpotlightPosition(): void {
  if (!overlayEl || !spotlightEl) return;
  const step = STEPS[currentStep];
  if (!step.targetSelector) {
    overlayEl.classList.add('is-full-dim');
    spotlightEl.classList.add('is-hidden');
    return;
  }

  const target = document.querySelector<HTMLElement>(step.targetSelector);
  if (!target) {
    overlayEl.classList.add('is-full-dim');
    spotlightEl.classList.add('is-hidden');
    return;
  }

  overlayEl.classList.remove('is-full-dim');
  spotlightEl.classList.remove('is-hidden');

  const rect = target.getBoundingClientRect();
  const pad = step.pad ?? 6;
  const radius = step.radius ?? 18;

  spotlightEl.style.top = `${Math.round(rect.top - pad)}px`;
  spotlightEl.style.left = `${Math.round(rect.left - pad)}px`;
  spotlightEl.style.width = `${Math.round(rect.width + pad * 2)}px`;
  spotlightEl.style.height = `${Math.round(rect.height + pad * 2)}px`;
  spotlightEl.style.borderRadius = `${radius}px`;
}

export function isTutorialOpen(): boolean {
  return overlayEl !== null;
}

export function closeTutorial(markDone = true): void {
  window.removeEventListener('resize', updateSpotlightPosition);
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
    spotlightEl = null;
    cardWrapEl = null;
  }
  if (markDone) {
    try {
      localStorage.setItem(TUTORIAL_KEY, '1');
    } catch {
      /* ignorujemy */
    }
  }
}

export function startTutorial(stepIndex = 0): void {
  closeTutorial(false);
  currentStep = Math.max(0, Math.min(STEPS.length - 1, stepIndex));

  spotlightEl = h('div', { class: 'tut-spotlight is-hidden' });
  cardWrapEl = h('div', { class: 'tut-card-wrap' });
  overlayEl = h(
    'div',
    {
      class: 'tut-overlay',
      role: 'dialog',
      'aria-modal': 'true',
    },
    spotlightEl,
    cardWrapEl,
  );

  document.body.append(overlayEl);
  window.addEventListener('resize', updateSpotlightPosition);
  renderStep();
}

export function rerenderTutorialIfOpen(): void {
  if (!overlayEl) return;
  renderStep();
}

function renderStep(): void {
  if (!overlayEl || !cardWrapEl) return;
  cardWrapEl.innerHTML = '';

  const step = STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;

  cardWrapEl.className = `tut-card-wrap pos-${step.cardPlacement ?? 'center'}`;
  updateSpotlightPosition();

  /* Kropki postępu */
  const dots = h(
    'div',
    { class: 'tut-dots' },
    ...STEPS.map((_, idx) =>
      h('button', {
        type: 'button',
        class: `tut-dot${idx === currentStep ? ' is-active' : ''}`,
        'aria-label': `${idx + 1} / ${STEPS.length}`,
        onclick: () => {
          currentStep = idx;
          renderStep();
        },
      }),
    ),
  );

  /* Przyciski nawigacji */
  const skipBtn = h('button', {
    type: 'button',
    class: 'btn btn-ghost btn-mini tut-skip',
    text: t('tut.skip' as never),
    onclick: () => closeTutorial(true),
  });

  const prevBtn = !isFirst
    ? h('button', {
        type: 'button',
        class: 'btn btn-ghost',
        text: t('tut.prev' as never),
        onclick: () => {
          currentStep--;
          renderStep();
        },
      })
    : null;

  const nextBtn = h('button', {
    type: 'button',
    class: 'btn btn-primary',
    text: isLast ? t('tut.finish' as never) : isFirst ? t('tut.start' as never) : t('tut.next' as never),
    onclick: () => {
      if (isLast) {
        closeTutorial(true);
      } else {
        currentStep++;
        renderStep();
      }
    },
  });

  const card = h(
    'div',
    { class: 'tut-card' },
    h(
      'div',
      { class: 'tut-top' },
      h('div', { class: 'tut-avatar' }, kompiMascotSvg(step.mood, 'kompi-tut-svg')),
      h(
        'div',
        { class: 'tut-content' },
        h(
          'div',
          { class: 'tut-step-head' },
          h('span', { class: 'tut-badge', text: `Kompi • ${currentStep + 1}/${STEPS.length}` }),
          !isLast ? skipBtn : null,
        ),
        h('h3', { class: 'tut-title', text: t(step.titleKey as never) }),
        h('p', { class: 'tut-body', html: t(step.bodyKey as never) }),
      ),
    ),
    h(
      'div',
      { class: 'tut-foot' },
      dots,
      h('div', { class: 'spacer' }),
      prevBtn,
      nextBtn,
    ),
  );

  cardWrapEl.append(card);
  setTimeout(() => nextBtn.focus(), 30);
}

/** Uruchamia samouczek automatycznie przy pierwszej wizycie. */
export function maybeAutoStartTutorial(): void {
  try {
    if (!localStorage.getItem(TUTORIAL_KEY)) {
      startTutorial(0);
    }
  } catch {
    startTutorial(0);
  }
}

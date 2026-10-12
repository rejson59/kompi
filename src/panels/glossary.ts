/* Panel „Zapytaj Kompiego” — przyjazny czat-bot z bazą wiedzy C++ (bez AI).
   Zamiast przytłaczającej ściany haseł użytkownik rozmawia z Kompim,
   klika gotowe podpowiedzi lub wpisuje własne pytania po polsku/angielsku. */

import { CATEGORIES, GLOSSARY, normalize, type GlossCat, type GlossEntry } from '../glossary';
import { t, type I18nKey } from '../i18n';
import { kompiMascotSvg, type KompiMood } from '../mascot';
import { settings, type Lang } from '../state';
import { copyText, h, toast } from '../ui';

interface ChatMessage {
  role: 'bot' | 'user';
  mood?: KompiMood;
  title?: string;
  html: string;
  code?: string;
  chips?: Array<{ label: string; action: () => void }>;
}

/** Historia wiadomości zachowywana na czas sesji */
let messages: ChatMessage[] = [];
let lastLang: Lang | null = null;

const STOP_WORDS = new Set([
  'jak', 'co', 'to', 'jest', 'sa', 'w', 'z', 'na', 'do', 'po', 'o', 'od', 'czy',
  'mi', 'sie', 'zrobic', 'napisac', 'uzyc', 'dziala', 'znaczy', 'oznacza', 'dlaczego',
  'mam', 'blad', 'wyskakuje', 'nie', 'wiem', 'pomoz', 'prosze', 'kompi', 'cpp', 'c++',
  'what', 'is', 'are', 'how', 'to', 'do', 'does', 'in', 'a', 'an', 'the', 'use', 'make',
  'why', 'my', 'code', 'work', 'mean', 'means', 'can', 'you', 'explain', 'help',
]);

/** Szybkie pytania startowe dla początkujących */
const STARTER_IDS = ['main', 'cout', 'variable', 'if', 'for', 'err-semicolon'];

export function glossaryPanel(onInsert: (code: string) => void) {
  return (body: HTMLElement): void => {
    const lang = settings.lang;

    if (lastLang !== lang || messages.length === 0) {
      lastLang = lang;
      messages = [createWelcomeMessage(lang)];
    }

    const logEl = h('div', { class: 'kompi-chat-log' });

    const inputEl = h('input', {
      type: 'text',
      class: 'kompi-chat-input',
      placeholder: t('gloss.searchPlaceholder'),
      autocomplete: 'off',
      spellcheck: 'false',
    }) as HTMLInputElement;

    const sendBtn = h(
      'button',
      {
        type: 'submit',
        class: 'btn btn-primary kompi-chat-send',
        title: t('chat.send' as I18nKey),
      },
      h('span', { text: t('chat.send' as I18nKey) }),
    );

    const formEl = h(
      'form',
      {
        class: 'kompi-chat-bar',
        onsubmit: (e: Event) => {
          e.preventDefault();
          const text = inputEl.value.trim();
          if (!text) return;
          inputEl.value = '';
          askUserText(text);
        },
      },
      inputEl,
      sendBtn,
    );

    const disclaimerEl = h('div', {
      class: 'kompi-disclaimer is-chat',
      text: t('kompi.disclaimer'),
    });

    const wrapEl = h('div', { class: 'kompi-chat-wrap' }, logEl, formEl, disclaimerEl);
    body.append(wrapEl);

    function createWelcomeMessage(l: Lang): ChatMessage {
      const starters = STARTER_IDS.map((id) => GLOSSARY.find((e) => e.id === id)).filter(
        (e): e is GlossEntry => Boolean(e),
      );
      return {
        role: 'bot',
        mood: 'wave',
        title: l === 'pl' ? 'Cześć! Jestem Kompi 🤖' : 'Hi! I’m Kompi 🤖',
        html: t('gloss.intro'),
        chips: [
          ...starters.map((entry) => ({
            label: shortChipTitle(entry.title[l]),
            action: () => answerWithEntry(entry, shortChipTitle(entry.title[l])),
          })),
          {
            label: l === 'pl' ? '📚 Wszystkie kategorie' : '📚 All categories',
            action: () => showCategories(l === 'pl' ? 'Pokaż kategorie' : 'Show categories'),
          },
        ],
      };
    }

    function showCategories(userLabel?: string): void {
      if (userLabel) {
        messages.push({ role: 'user', html: escapeHtml(userLabel) });
      }
      const l = settings.lang;
      messages.push({
        role: 'bot',
        mood: 'help',
        title: l === 'pl' ? 'Wybierz temat, który Cię ciekawi:' : 'Pick a topic you want to explore:',
        html:
          l === 'pl'
            ? 'Kliknij jedną z kategorii poniżej, a pokażę Ci najważniejsze pojęcia krok po kroku:'
            : 'Click any category below and I’ll list the key concepts step by step:',
        chips: CATEGORIES.map((cat) => ({
          label: t(`gloss.cat.${cat}` as I18nKey),
          action: () => showCategoryEntries(cat),
        })),
      });
      renderLog(true);
    }

    function showCategoryEntries(cat: GlossCat): void {
      const l = settings.lang;
      const catLabel = t(`gloss.cat.${cat}` as I18nKey);
      messages.push({ role: 'user', html: escapeHtml(catLabel) });

      const entries = GLOSSARY.filter((e) => e.cat === cat);
      messages.push({
        role: 'bot',
        mood: 'happy',
        title: `${catLabel} (${entries.length})`,
        html:
          l === 'pl'
            ? 'O czym dokładnie chcesz przeczytać? Kliknij hasło:'
            : 'Which one would you like me to explain? Click a topic:',
        chips: [
          ...entries.map((entry) => ({
            label: shortChipTitle(entry.title[l]),
            action: () => answerWithEntry(entry, shortChipTitle(entry.title[l])),
          })),
          {
            label: l === 'pl' ? '↩ Wróć do kategorii' : '↩ Back to categories',
            action: () => showCategories(),
          },
        ],
      });
      renderLog(true);
    }

    function answerWithEntry(entry: GlossEntry, userText?: string, related?: GlossEntry[]): void {
      const l = settings.lang;
      if (userText) {
        messages.push({ role: 'user', html: escapeHtml(userText) });
      }

      const siblings =
        related && related.length
          ? related
          : GLOSSARY.filter((e) => e.cat === entry.cat && e.id !== entry.id).slice(0, 3);

      const mood: KompiMood =
        entry.cat === 'errors' ? 'help' : entry.code ? 'code' : 'happy';

      messages.push({
        role: 'bot',
        mood,
        title: entry.title[l],
        html: `<p><strong>${escapeHtml(entry.short[l])}</strong></p><p>${entry.body[l]}</p>`,
        code: entry.code,
        chips: [
          ...siblings.map((sib) => ({
            label: shortChipTitle(sib.title[l]),
            action: () => answerWithEntry(sib, shortChipTitle(sib.title[l])),
          })),
          {
            label: l === 'pl' ? '📚 Inne tematy' : '📚 Other topics',
            action: () => showCategories(),
          },
        ],
      });
      renderLog(true);
    }

    function askUserText(raw: string): void {
      const l = settings.lang;
      const q = normalize(raw);

      /* 1. Sprawdzenie prostych zwrotów konwersacyjnych */
      if (/^(czesc|hej|siema|witam|halo|dzien dobry|hi|hello|hey|yo)\b/.test(q)) {
        messages.push({ role: 'user', html: escapeHtml(raw) });
        messages.push({
          role: 'bot',
          mood: 'wave',
          title: l === 'pl' ? 'Hej! Co dziś kodujemy? 😊' : 'Hey there! What are we coding today? 😊',
          html:
            l === 'pl'
              ? 'Napisz np. <code>pętla for</code>, <code>jak działa if</code> albo kliknij jeden z tematów poniżej:'
              : 'Type e.g. <code>for loop</code>, <code>how if works</code>, or pick a topic below:',
          chips: createWelcomeMessage(l).chips,
        });
        renderLog(true);
        return;
      }

      if (/^(dzieki|dziekuje|super|fajnie|ok|extra|thanks|thank you|thx|cool)\b/.test(q)) {
        messages.push({ role: 'user', html: escapeHtml(raw) });
        messages.push({
          role: 'bot',
          mood: 'happy',
          title: l === 'pl' ? 'Zawsze do usług! 🙌' : 'Happy to help! 🙌',
          html:
            l === 'pl'
              ? 'Trzymam kciuki za Twój program! Gdyby coś jeszcze sprawiło trudność, pytaj śmiało.'
              : 'Fingers crossed for your code! Ask me anytime if you get stuck again.',
          chips: [
            {
              label: l === 'pl' ? '📚 Pokaż kategorie' : '📚 Show categories',
              action: () => showCategories(),
            },
          ],
        });
        renderLog(true);
        return;
      }

      if (/^(tematy|kategorie|lista|wszystko|pomoc|topics|categories|all|help)$/.test(q)) {
        showCategories(raw);
        return;
      }

      /* 2. Inteligentne dopasowanie do bazy wiedzy C++ */
      const matches = findBestEntries(raw, l);
      if (matches.length > 0) {
        const best = matches[0];
        const others = matches.slice(1, 4);
        answerWithEntry(best, raw, others);
        return;
      }

      /* 3. Brak trafienia — łagodna podpowiedź z propozycjami */
      messages.push({ role: 'user', html: escapeHtml(raw) });
      messages.push({
        role: 'bot',
        mood: 'help',
        title: l === 'pl' ? 'Hmm, tego słowa jeszcze nie znam 🤔' : 'Hmm, I don’t know that word yet 🤔',
        html: t('gloss.empty'),
        chips: createWelcomeMessage(l).chips,
      });
      renderLog(true);
    }

    function renderLog(scrollToBottom = false): void {
      logEl.innerHTML = '';
      for (const m of messages) {
        if (m.role === 'user') {
          logEl.append(
            h(
              'div',
              { class: 'chat-msg is-user' },
              h('div', { class: 'chat-bubble is-user', html: m.html }),
            ),
          );
          continue;
        }

        const bubble = h('div', { class: 'chat-bubble is-bot' });
        if (m.title) {
          bubble.append(h('div', { class: 'chat-title', text: m.title }));
        }
        bubble.append(h('div', { class: 'chat-text', html: m.html }));

        if (m.code) {
          const codeText = m.code;
          bubble.append(
            h('pre', { class: 'gloss-code', text: codeText }),
            h(
              'div',
              { class: 'gloss-actions' },
              h('button', {
                type: 'button',
                class: 'btn btn-mini btn-primary',
                text: t('gloss.insert'),
                onclick: () => onInsert(codeText),
              }),
              h('button', {
                type: 'button',
                class: 'btn btn-mini',
                text: t('common.copy'),
                onclick: async () => {
                  const ok = await copyText(codeText);
                  toast(ok ? t('toast.copied') : t('toast.copyFail'), ok ? 'ok' : 'err');
                },
              }),
            ),
          );
        }

        const rightCol = h('div', { class: 'chat-bot-col' }, bubble);

        if (m.chips && m.chips.length) {
          const chipsWrap = h('div', { class: 'chat-chips' });
          for (const ch of m.chips) {
            chipsWrap.append(
              h('button', {
                type: 'button',
                class: 'chip chat-chip',
                text: ch.label,
                onclick: ch.action,
              }),
            );
          }
          rightCol.append(chipsWrap);
        }

        logEl.append(
          h(
            'div',
            { class: 'chat-msg is-bot' },
            h('div', { class: 'chat-avatar' }, kompiMascotSvg(m.mood ?? 'happy', 'kompi-chat-svg')),
            rightCol,
          ),
        );
      }

      if (scrollToBottom) {
        setTimeout(() => {
          logEl.scrollTo({ top: logEl.scrollHeight, behavior: 'smooth' });
        }, 20);
      }
    }

    renderLog(false);
    setTimeout(() => inputEl.focus(), 50);
  };
}

const INTENT_SYNONYMS: Array<{ re: RegExp; targetIds: string[] }> = [
  { re: /\b(wypis|ekran|drukuj|wyswietl|pokaz|napisz|print|display|screen)\w*/, targetIds: ['cout', 'endl'] },
  { re: /\b(wczyt|wpis|klawiatur|pobierz|input|read|keyboard)\w*/, targetIds: ['cin', 'string'] },
  { re: /\b(tekst|napis|slowo|zdan|imie|znak|litera|sentence|word|text)\w*/, targetIds: ['string', 'char'] },
  { re: /\b(liczb|calkowit|numer|integer|number)\w*/, targetIds: ['int', 'variable'] },
  { re: /\b(ulamek|przecin|rzeczywist|kropk|decimal|fraction)\w*/, targetIds: ['double'] },
  { re: /\b(powtarz|powtorz|razy|kolei|loop|repeat)\w*/, targetIds: ['for', 'while'] },
  { re: /\b(jezel|jesli|gdy|sprawdz|warun|condition|check)\w*/, targetIds: ['if', 'comparison'] },
  { re: /\b(parzyst|nieparzyst|reszt|dzielen|podzieln|even|odd|remainder)\w*/, targetIds: ['modulo', 'arithmetic'] },
  { re: /\b(losow|kostk|zgad|random|dice)\w*/, targetIds: ['rand'] },
  { re: /\b(zbior|list|wiele|ocen|element|tablic|wektor)\w*/, targetIds: ['array', 'vector'] },
  { re: /\b(srednik|kropka|przecinek|semicolon)\w*/, targetIds: ['err-semicolon', 'semicolon'] },
  { re: /\b(literowk|nieznan|undeclared|not declared)\w*/, targetIds: ['err-undeclared'] },
];

function fuzzyDist(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost);
      }
    }
  }
  return dp[n][m];
}

/** Wyszukuje najlepiej pasujące hasła dla pytania napisanego naturalnym językiem (z tolerancją na literówki). */
function findBestEntries(rawQuery: string, lang: Lang): GlossEntry[] {
  const fullNorm = normalize(rawQuery);
  if (!fullNorm) return [];

  const words = fullNorm
    .split(/[^a-z0-9+#_<>=!;]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 1 && !STOP_WORDS.has(w));

  const stems = words.map((w) => (w.length >= 5 ? w.slice(0, w.length - 1) : w));
  const searchTerms = words.length ? words : [fullNorm];

  const intentBoostIds = new Set<string>();
  for (const syn of INTENT_SYNONYMS) {
    if (syn.re.test(fullNorm)) {
      for (const id of syn.targetIds) intentBoostIds.add(id);
    }
  }

  const scored = GLOSSARY.map((e) => {
    const title = normalize(e.title[lang]);
    const short = normalize(e.short[lang]);
    const body = normalize(e.body[lang]);
    const keys = [...(e.tokens ?? []), ...(e.match ?? []), e.id].map(normalize);

    let score = 0;

    if (intentBoostIds.has(e.id)) score += 55;
    if (keys.some((k) => k === fullNorm)) score += 140;
    if (title.includes(fullNorm)) score += 70;

    for (let i = 0; i < searchTerms.length; i++) {
      const term = searchTerms[i];
      const stem = stems[i] ?? term;

      if (keys.some((k) => k === term)) {
        score += 90;
      } else if (keys.some((k) => k.includes(term) || (stem.length >= 4 && k.includes(stem)))) {
        score += 45;
      } else if (term.length >= 4 && keys.some((k) => k.length >= 3 && fuzzyDist(term, k) <= (term.length >= 6 ? 2 : 1))) {
        score += 40;
      }

      if (title.includes(term) || (stem.length >= 4 && title.includes(stem))) score += 35;
      if (short.includes(term) || (stem.length >= 4 && short.includes(stem))) score += 16;
      if (body.includes(term) || (stem.length >= 4 && body.includes(stem))) score += 8;
    }

    return { e, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((x) => x.e);
}

function shortChipTitle(title: string): string {
  const dash = title.indexOf('—');
  return dash > 0 ? title.slice(0, dash).trim() : title;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

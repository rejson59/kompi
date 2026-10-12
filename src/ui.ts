/* Drobne narzędzia UI: budowanie elementów, szuflada boczna, modal, toasty
   oraz gotowe wiersze ustawień (przełącznik, lista, suwak, pole tekstowe). */

type Child = Node | string | null | undefined | false;

export function h(tag: string, attrs: Record<string, unknown> = {}, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'html') el.innerHTML = String(v);
    else if (k === 'text') el.textContent = String(v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v as object);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export function icon(name: string, cls = 'i'): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', cls);
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

/* ------------------------------- toasty -------------------------------- */
export function toast(message: string, kind: 'ok' | 'err' | 'info' = 'info', ms = 2800): void {
  const host = document.getElementById('toasts');
  if (!host) return;
  const el = h('div', { class: `toast is-${kind}` }, icon(kind === 'err' ? 'close' : 'check'), h('span', { text: message }));
  host.append(el);
  setTimeout(() => {
    el.style.transition = 'opacity .2s, transform .2s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 220);
  }, ms);
}

/* ------------------------------ szuflada ------------------------------- */
type Renderer = (body: HTMLElement) => void;

let drawerId: string | null = null;
let drawerRender: Renderer | null = null;
let drawerTitle = '';

export function openDrawer(id: string, title: string, render: Renderer, wide = false): void {
  const drawer = document.getElementById('drawer')!;
  const scrim = document.getElementById('drawer-scrim')!;
  const body = document.getElementById('drawer-body')!;
  const titleEl = document.getElementById('drawer-title')!;

  if (drawerId === id) {
    closeDrawer();
    return;
  }

  drawerId = id;
  drawerRender = render;
  drawerTitle = title;

  titleEl.textContent = title;
  body.innerHTML = '';
  drawer.classList.toggle('is-wide', wide);
  render(body);

  drawer.classList.remove('is-hidden');
  drawer.setAttribute('aria-hidden', 'false');
  if (window.matchMedia('(max-width: 900px)').matches) scrim.classList.remove('is-hidden');
  document.querySelectorAll<HTMLElement>('.topbar .icon-btn').forEach((b) => b.classList.remove('is-active'));
  document.getElementById(`btn-${id}`)?.classList.add('is-active');
}

export function closeDrawer(): void {
  drawerId = null;
  drawerRender = null;
  document.getElementById('drawer')!.classList.add('is-hidden');
  document.getElementById('drawer')!.setAttribute('aria-hidden', 'true');
  document.getElementById('drawer-scrim')!.classList.add('is-hidden');
  document.querySelectorAll<HTMLElement>('.topbar .icon-btn').forEach((b) => b.classList.remove('is-active'));
}

export function currentDrawer(): string | null {
  return drawerId;
}

/** Przerysowuje otwartą szufladę (np. po zmianie języka albo motywu). */
export function rerenderDrawer(newTitle?: string): void {
  if (!drawerId || !drawerRender) return;
  const body = document.getElementById('drawer-body')!;
  const scroll = body.scrollTop;
  body.innerHTML = '';
  if (newTitle) {
    drawerTitle = newTitle;
    document.getElementById('drawer-title')!.textContent = newTitle;
  } else {
    document.getElementById('drawer-title')!.textContent = drawerTitle;
  }
  drawerRender(body);
  body.scrollTop = scroll;
}

/* -------------------------------- modal -------------------------------- */
export function openModal(title: string, render: Renderer): void {
  const scrim = document.getElementById('modal-scrim')!;
  const body = document.getElementById('modal-body')!;
  document.getElementById('modal-title')!.textContent = title;
  body.innerHTML = '';
  render(body);
  scrim.classList.remove('is-hidden');
}

export function closeModal(): void {
  document.getElementById('modal-scrim')!.classList.add('is-hidden');
}

export function isModalOpen(): boolean {
  return !document.getElementById('modal-scrim')!.classList.contains('is-hidden');
}

/* -------------------------- wiersze ustawień --------------------------- */
export function group(title: string, ...rows: Child[]): HTMLElement {
  return h('section', { class: 'group' }, h('h3', { text: title }), ...rows);
}

function labelBlock(label: string, desc?: string): HTMLElement {
  return h('div', { class: 'row-label' }, h('b', { text: label }), desc ? h('span', { text: desc }) : null);
}

export function rowSwitch(label: string, desc: string | undefined, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const input = h('input', { type: 'checkbox' }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  return h(
    'div',
    { class: 'row' },
    labelBlock(label, desc),
    h('div', { class: 'row-control' }, h('label', { class: 'switch' }, input, h('span', { class: 'track' }), h('span', { class: 'thumb' }))),
  );
}

export function rowSelect(
  label: string,
  desc: string | undefined,
  options: Array<{ value: string; label: string }>,
  value: string,
  onChange: (v: string) => void,
): HTMLElement {
  const sel = h('select', { class: 'sel' }) as HTMLSelectElement;
  for (const o of options) {
    const opt = h('option', { value: o.value, text: o.label }) as HTMLOptionElement;
    if (o.value === value) opt.selected = true;
    sel.append(opt);
  }
  sel.addEventListener('change', () => onChange(sel.value));
  return h('div', { class: 'row' }, labelBlock(label, desc), h('div', { class: 'row-control' }, sel));
}

export function rowRange(
  label: string,
  desc: string | undefined,
  min: number,
  max: number,
  step: number,
  value: number,
  onChange: (v: number) => void,
  format: (v: number) => string = (v) => String(v),
): HTMLElement {
  const out = h('span', { class: 'hexval', text: format(value) });
  const input = h('input', { type: 'range', min, max, step, value }) as HTMLInputElement;
  input.addEventListener('input', () => {
    out.textContent = format(Number(input.value));
    onChange(Number(input.value));
  });
  return h('div', { class: 'row' }, labelBlock(label, desc), h('div', { class: 'row-control' }, input, out));
}

export function rowText(
  label: string,
  desc: string | undefined,
  placeholder: string,
  value: string,
  onChange: (v: string) => void,
): HTMLElement {
  const input = h('input', { class: 'txt', type: 'text', placeholder, value }) as HTMLInputElement;
  input.addEventListener('input', () => onChange(input.value));
  return h('div', { class: 'row' }, labelBlock(label, desc), h('div', { class: 'row-control' }, input));
}

export function rowColor(label: string, value: string, onChange: (v: string) => void): HTMLElement {
  const hex = h('span', { class: 'hexval', text: value });
  const input = h('input', { type: 'color', value }) as HTMLInputElement;
  input.addEventListener('input', () => {
    hex.textContent = input.value;
    onChange(input.value);
  });
  return h('div', { class: 'color-row' }, h('label', { text: label }), hex, input);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } }) as HTMLTextAreaElement;
      ta.value = text;
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

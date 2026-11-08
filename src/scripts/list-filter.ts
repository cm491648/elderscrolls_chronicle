import { matches } from '../lib/list-filter';

/**
 * Wires a ListFilter form: typing hides the items of its scope that do not match (`data-search`), hides groups left
 * empty (`data-filter-group`), and says how many are shown. The form stays hidden without JavaScript.
 */
export function bindListFilter(form: HTMLFormElement) {
  const input = form.querySelector<HTMLInputElement>('input[type="search"]')!;
  const status = form.querySelector<HTMLElement>('[role="status"]')!;
  const scope = document.getElementById(form.dataset.filterScope!)!;
  const items = [...scope.querySelectorAll<HTMLElement>('[data-search]')];
  const groups = [...scope.querySelectorAll<HTMLElement>('[data-filter-group]')];
  const run = () => {
    let shown = 0;
    for (const el of items) {
      const hit = matches(el.dataset.search!, input.value);
      el.hidden = !hit;
      if (hit) shown++;
    }
    for (const g of groups) g.hidden = !g.querySelector('[data-search]:not([hidden])');
    status.textContent =
      input.value.trim() === '' ? '' : shown === 0 ? form.dataset.none! : form.dataset.count!.replace('{n}', String(shown));
  };
  input.addEventListener('input', run);
  form.addEventListener('submit', (e) => e.preventDefault());
  form.hidden = false;
}

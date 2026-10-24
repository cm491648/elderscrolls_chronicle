/** Roles whose widgets move or edit with the arrow keys (WAI-ARIA keyboard patterns). */
const ARROW_ROLES = ['slider', 'spinbutton', 'textbox', 'searchbox', 'listbox', 'option', 'combobox', 'menu',
  'menubar', 'radiogroup', 'tablist', 'grid', 'tree'];
/** Anything inside one of these keeps its arrows; a panel of our own claims them with data-own-arrows. */
const ARROW_OWNERS = [...ARROW_ROLES.map((r) => `[role="${r}"]`), '[data-own-arrows]'].join(', ');

/** Inputs that are pressed, not edited: arrow keys do nothing in them, so they leave the arrows to the page. */
const PRESSED_INPUTS = ['checkbox', 'button', 'submit', 'reset'];

/** True when the arrow keys belong to the focused element, so the page must not step through events. */
export function ownsArrowKeys(el: Element | null): boolean {
  // A key pressed with nothing focused targets the body; window or document targets have no tagName.
  if (!el || typeof el.tagName !== 'string') return false;
  if (el.tagName === 'INPUT' && !PRESSED_INPUTS.includes((el as HTMLInputElement).type)) return true;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return !!el.closest?.(ARROW_OWNERS);
}

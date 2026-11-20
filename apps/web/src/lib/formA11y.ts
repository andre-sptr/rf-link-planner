/**
 * Synchronizes CSS :user-invalid with aria-invalid="false"|"true" and dynamic aria-describedby
 * per modern-web-guidance accessible-error-announcement.
 */
export function initAccessibleFormValidation(root: Document | HTMLElement = document): () => void {
  const supportsUserInvalid =
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('selector(:user-invalid)');

  const linkError = (el: Element, shown: boolean) => {
    const errorId = (el as HTMLElement).dataset?.error;
    if (!errorId) return;
    const ids = (el.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter((id) => id && id !== errorId);
    if (shown) ids.push(errorId);
    if (ids.length) {
      el.setAttribute('aria-describedby', ids.join(' '));
    } else {
      el.removeAttribute('aria-describedby');
    }
  };

  const dirty = new WeakSet<Element>();

  const syncEl = (el: EventTarget | null, markDirty = false) => {
    if (!(el instanceof HTMLElement)) return;
    if (!el.matches('input, select, textarea')) return;

    if (markDirty) dirty.add(el);

    let isInvalid = false;
    if (supportsUserInvalid) {
      try {
        isInvalid = el.matches(':user-invalid');
      } catch {
        isInvalid = false;
      }
    } else if (dirty.has(el) && 'validity' in el) {
      isInvalid = !(el as HTMLInputElement).validity.valid;
      el.classList.toggle('user-invalid-fallback', isInvalid);
    }

    el.setAttribute('aria-invalid', isInvalid ? 'true' : 'false');
    linkError(el, isInvalid);
  };

  root.querySelectorAll('input, select, textarea').forEach((el) => {
    if (!el.hasAttribute('aria-invalid')) {
      el.setAttribute('aria-invalid', 'false');
    }
  });

  const onBlur = (e: Event) => syncEl(e.target, true);
  const onInput = (e: Event) => syncEl(e.target, false);
  const onChange = (e: Event) => syncEl(e.target, true);
  const onInvalid = (e: Event) => syncEl(e.target, true);

  root.addEventListener('blur', onBlur, true);
  root.addEventListener('input', onInput, true);
  root.addEventListener('change', onChange, true);
  root.addEventListener('invalid', onInvalid, true);

  return () => {
    root.removeEventListener('blur', onBlur, true);
    root.removeEventListener('input', onInput, true);
    root.removeEventListener('change', onChange, true);
    root.removeEventListener('invalid', onInvalid, true);
  };
}

// Make the main app shell inert (non-interactive) while any modal dialog is open.
//
// We used to do this purely in CSS:
//   body:has([data-scope='dialog'][data-part='content'][data-state='open']) #root * { … }
// but `:has()` anchored on <body> forces Chromium to re-run :has() invalidation on
// *every* DOM mutation anywhere in the app, and the `#root *` subject expands the
// recalc to the whole tree. Navigation rebuilds the entire file list (hundreds of
// rows), so that rule made navigating noticeably sluggish.
//
// Instead, a single observer watches for dialog open/close (a `data-state` flip on
// the zag dialog content) and toggles one attribute on #root. The CSS then keys off
// `#root[data-modal-open]` — a plain attribute rule with no per-mutation cost.
//
// Row insertions during navigation are childList changes that don't touch
// `data-state`; the observer batches mutations and does a single cheap querySelector
// per batch, so the hot path stays clean.

const OPEN_DIALOG_SELECTOR =
  "[data-scope='dialog'][data-part='content'][data-state='open']";

let installed = false;

export function installModalInertObserver(): void {
  if (installed) return;
  installed = true;

  const root = document.getElementById('root');
  if (!root) return;

  const sync = () => {
    const anyOpen = !!document.querySelector(OPEN_DIALOG_SELECTOR);
    if (anyOpen) root.setAttribute('data-modal-open', '');
    else root.removeAttribute('data-modal-open');
  };

  const observer = new MutationObserver(sync);
  observer.observe(document.body, {
    subtree: true,
    childList: true,            // dialog content mounting/unmounting
    attributes: true,
    attributeFilter: ['data-state'], // only data-state flips wake the callback for attrs
  });

  sync();
}

(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const actions = document.querySelector('.designer-mini-actions');
  const funBar = $('designer-fun-bar');
  const selectedLabel = $('selected-label');
  if (!actions || !funBar || !selectedLabel) return;

  let focusMode = false;
  const viewModes = ['normal', 'xray', 'silhouette'];
  let viewIndex = 0;

  const focus = document.createElement('button');
  focus.type = 'button';
  focus.id = 'shape-focus';
  focus.textContent = 'Focus part';
  focus.disabled = true;
  actions.insertBefore(focus, $('shape-delete') || null);

  const view = document.createElement('button');
  view.type = 'button';
  view.id = 'designer-view-mode';
  view.className = 'button button-outline';
  view.textContent = 'View: normal';
  funBar.appendChild(view);

  function hasSelection() {
    return selectedLabel.textContent.trim() !== 'None' && Boolean(document.querySelector('#canvas-shapes .design-shape.is-selected'));
  }

  function syncFocus() {
    const selected = hasSelection();
    focus.disabled = !selected;
    if (!selected && focusMode) {
      focusMode = false;
      document.body.classList.remove('designer-focus-selected');
      focus.textContent = 'Focus part';
      focus.setAttribute('aria-pressed', 'false');
    }
  }

  focus.addEventListener('click', () => {
    if (!hasSelection()) return;
    focusMode = !focusMode;
    document.body.classList.toggle('designer-focus-selected', focusMode);
    focus.textContent = focusMode ? 'Show all parts' : 'Focus part';
    focus.setAttribute('aria-pressed', String(focusMode));
  });

  view.addEventListener('click', () => {
    document.body.classList.remove('designer-view-xray', 'designer-view-silhouette');
    viewIndex = (viewIndex + 1) % viewModes.length;
    const mode = viewModes[viewIndex];
    if (mode === 'xray') document.body.classList.add('designer-view-xray');
    if (mode === 'silhouette') document.body.classList.add('designer-view-silhouette');
    view.textContent = `View: ${mode === 'xray' ? 'x-ray' : mode}`;
    view.setAttribute('aria-label', `Canvas view mode: ${mode}`);
  });

  new MutationObserver(syncFocus).observe(selectedLabel, { childList: true, characterData: true, subtree: true });
  syncFocus();
})();

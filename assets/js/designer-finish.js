(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const gameBar = $('designer-game-bar');
  const meterText = $('game-brief-meter-text');
  const heading = $('challenge-heading');
  if (!gameBar || !meterText || !heading) return;

  const panel = document.createElement('section');
  panel.id = 'game-finish-panel';
  panel.className = 'game-finish-panel';
  panel.hidden = true;
  panel.setAttribute('aria-live', 'polite');
  panel.innerHTML = `
    <div class="game-finish-copy">
      <p class="eyebrow">Brief resolved</p>
      <h3 id="game-finish-title">Finish the project.</h3>
      <p id="game-finish-message" class="muted">Save the work, get one final crit, or put it into circulation.</p>
    </div>
    <div class="game-finish-actions">
      <button type="button" class="button button-primary" data-finish-action="crit">Get final crit</button>
      <button type="button" class="button button-outline" data-finish-action="save">Save version</button>
      <button type="button" class="button button-outline" data-finish-action="poster">Make pin-up</button>
      <button type="button" class="button button-outline" data-finish-action="share">Share link</button>
      <button type="button" class="button button-outline" data-finish-action="publish" hidden>Publish</button>
      <button type="button" class="button button-outline" data-finish-action="next">Next brief</button>
    </div>`;
  gameBar.insertAdjacentElement('afterend', panel);

  let visibleFor = '';

  function isComplete() {
    return String(meterText.textContent || '').trim() === '100%';
  }

  function updatePublishButton() {
    const publish = panel.querySelector('[data-finish-action="publish"]');
    if (publish) publish.hidden = !$('publish-community-design');
  }

  function update() {
    if (!isComplete()) {
      panel.hidden = true;
      visibleFor = '';
      return;
    }
    const title = String(heading.textContent || 'Studio brief').trim();
    const bonusDone = Boolean(document.querySelector('.game-rule-bonus.is-complete'));
    if (visibleFor !== title) {
      visibleFor = title;
      $('game-finish-title').textContent = `${title} is resolved.`;
      $('game-finish-message').textContent = bonusDone
        ? 'Required rules and the bonus are complete. Give it one final edit, then save or share the result.'
        : 'The required rules are complete. Chase the bonus, refine the idea, or finish and move on.';
    }
    updatePublishButton();
    panel.hidden = false;
  }

  panel.addEventListener('click', event => {
    const action = event.target.closest('[data-finish-action]')?.dataset.finishAction;
    if (!action) return;
    if (action === 'crit') $('game-desk-crit')?.click();
    if (action === 'save') {
      const save = $('save-sketchbook');
      if (save) save.click();
      else $('save-draft')?.click();
    }
    if (action === 'poster') $('download-poster')?.click();
    if (action === 'share') {
      $('create-share')?.click();
      $('share-panel')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
    }
    if (action === 'publish') $('publish-community-design')?.click();
    if (action === 'next') $('game-practice')?.click();
  });

  new MutationObserver(update).observe(meterText, { childList: true, characterData: true, subtree: true });
  new MutationObserver(updatePublishButton).observe(document.body, { childList: true, subtree: true });
  update();
})();

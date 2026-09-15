(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const gameBar = $('designer-game-bar');
  if (!gameBar) return;

  const KEY = 'aias-memphis-design-studio-onboarding-v2';
  const hasSeen = () => { try { return localStorage.getItem(KEY) === 'seen'; } catch { return true; } };
  const markSeen = () => { try { localStorage.setItem(KEY, 'seen'); } catch {} };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  function ensureDialog() {
    if ($('designer-help-dialog')) return $('designer-help-dialog');
    const dialog = document.createElement('dialog');
    dialog.id = 'designer-help-dialog';
    dialog.className = 'designer-help-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="designer-help-card">
        <div class="designer-help-head">
          <div><p class="eyebrow">How to play</p><h2>Brief. Build. Crit. Share. Repeat.</h2></div>
          <button value="close" class="critique-close" aria-label="Close">×</button>
        </div>
        <div class="designer-help-steps">
          <article><span>1</span><div><strong>Read the brief</strong><p>Every brief has measurable rules. The progress card updates while you build, and completing briefs earns local Studio XP.</p></div></article>
          <article><span>2</span><div><strong>Build fast</strong><p>Start from a House, Tower, Pavilion, or Courtyard—or build from nothing. Add blocks, roofs, openings, columns, arches, circles, and trees.</p></div></article>
          <article><span>3</span><div><strong>Refine the architecture</strong><p>Drag, resize, rotate, recolor, layer, lock, and interact with parts. Use the move pad on touch devices and Architectural Arrays for precise repeated windows, columns, and trees.</p></div></article>
          <article><span>4</span><div><strong>Ask for a Desk crit</strong><p>The local crit reads balance, ground contact, repetition, openings, landscape, and clutter—then gives one useful next move instead of random praise.</p></div></article>
          <article><span>5</span><div><strong>Keep or share the result</strong><p>Save versions in My Sketchbook, export a PNG or pin-up poster, create a remix link, or publish to Live Community when the chapter enables it.</p></div></article>
        </div>
        <div class="designer-help-cta">
          <button type="button" class="button button-primary" data-help-action="daily">Start today's brief</button>
          <button type="button" class="button button-outline" data-help-action="battle">Start a 3-minute build</button>
          <button value="close" class="button button-outline">Explore on my own</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('close', markSeen);
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
      const action = event.target.closest?.('[data-help-action]')?.dataset.helpAction;
      if (!action) return;
      markSeen();
      dialog.close();
      if (action === 'daily') $('game-daily')?.click();
      if (action === 'battle') $('game-battle')?.click();
      document.querySelector('#studio')?.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth' });
    });
    return dialog;
  }

  function openHelp() {
    const dialog = ensureDialog();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'designer-help-button';
  button.className = 'button button-outline';
  button.textContent = 'How to play';
  button.addEventListener('click', openHelp);
  gameBar.appendChild(button);

  if (!hasSeen() && !location.hash.startsWith('#design=')) setTimeout(openHelp, 500);
})();

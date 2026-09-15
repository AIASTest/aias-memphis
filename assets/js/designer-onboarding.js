(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const funBar = $('designer-fun-bar');
  if (!funBar) return;

  const KEY = 'aias-memphis-design-studio-onboarding-v1';
  const hasSeen = () => { try { return localStorage.getItem(KEY) === 'seen'; } catch { return true; } };
  const markSeen = () => { try { localStorage.setItem(KEY, 'seen'); } catch {} };

  function ensureDialog() {
    if ($('designer-help-dialog')) return $('designer-help-dialog');
    const dialog = document.createElement('dialog');
    dialog.id = 'designer-help-dialog';
    dialog.className = 'designer-help-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="designer-help-card">
        <div class="designer-help-head">
          <div><p class="eyebrow">How to play</p><h2>Make a building in five moves.</h2></div>
          <button value="close" class="critique-close" aria-label="Close">×</button>
        </div>
        <div class="designer-help-steps">
          <article><span>1</span><div><strong>Start fast</strong><p>Pick House, Tower, Pavilion, Courtyard, or hit Design roulette. You can replace everything later.</p></div></article>
          <article><span>2</span><div><strong>Build with parts</strong><p>Add blocks, roofs, arches, windows, doors, columns, circles, and trees. Drag them directly on the canvas.</p></div></article>
          <article><span>3</span><div><strong>Mess with it</strong><p>Resize and rotate with the blue handles. Use materials, palettes, opacity, layering, repeat, ground, and lock.</p></div></article>
          <article><span>4</span><div><strong>Interact</strong><p>Select a window, door, or tree and use Interact—or double-click it. Windows light up, doors open, and trees change.</p></div></article>
          <article><span>5</span><div><strong>Share the idea</strong><p>Clear a challenge, get a Desk crit, present it fullscreen, export a PNG, create a remix link, or submit it to the showcase.</p></div></article>
        </div>
        <div class="designer-help-cta">
          <button type="button" class="button button-primary" data-help-action="roulette">Give me a random start</button>
          <button type="button" class="button button-outline" data-help-action="sprint">Start a 3-minute sprint</button>
          <button value="close" class="button button-outline">I’ve got it</button>
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
      if (action === 'roulette') $('design-roulette')?.click();
      if (action === 'sprint') $('sprint-toggle')?.click();
      document.querySelector('#studio')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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
  funBar.appendChild(button);

  if (!hasSeen() && !location.hash.startsWith('#design=')) {
    setTimeout(openHelp, 450);
  }
})();

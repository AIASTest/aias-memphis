(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const app = $('designer-app');
  const workspace = document.querySelector('.designer-workspace-wrap');
  const canvas = $('design-canvas');
  if (!app || !workspace || !canvas) return;

  const SOUND_KEY = 'aias-memphis-design-studio-sound-v1';
  const STAMPS_KEY = 'aias-memphis-design-studio-stamps-v1';
  const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');
  let soundEnabled = (() => { try { return localStorage.getItem(SOUND_KEY) === 'on'; } catch { return false; } })();
  let audioContext = null;
  let lastCelebratedChallenge = '';
  let stamps = loadStamps();

  function loadStamps() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STAMPS_KEY) || '[]');
      return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch {
      return new Set();
    }
  }

  function saveStamps() {
    try { localStorage.setItem(STAMPS_KEY, JSON.stringify([...stamps])); } catch {}
  }

  function text(id, fallback = '') { return $(id)?.textContent?.trim() || fallback; }
  function layerCounts() {
    const counts = {};
    document.querySelectorAll('#designer-layers .layer-chip').forEach(chip => {
      const label = chip.textContent.replace(/^\s*\d+\.\s*/, '').replace(/\s*·\s*locked\s*$/i, '').trim();
      counts[label] = (counts[label] || 0) + 1;
    });
    return counts;
  }

  function designFacts() {
    const counts = layerCounts();
    return {
      parts: Number(text('stat-shapes', '0')) || 0,
      colors: Number(text('stat-colors', '0')) || 0,
      vibe: text('stat-vibe', 'Balanced'),
      background: $('design-background')?.value || 'grid',
      title: $('design-title')?.value?.trim() || 'Untitled building',
      designer: $('design-author')?.value?.trim() || 'Anonymous designer',
      windows: counts.Window || 0,
      doors: counts.Door || 0,
      trees: counts.Tree || 0,
      columns: counts.Column || 0,
      roofs: counts.Roof || 0,
      arches: counts.Arch || 0,
      blocks: counts.Block || 0
    };
  }

  function ensureFunBar() {
    let bar = $('designer-fun-bar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'designer-fun-bar';
    bar.className = 'designer-fun-bar';
    bar.innerHTML = `
      <button type="button" class="button button-outline" id="design-roulette">Design roulette</button>
      <button type="button" class="button button-outline" id="desk-crit">Desk crit</button>
      <button type="button" class="button button-outline" id="present-design">Present</button>
      <button type="button" class="button button-outline" id="sound-toggle" aria-pressed="${soundEnabled}">${soundEnabled ? 'Sound on' : 'Sound off'}</button>`;
    const actions = document.querySelector('.designer-actions');
    actions?.parentNode?.insertBefore(bar, actions);
    $('design-roulette')?.addEventListener('click', designRoulette);
    $('desk-crit')?.addEventListener('click', openCritique);
    $('present-design')?.addEventListener('click', togglePresentation);
    $('sound-toggle')?.addEventListener('click', toggleSound);
    return bar;
  }

  function ensureStampCounter() {
    const actions = document.querySelector('.designer-challenge-actions');
    if (!actions || $('challenge-stamps')) return;
    const badge = document.createElement('span');
    badge.id = 'challenge-stamps';
    badge.className = 'challenge-stamps';
    actions.appendChild(badge);
    updateStampCounter();
  }

  function updateStampCounter() {
    const badge = $('challenge-stamps');
    if (badge) badge.textContent = `${stamps.size} challenge stamp${stamps.size === 1 ? '' : 's'}`;
  }

  function ensurePresentationOverlay() {
    if ($('designer-presentation-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'designer-presentation-overlay';
    overlay.className = 'designer-presentation-overlay';
    overlay.innerHTML = `
      <div class="designer-presentation-title">
        <span id="presentation-kicker">AIAS Design Studio</span>
        <strong id="presentation-title">Untitled building</strong>
        <span id="presentation-author"></span>
      </div>
      <button type="button" class="presentation-exit" id="presentation-exit">Exit presentation</button>`;
    workspace.appendChild(overlay);
    $('presentation-exit')?.addEventListener('click', exitPresentation);
  }

  function updatePresentationMeta() {
    const facts = designFacts();
    if ($('presentation-title')) $('presentation-title').textContent = facts.title;
    if ($('presentation-author')) $('presentation-author').textContent = facts.designer === 'Anonymous designer' ? '' : `by ${facts.designer}`;
  }

  async function togglePresentation() {
    if (document.body.classList.contains('designer-presenting')) return exitPresentation();
    ensurePresentationOverlay();
    updatePresentationMeta();
    document.body.classList.add('designer-presenting');
    $('present-design').textContent = 'Exit presentation';
    playTone(420, .08, .06);
    try { if (workspace.requestFullscreen && !document.fullscreenElement) await workspace.requestFullscreen(); } catch {}
  }

  async function exitPresentation() {
    document.body.classList.remove('designer-presenting');
    if ($('present-design')) $('present-design').textContent = 'Present';
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {}
  }

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && document.body.classList.contains('designer-presenting')) {
      document.body.classList.remove('designer-presenting');
      if ($('present-design')) $('present-design').textContent = 'Present';
    }
  });

  function critiqueFor(facts) {
    const positives = [];
    const pushes = [];
    if (facts.parts <= 6) positives.push('The restraint is doing real work. The composition reads quickly instead of getting lost in parts.');
    if (facts.parts >= 18) positives.push('There is enough density here to feel like a real system rather than a single object.');
    if (facts.windows >= 6) positives.push('The repetition in the openings gives the facade a legible rhythm.');
    if (facts.trees >= 3) positives.push('The landscape is participating in the design instead of acting like decoration.');
    if (facts.columns >= 4) positives.push('The structural rhythm gives the project a strong civic presence.');
    if (facts.vibe === 'After Dark') positives.push('The night scene and lit openings give this a convincing second life after sunset.');
    if (facts.vibe === 'Deconstruct') positives.push('The rotated pieces create useful tension without needing a complicated toolset.');
    if (!positives.length) positives.push('The massing has a clear starting idea. There is enough hierarchy to keep developing it.');

    if (facts.windows === 0) pushes.push('Right now the facade reads a little bunker-like. Where does daylight enter, and what does that do to the elevation?');
    if (facts.doors === 0) pushes.push('I cannot find the moment of arrival yet. Make the entrance intentional instead of implied.');
    if (facts.colors >= 5) pushes.push('You have a lot of color competing for hierarchy. What happens if one color becomes dominant and the others become accents?');
    if (facts.parts >= 28) pushes.push('There may be one move too many. Try deleting three parts and see whether the idea gets stronger.');
    if (facts.trees === 0 && ['lawn', 'river'].includes(facts.background)) pushes.push('The site is asking for a landscape response. Give the building something to negotiate with besides the edge of the canvas.');
    if (facts.roofs === 0 && facts.blocks >= 3) pushes.push('The skyline is very flat. Decide whether that is intentional or whether one volume should break the datum.');
    if (!pushes.length) pushes.push('Push the hierarchy one more step: decide which single move should be remembered after someone looks away.');

    const questions = [
      'What is the one move you would defend in a review?',
      'Where is the public side of this building?',
      'What would you remove if you had to simplify it by 20%?',
      'Which part is structure, and which part is just composition?',
      'What changes when someone approaches this from the opposite direction?'
    ];
    return { positive: randomItem(positives), push: randomItem(pushes), question: randomItem(questions) };
  }

  function randomItem(list) { return list[Math.floor(Math.random() * list.length)]; }

  function conceptStatement(facts) {
    const site = ({ river: 'riverfront setting', lawn: 'campus landscape', night: 'night-time urban setting', sunset: 'late-day setting', blueprint: 'diagrammatic field', paper: 'abstract field', grid: 'studio grid' })[facts.background] || 'site';
    const verbs = facts.vibe === 'Minimal' ? 'organizes a restrained set of forms' : facts.vibe === 'Deconstruct' ? 'layers and rotates familiar architectural forms' : facts.vibe === 'Biophilic' ? 'interweaves building mass and landscape' : 'uses layered massing and repetition';
    const feature = facts.windows >= 5 ? 'a rhythmic facade of repeated openings' : facts.columns >= 4 ? 'a strong structural cadence' : facts.arches ? 'a sequence of framed thresholds' : 'a clear hierarchy of primary and secondary volumes';
    return `${facts.title} ${verbs} within a ${site}, using ${feature} to give the composition its identity.`;
  }

  function ensureCritiqueDialog() {
    if ($('designer-critique-dialog')) return $('designer-critique-dialog');
    const dialog = document.createElement('dialog');
    dialog.id = 'designer-critique-dialog';
    dialog.className = 'designer-critique-dialog';
    dialog.innerHTML = `
      <form method="dialog" class="critique-card">
        <div class="critique-head"><div><p class="eyebrow">Desk crit</p><h2>Your five-minute review</h2></div><button class="critique-close" value="close" aria-label="Close">×</button></div>
        <div class="critique-block"><strong>What is working</strong><p id="crit-positive"></p></div>
        <div class="critique-block"><strong>Push it further</strong><p id="crit-push"></p></div>
        <div class="critique-block"><strong>Pin-up question</strong><p id="crit-question"></p></div>
        <div class="critique-concept"><span>Concept statement</span><p id="crit-concept"></p></div>
        <div class="button-row"><button type="button" class="button button-primary" id="crit-again">Another crit</button><button type="button" class="button button-outline" id="copy-concept">Copy concept statement</button></div>
      </form>`;
    document.body.appendChild(dialog);
    $('crit-again')?.addEventListener('click', fillCritique);
    $('copy-concept')?.addEventListener('click', async () => {
      const value = text('crit-concept');
      const ok = await copyText(value);
      $('copy-concept').textContent = ok ? 'Copied ✓' : 'Copy manually';
      setTimeout(() => { if ($('copy-concept')) $('copy-concept').textContent = 'Copy concept statement'; }, 1400);
    });
    return dialog;
  }

  function fillCritique() {
    const facts = designFacts();
    const crit = critiqueFor(facts);
    $('crit-positive').textContent = crit.positive;
    $('crit-push').textContent = crit.push;
    $('crit-question').textContent = crit.question;
    $('crit-concept').textContent = conceptStatement(facts);
    playTone(330, .05, .035);
  }

  function openCritique() {
    const dialog = ensureCritiqueDialog();
    fillCritique();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function designRoulette() {
    $('surprise-building')?.click();
    const palettes = [...document.querySelectorAll('[data-palette]')];
    if (palettes.length) randomItem(palettes).click();
    $('name-building')?.click();
    $('new-challenge')?.click();
    celebrate(12);
    playChord([220, 277, 330], .05);
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    try { localStorage.setItem(SOUND_KEY, soundEnabled ? 'on' : 'off'); } catch {}
    const button = $('sound-toggle');
    if (button) { button.textContent = soundEnabled ? 'Sound on' : 'Sound off'; button.setAttribute('aria-pressed', String(soundEnabled)); }
    if (soundEnabled) playChord([330, 440, 550], .045);
  }

  function getAudioContext() {
    if (!soundEnabled) return null;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
      return audioContext;
    } catch { return null; }
  }

  function playTone(freq, duration = .05, gain = .025, delay = 0) {
    const ctx = getAudioContext(); if (!ctx) return;
    const oscillator = ctx.createOscillator(), volume = ctx.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = freq;
    volume.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
    volume.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + delay + .008);
    volume.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
    oscillator.connect(volume); volume.connect(ctx.destination);
    oscillator.start(ctx.currentTime + delay); oscillator.stop(ctx.currentTime + delay + duration + .02);
  }

  function playChord(freqs, duration = .08) { freqs.forEach((freq, index) => playTone(freq, duration, .024, index * .04)); }

  function celebrate(count = 28) {
    if (REDUCED_MOTION.matches) return;
    const layer = document.createElement('div');
    layer.className = 'designer-confetti'; layer.setAttribute('aria-hidden', 'true');
    const colors = ['#00498F', '#193059', '#9C9EA1', '#FDE047', '#E879F9', '#6EE7F5'];
    for (let i = 0; i < count; i += 1) {
      const piece = document.createElement('i');
      piece.style.left = `${8 + Math.random() * 84}%`;
      piece.style.setProperty('--confetti-color', randomItem(colors));
      piece.style.setProperty('--confetti-delay', `${Math.random() * .25}s`);
      piece.style.setProperty('--confetti-drift', `${-90 + Math.random() * 180}px`);
      piece.style.setProperty('--confetti-spin', `${180 + Math.random() * 600}deg`);
      layer.appendChild(piece);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 2200);
  }

  function monitorChallengeCompletion() {
    const status = $('studio-status');
    if (!status) return;
    const observer = new MutationObserver(() => {
      const message = status.textContent || '';
      if (!message.startsWith('Challenge complete')) return;
      const challenge = text('challenge-prompt');
      if (!challenge || challenge === lastCelebratedChallenge) return;
      lastCelebratedChallenge = challenge;
      stamps.add(challenge); saveStamps(); updateStampCounter();
      celebrate(); playChord([392, 523, 659], .12);
    });
    observer.observe(status, { childList: true, characterData: true, subtree: true });
  }

  function addRandomRemixButton() {
    const filters = document.querySelector('.designer-showcase-filter');
    if (!filters || $('random-remix')) return;
    const button = document.createElement('button');
    button.type = 'button'; button.id = 'random-remix'; button.className = 'filter-chip'; button.textContent = 'Random remix';
    filters.appendChild(button);
    button.addEventListener('click', () => {
      const links = [...document.querySelectorAll('#design-showcase a[href*="#design="]')];
      if (!links.length) return;
      const link = randomItem(links);
      link.closest('.design-gallery-card')?.classList.add('is-random-pick');
      link.scrollIntoView({ behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth', block: 'center' });
      setTimeout(() => link.closest('.design-gallery-card')?.classList.remove('is-random-pick'), 1600);
      playTone(494, .06, .03);
    });
  }

  function addShareCaption() {
    const panel = $('share-panel');
    if (!panel || $('copy-share-caption')) return;
    const row = panel.querySelector('.button-row');
    if (!row) return;
    const button = document.createElement('button');
    button.type = 'button'; button.id = 'copy-share-caption'; button.className = 'button button-outline'; button.textContent = 'Copy share caption';
    row.insertBefore(button, row.firstChild);
    button.addEventListener('click', async () => {
      const facts = designFacts();
      const url = $('share-url')?.value || location.href;
      const caption = `I designed “${facts.title}” in the AIAS Memphis Design Studio${facts.designer === 'Anonymous designer' ? '' : ` — ${facts.designer}`}. Remix it: ${url}`;
      const ok = await copyText(caption);
      button.textContent = ok ? 'Caption copied ✓' : 'Copy manually';
      setTimeout(() => { if ($('copy-share-caption')) $('copy-share-caption').textContent = 'Copy share caption'; }, 1400);
    });
  }

  async function copyText(value) {
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); return true; } } catch {}
    const field = document.createElement('textarea'); field.value = value; field.readOnly = true; field.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(field); field.select(); const ok = document.execCommand('copy'); field.remove(); return ok;
  }

  function wireInteractionSounds() {
    document.addEventListener('click', event => {
      if (!soundEnabled) return;
      const button = event.target.closest('button, a.button'); if (!button) return;
      if (button.matches('[data-add-shape]')) playTone(250 + Math.random() * 80, .035, .018);
      else if (button.matches('[data-palette]')) playChord([260, 330], .04);
      else if (button.id === 'shape-interact') playTone(620, .045, .022);
      else if (button.id === 'shape-delete') playTone(145, .045, .018);
      else if (button.classList.contains('favorite-button')) playTone(520, .05, .018);
    }, true);
  }

  function enhanceTouchTargets() {
    canvas.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch') document.body.classList.add('designer-touching');
    });
    canvas.addEventListener('pointerup', () => document.body.classList.remove('designer-touching'));
    canvas.addEventListener('pointercancel', () => document.body.classList.remove('designer-touching'));
  }

  function initialize() {
    ensureFunBar();
    ensureStampCounter();
    ensurePresentationOverlay();
    monitorChallengeCompletion();
    addRandomRemixButton();
    addShareCaption();
    wireInteractionSounds();
    enhanceTouchTargets();
    $('design-title')?.addEventListener('input', updatePresentationMeta);
    $('design-author')?.addEventListener('input', updatePresentationMeta);
    const shortcutText = document.querySelector('.designer-shortcuts p');
    if (shortcutText && !shortcutText.dataset.funShortcuts) {
      shortcutText.dataset.funShortcuts = 'true';
      shortcutText.insertAdjacentHTML('beforeend', ' · <kbd>I</kbd> interact · <kbd>G</kbd> ground');
    }
  }

  initialize();
})();

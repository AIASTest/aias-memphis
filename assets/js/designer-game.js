(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const app = $('designer-app');
  const canvas = $('design-canvas');
  const challengeBand = document.querySelector('.designer-challenge-band');
  if (!app || !canvas || !challengeBand) return;

  const PROGRESSION_KEY = 'aias-memphis-design-studio-progression-v2';
  const DRAFT_KEY = 'aias-memphis-design-studio-draft-v2';
  const MAX_PARTS = 60;
  const CENTRAL_TZ = 'America/Chicago';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  const LEVELS = [
    { xp: 0, title: 'Studio Visitor' },
    { xp: 120, title: 'Sketch Starter' },
    { xp: 300, title: 'Form Finder' },
    { xp: 560, title: 'Studio Regular' },
    { xp: 900, title: 'Crit Ready' },
    { xp: 1320, title: 'Pin-Up Regular' },
    { xp: 1820, title: 'Design Instigator' },
    { xp: 2400, title: 'Studio Mentor' },
    { xp: 3100, title: 'Chapter Designer' }
  ];

  let briefs = [];
  let activeBrief = null;
  let briefMode = 'daily';
  let battleTimer = null;
  let battleSeconds = 0;
  let lastProgress = -1;
  let lastBatchUndo = null;
  let applyingBatch = false;
  let progression = loadProgression();

  function escapeHTML(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function clamp(value, min, max) {
    const n = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
  }

  function dayKey(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: CENTRAL_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }

  function stableHash(text) {
    let hash = 2166136261;
    for (const char of String(text)) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function currentWeekKey() {
    const now = new Date();
    const local = new Date(now.toLocaleString('en-US', { timeZone: CENTRAL_TZ }));
    const day = (local.getDay() + 6) % 7;
    local.setDate(local.getDate() - day);
    return dayKey(local);
  }

  function loadProgression() {
    try {
      const raw = JSON.parse(localStorage.getItem(PROGRESSION_KEY) || '{}');
      return {
        xp: clamp(raw.xp || 0, 0, 100000),
        completed: raw.completed && typeof raw.completed === 'object' ? raw.completed : {},
        milestones: raw.milestones && typeof raw.milestones === 'object' ? raw.milestones : {},
        activeDays: Array.isArray(raw.activeDays) ? raw.activeDays.filter(Boolean).slice(-120) : []
      };
    } catch {
      return { xp: 0, completed: {}, milestones: {}, activeDays: [] };
    }
  }

  function saveProgression() {
    try { localStorage.setItem(PROGRESSION_KEY, JSON.stringify(progression)); } catch {}
  }

  function recordActiveDay() {
    const key = dayKey();
    if (!progression.activeDays.includes(key)) {
      progression.activeDays.push(key);
      progression.activeDays = progression.activeDays.slice(-120);
      saveProgression();
    }
  }

  function levelInfo() {
    let index = 0;
    for (let i = 0; i < LEVELS.length; i += 1) if (progression.xp >= LEVELS[i].xp) index = i;
    const current = LEVELS[index];
    const next = LEVELS[Math.min(index + 1, LEVELS.length - 1)];
    const capped = index === LEVELS.length - 1;
    const span = Math.max(1, next.xp - current.xp);
    const pct = capped ? 100 : Math.round(((progression.xp - current.xp) / span) * 100);
    return { index: index + 1, current, next, pct, capped };
  }

  function awardXP(key, amount, reason) {
    if (!key || progression.completed[key]) return false;
    progression.completed[key] = new Date().toISOString();
    progression.xp += amount;
    recordActiveDay();
    saveProgression();
    renderProgression();
    announce(`+${amount} studio XP · ${reason}`);
    celebrate();
    return true;
  }

  function awardMilestone(key, amount, reason) {
    if (progression.milestones[key]) return false;
    progression.milestones[key] = new Date().toISOString();
    progression.xp += amount;
    saveProgression();
    renderProgression();
    announce(`+${amount} studio XP · ${reason}`);
    return true;
  }

  function announce(message) {
    const status = $('studio-status');
    if (status) status.textContent = message;
  }

  function celebrate() {
    if (reducedMotion.matches) return;
    const target = $('game-brief-card');
    target?.animate?.([
      { transform: 'translateY(0)', boxShadow: '0 0 0 rgba(0,73,143,0)' },
      { transform: 'translateY(-3px)', boxShadow: '0 14px 32px rgba(0,73,143,.18)' },
      { transform: 'translateY(0)', boxShadow: '0 0 0 rgba(0,73,143,0)' }
    ], { duration: 650, easing: 'ease-out' });
  }

  function summaryFromDom() {
    const counts = {};
    document.querySelectorAll('#designer-layers .layer-chip').forEach(chip => {
      const label = chip.textContent.replace(/^\s*\d+\.\s*/, '').replace(/\s*·\s*locked\s*$/i, '').trim();
      counts[label] = (counts[label] || 0) + 1;
    });
    const partCount = Number($('stat-shapes')?.textContent || 0) || 0;
    const colors = Number($('stat-colors')?.textContent || 0) || 0;
    const litWindows = [...document.querySelectorAll('#canvas-shapes [fill="#FFD86A"], #canvas-shapes [fill="#ffd86a"]')].length;
    const rotated = [...document.querySelectorAll('#canvas-shapes > .design-shape')].filter(node => /rotate\(/.test(node.getAttribute('transform') || '')).length;
    return {
      parts: partCount,
      colors,
      background: $('design-background')?.value || 'grid',
      litWindows,
      rotated,
      counts
    };
  }

  function evaluateRule(rule, facts) {
    const count = type => facts.counts[type] || 0;
    let current = 0;
    let done = false;
    let target = rule.value;
    switch (rule.kind) {
      case 'minParts': current = facts.parts; done = current >= rule.value; break;
      case 'maxParts': current = facts.parts; done = current > 0 && current <= rule.value; break;
      case 'minType': current = count(rule.type); done = current >= rule.value; break;
      case 'maxType': current = count(rule.type); done = current <= rule.value; break;
      case 'maxColors': current = facts.colors; done = current > 0 && current <= rule.value; break;
      case 'exactColors': current = facts.colors; done = current === rule.value; break;
      case 'background': current = facts.background; target = rule.value; done = current === rule.value; break;
      case 'minLitWindows': current = facts.litWindows; done = current >= rule.value; break;
      case 'minRotated': current = facts.rotated; done = current >= rule.value; break;
      default: done = false;
    }
    return { done, current, target, label: rule.label || rule.kind };
  }

  function briefCompletion() {
    if (!activeBrief) return { required: [], bonus: null, done: false, pct: 0 };
    const facts = summaryFromDom();
    const required = (activeBrief.rules || []).map(rule => evaluateRule(rule, facts));
    const bonus = activeBrief.bonus ? evaluateRule(activeBrief.bonus, facts) : null;
    const completed = required.filter(item => item.done).length;
    const pct = required.length ? Math.round((completed / required.length) * 100) : 0;
    return { required, bonus, done: required.length > 0 && completed === required.length, pct, facts };
  }

  function ruleValueText(result) {
    if (typeof result.current === 'string') return result.done ? 'Done' : String(result.current);
    if (/fewer|no more|under/i.test(result.label)) return `${result.current}/${result.target} max`;
    if (/exactly/i.test(result.label)) return `${result.current}/${result.target}`;
    return `${result.current}/${result.target}`;
  }

  function renderBriefProgress() {
    const list = $('game-rule-list');
    const meter = $('game-brief-meter-fill');
    const meterText = $('game-brief-meter-text');
    if (!list || !activeBrief) return;
    const completion = briefCompletion();
    list.innerHTML = completion.required.map(item => `
      <li class="game-rule ${item.done ? 'is-complete' : ''}">
        <span class="game-rule-check" aria-hidden="true">${item.done ? '✓' : '○'}</span>
        <span>${escapeHTML(item.label)}</span>
        <strong>${escapeHTML(ruleValueText(item))}</strong>
      </li>`).join('') + (completion.bonus ? `
      <li class="game-rule game-rule-bonus ${completion.bonus.done ? 'is-complete' : ''}">
        <span class="game-rule-check" aria-hidden="true">${completion.bonus.done ? '★' : '◇'}</span>
        <span>${escapeHTML(completion.bonus.label)}</span>
        <strong>${escapeHTML(ruleValueText(completion.bonus))}</strong>
      </li>` : '');
    if (meter) meter.style.width = `${completion.pct}%`;
    if (meterText) meterText.textContent = `${completion.pct}%`;

    if (completion.done && lastProgress < 100) completeActiveBrief(completion);
    lastProgress = completion.pct;
  }

  function completionKey() {
    if (!activeBrief) return '';
    if (briefMode === 'daily') return `daily:${dayKey()}:${activeBrief.id}`;
    if (briefMode === 'battle') return `battle:${dayKey()}:${activeBrief.id}`;
    return `practice:${activeBrief.id}`;
  }

  function completeActiveBrief(completion) {
    const base = briefMode === 'daily' ? 120 : briefMode === 'battle' ? 90 : 60;
    const bonus = completion.bonus?.done ? 20 : 0;
    const awarded = awardXP(completionKey(), base + bonus, `${activeBrief.title} complete${bonus ? ' + bonus' : ''}`);
    if (!awarded) announce(`${activeBrief.title} complete. Already counted for studio XP.`);
    $('game-brief-card')?.classList.add('is-complete');
    setTimeout(() => $('game-brief-card')?.classList.remove('is-complete'), 1600);
  }

  function renderProgression() {
    const level = levelInfo();
    if ($('game-level-name')) $('game-level-name').textContent = `${level.current.title} · Lv ${level.index}`;
    if ($('game-xp-value')) $('game-xp-value').textContent = `${progression.xp} XP`;
    if ($('game-level-fill')) $('game-level-fill').style.width = `${level.pct}%`;
    if ($('game-level-next')) $('game-level-next').textContent = level.capped ? 'Top studio level' : `${level.next.xp - progression.xp} XP to ${level.next.title}`;

    const weekStart = currentWeekKey();
    const activeThisWeek = progression.activeDays.filter(key => key >= weekStart).length;
    if ($('game-rhythm')) $('game-rhythm').textContent = `${activeThisWeek} design day${activeThisWeek === 1 ? '' : 's'} this week`;
  }

  function installGameShell() {
    const challengeLayout = challengeBand.querySelector('.designer-challenge-layout');
    if (!challengeLayout) return;
    challengeBand.classList.add('game-brief-band');
    challengeLayout.innerHTML = `
      <article class="game-brief-card" id="game-brief-card">
        <div class="game-brief-main">
          <div class="game-brief-kicker-row">
            <span class="eyebrow" id="game-brief-kicker">Today's studio brief</span>
            <span class="game-difficulty" id="game-brief-difficulty"></span>
          </div>
          <h2 id="challenge-heading">Loading today's brief…</h2>
          <p id="challenge-prompt" class="designer-challenge-prompt">A playable architecture prompt is loading.</p>
          <div class="game-brief-meter" aria-label="Brief progress">
            <div class="game-brief-meter-track"><span id="game-brief-meter-fill"></span></div>
            <strong id="game-brief-meter-text">0%</strong>
          </div>
          <ul class="game-rule-list" id="game-rule-list"></ul>
        </div>
        <aside class="game-studio-progress">
          <span class="eyebrow">Studio progression</span>
          <strong id="game-level-name">Studio Visitor · Lv 1</strong>
          <div class="game-level-row"><span id="game-xp-value">0 XP</span><span id="game-rhythm">0 design days this week</span></div>
          <div class="game-level-track"><span id="game-level-fill"></span></div>
          <small id="game-level-next">120 XP to Sketch Starter</small>
          <div class="game-brief-actions">
            <button type="button" class="button button-primary" id="game-battle">3-minute build</button>
            <button type="button" class="button button-outline" id="game-practice">Practice brief</button>
            <button type="button" class="button button-outline" id="game-daily">Today's brief</button>
          </div>
          <div class="game-timer" id="game-timer" hidden><span>Build timer</span><strong id="game-timer-value">3:00</strong></div>
        </aside>
      </article>`;

    const actions = document.querySelector('.designer-actions');
    if (actions && !$('designer-game-bar')) {
      const bar = document.createElement('div');
      bar.id = 'designer-game-bar';
      bar.className = 'designer-game-bar';
      bar.innerHTML = `
        <button type="button" class="button button-primary" id="game-desk-crit">Desk crit</button>
        <button type="button" class="button button-outline" id="game-arrays">Architectural arrays</button>
        <button type="button" class="button button-outline" id="game-present">Present</button>
        <button type="button" class="button button-outline" id="game-batch-undo" hidden>Undo layout tool</button>`;
      actions.parentNode.insertBefore(bar, actions);
    }

    $('name-building')?.setAttribute('hidden', '');
    $('sprint-toggle')?.setAttribute('hidden', '');
    $('shape-repeat')?.setAttribute('hidden', '');
    $('designer-badges')?.setAttribute('hidden', '');
    const vibeStat = $('stat-vibe')?.closest('div');
    if (vibeStat) vibeStat.hidden = true;

    installMovePad();
    installDialogs();
    wireGameActions();
    renderProgression();
  }

  function installMovePad() {
    const selected = $('selected-controls');
    if (!selected || $('game-move-pad')) return;
    const wrap = document.createElement('div');
    wrap.id = 'game-move-pad';
    wrap.className = 'game-move-pad-wrap';
    wrap.innerHTML = `
      <div class="designer-tool-heading"><h3>Move precisely</h3><span class="designer-hint">tap-friendly</span></div>
      <div class="game-move-pad" role="group" aria-label="Move selected part">
        <span></span><button type="button" data-nudge="ArrowUp" aria-label="Move up">↑</button><span></span>
        <button type="button" data-nudge="ArrowLeft" aria-label="Move left">←</button><button type="button" class="game-move-center" data-nudge-size="toggle" aria-label="Toggle movement step">1×</button><button type="button" data-nudge="ArrowRight" aria-label="Move right">→</button>
        <span></span><button type="button" data-nudge="ArrowDown" aria-label="Move down">↓</button><span></span>
      </div>
      <p class="designer-hint game-move-hint">Tap the center to switch between normal and large nudges.</p>`;
    selected.appendChild(wrap);
    let large = false;
    wrap.addEventListener('click', event => {
      const toggle = event.target.closest('[data-nudge-size]');
      if (toggle) {
        large = !large;
        toggle.textContent = large ? '5×' : '1×';
        return;
      }
      const button = event.target.closest('[data-nudge]');
      if (!button) return;
      canvas.focus({ preventScroll: true });
      document.dispatchEvent(new KeyboardEvent('keydown', { key: button.dataset.nudge, shiftKey: large, bubbles: true }));
      scheduleProgress();
    });
  }

  function installDialogs() {
    if (!$('game-crit-dialog')) {
      const dialog = document.createElement('dialog');
      dialog.id = 'game-crit-dialog';
      dialog.className = 'designer-critique-dialog game-dialog';
      dialog.innerHTML = `
        <form method="dialog" class="critique-card">
          <div class="critique-head"><div><p class="eyebrow">Desk crit</p><h2>Read the composition, then make one move.</h2></div><button class="critique-close" value="close" aria-label="Close">×</button></div>
          <div class="game-crit-metrics" id="game-crit-metrics"></div>
          <div class="critique-block"><strong>What's working</strong><p id="game-crit-positive"></p></div>
          <div class="critique-block"><strong>Push next</strong><p id="game-crit-push"></p></div>
          <div class="critique-block"><strong>Pin-up question</strong><p id="game-crit-question"></p></div>
          <div class="critique-concept"><span>Concept statement</span><p id="game-crit-concept"></p></div>
          <div class="button-row"><button type="button" class="button button-primary" id="game-copy-concept">Copy concept</button><button value="close" class="button button-outline">Back to building</button></div>
        </form>`;
      document.body.appendChild(dialog);
    }

    if (!$('game-array-dialog')) {
      const dialog = document.createElement('dialog');
      dialog.id = 'game-array-dialog';
      dialog.className = 'designer-critique-dialog game-dialog';
      dialog.innerHTML = `
        <form method="dialog" class="critique-card game-array-card" id="game-array-form">
          <div class="critique-head"><div><p class="eyebrow">Architectural generator</p><h2>Build repetition on purpose.</h2></div><button class="critique-close" value="close" aria-label="Close">×</button></div>
          <p class="muted">Generate editable windows, columns, or trees as a precise array. This is faster than duplicating one part at a time and keeps the result fully editable.</p>
          <label class="designer-field">Pattern
            <select id="game-array-kind"><option value="windows">Window grid</option><option value="columns">Column bay</option><option value="trees">Tree row</option></select>
          </label>
          <div class="game-array-grid">
            <label class="designer-field">Columns / count<input id="game-array-cols" type="number" min="2" max="10" value="5"></label>
            <label class="designer-field" id="game-array-rows-wrap">Rows<input id="game-array-rows" type="number" min="1" max="5" value="2"></label>
            <label class="designer-field">Width<input id="game-array-width" type="number" min="18" max="180" value="48"></label>
            <label class="designer-field">Height<input id="game-array-height" type="number" min="18" max="220" value="56"></label>
            <label class="designer-field">Gap X<input id="game-array-gap-x" type="number" min="0" max="100" value="18"></label>
            <label class="designer-field" id="game-array-gap-y-wrap">Gap Y<input id="game-array-gap-y" type="number" min="0" max="100" value="18"></label>
            <label class="designer-field">Start X<input id="game-array-x" type="number" min="0" max="760" value="220"></label>
            <label class="designer-field">Start Y<input id="game-array-y" type="number" min="0" max="500" value="210"></label>
          </div>
          <label class="designer-toggle" id="game-array-lit-wrap"><input type="checkbox" id="game-array-lit"> Light the windows</label>
          <div class="button-row"><button type="button" class="button button-primary" id="game-array-create">Create editable array</button><button value="close" class="button button-outline">Cancel</button></div>
        </form>`;
      document.body.appendChild(dialog);
    }

    if (!$('game-presentation-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'game-presentation-overlay';
      overlay.className = 'designer-presentation-overlay';
      overlay.innerHTML = `<div class="designer-presentation-title"><span>AIAS Design Studio</span><strong id="game-presentation-title">Untitled building</strong><span id="game-presentation-author"></span></div><button type="button" class="presentation-exit" id="game-presentation-exit">Exit presentation</button>`;
      document.querySelector('.designer-workspace-wrap')?.appendChild(overlay);
    }
  }

  function wireGameActions() {
    $('game-practice')?.addEventListener('click', () => selectPracticeBrief());
    $('game-daily')?.addEventListener('click', () => selectDailyBrief());
    $('game-battle')?.addEventListener('click', startBattle);
    $('game-desk-crit')?.addEventListener('click', openCrit);
    $('game-arrays')?.addEventListener('click', () => openDialog($('game-array-dialog')));
    $('game-present')?.addEventListener('click', enterPresentation);
    $('game-presentation-exit')?.addEventListener('click', exitPresentation);
    $('game-batch-undo')?.addEventListener('click', undoBatch);
    $('game-array-kind')?.addEventListener('change', syncArrayFields);
    $('game-array-create')?.addEventListener('click', createArray);
    $('game-copy-concept')?.addEventListener('click', copyConcept);

    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && document.body.classList.contains('designer-presenting')) exitPresentation(false);
    });

    document.addEventListener('click', event => {
      if (event.target.closest('#game-array-create, #game-batch-undo, #game-array-dialog')) return;
      if (event.target.closest('#create-share')) awardMilestone('first-share', 25, 'first share link');
      if (event.target.closest('#download-png, #download-poster')) awardMilestone('first-export', 20, 'first export');
      if (event.target.closest('#save-sketchbook')) awardMilestone('first-sketchbook', 25, 'first Sketchbook save');
      if (event.target.closest('#publish-community-design')) awardMilestone('first-publish', 40, 'first community publish attempt');
      if (!applyingBatch && event.target.closest('[data-add-shape], [data-template], [data-palette], .designer-mini-actions button')) clearBatchUndo();
      scheduleProgress();
    }, true);
    document.addEventListener('change', scheduleProgress, true);
    canvas.addEventListener('pointerup', scheduleProgress);
    document.addEventListener('keyup', event => {
      if (event.key.startsWith('Arrow') || ['Delete', 'Backspace', 'i', 'I', 'g', 'G'].includes(event.key)) scheduleProgress();
    });

    const status = $('studio-status');
    if (status) {
      new MutationObserver(() => {
        if (/^Challenge complete\./.test(status.textContent || '')) {
          status.textContent = activeBrief ? `Brief progress: ${briefCompletion().pct}%.` : 'Keep building.';
        }
      }).observe(status, { childList: true, characterData: true, subtree: true });
    }
  }

  let progressFrame = 0;
  function scheduleProgress() {
    if (progressFrame) return;
    progressFrame = requestAnimationFrame(() => {
      progressFrame = 0;
      renderBriefProgress();
    });
  }

  function dailyBrief() {
    if (!briefs.length) return null;
    return briefs[stableHash(dayKey()) % briefs.length];
  }

  function setBrief(brief, mode) {
    if (!brief) return;
    activeBrief = brief;
    briefMode = mode;
    lastProgress = -1;
    const kicker = mode === 'daily' ? "Today's studio brief" : mode === 'battle' ? '3-minute build' : 'Practice brief';
    if ($('game-brief-kicker')) $('game-brief-kicker').textContent = kicker;
    if ($('challenge-heading')) $('challenge-heading').textContent = brief.title;
    if ($('challenge-prompt')) $('challenge-prompt').textContent = brief.prompt;
    if ($('game-brief-difficulty')) $('game-brief-difficulty').textContent = `${'●'.repeat(clamp(brief.difficulty || 1, 1, 3))}${'○'.repeat(3 - clamp(brief.difficulty || 1, 1, 3))}`;
    renderBriefProgress();
  }

  function selectDailyBrief() {
    stopBattle();
    setBrief(dailyBrief(), 'daily');
    announce("Today's brief restored. Your progress is saved locally when you complete it.");
  }

  function selectPracticeBrief() {
    stopBattle();
    const today = dailyBrief()?.id;
    const pool = briefs.filter(brief => brief.id !== activeBrief?.id && brief.id !== today);
    const brief = pool[Math.floor(Math.random() * pool.length)] || briefs[0];
    setBrief(brief, 'practice');
    announce(`Practice brief loaded: ${brief.title}.`);
  }

  function startBattle() {
    stopBattle();
    const pool = briefs.filter(brief => brief.id !== activeBrief?.id);
    const brief = pool[Math.floor(Math.random() * pool.length)] || briefs[0];
    setBrief(brief, 'battle');
    battleSeconds = 180;
    const timer = $('game-timer');
    if (timer) timer.hidden = false;
    updateBattleClock();
    announce(`3-minute build started: ${brief.title}. Solve the brief, not the timer.`);
    battleTimer = setInterval(() => {
      battleSeconds -= 1;
      updateBattleClock();
      if (battleSeconds <= 0) finishBattle();
    }, 1000);
  }

  function updateBattleClock() {
    const value = $('game-timer-value');
    if (!value) return;
    const minutes = Math.floor(Math.max(0, battleSeconds) / 60);
    const seconds = String(Math.max(0, battleSeconds) % 60).padStart(2, '0');
    value.textContent = `${minutes}:${seconds}`;
    value.classList.toggle('is-urgent', battleSeconds <= 30);
  }

  function finishBattle() {
    if (battleTimer) clearInterval(battleTimer);
    battleTimer = null;
    const completion = briefCompletion();
    if (completion.done) {
      completeActiveBrief(completion);
      announce(`Time. Brief cleared at ${completion.pct}% + required rules complete.`);
    } else {
      announce(`Time. You reached ${completion.pct}% of the brief. Keep building or try another round.`);
    }
  }

  function stopBattle() {
    if (battleTimer) clearInterval(battleTimer);
    battleTimer = null;
    battleSeconds = 0;
    if ($('game-timer')) $('game-timer').hidden = true;
  }

  function captureState() {
    const saveButton = $('save-draft');
    if (!saveButton) return null;
    const oldStatus = $('studio-status')?.textContent || '';
    let previous = null;
    let hadPrevious = false;
    try {
      previous = localStorage.getItem(DRAFT_KEY);
      hadPrevious = previous !== null;
      saveButton.click();
      const current = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (hadPrevious) localStorage.setItem(DRAFT_KEY, previous); else localStorage.removeItem(DRAFT_KEY);
      if ($('studio-status')) $('studio-status').textContent = oldStatus;
      return current;
    } catch {
      try { if (hadPrevious) localStorage.setItem(DRAFT_KEY, previous); else localStorage.removeItem(DRAFT_KEY); } catch {}
      return null;
    }
  }

  function applyBatchState(next, message) {
    const loadButton = $('load-draft');
    if (!loadButton || !next) return false;
    const before = captureState();
    if (!before) return false;
    let previous = null;
    let hadPrevious = false;
    try {
      previous = localStorage.getItem(DRAFT_KEY);
      hadPrevious = previous !== null;
      applyingBatch = true;
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      loadButton.click();
      if (hadPrevious) localStorage.setItem(DRAFT_KEY, previous); else localStorage.removeItem(DRAFT_KEY);
      lastBatchUndo = before;
      const undo = $('game-batch-undo');
      if (undo) undo.hidden = false;
      announce(message);
      scheduleProgress();
      return true;
    } catch {
      if (hadPrevious) localStorage.setItem(DRAFT_KEY, previous); else localStorage.removeItem(DRAFT_KEY);
      announce('That layout operation could not be applied.');
      return false;
    } finally {
      applyingBatch = false;
    }
  }

  function undoBatch() {
    if (!lastBatchUndo) return;
    const restore = lastBatchUndo;
    lastBatchUndo = null;
    const undo = $('game-batch-undo');
    if (undo) undo.hidden = true;
    applyBatchState(restore, 'Layout tool undone.');
    lastBatchUndo = null;
    if (undo) undo.hidden = true;
  }

  function clearBatchUndo() {
    lastBatchUndo = null;
    const undo = $('game-batch-undo');
    if (undo) undo.hidden = true;
  }

  function uid() {
    return globalThis.crypto?.randomUUID?.() || `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function syncArrayFields() {
    const kind = $('game-array-kind')?.value || 'windows';
    const windows = kind === 'windows';
    if ($('game-array-rows-wrap')) $('game-array-rows-wrap').hidden = !windows;
    if ($('game-array-gap-y-wrap')) $('game-array-gap-y-wrap').hidden = !windows;
    if ($('game-array-lit-wrap')) $('game-array-lit-wrap').hidden = !windows;
    const width = $('game-array-width');
    const height = $('game-array-height');
    if (kind === 'columns') { if (width) width.value = '34'; if (height) height.value = '160'; }
    if (kind === 'trees') { if (width) width.value = '84'; if (height) height.value = '125'; }
    if (kind === 'windows') { if (width) width.value = '48'; if (height) height.value = '56'; }
  }

  function createArray() {
    const state = captureState();
    if (!state || !Array.isArray(state.shapes)) return announce('Could not read the current design.');
    const kind = $('game-array-kind')?.value || 'windows';
    const cols = Math.round(clamp($('game-array-cols')?.value, 2, 10));
    const rows = kind === 'windows' ? Math.round(clamp($('game-array-rows')?.value, 1, 5)) : 1;
    const w = clamp($('game-array-width')?.value, 18, 180);
    const h = clamp($('game-array-height')?.value, 18, 220);
    const gapX = clamp($('game-array-gap-x')?.value, 0, 100);
    const gapY = clamp($('game-array-gap-y')?.value, 0, 100);
    const startX = clamp($('game-array-x')?.value, 0, 780);
    const startY = clamp($('game-array-y')?.value, 0, 500);
    const requested = cols * rows;
    if (state.shapes.length + requested > MAX_PARTS) return announce(`That array would exceed the ${MAX_PARTS}-part design limit.`);

    const shapes = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = startX + col * (w + gapX);
        const y = startY + row * (h + gapY);
        if (x + w > 800 || y + h > 520) return announce('That array runs off the canvas. Reduce count/spacing or move the start point.');
        if (kind === 'windows') shapes.push({ id: uid(), type: 'window', x, y, w, h, fill: '#9ED8F0', rotation: 0, material: 'glass', opacity: 100, locked: false, variant: $('game-array-lit')?.checked ? 'lit' : 'default' });
        if (kind === 'columns') shapes.push({ id: uid(), type: 'column', x, y, w, h, fill: '#9C9EA1', rotation: 0, material: 'solid', opacity: 100, locked: false, variant: 'default' });
        if (kind === 'trees') shapes.push({ id: uid(), type: 'tree', x, y, w, h, fill: '#55785A', rotation: 0, material: 'solid', opacity: 100, locked: false, variant: col % 3 === 1 ? 'alt1' : col % 3 === 2 ? 'alt2' : 'default' });
      }
    }
    state.shapes.push(...shapes);
    if (applyBatchState(state, `${requested} editable ${kind} added as a precise array.`)) $('game-array-dialog')?.close?.();
  }

  function compositionMetrics(state) {
    const shapes = Array.isArray(state?.shapes) ? state.shapes : [];
    if (!shapes.length) return { balance: 0, grounded: 0, overlaps: 0, windowRhythm: null, centerX: 400 };
    const areas = shapes.map(shape => Math.max(1, Number(shape.w) * Number(shape.h)));
    const totalArea = areas.reduce((a, b) => a + b, 0);
    const centerX = shapes.reduce((sum, shape, i) => sum + (Number(shape.x) + Number(shape.w) / 2) * areas[i], 0) / totalArea;
    const balance = Math.abs(centerX - 400) / 400;
    const grounded = shapes.filter(shape => Number(shape.y) + Number(shape.h) >= 500).length / shapes.length;
    let overlaps = 0;
    let pairs = 0;
    for (let i = 0; i < shapes.length; i += 1) {
      for (let j = i + 1; j < shapes.length; j += 1) {
        pairs += 1;
        const a = shapes[i], b = shapes[j];
        const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
        const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        if (ix * iy > Math.min(a.w * a.h, b.w * b.h) * .18) overlaps += 1;
      }
    }
    const windows = shapes.filter(shape => shape.type === 'window').sort((a, b) => a.x - b.x);
    let windowRhythm = null;
    if (windows.length >= 4) {
      const gaps = windows.slice(1).map((window, i) => Math.abs(window.x - windows[i].x));
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const variance = gaps.reduce((sum, gap) => sum + Math.pow(gap - mean, 2), 0) / gaps.length;
      windowRhythm = mean ? Math.sqrt(variance) / mean : 1;
    }
    return { balance, grounded, overlaps: pairs ? overlaps / pairs : 0, windowRhythm, centerX };
  }

  function buildCrit(state) {
    const facts = summaryFromDom();
    const metrics = compositionMetrics(state);
    const working = [];
    const push = [];
    if (metrics.balance < .12) working.push('The visual weight is well balanced across the canvas, so the composition reads as intentional rather than accidental.');
    else if (metrics.balance < .25) working.push('The asymmetry has enough counterweight to feel deliberate.');
    if (metrics.windowRhythm !== null && metrics.windowRhythm < .24) working.push('The opening pattern has a readable rhythm; repetition is doing architectural work.');
    if ((facts.counts.Tree || 0) >= 3) working.push('The landscape participates in the composition instead of sitting at the edge as decoration.');
    if ((facts.counts.Door || 0) >= 1) working.push('There is a visible moment of arrival, which gives the facade a clear human reference point.');
    if (metrics.grounded > .25) working.push('Several elements meet the ground clearly, which gives the massing believable weight.');
    if (!working.length) working.push('The main masses establish a legible starting hierarchy.');

    if (!(facts.counts.Door || 0)) push.push('There is no clear arrival yet. Decide where a person enters and make that moment intentional.');
    if (facts.colors > 4) push.push('The palette is competing with the massing. Reduce the number of colors so form and hierarchy carry more of the idea.');
    if (metrics.balance > .32) push.push('Most of the visual weight is concentrated on one side. Either reinforce that asymmetry or add a deliberate counterweight.');
    if (metrics.overlaps > .18) push.push('Several parts overlap heavily. Clarify which overlaps are spatial ideas and which are just visual clutter.');
    if ((facts.counts.Window || 0) === 0) push.push('The building reads as sealed. Add an opening strategy—or make the lack of openings an explicit concept.');
    if ((facts.counts.Tree || 0) === 0 && ['lawn', 'river'].includes(facts.background)) push.push('The selected site background is asking for a landscape response. Give the building something outside itself to negotiate with.');
    if (facts.parts > 26) push.push('The idea may be hiding under too many moves. Delete three low-value parts and see whether the hierarchy gets stronger.');
    if (!push.length) push.push('Push the hierarchy one more step: choose the single move that should be remembered after someone looks away.');

    const question = metrics.balance > .32 ? 'Is the imbalance part of the concept, or did the composition simply drift there?' : (facts.counts.Door || 0) ? 'What should someone understand about the building before they reach the door?' : 'Where does a person enter, and why there?';
    const title = $('design-title')?.value?.trim() || 'This project';
    const site = ({ river: 'riverfront edge', lawn: 'campus landscape', night: 'night-time setting', sunset: 'late-day field', blueprint: 'diagrammatic field', paper: 'abstract field', grid: 'studio grid' })[facts.background] || 'site';
    const dominant = (facts.counts.Window || 0) >= 6 ? 'a repeated opening rhythm' : (facts.counts.Column || 0) >= 4 ? 'a structural cadence' : (facts.counts.Arch || 0) >= 2 ? 'a sequence of thresholds' : 'layered primary and secondary masses';
    const concept = `${title} organizes ${dominant} within a ${site}, using contrast between solid form, openings, and site elements to establish a clear hierarchy.`;
    return { working: working[0], push: push[0], question, concept, metrics, facts };
  }

  function openCrit() {
    const state = captureState();
    if (!state?.shapes?.length) return announce('Add a few parts before asking for a Desk crit.');
    const crit = buildCrit(state);
    if ($('game-crit-positive')) $('game-crit-positive').textContent = crit.working;
    if ($('game-crit-push')) $('game-crit-push').textContent = crit.push;
    if ($('game-crit-question')) $('game-crit-question').textContent = crit.question;
    if ($('game-crit-concept')) $('game-crit-concept').textContent = crit.concept;
    const balance = Math.round((1 - Math.min(1, crit.metrics.balance)) * 100);
    const grounded = Math.round(crit.metrics.grounded * 100);
    const rhythm = crit.metrics.windowRhythm === null ? 'n/a' : `${Math.round((1 - Math.min(1, crit.metrics.windowRhythm)) * 100)}%`;
    if ($('game-crit-metrics')) $('game-crit-metrics').innerHTML = `<span>Balance <strong>${balance}%</strong></span><span>Ground contact <strong>${grounded}%</strong></span><span>Window rhythm <strong>${rhythm}</strong></span>`;
    openDialog($('game-crit-dialog'));
    awardMilestone('first-crit', 20, 'first Desk crit');
  }

  async function copyConcept() {
    const text = $('game-crit-concept')?.textContent || '';
    let ok = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); ok = true; } } catch {}
    const button = $('game-copy-concept');
    if (button) {
      button.textContent = ok ? 'Concept copied ✓' : 'Copy unavailable';
      setTimeout(() => { if (button.isConnected) button.textContent = 'Copy concept'; }, 1400);
    }
  }

  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }

  async function enterPresentation() {
    const workspace = document.querySelector('.designer-workspace-wrap');
    if (!workspace) return;
    if ($('game-presentation-title')) $('game-presentation-title').textContent = $('design-title')?.value?.trim() || 'Untitled building';
    if ($('game-presentation-author')) $('game-presentation-author').textContent = $('design-author')?.value?.trim() ? `by ${$('design-author').value.trim()}` : '';
    document.body.classList.add('designer-presenting');
    try { if (workspace.requestFullscreen && !document.fullscreenElement) await workspace.requestFullscreen(); } catch {}
  }

  async function exitPresentation(leaveFullscreen = true) {
    document.body.classList.remove('designer-presenting');
    if (leaveFullscreen) {
      try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {}
    }
  }

  async function loadBriefLibrary() {
    try {
      const response = await fetch('data/designer-briefs.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('briefs');
      const data = await response.json();
      briefs = Array.isArray(data) ? data.filter(item => item?.id && item?.title && Array.isArray(item.rules)) : [];
    } catch {
      briefs = [];
    }
    if (!briefs.length) {
      if ($('challenge-heading')) $('challenge-heading').textContent = 'Free build';
      if ($('challenge-prompt')) $('challenge-prompt').textContent = 'The brief library could not load. The building tools still work normally.';
      return;
    }
    setBrief(dailyBrief(), 'daily');
  }

  function hideLegacyGameControls() {
    $('name-building')?.setAttribute('hidden', '');
    $('sprint-toggle')?.setAttribute('hidden', '');
    $('shape-repeat')?.setAttribute('hidden', '');
  }

  installGameShell();
  hideLegacyGameControls();
  loadBriefLibrary();
})();

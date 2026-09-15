(() => {
  'use strict';

  const svg = document.getElementById('design-canvas');
  const shapesLayer = document.getElementById('canvas-shapes');
  const selectionLayer = document.getElementById('selection-layer');
  const sceneLayer = document.getElementById('scene-details');
  if (!svg || !shapesLayer || !selectionLayer || !sceneLayer) return;

  const WIDTH = 800;
  const HEIGHT = 520;
  const MAX_SHAPES = 60;
  const MAX_CODE_LENGTH = 24000;
  const STORAGE_KEY = 'aias-memphis-design-studio-draft-v2';
  const LEGACY_STORAGE_KEY = 'aias-memphis-design-studio-draft-v1';
  const FAVORITES_KEY = 'aias-memphis-design-studio-favorites-v1';

  const TYPES = new Set(['rect', 'triangle', 'circle', 'arch', 'window', 'door', 'column', 'tree']);
  const MATERIALS = new Set(['solid', 'glass', 'translucent', 'outline']);
  const BACKGROUNDS = new Set(['grid', 'paper', 'blueprint', 'river', 'lawn', 'sunset', 'night']);

  const TYPE_LABELS = {
    rect: 'Block', triangle: 'Roof', circle: 'Circle', arch: 'Arch',
    window: 'Window', door: 'Door', column: 'Column', tree: 'Tree'
  };

  const DEFAULTS = {
    rect: { w: 176, h: 128, fill: '#00498F' },
    triangle: { w: 184, h: 112, fill: '#193059' },
    circle: { w: 108, h: 108, fill: '#9C9EA1' },
    arch: { w: 120, h: 150, fill: '#00498F' },
    window: { w: 70, h: 70, fill: '#9ED8F0', material: 'glass' },
    door: { w: 68, h: 124, fill: '#193059' },
    column: { w: 38, h: 150, fill: '#9C9EA1' },
    tree: { w: 92, h: 132, fill: '#55785A' }
  };

  const PALETTES = {
    memphis: ['#00498F', '#193059', '#9C9EA1', '#E2E4E6', '#FFFFFF'],
    warm: ['#B65E3C', '#E5B769', '#6D3B2F', '#E8D4B0', '#FFF5E8'],
    earth: ['#556B55', '#A48B6A', '#D8CDBB', '#7A5D45', '#EEF1E9'],
    mono: ['#263238', '#6B747A', '#D5D9DC', '#F4F5F6', '#111827'],
    neon: ['#6EE7F5', '#E879F9', '#FDE047', '#7C3AED', '#0B132B']
  };

  const CHALLENGES = [
    { text: 'Design a tiny pavilion using no more than 7 pieces.', test: s => s.shapes.length > 0 && s.shapes.length <= 7 },
    { text: 'Make a building with at least 6 windows and one dramatic roof.', test: s => countType(s, 'window') >= 6 && countType(s, 'triangle') >= 1 },
    { text: 'Create a night building with at least 4 glowing windows.', test: s => s.background === 'night' && s.shapes.filter(x => x.type === 'window' && x.variant === 'lit').length >= 4 },
    { text: 'Design a civic facade using at least 5 columns.', test: s => countType(s, 'column') >= 5 },
    { text: 'Use exactly 3 colors across at least 8 pieces.', test: s => s.shapes.length >= 8 && distinctColors(s).length === 3 },
    { text: 'Make a landscape-heavy composition with at least 4 trees.', test: s => countType(s, 'tree') >= 4 },
    { text: 'Build a glassy tower: 10+ parts and at least 4 glass pieces.', test: s => s.shapes.length >= 10 && s.shapes.filter(x => x.material === 'glass').length >= 4 },
    { text: 'Use an arch, a circle, and a roof in the same composition.', test: s => ['arch', 'circle', 'triangle'].every(t => countType(s, t) > 0) },
    { text: 'Try brutal minimalism: 5 pieces or fewer, only monochrome colors.', test: s => s.shapes.length > 0 && s.shapes.length <= 5 && distinctColors(s).every(c => PALETTES.mono.includes(c)) },
    { text: 'Create a courtyard idea with two separate masses and at least 2 trees.', test: s => countType(s, 'rect') >= 2 && countType(s, 'tree') >= 2 }
  ];

  const $ = id => document.getElementById(id);
  const clamp = (n, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(n)) ? Number(n) : min));
  const validHex = value => /^#[0-9a-f]{6}$/i.test(String(value || ''));
  const escapeHTML = value => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const randomItem = list => list[Math.floor(Math.random() * list.length)];

  const titleInput = $('design-title');
  const authorInput = $('design-author');
  const backgroundInput = $('design-background');
  const colorInput = $('shape-color');
  const materialInput = $('shape-material');
  const widthInput = $('shape-width');
  const heightInput = $('shape-height');
  const rotationInput = $('shape-rotation');
  const opacityInput = $('shape-opacity');
  const widthValue = $('width-value');
  const heightValue = $('height-value');
  const rotationValue = $('rotation-value');
  const opacityValue = $('opacity-value');
  const selectedLabel = $('selected-label');
  const snapToggle = $('snap-toggle');
  const gridInput = $('grid-size');
  const lightsToggle = $('lights-toggle');
  const undoButton = $('undo-action');
  const redoButton = $('redo-action');
  const status = $('studio-status');
  const sharePanel = $('share-panel');
  const shareUrlInput = $('share-url');
  const designCodeInput = $('design-code');
  const submitDesign = $('submit-design');
  const submissionNote = $('submission-note');
  const challengePrompt = $('challenge-prompt');
  const layersTarget = $('designer-layers');
  const badgesTarget = $('designer-badges');
  const statParts = $('stat-shapes');
  const statColors = $('stat-colors');
  const statVibe = $('stat-vibe');
  const showcaseTarget = $('design-showcase');

  const controls = {
    back: $('shape-back'), front: $('shape-front'), duplicate: $('shape-duplicate'),
    lock: $('shape-lock'), delete: $('shape-delete'), interact: null, repeat: null, ground: null
  };

  let state = defaultState();
  let selectedId = '';
  let pointerAction = null;
  let contactEmail = '';
  let history = [];
  let historyIndex = -1;
  let controlStart = '';
  let currentChallenge = 0;
  let challengeWasComplete = false;
  let showcaseEntries = [];
  let showcaseFilter = 'all';
  let favorites = loadFavorites();
  let sprintSeconds = 0;
  let sprintTimer = null;

  function defaultState() {
    return { v: 2, title: '', designer: '', background: 'grid', snap: true, grid: 16, lights: true, shapes: [] };
  }

  function uid() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function countType(input, type) { return input.shapes.filter(shape => shape.type === type).length; }
  function distinctColors(input) { return [...new Set(input.shapes.map(shape => shape.fill.toUpperCase()))]; }
  function selectedShape() { return state.shapes.find(shape => shape.id === selectedId) || null; }
  function say(message) { if (status) status.textContent = message; }

  function gridSize() {
    const value = Number(gridInput?.value || state.grid || 16);
    return [8, 16, 32].includes(value) ? value : 16;
  }

  function snapNumber(value) {
    return (snapToggle?.checked ?? state.snap) ? Math.round(value / gridSize()) * gridSize() : value;
  }

  function sanitizeShape(raw = {}) {
    if (!TYPES.has(raw.type)) return null;
    const defaults = DEFAULTS[raw.type];
    const w = clamp(raw.w ?? defaults.w, 18, 600);
    const h = clamp(raw.h ?? defaults.h, 18, 460);
    const variants = new Set(['default', 'lit', 'open', 'alt1', 'alt2']);
    return {
      id: String(raw.id || uid()).slice(0, 96),
      type: raw.type,
      x: clamp(raw.x ?? 300, 0, WIDTH - w),
      y: clamp(raw.y ?? 190, 0, HEIGHT - h),
      w, h,
      fill: validHex(raw.fill) ? String(raw.fill).toUpperCase() : defaults.fill,
      rotation: clamp(raw.rotation ?? 0, -180, 180),
      material: MATERIALS.has(raw.material) ? raw.material : (defaults.material || 'solid'),
      opacity: clamp(raw.opacity ?? 100, 20, 100),
      locked: Boolean(raw.locked),
      variant: variants.has(raw.variant) ? raw.variant : 'default'
    };
  }

  function sanitizeState(raw = {}) {
    const gridValue = Number(raw.grid ?? raw.gridSize);
    return {
      v: 2,
      title: String(raw.title || '').trim().slice(0, 80),
      designer: String(raw.designer || '').trim().slice(0, 80),
      background: BACKGROUNDS.has(raw.background) ? raw.background : 'grid',
      snap: raw.snap !== false,
      grid: [8, 16, 32].includes(gridValue) ? gridValue : 16,
      lights: raw.lights !== false,
      shapes: Array.isArray(raw.shapes) ? raw.shapes.map(sanitizeShape).filter(Boolean).slice(0, MAX_SHAPES) : []
    };
  }

  function syncStateFromInputs() {
    state.title = String(titleInput?.value || '').trim().slice(0, 80);
    state.designer = String(authorInput?.value || '').trim().slice(0, 80);
    state.background = BACKGROUNDS.has(backgroundInput?.value) ? backgroundInput.value : 'grid';
    state.snap = Boolean(snapToggle?.checked);
    state.grid = gridSize();
    state.lights = Boolean(lightsToggle?.checked);
  }

  function syncInputsFromState() {
    if (titleInput) titleInput.value = state.title;
    if (authorInput) authorInput.value = state.designer;
    if (backgroundInput) backgroundInput.value = state.background;
    if (snapToggle) snapToggle.checked = state.snap;
    if (gridInput) gridInput.value = String(state.grid);
    if (lightsToggle) lightsToggle.checked = state.lights;
  }

  function snapshot() {
    syncStateFromInputs();
    return JSON.stringify(sanitizeState(state));
  }

  function resetHistory() {
    history = [snapshot()];
    historyIndex = 0;
    updateHistoryButtons();
  }

  function commit(before = '') {
    const current = snapshot();
    const comparison = before || history[historyIndex] || '';
    if (current === comparison) return updateHistoryButtons();
    history = history.slice(0, historyIndex + 1);
    history.push(current);
    if (history.length > 80) history.shift();
    historyIndex = history.length - 1;
    updateHistoryButtons();
  }

  function restoreHistory(index, message) {
    if (index < 0 || index >= history.length) return;
    historyIndex = index;
    loadState(JSON.parse(history[index]), message, false);
    updateHistoryButtons();
  }

  function undo() { if (historyIndex > 0) restoreHistory(historyIndex - 1, 'Undid the last change.'); }
  function redo() { if (historyIndex < history.length - 1) restoreHistory(historyIndex + 1, 'Redid the change.'); }
  function updateHistoryButtons() {
    if (undoButton) undoButton.disabled = historyIndex <= 0;
    if (redoButton) redoButton.disabled = historyIndex >= history.length - 1;
  }

  function installExtraControls() {
    const actionGrid = document.querySelector('.designer-mini-actions');
    const makeAction = (id, label) => {
      if (!actionGrid || $(id)) return $(id);
      const button = document.createElement('button');
      button.type = 'button'; button.id = id; button.textContent = label; button.disabled = true;
      actionGrid.insertBefore(button, controls.delete || null);
      return button;
    };
    controls.interact = makeAction('shape-interact', 'Interact');
    controls.repeat = makeAction('shape-repeat', 'Repeat ×3');
    controls.ground = makeAction('shape-ground', 'Ground');
    controls.interact?.addEventListener('click', interactSelected);
    controls.repeat?.addEventListener('click', repeatSelected);
    controls.ground?.addEventListener('click', groundSelected);

    const projectSection = titleInput?.closest('.designer-tool-section');
    if (projectSection && !$('name-building')) {
      const button = document.createElement('button');
      button.type = 'button'; button.id = 'name-building'; button.className = 'template-button';
      button.style.cssText = 'width:100%;margin-top:.25rem'; button.textContent = 'Name it for me';
      projectSection.appendChild(button);
      button.addEventListener('click', generateName);
    }

    const challengeActions = document.querySelector('.designer-challenge-actions');
    if (challengeActions && !$('sprint-toggle')) {
      const button = document.createElement('button');
      button.type = 'button'; button.id = 'sprint-toggle'; button.className = 'button button-outline';
      button.textContent = '3-minute sprint';
      challengeActions.appendChild(button);
      button.addEventListener('click', toggleSprint);
    }
  }

  function generateName() {
    const adjectives = ['Blue', 'River', 'Civic', 'Quiet', 'Stacked', 'Open', 'Night', 'Memphis', 'Porous', 'Folded', 'Little', 'Electric', 'Sunset', 'Garden', 'Shared', 'Floating', 'Brick', 'Soft'];
    const nouns = ['House', 'Commons', 'Pavilion', 'Court', 'Tower', 'Workshop', 'Porch', 'Gallery', 'Forum', 'Yard', 'Arcade', 'Canopy', 'Lantern', 'Terrace', 'Hall', 'Hub'];
    const before = snapshot();
    const name = `${randomItem(adjectives)} ${randomItem(nouns)}`;
    state.title = name; if (titleInput) titleInput.value = name;
    renderStats(); commit(before); say(`Named it “${name}”.`);
  }

  function toggleSprint() {
    const button = $('sprint-toggle');
    if (sprintTimer) {
      clearInterval(sprintTimer); sprintTimer = null; sprintSeconds = 0;
      if (button) button.textContent = '3-minute sprint';
      return say('Design sprint stopped.');
    }
    sprintSeconds = 180;
    if (button) button.textContent = '3:00 remaining';
    say('Sprint started. Make the first move; refine later.');
    sprintTimer = setInterval(() => {
      sprintSeconds -= 1;
      const min = Math.floor(sprintSeconds / 60), sec = String(sprintSeconds % 60).padStart(2, '0');
      if (button) button.textContent = `${min}:${sec} remaining`;
      if (sprintSeconds <= 0) {
        clearInterval(sprintTimer); sprintTimer = null;
        if (button) button.textContent = 'Sprint finished ✓';
        say('Time. Stop designing and look at what you made.');
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) button?.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 600 });
      }
    }, 1000);
  }

  function updateGridPattern() {
    const size = gridSize();
    const pattern = $('grid-pattern');
    const path = pattern?.querySelector('path');
    if (pattern) { pattern.setAttribute('width', size); pattern.setAttribute('height', size); }
    if (path) path.setAttribute('d', `M${size} 0H0V${size}`);
  }

  function renderScene() {
    const background = $('canvas-background');
    const fills = { grid: 'url(#grid-pattern)', paper: '#FFFFFF', blueprint: 'url(#blueprint-pattern)', river: '#DAE9EF', lawn: '#E7EEE1', sunset: 'url(#sunset-gradient)', night: 'url(#night-gradient)' };
    if (background) background.setAttribute('fill', fills[state.background] || fills.grid);
    updateGridPattern();
    sceneLayer.innerHTML = '';
    const add = (tag, attrs) => sceneLayer.appendChild(svgElement(tag, attrs));
    if (state.background === 'river') {
      add('rect', { x: 0, y: 355, width: 800, height: 165, fill: '#79AFC7' });
      add('path', { d: 'M0 385 Q90 365 180 387 T360 385 T540 389 T800 380 V520 H0Z', fill: '#6A9FB8', opacity: .75 });
      add('rect', { x: 0, y: 332, width: 800, height: 25, fill: '#D2CAB4' });
      add('circle', { cx: 690, cy: 86, r: 38, fill: '#F4C766', opacity: .75 });
    } else if (state.background === 'lawn') {
      add('rect', { x: 0, y: 350, width: 800, height: 170, fill: '#9DBC84' });
      add('path', { d: 'M0 430 L320 352 L510 352 L800 462 L800 520 L0 520Z', fill: '#D7D0BE', opacity: .82 });
      add('circle', { cx: 710, cy: 86, r: 36, fill: '#F7D884', opacity: .72 });
    } else if (state.background === 'sunset') {
      add('circle', { cx: 664, cy: 116, r: 48, fill: '#F6B65D', opacity: .68 });
      add('rect', { x: 0, y: 410, width: 800, height: 110, fill: '#A2B29D', opacity: .55 });
    } else if (state.background === 'night') {
      [[68,62],[142,108],[242,56],[350,94],[458,50],[572,112],[686,68],[748,146],[112,180],[616,192]].forEach(([cx, cy], i) => add('circle', { cx, cy, r: i % 3 ? 1.3 : 2.1, fill: '#fff', opacity: .78 }));
      add('circle', { cx: 690, cy: 92, r: 34, fill: '#F4F0C7', opacity: .82 });
      add('rect', { x: 0, y: 430, width: 800, height: 90, fill: '#0B2231', opacity: .8 });
    }
  }

  function svgElement(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
    return el;
  }

  function materialAttrs(shape) {
    if (shape.material === 'outline') return { fill: 'none', stroke: shape.fill, 'stroke-width': 4, opacity: shape.opacity / 100 };
    if (shape.material === 'glass') return { fill: shape.fill, stroke: '#fff', 'stroke-width': 2, opacity: Math.min(shape.opacity / 100, .64) };
    if (shape.material === 'translucent') return { fill: shape.fill, stroke: shape.fill, 'stroke-width': 2, opacity: Math.min(shape.opacity / 100, .45) };
    return { fill: shape.fill, stroke: 'rgba(16,36,58,.28)', 'stroke-width': 1.5, opacity: shape.opacity / 100 };
  }

  function shapeElement(shape, preview = false) {
    const group = svgElement('g');
    const cx = shape.x + shape.w / 2, cy = shape.y + shape.h / 2;
    if (shape.rotation) group.setAttribute('transform', `rotate(${shape.rotation} ${cx} ${cy})`);
    const main = { ...materialAttrs(shape), 'data-main': 'true' };

    if (shape.type === 'circle') group.appendChild(svgElement('ellipse', { cx, cy, rx: shape.w / 2, ry: shape.h / 2, ...main }));
    else if (shape.type === 'triangle') group.appendChild(svgElement('polygon', { points: `${cx},${shape.y} ${shape.x + shape.w},${shape.y + shape.h} ${shape.x},${shape.y + shape.h}`, ...main }));
    else if (shape.type === 'arch') {
      const r = Math.min(shape.w / 2, shape.h * .42);
      group.appendChild(svgElement('path', { d: `M${shape.x},${shape.y + shape.h} V${shape.y + r} A${r},${r} 0 0 1 ${shape.x + shape.w},${shape.y + r} V${shape.y + shape.h} Z`, ...main }));
    } else if (shape.type === 'window') {
      const lit = state.lights && shape.variant === 'lit';
      const attrs = { ...main };
      if (lit && shape.material !== 'outline') { attrs.fill = '#FFD86A'; attrs.opacity = Math.max(.78, shape.opacity / 100); }
      group.appendChild(svgElement('rect', { x: shape.x, y: shape.y, width: shape.w, height: shape.h, rx: Math.min(5, shape.w * .08), ...attrs }));
      const lineColor = lit ? '#9B7824' : '#fff';
      group.appendChild(svgElement('line', { x1: cx, y1: shape.y + 4, x2: cx, y2: shape.y + shape.h - 4, stroke: lineColor, 'stroke-width': 2, opacity: .75 }));
      group.appendChild(svgElement('line', { x1: shape.x + 4, y1: cy, x2: shape.x + shape.w - 4, y2: cy, stroke: lineColor, 'stroke-width': 2, opacity: .75 }));
    } else if (shape.type === 'door') {
      const open = shape.variant === 'open';
      const doorWidth = open ? Math.max(10, shape.w * .36) : shape.w;
      group.appendChild(svgElement('rect', { x: shape.x, y: shape.y, width: doorWidth, height: shape.h, rx: 2, ...main }));
      if (!open) group.appendChild(svgElement('circle', { cx: shape.x + shape.w * .78, cy: shape.y + shape.h * .54, r: Math.max(2, Math.min(4, shape.w * .06)), fill: '#F2E5B5' }));
      else group.appendChild(svgElement('path', { d: `M${shape.x + doorWidth} ${shape.y} L${shape.x + shape.w} ${shape.y + 18} V${shape.y + shape.h - 10} L${shape.x + doorWidth} ${shape.y + shape.h}Z`, fill: '#0A1420', opacity: .42 }));
    } else if (shape.type === 'column') {
      const shaftX = shape.x + shape.w * .22, shaftW = shape.w * .56;
      group.appendChild(svgElement('rect', { x: shaftX, y: shape.y + shape.h * .08, width: shaftW, height: shape.h * .84, ...main }));
      group.appendChild(svgElement('rect', { x: shape.x, y: shape.y, width: shape.w, height: Math.max(5, shape.h * .09), ...materialAttrs(shape) }));
      group.appendChild(svgElement('rect', { x: shape.x, y: shape.y + shape.h * .91, width: shape.w, height: Math.max(5, shape.h * .09), ...materialAttrs(shape) }));
    } else if (shape.type === 'tree') {
      const canopy = shape.variant === 'alt1' ? '#779B5A' : shape.variant === 'alt2' ? '#3E6C55' : shape.fill;
      const trunkW = Math.max(7, shape.w * .16);
      group.appendChild(svgElement('rect', { x: cx - trunkW / 2, y: shape.y + shape.h * .56, width: trunkW, height: shape.h * .44, fill: '#7A5237', opacity: shape.opacity / 100 }));
      group.appendChild(svgElement('ellipse', { cx, cy: shape.y + shape.h * .34, rx: shape.w * .46, ry: shape.h * .34, fill: canopy, stroke: 'rgba(16,36,58,.2)', 'stroke-width': 1.2, opacity: shape.opacity / 100, 'data-main': 'true' }));
    } else group.appendChild(svgElement('rect', { x: shape.x, y: shape.y, width: shape.w, height: shape.h, rx: 1, ...main }));

    if (!preview) {
      group.classList.add('design-shape');
      if (shape.id === selectedId) group.classList.add('is-selected');
      if (shape.locked) group.classList.add('is-locked');
      group.dataset.shapeId = shape.id;
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', `${TYPE_LABELS[shape.type]}${shape.locked ? ', locked' : ''}`);
    }
    return group;
  }

  function renderSelection() {
    selectionLayer.innerHTML = '';
    const shape = selectedShape();
    if (!shape) return;
    const cx = shape.x + shape.w / 2, cy = shape.y + shape.h / 2;
    const transform = shape.rotation ? `rotate(${shape.rotation} ${cx} ${cy})` : '';
    const box = svgElement('rect', { x: shape.x - 5, y: shape.y - 5, width: shape.w + 10, height: shape.h + 10, rx: 4 });
    box.classList.add('selection-box'); if (transform) box.setAttribute('transform', transform); selectionLayer.appendChild(box);
    const line = svgElement('line', { x1: cx, y1: shape.y - 6, x2: cx, y2: shape.y - 32 });
    line.classList.add('rotation-line'); if (transform) line.setAttribute('transform', transform); selectionLayer.appendChild(line);
    const rotate = svgElement('circle', { cx, cy: shape.y - 38, r: 8, 'data-handle': 'rotate' });
    rotate.classList.add('rotation-handle'); if (shape.locked) rotate.classList.add('is-disabled'); if (transform) rotate.setAttribute('transform', transform); selectionLayer.appendChild(rotate);
    const resize = svgElement('rect', { x: shape.x + shape.w - 7, y: shape.y + shape.h - 7, width: 14, height: 14, rx: 2, 'data-handle': 'resize' });
    resize.classList.add('selection-handle'); if (shape.locked) resize.classList.add('is-disabled'); if (transform) resize.setAttribute('transform', transform); selectionLayer.appendChild(resize);
  }

  function renderLayers() {
    if (!layersTarget) return;
    if (!state.shapes.length) { layersTarget.innerHTML = '<span class="muted small-text">No parts yet.</span>'; return; }
    layersTarget.innerHTML = state.shapes.map((shape, index) => `<button type="button" class="layer-chip${shape.id === selectedId ? ' is-selected' : ''}${shape.locked ? ' is-locked' : ''}" data-layer-id="${escapeHTML(shape.id)}">${index + 1}. ${escapeHTML(TYPE_LABELS[shape.type])}</button>`).join('');
    layersTarget.querySelectorAll('[data-layer-id]').forEach(button => button.addEventListener('click', () => {
      selectedId = button.dataset.layerId || ''; render(); svg.focus({ preventScroll: true }); say(`${TYPE_LABELS[selectedShape()?.type] || 'Part'} selected.`);
    }));
  }

  function vibe() {
    const total = state.shapes.length;
    const glass = state.shapes.filter(s => ['glass', 'translucent'].includes(s.material)).length;
    const trees = countType(state, 'tree');
    const rotated = state.shapes.filter(s => Math.abs(s.rotation) >= 12).length;
    if (state.background === 'night' && state.shapes.some(s => s.type === 'window' && s.variant === 'lit')) return 'After Dark';
    if (trees >= 3) return 'Biophilic';
    if (glass >= Math.max(3, total * .35)) return 'Glass Box';
    if (rotated >= 3) return 'Deconstruct';
    if (total <= 5) return 'Minimal';
    if (total >= 24) return 'Maximal';
    if (countType(state, 'column') >= 4) return 'Civic';
    return 'Balanced';
  }

  function earnedBadges() {
    const result = [];
    if (state.shapes.length && state.shapes.length <= 5) result.push('Less is more');
    if (state.shapes.length >= 20) result.push('Maximalist');
    if (countType(state, 'window') >= 6) result.push('Window wall');
    if (countType(state, 'tree') >= 4) result.push('Landscape architect?');
    if (countType(state, 'column') >= 5) result.push('Colonnade mode');
    if (state.shapes.filter(s => s.material === 'glass').length >= 4) result.push('Glass enthusiast');
    if (distinctColors(state).length >= 5) result.push('Color theorist');
    if (state.shapes.filter(s => Math.abs(s.rotation) >= 20).length >= 3) result.push('Gravity optional');
    if (state.background === 'night' && state.shapes.filter(s => s.type === 'window' && s.variant === 'lit').length >= 3) result.push('Night owl');
    if (CHALLENGES[currentChallenge]?.test(state)) result.push('Challenge cleared ✓');
    return result.slice(0, 6);
  }

  function renderStats() {
    if (statParts) statParts.textContent = state.shapes.length;
    if (statColors) statColors.textContent = distinctColors(state).length;
    if (statVibe) statVibe.textContent = vibe();
    if (badgesTarget) {
      const earned = earnedBadges();
      badgesTarget.innerHTML = earned.length ? earned.map(label => `<span class="designer-badge${label.includes('✓') ? ' special' : ''}">${escapeHTML(label)}</span>`).join('') : '<span class="muted small-text">Keep building to unlock badges.</span>';
    }
    const complete = Boolean(CHALLENGES[currentChallenge]?.test(state));
    if (complete && !challengeWasComplete) {
      say('Challenge complete. Nice. Try another constraint or keep pushing it.');
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) challengePrompt?.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.025)' }, { transform: 'scale(1)' }], { duration: 480 });
    }
    challengeWasComplete = complete;
  }

  function syncSelectedControls() {
    const shape = selectedShape();
    const inputs = [colorInput, materialInput, widthInput, heightInput, rotationInput, opacityInput, controls.back, controls.front, controls.duplicate, controls.lock, controls.interact, controls.repeat, controls.ground, controls.delete];
    inputs.forEach(input => { if (input) input.disabled = !shape; });
    if (!shape) {
      if (selectedLabel) { selectedLabel.textContent = 'None'; selectedLabel.classList.remove('is-locked'); }
      [widthValue, heightValue, rotationValue, opacityValue].forEach(el => { if (el) el.textContent = '—'; });
      return;
    }
    if (selectedLabel) { selectedLabel.textContent = `${TYPE_LABELS[shape.type]}${shape.locked ? ' · Locked' : ''}`; selectedLabel.classList.toggle('is-locked', shape.locked); }
    if (colorInput) colorInput.value = shape.fill;
    if (materialInput) materialInput.value = shape.material;
    if (widthInput) widthInput.value = Math.round(shape.w);
    if (heightInput) heightInput.value = Math.round(shape.h);
    if (rotationInput) rotationInput.value = Math.round(shape.rotation);
    if (opacityInput) opacityInput.value = Math.round(shape.opacity);
    if (widthValue) widthValue.textContent = `${Math.round(shape.w)}px`;
    if (heightValue) heightValue.textContent = `${Math.round(shape.h)}px`;
    if (rotationValue) rotationValue.textContent = `${Math.round(shape.rotation)}°`;
    if (opacityValue) opacityValue.textContent = `${Math.round(shape.opacity)}%`;
    if (controls.lock) controls.lock.textContent = shape.locked ? 'Unlock' : 'Lock';
    if (controls.interact) {
      const interactive = ['window', 'door', 'tree'].includes(shape.type);
      controls.interact.disabled = !interactive || shape.locked;
      controls.interact.textContent = shape.type === 'window' ? (shape.variant === 'lit' ? 'Lights off' : 'Lights on') : shape.type === 'door' ? (shape.variant === 'open' ? 'Close door' : 'Open door') : shape.type === 'tree' ? 'Change tree' : 'Interact';
    }
    [colorInput, materialInput, widthInput, heightInput, rotationInput, opacityInput, controls.back, controls.front, controls.interact, controls.ground, controls.delete].forEach(input => { if (input && shape.locked) input.disabled = true; });
  }

  function render() {
    syncStateFromInputs(); renderScene(); shapesLayer.innerHTML = '';
    state.shapes.forEach(shape => shapesLayer.appendChild(shapeElement(shape)));
    renderSelection(); syncSelectedControls(); renderLayers(); renderStats();
  }

  function updateSelected(patch) {
    const shape = selectedShape(); if (!shape || shape.locked) return;
    Object.assign(shape, patch);
    shape.w = clamp(shape.w, 18, 600); shape.h = clamp(shape.h, 18, 460);
    shape.x = clamp(shape.x, 0, WIDTH - shape.w); shape.y = clamp(shape.y, 0, HEIGHT - shape.h);
    shape.rotation = clamp(shape.rotation, -180, 180); shape.opacity = clamp(shape.opacity, 20, 100);
    if (!validHex(shape.fill)) shape.fill = '#00498F';
    if (!MATERIALS.has(shape.material)) shape.material = 'solid';
    render();
  }

  function addShape(type) {
    if (!TYPES.has(type) || state.shapes.length >= MAX_SHAPES) return say(state.shapes.length >= MAX_SHAPES ? `Maximum ${MAX_SHAPES} parts reached.` : 'That part is unavailable.');
    const before = snapshot(), defaults = DEFAULTS[type], index = state.shapes.length;
    const shape = sanitizeShape({ id: uid(), type, x: 310 + (index % 6) * 9, y: 185 + (index % 5) * 9, ...defaults, opacity: 100, variant: type === 'window' && state.background === 'night' ? 'lit' : 'default' });
    state.shapes.push(shape); selectedId = shape.id; render(); commit(before); say(`${TYPE_LABELS[type]} added. Drag it into place.`);
  }

  function moveLayer(direction) {
    const shape = selectedShape(); if (!shape || shape.locked) return;
    const before = snapshot(), index = state.shapes.findIndex(item => item.id === selectedId), [removed] = state.shapes.splice(index, 1);
    direction === 'front' ? state.shapes.push(removed) : state.shapes.unshift(removed); render(); commit(before);
  }

  function duplicateSelected() {
    const source = selectedShape(); if (!source || state.shapes.length >= MAX_SHAPES) return;
    const before = snapshot(), duplicate = sanitizeShape({ ...source, id: uid(), x: source.x + gridSize(), y: source.y + gridSize(), locked: false });
    state.shapes.push(duplicate); selectedId = duplicate.id; render(); commit(before); say('Part duplicated.');
  }

  function repeatSelected() {
    const source = selectedShape(); if (!source) return;
    const before = snapshot(); let last = source;
    for (let i = 0; i < 3 && state.shapes.length < MAX_SHAPES; i += 1) {
      const copy = sanitizeShape({ ...source, id: uid(), x: source.x + gridSize() * (i + 1), y: source.y + gridSize() * (i + 1), locked: false });
      state.shapes.push(copy); last = copy;
    }
    selectedId = last.id; render(); commit(before); say('Repeated the part three times.');
  }

  function groundSelected() {
    const shape = selectedShape(); if (!shape || shape.locked) return;
    const before = snapshot(); shape.y = HEIGHT - shape.h; render(); commit(before); say('Part grounded to the bottom edge.');
  }

  function toggleLock() {
    const shape = selectedShape(); if (!shape) return;
    const before = snapshot(); shape.locked = !shape.locked; render(); commit(before); say(shape.locked ? 'Part locked.' : 'Part unlocked.');
  }

  function deleteSelected() {
    const shape = selectedShape(); if (!shape || shape.locked) return shape?.locked && say('Unlock this part before deleting it.');
    const before = snapshot(); state.shapes = state.shapes.filter(item => item.id !== selectedId); selectedId = ''; render(); commit(before); say('Part deleted.');
  }

  function interactSelected() {
    const shape = selectedShape(); if (!shape || shape.locked) return;
    const before = snapshot();
    if (shape.type === 'window') { shape.variant = shape.variant === 'lit' ? 'default' : 'lit'; say(shape.variant === 'lit' ? 'Window lights on.' : 'Window lights off.'); }
    else if (shape.type === 'door') { shape.variant = shape.variant === 'open' ? 'default' : 'open'; say(shape.variant === 'open' ? 'Door opened.' : 'Door closed.'); }
    else if (shape.type === 'tree') { shape.variant = shape.variant === 'default' ? 'alt1' : shape.variant === 'alt1' ? 'alt2' : 'default'; say('Tree canopy changed.'); }
    else return;
    render(); commit(before);
  }

  function applyPalette(name) {
    const palette = PALETTES[name]; if (!palette || !state.shapes.length) return;
    const before = snapshot(); let index = 0;
    state.shapes.forEach(shape => { if (shape.type !== 'tree' && !(shape.type === 'window' && shape.variant === 'lit')) shape.fill = palette[index++ % palette.length]; });
    render(); commit(before); say(`${name[0].toUpperCase() + name.slice(1)} palette applied.`);
  }

  function makeShape(type, x, y, w, h, fill, extra = {}) { return sanitizeShape({ id: uid(), type, x, y, w, h, fill, ...extra }); }

  function template(name) {
    if (name === 'tower') return [makeShape('rect',300,115,200,330,'#193059'), ...Array.from({length:12},(_,i)=>makeShape('window',330+(i%3)*56,150+Math.floor(i/3)*62,34,38,'#9ED8F0',{material:'glass'})), makeShape('rect',270,430,260,28,'#9C9EA1')];
    if (name === 'pavilion') return [makeShape('rect',120,355,560,30,'#193059'),makeShape('rect',150,185,500,28,'#00498F'),makeShape('column',190,215,34,140,'#9C9EA1'),makeShape('column',335,215,34,140,'#9C9EA1'),makeShape('column',485,215,34,140,'#9C9EA1'),makeShape('column',620,215,34,140,'#9C9EA1'),makeShape('tree',48,270,84,120,'#55785A'),makeShape('tree',675,275,84,120,'#55785A')];
    if (name === 'courtyard') return [makeShape('rect',90,250,230,170,'#00498F'),makeShape('rect',480,225,230,195,'#193059'),makeShape('rect',265,160,270,90,'#9C9EA1'),makeShape('window',135,290,56,56,'#9ED8F0',{material:'glass'}),makeShape('window',220,290,56,56,'#9ED8F0',{material:'glass'}),makeShape('window',525,275,56,56,'#9ED8F0',{material:'glass'}),makeShape('window',610,275,56,56,'#9ED8F0',{material:'glass'}),makeShape('tree',335,292,74,110,'#55785A'),makeShape('tree',407,292,74,110,'#55785A')];
    return [makeShape('rect',225,255,350,190,'#E2E4E6'),makeShape('triangle',190,120,420,140,'#00498F'),makeShape('door',365,330,72,115,'#193059'),makeShape('window',275,300,58,58,'#9ED8F0',{material:'glass'}),makeShape('window',470,300,58,58,'#9ED8F0',{material:'glass'}),makeShape('tree',100,285,90,135,'#55785A')];
  }

  function loadTemplate(name) {
    const before = snapshot(); state.shapes = template(name).filter(Boolean).slice(0, MAX_SHAPES); selectedId = '';
    if (name === 'pavilion' || name === 'courtyard') state.background = 'lawn'; syncInputsFromState(); render(); commit(before); say(`${name[0].toUpperCase() + name.slice(1)} quick start loaded.`);
  }

  function surpriseBuilding() {
    const before = snapshot(), paletteName = randomItem(Object.keys(PALETTES)), palette = PALETTES[paletteName], shapes = [];
    const masses = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < masses; i += 1) {
      const w = 120 + Math.random() * 220, h = 70 + Math.random() * 190;
      shapes.push(sanitizeShape({ id:uid(), type:'rect', x:80+Math.random()*(640-w), y:170+Math.random()*(280-h/2), w,h, fill:palette[i%palette.length], rotation:Math.random()>.76?Math.round(Math.random()*36-18):0 }));
    }
    if (Math.random() > .35) shapes.push(sanitizeShape({ id:uid(), type:Math.random()>.5?'triangle':'arch', x:180+Math.random()*260, y:80+Math.random()*130, w:180+Math.random()*240, h:70+Math.random()*100, fill:randomItem(palette) }));
    for (let i=0;i<2+Math.floor(Math.random()*7);i+=1) shapes.push(sanitizeShape({ id:uid(),type:'window',x:130+Math.random()*530,y:215+Math.random()*150,w:34+Math.random()*45,h:34+Math.random()*50,fill:'#9ED8F0',material:'glass',variant:Math.random()>.7?'lit':'default'}));
    if (Math.random()>.35) shapes.push(sanitizeShape({id:uid(),type:'door',x:330+Math.random()*150,y:325,w:58,h:118,fill:randomItem(palette)}));
    if (Math.random()>.45) shapes.push(sanitizeShape({id:uid(),type:'tree',x:40+Math.random()*670,y:300,w:76,h:122,fill:'#55785A',variant:randomItem(['default','alt1','alt2'])}));
    state.shapes=shapes.filter(Boolean).slice(0,MAX_SHAPES);state.background=randomItem(['grid','paper','river','lawn','sunset','night']);selectedId='';syncInputsFromState();render();commit(before);say(`Surprise building generated with the ${paletteName} palette.`);
  }

  function newChallenge() {
    let next = currentChallenge;
    while (CHALLENGES.length > 1 && next === currentChallenge) next = Math.floor(Math.random() * CHALLENGES.length);
    currentChallenge = next; challengeWasComplete = false;
    if (challengePrompt) challengePrompt.textContent = CHALLENGES[currentChallenge].text;
    renderStats(); say('New design challenge loaded.');
  }

  function setInitialChallenge() {
    const options = CHALLENGES.map((challenge, index) => ({ challenge, index })).filter(item => !item.challenge.test(state));
    currentChallenge = options.length ? randomItem(options).index : 0;
    if (challengePrompt) challengePrompt.textContent = CHALLENGES[currentChallenge].text;
    challengeWasComplete = false; renderStats();
  }

  function svgPoint(event) {
    const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const matrix = svg.getScreenCTM(); return matrix ? point.matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
  }

  function inverseRotatedPoint(point, shape) {
    const cx = shape.x + shape.w / 2, cy = shape.y + shape.h / 2, radians = -shape.rotation * Math.PI / 180;
    const dx = point.x - cx, dy = point.y - cy;
    return { x: cx + dx * Math.cos(radians) - dy * Math.sin(radians), y: cy + dx * Math.sin(radians) + dy * Math.cos(radians) };
  }

  function pointerAngle(point, shape) {
    const cx = shape.x + shape.w / 2, cy = shape.y + shape.h / 2;
    return Math.atan2(point.y - cy, point.x - cx) * 180 / Math.PI + 90;
  }

  function encodeState(input) {
    const json = JSON.stringify(sanitizeState(input)), bytes = new TextEncoder().encode(json); let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/g,'');
  }

  function decodeState(code='') {
    try {
      const text=String(code).trim(); if(!text||text.length>MAX_CODE_LENGTH||!/^[A-Za-z0-9_-]+$/.test(text))return null;
      const normalized=text.replaceAll('-','+').replaceAll('_','/'), padded=normalized+'='.repeat((4-normalized.length%4)%4), binary=atob(padded), bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
      return sanitizeState(JSON.parse(new TextDecoder().decode(bytes)));
    } catch { return null; }
  }

  function currentCode(){syncStateFromInputs();return encodeState(state)}
  function shareUrl(code){const url=new URL('designer.html',location.href);url.hash=`design=${code}`;return url.href}
  async function copyText(text){try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true}}catch{}const temp=document.createElement('textarea');temp.value=text;temp.readOnly=true;temp.style.cssText='position:absolute;left:-9999px';document.body.appendChild(temp);temp.select();const ok=document.execCommand('copy');temp.remove();return ok}

  function updateSubmission(code,url){if(!submitDesign||!submissionNote)return;if(!contactEmail){submitDesign.hidden=true;submissionNote.hidden=false;return}const building=state.title||'Untitled building',designer=state.designer||'Anonymous designer',subject=`Design Studio showcase submission: ${building}`,body=`Building: ${building}\nDesigner: ${designer}\n\nShare link:\n${url}\n\nDesign code:\n${code}\n\nPlease review this design before adding it to the public Community Showcase.`;submitDesign.href=`mailto:${encodeURIComponent(contactEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;submitDesign.hidden=false;submissionNote.hidden=true}
  function createShare(){const code=currentCode(),url=shareUrl(code);if(shareUrlInput)shareUrlInput.value=url;if(designCodeInput)designCodeInput.value=code;if(sharePanel)sharePanel.hidden=false;updateSubmission(code,url);say('Share link created. Send it to someone and challenge them to remix it.');sharePanel?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'})}
  function saveDraft(){syncStateFromInputs();try{localStorage.setItem(STORAGE_KEY,JSON.stringify(sanitizeState(state)));say('Draft saved on this device.')}catch{say('This browser could not save the draft locally.')}}
  function loadDraft(){try{const raw=localStorage.getItem(STORAGE_KEY)||localStorage.getItem(LEGACY_STORAGE_KEY);if(!raw)return say('No saved draft was found on this device.');loadState(JSON.parse(raw),'Saved draft loaded.',true)}catch{say('The saved draft could not be loaded.')}}
  function loadState(next,message='',reset=true){state=sanitizeState(next);selectedId='';syncInputsFromState();render();if(reset)resetHistory();if(message)say(message)}
  function clearDesign(){if(state.shapes.length&&!confirm('Clear every part from this design?'))return;const before=snapshot();state.shapes=[];selectedId='';render();commit(before);say('Canvas cleared.')}

  function downloadPng(){syncStateFromInputs();const clone=svg.cloneNode(true);clone.querySelector('#selection-layer')?.remove();clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width',WIDTH);clone.setAttribute('height',HEIGHT);clone.querySelectorAll('.design-shape').forEach(node=>node.removeAttribute('class'));const blob=new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'}),source=URL.createObjectURL(blob),image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1040;const ctx=canvas.getContext('2d');if(!ctx){URL.revokeObjectURL(source);return say('PNG export is unavailable in this browser.')}ctx.drawImage(image,0,0,1600,1040);URL.revokeObjectURL(source);const link=document.createElement('a'),safe=(state.title||'aias-building').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'aias-building';link.download=`${safe}.png`;link.href=canvas.toDataURL('image/png');link.click();say('PNG exported.')};image.onerror=()=>{URL.revokeObjectURL(source);say('PNG export failed in this browser.')};image.src=source}

  function previewBackground(name){return{grid:'#F4F7F9',paper:'#fff',blueprint:'#185B88',river:'#DAE9EF',lawn:'#E7EEE1',sunset:'#E8D1BD',night:'#122B49'}[name]||'#F4F7F9'}
  function previewSvg(input,index){const design=sanitizeState(input),lines=design.background==='grid'?'<path d="M0 104H800M0 208H800M0 312H800M0 416H800M160 0V520M320 0V520M480 0V520M640 0V520" stroke="#cdd8e0" stroke-width="2" opacity=".5"/>':'',parts=design.shapes.map(shape=>{const cx=shape.x+shape.w/2,cy=shape.y+shape.h/2,transform=shape.rotation?` transform="rotate(${shape.rotation} ${cx} ${cy})"`:'',op=Math.min(1,shape.opacity/100);if(shape.type==='circle')return`<ellipse cx="${cx}" cy="${cy}" rx="${shape.w/2}" ry="${shape.h/2}" fill="${escapeHTML(shape.fill)}" opacity="${op}"${transform}/>`;if(shape.type==='triangle')return`<polygon points="${cx},${shape.y} ${shape.x+shape.w},${shape.y+shape.h} ${shape.x},${shape.y+shape.h}" fill="${escapeHTML(shape.fill)}" opacity="${op}"${transform}/>`;if(shape.type==='tree')return`<g${transform}><rect x="${cx-shape.w*.08}" y="${shape.y+shape.h*.56}" width="${shape.w*.16}" height="${shape.h*.44}" fill="#7A5237"/><ellipse cx="${cx}" cy="${shape.y+shape.h*.34}" rx="${shape.w*.46}" ry="${shape.h*.34}" fill="${escapeHTML(shape.fill)}"/></g>`;if(shape.type==='window')return`<rect x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}" fill="${shape.variant==='lit'&&design.lights?'#FFD86A':escapeHTML(shape.fill)}" opacity="${op}"${transform}/>`;if(shape.type==='arch'){const r=Math.min(shape.w/2,shape.h*.42);return`<path d="M${shape.x},${shape.y+shape.h} V${shape.y+r} A${r},${r} 0 0 1 ${shape.x+shape.w},${shape.y+r} V${shape.y+shape.h} Z" fill="${escapeHTML(shape.fill)}" opacity="${op}"${transform}/>`}return`<rect x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}" fill="${escapeHTML(shape.fill)}" opacity="${op}"${transform}/>`}).join('');return`<svg viewBox="0 0 800 520" role="img" aria-label="Preview of ${escapeHTML(design.title||`community design ${index+1}`)}"><rect width="800" height="520" fill="${previewBackground(design.background)}"/>${lines}${parts}</svg>`}

  function loadFavorites(){try{const values=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]');return new Set(Array.isArray(values)?values.filter(x=>typeof x==='string').slice(0,200):[])}catch{return new Set()}}
  function saveFavorites(){try{localStorage.setItem(FAVORITES_KEY,JSON.stringify([...favorites]))}catch{}}
  function renderShowcase(){if(!showcaseTarget)return;const filtered=showcaseEntries.filter(entry=>showcaseFilter==='featured'?entry.featured:showcaseFilter==='favorites'?favorites.has(entry.design_code):true);if(!filtered.length){showcaseTarget.innerHTML=`<div class="empty-state">${showcaseFilter==='favorites'?'No favorites yet. Tap ☆ Favorite on a design you want to keep.':'No community designs match this filter.'}</div>`;return}showcaseTarget.innerHTML=filtered.map((entry,index)=>{const building=entry.title||entry.design.title||'Untitled building',designer=entry.designer||entry.design.designer||'Anonymous designer',href=`designer.html#design=${encodeURIComponent(entry.design_code)}`,favorite=favorites.has(entry.design_code);return`<article class="design-gallery-card"><div class="design-gallery-preview">${previewSvg(entry.design,index)}</div><div class="design-gallery-body">${entry.featured?'<span class="design-gallery-badge">Featured design</span>':''}<h3>${escapeHTML(building)}</h3><p class="design-gallery-author">by ${escapeHTML(designer)}</p><div class="design-gallery-actions"><a class="button button-outline" href="${escapeHTML(href)}">View / remix →</a><button type="button" class="favorite-button${favorite?' is-favorite':''}" data-favorite-code="${escapeHTML(entry.design_code)}" aria-pressed="${favorite}">${favorite?'★ Saved':'☆ Favorite'}</button></div></div></article>`}).join('');showcaseTarget.querySelectorAll('[data-favorite-code]').forEach(button=>button.addEventListener('click',()=>{const code=button.dataset.favoriteCode||'';favorites.has(code)?favorites.delete(code):favorites.add(code);saveFavorites();renderShowcase()}))}
  async function loadShowcase(){if(!showcaseTarget)return;try{const response=await fetch('data/designs.json',{cache:'no-store'});if(!response.ok)throw new Error('showcase');const raw=await response.json();showcaseEntries=(Array.isArray(raw)?raw:[]).filter(entry=>entry&&entry.published!==false&&entry.design_code).map(entry=>({...entry,design:decodeState(entry.design_code)})).filter(entry=>entry.design).sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured)));renderShowcase()}catch{showcaseTarget.innerHTML='<div class="empty-state">Community designs could not be loaded.</div>'}}
  async function loadContactEmail(){try{const response=await fetch('data/site.json',{cache:'no-store'});if(!response.ok)return;const site=await response.json(),email=String(site?.contact_email||'').trim();if(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)&&!/example\./i.test(email))contactEmail=email}catch{}}

  installExtraControls();
  document.querySelectorAll('[data-add-shape]').forEach(button=>button.addEventListener('click',()=>addShape(button.dataset.addShape)));
  document.querySelectorAll('[data-template]').forEach(button=>button.addEventListener('click',()=>loadTemplate(button.dataset.template)));
  document.querySelectorAll('[data-palette]').forEach(button=>button.addEventListener('click',()=>applyPalette(button.dataset.palette)));
  document.querySelectorAll('[data-showcase-filter]').forEach(button=>button.addEventListener('click',()=>{showcaseFilter=button.dataset.showcaseFilter||'all';document.querySelectorAll('[data-showcase-filter]').forEach(item=>item.classList.toggle('is-active',item===button));renderShowcase()}));

  backgroundInput?.addEventListener('change',()=>{const before=snapshot();state.background=BACKGROUNDS.has(backgroundInput.value)?backgroundInput.value:'grid';render();commit(before)});
  snapToggle?.addEventListener('change',()=>{state.snap=snapToggle.checked;render();say(state.snap?`Snap enabled at ${state.grid}px.`:'Free movement enabled.')});
  gridInput?.addEventListener('change',()=>{state.grid=gridSize();render();say(`Grid snap set to ${state.grid}px.`)});
  lightsToggle?.addEventListener('change',()=>{const before=snapshot();state.lights=lightsToggle.checked;render();commit(before);say(state.lights?'Window lights enabled.':'Window lights disabled.')});

  colorInput?.addEventListener('focus',()=>controlStart=snapshot());
  colorInput?.addEventListener('change',()=>{const before=controlStart||snapshot();updateSelected({fill:colorInput.value});commit(before);controlStart=''});
  materialInput?.addEventListener('change',()=>{const before=snapshot();updateSelected({material:materialInput.value});commit(before)});
  [widthInput,heightInput,rotationInput,opacityInput].forEach(input=>{
    input?.addEventListener('pointerdown',()=>{controlStart=snapshot()});
    input?.addEventListener('focus',()=>{if(!controlStart)controlStart=snapshot()});
    input?.addEventListener('input',()=>updateSelected(input===widthInput?{w:Number(input.value)}:input===heightInput?{h:Number(input.value)}:input===rotationInput?{rotation:Number(input.value)}:{opacity:Number(input.value)}));
    const finish=()=>{if(controlStart){commit(controlStart);controlStart=''}};
    input?.addEventListener('change',finish);input?.addEventListener('blur',finish);
  });

  controls.back?.addEventListener('click',()=>moveLayer('back'));controls.front?.addEventListener('click',()=>moveLayer('front'));controls.duplicate?.addEventListener('click',duplicateSelected);controls.lock?.addEventListener('click',toggleLock);controls.delete?.addEventListener('click',deleteSelected);
  undoButton?.addEventListener('click',undo);redoButton?.addEventListener('click',redo);$('new-challenge')?.addEventListener('click',newChallenge);$('surprise-building')?.addEventListener('click',surpriseBuilding);

  svg.addEventListener('pointerdown',event=>{
    const handle=event.target.closest?.('[data-handle]'),target=event.target.closest?.('[data-shape-id]'),point=svgPoint(event);
    if(handle){const shape=selectedShape();if(!shape||shape.locked)return;pointerAction={mode:handle.dataset.handle,pointerId:event.pointerId,before:snapshot(),startShape:{...shape},startAngle:pointerAngle(point,shape)};try{svg.setPointerCapture(event.pointerId)}catch{}event.preventDefault();return}
    if(!target){selectedId='';render();return}
    const shape=state.shapes.find(item=>item.id===target.dataset.shapeId);if(!shape)return;selectedId=shape.id;render();if(shape.locked){say(`${TYPE_LABELS[shape.type]} is locked. Unlock it to move it.`);return}
    pointerAction={mode:'move',pointerId:event.pointerId,before:snapshot(),offsetX:point.x-shape.x,offsetY:point.y-shape.y,startShape:{...shape}};try{svg.setPointerCapture(event.pointerId)}catch{}event.preventDefault();
  });

  svg.addEventListener('pointermove',event=>{
    if(!pointerAction||event.pointerId!==pointerAction.pointerId)return;
    const shape=selectedShape();if(!shape||shape.locked)return;
    const point=svgPoint(event);
    if(pointerAction.mode==='move'){
      shape.x=clamp(snapNumber(point.x-pointerAction.offsetX),0,WIDTH-shape.w);
      shape.y=clamp(snapNumber(point.y-pointerAction.offsetY),0,HEIGHT-shape.h);
    }else if(pointerAction.mode==='resize'){
      const local=inverseRotatedPoint(point,pointerAction.startShape);
      shape.w=clamp(snapNumber(local.x-pointerAction.startShape.x),18,WIDTH-pointerAction.startShape.x);
      shape.h=clamp(snapNumber(local.y-pointerAction.startShape.y),18,HEIGHT-pointerAction.startShape.y);
    }else if(pointerAction.mode==='rotate'){
      const raw=pointerAction.startShape.rotation+(pointerAngle(point,pointerAction.startShape)-pointerAction.startAngle);
      shape.rotation=snapToggle?.checked?Math.round(raw/5)*5:Math.round(raw);
    }
    render();
  });

  const finishPointer=event=>{if(!pointerAction||event.pointerId!==pointerAction.pointerId)return;const before=pointerAction.before;pointerAction=null;try{svg.releasePointerCapture(event.pointerId)}catch{}commit(before)};
  svg.addEventListener('pointerup',finishPointer);svg.addEventListener('pointercancel',finishPointer);
  svg.addEventListener('dblclick',event=>{const target=event.target.closest?.('[data-shape-id]');if(target){selectedId=target.dataset.shapeId||'';interactSelected();event.preventDefault()}});

  document.addEventListener('keydown',event=>{
    const tag=document.activeElement?.tagName?.toLowerCase(),editing=['input','textarea','select'].includes(tag),modifier=event.ctrlKey||event.metaKey;
    if(modifier&&event.key.toLowerCase()==='z'){event.shiftKey?redo():undo();event.preventDefault();return}
    if(editing)return;
    const shape=selectedShape();if(!shape)return;
    if(event.key.toLowerCase()==='d'){duplicateSelected();event.preventDefault();return}
    if(event.key.toLowerCase()==='i'){interactSelected();event.preventDefault();return}
    if(event.key.toLowerCase()==='g'){groundSelected();event.preventDefault();return}
    if(event.key==='Delete'||event.key==='Backspace'){deleteSelected();event.preventDefault();return}
    if(shape.locked)return;
    const before=snapshot(),distance=event.shiftKey?gridSize():(snapToggle?.checked?gridSize():3);let moved=true;
    if(event.key==='ArrowLeft')shape.x=clamp(shape.x-distance,0,WIDTH-shape.w);else if(event.key==='ArrowRight')shape.x=clamp(shape.x+distance,0,WIDTH-shape.w);else if(event.key==='ArrowUp')shape.y=clamp(shape.y-distance,0,HEIGHT-shape.h);else if(event.key==='ArrowDown')shape.y=clamp(shape.y+distance,0,HEIGHT-shape.h);else moved=false;
    if(moved){render();commit(before);event.preventDefault()}
  });

  $('save-draft')?.addEventListener('click',saveDraft);$('load-draft')?.addEventListener('click',loadDraft);$('create-share')?.addEventListener('click',createShare);$('download-png')?.addEventListener('click',downloadPng);$('clear-design')?.addEventListener('click',clearDesign);$('copy-share')?.addEventListener('click',async()=>say(await copyText(shareUrlInput?.value||'')?'Share link copied.':'Could not copy automatically. Select the link and copy it manually.'));
  titleInput?.addEventListener('change',()=>commit());authorInput?.addEventListener('change',()=>commit());

  const hashMatch=location.hash.match(/^#design=([A-Za-z0-9_-]+)$/);
  if(hashMatch){const shared=decodeState(hashMatch[1]);shared?loadState(shared,'Shared design loaded. Remix it into something new.',true):loadState(defaultState(),'This shared design link is invalid.',true)}
  else{state=sanitizeState({...defaultState(),shapes:template('house')});syncInputsFromState();render();resetHistory();say('Starter house loaded. Select a part or add another.')}
  setInitialChallenge();
  Promise.all([loadShowcase(),loadContactEmail()]).catch(()=>{});
})();

(() => {
  const svg = document.getElementById('design-canvas');
  const shapesLayer = document.getElementById('canvas-shapes');
  const selectionLayer = document.getElementById('selection-layer');
  const sceneLayer = document.getElementById('scene-details');
  if (!svg || !shapesLayer || !selectionLayer || !sceneLayer) return;

  const MAX_SHAPES = 40;
  const MAX_CODE_LENGTH = 20000;
  const VALID_BACKGROUNDS = new Set(['grid', 'paper', 'blueprint', 'river', 'lawn', 'sunset', 'night']);
  const VALID_TYPES = new Set(['rect', 'triangle', 'circle', 'arch', 'window', 'door', 'column', 'tree']);
  const VALID_MATERIALS = new Set(['solid', 'glass', 'translucent', 'outline']);
  const DEFAULT_COLOR = '#00498F';
  const storageKey = 'aias-memphis-design-studio-draft-v2';
  const legacyStorageKey = 'aias-memphis-design-studio-draft-v1';
  const favoritesKey = 'aias-memphis-design-studio-favorites-v1';

  const titleInput = document.getElementById('design-title');
  const authorInput = document.getElementById('design-author');
  const backgroundSelect = document.getElementById('design-background');
  const colorInput = document.getElementById('shape-color');
  const materialInput = document.getElementById('shape-material');
  const widthInput = document.getElementById('shape-width');
  const heightInput = document.getElementById('shape-height');
  const rotationInput = document.getElementById('shape-rotation');
  const opacityInput = document.getElementById('shape-opacity');
  const selectedLabel = document.getElementById('selected-label');
  const widthValue = document.getElementById('width-value');
  const heightValue = document.getElementById('height-value');
  const rotationValue = document.getElementById('rotation-value');
  const opacityValue = document.getElementById('opacity-value');
  const snapToggle = document.getElementById('snap-toggle');
  const gridSizeSelect = document.getElementById('grid-size');
  const lightsToggle = document.getElementById('lights-toggle');
  const undoButton = document.getElementById('undo-action');
  const redoButton = document.getElementById('redo-action');
  const status = document.getElementById('studio-status');
  const sharePanel = document.getElementById('share-panel');
  const shareUrlInput = document.getElementById('share-url');
  const designCodeInput = document.getElementById('design-code');
  const submitDesign = document.getElementById('submit-design');
  const submissionNote = document.getElementById('submission-note');
  const challengePrompt = document.getElementById('challenge-prompt');
  const showcaseTarget = document.getElementById('design-showcase');
  const controls = {
    back: document.getElementById('shape-back'),
    front: document.getElementById('shape-front'),
    duplicate: document.getElementById('shape-duplicate'),
    lock: document.getElementById('shape-lock'),
    delete: document.getElementById('shape-delete')
  };

  const palettes = {
    memphis: ['#00498F', '#193059', '#9C9EA1', '#E2E4E6'],
    warm: ['#B65E3C', '#E5B769', '#6D3B2F', '#DCC6A8'],
    earth: ['#556B55', '#A48B6A', '#D8CDBB', '#7A6448'],
    mono: ['#263238', '#6B747A', '#D5D9DC', '#F2F3F4'],
    neon: ['#6EE7F5', '#E879F9', '#FDE047', '#8B5CF6']
  };

  const challenges = [
    'Design a tiny pavilion using no more than 7 pieces.',
    'Make a building that uses at least 3 arches and no triangles.',
    'Design a riverfront lookout that feels light enough to float.',
    'Create a tower using one color and at least 8 windows.',
    'Make a building where every major form is rotated.',
    'Design a night-time arts venue with glowing windows.',
    'Create a courtyard building with a strong central void.',
    'Design a tiny transit shelter with only 5 pieces.',
    'Build something inspired by Memphis: bold, rhythmic, and a little unexpected.',
    'Make the strangest believable house you can in 3 minutes.',
    'Design a facade using repetition: at least 6 related parts.',
    'Use only circles, arches, windows, and columns to suggest a building.'
  ];

  let state = defaultState();
  let selectedId = '';
  let pointerAction = null;
  let contactEmail = '';
  let undoStack = [];
  let redoStack = [];
  let controlSnapshot = '';
  let showcaseEntries = [];
  let showcaseFilter = 'all';
  let favorites = loadFavorites();

  function defaultState() {
    return { v: 2, title: '', designer: '', background: 'grid', snap: true, gridSize: 16, lights: true, shapes: [] };
  }

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const esc = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const validHex = (value = '') => /^#[0-9a-f]{6}$/i.test(String(value));
  const selectedShape = () => state.shapes.find(shape => shape.id === selectedId) || null;
  const setStatus = (message) => { if (status) status.textContent = message; };
  const snapshot = () => JSON.stringify(sanitizeState(state));
  const snapValue = (value) => state.snap ? Math.round(value / state.gridSize) * state.gridSize : value;

  function uid() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function typeLabel(type) {
    return ({ rect: 'Block', triangle: 'Roof', circle: 'Circle', arch: 'Arch', window: 'Window', door: 'Door', column: 'Column', tree: 'Tree' })[type] || 'Part';
  }

  function defaultDimensions(type) {
    return ({ rect: [170, 125], triangle: [170, 105], circle: [105, 105], arch: [120, 150], window: [68, 74], door: [72, 125], column: [42, 160], tree: [95, 150] })[type] || [120, 100];
  }

  function defaultColor(type) {
    if (type === 'window') return '#A8D8F0';
    if (type === 'door') return '#6D4C41';
    if (type === 'column') return '#D5D9DC';
    if (type === 'tree') return '#55785A';
    return DEFAULT_COLOR;
  }

  function sanitizeShape(raw = {}) {
    if (!VALID_TYPES.has(raw.type)) return null;
    const dims = defaultDimensions(raw.type);
    const w = clamp(raw.w ?? dims[0], 18, 600);
    const h = clamp(raw.h ?? dims[1], 18, 460);
    return {
      id: String(raw.id || uid()).slice(0, 80),
      type: raw.type,
      x: clamp(raw.x, 0, 800 - w),
      y: clamp(raw.y, 0, 520 - h),
      w,
      h,
      fill: validHex(raw.fill) ? String(raw.fill).toUpperCase() : defaultColor(raw.type),
      rotation: clamp(raw.rotation, -180, 180),
      opacity: clamp(raw.opacity ?? 100, 20, 100),
      material: VALID_MATERIALS.has(raw.material) ? raw.material : 'solid',
      locked: Boolean(raw.locked)
    };
  }

  function sanitizeState(raw = {}) {
    const shapes = Array.isArray(raw.shapes) ? raw.shapes.map(sanitizeShape).filter(Boolean).slice(0, MAX_SHAPES) : [];
    const gridSize = [8, 16, 32].includes(Number(raw.gridSize)) ? Number(raw.gridSize) : 16;
    return {
      v: 2,
      title: String(raw.title || '').trim().slice(0, 80),
      designer: String(raw.designer || '').trim().slice(0, 80),
      background: VALID_BACKGROUNDS.has(raw.background) ? raw.background : 'grid',
      snap: raw.snap !== false,
      gridSize,
      lights: raw.lights !== false,
      shapes
    };
  }

  function syncMeta() {
    state.title = String(titleInput?.value || '').trim().slice(0, 80);
    state.designer = String(authorInput?.value || '').trim().slice(0, 80);
    state.background = VALID_BACKGROUNDS.has(backgroundSelect?.value) ? backgroundSelect.value : 'grid';
    state.snap = Boolean(snapToggle?.checked);
    state.gridSize = [8, 16, 32].includes(Number(gridSizeSelect?.value)) ? Number(gridSizeSelect.value) : 16;
    state.lights = Boolean(lightsToggle?.checked);
  }

  function pushUndo(before) {
    if (!before || before === snapshot()) return;
    undoStack.push(before);
    if (undoStack.length > 60) undoStack.shift();
    redoStack = [];
    updateHistoryButtons();
  }

  function withHistory(action, message = '') {
    const before = snapshot();
    action();
    pushUndo(before);
    render();
    if (message) setStatus(message);
  }

  function restoreSnapshot(serialized) {
    try {
      state = sanitizeState(JSON.parse(serialized));
      selectedId = state.shapes.some(shape => shape.id === selectedId) ? selectedId : '';
      syncInputsFromState();
      render();
      return true;
    } catch {
      return false;
    }
  }

  function undo() {
    if (!undoStack.length) return;
    const current = snapshot();
    const previous = undoStack.pop();
    redoStack.push(current);
    restoreSnapshot(previous);
    updateHistoryButtons();
    setStatus('Undid the last change.');
  }

  function redo() {
    if (!redoStack.length) return;
    const current = snapshot();
    const next = redoStack.pop();
    undoStack.push(current);
    restoreSnapshot(next);
    updateHistoryButtons();
    setStatus('Redid the last change.');
  }

  function updateHistoryButtons() {
    if (undoButton) undoButton.disabled = !undoStack.length;
    if (redoButton) redoButton.disabled = !redoStack.length;
  }

  function syncInputsFromState() {
    if (titleInput) titleInput.value = state.title;
    if (authorInput) authorInput.value = state.designer;
    if (backgroundSelect) backgroundSelect.value = state.background;
    if (snapToggle) snapToggle.checked = state.snap;
    if (gridSizeSelect) gridSizeSelect.value = String(state.gridSize);
    if (lightsToggle) lightsToggle.checked = state.lights;
  }

  function backgroundFill(name) {
    if (name === 'paper' || name === 'river' || name === 'lawn') return '#ffffff';
    if (name === 'blueprint') return 'url(#blueprint-pattern)';
    if (name === 'sunset') return 'url(#sunset-gradient)';
    if (name === 'night') return 'url(#night-gradient)';
    return 'url(#grid-pattern)';
  }

  function renderScene() {
    const bg = document.getElementById('canvas-background');
    const gridPattern = document.getElementById('grid-pattern');
    const gridPath = gridPattern?.querySelector('path');
    if (gridPattern && gridPath) {
      const size = state.gridSize;
      gridPattern.setAttribute('width', String(size));
      gridPattern.setAttribute('height', String(size));
      gridPath.setAttribute('d', `M${size} 0H0V${size}`);
    }
    if (bg) bg.setAttribute('fill', backgroundFill(state.background));
    sceneLayer.innerHTML = '';
    if (state.background === 'river') {
      sceneLayer.innerHTML = '<rect width="800" height="330" fill="#eaf4fb"/><circle cx="660" cy="92" r="42" fill="#f5d27a" opacity=".85"/><path d="M0 330 Q130 300 250 328 T520 325 T800 318 V520 H0Z" fill="#9bc7de"/><path d="M0 382 Q180 350 390 380 T800 370" fill="none" stroke="#d9f0f8" stroke-width="7" opacity=".75"/>';
    } else if (state.background === 'lawn') {
      sceneLayer.innerHTML = '<rect width="800" height="345" fill="#eaf4fb"/><circle cx="680" cy="82" r="38" fill="#f2d27c"/><rect y="345" width="800" height="175" fill="#9ebd88"/><path d="M0 410 C160 375 260 455 420 420 S660 380 800 430 V520 H0Z" fill="#7fa46f" opacity=".7"/>';
    } else if (state.background === 'sunset') {
      sceneLayer.innerHTML = '<circle cx="650" cy="120" r="48" fill="#f8d18a" opacity=".9"/><path d="M0 430 Q180 400 330 438 T800 420 V520 H0Z" fill="#78909c" opacity=".45"/>';
    } else if (state.background === 'night') {
      const stars = [[74,70],[145,122],[220,55],[315,102],[410,62],[520,118],[625,54],[730,95],[675,175],[350,170]];
      sceneLayer.innerHTML = `${stars.map(([x,y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#fff" opacity=".75"/>`).join('')}<circle cx="676" cy="105" r="38" fill="#f3f0cf" opacity=".92"/><path d="M0 438 Q180 415 350 444 T800 426 V520 H0Z" fill="#071a2b" opacity=".9"/>`;
    }
  }

  function materialAttrs(shape, forcedFill = '') {
    const fill = forcedFill || shape.fill;
    if (shape.material === 'outline') return { fill: 'none', stroke: fill, strokeWidth: 3, fillOpacity: 1 };
    if (shape.material === 'glass') return { fill, stroke: '#EAF7FF', strokeWidth: 2, fillOpacity: .46 };
    if (shape.material === 'translucent') return { fill, stroke: 'rgba(16,36,58,.28)', strokeWidth: 1.5, fillOpacity: .34 };
    return { fill, stroke: 'rgba(16,36,58,.20)', strokeWidth: 1.5, fillOpacity: 1 };
  }

  function setBaseAttrs(el, shape, forcedFill = '') {
    const attrs = materialAttrs(shape, forcedFill);
    el.setAttribute('fill', attrs.fill);
    el.setAttribute('stroke', attrs.stroke);
    el.setAttribute('stroke-width', String(attrs.strokeWidth));
    el.setAttribute('fill-opacity', String(attrs.fillOpacity));
    el.setAttribute('vector-effect', 'non-scaling-stroke');
    el.dataset.main = 'true';
  }

  function svgEl(name, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
    return el;
  }

  function shapeElement(shape, preview = false) {
    const group = svgEl('g');
    const centerX = shape.x + shape.w / 2;
    const centerY = shape.y + shape.h / 2;
    if (shape.rotation) group.setAttribute('transform', `rotate(${shape.rotation} ${centerX} ${centerY})`);
    group.setAttribute('opacity', String(shape.opacity / 100));

    if (shape.type === 'circle') {
      const base = svgEl('ellipse', { cx: centerX, cy: centerY, rx: shape.w / 2, ry: shape.h / 2 });
      setBaseAttrs(base, shape);
      group.appendChild(base);
    } else if (shape.type === 'triangle') {
      const base = svgEl('polygon', { points: `${centerX},${shape.y} ${shape.x + shape.w},${shape.y + shape.h} ${shape.x},${shape.y + shape.h}` });
      setBaseAttrs(base, shape);
      group.appendChild(base);
    } else if (shape.type === 'arch') {
      const ySpring = shape.y + shape.h * .48;
      const d = `M${shape.x},${shape.y + shape.h} L${shape.x},${ySpring} A${shape.w / 2},${shape.h * .48} 0 0 1 ${shape.x + shape.w},${ySpring} L${shape.x + shape.w},${shape.y + shape.h} Z`;
      const base = svgEl('path', { d });
      setBaseAttrs(base, shape);
      group.appendChild(base);
    } else if (shape.type === 'window') {
      const lit = state.lights && state.background === 'night';
      const base = svgEl('rect', { x: shape.x, y: shape.y, width: shape.w, height: shape.h, rx: 2 });
      setBaseAttrs(base, shape, lit ? '#FFE7A3' : shape.fill);
      group.appendChild(base);
      const mullionColor = lit ? '#BD8E35' : '#FFFFFF';
      group.appendChild(svgEl('line', { x1: centerX, y1: shape.y + 3, x2: centerX, y2: shape.y + shape.h - 3, stroke: mullionColor, 'stroke-width': 2, opacity: .85 }));
      group.appendChild(svgEl('line', { x1: shape.x + 3, y1: centerY, x2: shape.x + shape.w - 3, y2: centerY, stroke: mullionColor, 'stroke-width': 2, opacity: .85 }));
    } else if (shape.type === 'door') {
      const base = svgEl('rect', { x: shape.x, y: shape.y, width: shape.w, height: shape.h, rx: 2 });
      setBaseAttrs(base, shape);
      group.appendChild(base);
      group.appendChild(svgEl('circle', { cx: shape.x + shape.w * .8, cy: shape.y + shape.h * .55, r: Math.max(2.2, Math.min(shape.w, shape.h) * .035), fill: '#F3D28A' }));
    } else if (shape.type === 'column') {
      const capH = Math.max(5, shape.h * .07);
      const baseW = shape.w * .78;
      const baseX = shape.x + (shape.w - baseW) / 2;
      const shaft = svgEl('rect', { x: baseX, y: shape.y + capH, width: baseW, height: Math.max(4, shape.h - capH * 2) });
      setBaseAttrs(shaft, shape);
      group.appendChild(shaft);
      const cap = svgEl('rect', { x: shape.x, y: shape.y, width: shape.w, height: capH });
      setBaseAttrs(cap, shape);
      const foot = svgEl('rect', { x: shape.x, y: shape.y + shape.h - capH, width: shape.w, height: capH });
      setBaseAttrs(foot, shape);
      group.append(cap, foot);
    } else if (shape.type === 'tree') {
      const trunkW = Math.max(5, shape.w * .13);
      group.appendChild(svgEl('rect', { x: centerX - trunkW / 2, y: shape.y + shape.h * .52, width: trunkW, height: shape.h * .48, fill: '#75523A' }));
      const crown = svgEl('ellipse', { cx: centerX, cy: shape.y + shape.h * .34, rx: shape.w / 2, ry: shape.h * .37 });
      setBaseAttrs(crown, shape);
      group.appendChild(crown);
    } else {
      const base = svgEl('rect', { x: shape.x, y: shape.y, width: shape.w, height: shape.h, rx: shape.type === 'rect' ? 1 : 0 });
      setBaseAttrs(base, shape);
      group.appendChild(base);
    }

    if (!preview) {
      group.classList.add('design-shape');
      if (shape.id === selectedId) group.classList.add('is-selected');
      if (shape.locked) group.classList.add('is-locked');
      group.dataset.shapeId = shape.id;
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', `${typeLabel(shape.type)} building part${shape.locked ? ', locked' : ''}`);
    }
    return group;
  }

  function renderSelection() {
    selectionLayer.innerHTML = '';
    const shape = selectedShape();
    if (!shape) return;
    const cx = shape.x + shape.w / 2;
    const cy = shape.y + shape.h / 2;
    const transform = shape.rotation ? `rotate(${shape.rotation} ${cx} ${cy})` : '';
    const box = svgEl('rect', { x: shape.x - 5, y: shape.y - 5, width: shape.w + 10, height: shape.h + 10, rx: 4 });
    box.classList.add('selection-box');
    if (transform) box.setAttribute('transform', transform);
    selectionLayer.appendChild(box);

    const line = svgEl('line', { x1: cx, y1: shape.y - 5, x2: cx, y2: shape.y - 38 });
    line.classList.add('rotation-line');
    if (shape.locked) line.setAttribute('opacity', '.3');
    if (transform) line.setAttribute('transform', transform);
    selectionLayer.appendChild(line);

    const rotate = svgEl('circle', { cx, cy: shape.y - 42, r: 8, 'data-handle': 'rotate' });
    rotate.classList.add('rotation-handle');
    if (shape.locked) rotate.classList.add('is-disabled');
    if (transform) rotate.setAttribute('transform', transform);
    selectionLayer.appendChild(rotate);

    const resize = svgEl('circle', { cx: shape.x + shape.w + 5, cy: shape.y + shape.h + 5, r: 8, 'data-handle': 'resize' });
    resize.classList.add('selection-handle');
    if (shape.locked) resize.classList.add('is-disabled');
    if (transform) resize.setAttribute('transform', transform);
    selectionLayer.appendChild(resize);
  }

  function render() {
    renderScene();
    shapesLayer.innerHTML = '';
    state.shapes.forEach(shape => shapesLayer.appendChild(shapeElement(shape)));
    renderSelection();
    renderLayers();
    syncControls();
    renderStats();
  }

  function renderLayers() {
    const target = document.getElementById('designer-layers');
    if (!target) return;
    if (!state.shapes.length) {
      target.innerHTML = '<span class="muted small-text">No parts yet.</span>';
      return;
    }
    target.innerHTML = state.shapes.map((shape, index) => `<button type="button" class="layer-chip${shape.id === selectedId ? ' is-selected' : ''}${shape.locked ? ' is-locked' : ''}" data-layer-id="${esc(shape.id)}" aria-pressed="${shape.id === selectedId}">${index + 1}. ${esc(typeLabel(shape.type))}</button>`).join('');
  }

  function syncControls() {
    const shape = selectedShape();
    const inputs = [colorInput, materialInput, widthInput, heightInput, rotationInput, opacityInput, controls.back, controls.front, controls.duplicate, controls.lock, controls.delete];
    inputs.forEach(input => { if (input) input.disabled = !shape; });
    if (!shape) {
      if (selectedLabel) { selectedLabel.textContent = 'None'; selectedLabel.classList.remove('is-locked'); }
      [widthValue, heightValue, rotationValue, opacityValue].forEach(el => { if (el) el.textContent = '—'; });
      return;
    }
    if (selectedLabel) {
      selectedLabel.textContent = `${typeLabel(shape.type)}${shape.locked ? ' · Locked' : ''}`;
      selectedLabel.classList.toggle('is-locked', shape.locked);
    }
    if (colorInput) colorInput.value = shape.fill;
    if (materialInput) materialInput.value = shape.material;
    if (widthInput) widthInput.value = String(Math.round(shape.w));
    if (heightInput) heightInput.value = String(Math.round(shape.h));
    if (rotationInput) rotationInput.value = String(Math.round(shape.rotation));
    if (opacityInput) opacityInput.value = String(Math.round(shape.opacity));
    if (widthValue) widthValue.textContent = `${Math.round(shape.w)}px`;
    if (heightValue) heightValue.textContent = `${Math.round(shape.h)}px`;
    if (rotationValue) rotationValue.textContent = `${Math.round(shape.rotation)}°`;
    if (opacityValue) opacityValue.textContent = `${Math.round(shape.opacity)}%`;
    if (controls.lock) controls.lock.textContent = shape.locked ? 'Unlock' : 'Lock';
    [widthInput, heightInput, rotationInput].forEach(input => { if (input) input.disabled = shape.locked; });
    if (controls.delete) controls.delete.disabled = shape.locked;
  }

  function renderStats() {
    syncMeta();
    const colors = new Set(state.shapes.map(shape => shape.fill)).size;
    const rotated = state.shapes.filter(shape => Math.abs(shape.rotation) >= 8).length;
    const windows = state.shapes.filter(shape => shape.type === 'window').length;
    const trees = state.shapes.filter(shape => shape.type === 'tree').length;
    let vibe = 'Balanced';
    if (state.background === 'night') vibe = 'After Dark';
    else if (state.shapes.length >= 15) vibe = 'Maximal';
    else if (rotated >= 3) vibe = 'Dynamic';
    else if (colors >= 4) vibe = 'Colorful';
    else if (state.shapes.length > 0 && state.shapes.length <= 5) vibe = 'Minimal';
    document.getElementById('stat-shapes').textContent = String(state.shapes.length);
    document.getElementById('stat-colors').textContent = String(colors);
    document.getElementById('stat-vibe').textContent = vibe;

    const badges = [];
    if (state.shapes.length >= 1) badges.push('First Move');
    if (state.shapes.length >= 8) badges.push('Stacker');
    if (colors >= 4) badges.push('Colorist');
    if (state.background === 'night') badges.push('After Dark');
    if (windows >= 6) badges.push('Window Wall');
    if (trees >= 3) badges.push('Landscape Architect');
    if (rotated >= 3) badges.push('Rule Breaker');
    if (state.title) badges.push('Named It');
    if (state.shapes.length >= 3 && state.shapes.length <= 5) badges.push('Tiny but Mighty');
    const target = document.getElementById('designer-badges');
    if (target) target.innerHTML = badges.slice(-5).map((badge, index) => `<span class="designer-badge${index === badges.slice(-5).length - 1 && badges.length > 2 ? ' special' : ''}">${esc(badge)}</span>`).join('');
  }

  function addShape(type) {
    if (!VALID_TYPES.has(type)) return;
    if (state.shapes.length >= MAX_SHAPES) { setStatus(`Maximum ${MAX_SHAPES} parts reached.`); return; }
    const [w, h] = defaultDimensions(type);
    const index = state.shapes.length;
    const shape = sanitizeShape({ id: uid(), type, x: snapValue(315 + (index % 5) * 12), y: snapValue(190 + (index % 4) * 12), w, h, fill: defaultColor(type), rotation: 0, opacity: 100, material: type === 'window' ? 'glass' : 'solid' });
    withHistory(() => { state.shapes.push(shape); selectedId = shape.id; }, `${typeLabel(type)} added. Drag it into place.`);
  }

  function updateSelected(patch) {
    const shape = selectedShape();
    if (!shape) return;
    Object.assign(shape, patch);
    shape.w = clamp(shape.w, 18, 600);
    shape.h = clamp(shape.h, 18, 460);
    shape.x = clamp(shape.x, 0, 800 - shape.w);
    shape.y = clamp(shape.y, 0, 520 - shape.h);
    shape.rotation = clamp(shape.rotation, -180, 180);
    shape.opacity = clamp(shape.opacity, 20, 100);
    if (!validHex(shape.fill)) shape.fill = DEFAULT_COLOR;
    if (!VALID_MATERIALS.has(shape.material)) shape.material = 'solid';
    render();
  }

  function moveLayer(direction) {
    const index = state.shapes.findIndex(shape => shape.id === selectedId);
    if (index < 0) return;
    withHistory(() => {
      const [shape] = state.shapes.splice(index, 1);
      if (direction === 'front') state.shapes.push(shape); else state.shapes.unshift(shape);
    }, direction === 'front' ? 'Brought to front.' : 'Sent to back.');
  }

  function duplicateSelected() {
    const source = selectedShape();
    if (!source || state.shapes.length >= MAX_SHAPES) return;
    withHistory(() => {
      const duplicate = sanitizeShape({ ...source, id: uid(), locked: false, x: source.x + 24, y: source.y + 24 });
      state.shapes.push(duplicate);
      selectedId = duplicate.id;
    }, 'Part duplicated.');
  }

  function toggleLock() {
    const shape = selectedShape();
    if (!shape) return;
    withHistory(() => { shape.locked = !shape.locked; }, shape.locked ? 'Part unlocked.' : 'Part locked.');
  }

  function deleteSelected() {
    const shape = selectedShape();
    if (!shape || shape.locked) { if (shape?.locked) setStatus('Unlock this part before deleting it.'); return; }
    withHistory(() => { state.shapes = state.shapes.filter(item => item.id !== selectedId); selectedId = ''; }, 'Part deleted.');
  }

  function svgPoint(event) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM();
    return matrix ? point.matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
  }

  function encodeState(inputState) {
    const clean = sanitizeState(inputState);
    const json = JSON.stringify(clean);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
  }

  function decodeState(code = '') {
    try {
      const input = String(code).trim();
      if (!input || input.length > MAX_CODE_LENGTH || !/^[A-Za-z0-9_-]+$/.test(input)) return null;
      const normalized = input.replaceAll('-', '+').replaceAll('_', '/');
      const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      return sanitizeState(JSON.parse(new TextDecoder().decode(bytes)));
    } catch {
      return null;
    }
  }

  function currentCode() { syncMeta(); return encodeState(state); }
  function shareUrl(code) { const base = new URL('designer.html', window.location.href); base.hash = `design=${code}`; return base.href; }

  async function copyText(text) {
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } } catch {}
    const temp = document.createElement('textarea');
    temp.value = text;
    temp.setAttribute('readonly', '');
    temp.style.position = 'absolute';
    temp.style.left = '-9999px';
    document.body.appendChild(temp);
    temp.select();
    const ok = document.execCommand('copy');
    temp.remove();
    return ok;
  }

  function updateSubmission(code, url) {
    if (!submitDesign || !submissionNote) return;
    if (!contactEmail) { submitDesign.hidden = true; submissionNote.hidden = false; return; }
    const title = state.title || 'Untitled building';
    const designer = state.designer || 'Anonymous designer';
    const subject = `Design Studio showcase submission: ${title}`;
    const body = `Building: ${title}\nDesigner: ${designer}\n\nShare link:\n${url}\n\nDesign code:\n${code}\n\nPlease review this design before adding it to the public Community Showcase.`;
    submitDesign.href = `mailto:${encodeURIComponent(contactEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    submitDesign.hidden = false;
    submissionNote.hidden = true;
  }

  function createShare() {
    const code = currentCode();
    const url = shareUrl(code);
    if (shareUrlInput) shareUrlInput.value = url;
    if (designCodeInput) designCodeInput.value = code;
    if (sharePanel) sharePanel.hidden = false;
    updateSubmission(code, url);
    setStatus('Share link created. Send it to someone and let them remix your building.');
    sharePanel?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }

  function saveDraft() {
    syncMeta();
    try { localStorage.setItem(storageKey, JSON.stringify(sanitizeState(state))); setStatus('Draft saved on this device.'); }
    catch { setStatus('This browser could not save the draft locally.'); }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(storageKey) || localStorage.getItem(legacyStorageKey);
      if (!raw) { setStatus('No saved draft was found on this device.'); return; }
      const before = snapshot();
      loadState(sanitizeState(JSON.parse(raw)), 'Saved draft loaded.');
      pushUndo(before);
    } catch { setStatus('The saved draft could not be loaded.'); }
  }

  function loadState(nextState, message = '', resetHistory = false) {
    state = sanitizeState(nextState);
    selectedId = '';
    syncInputsFromState();
    if (resetHistory) { undoStack = []; redoStack = []; updateHistoryButtons(); }
    render();
    if (message) setStatus(message);
  }

  function clearDesign() {
    if (state.shapes.length && !window.confirm('Clear every part from this design?')) return;
    withHistory(() => { state.shapes = []; selectedId = ''; }, 'Canvas cleared.');
  }

  function downloadPng() {
    syncMeta();
    const clone = svg.cloneNode(true);
    clone.querySelector('#selection-layer')?.remove();
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', '800');
    clone.setAttribute('height', '520');
    clone.querySelectorAll('.design-shape').forEach(el => el.classList.remove('design-shape', 'is-selected', 'is-locked'));
    const serialized = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    const source = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1600; canvas.height = 1040;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(source); setStatus('PNG export is not supported in this browser.'); return; }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(source);
      const link = document.createElement('a');
      const safeName = (state.title || 'aias-building').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'aias-building';
      link.download = `${safeName}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setStatus('PNG exported.');
    };
    image.onerror = () => { URL.revokeObjectURL(source); setStatus('PNG export failed in this browser.'); };
    image.src = source;
  }

  function makeShape(type, x, y, w, h, fill, extra = {}) {
    return sanitizeShape({ id: uid(), type, x, y, w, h, fill, ...extra });
  }

  function templateState(name) {
    const base = { ...state, shapes: [], background: state.background };
    if (name === 'tower') {
      base.shapes = [
        makeShape('rect', 300, 120, 200, 330, '#193059'),
        makeShape('rect', 330, 82, 140, 48, '#00498F'),
        ...Array.from({ length: 8 }, (_, i) => makeShape('window', 330 + (i % 2) * 82, 165 + Math.floor(i / 2) * 64, 54, 42, '#A8D8F0', { material: 'glass' }))
      ];
    } else if (name === 'pavilion') {
      base.shapes = [
        makeShape('rect', 190, 365, 420, 28, '#193059'),
        makeShape('rect', 210, 210, 380, 34, '#00498F'),
        makeShape('column', 245, 240, 38, 128, '#D5D9DC'),
        makeShape('column', 365, 240, 38, 128, '#D5D9DC'),
        makeShape('column', 485, 240, 38, 128, '#D5D9DC'),
        makeShape('tree', 90, 255, 90, 150, '#55785A')
      ];
      base.background = 'lawn';
    } else if (name === 'courtyard') {
      base.shapes = [
        makeShape('rect', 125, 220, 190, 220, '#9C9EA1'),
        makeShape('rect', 485, 220, 190, 220, '#9C9EA1'),
        makeShape('rect', 315, 320, 170, 120, '#193059'),
        makeShape('arch', 338, 245, 124, 116, '#E2E4E6'),
        makeShape('tree', 350, 285, 100, 150, '#55785A')
      ];
      base.background = 'lawn';
    } else {
      base.shapes = [
        makeShape('rect', 250, 270, 300, 170, '#00498F'),
        makeShape('triangle', 220, 155, 360, 125, '#193059'),
        makeShape('door', 365, 325, 70, 115, '#6D4C41'),
        makeShape('window', 285, 310, 58, 58, '#A8D8F0', { material: 'glass' }),
        makeShape('window', 457, 310, 58, 58, '#A8D8F0', { material: 'glass' })
      ];
    }
    return sanitizeState(base);
  }

  function loadTemplate(name) {
    const before = snapshot();
    const next = templateState(name);
    next.title = state.title;
    next.designer = state.designer;
    loadState(next, `${name[0].toUpperCase() + name.slice(1)} quick start loaded.`);
    pushUndo(before);
  }

  function applyPalette(name) {
    const palette = palettes[name];
    if (!palette || !state.shapes.length) return;
    withHistory(() => {
      let index = 0;
      state.shapes.forEach(shape => {
        if (shape.type === 'tree') return;
        if (shape.type === 'window') { shape.fill = name === 'neon' ? palette[index++ % palette.length] : '#A8D8F0'; return; }
        shape.fill = palette[index++ % palette.length];
      });
    }, `${name[0].toUpperCase() + name.slice(1)} palette applied.`);
  }

  function surpriseBuilding() {
    const before = snapshot();
    const paletteNames = Object.keys(palettes);
    const palette = palettes[paletteNames[Math.floor(Math.random() * paletteNames.length)]];
    const backgrounds = ['grid', 'river', 'lawn', 'sunset', 'night'];
    const next = { ...state, background: backgrounds[Math.floor(Math.random() * backgrounds.length)], shapes: [] };
    const baseCount = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < baseCount; i += 1) {
      const w = 100 + Math.random() * 170;
      const h = 80 + Math.random() * 200;
      const x = 80 + Math.random() * (640 - w);
      const y = 430 - h + Math.random() * 25;
      next.shapes.push(makeShape('rect', x, y, w, h, palette[i % palette.length], { rotation: Math.random() < .28 ? Math.round((Math.random() * 20 - 10)) : 0 }));
    }
    if (Math.random() < .72) next.shapes.push(makeShape(Math.random() < .5 ? 'triangle' : 'arch', 250, 120, 300, 150, palette[1 % palette.length]));
    const windowCount = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < windowCount; i += 1) next.shapes.push(makeShape('window', 220 + (i % 4) * 88, 260 + Math.floor(i / 4) * 70, 48, 46, '#A8D8F0', { material: 'glass' }));
    if (Math.random() < .55) next.shapes.push(makeShape('tree', 70, 300, 90, 150, '#55785A'));
    loadState(next, 'Random concept generated. Now make it better.');
    pushUndo(before);
  }

  function newChallenge() {
    let next = challenges[Math.floor(Math.random() * challenges.length)];
    if (challengePrompt && challenges.length > 1) {
      let attempts = 0;
      while (next === challengePrompt.textContent && attempts < 5) { next = challenges[Math.floor(Math.random() * challenges.length)]; attempts += 1; }
      challengePrompt.textContent = next;
    }
  }

  function previewBackground(name) {
    return { grid: '#f4f7f9', paper: '#ffffff', blueprint: '#185b88', river: '#9bc7de', lawn: '#9ebd88', sunset: '#e8d1bd', night: '#122b49' }[name] || '#f4f7f9';
  }

  function previewSvg(design, index) {
    const clean = sanitizeState(design);
    const line = clean.background === 'grid' ? '<path d="M0 104H800M0 208H800M0 312H800M0 416H800M160 0V520M320 0V520M480 0V520M640 0V520" stroke="#cdd8e0" stroke-width="2" opacity=".55"/>' : '';
    const shapes = clean.shapes.map(shape => {
      const cx = shape.x + shape.w / 2, cy = shape.y + shape.h / 2;
      const transform = shape.rotation ? ` transform="rotate(${shape.rotation} ${cx} ${cy})"` : '';
      const opacity = shape.opacity / 100;
      if (shape.type === 'circle') return `<ellipse cx="${cx}" cy="${cy}" rx="${shape.w / 2}" ry="${shape.h / 2}" fill="${esc(shape.fill)}" opacity="${opacity}"${transform}/>`;
      if (shape.type === 'triangle') return `<polygon points="${cx},${shape.y} ${shape.x + shape.w},${shape.y + shape.h} ${shape.x},${shape.y + shape.h}" fill="${esc(shape.fill)}" opacity="${opacity}"${transform}/>`;
      if (shape.type === 'arch') { const ys = shape.y + shape.h * .48; return `<path d="M${shape.x},${shape.y + shape.h} L${shape.x},${ys} A${shape.w / 2},${shape.h * .48} 0 0 1 ${shape.x + shape.w},${ys} L${shape.x + shape.w},${shape.y + shape.h} Z" fill="${esc(shape.fill)}" opacity="${opacity}"${transform}/>`; }
      if (shape.type === 'tree') return `<g opacity="${opacity}"${transform}><rect x="${cx - shape.w * .065}" y="${shape.y + shape.h * .52}" width="${shape.w * .13}" height="${shape.h * .48}" fill="#75523A"/><ellipse cx="${cx}" cy="${shape.y + shape.h * .34}" rx="${shape.w / 2}" ry="${shape.h * .37}" fill="${esc(shape.fill)}"/></g>`;
      return `<rect x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}" rx="${shape.type === 'window' || shape.type === 'door' ? 2 : 0}" fill="${esc(shape.fill)}" opacity="${opacity}"${transform}/>`;
    }).join('');
    return `<svg viewBox="0 0 800 520" role="img" aria-label="Preview of ${esc(clean.title || `community design ${index + 1}`)}"><rect width="800" height="520" fill="${previewBackground(clean.background)}"/>${line}${shapes}</svg>`;
  }

  function favoriteId(code) {
    let hash = 2166136261;
    for (let i = 0; i < code.length; i += 1) { hash ^= code.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0).toString(36);
  }

  function loadFavorites() {
    try { const value = JSON.parse(localStorage.getItem(favoritesKey) || '[]'); return new Set(Array.isArray(value) ? value.map(String) : []); }
    catch { return new Set(); }
  }

  function saveFavorites() {
    try { localStorage.setItem(favoritesKey, JSON.stringify([...favorites])); } catch {}
  }

  function renderShowcase() {
    if (!showcaseTarget) return;
    const filtered = showcaseEntries.filter(entry => {
      if (showcaseFilter === 'featured') return Boolean(entry.featured);
      if (showcaseFilter === 'favorites') return favorites.has(entry.favoriteId);
      return true;
    });
    if (!filtered.length) {
      showcaseTarget.innerHTML = `<div class="empty-state">${showcaseFilter === 'favorites' ? 'No favorites saved on this device yet.' : 'No community designs match this view.'}</div>`;
      return;
    }
    showcaseTarget.innerHTML = filtered.map((entry, index) => {
      const title = entry.title || entry.design.title || 'Untitled building';
      const designer = entry.designer || entry.design.designer || 'Anonymous designer';
      const href = `designer.html#design=${encodeURIComponent(entry.design_code)}`;
      const favorite = favorites.has(entry.favoriteId);
      return `<article class="design-gallery-card">
        <div class="design-gallery-preview">${previewSvg(entry.design, index)}</div>
        <div class="design-gallery-body">
          ${entry.featured ? '<span class="design-gallery-badge">Featured design</span>' : ''}
          <h3>${esc(title)}</h3>
          <p class="design-gallery-author">by ${esc(designer)}</p>
          <div class="design-gallery-actions">
            <a class="button button-outline" href="${esc(href)}">Remix →</a>
            <button type="button" class="favorite-button${favorite ? ' is-favorite' : ''}" data-favorite-id="${entry.favoriteId}" aria-pressed="${favorite}">${favorite ? '★ Saved' : '☆ Favorite'}</button>
          </div>
        </div>
      </article>`;
    }).join('');
  }

  async function loadShowcase() {
    if (!showcaseTarget) return;
    try {
      const response = await fetch('data/designs.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load showcase');
      const data = await response.json();
      showcaseEntries = (Array.isArray(data) ? data : [])
        .filter(entry => entry && entry.published !== false && entry.design_code)
        .map(entry => ({ ...entry, design: decodeState(entry.design_code), favoriteId: favoriteId(String(entry.design_code)) }))
        .filter(entry => entry.design)
        .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
      if (!showcaseEntries.length) { showcaseTarget.innerHTML = '<div class="empty-state">No community designs have been published yet. Create the first one and submit its share code to chapter leadership.</div>'; return; }
      renderShowcase();
    } catch (error) {
      console.error(error);
      showcaseTarget.innerHTML = '<div class="empty-state">Community designs could not be loaded.</div>';
    }
  }

  async function loadContactEmail() {
    try {
      const response = await fetch('data/site.json', { cache: 'no-store' });
      if (!response.ok) return;
      const site = await response.json();
      const email = String(site?.contact_email || '').trim();
      if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && !/example\./i.test(email)) contactEmail = email;
      if (sharePanel && !sharePanel.hidden && designCodeInput?.value && shareUrlInput?.value) updateSubmission(designCodeInput.value, shareUrlInput.value);
    } catch {}
  }

  function attachHistoryAwareControl(input, patchFactory) {
    if (!input) return;
    const begin = () => { if (!controlSnapshot) controlSnapshot = snapshot(); };
    input.addEventListener('pointerdown', begin);
    input.addEventListener('focus', begin);
    input.addEventListener('input', () => updateSelected(patchFactory(input)));
    input.addEventListener('change', () => { if (controlSnapshot) { pushUndo(controlSnapshot); controlSnapshot = ''; } });
    input.addEventListener('blur', () => { if (controlSnapshot) { pushUndo(controlSnapshot); controlSnapshot = ''; } });
  }

  document.querySelectorAll('[data-add-shape]').forEach(button => button.addEventListener('click', () => addShape(button.dataset.addShape)));
  document.querySelectorAll('[data-template]').forEach(button => button.addEventListener('click', () => loadTemplate(button.dataset.template)));
  document.querySelectorAll('[data-palette]').forEach(button => button.addEventListener('click', () => applyPalette(button.dataset.palette)));
  document.querySelectorAll('[data-showcase-filter]').forEach(button => button.addEventListener('click', () => {
    showcaseFilter = button.dataset.showcaseFilter || 'all';
    document.querySelectorAll('[data-showcase-filter]').forEach(item => item.classList.toggle('is-active', item === button));
    renderShowcase();
  }));

  titleInput?.addEventListener('input', () => { state.title = titleInput.value.trim().slice(0, 80); renderStats(); });
  authorInput?.addEventListener('input', () => { state.designer = authorInput.value.trim().slice(0, 80); renderStats(); });
  backgroundSelect?.addEventListener('change', () => withHistory(() => { state.background = VALID_BACKGROUNDS.has(backgroundSelect.value) ? backgroundSelect.value : 'grid'; }, 'Scene changed.'));
  snapToggle?.addEventListener('change', () => { state.snap = snapToggle.checked; renderStats(); setStatus(state.snap ? `Snap enabled at ${state.gridSize}px.` : 'Free movement enabled.'); });
  gridSizeSelect?.addEventListener('change', () => { state.gridSize = [8,16,32].includes(Number(gridSizeSelect.value)) ? Number(gridSizeSelect.value) : 16; render(); setStatus(`Grid snap set to ${state.gridSize}px.`); });
  lightsToggle?.addEventListener('change', () => withHistory(() => { state.lights = lightsToggle.checked; }, state.lights ? 'Window lights off.' : 'Window lights on.'));

  attachHistoryAwareControl(colorInput, input => ({ fill: input.value }));
  attachHistoryAwareControl(materialInput, input => ({ material: input.value }));
  attachHistoryAwareControl(widthInput, input => ({ w: Number(input.value) }));
  attachHistoryAwareControl(heightInput, input => ({ h: Number(input.value) }));
  attachHistoryAwareControl(rotationInput, input => ({ rotation: Number(input.value) }));
  attachHistoryAwareControl(opacityInput, input => ({ opacity: Number(input.value) }));

  controls.back?.addEventListener('click', () => moveLayer('back'));
  controls.front?.addEventListener('click', () => moveLayer('front'));
  controls.duplicate?.addEventListener('click', duplicateSelected);
  controls.lock?.addEventListener('click', toggleLock);
  controls.delete?.addEventListener('click', deleteSelected);
  undoButton?.addEventListener('click', undo);
  redoButton?.addEventListener('click', redo);
  document.getElementById('new-challenge')?.addEventListener('click', newChallenge);
  document.getElementById('surprise-building')?.addEventListener('click', surpriseBuilding);

  svg.addEventListener('pointerdown', event => {
    const handle = event.target.closest?.('[data-handle]');
    const shape = selectedShape();
    if (handle && shape && !shape.locked) {
      const point = svgPoint(event);
      pointerAction = { mode: handle.dataset.handle, pointerId: event.pointerId, before: snapshot(), start: point, original: { ...shape } };
      try { svg.setPointerCapture(event.pointerId); } catch {}
      event.preventDefault();
      return;
    }

    const target = event.target.closest?.('[data-shape-id]');
    if (!target) { selectedId = ''; render(); return; }
    const next = state.shapes.find(item => item.id === target.dataset.shapeId);
    if (!next) return;
    selectedId = next.id;
    render();
    if (next.locked) { setStatus('This part is locked. Unlock it from the controls to move it.'); return; }
    const point = svgPoint(event);
    pointerAction = { mode: 'move', pointerId: event.pointerId, before: snapshot(), offsetX: point.x - next.x, offsetY: point.y - next.y, original: { ...next } };
    try { svg.setPointerCapture(event.pointerId); } catch {}
    event.preventDefault();
  });

  svg.addEventListener('pointermove', event => {
    if (!pointerAction || event.pointerId !== pointerAction.pointerId) return;
    const shape = selectedShape();
    if (!shape || shape.locked) return;
    const point = svgPoint(event);
    if (pointerAction.mode === 'move') {
      shape.x = clamp(snapValue(point.x - pointerAction.offsetX), 0, 800 - shape.w);
      shape.y = clamp(snapValue(point.y - pointerAction.offsetY), 0, 520 - shape.h);
    } else if (pointerAction.mode === 'resize') {
      shape.w = clamp(snapValue(point.x - shape.x), 18, 600);
      shape.h = clamp(snapValue(point.y - shape.y), 18, 460);
      shape.w = Math.min(shape.w, 800 - shape.x);
      shape.h = Math.min(shape.h, 520 - shape.y);
    } else if (pointerAction.mode === 'rotate') {
      const cx = shape.x + shape.w / 2, cy = shape.y + shape.h / 2;
      const degrees = Math.atan2(point.y - cy, point.x - cx) * 180 / Math.PI + 90;
      shape.rotation = clamp(state.snap ? Math.round(degrees / 5) * 5 : Math.round(degrees), -180, 180);
    }
    render();
  });

  const endPointerAction = event => {
    if (!pointerAction || event.pointerId !== pointerAction.pointerId) return;
    const before = pointerAction.before;
    pointerAction = null;
    try { svg.releasePointerCapture(event.pointerId); } catch {}
    pushUndo(before);
  };
  svg.addEventListener('pointerup', endPointerAction);
  svg.addEventListener('pointercancel', endPointerAction);

  svg.addEventListener('keydown', event => {
    const shape = selectedShape();
    if (!shape || shape.locked) return;
    const distance = event.shiftKey ? Math.max(10, state.gridSize) : (state.snap ? state.gridSize : 3);
    const before = snapshot();
    if (event.key === 'ArrowLeft') shape.x = clamp(shape.x - distance, 0, 800 - shape.w);
    else if (event.key === 'ArrowRight') shape.x = clamp(shape.x + distance, 0, 800 - shape.w);
    else if (event.key === 'ArrowUp') shape.y = clamp(shape.y - distance, 0, 520 - shape.h);
    else if (event.key === 'ArrowDown') shape.y = clamp(shape.y + distance, 0, 520 - shape.h);
    else return;
    render(); pushUndo(before); event.preventDefault();
  });

  document.getElementById('designer-app')?.addEventListener('keydown', event => {
    const editable = event.target.matches?.('input, textarea, select') || event.target.isContentEditable;
    if (editable) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
    if (event.key.toLowerCase() === 'd' && !event.ctrlKey && !event.metaKey) { event.preventDefault(); duplicateSelected(); return; }
    if (event.key === 'Delete' || event.key === 'Backspace') { if (selectedShape()) { event.preventDefault(); deleteSelected(); } }
  });

  document.getElementById('save-draft')?.addEventListener('click', saveDraft);
  document.getElementById('load-draft')?.addEventListener('click', loadDraft);
  document.getElementById('create-share')?.addEventListener('click', createShare);
  document.getElementById('download-png')?.addEventListener('click', downloadPng);
  document.getElementById('clear-design')?.addEventListener('click', clearDesign);
  document.getElementById('copy-share')?.addEventListener('click', async () => {
    const ok = await copyText(shareUrlInput?.value || '');
    setStatus(ok ? 'Share link copied.' : 'Could not copy automatically. Select the link and copy it manually.');
  });

  document.getElementById('designer-layers')?.addEventListener('click', event => {
    const button = event.target.closest?.('[data-layer-id]');
    if (!button) return;
    const exists = state.shapes.some(shape => shape.id === button.dataset.layerId);
    if (!exists) return;
    selectedId = button.dataset.layerId;
    render();
    svg.focus({ preventScroll: true });
    setStatus(`${typeLabel(selectedShape()?.type)} selected from the parts list.`);
  });

  showcaseTarget?.addEventListener('click', event => {
    const button = event.target.closest?.('[data-favorite-id]');
    if (!button) return;
    const id = button.dataset.favoriteId;
    if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
    saveFavorites();
    renderShowcase();
  });

  const hashMatch = window.location.hash.match(/^#design=([A-Za-z0-9_-]+)$/);
  if (hashMatch) {
    const shared = decodeState(hashMatch[1]);
    if (shared) loadState(shared, 'Shared design loaded. Remix it and make it yours.', true);
    else { loadState(templateState('house'), 'This shared design link is invalid, so a starter building was loaded.', true); }
  } else {
    loadState(templateState('house'), 'Starter building loaded. Select a part or add another.', true);
  }

  updateHistoryButtons();
  Promise.all([loadShowcase(), loadContactEmail()]).catch(() => {});
})();

(() => {
  const svg = document.getElementById('design-canvas');
  const shapesLayer = document.getElementById('canvas-shapes');
  const selectionLayer = document.getElementById('selection-layer');
  if (!svg || !shapesLayer || !selectionLayer) return;

  const MAX_SHAPES = 40;
  const VALID_BACKGROUNDS = new Set(['grid', 'paper', 'blueprint', 'sunset', 'night']);
  const VALID_TYPES = new Set(['rect', 'triangle', 'circle']);
  const DEFAULT_COLOR = '#00498F';
  const storageKey = 'aias-memphis-design-studio-draft-v1';
  const titleInput = document.getElementById('design-title');
  const authorInput = document.getElementById('design-author');
  const backgroundSelect = document.getElementById('design-background');
  const colorInput = document.getElementById('shape-color');
  const widthInput = document.getElementById('shape-width');
  const heightInput = document.getElementById('shape-height');
  const rotationInput = document.getElementById('shape-rotation');
  const selectedLabel = document.getElementById('selected-label');
  const widthValue = document.getElementById('width-value');
  const heightValue = document.getElementById('height-value');
  const rotationValue = document.getElementById('rotation-value');
  const status = document.getElementById('studio-status');
  const sharePanel = document.getElementById('share-panel');
  const shareUrlInput = document.getElementById('share-url');
  const designCodeInput = document.getElementById('design-code');
  const submitDesign = document.getElementById('submit-design');
  const submissionNote = document.getElementById('submission-note');
  const controls = {
    back: document.getElementById('shape-back'),
    front: document.getElementById('shape-front'),
    duplicate: document.getElementById('shape-duplicate'),
    delete: document.getElementById('shape-delete')
  };

  let state = { v: 1, title: '', designer: '', background: 'grid', shapes: [] };
  let selectedId = '';
  let drag = null;
  let contactEmail = '';

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const esc = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  const validHex = (value = '') => /^#[0-9a-f]{6}$/i.test(String(value));
  const selectedShape = () => state.shapes.find(shape => shape.id === selectedId) || null;
  const setStatus = (message) => { if (status) status.textContent = message; };
  const syncMeta = () => {
    state.title = String(titleInput?.value || '').trim().slice(0, 80);
    state.designer = String(authorInput?.value || '').trim().slice(0, 80);
    state.background = VALID_BACKGROUNDS.has(backgroundSelect?.value) ? backgroundSelect.value : 'grid';
  };

  function uid() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function sanitizeShape(raw = {}) {
    if (!VALID_TYPES.has(raw.type)) return null;
    const w = clamp(raw.w, 24, 560);
    const h = clamp(raw.h, 24, 420);
    return {
      id: String(raw.id || uid()).slice(0, 80),
      type: raw.type,
      x: clamp(raw.x, 0, 800 - w),
      y: clamp(raw.y, 0, 520 - h),
      w,
      h,
      fill: validHex(raw.fill) ? raw.fill.toUpperCase() : DEFAULT_COLOR,
      rotation: clamp(raw.rotation, -180, 180)
    };
  }

  function sanitizeState(raw = {}) {
    const shapes = Array.isArray(raw.shapes) ? raw.shapes.map(sanitizeShape).filter(Boolean).slice(0, MAX_SHAPES) : [];
    return {
      v: 1,
      title: String(raw.title || '').trim().slice(0, 80),
      designer: String(raw.designer || '').trim().slice(0, 80),
      background: VALID_BACKGROUNDS.has(raw.background) ? raw.background : 'grid',
      shapes
    };
  }

  function backgroundFill(name) {
    if (name === 'paper') return '#ffffff';
    if (name === 'blueprint') return 'url(#blueprint-pattern)';
    if (name === 'sunset') return 'url(#sunset-gradient)';
    if (name === 'night') return 'url(#night-gradient)';
    return 'url(#grid-pattern)';
  }

  function applyBackground() {
    const bg = document.getElementById('canvas-background');
    if (bg) bg.setAttribute('fill', backgroundFill(state.background));
  }

  function shapeElement(shape, preview = false) {
    const centerX = shape.x + shape.w / 2;
    const centerY = shape.y + shape.h / 2;
    const transform = shape.rotation ? `rotate(${shape.rotation} ${centerX} ${centerY})` : '';
    let el;
    if (shape.type === 'circle') {
      el = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      el.setAttribute('cx', centerX);
      el.setAttribute('cy', centerY);
      el.setAttribute('rx', shape.w / 2);
      el.setAttribute('ry', shape.h / 2);
    } else if (shape.type === 'triangle') {
      el = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      el.setAttribute('points', `${centerX},${shape.y} ${shape.x + shape.w},${shape.y + shape.h} ${shape.x},${shape.y + shape.h}`);
    } else {
      el = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      el.setAttribute('x', shape.x);
      el.setAttribute('y', shape.y);
      el.setAttribute('width', shape.w);
      el.setAttribute('height', shape.h);
    }
    el.setAttribute('fill', shape.fill);
    if (transform) el.setAttribute('transform', transform);
    if (!preview) {
      el.classList.add('design-shape');
      if (shape.id === selectedId) el.classList.add('is-selected');
      el.dataset.shapeId = shape.id;
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '-1');
      el.setAttribute('aria-label', `${shape.type} building shape`);
    }
    return el;
  }

  function renderSelection() {
    selectionLayer.innerHTML = '';
    const shape = selectedShape();
    if (!shape) return;
    const box = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    box.setAttribute('x', shape.x - 5);
    box.setAttribute('y', shape.y - 5);
    box.setAttribute('width', shape.w + 10);
    box.setAttribute('height', shape.h + 10);
    box.setAttribute('rx', 4);
    box.classList.add('selection-box');
    const cx = shape.x + shape.w / 2;
    const cy = shape.y + shape.h / 2;
    if (shape.rotation) box.setAttribute('transform', `rotate(${shape.rotation} ${cx} ${cy})`);
    selectionLayer.appendChild(box);
  }

  function render() {
    applyBackground();
    shapesLayer.innerHTML = '';
    state.shapes.forEach(shape => shapesLayer.appendChild(shapeElement(shape)));
    renderSelection();
    syncControls();
  }

  function syncControls() {
    const shape = selectedShape();
    const inputs = [colorInput, widthInput, heightInput, rotationInput, controls.back, controls.front, controls.duplicate, controls.delete];
    inputs.forEach(input => { if (input) input.disabled = !shape; });
    if (!shape) {
      if (selectedLabel) selectedLabel.textContent = 'None';
      if (widthValue) widthValue.textContent = '—';
      if (heightValue) heightValue.textContent = '—';
      if (rotationValue) rotationValue.textContent = '—';
      return;
    }
    if (selectedLabel) selectedLabel.textContent = shape.type === 'rect' ? 'Block' : shape.type === 'triangle' ? 'Roof' : 'Circle';
    if (colorInput) colorInput.value = shape.fill;
    if (widthInput) widthInput.value = String(Math.round(shape.w));
    if (heightInput) heightInput.value = String(Math.round(shape.h));
    if (rotationInput) rotationInput.value = String(Math.round(shape.rotation));
    if (widthValue) widthValue.textContent = `${Math.round(shape.w)}px`;
    if (heightValue) heightValue.textContent = `${Math.round(shape.h)}px`;
    if (rotationValue) rotationValue.textContent = `${Math.round(shape.rotation)}°`;
  }

  function addShape(type) {
    if (!VALID_TYPES.has(type) || state.shapes.length >= MAX_SHAPES) {
      setStatus(state.shapes.length >= MAX_SHAPES ? `Maximum ${MAX_SHAPES} shapes reached.` : 'That shape is unavailable.');
      return;
    }
    const index = state.shapes.length;
    const dimensions = type === 'triangle' ? [170, 105] : type === 'circle' ? [105, 105] : [170, 125];
    const shape = sanitizeShape({
      id: uid(), type,
      x: 315 + (index % 5) * 10,
      y: 190 + (index % 4) * 10,
      w: dimensions[0], h: dimensions[1],
      fill: DEFAULT_COLOR, rotation: 0
    });
    state.shapes.push(shape);
    selectedId = shape.id;
    render();
    setStatus(`${type === 'rect' ? 'Block' : type === 'triangle' ? 'Roof' : 'Circle'} added. Drag it into place.`);
  }

  function updateSelected(patch) {
    const shape = selectedShape();
    if (!shape) return;
    Object.assign(shape, patch);
    shape.w = clamp(shape.w, 24, 560);
    shape.h = clamp(shape.h, 24, 420);
    shape.x = clamp(shape.x, 0, 800 - shape.w);
    shape.y = clamp(shape.y, 0, 520 - shape.h);
    shape.rotation = clamp(shape.rotation, -180, 180);
    if (!validHex(shape.fill)) shape.fill = DEFAULT_COLOR;
    render();
  }

  function moveLayer(direction) {
    const index = state.shapes.findIndex(shape => shape.id === selectedId);
    if (index < 0) return;
    const [shape] = state.shapes.splice(index, 1);
    if (direction === 'front') state.shapes.push(shape);
    else state.shapes.unshift(shape);
    render();
  }

  function duplicateSelected() {
    const source = selectedShape();
    if (!source || state.shapes.length >= MAX_SHAPES) return;
    const duplicate = sanitizeShape({ ...source, id: uid(), x: source.x + 24, y: source.y + 24 });
    state.shapes.push(duplicate);
    selectedId = duplicate.id;
    render();
    setStatus('Shape duplicated.');
  }

  function deleteSelected() {
    if (!selectedId) return;
    state.shapes = state.shapes.filter(shape => shape.id !== selectedId);
    selectedId = '';
    render();
    setStatus('Shape deleted.');
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
      const normalized = String(code).trim().replaceAll('-', '+').replaceAll('_', '/');
      const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      return sanitizeState(JSON.parse(new TextDecoder().decode(bytes)));
    } catch {
      return null;
    }
  }

  function currentCode() {
    syncMeta();
    return encodeState(state);
  }

  function shareUrl(code) {
    const base = new URL('designer.html', window.location.href);
    base.hash = `design=${code}`;
    return base.href;
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
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
    if (!contactEmail) {
      submitDesign.hidden = true;
      submissionNote.hidden = false;
      return;
    }
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
    setStatus('Share link created.');
    sharePanel?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }

  function saveDraft() {
    syncMeta();
    try {
      localStorage.setItem(storageKey, JSON.stringify(sanitizeState(state)));
      setStatus('Draft saved on this device.');
    } catch {
      setStatus('This browser could not save the draft locally.');
    }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) { setStatus('No saved draft was found on this device.'); return; }
      loadState(sanitizeState(JSON.parse(raw)), 'Saved draft loaded.');
    } catch {
      setStatus('The saved draft could not be loaded.');
    }
  }

  function loadState(nextState, message = '') {
    state = sanitizeState(nextState);
    selectedId = '';
    if (titleInput) titleInput.value = state.title;
    if (authorInput) authorInput.value = state.designer;
    if (backgroundSelect) backgroundSelect.value = state.background;
    render();
    if (message) setStatus(message);
  }

  function clearDesign() {
    if (state.shapes.length && !window.confirm('Clear every shape from this design?')) return;
    state.shapes = [];
    selectedId = '';
    render();
    setStatus('Canvas cleared.');
  }

  function downloadPng() {
    syncMeta();
    const clone = svg.cloneNode(true);
    clone.querySelector('#selection-layer')?.remove();
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', '800');
    clone.setAttribute('height', '520');
    clone.querySelectorAll('.design-shape').forEach(el => el.classList.remove('design-shape', 'is-selected'));
    const serialized = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
    const source = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 1040;
      const ctx = canvas.getContext('2d');
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

  function previewBackground(name) {
    return { grid: '#f4f7f9', paper: '#ffffff', blueprint: '#185b88', sunset: '#e8d1bd', night: '#122b49' }[name] || '#f4f7f9';
  }

  function previewSvg(design, index) {
    const clean = sanitizeState(design);
    const line = clean.background === 'grid' ? `<path d="M0 104H800M0 208H800M0 312H800M0 416H800M160 0V520M320 0V520M480 0V520M640 0V520" stroke="#cdd8e0" stroke-width="2" opacity=".55"/>` : '';
    const shapes = clean.shapes.map(shape => {
      const cx = shape.x + shape.w / 2;
      const cy = shape.y + shape.h / 2;
      const transform = shape.rotation ? ` transform="rotate(${shape.rotation} ${cx} ${cy})"` : '';
      if (shape.type === 'circle') return `<ellipse cx="${cx}" cy="${cy}" rx="${shape.w / 2}" ry="${shape.h / 2}" fill="${esc(shape.fill)}"${transform}/>`;
      if (shape.type === 'triangle') return `<polygon points="${cx},${shape.y} ${shape.x + shape.w},${shape.y + shape.h} ${shape.x},${shape.y + shape.h}" fill="${esc(shape.fill)}"${transform}/>`;
      return `<rect x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}" fill="${esc(shape.fill)}"${transform}/>`;
    }).join('');
    return `<svg viewBox="0 0 800 520" role="img" aria-label="Preview of ${esc(clean.title || `community design ${index + 1}`)}"><rect width="800" height="520" fill="${previewBackground(clean.background)}"/>${line}${shapes}</svg>`;
  }

  async function loadShowcase() {
    const target = document.getElementById('design-showcase');
    if (!target) return;
    try {
      const response = await fetch('data/designs.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load showcase');
      const data = await response.json();
      const entries = (Array.isArray(data) ? data : [])
        .filter(entry => entry && entry.published !== false && entry.design_code)
        .map(entry => ({ ...entry, design: decodeState(entry.design_code) }))
        .filter(entry => entry.design)
        .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
      if (!entries.length) {
        target.innerHTML = '<div class="empty-state">No community designs have been published yet. Create the first one and submit its share code to chapter leadership.</div>';
        return;
      }
      target.innerHTML = entries.map((entry, index) => {
        const title = entry.title || entry.design.title || 'Untitled building';
        const designer = entry.designer || entry.design.designer || 'Anonymous designer';
        const href = `designer.html#design=${encodeURIComponent(entry.design_code)}`;
        return `<article class="design-gallery-card">
          <div class="design-gallery-preview">${previewSvg(entry.design, index)}</div>
          <div class="design-gallery-body">
            ${entry.featured ? '<span class="design-gallery-badge">Featured design</span>' : ''}
            <h3>${esc(title)}</h3>
            <p class="design-gallery-author">by ${esc(designer)}</p>
            <a class="button button-outline" href="${esc(href)}">View / remix →</a>
          </div>
        </article>`;
      }).join('');
    } catch (error) {
      console.error(error);
      target.innerHTML = '<div class="empty-state">Community designs could not be loaded.</div>';
    }
  }

  async function loadContactEmail() {
    try {
      const response = await fetch('data/site.json', { cache: 'no-store' });
      if (!response.ok) return;
      const site = await response.json();
      const email = String(site?.contact_email || '').trim();
      if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && !/example\./i.test(email)) contactEmail = email;
    } catch {}
  }

  document.querySelectorAll('[data-add-shape]').forEach(button => button.addEventListener('click', () => addShape(button.dataset.addShape)));
  backgroundSelect?.addEventListener('change', () => { state.background = VALID_BACKGROUNDS.has(backgroundSelect.value) ? backgroundSelect.value : 'grid'; render(); });
  colorInput?.addEventListener('input', () => updateSelected({ fill: colorInput.value }));
  widthInput?.addEventListener('input', () => updateSelected({ w: Number(widthInput.value) }));
  heightInput?.addEventListener('input', () => updateSelected({ h: Number(heightInput.value) }));
  rotationInput?.addEventListener('input', () => updateSelected({ rotation: Number(rotationInput.value) }));
  controls.back?.addEventListener('click', () => moveLayer('back'));
  controls.front?.addEventListener('click', () => moveLayer('front'));
  controls.duplicate?.addEventListener('click', duplicateSelected);
  controls.delete?.addEventListener('click', deleteSelected);

  svg.addEventListener('pointerdown', event => {
    const target = event.target.closest?.('[data-shape-id]');
    if (!target) {
      selectedId = '';
      render();
      return;
    }
    const shape = state.shapes.find(item => item.id === target.dataset.shapeId);
    if (!shape) return;
    selectedId = shape.id;
    const point = svgPoint(event);
    drag = { pointerId: event.pointerId, offsetX: point.x - shape.x, offsetY: point.y - shape.y };
    try { svg.setPointerCapture(event.pointerId); } catch {}
    render();
    event.preventDefault();
  });
  svg.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const shape = selectedShape();
    if (!shape) return;
    const point = svgPoint(event);
    shape.x = clamp(point.x - drag.offsetX, 0, 800 - shape.w);
    shape.y = clamp(point.y - drag.offsetY, 0, 520 - shape.h);
    render();
  });
  const endDrag = event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
    try { svg.releasePointerCapture(event.pointerId); } catch {}
  };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('keydown', event => {
    const shape = selectedShape();
    if (!shape) return;
    const distance = event.shiftKey ? 10 : 3;
    if (event.key === 'ArrowLeft') shape.x = clamp(shape.x - distance, 0, 800 - shape.w);
    else if (event.key === 'ArrowRight') shape.x = clamp(shape.x + distance, 0, 800 - shape.w);
    else if (event.key === 'ArrowUp') shape.y = clamp(shape.y - distance, 0, 520 - shape.h);
    else if (event.key === 'ArrowDown') shape.y = clamp(shape.y + distance, 0, 520 - shape.h);
    else if (event.key === 'Delete' || event.key === 'Backspace') { deleteSelected(); event.preventDefault(); return; }
    else return;
    render();
    event.preventDefault();
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

  const hashMatch = window.location.hash.match(/^#design=([A-Za-z0-9_-]+)$/);
  if (hashMatch) {
    const shared = decodeState(hashMatch[1]);
    if (shared) loadState(shared, 'Shared design loaded. You can remix it.');
    else { render(); setStatus('This shared design link is invalid.'); }
  } else {
    state.shapes = [
      sanitizeShape({ id: uid(), type: 'rect', x: 260, y: 285, w: 280, h: 150, fill: '#00498F', rotation: 0 }),
      sanitizeShape({ id: uid(), type: 'triangle', x: 230, y: 175, w: 340, h: 115, fill: '#193059', rotation: 0 })
    ];
    render();
    setStatus('Starter building loaded. Select a shape or add another.');
  }

  Promise.all([loadShowcase(), loadContactEmail()]).catch(() => {});
})();

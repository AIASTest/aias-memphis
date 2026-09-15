(() => {
  'use strict';

  const config = globalThis.AIASCommunityConfig || null;
  const PARENT_KEY = 'aias-memphis-design-studio-parent-v2';
  const PARENT_META_KEY = 'aias-memphis-design-studio-parent-meta-v2';
  const SUPABASE_VERSION = '2.116.0';
  const $ = id => document.getElementById(id);
  const app = $('designer-app');
  const showcase = $('showcase');
  const actions = document.querySelector('.designer-actions');
  if (!config || !app || !showcase || !actions) return;

  const escapeHTML = value => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  let client = null;
  let serverMode = config.mode === 'moderated' ? 'moderated' : 'auto';
  let userId = '';
  let entries = [];
  let metrics = new Map();
  let myLikes = new Set();
  let myDesigns = new Set();
  let parents = new Map();
  let filter = 'newest';
  let modalReturnFocus = null;
  let turnstilePromise = null;

  function status(message, tone = '') {
    const target = $('community-live-status');
    if (!target) return;
    target.textContent = message;
    target.className = `community-live-status${tone ? ` is-${tone}` : ''}`;
  }

  function prefersReducedMotion() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function safeSessionGet(key) { try { return sessionStorage.getItem(key) || ''; } catch { return ''; } }
  function safeSessionSet(key, value) { try { sessionStorage.setItem(key, value); } catch {} }
  function safeSessionRemove(key) { try { sessionStorage.removeItem(key); } catch {} }

  async function loadScript(src, ready) {
    if (ready?.()) return;
    await new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(script => script.src === src);
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Required community library failed to load.'));
      document.head.appendChild(script);
    });
  }

  function decodeDesign(code = '') {
    try {
      const text = String(code).trim();
      if (!text || text.length > 24000 || !/^[A-Za-z0-9_-]+$/.test(text)) return null;
      const normalized = text.replaceAll('-', '+').replaceAll('_', '/');
      const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      const value = JSON.parse(new TextDecoder().decode(bytes));
      if (!value || !Array.isArray(value.shapes) || value.shapes.length > 60) return null;
      return value;
    } catch {
      return null;
    }
  }

  function shareUrl(code) {
    const url = new URL('designer.html', location.href);
    url.hash = `design=${code}`;
    return url.href;
  }

  function currentDesignCode() {
    const panel = $('share-panel');
    const wasHidden = panel?.hidden;
    $('create-share')?.click();
    const code = String($('design-code')?.value || '').trim();
    if (panel && wasHidden) panel.hidden = true;
    return code;
  }

  function svgShape(shape) {
    const x = Number(shape.x) || 0, y = Number(shape.y) || 0;
    const w = Math.max(1, Number(shape.w) || 1), h = Math.max(1, Number(shape.h) || 1);
    const fill = /^#[0-9a-f]{6}$/i.test(String(shape.fill || '')) ? shape.fill : '#00498F';
    const opacity = Math.max(.2, Math.min(1, (Number(shape.opacity) || 100) / 100));
    const rotation = Math.max(-180, Math.min(180, Number(shape.rotation) || 0));
    const cx = x + w / 2, cy = y + h / 2;
    const transform = rotation ? ` transform="rotate(${rotation} ${cx} ${cy})"` : '';
    if (shape.type === 'circle') return `<ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" opacity="${opacity}"${transform}/>`;
    if (shape.type === 'triangle') return `<polygon points="${cx},${y} ${x + w},${y + h} ${x},${y + h}" fill="${fill}" opacity="${opacity}"${transform}/>`;
    if (shape.type === 'arch') {
      const r = Math.min(w / 2, h * .42);
      return `<path d="M${x},${y + h} V${y + r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h} Z" fill="${fill}" opacity="${opacity}"${transform}/>`;
    }
    if (shape.type === 'tree') return `<g${transform}><rect x="${cx - w * .08}" y="${y + h * .56}" width="${w * .16}" height="${h * .44}" fill="#7A5237" opacity="${opacity}"/><ellipse cx="${cx}" cy="${y + h * .34}" rx="${w * .46}" ry="${h * .34}" fill="${fill}" opacity="${opacity}"/></g>`;
    if (shape.type === 'window' && shape.variant === 'lit') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#FFD86A" opacity="${opacity}"${transform}/>`;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${shape.type === 'door' ? 2 : 1}" fill="${fill}" opacity="${opacity}"${transform}/>`;
  }

  function preview(code) {
    const design = decodeDesign(code);
    if (!design) return '<div class="community-preview-invalid">Preview unavailable</div>';
    const backgrounds = { grid:'#F4F7F9',paper:'#fff',blueprint:'#185B88',river:'#DAE9EF',lawn:'#E7EEE1',sunset:'#E8D1BD',night:'#122B49' };
    const background = backgrounds[design.background] || backgrounds.grid;
    const grid = design.background === 'grid' ? '<path d="M0 104H800M0 208H800M0 312H800M0 416H800M160 0V520M320 0V520M480 0V520M640 0V520" stroke="#cdd8e0" stroke-width="2" opacity=".55"/>' : '';
    return `<svg viewBox="0 0 800 520" role="img" aria-label="Community building preview"><rect width="800" height="520" fill="${background}"/>${grid}${design.shapes.slice(0,60).map(svgShape).join('')}</svg>`;
  }

  function injectUI() {
    if (!$('publish-community-design')) {
      const publish = document.createElement('button');
      publish.type = 'button';
      publish.id = 'publish-community-design';
      publish.className = 'button button-primary community-publish-button';
      publish.textContent = 'Publish to Community';
      publish.addEventListener('click', openPublishModal);
      actions.insertBefore(publish, actions.querySelector('#clear-design'));
    }

    if (!$('live-community')) {
      const section = document.createElement('section');
      section.className = 'section community-live-section';
      section.id = 'live-community';
      section.innerHTML = `
        <div class="container">
          <div class="community-live-head">
            <div>
              <p class="eyebrow">Live community</p>
              <h2>Build something. Put it on the wall. Remix what comes back.</h2>
              <p class="muted">Student designs publish here without organizer copy/paste. Remix credit follows the design so ideas can branch instead of disappearing.</p>
            </div>
            <div class="community-live-controls" role="group" aria-label="Live community sort">
              <button type="button" class="filter-chip is-active" data-live-filter="newest">Newest</button>
              <button type="button" class="filter-chip" data-live-filter="liked">Most liked</button>
              <button type="button" class="filter-chip" data-live-filter="remixed">Most remixed</button>
              <button type="button" class="filter-chip" data-live-filter="mine">Mine</button>
              <button type="button" class="button button-outline" id="random-live-remix">Remix a random design</button>
            </div>
          </div>
          <p id="community-live-status" class="community-live-status" role="status">Loading community wall…</p>
          <div id="community-live-gallery" class="designer-gallery community-live-gallery"></div>
        </div>`;
      showcase.parentNode.insertBefore(section, showcase);
      section.querySelectorAll('[data-live-filter]').forEach(button => button.addEventListener('click', async () => {
        filter = button.dataset.liveFilter || 'newest';
        section.querySelectorAll('[data-live-filter]').forEach(item => item.classList.toggle('is-active', item === button));
        if (filter === 'mine') await ensureSession({ allowCreate: false });
        render();
      }));
      $('random-live-remix')?.addEventListener('click', randomRemix);
    }
  }

  function modalShell() {
    let overlay = $('community-modal');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'community-modal';
    overlay.className = 'community-modal-backdrop';
    overlay.hidden = true;
    overlay.innerHTML = '<div class="community-modal" role="dialog" aria-modal="true" aria-labelledby="community-modal-title"><button type="button" class="community-modal-close" aria-label="Close">×</button><div id="community-modal-content"></div></div>';
    document.body.appendChild(overlay);
    const close = () => {
      overlay.hidden = true;
      document.body.classList.remove('community-modal-open');
      modalReturnFocus?.focus?.({ preventScroll: true });
    };
    overlay.querySelector('.community-modal-close')?.addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !overlay.hidden) close(); });
    return overlay;
  }

  function showModal(html, returnFocus = document.activeElement) {
    const overlay = modalShell();
    modalReturnFocus = returnFocus;
    const target = $('community-modal-content');
    if (target) target.innerHTML = html;
    overlay.hidden = false;
    document.body.classList.add('community-modal-open');
    requestAnimationFrame(() => overlay.querySelector('input,select,textarea,button:not(.community-modal-close)')?.focus());
    return overlay;
  }

  function closeModal() {
    const overlay = $('community-modal');
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove('community-modal-open');
    modalReturnFocus?.focus?.({ preventScroll: true });
  }

  async function loadTurnstile() {
    await loadScript('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', () => Boolean(globalThis.turnstile?.render));
  }

  async function getCaptchaToken() {
    if (config.captcha_provider !== 'turnstile') return '';
    const siteKey = String(config.captcha_site_key || '').trim();
    if (!siteKey) throw new Error('Turnstile is enabled but the public site key is missing.');
    await loadTurnstile();
    if (turnstilePromise) return turnstilePromise;
    turnstilePromise = new Promise((resolve, reject) => {
      showModal(`
        <p class="eyebrow">One quick check</p>
        <h2 id="community-modal-title">Confirm you are a person.</h2>
        <p class="muted">This check protects the student gallery from automated spam. It does not create an AIAS account.</p>
        <div id="community-captcha-widget"></div>`);
      try {
        globalThis.turnstile.render('#community-captcha-widget', {
          sitekey: siteKey,
          callback: token => { turnstilePromise = null; closeModal(); resolve(token); },
          'error-callback': () => { turnstilePromise = null; reject(new Error('Human verification failed. Please try again.')); },
          'expired-callback': () => { turnstilePromise = null; reject(new Error('Human verification expired. Please try again.')); }
        });
      } catch (error) {
        turnstilePromise = null;
        reject(error);
      }
    });
    return turnstilePromise;
  }

  async function ensureSession({ allowCreate = true } = {}) {
    if (!client) return false;
    const current = await client.auth.getSession();
    if (current.data?.session?.user?.id) {
      userId = current.data.session.user.id;
      await loadMine();
      return true;
    }
    if (!allowCreate) return false;
    const captchaToken = await getCaptchaToken();
    const credentials = captchaToken ? { options: { captchaToken } } : undefined;
    const result = await client.auth.signInAnonymously(credentials);
    if (result.error) throw result.error;
    userId = result.data?.session?.user?.id || '';
    if (!userId) throw new Error('Anonymous community session was not created.');
    await loadMine();
    return true;
  }

  async function loadMine() {
    myLikes = new Set();
    myDesigns = new Set();
    if (!userId) return;
    const [likesResult, designsResult] = await Promise.all([
      config.allow_likes ? client.from('community_design_likes').select('design_id').eq('user_id', userId) : Promise.resolve({ data: [] }),
      client.from('community_designs').select('id').eq('owner_id', userId).eq('status', 'published')
    ]);
    (Array.isArray(likesResult.data) ? likesResult.data : []).forEach(row => myLikes.add(row.design_id));
    (Array.isArray(designsResult.data) ? designsResult.data : []).forEach(row => myDesigns.add(row.id));
  }

  async function loadServerMode() {
    const { data } = await client.from('community_settings').select('mode').eq('id', true).maybeSingle();
    if (data?.mode === 'auto' || data?.mode === 'moderated') serverMode = data.mode;
  }

  async function loadMetrics() {
    metrics = new Map();
    const { data, error } = await client.rpc('get_community_design_metrics');
    if (error) return;
    (Array.isArray(data) ? data : []).forEach(row => metrics.set(row.design_id, {
      likes: Number(row.like_count) || 0,
      remixes: Number(row.remix_count) || 0
    }));
  }

  async function loadParents() {
    parents = new Map();
    const ids = [...new Set(entries.map(entry => entry.parent_id).filter(Boolean))];
    if (!ids.length) return;
    const { data } = await client.from('community_designs').select('id,title,designer').in('id', ids).eq('status', 'published');
    (Array.isArray(data) ? data : []).forEach(row => parents.set(row.id, row));
  }

  async function refresh() {
    status('Refreshing community wall…');
    const limit = Math.max(12, Math.min(100, Number(config.feed_limit) || 60));
    const { data, error } = await client.from('community_designs')
      .select('id,title,designer,caption,design_code,featured,parent_id,root_id,remix_depth,remix_note,created_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      status('Live community is temporarily unavailable. The curated showcase below still works.', 'warning');
      return;
    }
    entries = (Array.isArray(data) ? data : []).filter(item => decodeDesign(item.design_code));
    await Promise.all([loadMetrics(), loadParents()]);
    const session = await client.auth.getSession();
    if (session.data?.session?.user?.id) {
      userId = session.data.session.user.id;
      await loadMine();
    }
    render();
    status(entries.length ? `${entries.length} live design${entries.length === 1 ? '' : 's'} on the wall.` : 'No live designs yet. The first publish starts the wall.');
  }

  function sortedEntries() {
    let list = [...entries];
    if (filter === 'mine') list = userId ? list.filter(entry => myDesigns.has(entry.id)) : [];
    if (filter === 'liked') list.sort((a, b) => (metrics.get(b.id)?.likes || 0) - (metrics.get(a.id)?.likes || 0) || new Date(b.created_at) - new Date(a.created_at));
    else if (filter === 'remixed') list.sort((a, b) => (metrics.get(b.id)?.remixes || 0) - (metrics.get(a.id)?.remixes || 0) || new Date(b.created_at) - new Date(a.created_at));
    else list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return list;
  }

  function render() {
    const target = $('community-live-gallery');
    if (!target) return;
    const list = sortedEntries();
    if (!list.length) {
      const message = filter === 'mine' && !userId ? 'No local community identity exists in this browser yet.' : filter === 'mine' ? 'You have not published anything from this browser yet.' : 'Nothing here yet.';
      target.innerHTML = `<div class="community-empty"><strong>${escapeHTML(message)}</strong><p class="muted">Build something worth keeping, then let somebody else push it in a new direction.</p></div>`;
      return;
    }

    target.innerHTML = list.map(entry => {
      const mine = myDesigns.has(entry.id);
      const liked = myLikes.has(entry.id);
      const stat = metrics.get(entry.id) || { likes: 0, remixes: 0 };
      const parent = entry.parent_id ? parents.get(entry.parent_id) : null;
      const date = new Date(entry.created_at);
      const dateText = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month:'short', day:'numeric' });
      const lineage = parent ? `<p class="community-lineage">Remixed from <strong>${escapeHTML(parent.title)}</strong> by ${escapeHTML(parent.designer)}${entry.remix_note ? ` · “${escapeHTML(entry.remix_note)}”` : ''}</p>` : '<p class="community-lineage">Original design</p>';
      return `<article class="design-gallery-card community-card" data-community-id="${escapeHTML(entry.id)}">
        <div class="design-gallery-preview">${preview(entry.design_code)}</div>
        <div class="design-gallery-body">
          <div class="community-card-meta"><span>${escapeHTML(dateText)}</span>${entry.remix_depth ? `<span>Remix ${entry.remix_depth} deep</span>` : '<span>Original</span>'}${mine ? '<span class="community-mine-badge">Yours</span>' : ''}</div>
          <h3>${escapeHTML(entry.title)}</h3>
          <p class="design-gallery-author">by ${escapeHTML(entry.designer)}</p>
          ${entry.caption ? `<p class="community-caption">${escapeHTML(entry.caption)}</p>` : ''}
          ${lineage}
          <div class="community-metrics"><span>${stat.likes} like${stat.likes === 1 ? '' : 's'}</span><span>${stat.remixes} remix${stat.remixes === 1 ? '' : 'es'}</span></div>
          <div class="design-gallery-actions community-card-actions">
            <button type="button" class="button button-primary" data-community-remix="${escapeHTML(entry.id)}">Remix this</button>
            ${config.allow_likes ? `<button type="button" class="favorite-button${liked ? ' is-favorite' : ''}" data-community-like="${escapeHTML(entry.id)}" aria-pressed="${liked}">${liked ? '♥ Liked' : '♡ Like'}</button>` : ''}
            <button type="button" class="favorite-button" data-community-share="${escapeHTML(entry.id)}">Share</button>
            ${mine ? `<button type="button" class="favorite-button danger-control" data-community-delete="${escapeHTML(entry.id)}">Remove mine</button>` : (config.allow_reports ? `<button type="button" class="favorite-button" data-community-report="${escapeHTML(entry.id)}">Report</button>` : '')}
          </div>
        </div>
      </article>`;
    }).join('');
    bindCards();
  }

  function entryById(id) { return entries.find(entry => entry.id === id); }

  function startRemix(entry) {
    if (!entry) return;
    safeSessionSet(PARENT_KEY, entry.id);
    safeSessionSet(PARENT_META_KEY, JSON.stringify({ title: entry.title, designer: entry.designer }));
    location.hash = `design=${entry.design_code}`;
    location.reload();
  }

  function bindCards() {
    document.querySelectorAll('[data-community-remix]').forEach(button => button.addEventListener('click', () => startRemix(entryById(button.dataset.communityRemix))));
    document.querySelectorAll('[data-community-like]').forEach(button => button.addEventListener('click', () => toggleLike(button.dataset.communityLike)));
    document.querySelectorAll('[data-community-share]').forEach(button => button.addEventListener('click', async () => {
      const entry = entryById(button.dataset.communityShare);
      if (!entry) return;
      const ok = await copyText(shareUrl(entry.design_code));
      button.textContent = ok ? 'Copied!' : 'Copy failed';
      setTimeout(() => { if (button.isConnected) button.textContent = 'Share'; }, 1200);
    }));
    document.querySelectorAll('[data-community-delete]').forEach(button => button.addEventListener('click', () => removeMine(button.dataset.communityDelete)));
    document.querySelectorAll('[data-community-report]').forEach(button => button.addEventListener('click', () => reportDesign(button.dataset.communityReport)));
  }

  async function openPublishModal() {
    try {
      if (!await ensureSession()) return;
    } catch (error) {
      return status(humanError(error), 'error');
    }
    const code = currentDesignCode();
    if (!decodeDesign(code)) return status('This design could not be prepared for publishing. Create a fresh share link and try again.', 'error');
    const title = String($('design-title')?.value || '').trim();
    const designer = String($('design-author')?.value || '').trim();
    const parentId = safeSessionGet(PARENT_KEY);
    let parentMeta = null;
    try { parentMeta = JSON.parse(safeSessionGet(PARENT_META_KEY) || 'null'); } catch {}
    const remixBlock = /^[0-9a-f-]{36}$/i.test(parentId) ? `
      <div class="community-remix-credit"><strong>Remix credit</strong><p>This design started from ${escapeHTML(parentMeta?.title || 'a community design')} by ${escapeHTML(parentMeta?.designer || 'another designer')}.</p>
      <label class="designer-field">What did you keep or change? <span class="muted">optional</span><input id="community-publish-remix-note" maxlength="180" placeholder="e.g. Kept the arch rhythm; opened the roof into a terrace"></label></div>` : '';
    const overlay = showModal(`
      <p class="eyebrow">Publish to community</p>
      <h2 id="community-modal-title">Put this building on the wall.</h2>
      <p class="muted">Your public name can be a chosen credit or alias. This browser controls removal unless its site data is cleared.</p>
      ${remixBlock}
      <form id="community-publish-form">
        <label class="designer-field">Building name<input id="community-publish-title" maxlength="80" required value="${escapeHTML(title)}" placeholder="Give the building a name"></label>
        <label class="designer-field">Public designer credit<input id="community-publish-designer" maxlength="80" required value="${escapeHTML(designer)}" placeholder="Your name or chosen public credit"></label>
        <label class="designer-field">One-line idea <span class="muted">optional</span><textarea id="community-publish-caption" maxlength="280" rows="3" placeholder="What were you trying to do?"></textarea></label>
        <label class="community-rules-check"><input id="community-publish-rules" type="checkbox" required> <span>I made or remixed this design and can publish the public credit/text shown here.</span></label>
        <div class="button-row"><button class="button button-primary" type="submit">${serverMode === 'moderated' ? 'Submit for review' : 'Publish now'}</button><span id="community-publish-progress" class="muted small-text"></span></div>
      </form>`);

    $('community-publish-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const building = String($('community-publish-title')?.value || '').trim().slice(0, 80);
      const author = String($('community-publish-designer')?.value || '').trim().slice(0, 80);
      const caption = String($('community-publish-caption')?.value || '').trim().slice(0, 280);
      const remixNote = String($('community-publish-remix-note')?.value || '').trim().slice(0, 180);
      if (!building || !author || !$('community-publish-rules')?.checked) return;
      const progress = $('community-publish-progress');
      if (progress) progress.textContent = 'Publishing…';
      const row = {
        owner_id: userId,
        title: building,
        designer: author,
        caption,
        design_code: code,
        parent_id: /^[0-9a-f-]{36}$/i.test(parentId) ? parentId : null,
        remix_note: remixNote
      };
      const { data, error } = await client.from('community_designs').insert(row).select('id,status,parent_id,root_id,remix_depth').single();
      if (error) {
        if (progress) progress.textContent = humanError(error);
        return;
      }
      safeSessionRemove(PARENT_KEY);
      safeSessionRemove(PARENT_META_KEY);
      closeModal();
      if (data?.status === 'pending') status('Submitted. It will appear after chapter review.', 'success');
      else {
        status('Published. Your design is now live on the community wall.', 'success');
        await refresh();
        $('live-community')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      }
    });
  }

  async function toggleLike(id) {
    if (!id) return;
    try { if (!await ensureSession()) return; } catch (error) { return status(humanError(error), 'error'); }
    const current = metrics.get(id) || { likes: 0, remixes: 0 };
    if (myLikes.has(id)) {
      const { error } = await client.from('community_design_likes').delete().eq('design_id', id).eq('user_id', userId);
      if (!error) { myLikes.delete(id); metrics.set(id, { ...current, likes: Math.max(0, current.likes - 1) }); render(); }
    } else {
      const { error } = await client.from('community_design_likes').insert({ design_id: id, user_id: userId });
      if (!error) { myLikes.add(id); metrics.set(id, { ...current, likes: current.likes + 1 }); render(); }
    }
  }

  async function removeMine(id) {
    try { if (!await ensureSession({ allowCreate: false })) return; } catch { return; }
    const entry = entryById(id);
    if (!entry || !myDesigns.has(id) || !confirm(`Remove “${entry.title}” from the live community?`)) return;
    const { error } = await client.from('community_designs').delete().eq('id', id).eq('owner_id', userId);
    if (error) return status(humanError(error), 'error');
    entries = entries.filter(item => item.id !== id);
    myDesigns.delete(id);
    render();
    status('Your design was removed from the live community.', 'success');
  }

  async function reportDesign(id) {
    const entry = entryById(id);
    if (!entry) return;
    try { if (!await ensureSession()) return; } catch (error) { return status(humanError(error), 'error'); }
    const overlay = showModal(`
      <p class="eyebrow">Report community design</p>
      <h2 id="community-modal-title">Flag “${escapeHTML(entry.title)}” for chapter review.</h2>
      <form id="community-report-form">
        <label class="designer-field">Reason
          <select id="community-report-category" required>
            <option value="">Choose a reason</option>
            <option value="harassment">Harassment or bullying</option>
            <option value="hate">Hate or discriminatory content</option>
            <option value="sexual">Sexual or inappropriate content</option>
            <option value="impersonation">Impersonation</option>
            <option value="personal_info">Personal information</option>
            <option value="spam">Spam</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label class="designer-field">Optional details<textarea id="community-report-details" maxlength="300" rows="3" placeholder="Give leadership enough context to review it."></textarea></label>
        <div class="button-row"><button class="button button-primary" type="submit">Send report</button><span id="community-report-progress" class="muted small-text"></span></div>
      </form>`);
    $('community-report-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const category = String($('community-report-category')?.value || '');
      const details = String($('community-report-details')?.value || '').trim().slice(0, 300);
      if (!category) return;
      const labels = { harassment:'Harassment or bullying', hate:'Hate or discriminatory content', sexual:'Sexual or inappropriate content', impersonation:'Impersonation', personal_info:'Personal information', spam:'Spam', other:'Other' };
      const reason = `${labels[category] || 'Other'}${details ? `: ${details}` : ''}`.slice(0, 500);
      const progress = $('community-report-progress');
      if (progress) progress.textContent = 'Sending…';
      const { error } = await client.from('community_design_reports').insert({ design_id: id, reporter_id: userId, category, details, reason });
      if (error) {
        if (progress) progress.textContent = error.code === '23505' ? 'You already reported this design.' : humanError(error);
        return;
      }
      closeModal();
      status('Report sent to chapter leadership for review.', 'success');
    });
  }

  function randomRemix() {
    if (!entries.length) return status('There are no live designs to remix yet.', 'warning');
    startRemix(entries[Math.floor(Math.random() * entries.length)]);
  }

  async function copyText(text) {
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } } catch {}
    const area = document.createElement('textarea');
    area.value = text;
    area.readOnly = true;
    area.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    area.remove();
    return ok;
  }

  function humanError(error) {
    const text = String(error?.message || 'The community action failed. Please try again.');
    if (/limit|rate/i.test(text)) return 'You have reached the community rate limit for now. Try again later.';
    if (/captcha|verification/i.test(text)) return 'Human verification could not be completed. Please try again.';
    if (/permission|policy|42501/i.test(text)) return 'The community database rejected this action. Leadership may need to rerun the current setup SQL.';
    return text.slice(0, 180);
  }

  async function init() {
    injectUI();
    try {
      await loadScript(`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${SUPABASE_VERSION}/dist/umd/supabase.min.js`, () => Boolean(globalThis.supabase?.createClient));
      client = globalThis.supabase.createClient(config.supabase_url, config.supabase_publishable_key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
      await loadServerMode();
      await refresh();
    } catch (error) {
      status(`Live community could not connect: ${humanError(error)} The local game and curated showcase still work.`, 'warning');
      const publish = $('publish-community-design');
      if (publish) publish.disabled = true;
    }
  }

  init();
})();

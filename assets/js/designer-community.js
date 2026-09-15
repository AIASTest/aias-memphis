(() => {
  'use strict';

  const CONFIG_URL = 'data/community-backend.json';
  const PARENT_KEY = 'aias-memphis-design-studio-parent-v1';
  const $ = id => document.getElementById(id);
  const escapeHTML = value => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  const app = $('designer-app');
  const showcase = $('showcase');
  const actions = document.querySelector('.designer-actions');
  if (!app || !showcase || !actions) return;

  let config = null;
  let client = null;
  let userId = '';
  let entries = [];
  let likes = new Map();
  let myLikes = new Set();
  let filter = 'newest';
  let loading = false;

  function status(message, tone = '') {
    const target = $('community-live-status');
    if (!target) return;
    target.textContent = message;
    target.className = `community-live-status${tone ? ` is-${tone}` : ''}`;
  }

  function validConfig(value) {
    return Boolean(
      value && value.enabled === true && value.provider === 'supabase' &&
      /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(String(value.supabase_url || '')) &&
      String(value.supabase_publishable_key || '').length > 20
    );
  }

  async function loadScript(src) {
    if (window.supabase?.createClient) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Community library failed to load.'));
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
    const create = $('create-share');
    const code = $('design-code');
    create?.click();
    return String(code?.value || '').trim();
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
    if (!$('publish-community')) {
      const publish = document.createElement('button');
      publish.type = 'button';
      publish.id = 'publish-community';
      publish.className = 'button button-primary community-publish-button';
      publish.textContent = 'Publish to Community';
      publish.addEventListener('click', openPublishModal);
      actions.insertBefore(publish, actions.querySelector('#clear-design'));
    }

    const section = document.createElement('section');
    section.className = 'section community-live-section';
    section.id = 'live-community';
    section.innerHTML = `
      <div class="container">
        <div class="community-live-head">
          <div>
            <p class="eyebrow">Live community</p>
            <h2>Built by students, published by students.</h2>
            <p class="muted">New designs can appear here instantly. Remix one, leave a like, or publish your own without waiting for someone to copy a design code.</p>
          </div>
          <div class="community-live-controls" role="group" aria-label="Live community sort">
            <button type="button" class="filter-chip is-active" data-live-filter="newest">Newest</button>
            <button type="button" class="filter-chip" data-live-filter="liked">Most liked</button>
            <button type="button" class="filter-chip" data-live-filter="mine">Mine</button>
            <button type="button" class="button button-outline" id="random-live-remix">Random remix</button>
          </div>
        </div>
        <p id="community-live-status" class="community-live-status" role="status">Connecting to the live community…</p>
        <div id="community-live-gallery" class="designer-gallery community-live-gallery"></div>
      </div>`;
    showcase.parentNode.insertBefore(section, showcase);

    section.querySelectorAll('[data-live-filter]').forEach(button => button.addEventListener('click', () => {
      filter = button.dataset.liveFilter || 'newest';
      section.querySelectorAll('[data-live-filter]').forEach(item => item.classList.toggle('is-active', item === button));
      render();
    }));
    $('random-live-remix')?.addEventListener('click', randomRemix);
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
    const close = () => { overlay.hidden = true; document.body.classList.remove('community-modal-open'); };
    overlay.querySelector('.community-modal-close')?.addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !overlay.hidden) close(); });
    return overlay;
  }

  function showModal(html) {
    const overlay = modalShell();
    const target = $('community-modal-content');
    if (target) target.innerHTML = html;
    overlay.hidden = false;
    document.body.classList.add('community-modal-open');
    requestAnimationFrame(() => overlay.querySelector('input,textarea,button:not(.community-modal-close)')?.focus());
    return overlay;
  }

  async function openPublishModal() {
    if (!client || !userId) return status('Live publishing is not connected yet. You can still use Create share link.', 'warning');
    const code = currentDesignCode();
    if (!decodeDesign(code)) return status('This design could not be prepared for publishing. Try creating a fresh share link first.', 'error');
    const title = String($('design-title')?.value || '').trim();
    const designer = String($('design-author')?.value || '').trim();
    const overlay = showModal(`
      <p class="eyebrow">Publish to community</p>
      <h2 id="community-modal-title">Put this building on the wall.</h2>
      <p class="muted">You can remove your own post later from this same browser profile. Keep names and captions appropriate for a public university student organization website.</p>
      <form id="community-publish-form">
        <label class="designer-field">Building name<input id="community-publish-title" maxlength="80" required value="${escapeHTML(title)}" placeholder="Give the building a name"></label>
        <label class="designer-field">Designer name<input id="community-publish-designer" maxlength="80" required value="${escapeHTML(designer)}" placeholder="Your name or chosen public credit"></label>
        <label class="designer-field">One-line idea <span class="muted">optional</span><textarea id="community-publish-caption" maxlength="280" rows="3" placeholder="What were you trying to do?"></textarea></label>
        <label class="community-rules-check"><input id="community-publish-rules" type="checkbox" required> <span>I made or remixed this design, I can publish the name/credit shown above, and the text is appropriate for a public gallery.</span></label>
        <div class="button-row"><button class="button button-primary" type="submit">${config.mode === 'moderated' ? 'Submit for review' : 'Publish now'}</button><span id="community-publish-progress" class="muted small-text"></span></div>
      </form>`);
    const form = $('community-publish-form');
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const building = String($('community-publish-title')?.value || '').trim().slice(0,80);
      const author = String($('community-publish-designer')?.value || '').trim().slice(0,80);
      const caption = String($('community-publish-caption')?.value || '').trim().slice(0,280);
      if (!building || !author || !$('community-publish-rules')?.checked) return;
      const progress = $('community-publish-progress');
      if (progress) progress.textContent = 'Publishing…';
      const parentId = safeSessionGet(PARENT_KEY);
      const row = {
        owner_id: userId,
        title: building,
        designer: author,
        caption,
        design_code: code,
        status: config.mode === 'moderated' ? 'pending' : 'published',
        featured: false,
        parent_id: /^[0-9a-f-]{36}$/i.test(parentId) ? parentId : null
      };
      const { data, error } = await client.from('community_designs').insert(row).select('id,status').single();
      if (error) {
        if (progress) progress.textContent = humanError(error);
        return;
      }
      safeSessionRemove(PARENT_KEY);
      overlay.hidden = true;
      document.body.classList.remove('community-modal-open');
      if (config.mode === 'moderated' || data?.status === 'pending') {
        status('Submitted. It will appear after chapter review.', 'success');
      } else {
        status('Published. Your design is now live in the community gallery.', 'success');
        await refresh();
        $('live-community')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      }
    });
  }

  function humanError(error) {
    const text = String(error?.message || 'Publishing failed. Please try again.');
    if (/limit|rate/i.test(text)) return 'You have reached the community posting limit for now. Try again later.';
    if (/permission|policy|42501/i.test(text)) return 'The community database rejected this action. The chapter may need to check its publishing setup.';
    return text.slice(0,180);
  }

  function safeSessionGet(key) { try { return sessionStorage.getItem(key) || ''; } catch { return ''; } }
  function safeSessionSet(key, value) { try { sessionStorage.setItem(key, value); } catch {} }
  function safeSessionRemove(key) { try { sessionStorage.removeItem(key); } catch {} }
  function prefersReducedMotion() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }

  async function refresh() {
    if (!client || loading) return;
    loading = true;
    status('Refreshing community designs…');
    const limit = Math.max(12, Math.min(100, Number(config.feed_limit) || 60));
    const { data, error } = await client.from('community_designs')
      .select('id,owner_id,title,designer,caption,design_code,status,featured,parent_id,created_at')
      .eq('status','published')
      .order('created_at',{ ascending:false })
      .limit(limit);
    if (error) {
      loading = false;
      status('Live community is temporarily unavailable. The curated showcase below still works.', 'warning');
      return;
    }
    entries = Array.isArray(data) ? data.filter(item => decodeDesign(item.design_code)) : [];
    await loadLikes();
    loading = false;
    render();
    status(entries.length ? `${entries.length} live design${entries.length === 1 ? '' : 's'} loaded.` : 'No live designs yet. Be the first to publish one.');
  }

  async function loadLikes() {
    likes = new Map(); myLikes = new Set();
    if (!config.allow_likes || !entries.length) return;
    const ids = entries.map(entry => entry.id);
    const { data } = await client.from('community_design_likes').select('design_id,user_id').in('design_id', ids);
    (Array.isArray(data) ? data : []).forEach(row => {
      likes.set(row.design_id, (likes.get(row.design_id) || 0) + 1);
      if (row.user_id === userId) myLikes.add(row.design_id);
    });
  }

  function sortedEntries() {
    let list = [...entries];
    if (filter === 'mine') list = list.filter(entry => entry.owner_id === userId);
    if (filter === 'liked') list.sort((a,b) => (likes.get(b.id)||0) - (likes.get(a.id)||0) || new Date(b.created_at) - new Date(a.created_at));
    else list.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    return list;
  }

  function render() {
    const target = $('community-live-gallery');
    if (!target) return;
    const list = sortedEntries();
    if (!list.length) {
      target.innerHTML = `<div class="community-empty"><strong>${filter === 'mine' ? 'You have not published anything yet.' : 'Nothing here yet.'}</strong><p class="muted">Build something strange enough that somebody else wants to remix it.</p></div>`;
      return;
    }
    target.innerHTML = list.map(entry => {
      const mine = entry.owner_id === userId;
      const liked = myLikes.has(entry.id);
      const count = likes.get(entry.id) || 0;
      const date = new Date(entry.created_at);
      const dateText = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined,{month:'short',day:'numeric'});
      return `<article class="design-gallery-card community-card" data-community-id="${escapeHTML(entry.id)}">
        <div class="design-gallery-preview">${preview(entry.design_code)}</div>
        <div class="design-gallery-body">
          <div class="community-card-meta"><span>${dateText}</span>${entry.parent_id ? '<span>Remix</span>' : '<span>Original</span>'}${mine ? '<span class="community-mine-badge">Yours</span>' : ''}</div>
          <h3>${escapeHTML(entry.title)}</h3>
          <p class="design-gallery-author">by ${escapeHTML(entry.designer)}</p>
          ${entry.caption ? `<p class="community-caption">${escapeHTML(entry.caption)}</p>` : ''}
          <div class="design-gallery-actions community-card-actions">
            <button type="button" class="button button-primary" data-community-remix="${escapeHTML(entry.id)}">Remix</button>
            ${config.allow_likes ? `<button type="button" class="favorite-button${liked ? ' is-favorite' : ''}" data-community-like="${escapeHTML(entry.id)}" aria-pressed="${liked}">${liked ? '♥' : '♡'} ${count}</button>` : ''}
            <button type="button" class="favorite-button" data-community-share="${escapeHTML(entry.id)}">Share</button>
            ${mine ? `<button type="button" class="favorite-button danger-control" data-community-delete="${escapeHTML(entry.id)}">Remove mine</button>` : (config.allow_reports ? `<button type="button" class="favorite-button" data-community-report="${escapeHTML(entry.id)}">Report</button>` : '')}
          </div>
        </div>
      </article>`;
    }).join('');
    bindCards();
  }

  function entryById(id) { return entries.find(entry => entry.id === id); }

  function bindCards() {
    document.querySelectorAll('[data-community-remix]').forEach(button => button.addEventListener('click', () => {
      const entry = entryById(button.dataset.communityRemix);
      if (!entry) return;
      safeSessionSet(PARENT_KEY, entry.id);
      location.hash = `design=${entry.design_code}`;
      location.reload();
    }));
    document.querySelectorAll('[data-community-like]').forEach(button => button.addEventListener('click', () => toggleLike(button.dataset.communityLike)));
    document.querySelectorAll('[data-community-share]').forEach(button => button.addEventListener('click', async () => {
      const entry = entryById(button.dataset.communityShare); if (!entry) return;
      const ok = await copyText(shareUrl(entry.design_code));
      button.textContent = ok ? 'Copied!' : 'Copy failed';
      setTimeout(() => { button.textContent = 'Share'; }, 1200);
    }));
    document.querySelectorAll('[data-community-delete]').forEach(button => button.addEventListener('click', () => removeMine(button.dataset.communityDelete)));
    document.querySelectorAll('[data-community-report]').forEach(button => button.addEventListener('click', () => reportDesign(button.dataset.communityReport)));
  }

  async function toggleLike(id) {
    if (!client || !userId || !id) return;
    if (myLikes.has(id)) {
      const { error } = await client.from('community_design_likes').delete().eq('design_id',id).eq('user_id',userId);
      if (!error) { myLikes.delete(id); likes.set(id, Math.max(0,(likes.get(id)||1)-1)); render(); }
    } else {
      const { error } = await client.from('community_design_likes').insert({ design_id:id, user_id:userId });
      if (!error) { myLikes.add(id); likes.set(id,(likes.get(id)||0)+1); render(); }
    }
  }

  async function removeMine(id) {
    const entry = entryById(id);
    if (!entry || entry.owner_id !== userId || !confirm(`Remove “${entry.title}” from the live community?`)) return;
    const { error } = await client.from('community_designs').delete().eq('id',id).eq('owner_id',userId);
    if (error) return status(humanError(error),'error');
    entries = entries.filter(item => item.id !== id);
    render(); status('Your design was removed from the live community.','success');
  }

  async function reportDesign(id) {
    const entry = entryById(id); if (!entry) return;
    const overlay = showModal(`
      <p class="eyebrow">Report community design</p>
      <h2 id="community-modal-title">Flag “${escapeHTML(entry.title)}” for chapter review.</h2>
      <p class="muted">Use this for inappropriate names/captions, impersonation, harassment, or other content that should not be public.</p>
      <form id="community-report-form"><label class="designer-field">Reason<textarea id="community-report-reason" minlength="5" maxlength="500" rows="4" required placeholder="Briefly explain the problem"></textarea></label><div class="button-row"><button class="button button-primary" type="submit">Send report</button><span id="community-report-progress" class="muted small-text"></span></div></form>`);
    $('community-report-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const reason = String($('community-report-reason')?.value || '').trim().slice(0,500);
      if (reason.length < 5) return;
      const progress = $('community-report-progress'); if (progress) progress.textContent = 'Sending…';
      const { error } = await client.from('community_design_reports').insert({ design_id:id, reporter_id:userId, reason });
      if (error) { if (progress) progress.textContent = /duplicate/i.test(error.message || '') ? 'You already reported this design.' : humanError(error); return; }
      overlay.hidden = true; document.body.classList.remove('community-modal-open');
      status('Report sent to the chapter. Thanks for helping keep the gallery usable.','success');
    });
  }

  function randomRemix() {
    if (!entries.length) return status('There are no live designs to remix yet.','warning');
    const entry = entries[Math.floor(Math.random()*entries.length)];
    safeSessionSet(PARENT_KEY, entry.id);
    location.hash = `design=${entry.design_code}`;
    location.reload();
  }

  async function copyText(text) {
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } } catch {}
    const area = document.createElement('textarea'); area.value = text; area.readOnly = true; area.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(area); area.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {} area.remove(); return ok;
  }

  async function initBackend() {
    injectUI();
    try {
      const response = await fetch(CONFIG_URL,{cache:'no-store'});
      config = response.ok ? await response.json() : null;
    } catch { config = null; }
    if (!validConfig(config)) {
      $('live-community')?.setAttribute('hidden','');
      const publish = $('publish-community');
      if (publish) {
        publish.classList.remove('button-primary'); publish.classList.add('button-outline');
        publish.textContent = 'Publish to Community';
        publish.addEventListener('click', () => {
          $('create-share')?.click();
          $('share-panel')?.scrollIntoView({behavior:prefersReducedMotion()?'auto':'smooth',block:'nearest'});
        }, { once:true, capture:true });
      }
      return;
    }
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js');
      client = window.supabase.createClient(config.supabase_url, config.supabase_publishable_key, { auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:false } });
      let { data } = await client.auth.getSession();
      if (!data?.session) {
        const result = await client.auth.signInAnonymously();
        if (result.error) throw result.error;
        data = { session: result.data.session };
      }
      userId = data?.session?.user?.id || '';
      if (!userId) throw new Error('Anonymous community session was not created.');
      await refresh();
    } catch (error) {
      status(`Live community could not connect: ${humanError(error)}`,'warning');
      const publish = $('publish-community'); if (publish) publish.disabled = true;
    }
  }

  initBackend();
})();

(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const app = $('designer-app');
  const actions = document.querySelector('.designer-actions');
  if (!app || !actions) return;

  const KEY = 'aias-memphis-design-studio-sketchbook-v1';
  const MAX = 12;
  let entries = load();

  function escapeHTML(value) {
    return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  }

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(item => item && /^[A-Za-z0-9_-]+$/.test(String(item.code || ''))).slice(0,MAX) : [];
    } catch { return []; }
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(entries.slice(0,MAX))); } catch {}
  }

  function decode(code) {
    try {
      const normalized=String(code).replaceAll('-','+').replaceAll('_','/');
      const padded=normalized+'='.repeat((4-normalized.length%4)%4);
      const binary=atob(padded),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
      const value=JSON.parse(new TextDecoder().decode(bytes));
      return value && Array.isArray(value.shapes) ? value : null;
    } catch { return null; }
  }

  function safeNum(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function safeColor(value){return /^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):'#00498F';}

  function shapeMarkup(shape) {
    const x=safeNum(shape.x),y=safeNum(shape.y),w=Math.max(1,safeNum(shape.w,1)),h=Math.max(1,safeNum(shape.h,1));
    const fill=safeColor(shape.fill),opacity=Math.max(.2,Math.min(1,safeNum(shape.opacity,100)/100));
    const rotation=Math.max(-180,Math.min(180,safeNum(shape.rotation))),cx=x+w/2,cy=y+h/2;
    const transform=rotation?` transform="rotate(${rotation} ${cx} ${cy})"`:'';
    if(shape.type==='circle')return `<ellipse cx="${cx}" cy="${cy}" rx="${w/2}" ry="${h/2}" fill="${fill}" opacity="${opacity}"${transform}/>`;
    if(shape.type==='triangle')return `<polygon points="${cx},${y} ${x+w},${y+h} ${x},${y+h}" fill="${fill}" opacity="${opacity}"${transform}/>`;
    if(shape.type==='arch'){const r=Math.min(w/2,h*.42);return `<path d="M${x},${y+h} V${y+r} A${r},${r} 0 0 1 ${x+w},${y+r} V${y+h} Z" fill="${fill}" opacity="${opacity}"${transform}/>`;}
    if(shape.type==='tree')return `<g${transform}><rect x="${cx-w*.08}" y="${y+h*.56}" width="${w*.16}" height="${h*.44}" fill="#7A5237"/><ellipse cx="${cx}" cy="${y+h*.34}" rx="${w*.46}" ry="${h*.34}" fill="${fill}" opacity="${opacity}"/></g>`;
    if(shape.type==='window'&&shape.variant==='lit')return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#FFD86A" opacity="${opacity}"${transform}/>`;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${fill}" opacity="${opacity}"${transform}/>`;
  }

  function preview(code) {
    const design=decode(code);
    if(!design)return '<div class="sketchbook-preview-empty">Preview unavailable</div>';
    const backgrounds={grid:'#F4F7F9',paper:'#fff',blueprint:'#185B88',river:'#DAE9EF',lawn:'#E7EEE1',sunset:'#E8D1BD',night:'#122B49'};
    const bg=backgrounds[design.background]||backgrounds.grid;
    const grid=design.background==='grid'?'<path d="M0 130H800M0 260H800M0 390H800M200 0V520M400 0V520M600 0V520" stroke="#cdd8e0" stroke-width="2" opacity=".45"/>':'';
    return `<svg viewBox="0 0 800 520" aria-hidden="true"><rect width="800" height="520" fill="${bg}"/>${grid}${design.shapes.slice(0,60).map(shapeMarkup).join('')}</svg>`;
  }

  function ensureUI() {
    if(!$('save-sketchbook')){
      const button=document.createElement('button');button.type='button';button.id='save-sketchbook';button.className='button button-outline';button.textContent='Save to sketchbook';
      button.addEventListener('click',saveVersion);
      const saveDraft=$('save-draft');
      if(saveDraft)saveDraft.insertAdjacentElement('afterend',button);else actions.appendChild(button);
    }
    if(!$('my-sketchbook')){
      const section=document.createElement('section');section.id='my-sketchbook';section.className='section my-sketchbook-section';section.hidden=!entries.length;
      section.innerHTML=`<div class="container"><div class="section-head"><div><p class="eyebrow">Private on this device</p><h2>My Sketchbook</h2><p class="muted">Keep up to ${MAX} versions without creating an account. Open an old idea, remix it, or copy its link.</p></div><button type="button" class="button button-outline" id="clear-sketchbook" hidden>Clear sketchbook</button></div><div id="sketchbook-grid" class="sketchbook-grid"></div></div>`;
      const firstPublic=document.querySelector('#live-community, #showcase');
      if(firstPublic)firstPublic.parentNode.insertBefore(section,firstPublic);else app.insertAdjacentElement('afterend',section);
      $('clear-sketchbook')?.addEventListener('click',()=>{if(!entries.length||!confirm('Delete every local sketchbook version on this device?'))return;entries=[];persist();render();});
    }
    render();
  }

  function currentCode() {
    const panel=$('share-panel'),wasHidden=panel?.hidden;
    $('create-share')?.click();
    const code=String($('design-code')?.value||'').trim();
    if(panel&&wasHidden)panel.hidden=true;
    return code;
  }

  function saveVersion() {
    const code=currentCode();
    if(!decode(code))return setStatus('Could not save this version. Try creating a share link first.');
    const title=$('design-title')?.value?.trim()||'Untitled building';
    const designer=$('design-author')?.value?.trim()||'';
    const id=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    entries.unshift({id,title:String(title).slice(0,80),designer:String(designer).slice(0,80),code,created_at:new Date().toISOString()});
    entries=entries.slice(0,MAX);persist();render();setStatus(`Saved “${title}” to My Sketchbook.`);
    $('my-sketchbook')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
  }

  function setStatus(message){const el=$('studio-status');if(el)el.textContent=message;}

  function linkFor(code){const url=new URL('designer.html',location.href);url.hash=`design=${code}`;return url.href;}

  async function copy(text){try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true}}catch{}const area=document.createElement('textarea');area.value=text;area.style.cssText='position:fixed;left:-9999px';document.body.appendChild(area);area.select();let ok=false;try{ok=document.execCommand('copy')}catch{}area.remove();return ok;}

  function render() {
    const section=$('my-sketchbook'),grid=$('sketchbook-grid'),clear=$('clear-sketchbook');
    if(!section||!grid)return;
    section.hidden=!entries.length;if(clear)clear.hidden=!entries.length;
    if(!entries.length){grid.innerHTML='';return;}
    grid.innerHTML=entries.map(entry=>{
      const date=new Date(entry.created_at),dateText=Number.isNaN(date.getTime())?'Saved version':date.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
      return `<article class="sketchbook-card" data-sketch-id="${escapeHTML(entry.id)}"><div class="sketchbook-preview">${preview(entry.code)}</div><div class="sketchbook-card-body"><span class="sketchbook-date">${escapeHTML(dateText)}</span><h3>${escapeHTML(entry.title)}</h3>${entry.designer?`<p class="muted small">by ${escapeHTML(entry.designer)}</p>`:''}<div class="sketchbook-actions"><button type="button" class="button button-primary" data-sketch-open="${escapeHTML(entry.id)}">Open / remix</button><button type="button" class="favorite-button" data-sketch-copy="${escapeHTML(entry.id)}">Copy link</button><button type="button" class="favorite-button danger-control" data-sketch-delete="${escapeHTML(entry.id)}">Delete</button></div></div></article>`;
    }).join('');
    grid.querySelectorAll('[data-sketch-open]').forEach(button=>button.addEventListener('click',()=>{const entry=entries.find(item=>item.id===button.dataset.sketchOpen);if(!entry)return;location.hash=`design=${entry.code}`;location.reload();}));
    grid.querySelectorAll('[data-sketch-copy]').forEach(button=>button.addEventListener('click',async()=>{const entry=entries.find(item=>item.id===button.dataset.sketchCopy);if(!entry)return;const ok=await copy(linkFor(entry.code));button.textContent=ok?'Copied!':'Copy failed';setTimeout(()=>{if(button.isConnected)button.textContent='Copy link'},1200);}));
    grid.querySelectorAll('[data-sketch-delete]').forEach(button=>button.addEventListener('click',()=>{const entry=entries.find(item=>item.id===button.dataset.sketchDelete);if(!entry||!confirm(`Delete “${entry.title}” from this device?`))return;entries=entries.filter(item=>item.id!==entry.id);persist();render();}));
  }

  ensureUI();
})();

(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const app = $('designer-app');
  const challengeBand = document.querySelector('.designer-challenge-band .container');
  if (!app || !challengeBand) return;

  const PROMPTS = [
    'Design a shaded bus stop that would make a Memphis August afternoon tolerable.',
    'Make a tiny music venue with one unforgettable entrance.',
    'Design a riverfront pavilion that looks different from far away and up close.',
    'Build a house around a courtyard instead of putting a yard around a house.',
    'Create a facade using one repeated element until it becomes the architecture.',
    'Design a building that feels heavy at the bottom and impossibly light at the top.',
    'Make a night building where the windows tell you what is happening inside.',
    'Design a public porch: not quite inside, not quite outside.',
    'Build something using only three colors and one dramatic curve.',
    'Create a tiny gallery where the path through it matters more than the object itself.',
    'Design a civic building that feels welcoming without using symmetry.',
    'Make a tower with a top, middle, and base that actually feel different.',
    'Design a pavilion where the roof is more important than the walls.',
    'Build a campus hangout that gives people at least three different ways to sit or gather.',
    'Create a building that looks calm from one side and chaotic from the other.',
    'Design something that could plausibly be made from reused parts.',
    'Make an entrance sequence with at least three layers before you reach the door.',
    'Create a landscape-heavy project where the building is not the biggest thing on the canvas.',
    'Design a one-room building with a ridiculous amount of daylight.',
    'Make a serious building using one intentionally playful move.',
    'Design a building around one arch, then make every other move support it.',
    'Create a facade that would still be recognizable as a silhouette.',
    'Build a tiny community space that feels larger than it really is.',
    'Design a building where repetition suddenly breaks in exactly one place.'
  ];
  const COLORS = ['#00498F','#193059','#9C9EA1','#E2E4E6','#B65E3C','#E5B769','#556B55','#A48B6A','#6EE7F5','#E879F9','#FDE047','#263238'];
  const MATERIALS = ['solid','glass','translucent','outline'];

  function seededIndex() {
    const now = new Date();
    const key = Number(`${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`);
    return Math.abs((key * 9301 + 49297) % 233280) % PROMPTS.length;
  }

  function ensureDailyBrief() {
    if ($('daily-brief')) return;
    const brief = document.createElement('aside');
    brief.id = 'daily-brief';
    brief.className = 'daily-brief';
    brief.innerHTML = `<div><span class="daily-brief-label">Today's brief</span><strong>${PROMPTS[seededIndex()]}</strong></div><span class="daily-brief-date">${new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</span>`;
    challengeBand.appendChild(brief);
  }

  function ensurePlayButtons() {
    const bar = $('designer-fun-bar');
    if (!bar) return setTimeout(ensurePlayButtons, 20);
    const add = (id,label,handler) => {
      if ($(id)) return;
      const button = document.createElement('button');
      button.type = 'button'; button.id = id; button.className = 'button button-outline'; button.textContent = label;
      button.addEventListener('click',handler); bar.appendChild(button);
    };
    add('build-battle','Build battle',buildBattle);
    add('night-party','Night party',nightParty);
    if (navigator.share) add('native-share-design','Share',nativeShare);
  }

  function ensureMutateButton() {
    const actions = document.querySelector('.designer-mini-actions');
    if (!actions || $('shape-mutate')) return;
    const button = document.createElement('button');
    button.type='button'; button.id='shape-mutate'; button.textContent='Mutate part'; button.disabled=true;
    button.addEventListener('click',mutateSelected); actions.insertBefore(button,$('shape-delete'));
    const label = $('selected-label');
    const sync = () => { button.disabled = !label || /^None$/i.test(label.textContent.trim()) || /Locked/i.test(label.textContent); };
    sync();
    if (label) new MutationObserver(sync).observe(label,{childList:true,subtree:true,characterData:true});
  }

  function buildBattle() {
    $('design-roulette')?.click();
    const sprint = $('sprint-toggle');
    if (sprint && /3-minute sprint|Sprint finished/i.test(sprint.textContent)) sprint.click();
    const status = $('studio-status');
    if (status) status.textContent='Build Battle started: random concept, random palette, random brief, three minutes. Go.';
  }

  function nightParty() {
    const background = $('design-background');
    if (background) { background.value='night'; background.dispatchEvent(new Event('change',{bubbles:true})); }
    const lights = $('lights-toggle');
    if (lights && !lights.checked) { lights.checked=true; lights.dispatchEvent(new Event('change',{bubbles:true})); }
    document.querySelector('[data-palette="neon"]')?.click();
    let windows=[...document.querySelectorAll('#designer-layers .layer-chip')].filter(chip=>/Window/i.test(chip.textContent));
    if (!windows.length) {
      for(let i=0;i<4;i+=1) document.querySelector('[data-add-shape="window"]')?.click();
      windows=[...document.querySelectorAll('#designer-layers .layer-chip')].filter(chip=>/Window/i.test(chip.textContent));
    }
    windows.slice(0,12).forEach(chip=>{
      chip.click();
      const interact=$('shape-interact');
      if (interact && /Lights on/i.test(interact.textContent) && !interact.disabled) interact.click();
    });
    const status=$('studio-status'); if(status) status.textContent='Night Party: neon palette, night scene, and glowing windows.';
  }

  function mutateSelected() {
    const color=$('shape-color'), material=$('shape-material'), rotation=$('shape-rotation');
    if (!color || color.disabled) return;
    color.value=COLORS[Math.floor(Math.random()*COLORS.length)];
    color.dispatchEvent(new Event('focus')); color.dispatchEvent(new Event('change',{bubbles:true}));
    if (material && !material.disabled) {
      material.value=MATERIALS[Math.floor(Math.random()*MATERIALS.length)];
      material.dispatchEvent(new Event('change',{bubbles:true}));
    }
    if (rotation && !rotation.disabled) {
      rotation.value=String((Math.floor(Math.random()*13)-6)*15);
      rotation.dispatchEvent(new Event('input',{bubbles:true}));
      rotation.dispatchEvent(new Event('change',{bubbles:true}));
    }
    const status=$('studio-status'); if(status) status.textContent='Part mutated. Keep it, mutate again, or undo.';
  }

  async function nativeShare() {
    $('create-share')?.click();
    const url=$('share-url')?.value || location.href;
    const title=$('design-title')?.value?.trim() || 'AIAS Design Studio building';
    const designer=$('design-author')?.value?.trim();
    try {
      await navigator.share({title,text:`${title}${designer?` by ${designer}`:''} — remix this AIAS Design Studio building.`,url});
    } catch (error) {
      if (error?.name !== 'AbortError') {
        try { await navigator.clipboard?.writeText(url); const status=$('studio-status'); if(status)status.textContent='Share sheet unavailable, so the design link was copied instead.'; } catch {}
      }
    }
  }

  function cyclePart(direction) {
    const chips=[...document.querySelectorAll('#designer-layers .layer-chip')];
    if (!chips.length) return;
    let index=chips.findIndex(chip=>chip.classList.contains('is-selected'));
    if (index<0) index=direction>0?-1:0;
    index=(index+direction+chips.length)%chips.length;
    chips[index].click();
    chips[index].scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
  }

  document.addEventListener('keydown',event=>{
    const tag=document.activeElement?.tagName?.toLowerCase();
    if (['input','textarea','select'].includes(tag) || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key===']') { cyclePart(1); event.preventDefault(); }
    if (event.key==='[') { cyclePart(-1); event.preventDefault(); }
  });

  ensureDailyBrief();
  ensurePlayButtons();
  ensureMutateButton();
})();

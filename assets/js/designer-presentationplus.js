(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const svg = $('design-canvas');
  const shapes = $('canvas-shapes');
  const toolbar = document.querySelector('.designer-workspace-toolbar');
  const actions = document.querySelector('.designer-actions');
  if (!svg || !shapes || !toolbar || !actions) return;

  let shadowOn = false;
  let shadowAngle = 42;
  let shadowLayer = null;
  let shadowObserver = null;
  let shadowFrame = 0;

  function ensureShadowLayer() {
    if (shadowLayer?.isConnected) return shadowLayer;
    shadowLayer = document.createElementNS('http://www.w3.org/2000/svg','g');
    shadowLayer.id = 'sun-shadow-layer';
    shadowLayer.classList.add('sun-shadow-layer');
    shadowLayer.setAttribute('pointer-events','none');
    shapes.parentNode?.insertBefore(shadowLayer, shapes);
    return shadowLayer;
  }

  function updateShadowTransform() {
    if (!shadowLayer) return;
    const radians = shadowAngle * Math.PI / 180;
    const dx = Math.cos(radians) * 48;
    const dy = 18 + Math.sin(radians) * 32;
    shadowLayer.setAttribute('transform',`translate(${dx.toFixed(1)} ${dy.toFixed(1)})`);
  }

  function rebuildShadows() {
    if (!shadowOn) return;
    const layer = ensureShadowLayer();
    layer.innerHTML = '';
    [...shapes.children].forEach(child => {
      const clone = child.cloneNode(true);
      clone.removeAttribute('class');
      clone.removeAttribute('role');
      clone.removeAttribute('aria-label');
      clone.removeAttribute('data-shape-id');
      layer.appendChild(clone);
    });
    updateShadowTransform();
  }

  function scheduleShadowRebuild() {
    if (!shadowOn || shadowFrame) return;
    shadowFrame = requestAnimationFrame(() => {
      shadowFrame = 0;
      rebuildShadows();
    });
  }

  function enableObserver() {
    if (shadowObserver) return;
    shadowObserver = new MutationObserver(scheduleShadowRebuild);
    shadowObserver.observe(shapes,{childList:true,subtree:true,attributes:true});
  }

  function disableObserver() {
    shadowObserver?.disconnect();
    shadowObserver = null;
  }

  function ensureSunControls() {
    if ($('sun-study-toggle')) return;
    const group = document.createElement('div');
    group.className = 'designer-toolbar-group sun-study-controls';
    group.innerHTML = `
      <button type="button" class="icon-action" id="sun-study-toggle" aria-pressed="false">☀ <span>Sun study</span></button>
      <label id="sun-angle-wrap" class="sun-angle-control" hidden>Sun angle
        <input id="sun-angle" type="range" min="0" max="180" step="1" value="42">
        <span id="sun-angle-value">42°</span>
      </label>`;
    toolbar.appendChild(group);
    $('sun-study-toggle')?.addEventListener('click',toggleSun);
    $('sun-angle')?.addEventListener('input',event=>{
      shadowAngle=Number(event.target.value)||0;
      if($('sun-angle-value')) $('sun-angle-value').textContent=`${shadowAngle}°`;
      updateShadowTransform();
    });
  }

  function toggleSun() {
    shadowOn=!shadowOn;
    const button=$('sun-study-toggle'), wrap=$('sun-angle-wrap');
    if(button){button.setAttribute('aria-pressed',String(shadowOn));button.classList.toggle('is-active',shadowOn);}
    if(wrap) wrap.hidden=!shadowOn;
    if(shadowOn){ensureShadowLayer();rebuildShadows();enableObserver();}
    else{disableObserver();shadowLayer?.remove();shadowLayer=null;}
    const status=$('studio-status');
    if(status) status.textContent=shadowOn?'Sun study on. Scrub the angle to read massing and depth.':'Sun study off.';
  }

  function ensurePosterButton() {
    if($('download-poster')) return;
    const button=document.createElement('button');
    button.type='button';button.id='download-poster';button.className='button button-outline';button.textContent='Download pin-up poster';
    button.addEventListener('click',downloadPoster);
    const png=$('download-png');
    if(png) png.insertAdjacentElement('afterend',button); else actions.appendChild(button);
  }

  function cleanSvgClone() {
    const clone=svg.cloneNode(true);
    clone.querySelector('#selection-layer')?.remove();
    clone.querySelectorAll('.design-shape').forEach(node=>{
      node.removeAttribute('class');node.removeAttribute('role');node.removeAttribute('aria-label');node.removeAttribute('data-shape-id');
    });
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
    clone.setAttribute('width','800');clone.setAttribute('height','520');
    return clone;
  }

  function roundedRect(ctx,x,y,w,h,r,fill,stroke='') {
    const radius=Math.min(r,w/2,h/2);
    ctx.beginPath();ctx.roundRect(x,y,w,h,radius);
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
  }

  function wrapText(ctx,text,x,y,maxWidth,lineHeight,maxLines=2) {
    const words=String(text).split(/\s+/);let line='',lineCount=0;
    for(let i=0;i<words.length;i+=1){
      const test=`${line}${line?' ':''}${words[i]}`;
      if(ctx.measureText(test).width>maxWidth && line){
        ctx.fillText(line,x,y+lineCount*lineHeight);line=words[i];lineCount+=1;
        if(lineCount>=maxLines-1){const rest=[line,...words.slice(i+1)].join(' ');let trimmed=rest;while(trimmed.length>1&&ctx.measureText(`${trimmed}…`).width>maxWidth)trimmed=trimmed.slice(0,-1);ctx.fillText(`${trimmed}…`,x,y+lineCount*lineHeight);return;}
      }else line=test;
    }
    if(line)ctx.fillText(line,x,y+lineCount*lineHeight);
  }

  function safeFileName(value){return String(value||'aias-building').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'aias-building';}

  function downloadPoster() {
    const clone=cleanSvgClone();
    const blob=new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'});
    const source=URL.createObjectURL(blob), image=new Image();
    const status=$('studio-status');if(status)status.textContent='Building your pin-up poster…';
    image.onload=()=>{
      const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
      const ctx=canvas.getContext('2d');if(!ctx){URL.revokeObjectURL(source);if(status)status.textContent='Poster export is unavailable in this browser.';return;}
      ctx.fillStyle='#F5F7F9';ctx.fillRect(0,0,1080,1350);
      ctx.fillStyle='#193059';ctx.fillRect(0,0,1080,32);
      ctx.fillStyle='#00498F';ctx.fillRect(0,32,1080,10);
      roundedRect(ctx,70,120,940,650,28,'#FFFFFF','#D8E0E7');
      ctx.drawImage(image,80,140,920,598);
      ctx.fillStyle='#00498F';ctx.font='800 22px Arial, sans-serif';ctx.fillText('AIAS DESIGN STUDIO',78,862);
      const title=$('design-title')?.value?.trim()||'Untitled building';
      ctx.fillStyle='#17263A';ctx.font='700 58px Arial, sans-serif';wrapText(ctx,title,78,930,900,68,2);
      const designer=$('design-author')?.value?.trim();
      ctx.fillStyle='#66727D';ctx.font='400 30px Arial, sans-serif';ctx.fillText(designer?`Designed by ${designer}`:'Designed in the AIAS Memphis sandbox',80,1084);
      const vibe=$('stat-vibe')?.textContent?.trim()||'Balanced';
      const parts=$('stat-shapes')?.textContent?.trim()||'0';
      const colors=$('stat-colors')?.textContent?.trim()||'0';
      roundedRect(ctx,78,1145,190,62,31,'#E8F2FB');
      ctx.fillStyle='#00498F';ctx.font='700 23px Arial, sans-serif';ctx.fillText(vibe,103,1185);
      ctx.fillStyle='#66727D';ctx.font='500 21px Arial, sans-serif';ctx.fillText(`${parts} parts · ${colors} colors`,300,1185);
      ctx.fillStyle='#193059';ctx.font='700 20px Arial, sans-serif';ctx.fillText('AIAS Memphis · University of Memphis',78,1285);
      URL.revokeObjectURL(source);
      const link=document.createElement('a');link.download=`${safeFileName(title)}-pinup.png`;link.href=canvas.toDataURL('image/png');link.click();
      if(status)status.textContent='Pin-up poster exported at 1080 × 1350.';
    };
    image.onerror=()=>{URL.revokeObjectURL(source);if(status)status.textContent='Poster export failed in this browser.';};
    image.src=source;
  }

  ensureSunControls();
  ensurePosterButton();
})();

(() => {
  'use strict';
  const current = document.currentScript;

  for (const href of [
    'assets/css/designer-fun.css',
    'assets/css/designer-onboarding.css',
    'assets/css/designer-views.css',
    'assets/css/designer-playplus.css'
  ]) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = href;
    document.head.appendChild(style);
  }

  const core = document.createElement('script');
  core.src = 'assets/js/designer-v2.js';
  core.defer = true;

  const fun = document.createElement('script');
  fun.src = 'assets/js/designer-fun.js';
  fun.defer = true;

  const onboarding = document.createElement('script');
  onboarding.src = 'assets/js/designer-onboarding.js';
  onboarding.defer = true;

  const views = document.createElement('script');
  views.src = 'assets/js/designer-views.js';
  views.defer = true;

  const playplus = document.createElement('script');
  playplus.src = 'assets/js/designer-playplus.js';
  playplus.defer = true;

  const communityBootstrap = document.createElement('script');
  communityBootstrap.src = 'assets/js/designer-community-bootstrap.js';
  communityBootstrap.defer = true;

  playplus.addEventListener('load', () => {
    if (playplus.parentNode) playplus.parentNode.insertBefore(communityBootstrap, playplus.nextSibling);
    else document.head.appendChild(communityBootstrap);
  });

  views.addEventListener('load', () => {
    if (views.parentNode) views.parentNode.insertBefore(playplus, views.nextSibling);
    else document.head.appendChild(playplus);
  });

  onboarding.addEventListener('load', () => {
    if (onboarding.parentNode) onboarding.parentNode.insertBefore(views, onboarding.nextSibling);
    else document.head.appendChild(views);
  });

  fun.addEventListener('load', () => {
    if (fun.parentNode) fun.parentNode.insertBefore(onboarding, fun.nextSibling);
    else document.head.appendChild(onboarding);
  });

  core.addEventListener('load', () => {
    if (core.parentNode) core.parentNode.insertBefore(fun, core.nextSibling);
    else document.head.appendChild(fun);
  });

  if (current?.parentNode) current.parentNode.insertBefore(core, current.nextSibling);
  else document.head.appendChild(core);
})();

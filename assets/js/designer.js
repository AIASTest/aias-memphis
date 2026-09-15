(() => {
  'use strict';
  const current = document.currentScript;

  for (const href of [
    'assets/css/designer-fun.css',
    'assets/css/designer-onboarding.css',
    'assets/css/designer-views.css',
    'assets/css/designer-community.css'
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

  const community = document.createElement('script');
  community.src = 'assets/js/designer-community.js';
  community.defer = true;

  const communityGuard = document.createElement('script');
  communityGuard.src = 'assets/js/designer-community-guard.js';
  communityGuard.defer = true;

  community.addEventListener('load', () => {
    if (community.parentNode) community.parentNode.insertBefore(communityGuard, community.nextSibling);
    else document.head.appendChild(communityGuard);
  });

  views.addEventListener('load', () => {
    if (views.parentNode) views.parentNode.insertBefore(community, views.nextSibling);
    else document.head.appendChild(community);
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

(() => {
  'use strict';
  const current = document.currentScript;

  for (const href of [
    'assets/css/designer-fun.css',
    'assets/css/designer-game.css',
    'assets/css/designer-onboarding.css',
    'assets/css/designer-views.css',
    'assets/css/designer-presentationplus.css',
    'assets/css/designer-sketchbook.css'
  ]) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = href;
    document.head.appendChild(style);
  }

  const core = document.createElement('script');
  core.src = 'assets/js/designer-v2.js';
  core.defer = true;

  const game = document.createElement('script');
  game.src = 'assets/js/designer-game.js';
  game.defer = true;

  const onboarding = document.createElement('script');
  onboarding.src = 'assets/js/designer-onboarding.js';
  onboarding.defer = true;

  const views = document.createElement('script');
  views.src = 'assets/js/designer-views.js';
  views.defer = true;

  const presentationplus = document.createElement('script');
  presentationplus.src = 'assets/js/designer-presentationplus.js';
  presentationplus.defer = true;

  const sketchbook = document.createElement('script');
  sketchbook.src = 'assets/js/designer-sketchbook.js';
  sketchbook.defer = true;

  const communityBootstrap = document.createElement('script');
  communityBootstrap.src = 'assets/js/designer-community-bootstrap.js';
  communityBootstrap.defer = true;

  sketchbook.addEventListener('load', () => {
    if (sketchbook.parentNode) sketchbook.parentNode.insertBefore(communityBootstrap, sketchbook.nextSibling);
    else document.head.appendChild(communityBootstrap);
  });

  presentationplus.addEventListener('load', () => {
    if (presentationplus.parentNode) presentationplus.parentNode.insertBefore(sketchbook, presentationplus.nextSibling);
    else document.head.appendChild(sketchbook);
  });

  views.addEventListener('load', () => {
    if (views.parentNode) views.parentNode.insertBefore(presentationplus, views.nextSibling);
    else document.head.appendChild(presentationplus);
  });

  onboarding.addEventListener('load', () => {
    if (onboarding.parentNode) onboarding.parentNode.insertBefore(views, onboarding.nextSibling);
    else document.head.appendChild(views);
  });

  game.addEventListener('load', () => {
    if (game.parentNode) game.parentNode.insertBefore(onboarding, game.nextSibling);
    else document.head.appendChild(onboarding);
  });

  core.addEventListener('load', () => {
    if (core.parentNode) core.parentNode.insertBefore(game, core.nextSibling);
    else document.head.appendChild(game);
  });

  if (current?.parentNode) current.parentNode.insertBefore(core, current.nextSibling);
  else document.head.appendChild(core);
})();

(() => {
  'use strict';
  const current = document.currentScript;

  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = 'assets/css/designer-fun.css';
  document.head.appendChild(style);

  const core = document.createElement('script');
  core.src = 'assets/js/designer-v2.js';
  core.defer = true;

  const fun = document.createElement('script');
  fun.src = 'assets/js/designer-fun.js';
  fun.defer = true;

  core.addEventListener('load', () => {
    if (core.parentNode) core.parentNode.insertBefore(fun, core.nextSibling);
    else document.head.appendChild(fun);
  });

  if (current?.parentNode) current.parentNode.insertBefore(core, current.nextSibling);
  else document.head.appendChild(core);
})();

(() => {
  'use strict';
  const current = document.currentScript;
  const script = document.createElement('script');
  script.src = 'assets/js/designer-v2.js';
  script.defer = true;
  if (current?.parentNode) current.parentNode.insertBefore(script, current.nextSibling);
  else document.head.appendChild(script);
})();

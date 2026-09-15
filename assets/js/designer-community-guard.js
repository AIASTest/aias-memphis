(() => {
  'use strict';
  fetch('data/community-backend.json', { cache: 'no-store' })
    .then(response => response.ok ? response.json() : null)
    .then(config => {
      const valid = Boolean(
        config && config.enabled === true && config.provider === 'supabase' &&
        /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(String(config.supabase_url || '')) &&
        String(config.supabase_publishable_key || '').length > 20
      );
      if (valid) return;
      const publish = document.getElementById('publish-community');
      const live = document.getElementById('live-community');
      if (publish) publish.hidden = true;
      if (live) live.hidden = true;
    })
    .catch(() => {
      const publish = document.getElementById('publish-community');
      const live = document.getElementById('live-community');
      if (publish) publish.hidden = true;
      if (live) live.hidden = true;
    });
})();

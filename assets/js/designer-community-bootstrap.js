(() => {
  'use strict';

  const CONFIG_URL = 'data/community-backend.json';

  function safeConfig(config) {
    if (!config || config.enabled !== true || config.provider !== 'supabase') return false;
    const url = String(config.supabase_url || '').trim();
    const key = String(config.supabase_publishable_key || '').trim();
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) return false;
    if (key.length <= 20) return false;
    const lowered = key.toLowerCase();
    if (lowered.includes('service_role') || lowered.startsWith('sb_secret_')) return false;
    const captcha = String(config.captcha_provider || 'none');
    if (!['none', 'turnstile'].includes(captcha)) return false;
    if (captcha === 'turnstile' && !String(config.captcha_site_key || '').trim()) return false;
    return true;
  }

  async function boot() {
    let config = null;
    try {
      const response = await fetch(CONFIG_URL, { cache: 'no-store' });
      config = response.ok ? await response.json() : null;
    } catch {
      return;
    }
    if (!safeConfig(config)) return;

    globalThis.AIASCommunityConfig = Object.freeze({ ...config });

    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'assets/css/designer-community.css';
    document.head.appendChild(style);

    const script = document.createElement('script');
    script.src = 'assets/js/designer-community-v2.js';
    script.defer = true;
    document.head.appendChild(script);
  }

  boot();
})();

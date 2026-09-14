(() => {
  const safeHttps = (value = '') => {
    try {
      const url = new URL(String(value).trim());
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  };

  function addPersistentLinks() {
    const nav = document.getElementById('main-nav');
    if (nav && !nav.querySelector('[data-members-nav]')) {
      const link = document.createElement('a');
      link.href = 'members.html';
      link.textContent = 'Members';
      link.dataset.membersNav = 'true';
      if (['members', 'member'].includes(document.body.dataset.page)) link.setAttribute('aria-current', 'page');
      const about = [...nav.querySelectorAll('a')].find(a => a.textContent.trim() === 'About');
      nav.insertBefore(link, about || null);
    }

    if (nav && !nav.querySelector('[data-support-nav]')) {
      const link = document.createElement('a');
      link.href = 'support.html';
      link.textContent = 'Support';
      link.dataset.supportNav = 'true';
      if (document.body.dataset.page === 'support') link.setAttribute('aria-current', 'page');
      const about = [...nav.querySelectorAll('a')].find(a => a.textContent.trim() === 'About');
      nav.insertBefore(link, about || null);
    }

    const footerLinks = document.querySelector('.footer-links');
    if (footerLinks && !footerLinks.querySelector('[data-members-footer]')) {
      const link = document.createElement('a');
      link.href = 'members.html';
      link.textContent = 'Chapter Members';
      link.dataset.membersFooter = 'true';
      const about = [...footerLinks.querySelectorAll('a')].find(a => a.textContent.trim() === 'About');
      footerLinks.insertBefore(link, about || null);
    }

    if (footerLinks && !footerLinks.querySelector('[data-support-footer]')) {
      const link = document.createElement('a');
      link.href = 'support.html';
      link.textContent = 'Support & Payments';
      link.dataset.supportFooter = 'true';
      const about = [...footerLinks.querySelectorAll('a')].find(a => a.textContent.trim() === 'About');
      footerLinks.insertBefore(link, about || null);
    }
  }

  async function addInstagramLinks() {
    try {
      const response = await fetch('data/site.json', { cache: 'no-store' });
      if (!response.ok) return;
      const site = await response.json();
      const instagram = safeHttps(site?.instagram_url);
      if (!instagram) return;

      const homeLink = document.getElementById('home-instagram-link');
      if (homeLink) {
        homeLink.href = instagram;
        homeLink.hidden = false;
      }
    } catch (error) {
      console.warn('Instagram link could not be loaded.', error);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    addPersistentLinks();
    addInstagramLinks();
    const header = document.getElementById('site-header');
    const footer = document.getElementById('site-footer');
    if (header) new MutationObserver(addPersistentLinks).observe(header, { childList: true, subtree: true });
    if (footer) new MutationObserver(addPersistentLinks).observe(footer, { childList: true, subtree: true });
  });
})();

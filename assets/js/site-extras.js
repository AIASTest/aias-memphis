(() => {
  function addSupportLinks() {
    const nav = document.getElementById('main-nav');
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
    if (footerLinks && !footerLinks.querySelector('[data-support-footer]')) {
      const link = document.createElement('a');
      link.href = 'support.html';
      link.textContent = 'Support & Payments';
      link.dataset.supportFooter = 'true';
      const about = [...footerLinks.querySelectorAll('a')].find(a => a.textContent.trim() === 'About');
      footerLinks.insertBefore(link, about || null);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    addSupportLinks();
    const header = document.getElementById('site-header');
    const footer = document.getElementById('site-footer');
    if (header) new MutationObserver(addSupportLinks).observe(header, { childList: true, subtree: true });
    if (footer) new MutationObserver(addSupportLinks).observe(footer, { childList: true, subtree: true });
  });
})();

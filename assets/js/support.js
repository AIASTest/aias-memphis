(() => {
  const qs = (selector, root = document) => root.querySelector(selector);
  const esc = (value = '') => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const safeHttps = (value = '') => {
    try { const url = new URL(String(value).trim()); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
  };
  const providerInitials = (name = '') => String(name).split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0,2).toUpperCase() || '$';

  async function loadData() {
    const [paymentsResponse, siteResponse] = await Promise.all([
      fetch('data/payments.json', { cache: 'no-store' }),
      fetch('data/site.json', { cache: 'no-store' })
    ]);
    if (!paymentsResponse.ok) throw new Error('Could not load payment settings');
    const payments = await paymentsResponse.json();
    const site = siteResponse.ok ? await siteResponse.json() : {};
    return { payments: payments && typeof payments === 'object' ? payments : {}, site: site && typeof site === 'object' ? site : {} };
  }

  function renderMethods(methods = []) {
    const target = qs('#payment-method-list');
    if (!target) return;
    const active = Array.isArray(methods)
      ? methods.filter(item => item && item.enabled && safeHttps(item.url))
      : [];

    if (!active.length) {
      target.innerHTML = '<div class="empty-state payment-empty"><strong>Payment links are being updated.</strong><p style="margin:.45rem 0 0">Contact chapter leadership for the current approved payment method.</p></div>';
      return;
    }

    target.innerHTML = active.map(item => {
      const url = safeHttps(item.url);
      const label = item.label || item.provider || 'Payment option';
      const provider = item.provider || label;
      return `
        <article class="payment-method">
          <div class="payment-provider-mark" aria-hidden="true">${esc(providerInitials(provider))}</div>
          <p class="eyebrow">${esc(provider)}</p>
          <h3>${esc(label)}</h3>
          <a class="button button-primary" href="${esc(url)}" target="_blank" rel="noopener">Open ${esc(provider)} ↗</a>
        </article>`;
    }).join('');
  }

  async function init() {
    try {
      const { payments, site } = await loadData();
      qs('#support-title').textContent = payments.page_title || 'Support AIAS Memphis';
      qs('#support-intro').textContent = payments.page_intro || '';
      qs('#firm-heading').textContent = payments.firm_heading || 'Firm & partner payments';
      qs('#firm-intro').textContent = payments.firm_intro || '';
      qs('#donation-heading').textContent = payments.donation_heading || 'Support the chapter';
      qs('#donation-intro').textContent = payments.donation_intro || '';
      qs('#memo-instructions').textContent = payments.payment_memo_instructions || 'Include your firm name and payment purpose in the payment note when possible.';

      const firmSection = qs('#firm-payments');
      if (firmSection) firmSection.hidden = payments.firm_section_enabled === false;
      const donationSection = qs('#donations');
      if (donationSection) donationSection.hidden = payments.donation_section_enabled === false;

      renderMethods(payments.payment_methods);

      const receipt = qs('#receipt-note');
      const disclaimer = qs('#donation-disclaimer');
      if (receipt) receipt.textContent = payments.receipt_note || '';
      if (disclaimer) disclaimer.textContent = payments.donation_disclaimer || '';
      const notes = qs('#payment-notes');
      if (notes) notes.hidden = !(String(payments.receipt_note || '').trim() || String(payments.donation_disclaimer || '').trim());

      const contact = String(payments.contact_email || site.contact_email || '').trim();
      const contactWrap = qs('#support-contact');
      if (contactWrap && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact)) {
        contactWrap.innerHTML = `Questions before paying? <a href="mailto:${esc(contact)}">Email chapter leadership</a>.`;
      }
    } catch (error) {
      console.error(error);
      const methods = qs('#payment-method-list');
      if (methods) methods.innerHTML = '<div class="empty-state payment-empty"><strong>Payment information could not be loaded.</strong><p style="margin:.45rem 0 0">Please contact chapter leadership before sending payment.</p></div>';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();

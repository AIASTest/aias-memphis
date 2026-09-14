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

  function renderFees(fees = []) {
    const target = qs('#firm-fees');
    if (!target) return;
    const active = Array.isArray(fees) ? fees.filter(item => item && item.enabled) : [];
    if (!active.length) {
      target.innerHTML = '<div class="empty-state">Specific firm fees are not currently listed online. Confirm the amount with chapter leadership before paying.</div>';
      return;
    }
    target.innerHTML = active.map(item => `
      <article class="fee-card">
        <div><h3>${esc(item.title || 'Chapter fee')}</h3>${item.description ? `<p class="muted" style="margin:0">${esc(item.description)}</p>` : ''}</div>
        ${item.amount ? `<span class="fee-amount">${esc(item.amount)}</span>` : ''}
      </article>`).join('');
  }

  function renderMethods(methods = []) {
    const target = qs('#payment-method-list');
    if (!target) return;
    const active = Array.isArray(methods) ? methods.filter(item => item && item.enabled && (safeHttps(item.url) || String(item.handle || '').trim())) : [];
    if (!active.length) {
      target.innerHTML = '<div class="empty-state payment-empty"><strong>Payment links are being updated.</strong><p style="margin:.45rem 0 0">Contact chapter leadership for the current approved payment method.</p></div>';
      return;
    }

    target.innerHTML = active.map((item, index) => {
      const url = safeHttps(item.url);
      const handle = String(item.handle || '').trim();
      const label = item.label || item.provider || 'Payment option';
      return `
        <article class="payment-method">
          <div class="payment-provider-mark" aria-hidden="true">${esc(providerInitials(item.provider || label))}</div>
          <p class="eyebrow">${esc(item.provider || 'Payment service')}</p>
          <h3>${esc(label)}</h3>
          ${handle ? `<p class="payment-handle">${esc(handle)}</p>` : '<p class="payment-handle">Open the secure payment link below.</p>'}
          <div class="button-row">
            ${url ? `<a class="button button-primary" href="${esc(url)}" target="_blank" rel="noopener">Open ${esc(item.provider || label)} ↗</a>` : ''}
            ${handle ? `<button class="button copy-handle" type="button" data-copy-index="${index}" data-copy-value="${esc(handle)}">Copy handle</button>` : ''}
          </div>
        </article>`;
    }).join('');

    target.querySelectorAll('.copy-handle').forEach(button => {
      button.addEventListener('click', async () => {
        const value = button.dataset.copyValue || '';
        try {
          await navigator.clipboard.writeText(value);
          const old = button.textContent;
          button.textContent = 'Copied';
          setTimeout(() => { button.textContent = old; }, 1500);
        } catch {
          button.textContent = value;
        }
      });
    });
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
      qs('#memo-instructions').textContent = payments.payment_memo_instructions || 'Include the payment purpose in the payment note when possible.';
      qs('#receipt-note').textContent = payments.receipt_note || '';
      qs('#donation-disclaimer').textContent = payments.donation_disclaimer || '';

      const firmVisible = payments.firm_section_enabled !== false;
      const donationVisible = payments.donation_section_enabled !== false;
      const firmSection = qs('#firm-payments');
      const donationSection = qs('#donations');
      const firmHeroButton = qs('a[href="#firm-payments"]');
      const donationHeroButton = qs('a[href="#donations"]');
      if (firmSection) firmSection.hidden = !firmVisible;
      if (donationSection) donationSection.hidden = !donationVisible;
      if (firmHeroButton) firmHeroButton.hidden = !firmVisible;
      if (donationHeroButton) donationHeroButton.hidden = !donationVisible;

      renderFees(payments.firm_fees);
      renderMethods(payments.payment_methods);

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

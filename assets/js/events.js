(() => {
  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = '') => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const validDate = (value = '') => /^\d{4}-\d{2}-\d{2}$/.test(String(value));
  const formatDateLocal = (value = '') => {
    if (!validDate(value)) return '';
    const d = new Date(`${value}T12:00:00`);
    return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric'}).format(d);
  };
  const safeHttps = (value = '') => {
    try { const u = new URL(String(value).trim()); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; }
  };
  const eventUrl = (event) => event?.slug ? `event.html?slug=${encodeURIComponent(event.slug)}` : 'events.html';

  async function loadEvents() {
    const response = await fetch('data/events.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load events');
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  function enhanceCards(events) {
    const byTitle = new Map(events.map(event => [String(event.title || '').trim(), event]));
    const enhanceContainer = (container) => {
      if (!container) return;
      qsa('.card', container).forEach(card => {
        const title = qs('h3', card)?.textContent?.trim() || '';
        const event = byTitle.get(title);
        if (!event?.slug) return;

        if (!event.registration_enabled) {
          qsa('a.card-link', card).forEach(link => {
            if (/register|rsvp/i.test(link.textContent || '')) link.remove();
          });
        }

        if (card.dataset.eventEnhanced === 'true') return;
        card.dataset.eventEnhanced = 'true';
        card.style.cursor = 'pointer';
        const body = qs('.card-body', card);
        if (body && !qs('.event-detail-link', body)) {
          const link = document.createElement('a');
          link.className = 'card-link event-detail-link';
          link.href = eventUrl(event);
          link.textContent = 'View event →';
          body.appendChild(link);
        }
        card.addEventListener('click', (e) => {
          if (e.target.closest('a,button,input,select,textarea')) return;
          window.location.href = eventUrl(event);
        });
      });
    };

    ['home-events','events-list','past-events'].forEach(id => {
      const container = document.getElementById(id);
      if (!container) return;
      enhanceContainer(container);
      new MutationObserver(() => enhanceContainer(container)).observe(container, { childList: true, subtree: true });
    });
  }

  function setOptionalRow(id, value) {
    const row = document.getElementById(`${id}-row`);
    const valueEl = document.getElementById(id);
    if (!value) { if (row) row.hidden = true; return; }
    if (row) row.hidden = false;
    if (valueEl) valueEl.textContent = value;
  }

  function metaRows(event) {
    const rows = [
      ['Date', formatDateLocal(event.date)],
      ['Time', event.time],
      ['Location', event.location]
    ].filter(([, value]) => value);
    return rows.map(([label,value]) => `<div class="event-meta-row"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('');
  }

  async function renderDetail(events) {
    const shell = document.getElementById('event-detail-shell');
    if (!shell) return;
    const slug = new URLSearchParams(location.search).get('slug') || '';
    const sorted = [...events].filter(e => validDate(e?.date)).sort((a,b) => String(a.date).localeCompare(String(b.date)));
    const event = events.find(e => e?.slug === slug);
    if (!event) {
      document.title = 'Event not found | AIAS Memphis';
      shell.innerHTML = '<section class="section"><div class="container"><div class="empty-state"><strong>Event not found.</strong><p style="margin:.5rem 0 1rem">This event may have been renamed or removed.</p><a class="button button-primary" href="events.html">Back to events</a></div></div></section>';
      return;
    }

    document.title = `${event.title || 'Event'} | AIAS Memphis`;
    const metaDescription = qs('meta[name="description"]');
    if (metaDescription && event.summary) metaDescription.content = event.summary;
    qs('#event-title').textContent = event.title || 'Event';
    qs('#event-summary').textContent = event.summary || '';
    qs('#event-date').textContent = formatDateLocal(event.date) || 'Date TBA';
    setOptionalRow('event-time', event.time || '');
    setOptionalRow('event-location', event.location || '');
    qs('#event-status').textContent = validDate(event.date) && event.date < new Date().toISOString().slice(0,10) ? 'Past event' : 'Upcoming event';
    qs('#event-side-title').textContent = event.title || 'Event information';
    qs('#event-meta').innerHTML = metaRows(event);

    const body = qs('#event-body');
    if (body) {
      if (typeof simpleMarkdown === 'function') body.innerHTML = simpleMarkdown(event.details || event.summary || '');
      else body.textContent = event.details || event.summary || '';
    }

    const imageSection = qs('#event-media-section');
    const image = qs('#event-image');
    if (event.image && imageSection && image) {
      image.src = event.image;
      image.alt = event.image_alt || `${event.title || 'Event'} image`;
      imageSection.hidden = false;
    }

    const registration = event.registration_enabled ? safeHttps(event.registration_url) : '';
    ['event-register-top','event-register-side'].forEach(id => {
      const link = document.getElementById(id);
      if (link && registration) { link.href = registration; link.hidden = false; }
      else if (link) link.hidden = true;
    });
    const noRegistration = qs('#event-no-registration');
    if (noRegistration) noRegistration.hidden = Boolean(registration);

    const index = sorted.indexOf(event);
    const prev = index > 0 ? sorted[index - 1] : null;
    const next = index >= 0 && index < sorted.length - 1 ? sorted[index + 1] : null;
    const prevLink = qs('#event-prev');
    const nextLink = qs('#event-next');
    if (prevLink && prev?.slug) {
      prevLink.href = eventUrl(prev); prevLink.hidden = false; qs('strong', prevLink).textContent = prev.title || 'Previous event';
    }
    if (nextLink && next?.slug) {
      nextLink.href = eventUrl(next); nextLink.hidden = false; qs('strong', nextLink).textContent = next.title || 'Next event';
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const events = await loadEvents();
      enhanceCards(events);
      await renderDetail(events);
    } catch (error) {
      console.error('Event enhancements could not load.', error);
    }
  });
})();

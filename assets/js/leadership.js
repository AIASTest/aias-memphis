(() => {
  const list = document.getElementById('leadership-profiles');
  if (!list) return;

  const escapeHTML = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const safeEmail = (value = '') => {
    const email = String(value).trim();
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : '';
  };

  const safePhoto = (value = '') => {
    const photo = String(value).trim();
    if (!photo) return '';
    if (photo.startsWith('assets/')) return photo;
    try {
      const url = new URL(photo);
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  };

  const initials = (name = '') => {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'AI';
    return `${parts[0][0] || ''}${parts.length > 1 ? parts.at(-1)[0] || '' : ''}`.toUpperCase();
  };

  async function render() {
    try {
      const response = await fetch('data/leadership.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not load leadership');
      const data = await response.json();
      const leaders = Array.isArray(data) ? data : [];

      if (!leaders.length) {
        list.innerHTML = '<div class="empty-state">Leadership information has not been published yet.</div>';
        return;
      }

      list.innerHTML = leaders.map(person => {
        const name = String(person?.name || 'Leadership member').trim();
        const role = String(person?.role || '').trim();
        const bio = String(person?.bio || '').trim();
        const email = safeEmail(person?.email);
        const photo = safePhoto(person?.photo);
        const alt = String(person?.photo_alt || `${name} portrait`).trim();

        return `
          <article class="leader-card">
            <div class="leader-photo-frame">
              ${photo
                ? `<img class="leader-photo" src="${escapeHTML(photo)}" alt="${escapeHTML(alt)}" loading="lazy">`
                : `<div class="leader-initials" aria-label="${escapeHTML(name)}">${escapeHTML(initials(name))}</div>`}
            </div>
            <div class="leader-body">
              ${role ? `<p class="eyebrow leader-role">${escapeHTML(role)}</p>` : ''}
              <h3 class="leader-name">${escapeHTML(name)}</h3>
              ${bio ? `<p class="leader-bio">${escapeHTML(bio)}</p>` : ''}
              ${email ? `<a class="leader-contact" href="mailto:${escapeHTML(email)}">Email ${escapeHTML(name)}</a>` : ''}
            </div>
          </article>`;
      }).join('');
    } catch (error) {
      console.error(error);
      list.innerHTML = '<div class="empty-state">Leadership profiles could not be loaded.</div>';
    }
  }

  render();
})();

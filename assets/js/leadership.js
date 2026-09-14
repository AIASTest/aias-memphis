(() => {
  const list = document.getElementById('leadership-profiles');
  if (!list) return;

  const escapeHTML = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

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
      if (!response.ok) throw new Error('Could not load members');
      const data = await response.json();
      const members = (Array.isArray(data) ? data : []).filter(person => person && person.name && person.slug && person.public_profile !== false).slice(0, 4);

      if (!members.length) {
        list.innerHTML = '<div class="empty-state">Member profiles have not been published yet.</div>';
        return;
      }

      list.innerHTML = members.map(person => {
        const name = String(person.name || 'AIAS member').trim();
        const role = String(person.role || '').trim();
        const bio = String(person.bio || '').trim();
        const photo = safePhoto(person.photo);
        const alt = String(person.photo_alt || `${name} portrait`).trim();
        const href = `member.html?slug=${encodeURIComponent(person.slug)}`;

        return `
          <article class="leader-card leader-card-clickable">
            <a class="leader-profile-link" href="${href}" aria-label="View profile for ${escapeHTML(name)}">
              <div class="leader-photo-frame">
                ${photo
                  ? `<img class="leader-photo" src="${escapeHTML(photo)}" alt="${escapeHTML(alt)}" loading="lazy">`
                  : `<div class="leader-initials" aria-label="${escapeHTML(name)}">${escapeHTML(initials(name))}</div>`}
              </div>
              <div class="leader-body">
                ${role ? `<p class="eyebrow leader-role">${escapeHTML(role)}</p>` : ''}
                <h3 class="leader-name">${escapeHTML(name)}</h3>
                ${bio ? `<p class="leader-bio">${escapeHTML(bio.length > 170 ? `${bio.slice(0,167)}…` : bio)}</p>` : ''}
                <span class="card-link">View member profile →</span>
              </div>
            </a>
          </article>`;
      }).join('');
    } catch (error) {
      console.error(error);
      list.innerHTML = '<div class="empty-state">Member profiles could not be loaded.</div>';
    }
  }

  render();
})();

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
    try { const url = new URL(photo); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
  };
  const initials = (name = '') => {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'AI';
    return `${parts[0][0] || ''}${parts.length > 1 ? parts.at(-1)[0] || '' : ''}`.toUpperCase();
  };
  const normalize = (value = '') => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function projectMatchesMember(project, member) {
    if (project?.member_slug && member?.slug) return project.member_slug === member.slug;
    return !project?.member_slug && normalize(project?.student) && normalize(project.student) === normalize(member?.name);
  }

  function simpleBio(value = '') {
    return escapeHTML(String(value || '')).replace(/\n/g, '<br>');
  }

  function modalMarkup(member, projects) {
    const name = String(member?.name || 'AIAS member');
    const photo = safePhoto(member?.photo);
    const linked = projects.filter(project => projectMatchesMember(project, member));
    const email = safeEmail(member?.email);
    const projectLinks = linked.slice(0, 3).map(project => `<a class="member-mini-project" href="project.html?slug=${encodeURIComponent(project.slug || '')}"><strong>${escapeHTML(project.title || 'Project')}</strong><span>${escapeHTML(project.year || project.studio || '')} →</span></a>`).join('');
    return `<div class="member-dialog-profile">
      <div class="member-dialog-photo">${photo ? `<img src="${escapeHTML(photo)}" alt="${escapeHTML(member.photo_alt || `${name} portrait`)}">` : `<div class="member-card-initials" aria-label="${escapeHTML(name)}">${escapeHTML(initials(name))}</div>`}</div>
      <div class="member-dialog-body">
        ${member.role ? `<p class="eyebrow">${escapeHTML(member.role)}</p>` : ''}
        <h2 id="about-member-dialog-name">${escapeHTML(name)}</h2>
        ${(member.program || member.interests) ? `<div class="member-dialog-meta">${member.program ? `<span class="member-meta-chip">${escapeHTML(member.program)}</span>` : ''}${member.interests ? `<span class="member-meta-chip">${escapeHTML(member.interests)}</span>` : ''}</div>` : ''}
        ${member.bio ? `<p class="member-dialog-bio">${simpleBio(member.bio)}</p>` : '<p class="member-dialog-bio">This member has not added an introduction yet.</p>'}
        ${member.description ? `<div class="content-prose">${simpleMarkdown(member.description)}</div>` : ''}
        ${linked.length ? `<div class="member-dialog-projects"><strong>Published student work</strong><div class="member-mini-projects">${projectLinks}</div>${linked.length > 3 ? `<p class="muted small-text" style="margin-top:.7rem">+ ${linked.length - 3} more on the full profile.</p>` : ''}</div>` : ''}
        <div class="button-row">
          <a class="button button-primary" href="member.html?slug=${encodeURIComponent(member.slug)}">View full profile</a>
          ${email ? `<a class="button button-outline" href="mailto:${escapeHTML(email)}">Email ${escapeHTML(name)}</a>` : ''}
        </div>
      </div>
    </div>`;
  }

  async function render() {
    try {
      const [memberResponse, projectResponse] = await Promise.all([
        fetch('data/leadership.json', { cache: 'no-store' }),
        fetch('data/projects.json', { cache: 'no-store' })
      ]);
      if (!memberResponse.ok) throw new Error('Could not load members');
      const data = await memberResponse.json();
      const projectsData = projectResponse.ok ? await projectResponse.json() : [];
      const allMembers = (Array.isArray(data) ? data : []).filter(person => person && person.name && person.slug && person.public_profile !== false);
      const members = allMembers.slice(0, 4);
      const projects = Array.isArray(projectsData) ? projectsData : [];

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
        return `<article class="leader-card leader-card-clickable">
          <a class="leader-profile-link" href="member.html?slug=${encodeURIComponent(person.slug)}" data-member-slug="${escapeHTML(person.slug)}" aria-label="Open profile for ${escapeHTML(name)}">
            <div class="leader-photo-frame">${photo ? `<img class="leader-photo" src="${escapeHTML(photo)}" alt="${escapeHTML(alt)}" loading="lazy">` : `<div class="leader-initials" aria-label="${escapeHTML(name)}">${escapeHTML(initials(name))}</div>`}</div>
            <div class="leader-body">
              ${role ? `<p class="eyebrow leader-role">${escapeHTML(role)}</p>` : ''}
              <h3 class="leader-name">${escapeHTML(name)}</h3>
              ${bio ? `<p class="leader-bio">${escapeHTML(bio.length > 170 ? `${bio.slice(0,167)}…` : bio)}</p>` : ''}
              <span class="card-link">Quick view →</span>
            </div>
          </a>
        </article>`;
      }).join('');

      const dialog = document.getElementById('about-member-dialog');
      const content = document.getElementById('about-member-dialog-content');
      const close = document.getElementById('about-member-dialog-close');
      list.querySelectorAll('[data-member-slug]').forEach(link => link.addEventListener('click', event => {
        if (!dialog || !content || typeof dialog.showModal !== 'function') return;
        const member = allMembers.find(item => item.slug === link.dataset.memberSlug);
        if (!member) return;
        event.preventDefault();
        content.innerHTML = modalMarkup(member, projects);
        dialog.showModal();
      }));
      close?.addEventListener('click', () => dialog?.close());
      dialog?.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    } catch (error) {
      console.error(error);
      list.innerHTML = '<div class="empty-state">Member profiles could not be loaded.</div>';
    }
  }

  render();
})();

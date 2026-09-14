(() => {
  const getMembers = async () => asArray(await loadJSON('data/leadership.json'));
  const getProjects = async () => asArray(await loadJSON('data/projects.json'));
  const normalize = (value = '') => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const memberUrl = (member = {}) => member?.slug ? path(`member.html?slug=${encodeURIComponent(member.slug)}`) : path('members.html');
  const initials = (name = '') => {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'AI';
    return `${parts[0][0] || ''}${parts.length > 1 ? parts.at(-1)[0] || '' : ''}`.toUpperCase();
  };
  const memberPhoto = (member = {}) => safeMediaUrl(member.photo || '');
  const memberProjects = (member = {}, projects = []) => projects.filter(project => {
    if (project?.member_slug && member?.slug) return project.member_slug === member.slug;
    return !project?.member_slug && normalize(project?.student) && normalize(project.student) === normalize(member?.name);
  });
  const visibleMembers = (members = []) => members.filter(member => member && member.name && member.slug && member.public_profile !== false);

  function photoMarkup(member, className = 'member-card-photo') {
    const photo = memberPhoto(member);
    const name = String(member?.name || 'AIAS member');
    const alt = String(member?.photo_alt || `${name} portrait`);
    return `<div class="${className}">${photo
      ? `<img src="${escapeHTML(photo)}" alt="${escapeHTML(alt)}" loading="lazy">`
      : `<div class="member-card-initials" aria-label="${escapeHTML(name)}">${escapeHTML(initials(name))}</div>`}</div>`;
  }

  function cardMarkup(member, projects) {
    const linked = memberProjects(member, projects);
    const program = String(member.program || '').trim();
    return `<button class="member-card-button" type="button" data-member-slug="${escapeHTML(member.slug)}" aria-label="Open profile for ${escapeHTML(member.name)}">
      ${photoMarkup(member)}
      <div class="member-card-body">
        ${member.role ? `<p class="eyebrow member-card-role">${escapeHTML(member.role)}</p>` : ''}
        <h3>${escapeHTML(member.name)}</h3>
        ${program ? `<p class="member-card-program">${escapeHTML(program)}</p>` : ''}
        ${member.bio ? `<p class="muted">${escapeHTML(member.bio.length > 150 ? `${member.bio.slice(0,147)}…` : member.bio)}</p>` : ''}
        <span class="member-card-projects">${linked.length} published project${linked.length === 1 ? '' : 's'} · View profile →</span>
      </div>
    </button>`;
  }

  function modalMarkup(member, projects) {
    const linked = memberProjects(member, projects);
    const email = safeEmail(member.email);
    const meta = [member.program, member.interests].filter(Boolean);
    const miniProjects = linked.slice(0, 3).map(project => `<a class="member-mini-project" href="${escapeHTML(projectUrl(project))}"><strong>${escapeHTML(project.title || 'Project')}</strong><span>${escapeHTML(project.year || project.studio || '')} →</span></a>`).join('');
    return `<div class="member-dialog-profile">
      ${photoMarkup(member, 'member-dialog-photo')}
      <div class="member-dialog-body">
        ${member.role ? `<p class="eyebrow">${escapeHTML(member.role)}</p>` : ''}
        <h2 id="member-dialog-name">${escapeHTML(member.name)}</h2>
        ${meta.length ? `<div class="member-dialog-meta">${meta.map(item => `<span class="member-meta-chip">${escapeHTML(item)}</span>`).join('')}</div>` : ''}
        ${member.bio ? `<p class="member-dialog-bio">${escapeHTML(member.bio)}</p>` : '<p class="member-dialog-bio">This member has not added an introduction yet.</p>'}
        ${member.description ? `<div class="content-prose">${simpleMarkdown(member.description)}</div>` : ''}
        ${linked.length ? `<div class="member-dialog-projects"><strong>Published student work</strong><div class="member-mini-projects">${miniProjects}</div>${linked.length > 3 ? `<p class="muted small-text" style="margin-top:.7rem">+ ${linked.length - 3} more project${linked.length - 3 === 1 ? '' : 's'} on the full profile.</p>` : ''}</div>` : ''}
        <div class="button-row">
          <a class="button button-primary" href="${escapeHTML(memberUrl(member))}">View full profile</a>
          ${email ? `<a class="button button-outline" href="mailto:${escapeHTML(email)}">Email ${escapeHTML(member.name)}</a>` : ''}
        </div>
      </div>
    </div>`;
  }

  async function initDirectory() {
    const grid = document.getElementById('members-grid');
    if (!grid) return;
    const [membersRaw, projects, site] = await Promise.all([getMembers(), getProjects(), loadJSON('data/site.json').catch(() => ({}))]);
    const members = visibleMembers(membersRaw);
    const dialog = document.getElementById('member-dialog');
    const dialogContent = document.getElementById('member-dialog-content');
    const close = document.getElementById('member-dialog-close');
    const search = document.getElementById('member-search');
    const count = document.getElementById('member-result-count');
    const membership = safeUrl(site?.membership_url);
    ['members-join-link','members-bottom-join-link'].forEach(id => {
      const link = document.getElementById(id);
      if (link && membership) { link.href = membership; link.hidden = false; }
    });

    const draw = (query = '') => {
      const q = String(query).trim().toLowerCase();
      const filtered = members.filter(member => !q || [member.name, member.role, member.program, member.interests, member.bio].some(value => String(value || '').toLowerCase().includes(q)));
      grid.innerHTML = filtered.length ? filtered.map(member => cardMarkup(member, projects)).join('') : '<div class="empty-state">No member profiles matched that search.</div>';
      if (count) count.textContent = `${filtered.length} member profile${filtered.length === 1 ? '' : 's'}`;
      grid.querySelectorAll('[data-member-slug]').forEach(button => button.addEventListener('click', () => {
        const member = members.find(item => item.slug === button.dataset.memberSlug);
        if (!member || !dialog || !dialogContent) return;
        dialogContent.innerHTML = modalMarkup(member, projects);
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      }));
    };

    search?.addEventListener('input', () => draw(search.value));
    close?.addEventListener('click', () => dialog?.close ? dialog.close() : dialog?.removeAttribute('open'));
    dialog?.addEventListener('click', event => {
      if (event.target === dialog) dialog.close ? dialog.close() : dialog.removeAttribute('open');
    });
    draw();
  }

  function metaRows(member) {
    const rows = [
      ['Chapter role', member.role],
      ['Program / year', member.program],
      ['Interests', member.interests]
    ].filter(([, value]) => String(value || '').trim());
    return rows.map(([label, value]) => `<div class="member-meta-row"><strong>${escapeHTML(label)}</strong><span>${escapeHTML(value)}</span></div>`).join('');
  }

  async function initMemberDetail() {
    const shell = document.getElementById('member-detail-shell');
    if (!shell) return;
    const slug = new URLSearchParams(window.location.search).get('slug') || '';
    const [membersRaw, projects] = await Promise.all([getMembers(), getProjects()]);
    const members = visibleMembers(membersRaw);
    const member = members.find(item => item.slug === slug);
    if (!member) {
      document.title = 'Member not found | AIAS Memphis';
      shell.innerHTML = '<section class="section"><div class="container"><div class="empty-state"><strong>Member profile not found.</strong><p style="margin:.5rem 0 1rem">This profile may have been renamed or removed.</p><a class="button button-primary" href="members.html">Back to chapter members</a></div></div></section>';
      return;
    }

    const linked = memberProjects(member, projects);
    document.title = `${member.name} | AIAS Memphis`;
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.content = member.bio || `${member.name}, ${member.role || 'AIAS Memphis member'}.`;
    setText('#member-detail-role', member.role || 'Chapter member');
    setText('#member-detail-name', member.name);
    setText('#member-detail-program', member.program || '');
    setText('#member-detail-bio', member.bio || '');
    const photo = document.getElementById('member-detail-photo');
    if (photo) photo.innerHTML = photoMarkup(member, 'member-detail-photo-inner').replace('member-detail-photo-inner','member-detail-photo-inner');
    const description = member.description || member.bio || 'This member has not added a longer profile description yet.';
    setHTML('#member-detail-description', simpleMarkdown(description));
    setHTML('#member-detail-meta', metaRows(member));

    const email = safeEmail(member.email);
    const emailLink = document.getElementById('member-detail-email');
    if (emailLink && email) { emailLink.href = `mailto:${email}`; emailLink.hidden = false; }
    setText('#member-projects-heading', `${member.name}'s projects`);
    setText('#member-projects-copy', linked.length ? `${linked.length} project${linked.length === 1 ? '' : 's'} published through the chapter.` : 'No projects have been linked to this member profile yet.');
    setHTML('#member-projects', linked.length ? linked.map(projectCard).join('') : '<div class="empty-state">No published projects are linked to this profile yet.</div>');
  }

  document.addEventListener('DOMContentLoaded', () => {
    initDirectory().catch(error => console.error('Member directory failed to load.', error));
    initMemberDetail().catch(error => console.error('Member profile failed to load.', error));
  });
})();

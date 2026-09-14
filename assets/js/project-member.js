(() => {
  const normalize = (value = '') => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  async function init() {
    const link = document.getElementById('project-member-profile');
    if (!link) return;
    const slug = new URLSearchParams(window.location.search).get('slug') || '';
    try {
      const [projectsRaw, membersRaw] = await Promise.all([
        fetch('data/projects.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : []),
        fetch('data/leadership.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : [])
      ]);
      const projects = Array.isArray(projectsRaw) ? projectsRaw : [];
      const members = Array.isArray(membersRaw) ? membersRaw : [];
      const project = projects.find(item => item?.slug === slug);
      if (!project) return;
      const member = project.member_slug
        ? members.find(item => item?.slug === project.member_slug && item?.public_profile !== false)
        : members.find(item => item?.public_profile !== false && normalize(item?.name) && normalize(item.name) === normalize(project.student));
      if (!member?.slug) return;
      link.href = `member.html?slug=${encodeURIComponent(member.slug)}`;
      link.textContent = `View ${member.name || 'member'} profile →`;
      link.hidden = false;
    } catch (error) {
      console.warn('Member profile link could not be loaded.', error);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();

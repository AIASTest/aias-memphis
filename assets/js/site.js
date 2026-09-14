const ROOT = document.documentElement.dataset.root || '';
const path = (file = '') => `${ROOT}${file}`;
const asArray = (value) => Array.isArray(value) ? value : [];

async function loadJSON(file) {
  const response = await fetch(path(file), { cache: 'no-store' });
  if (!response.ok) throw new Error(`Could not load ${file}`);
  return response.json();
}

function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeUrl(url = '') {
  const text = String(url).trim();
  if (!text) return '';
  try {
    const parsed = new URL(text);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

function safeEmail(email = '') {
  const value = String(email).trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? value : '';
}

function safeMediaUrl(url = '') {
  const value = String(url).trim();
  if (!value) return '';
  if (value.startsWith('assets/')) return path(value);
  const external = safeUrl(value);
  return external && !external.startsWith('mailto:') ? external : '';
}

function safeContentLink(url = '') {
  const value = String(url).trim();
  if (!value) return '';
  const external = safeUrl(value);
  if (external) return external;
  if (/^[a-zA-Z0-9][a-zA-Z0-9._/?#=&%+-]*$/.test(value)) return path(value);
  return '';
}

function simpleMarkdown(markdown = '') {
  const lines = escapeHTML(markdown).split(/\r?\n/);
  let html = '';
  let inList = false;

  const inline = (text) => text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
      const src = safeMediaUrl(url);
      return src ? `<img src="${escapeHTML(src)}" alt="${alt}">` : '';
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
      const href = safeContentLink(url);
      if (!href) return label;
      const external = /^https?:/i.test(href);
      return `<a href="${escapeHTML(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
    })
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('- ')) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(line.slice(2))}</li>`;
      continue;
    }
    if (inList) { html += '</ul>'; inList = false; }
    if (!line) continue;
    if (line.startsWith('### ')) html += `<h3>${inline(line.slice(4))}</h3>`;
    else if (line.startsWith('## ')) html += `<h2>${inline(line.slice(3))}</h2>`;
    else if (line.startsWith('# ')) html += `<h2>${inline(line.slice(2))}</h2>`;
    else html += `<p>${inline(line)}</p>`;
  }
  if (inList) html += '</ul>';
  return html;
}

function validDateString(value = '') {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

function formatDate(dateString) {
  if (!validDateString(dateString)) return '';
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateSort(a, b) {
  return String(a?.date || '9999-12-31').localeCompare(String(b?.date || '9999-12-31'));
}

function setText(selector, value = '') {
  const el = document.querySelector(selector);
  if (el) el.textContent = value || '';
}

function setHTML(selector, html = '') {
  const el = document.querySelector(selector);
  if (el) el.innerHTML = html;
}

function pageName() {
  return document.body.dataset.page || 'home';
}

function projectUrl(project = {}) {
  const slug = String(project.slug || '').trim();
  return slug ? path(`project.html?slug=${encodeURIComponent(slug)}`) : path('projects.html');
}

function projectCover(project = {}) {
  return safeMediaUrl(project.cover_image || project.image || '');
}

function projectGallery(project = {}) {
  const gallery = asArray(project.gallery)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const image = safeMediaUrl(item.image);
      if (!image) return null;
      return {
        image,
        alt: String(item.alt || project.cover_image_alt || `${project.title || 'Student project'} image`),
        caption: String(item.caption || '')
      };
    })
    .filter(Boolean);

  if (gallery.length) return gallery;
  const cover = projectCover(project);
  return cover ? [{
    image: cover,
    alt: String(project.cover_image_alt || project.image_alt || `${project.title || 'Student project'} image`),
    caption: ''
  }] : [];
}

async function buildChrome() {
  const [siteRaw, pagesRaw] = await Promise.all([
    loadJSON('data/site.json'),
    loadJSON('data/pages.json').catch(() => [])
  ]);
  const site = siteRaw && typeof siteRaw === 'object' && !Array.isArray(siteRaw) ? siteRaw : {};
  const pages = asArray(pagesRaw);
  const header = document.querySelector('#site-header');
  const footer = document.querySelector('#site-footer');
  const current = pageName();
  const activeSlug = current === 'custom' ? new URLSearchParams(window.location.search).get('slug') : '';
  const membershipUrl = safeUrl(site.membership_url);
  const departmentUrl = safeUrl(site.department_url);
  const instagramUrl = safeUrl(site.instagram_url);
  const email = safeEmail(site.contact_email);

  const customLinks = pages
    .filter(p => p && p.show_in_nav && p.slug && p.title)
    .map(p => `<a href="${path(`page.html?slug=${encodeURIComponent(p.slug)}`)}" ${activeSlug === p.slug ? 'aria-current="page"' : ''}>${escapeHTML(p.nav_label || p.title)}</a>`)
    .join('');

  if (header) {
    header.innerHTML = `
      ${site.demo_notice ? `<div class="demo-banner" role="status">${escapeHTML(site.demo_notice)}</div>` : ''}
      <div class="site-header">
        <div class="nav-shell">
          <a class="brand" href="${path('index.html')}" aria-label="${escapeHTML(site.short_name || 'AIAS Memphis')} home">
            <span class="brand-mark" aria-hidden="true">AIAS</span>
            <span>${escapeHTML(site.short_name || 'AIAS Memphis')}</span>
          </a>
          <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="main-nav">Menu</button>
          <nav class="nav-links" id="main-nav" aria-label="Primary navigation">
            <a href="${path('events.html')}" ${current === 'events' ? 'aria-current="page"' : ''}>Events</a>
            <a href="${path('projects.html')}" ${(current === 'projects' || current === 'project') ? 'aria-current="page"' : ''}>Student Work</a>
            <a href="${path('jobs.html')}" ${current === 'jobs' ? 'aria-current="page"' : ''}>Jobs</a>
            <a href="${path('about.html')}" ${current === 'about' ? 'aria-current="page"' : ''}>About</a>
            ${customLinks}
            ${membershipUrl ? `<a class="nav-cta" href="${escapeHTML(membershipUrl)}" target="_blank" rel="noopener">Join AIAS</a>` : ''}
          </nav>
        </div>
      </div>`;

    const toggle = header.querySelector('.nav-toggle');
    const nav = header.querySelector('#main-nav');
    const closeMenu = () => {
      nav?.classList.remove('open');
      toggle?.setAttribute('aria-expanded', 'false');
    };
    toggle?.addEventListener('click', () => {
      const open = nav?.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(Boolean(open)));
    });
    nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  }

  if (footer) {
    const resourceLinks = [
      departmentUrl ? `<a href="${escapeHTML(departmentUrl)}" target="_blank" rel="noopener">UofM Architecture</a>` : '',
      instagramUrl ? `<a href="${escapeHTML(instagramUrl)}" target="_blank" rel="noopener">Instagram</a>` : '',
      `<a href="${path('admin/')}">Leadership Admin</a>`
    ].filter(Boolean).join('');

    footer.innerHTML = `
      <div class="site-footer">
        <div class="container">
          <div class="footer-grid">
            <div>
              <h3>${escapeHTML(site.chapter_name || 'AIAS at the University of Memphis')}</h3>
              <p>${escapeHTML(site.tagline || '')}</p>
              ${email ? `<p><a href="mailto:${escapeHTML(email)}">${escapeHTML(email)}</a></p>` : ''}
            </div>
            <div class="footer-links">
              <a href="${path('events.html')}">Events</a>
              <a href="${path('projects.html')}">Student Work</a>
              <a href="${path('jobs.html')}">Jobs</a>
              <a href="${path('about.html')}">About</a>
              ${resourceLinks}
            </div>
          </div>
          <div class="footer-bottom">Student-led chapter website. External opportunities and links are provided for convenience; verify details with the original source.</div>
        </div>
      </div>`;
  }

  return site;
}

function eventCard(event = {}) {
  const register = safeUrl(event.registration_url);
  const image = safeMediaUrl(event.image);
  const meta = [formatDate(event.date), event.time ? escapeHTML(event.time) : ''].filter(Boolean).join(' · ');
  return `
    <article class="card">
      ${image ? `<img class="card-media" src="${escapeHTML(image)}" alt="${escapeHTML(event.image_alt || `${event.title || 'Event'} graphic`)}" loading="lazy">` : ''}
      <div class="card-body">
        ${meta ? `<div class="card-meta">${meta}</div>` : ''}
        <h3>${escapeHTML(event.title || 'Untitled event')}</h3>
        ${event.location ? `<p class="muted">${escapeHTML(event.location)}</p>` : ''}
        ${event.summary ? `<p>${escapeHTML(event.summary)}</p>` : ''}
        ${register ? `<a class="card-link" href="${escapeHTML(register)}" target="_blank" rel="noopener">Register / RSVP →</a>` : ''}
      </div>
    </article>`;
}

function projectCard(project = {}) {
  const image = projectCover(project);
  const meta = [project.project_type, project.studio, project.year].filter(Boolean).map(escapeHTML).join(' · ');
  const href = projectUrl(project);
  return `
    <article class="card project-card">
      <a class="project-card-link" href="${escapeHTML(href)}" aria-label="View project: ${escapeHTML(project.title || 'Untitled project')}">
        ${image ? `<img class="card-media" src="${escapeHTML(image)}" alt="${escapeHTML(project.cover_image_alt || project.image_alt || `${project.title || 'Student project'} by ${project.student || 'a student'}`)}" loading="lazy">` : ''}
        <div class="card-body">
          ${meta ? `<div class="card-meta">${meta}</div>` : ''}
          <h3>${escapeHTML(project.title || 'Untitled project')}</h3>
          ${project.student ? `<p class="muted">${escapeHTML(project.student)}</p>` : ''}
          ${project.summary ? `<p>${escapeHTML(project.summary)}</p>` : ''}
          <span class="card-link">View project →</span>
        </div>
      </a>
    </article>`;
}

function jobCard(job = {}) {
  const apply = safeUrl(job.apply_url);
  const posted = formatDate(job.posted);
  const deadline = formatDate(job.deadline);
  return `
    <article class="job-card">
      <div class="job-top">
        <div>
          ${job.company ? `<div class="card-meta">${escapeHTML(job.company)}</div>` : ''}
          <h3>${escapeHTML(job.title || 'Opportunity')}</h3>
        </div>
        ${job.type ? `<span class="badge">${escapeHTML(job.type)}</span>` : ''}
      </div>
      ${job.location ? `<p class="muted">${escapeHTML(job.location)}</p>` : ''}
      ${job.summary ? `<p>${escapeHTML(job.summary)}</p>` : ''}
      ${(posted || deadline) ? `<p class="job-dates muted">${posted ? `<span><strong>Posted:</strong> ${posted}</span>` : ''}${deadline ? `<span><strong>Deadline:</strong> ${deadline}</span>` : ''}</p>` : ''}
      ${apply ? `<a class="button button-outline" href="${escapeHTML(apply)}" target="_blank" rel="noopener">View / Apply</a>` : '<span class="muted small-text">Application link not provided.</span>'}
    </article>`;
}

async function initHome(site) {
  setText('#hero-title', site.hero_title || 'Built by architecture students, for architecture students.');
  setText('#hero-text', site.hero_text || '');
  const [eventsRaw, projectsRaw, jobsRaw] = await Promise.all([
    loadJSON('data/events.json'), loadJSON('data/projects.json'), loadJSON('data/jobs.json')
  ]);
  const events = asArray(eventsRaw);
  const projects = asArray(projectsRaw);
  const jobs = asArray(jobsRaw);
  const today = todayISO();

  const upcoming = events
    .filter(e => validDateString(e?.date) && e.date >= today)
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || dateSort(a, b))
    .slice(0, 3);
  const featured = projects.filter(p => p?.featured);
  const featuredProjects = (featured.length ? featured : projects).slice(0, 3);
  const activeJobs = jobs
    .filter(j => j?.active && (!validDateString(j.deadline) || j.deadline >= today))
    .sort((a, b) => String(a.deadline || '9999-12-31').localeCompare(String(b.deadline || '9999-12-31')))
    .slice(0, 2);

  setHTML('#home-events', upcoming.length ? upcoming.map(eventCard).join('') : '<div class="empty-state">No upcoming events posted yet.</div>');
  setHTML('#home-projects', featuredProjects.length ? featuredProjects.map(projectCard).join('') : '<div class="empty-state">No student projects posted yet.</div>');
  setHTML('#home-jobs', activeJobs.length ? activeJobs.map(jobCard).join('') : '<div class="empty-state">No active opportunities posted right now.</div>');
}

async function initEvents() {
  const events = asArray(await loadJSON('data/events.json'));
  const today = todayISO();
  const dated = events.filter(e => validDateString(e?.date)).sort(dateSort);
  const upcoming = dated.filter(e => e.date >= today);
  const past = dated.filter(e => e.date < today).reverse();
  const undated = events.filter(e => !validDateString(e?.date));
  setHTML('#events-list', upcoming.length ? upcoming.map(eventCard).join('') : '<div class="empty-state">No upcoming events are posted.</div>');
  const pastWrap = document.querySelector('#past-events-wrap');
  if (pastWrap && past.length) {
    pastWrap.hidden = false;
    setHTML('#past-events', past.map(eventCard).join(''));
  }
  if (undated.length) console.warn('Some events have invalid or missing dates and are hidden.', undated);
}

async function initProjects() {
  const projects = asArray(await loadJSON('data/projects.json'));
  const sorted = [...projects].sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || String(b.year || '').localeCompare(String(a.year || '')));
  setHTML('#projects-list', sorted.length ? sorted.map(projectCard).join('') : '<div class="empty-state">No student projects have been posted yet.</div>');
}

function renderProjectGallery(project) {
  const items = projectGallery(project);
  const stage = document.getElementById('project-gallery-stage');
  const image = document.getElementById('project-gallery-image');
  const caption = document.getElementById('project-gallery-caption');
  const count = document.getElementById('project-gallery-count');
  const thumbs = document.getElementById('project-gallery-thumbs');
  const previous = document.getElementById('project-gallery-prev');
  const next = document.getElementById('project-gallery-next');
  const clickNext = document.getElementById('project-gallery-click-next');

  if (!stage || !image || !caption || !count || !thumbs || !previous || !next || !clickNext) return;
  if (!items.length) {
    stage.innerHTML = '<div class="empty-state">No project images have been published yet.</div>';
    thumbs.innerHTML = '';
    return;
  }

  let activeIndex = 0;
  const draw = () => {
    const item = items[activeIndex];
    image.src = item.image;
    image.alt = item.alt;
    caption.textContent = item.caption || '';
    caption.hidden = !item.caption;
    count.textContent = `${activeIndex + 1} / ${items.length}`;
    clickNext.setAttribute('aria-label', items.length > 1 ? `Show next project image. Current image ${activeIndex + 1} of ${items.length}.` : 'Project image');
    previous.disabled = items.length <= 1;
    next.disabled = items.length <= 1;
    thumbs.querySelectorAll('button').forEach((button, index) => {
      button.classList.toggle('active', index === activeIndex);
      button.setAttribute('aria-current', index === activeIndex ? 'true' : 'false');
    });
  };

  const go = (offset) => {
    if (items.length <= 1) return;
    activeIndex = (activeIndex + offset + items.length) % items.length;
    draw();
  };

  thumbs.innerHTML = items.map((item, index) => `
    <button type="button" class="project-gallery-thumb" data-gallery-index="${index}" aria-label="Show image ${index + 1}${item.caption ? `: ${escapeHTML(item.caption)}` : ''}">
      <img src="${escapeHTML(item.image)}" alt="" loading="lazy">
    </button>`).join('');

  thumbs.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => {
      activeIndex = Number(button.dataset.galleryIndex) || 0;
      draw();
    });
  });
  previous.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  clickNext.addEventListener('click', () => go(1));
  document.addEventListener('keydown', (event) => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (event.key === 'ArrowLeft') go(-1);
    if (event.key === 'ArrowRight') go(1);
  });
  draw();
}

function projectMetaRows(project = {}) {
  const rows = [
    ['Student', project.student],
    ['Studio / course', project.studio],
    ['Semester', project.semester],
    ['Year', project.year],
    ['Project type', project.project_type]
  ].filter(([, value]) => value);
  return rows.map(([label, value]) => `<div class="project-meta-row"><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join('');
}

async function initProject() {
  const slug = new URLSearchParams(window.location.search).get('slug') || '';
  const projects = asArray(await loadJSON('data/projects.json'));
  const project = projects.find(p => p?.slug === slug);
  const shell = document.getElementById('project-detail-shell');

  if (!project) {
    document.title = 'Project not found | AIAS Memphis';
    if (shell) shell.innerHTML = '<section class="section"><div class="container"><div class="empty-state"><strong>Project not found.</strong><p style="margin:.5rem 0 1rem">This project may have been renamed or removed.</p><a class="button button-primary" href="projects.html">Back to student work</a></div></div></section>';
    return;
  }

  document.title = `${project.title || 'Student project'} | AIAS Memphis`;
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription && project.summary) metaDescription.content = project.summary;

  setText('#project-title', project.title || 'Untitled project');
  setText('#project-summary', project.summary || '');
  setText('#project-student', project.student ? `By ${project.student}` : '');
  setText('#project-kicker', project.project_type || project.studio || 'Student project');
  setHTML('#project-meta', projectMetaRows(project));
  setHTML('#project-body', simpleMarkdown(project.body || project.summary || ''));

  const external = safeUrl(project.external_url);
  const externalLink = document.getElementById('project-external-link');
  if (externalLink && external) {
    externalLink.hidden = false;
    externalLink.href = external;
  }

  renderProjectGallery(project);

  const currentIndex = projects.indexOf(project);
  const previousProject = currentIndex > 0 ? projects[currentIndex - 1] : null;
  const nextProject = currentIndex >= 0 && currentIndex < projects.length - 1 ? projects[currentIndex + 1] : null;
  const prevLink = document.getElementById('project-prev-project');
  const nextLink = document.getElementById('project-next-project');
  if (prevLink && previousProject?.slug) {
    prevLink.hidden = false;
    prevLink.href = projectUrl(previousProject);
    prevLink.querySelector('strong').textContent = previousProject.title || 'Previous project';
  }
  if (nextLink && nextProject?.slug) {
    nextLink.hidden = false;
    nextLink.href = projectUrl(nextProject);
    nextLink.querySelector('strong').textContent = nextProject.title || 'Next project';
  }
}

async function initJobs() {
  const jobs = asArray(await loadJSON('data/jobs.json'));
  const today = todayISO();
  const active = jobs
    .filter(j => j?.active && (!validDateString(j.deadline) || j.deadline >= today))
    .sort((a, b) => String(a.deadline || '9999-12-31').localeCompare(String(b.deadline || '9999-12-31')));
  setHTML('#jobs-list', active.length ? active.map(jobCard).join('') : '<div class="empty-state">No active jobs or internships are posted right now.</div>');
}

function setOptionalLink(id, url, label) {
  const el = document.getElementById(id);
  if (!el) return;
  const safe = safeUrl(url);
  if (!safe) { el.hidden = true; return; }
  el.hidden = false;
  el.href = safe;
  if (label) el.textContent = label;
}

async function initAbout(site) {
  setText('#about-copy', site.about_text || '');
  setOptionalLink('membership-link', site.membership_url, 'AIAS membership');
  setOptionalLink('department-link', site.department_url, 'UofM Architecture');
  setOptionalLink('instagram-link', site.instagram_url, 'Instagram');
  const email = safeEmail(site.contact_email);
  const contact = document.getElementById('contact-link');
  if (contact && email) {
    contact.hidden = false;
    contact.href = `mailto:${email}`;
    contact.textContent = 'Email the chapter';
  }

  const leaders = asArray(await loadJSON('data/leadership.json'));
  setHTML('#leadership-list', leaders.length ? leaders.map(person => {
    const personEmail = safeEmail(person?.email);
    return `<div class="person"><strong>${escapeHTML(person?.name || 'Leadership member')}</strong><span>${escapeHTML(person?.role || '')}</span>${personEmail ? `<div><a href="mailto:${escapeHTML(personEmail)}">${escapeHTML(personEmail)}</a></div>` : ''}</div>`;
  }).join('') : '<div class="empty-state">Leadership information has not been published yet.</div>');
}

async function initCustomPage() {
  const slug = new URLSearchParams(window.location.search).get('slug') || '';
  const pages = asArray(await loadJSON('data/pages.json'));
  const page = pages.find(p => p?.slug === slug);
  if (!page) {
    document.title = 'Page not found | AIAS Memphis';
    setText('#custom-title', 'Page not found');
    setText('#custom-summary', 'This page may have been renamed or removed.');
    setHTML('#custom-body', '<p><a class="button button-primary" href="index.html">Return home</a></p>');
    return;
  }
  document.title = `${page.title || 'Chapter page'} | AIAS Memphis`;
  setText('#custom-title', page.title || 'Chapter page');
  setText('#custom-summary', page.summary || '');
  const image = document.querySelector('#custom-image');
  const imageUrl = safeMediaUrl(page.hero_image);
  if (image && imageUrl) {
    image.src = imageUrl;
    image.alt = page.hero_image_alt || `${page.title || 'Chapter page'} header image`;
    image.hidden = false;
  }
  setHTML('#custom-body', simpleMarkdown(page.body || ''));
}

async function main() {
  try {
    const site = await buildChrome();
    const page = pageName();
    if (page === 'home') await initHome(site);
    if (page === 'events') await initEvents();
    if (page === 'projects') await initProjects();
    if (page === 'project') await initProject();
    if (page === 'jobs') await initJobs();
    if (page === 'about') await initAbout(site);
    if (page === 'custom') await initCustomPage();
  } catch (error) {
    console.error(error);
    const main = document.querySelector('main');
    if (main) main.innerHTML = '<div class="container section"><div class="empty-state"><strong>Website content could not be loaded.</strong><br>Please refresh the page. If the problem continues, chapter leadership can check the Admin Help Center.</div></div>';
  }
}

document.addEventListener('DOMContentLoaded', main);

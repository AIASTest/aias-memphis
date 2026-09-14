const ROOT = document.documentElement.dataset.root || '';

const path = (file) => `${ROOT}${file}`;

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
  if (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('mailto:')) return text;
  return '';
}

function safeContentUrl(url = '') {
  const value = String(url).trim();
  if (value.startsWith('assets/')) return path(value);
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return '';
}

function simpleMarkdown(markdown = '') {
  const lines = escapeHTML(markdown).split(/\r?\n/);
  let html = '';
  let inList = false;

  const inline = (text) => text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
      const src = safeContentUrl(url);
      return src ? `<img src=\"${src}\" alt=\"${alt}\">` : '';
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
      const href = safeContentUrl(url);
      return href ? `<a href=\"${href}\" target=\"_blank\" rel=\"noopener\">${label}</a>` : label;
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

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function pageName() {
  const current = document.body.dataset.page || 'home';
  return current;
}

async function buildChrome() {
  const [site, pages] = await Promise.all([
    loadJSON('data/site.json'),
    loadJSON('data/pages.json').catch(() => [])
  ]);

  const header = document.querySelector('#site-header');
  const footer = document.querySelector('#site-footer');
  const current = pageName();
  const customLinks = pages
    .filter(p => p.show_in_nav)
    .map(p => `<a href="${path(`page.html?slug=${encodeURIComponent(p.slug)}`)}">${escapeHTML(p.nav_label || p.title)}</a>`)
    .join('');

  if (header) {
    header.innerHTML = `
      ${site.demo_notice ? `<div class="demo-banner">${escapeHTML(site.demo_notice)}</div>` : ''}
      <div class="site-header">
        <div class="nav-shell">
          <a class="brand" href="${path('index.html')}">
            <span class="brand-mark" aria-hidden="true">AIAS</span>
            <span>${escapeHTML(site.short_name)}</span>
          </a>
          <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="main-nav">Menu</button>
          <nav class="nav-links" id="main-nav" aria-label="Primary navigation">
            <a href="${path('events.html')}" ${current === 'events' ? 'aria-current="page"' : ''}>Events</a>
            <a href="${path('projects.html')}" ${current === 'projects' ? 'aria-current="page"' : ''}>Student Work</a>
            <a href="${path('jobs.html')}" ${current === 'jobs' ? 'aria-current="page"' : ''}>Jobs</a>
            <a href="${path('about.html')}" ${current === 'about' ? 'aria-current="page"' : ''}>About</a>
            ${customLinks}
            <a class="nav-cta" href="${safeUrl(site.membership_url)}" target="_blank" rel="noopener">Join AIAS</a>
          </nav>
        </div>
      </div>`;

    const toggle = header.querySelector('.nav-toggle');
    const nav = header.querySelector('#main-nav');
    toggle?.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  if (footer) {
    const email = escapeHTML(site.contact_email || '');
    footer.innerHTML = `
      <div class="site-footer">
        <div class="container">
          <div class="footer-grid">
            <div>
              <h3>${escapeHTML(site.chapter_name)}</h3>
              <p>${escapeHTML(site.tagline)}</p>
              ${email ? `<p><a href="mailto:${email}">${email}</a></p>` : ''}
            </div>
            <div class="footer-links">
              <a href="${path('events.html')}">Events</a>
              <a href="${path('projects.html')}">Student Work</a>
              <a href="${path('jobs.html')}">Jobs</a>
              <a href="${path('about.html')}">About</a>
              <a href="${path('admin/')}">Leadership Admin</a>
              <a href="${safeUrl(site.department_url)}" target="_blank" rel="noopener">UofM Architecture</a>
            </div>
          </div>
          <div class="footer-bottom">Student-led chapter prototype. University and AIAS marks should be added only in accordance with their current brand standards.</div>
        </div>
      </div>`;
  }

  return site;
}

function eventCard(event) {
  const register = safeUrl(event.registration_url);
  return `
    <article class="card">
      ${event.image ? `<img class="card-media" src="${path(escapeHTML(event.image))}" alt="">` : ''}
      <div class="card-body">
        <div class="card-meta">${formatDate(event.date)}${event.time ? ` · ${escapeHTML(event.time)}` : ''}</div>
        <h3>${escapeHTML(event.title)}</h3>
        <p class="muted">${escapeHTML(event.location)}</p>
        <p>${escapeHTML(event.summary)}</p>
        ${register ? `<a class="card-link" href="${register}" target="_blank" rel="noopener">Register →</a>` : ''}
      </div>
    </article>`;
}

function projectCard(project) {
  return `
    <article class="card">
      ${project.image ? `<img class="card-media" src="${path(escapeHTML(project.image))}" alt="">` : ''}
      <div class="card-body">
        <div class="card-meta">${escapeHTML(project.studio)} · ${escapeHTML(project.year)}</div>
        <h3>${escapeHTML(project.title)}</h3>
        <p class="muted">${escapeHTML(project.student)}</p>
        <p>${escapeHTML(project.summary)}</p>
      </div>
    </article>`;
}

function jobCard(job) {
  const apply = safeUrl(job.apply_url);
  return `
    <article class="job-card">
      <div class="job-top">
        <div>
          <div class="card-meta">${escapeHTML(job.company)}</div>
          <h3>${escapeHTML(job.title)}</h3>
        </div>
        <span class="badge">${escapeHTML(job.type)}</span>
      </div>
      <p class="muted">${escapeHTML(job.location)}</p>
      <p>${escapeHTML(job.summary)}</p>
      <p class="muted"><strong>Deadline:</strong> ${formatDate(job.deadline)}</p>
      ${apply ? `<a class="button button-outline" href="${apply}" target="_blank" rel="noopener">View / Apply</a>` : '<span class="muted">Sample listing — add an application link in the admin.</span>'}
    </article>`;
}

async function initHome(site) {
  document.querySelector('#hero-title').textContent = site.hero_title;
  document.querySelector('#hero-text').textContent = site.hero_text;

  const [events, projects, jobs] = await Promise.all([
    loadJSON('data/events.json'), loadJSON('data/projects.json'), loadJSON('data/jobs.json')
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter(e => e.date >= today).sort((a,b) => a.date.localeCompare(b.date)).slice(0, 3);
  const featuredProjects = projects.filter(p => p.featured).slice(0, 3);
  const activeJobs = jobs.filter(j => j.active).slice(0, 2);

  document.querySelector('#home-events').innerHTML = upcoming.length ? upcoming.map(eventCard).join('') : '<div class="empty-state">No upcoming events posted yet.</div>';
  document.querySelector('#home-projects').innerHTML = featuredProjects.length ? featuredProjects.map(projectCard).join('') : '<div class="empty-state">No featured projects posted yet.</div>';
  document.querySelector('#home-jobs').innerHTML = activeJobs.length ? activeJobs.map(jobCard).join('') : '<div class="empty-state">No active opportunities posted yet.</div>';
}

async function initEvents() {
  const events = await loadJSON('data/events.json');
  events.sort((a,b) => a.date.localeCompare(b.date));
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter(e => e.date >= today);
  const past = events.filter(e => e.date < today).reverse();
  document.querySelector('#events-list').innerHTML = upcoming.length ? upcoming.map(eventCard).join('') : '<div class="empty-state">No upcoming events are posted.</div>';
  const pastWrap = document.querySelector('#past-events-wrap');
  if (past.length) {
    pastWrap.hidden = false;
    document.querySelector('#past-events').innerHTML = past.map(eventCard).join('');
  }
}

async function initProjects() {
  const projects = await loadJSON('data/projects.json');
  document.querySelector('#projects-list').innerHTML = projects.length ? projects.map(projectCard).join('') : '<div class="empty-state">No student projects have been posted yet.</div>';
}

async function initJobs() {
  const jobs = await loadJSON('data/jobs.json');
  const active = jobs.filter(j => j.active).sort((a,b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  document.querySelector('#jobs-list').innerHTML = active.length ? active.map(jobCard).join('') : '<div class="empty-state">No active jobs or internships are posted right now.</div>';
}

async function initAbout(site) {
  document.querySelector('#about-copy').textContent = site.about_text;
  const leaders = await loadJSON('data/leadership.json');
  document.querySelector('#leadership-list').innerHTML = leaders.map(person => `
    <div class="person">
      <strong>${escapeHTML(person.name)}</strong>
      <span>${escapeHTML(person.role)}</span>
      ${person.email ? `<div><a href="mailto:${escapeHTML(person.email)}">${escapeHTML(person.email)}</a></div>` : ''}
    </div>`).join('');
}

async function initCustomPage() {
  const slug = new URLSearchParams(window.location.search).get('slug') || '';
  const pages = await loadJSON('data/pages.json');
  const page = pages.find(p => p.slug === slug);
  if (!page) {
    document.title = 'Page not found | AIAS Memphis';
    document.querySelector('#custom-title').textContent = 'Page not found';
    document.querySelector('#custom-summary').textContent = 'This page may have been renamed or removed.';
    return;
  }
  document.title = `${page.title} | AIAS Memphis`;
  document.querySelector('#custom-title').textContent = page.title;
  document.querySelector('#custom-summary').textContent = page.summary || '';
  const image = document.querySelector('#custom-image');
  if (page.hero_image) {
    image.src = path(page.hero_image);
    image.alt = '';
    image.hidden = false;
  }
  document.querySelector('#custom-body').innerHTML = simpleMarkdown(page.body || '');
}

async function main() {
  try {
    const site = await buildChrome();
    const page = pageName();
    if (page === 'home') await initHome(site);
    if (page === 'events') await initEvents();
    if (page === 'projects') await initProjects();
    if (page === 'jobs') await initJobs();
    if (page === 'about') await initAbout(site);
    if (page === 'custom') await initCustomPage();
  } catch (error) {
    console.error(error);
    const main = document.querySelector('main');
    if (main) main.innerHTML = `<div class="container section"><div class="empty-state"><strong>Site content could not be loaded.</strong><br>Run the site through a web server rather than opening the HTML file directly.</div></div>`;
  }
}

document.addEventListener('DOMContentLoaded', main);

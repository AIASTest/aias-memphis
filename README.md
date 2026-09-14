# AIAS Memphis Website

Static chapter website for AIAS at the University of Memphis. It is hosted with GitHub Pages and uses Pages CMS for officer-friendly content editing.

## Live structure

- `index.html` — homepage
- `events.html` — upcoming and archived events
- `projects.html` — student project portfolio index
- `project.html?slug=...` — reusable individual student-project detail view
- `jobs.html` — active jobs/internships/opportunities
- `about.html` — chapter information and leadership
- `page.html` — template for CMS-created custom pages
- `admin/` — leadership dashboard
- `admin/help.html` — searchable editing knowledge base
- `data/` — structured content edited by Pages CMS
- `assets/uploads/` — CMS-uploaded images
- `assets/css/projects.css` — student portfolio/gallery styles
- `.pages.yml` — Pages CMS schema and validation rules

## Editing content

Routine editors should use Pages CMS rather than editing repository files directly:

1. Open https://app.pagescms.org/
2. Sign in and select `AIASTest / aias-memphis`.
3. Choose the content area.
4. Edit and save.
5. Verify the result on the public site after GitHub Pages republishes it.

The in-site leadership dashboard is at `/admin/`. It includes content counts, automated site-health checks, links to the editor, and a Help Center with task-specific instructions.

## Content model

- `data/site.json` — chapter/site-wide text and links
- `data/events.json` — events
- `data/projects.json` — student project portfolio entries
- `data/jobs.json` — jobs and internships
- `data/leadership.json` — officers and advisor
- `data/pages.json` — custom information/resource pages

### Student project model

Each project in `data/projects.json` can contain:

- `title` — public project title
- `slug` — stable URL identifier used by `project.html?slug=...`
- `student` — student name
- `studio`, `semester`, `year`, `project_type` — optional project metadata
- `summary` — short card/hero description
- `cover_image` and `cover_image_alt` — project-card image
- `gallery` — ordered image objects containing `image`, `alt`, and optional `caption`
- `body` — long-form Markdown/rich-text project narrative
- `external_url` — optional external portfolio/publication/video link
- `featured` — controls homepage priority

The public project-detail page is reusable. New projects do not require a new HTML file; leadership creates a CMS entry with a unique slug and the site automatically gives it a detail URL.

The public JavaScript is defensive: malformed array data, bad URLs, invalid dates, missing optional fields, and legacy project cover-image data are handled without intentionally breaking the entire page.

## GitHub Pages

Repository Pages settings should remain:

- Source: **Deploy from a branch**
- Branch: **main**
- Folder: **/ (root)**

`.nojekyll` is present so GitHub Pages serves the static files directly.

## Local preview

Because the site loads JSON with `fetch()`, do not open the HTML files directly from disk. From the repository folder run:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Launch / content checklist

Before treating the prototype as a final chapter site:

- Replace placeholder/sample events, projects, jobs, leadership names, and email addresses.
- Remove the prototype/sample announcement banner in Site Settings.
- Add the chapter's actual Instagram URL if desired.
- Confirm the approved AIAS and University of Memphis branding/marks before adding official logos.
- Verify permission before publishing identifiable student work.
- For every student project, verify its slug, cover image, complete gallery, image descriptions, captions, and long-form narrative.
- Click through every project gallery after publishing.
- Verify job/opportunity links and deadlines.
- Run the `/admin/` Site Health check and resolve warnings.
- Preview the homepage, Events, Student Work, at least one individual Project, Jobs, About, and custom pages on desktop and mobile widths.

## Access and officer handoff

Long-term ownership should belong to the chapter or another durable organizational account, not one graduating student's personal account. During officer transitions:

1. Add incoming editors before outgoing editors lose access.
2. Remove access that is no longer appropriate.
3. Update leadership and contact information.
4. Review stale events/jobs/pages and project external links.
5. Run Site Health.
6. Make sure incoming leadership knows where `/admin/help.html` is.

## Security and privacy

This is a public repository and public website. Never store passwords, tokens, API keys, private student records, grades, home addresses, or other sensitive information in the CMS or repository.

## Structural changes

Normal content edits should happen in Pages CMS. Changes to HTML, CSS, JavaScript, the CMS schema, authentication architecture, or GitHub Pages settings should be treated as structural changes and reviewed/tested accordingly.

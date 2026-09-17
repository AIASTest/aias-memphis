# AIAS Memphis Website

AIAS at the University of Memphis chapter website. The site is static and hosted with GitHub Pages. Pages CMS provides chapter-friendly content editing.

## Live structure

- `index.html` — homepage
- `events.html` / `event.html?slug=...` — event index and reusable event details
- `projects.html` / `project.html?slug=...` — student work and reusable project details
- `members.html` / `member.html?slug=...` — chapter member directory and profiles
- `jobs.html` — active jobs/internships/opportunities
- `support.html` — chapter payments and donations landing page
- `about.html` — chapter information and member preview
- `page.html` — template for CMS-created custom pages
- `admin/` — website dashboard
- `admin/help.html` — editing and operations knowledge base
- `data/` — structured content/configuration
- `assets/uploads/` — CMS-uploaded images
- `.pages.yml` — Pages CMS schema and validation rules
- `.github/workflows/validate-static.yml` — repository validation on each push/PR

## Editing content

Routine editors should use Pages CMS rather than editing repository files directly:

1. Open https://app.pagescms.org/
2. Sign in with an account authorized for the chapter website repository.
3. Select the chapter website repository.
4. Choose the appropriate content area.
5. Edit and save.
6. Verify the result on the public site after GitHub Pages republishes it.

The in-site dashboard is at `/admin/`. It includes content counts, Site Health checks, links to the editor, and the Help Center.

## Content model

- `data/site.json` — chapter/site-wide text and links
- `data/events.json` — events
- `data/projects.json` — student project portfolio entries
- `data/jobs.json` — jobs and internships
- `data/leadership.json` — chapter member profiles
- `data/payments.json` — support/payment page content and buttons
- `data/pages.json` — custom information/resource pages

### Member/project relationship

Each chapter member has a stable `slug`. A student project can optionally include that value as `member_slug`. The member profile automatically collects matching projects, and project pages can link back to the member.

### Student project model

Each project can contain a stable slug, student/member association, studio metadata, summary, cover image, ordered multi-image gallery, long-form narrative, external portfolio link, and homepage-feature flag. The reusable `project.html` template means new projects do not require new HTML files.

## Automated validation

`.github/workflows/validate-static.yml` runs on pushes and pull requests. It checks JavaScript syntax, JSON parsing, Pages CMS YAML parsing, and confirms that retired Design Studio files and links have not been reintroduced accidentally.

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

Before treating the prototype as the final chapter site:

- Replace placeholder/sample events, projects, jobs, member names, and email addresses.
- Remove prototype/sample announcement messaging.
- Add the real Instagram URL.
- Confirm approved AIAS and University of Memphis branding before adding official marks.
- Verify permission before publishing identifiable profiles or student work.
- Test project galleries/member-project associations.
- Verify event RSVP and job/opportunity links.
- Add only approved payment-account links.
- Run `/admin/` Site Health and resolve launch-blocking issues.

## Access and website handoff

Long-term ownership should belong to the chapter, preferably through a chapter-owned GitHub organization rather than one graduating student's personal account. Repository transfer preserves site files, content, images, CMS schema, validation workflow, and Git history. After transfer, verify GitHub Pages and authorize Pages CMS for the repository under its new owner.

## Security and privacy

The GitHub repository and public website are public. Never store passwords, secret/private API keys, banking credentials, private student records, grades, home addresses, or other sensitive information in Pages CMS or the repository.

## Structural changes

Normal content edits should happen in Pages CMS. Changes to HTML, CSS, JavaScript, `.pages.yml`, publishing workflow, or GitHub Pages settings are structural changes and should be tested and allowed to pass the validation workflow before deployment is considered complete.

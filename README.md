# AIAS Memphis Website

Static chapter website for AIAS at the University of Memphis. It is hosted with GitHub Pages and uses Pages CMS for chapter-friendly content editing.

## Live structure

- `index.html` — homepage
- `events.html` / `event.html?slug=...` — event index and reusable event details
- `projects.html` / `project.html?slug=...` — student work and reusable project details
- `members.html` / `member.html?slug=...` — chapter member directory and profiles
- `jobs.html` — active jobs/internships/opportunities
- `support.html` — chapter payments and donations landing page
- `designer.html` — interactive 2D AIAS Design Studio and community showcase
- `about.html` — chapter information and member preview
- `page.html` — template for CMS-created custom pages
- `admin/` — website dashboard
- `admin/help.html` — searchable editing knowledge base
- `data/` — structured content edited by Pages CMS
- `assets/uploads/` — CMS-uploaded images
- `.pages.yml` — Pages CMS schema and validation rules

## Editing content

Routine editors should use Pages CMS rather than editing repository files directly:

1. Open https://app.pagescms.org/
2. Sign in with an account authorized for the chapter website repository.
3. Select the chapter website repository.
4. Choose the appropriate content area.
5. Edit and save.
6. Verify the result on the public site after GitHub Pages republishes it.

The in-site dashboard is at `/admin/`. It includes content counts, automated site-health checks, links to the editor, and a Help Center with task-specific instructions.

## Content model

- `data/site.json` — chapter/site-wide text and links
- `data/events.json` — events
- `data/projects.json` — student project portfolio entries
- `data/jobs.json` — jobs and internships
- `data/leadership.json` — chapter member profiles
- `data/payments.json` — support/payment page content and payment buttons
- `data/pages.json` — custom information/resource pages
- `data/designs.json` — approved Design Studio community showcase entries

### Member/project relationship

Each chapter member has a stable `slug`. A student project can optionally include that value as `member_slug`. The public member profile automatically collects projects with the matching member slug, and project pages can link back to the member profile.

### Student project model

Each project can contain a stable slug, student/member association, studio metadata, summary, cover image, ordered multi-image gallery, long-form narrative, external portfolio link, and homepage-feature flag. The reusable `project.html` template means new projects do not require new HTML files.

## Design Studio

`designer.html` is a browser-only 2D building composition tool. Visitors can:

- add rectangles, triangles, and circles;
- drag forms around an SVG canvas;
- change color, width, height, rotation, and layer order;
- choose preset backgrounds;
- enter a building name and designer name;
- save one draft locally in their browser;
- export the composition as PNG;
- generate a shareable link/design code;
- submit the share code to chapter leadership when a real chapter contact email is configured.

The design itself is encoded inside the share code. No public database or anonymous repository write access is required.

### Community showcase moderation

Permanent showcase entries are stored in `data/designs.json` and edited through **Pages CMS → Community → Community designs**. Leadership should:

1. receive a user's Design Studio share code;
2. open the submitted share link and verify the design/title/name;
3. get permission to publish the supplied designer name;
4. add the title, designer, and exact design code in Pages CMS;
5. turn on `Show in community showcase`;
6. optionally mark the design as featured;
7. save and verify the card on `designer.html`.

Storing the design code instead of a test-site URL keeps showcase entries portable when the repository/domain changes ownership.

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

- Replace placeholder/sample events, projects, jobs, member names, design showcase entries, and email addresses.
- Remove the prototype/sample announcement banner in Site Settings.
- Add the chapter's actual Instagram URL.
- Confirm approved AIAS and University of Memphis branding before adding official marks.
- Verify permission before publishing identifiable member profiles, student work, or community Design Studio submissions.
- Test project galleries and member/project associations.
- Verify event RSVP behavior and job/opportunity links.
- Add only approved payment-account links.
- Test the Design Studio on desktop and mobile, including share links and PNG export.
- Run `/admin/` Site Health and resolve launch-blocking issues.

## Access and website handoff

Long-term ownership should belong to the chapter, preferably through a chapter-owned GitHub organization rather than one graduating student's personal account. Repository transfer preserves the website files, content, images, CMS schema, design showcase codes, and Git history. After transfer, verify GitHub Pages and authorize Pages CMS for the repository under its new owner.

## Security and privacy

This is a public repository and public website. Never store passwords, tokens, API keys, banking credentials, private student records, grades, home addresses, or other sensitive information in the CMS or repository. Community Design Studio submissions should be moderated before permanent publication.

## Structural changes

Normal content edits should happen in Pages CMS. Changes to HTML, CSS, JavaScript, the CMS schema, authentication architecture, publishing workflow, or GitHub Pages settings should be treated as structural changes and tested accordingly.

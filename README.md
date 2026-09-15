# AIAS Memphis Website

AIAS at the University of Memphis chapter website. The main site is static and hosted with GitHub Pages. Pages CMS provides chapter-friendly content editing. The optional Design Studio Live Community can use a small chapter-owned Supabase project for student self-publishing; the rest of the website does not depend on that backend.

## Live structure

- `index.html` — homepage
- `events.html` / `event.html?slug=...` — event index and reusable event details
- `projects.html` / `project.html?slug=...` — student work and reusable project details
- `members.html` / `member.html?slug=...` — chapter member directory and profiles
- `jobs.html` — active jobs/internships/opportunities
- `support.html` — chapter payments and donations landing page
- `designer.html` — interactive AIAS Design Studio, live community, and curated showcase
- `about.html` — chapter information and member preview
- `page.html` — template for CMS-created custom pages
- `admin/` — website dashboard
- `admin/help.html` — searchable editing/operations knowledge base
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

The in-site dashboard is at `/admin/`. It includes content counts, Site Health checks, links to the editor, and a searchable Help Center.

## Content model

- `data/site.json` — chapter/site-wide text and links
- `data/events.json` — events
- `data/projects.json` — student project portfolio entries
- `data/jobs.json` — jobs and internships
- `data/leadership.json` — chapter member profiles
- `data/payments.json` — support/payment page content and buttons
- `data/pages.json` — custom information/resource pages
- `data/designs.json` — chapter-curated Design Studio showcase entries
- `data/community-backend.json` — optional Live Community public configuration

### Member/project relationship

Each chapter member has a stable `slug`. A student project can optionally include that value as `member_slug`. The member profile automatically collects matching projects, and project pages can link back to the member.

### Student project model

Each project can contain a stable slug, student/member association, studio metadata, summary, cover image, ordered multi-image gallery, long-form narrative, external portfolio link, and homepage-feature flag. The reusable `project.html` template means new projects do not require new HTML files.

## Design Studio

`designer.html` is a browser-based architecture sandbox. The core game remains functional even when the optional Live Community backend is disabled.

### Core design/game features

Visitors can:

- assemble blocks, roofs, circles, arches, windows, doors, columns, and trees;
- drag, resize, rotate, recolor, restyle, lock, layer, duplicate, repeat, and ground parts;
- interact with windows, doors, and trees;
- use multiple palettes, materials, and architectural/site backgrounds;
- start from House, Tower, Pavilion, and Courtyard templates;
- generate surprise buildings and names;
- use Design Roulette, a daily brief, Build Battle, Night Party, and three-minute sprints;
- mutate individual parts and undo the result if they dislike it;
- complete constraints/challenges and collect local challenge stamps;
- get a contextual Desk Crit and generated concept statement;
- use normal, Focus, X-ray, Silhouette, Presentation, and Sun/Shadow Study views;
- save/load a local draft;
- export the building as a PNG or a 1080×1350 pin-up poster;
- create a portable share/remix link and design code;
- use native device sharing when supported.

Design state is encoded inside the portable design code/share link. Those links do not depend on the current GitHub owner or domain.

### Layered Design Studio code

The Design Studio is intentionally split into maintainable layers:

- `assets/js/designer.js` — ordered loader
- `assets/js/designer-v2.js` — core state, drawing, history, sharing, curated showcase
- `assets/js/designer-fun.js` — critique, roulette, presentation, challenge stamps, sound
- `assets/js/designer-onboarding.js` — first-visit walkthrough
- `assets/js/designer-views.js` — Focus/X-ray/Silhouette tools
- `assets/js/designer-playplus.js` — Daily Brief, Build Battle, Night Party, mutation, native sharing
- `assets/js/designer-presentationplus.js` — Sun Study and pin-up poster export
- `assets/js/designer-community-bootstrap.js` — validates optional public backend config before loading community code
- `assets/js/designer-community.js` — Live Community publishing, likes, remix lineage, reports, self-delete

## Design Studio community publishing

There are two separate community paths.

### Curated Community Showcase

`data/designs.json` is the permanent, chapter-curated showcase managed through **Pages CMS → Community → Community designs**. It requires no database and works even when Live Community is disabled.

Leadership can receive a share/design code, review it, add the title/designer/code in Pages CMS, and choose whether it is visible/featured.

### Optional Live Community

The Live Community reduces routine organizer involvement. When enabled, a student receives an anonymous Supabase browser identity and can:

- publish directly from the Design Studio;
- like/unlike live work;
- remix another live design while preserving remix lineage;
- share live work;
- report inappropriate content;
- remove their own post from the same anonymous browser identity.

The Live Community is **disabled by default**. The site does not load its community library or UI until `data/community-backend.json` contains a valid enabled configuration.

One-time setup is documented in:

- `docs/design-studio-supabase.sql`
- `/admin/help.html#community-backend`

The database supports `auto` publishing or `moderated` publishing. The database table setting—not browser JavaScript—enforces whether new posts become `published` or `pending`. Browser clients have no update permission on community designs.

A server-side trigger limits one anonymous browser identity to 10 design posts per 24 hours. Reports are write-only to visitors and reviewed by chapter administrators in Supabase.

## Live Community credentials and security

`data/community-backend.json` is public because the repository/site are public. It may contain only the Supabase Project URL and a browser-safe **publishable** key.

Never place any of the following in this repository or browser code:

- Supabase secret keys
- `service_role` credentials
- private API tokens
- database passwords
- banking/payment credentials

The bootstrap and CI checks reject obvious secret/service-role key formats. Row Level Security, minimum grants, owner-scoped policies, database-enforced moderation, and rate limiting are defined in `docs/design-studio-supabase.sql`.

## Automated validation

`.github/workflows/validate-static.yml` runs on pushes and pull requests. It checks:

- JavaScript syntax;
- JSON parsing;
- curated Design Studio share-code decoding;
- Pages CMS YAML parsing;
- required Design Studio loader/assets;
- Live Community configuration structure and secret-key guardrails;
- presence of important RLS/moderation statements in the Supabase SQL setup.

A successful static validation does not replace real browser testing, but it catches common structural regressions before they are treated as deployed features.

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

The optional Live Community will connect to its configured Supabase project during a local HTTP preview if it is enabled.

## Launch / content checklist

Before treating the prototype as the final chapter site:

- Replace placeholder/sample events, projects, jobs, member names, curated design entries, and email addresses.
- Remove prototype/sample announcement messaging.
- Add the real Instagram URL.
- Confirm approved AIAS and University of Memphis branding before adding official marks.
- Verify permission before publishing identifiable profiles, student work, or Design Studio attribution.
- Test project galleries/member-project associations.
- Verify event RSVP and job/opportunity links.
- Add only approved payment-account links.
- Test the Design Studio at desktop and phone widths, including drag, resize, interactions, share links, PNG/poster exports, and presentation modes.
- If Live Community is enabled, test publish, pending/auto mode, like, remix, report, and owner delete in a private/incognito browser.
- Run `/admin/` Site Health and resolve launch-blocking issues.

## Access and website handoff

Long-term ownership should belong to the chapter, preferably through a chapter-owned GitHub organization rather than one graduating student's personal account. Repository transfer preserves site files, content, images, CMS schema, curated design codes, validation workflow, and Git history. After transfer, verify GitHub Pages and authorize Pages CMS for the repository under its new owner.

If Live Community is enabled, the Supabase project also needs durable chapter ownership. Add incoming administrators before removing outgoing ones, and test the public community after handoff. The Supabase project does not need to be rebuilt merely because the GitHub repository changes owners.

## Security and privacy

The GitHub repository and public website are public. Never store passwords, secret/private API keys, banking credentials, private student records, grades, home addresses, or other sensitive information in Pages CMS or the repository.

Live Community makes student-supplied title/designer/caption text public when auto mode is enabled. Review reports periodically and use moderated mode if the chapter prefers approval before publication.

## Structural changes

Normal content edits should happen in Pages CMS. Changes to HTML, CSS, JavaScript, `.pages.yml`, Live Community configuration/SQL, authentication architecture, publishing workflow, or GitHub Pages settings are structural changes and should be tested and allowed to pass the validation workflow before deployment is considered complete.

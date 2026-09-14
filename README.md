# AIAS Memphis Website Prototype

A build-free static site prototype designed for GitHub Pages with editable content through Pages CMS.

## What is included

- Home page
- Events page
- Student projects page
- Jobs/internships page
- About + leadership page
- Custom pages managed from `data/pages.json`
- Image uploads in `assets/uploads/`
- Leadership admin gateway at `/admin/`
- Pages CMS configuration in `.pages.yml`
- Responsive, accessible layout using University of Memphis-inspired brand colors

## Local preview

Do not open `index.html` directly because browsers block local `fetch()` calls.

From the project folder run:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Deploy to GitHub Pages

1. Create a new public GitHub repository, for example `aias-memphis`.
2. Upload/push all files in this folder to the repository's `main` branch.
3. In GitHub open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select `main` and `/ (root)`, then save.
6. GitHub will publish the site at `https://YOUR-ACCOUNT.github.io/aias-memphis/` unless a custom domain is configured.

Because this project includes `.nojekyll`, GitHub Pages serves the files directly without a Jekyll build.

## Enable the editor

1. Go to `https://app.pagescms.org/`.
2. Sign in with GitHub.
3. Install/authorize the Pages CMS GitHub App for the website repository.
4. Open the repository. Pages CMS detects `.pages.yml` automatically.
5. Add chapter leaders as GitHub collaborators (or configure Pages CMS collaborator access) so only approved people can save changes.

The public website's `/admin/` page is a branded gateway to this editor.

## Content model

- `data/site.json` — global text and links
- `data/events.json` — events
- `data/projects.json` — student work
- `data/jobs.json` — jobs and internships
- `data/leadership.json` — chapter officers/advisor
- `data/pages.json` — additional custom pages
- `assets/uploads/` — leadership-uploaded images

## Important before launch

- Replace all sample events, projects, jobs, people, and the placeholder email.
- Obtain and use the current approved AIAS chapter logo/branding.
- Confirm University of Memphis branding requirements before using official university marks.
- Decide who owns the GitHub repository. A chapter-controlled GitHub organization is preferable to a graduating student's personal account.
- Keep the repository free of secrets and private student data.

## Optional phase 2

If the chapter requires the full editor itself to live at `/admin/` rather than linking to Pages CMS, replace the admin gateway with Decap CMS and use a small OAuth service (for example a Cloudflare Worker) for GitHub authentication. The content files can remain largely the same.

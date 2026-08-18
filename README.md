# Arvio

Arvio is a dark, premium, local-first collaborative notes workspace designed for desktop and iPhone/PWA use.

## v3.4.1 — creation ordering + Home stack fix

- **Add to an existing topic** now lists the newest-created notes/topics first.
- **Recently edited** cards use explicit max-content rows, stronger separation, and wrap-safe content so newly added notes cannot visually collapse into adjacent cards.

## v3.4.0 — deploy-ready cleanup

This package preserves the Arvio v3.1 frontend and local-first behavior while fixing the CSS syntax issues that blocked Vercel's production minifier.

The project is ready for a GitHub → Vercel workflow. Supabase is prepared in the frontend but is not connected yet; prototype auth and IndexedDB/local-first notes remain active until the cloud migration is implemented.

## Stack

- Vanilla JavaScript
- Vite 8
- IndexedDB / local-first prototype persistence
- PWA service worker
- Supabase client dependency prepared for the next phase
- Vercel configuration

## Local development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Project structure

```text
arvio/
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
├── .env.example
├── .gitignore
├── public/
├── src/
└── DEPLOY-READY-CHECK.md
```

See `GITHUB-SETUP.md` for the upload/deploy flow and `DEPLOY-READY-CHECK.md` for the source audit performed before packaging.

## v3.4.0

Supabase cloud notes sync is enabled while IndexedDB remains the offline cache. See `SUPABASE-CLOUD-NOTES-SETUP.md` before deployment.

### v3.4.2 — Mobile launch resilience
- Production-domain launch no longer blocks on remote auth/profile/cloud-note requests.
- Supabase session routing uses the persisted session first; cloud hydration continues in the background.
- Added a launch watchdog so mobile never remains permanently on the loading screen after a network/auth exception.


## v3.4.3 — Home + creation-date integrity audit

- Fixed the Recently edited pseudo-element collision: the card glaze no longer shares `::after` with the arrow.
- Moved Recently edited spacing ownership to `ui-system.css`, preventing the later UI-system rule from shrinking the intended gap.
- Reduced cross-card shadow bleed so stacked cards no longer look visually merged.
- Removed the hard-coded `2026-01-01` creation-date fallback that could send a newly-created parent to a fake January group.
- Creation sorting/date groups now prefer the note's stable `createdAt`, then persisted metadata, then edit/open timestamps.
- Added a repair pass after IndexedDB/cloud hydration so missing creation metadata is persisted instead of repeatedly falling back.

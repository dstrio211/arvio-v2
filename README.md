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

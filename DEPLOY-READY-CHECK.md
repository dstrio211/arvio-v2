# Arvio v3.2.0 — deploy-ready source audit

Audit performed before packaging this repository.

## Fixed blockers

1. `src/styles/shell.css`: corrected an invalid multi-value `transition` declaration where `!important` appeared before commas.
2. `src/styles/shell.css`: corrected a misplaced closing brace in the mobile status-scrim media query that produced an empty selector during Lightning CSS minification.
3. `package.json`: pinned the Vercel Node engine to `22.x` to avoid automatic major-version jumps/warnings.
4. `public/sw.js`: bumped the application shell cache name to the v3.2 generation.

## Source checks completed

- All 14 CSS files recursively parsed as stylesheets, nested media/support rules, keyframes, and declaration lists.
- 12,090 CSS source lines audited.
- The 14 CSS files were also parsed in the same import order used by `src/main.js` as one combined stylesheet.
- No CSS parse errors found.
- No empty selectors found.
- No `!important,` anti-patterns found.
- No suspicious extra closing-brace-before-selector pattern found.
- `src/main.js` syntax check passed with Node.
- `src/lib/supabaseClient.js` syntax check passed with Node.
- `public/sw.js` syntax check passed with Node.
- `vite.config.js` syntax check passed with Node.
- `index.html` parsed successfully.
- No duplicate HTML IDs found.
- All local HTML asset references exist.
- All local imports from `src/main.js` exist.
- `manifest.webmanifest` parsed successfully and its icon files exist.

## Environment limitation

A complete local `npm install && npm run build` could not be executed in the packaging environment because access to the npm registry timed out. The repository uses exact dependency versions and the Vercel build had already shown dependency installation succeeding; the previous Vercel failures were CSS parser errors addressed above.

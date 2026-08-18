# Arvio — clean GitHub + Vercel setup

## Browser-upload method

1. Create a new empty GitHub repository named `arvio` (or another name you prefer).
2. Do not initialize it with a README, .gitignore, or license.
3. Extract the Arvio ZIP on your PC.
4. Open the extracted `arvio-github-ready-v3.2.0` folder.
5. Select the ITEMS INSIDE the folder, not the outer folder itself.
6. Drag those items into GitHub's **Add file → Upload files** page.
7. The repository root should directly contain `package.json`, `index.html`, `src/`, `public/`, etc. There should not be another `arvio-github-ready-v3.2.0/` folder inside the repo.
8. Commit to `main`.

If GitHub's browser uploader does not include `.gitignore` or `.env.example`, create those two dotfiles manually after the main upload. Their correct contents are already included in this package.

## Vercel

Import the new GitHub repository into Vercel.

Expected settings:
- Framework Preset: **Vite**
- Root Directory: `./`
- Build Command: `npm run build`
- Output Directory: `dist`

No Supabase environment variables are required for the current local-first prototype.

## Supabase later

When a Supabase project is created, add these locally in `.env.local` and in Vercel Environment Variables:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Never commit `.env.local` or secret/service-role keys.

## Normal update workflow later

```bash
git add .
git commit -m "Describe the Arvio update"
git push
```

Vercel will deploy the new `main` commit automatically.

# Arvio v3.3.0 — Supabase Auth setup

Before testing account creation on production:

1. Supabase Dashboard → Authentication → URL Configuration.
2. Set Site URL to the production Arvio URL.
3. Add the same production URL to Redirect URLs.
4. Keep email confirmation enabled.
5. Confirm Vercel has `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, then deploy again if they were added after the current build.

Arvio v3.3.0 behavior:
- Existing confirmed session → Splash → Home.
- New signup → Supabase sends confirmation email → Confirm stage.
- Confirmation opened in this browser → Arvio resumes at Display name.
- Confirmation opened in another tab → return to Arvio and press “I’ve confirmed my email”.
- Login and logout use Supabase Auth.
- Display name is saved to `public.profiles` and mirrored to auth user metadata.

# Arvio v3.4.3 stability audit

## Confirmed root causes

1. **Recently edited looked overlapped**
   - `home-profile.css` used `::after` first as a full-card material/glaze layer and later reused the same `::after` as the navigation arrow.
   - The later arrow declaration did not reset the earlier `inset`, background, opacity, or z-index properties.
   - `ui-system.css` also loaded after `home-profile.css` and forced the Recent list gap back to 10px, overriding the v3.4.1 16px resilience patch.

2. **New parent could appear under 01 Jan 2026**
   - `getLibraryCreatedAt()` used a literal `2026-01-01T00:00:00` whenever a path-key timestamp was missing.
   - Even if the node itself still had a correct `createdAt`, the Library sorter/date grouper ignored it because the helper only read the path map.

## v3.4.3 corrections

- `::after` on Recent cards is reserved for the arrow only; the material layer no longer owns that pseudo-element.
- Recent spacing is owned canonically by `ui-system.css`: 16px desktop / 14px mobile.
- Recent-card shadow tails were shortened to reduce visual bleed between rows.
- Creation-time resolution now checks `node.createdAt` first, then the persisted path map, then updated/opened timestamps.
- Missing creation metadata is repaired and persisted after IndexedDB hydration and after cloud hydration.
- The hard-coded January 2026 fallback was removed entirely.

## Static checks

- No duplicate JavaScript function declarations.
- CSS parses without syntax errors.
- No `!important,` malformed transition syntax.
- No hard-coded `2026-01-01` fallback remains in application JS.
- Removed a real cross-file ownership collision for the mobile Note Share button: geometry now lives only in `note.css`; `share.css` owns only its icon/label content.
- Removed the Library-menu exact-selector duplication by making page-layout.css target the header context explicitly.
- After cleanup, the only exact selector intentionally shared across CSS files is `:root` for subsystem design tokens.

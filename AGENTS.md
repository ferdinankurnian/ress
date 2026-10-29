# Ress project instructions

- Discuss native builds with iydheko before running them. He prefers to build locally himself with his Android phone connected over USB.
- Do not run `bunx expo run:android`, Gradle APK builds, or EAS builds on his behalf unless explicitly asked.
- Use Bun for package management and scripts. Do not start dev servers yourself.

## Project

Ress is a mobile-only RSS and Atom reader built with Expo, React Native, and TypeScript. Android is the currently supported platform. Subscriptions, cached articles, bookmarks, and reading state are stored on the device. There is no account or backend.

- Do not present Ress as a web app or offer web as a supported platform.
- Do not announce or hint at iOS plans in the README, app UI, or other public-facing material unless iydheko explicitly asks.

## Code map

- `App.tsx`: app screens, navigation, source management, reader, and settings.
- `src/data/feeds.ts`: RSS/Atom parsing, OPML import/export, and article merging.
- `src/data/store.ts`: persistence, feed refresh, and widget settings.
- `src/ui/`: shared UI components, motion, reordering, and theme tokens.
- `src/widget/`: Android widget layout, configuration, images, and background updates. `bridge.tsx` provides the fallback outside Android; `bridge.android.tsx` handles native integration.
- `plugins/`: Expo config plugins and Android downloads integration.
- `app.config.ts`: Expo configuration, icons, and native plugin setup.
- `assets/`: app icons and artwork. Reuse the existing Ress identity.
- `tests/`: Bun tests and fixtures.
- `scripts/check-ui.ts`: browser UI checks against a static web export.

## Working rules

- Use `bun add` and `bun remove` for dependency changes. Do not edit dependency entries in `package.json` by hand.
- Preserve unrelated working changes; the checkout may already contain work in progress.
- Keep native modules guarded for Expo Go and internal test environments. Those fallbacks do not imply support for additional product platforms.
- Make durable native changes through Expo config, config plugins, or the existing dependency patch rather than generated native files.
- Preserve saved articles and existing persisted data when changing storage or refresh behavior.
- Keep the first install empty. Test feeds and fixture articles belong in tests, not the shipped library.
- Use the existing theme tokens and fonts. Check light and dark themes when changing UI.
- Never add the Tailwind class combination `uppercase tracking-wider`; remove it if touching code that uses it.
- Keep README claims aligned with implemented behavior and platform limitations.
- Tell iydheko when changing this file.

## Validation

For TypeScript or behavior changes, run the relevant checks:

```sh
bun run typecheck
bun test
```

For internal browser UI verification, when needed (test tooling only, not a supported app platform):

```sh
bunx expo export --platform web
bunx playwright install chromium
bun scripts/check-ui.ts
```

The browser checks use a static export without a dev server. They do not verify native widget or downloads behavior. State what was checked and what still needs testing on the phone. Documentation-only edits do not need app builds or test runs.

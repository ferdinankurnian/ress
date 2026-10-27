# Ress

A personal RSS reader with a yellow paper identity, built with Expo, React Native and TypeScript. Android first.

## What works

- Empty on first install. Add only the sources you choose; no bundled subscriptions or recommendations.
- RSS 2.0 and Atom fetching, newest-first sorting, source circles, pull to refresh, favicons, thumbnails and relative timestamps. Saved articles have their own search.
- An offline text reader, persistent bookmarks, read state, sharing and original-site links.
- OPML import with nested categories and deduplication. Add and edit sources in sheets; swipe left to remove.
- A resizable Android home widget, source selection, unread-only mode, manual refresh and article deep links.
- Widget refresh scheduled every 30 minutes. Android battery restrictions can delay it.

Subscriptions and cached articles stay on the device. Requests go directly to feed publishers. No account, backend, tracking or API key.

## Run

```sh
bun install
bun start
```

Expo Go can run the reader; the Android widget requires a native development build or standalone APK. The app guards the missing widget module in Expo Go. Web is useful for UI development, but publishers may block browser RSS fetches through CORS; native fetches do not have this browser restriction. iOS can run the reader; an iOS widget is not included.

## Install on Android

With Android SDK and Java configured:

```sh
bunx expo prebuild --platform android
bunx expo run:android
```

Or build a standalone APK with EAS (requires your Expo account):

```sh
EAS_NO_VCS=1 EAS_PROJECT_ROOT="$PWD" bunx eas-cli build --platform android --profile preview
```

Run the EAS command from the `ress` directory. The explicit root prevents EAS from packaging the parent `~/Projects` Git repository and unrelated projects. `.easignore` excludes generated native directories so EAS regenerates them from the Expo config.

After installation, open Ress once and refresh the feeds. In Settings tap **Add to home screen**, or long-press your launcher, choose **Widgets**, then **Ress**. Tap a headline to open the reading room; tap Refresh to update the widget.

For a local standalone build, without starting a dev server:

```sh
bunx expo prebuild --platform android --no-install
cd android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a --max-workers=2
```

The generated project's default release signing is a local debug key: suitable for personal installation, not Play Store publishing. Configure your production signing before distribution.

## Checks

```sh
bun run typecheck
bun test
bunx expo export --platform android --platform web
bun scripts/check-ui.ts
```

The UI check uses the static web export through Playwright request interception, without a server. It checks an empty install, adds a test feed, checks source editing, reader/bookmark/search flows and tab rounding and saves screenshots under `.hallmark/screenshots`. Install its browser with `bunx playwright install chromium` first. Its fixtures are verification artifacts, not shipped articles.

## Details

The feed body is rendered as readable plain text, not arbitrary HTML. Feed images appear in article cards, the reader and the widget; full formatting stays on the original website. An empty feed is valid: `iydheko.dev/rss.xml` had no entries when checked. Cached articles survive partial network failures. The cache retains 600 recent stories plus all saved stories.

`src/data/feeds.ts` owns parsing. `src/data/store.ts` owns persistence and refresh. `src/widget` owns native rendering and headless updates. `src/ui/theme.ts` declares native colour and font tokens. The OPML parsing fixture is in `tests/fixtures/subscriptions.opml` and is not shipped.

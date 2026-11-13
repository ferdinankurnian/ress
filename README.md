<p align="center">
  <img src="docs/images/ress-icon-rounded.png" alt="Ress icon" width="96" height="96" />
</p>

<h1 align="center">Ress</h1>

<p align="center">A place to actually read RSS feeds</p>

![Ress app thumbnail](docs/images/ress-thumbnail.png)

Ress keeps the sites you follow in one place. Add your feeds, read the latest posts, and save the ones you want to come back to.

## Reading

- Follow RSS and Atom feeds in a newest-first timeline.
- Keep bookmarks in a searchable saved list and read cached feed text offline.
- Choose Web page or Reading mode as the default in **Settings → Reading**.
- Pick a reading text size and use a light, dark, or device theme.
- Share an article or open it in your device's browser.

## Your sources

Add feed URLs individually or import an OPML file from another reader. You can edit source names and icons, drag sources into your preferred order, and swipe to remove them.

OPML export includes feed titles and categories, so you can take your subscriptions elsewhere. It doesn't include bookmarks or reading history. By default, exports are saved to the Download folder.

## The widget

The widget shows latest 10 posts on your home screen with a resizable widget. Each widget can have its own source and unread filters option. Tap a headline to read it in Ress.

Add it through **Settings → Widget → Add widget to home screen**, or your widget picker. Refreshes are scheduled every 30 minutes, though Android's battery restrictions may can delay them.

## Run dev build

Ress uses native Android modules (widgets & direct downloads), so run it as a development build with `expo-dev-client`, not Expo Go.

Connect your Android device via USB (with USB debugging enabled), then install dependencies and build:

```sh
bun install
bun run android
```

Once the dev build is installed on your phone, you can start Metro anytime with:

```sh
bun start
```

After modifying the reader extraction script or updating Readability, rebuild its bundle:

```sh
bun scripts/build-reader.ts
```

## Checks

```sh
bun run typecheck
bun test
```

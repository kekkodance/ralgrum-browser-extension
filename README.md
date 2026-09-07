# ralgruM Browser Integration

Browser extension for Chrome and Firefox that connects Deezer and SoundCloud
pages to the ralgruM desktop app.

When you visit a track, album, playlist, or artist page, a small toast in the
ralgruM style appears in the top right. From there you can play the track in
ralgruM or open the album, playlist, or artist page in ralgruM with one click.

## Features

- Toast dialog in the top right on Deezer and SoundCloud pages
- Visual style matched to ralgruM (dark zinc theme, indigo accent,
  Deezer purple and SoundCloud orange provider badges)
- Detects tracks, albums, playlists, and artists, including related entities
  on track pages (album and artist shortcuts)
- One click Play in ralgruM or Open in ralgruM via the ralgrum:// protocol
- Copy ralgruM link or original page link
- Context menu entries for pages and links
- Popup with current tab status and quick actions
- Toast mirrors the app toast anatomy (flat card, kind glyph, secondary
  actions) and the expanded dialog lists entities as track rows
- Options page (per provider toggles, per type toggles, auto show)
- Firefox and Chrome builds from one source (Manifest V3)
- No tracking, everything runs locally in your browser

## How it works

1. The content script detects the entity from the page URL plus meta tags
   and JSON-LD data.
2. The toast builds a ralgrum:// link such as
   ralgrum://open?provider=deezer&type=track&id=3135556&action=play
3. Clicking the button navigates to that URL, which Windows hands to the
   registered ralgruM protocol handler (see protocol/).
4. ralgruM parses the link and opens the matching page or starts playback.

Full URL spec lives in protocol/README.md. Reference Rust parser lives in
app-integration/deep_link.rs.

## Repo layout

- extension/ - the extension source (manifests, background, content scripts,
  popup, options, icons)
- protocol/ - ralgrum:// spec plus Windows register and unregister scripts
- app-integration/ - reference Rust parser plus wiring guide for the ralgruM app
- tests/ - zero dependency Node tests for the URL parsers
- scripts/ - zero dependency build script producing dist/chrome and dist/firefox

## Install from source

### Chrome

1. Open chrome://extensions, enable Developer mode.
2. Click Load unpacked and pick the extension/ folder (or dist/chrome after
   npm run build).
3. Visit a Deezer or SoundCloud page and look top right.

### Firefox

1. Run npm run build to produce dist/firefox.
2. Open about:debugging#/runtime/this-firefox, click Load Temporary Add-on,
   pick dist/firefox/manifest.json.
3. For a signed permanent install, submit dist/firefox.zip to
   addons.mozilla.org as an unlisted or listed add-on.

Note: extension/manifest.json targets Chrome. extension/manifest.firefox.json
targets Firefox. The build script picks the right one per output folder.

## Register ralgruM to handle ralgrum:// links (Windows)

Run in PowerShell (no admin needed, current user only):

powershell -ExecutionPolicy Bypass -File protocol/windows-register-protocol.ps1

If ralgruM.exe is not in the default location, pass -ExePath:

powershell -ExecutionPolicy Bypass -File protocol/windows-register-protocol.ps1 -ExePath "C:/path/to/ralgruM.exe"

To remove the handler:

powershell -ExecutionPolicy Bypass -File protocol/windows-unregister-protocol.ps1

## Development

- npm test runs the parser tests (Node 18 or newer, no dependencies).
- npm run build produces dist/chrome and dist/firefox plus zip notes.
- Content logic in extension/content/detectors.js is pure and testable,
  no chrome APIs inside that file.
- Toast UI uses Shadow DOM so Deezer and SoundCloud page styles cannot leak in.

## Privacy

- No analytics, no network calls, no remote servers.
- The extension only reads the current page URL, title, artwork meta tags,
  and JSON-LD blocks to build a local ralgrum:// link.
- Settings stay in browser storage (chrome.storage.sync with local fallback).

## Screenshots

Placeholder: add screenshots/toast-deezer.png and screenshots/toast-soundcloud.png
showing the top right toast on a track page.

## License

MIT, see LICENSE.

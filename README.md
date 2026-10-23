<div align="center">
  <h1>
    <img src="extension/icons/icon128.png" width="48" height="48" valign="middle" alt="ralgruM logo" />
    ralgruM Browser Integration
  </h1>
  <p>
    <img src="https://img.shields.io/github/actions/workflow/status/kekkodance/ralgrum-browser-extension/ci.yml?label=checks" alt="CI status" />
  </p>
  <p>This browser add-on connects Deezer and SoundCloud pages to the ralgruM Desktop app.</p>
  <p>When you are looking at a song, album, playlist, or artist in your browser, a small toast pops up in the top-right corner.</p>
</div>

  <table align="center">
    <tr>
      <th>Browser</th>
      <th>Install from</th>
    </tr>
    <tr>
      <td>
        <a href="https://addons.mozilla.org/en-US/firefox/addon/ralgrum-browser-integration/"><img src="docs/logos/firefox.svg" width="64" height="64" alt="Firefox" /></a>
      </td>
      <td><a href="https://addons.mozilla.org/en-US/firefox/addon/ralgrum-browser-integration/">Firefox Add-ons</a></td>
    </tr>
    <tr>
      <td>
        <a href="#chrome"><img src="docs/logos/chrome.svg" width="64" height="64" alt="Chrome" /></a>
      </td>
      <td><a href="#chrome">Install instructions</a></td>
    </tr>
    <tr>
      <td>
        <a href="#userscript"><img src="docs/logos/greasemonkey.svg" width="64" height="64" alt="Greasemonkey logo" /></a>
      </td>
      <td><a href="https://raw.githubusercontent.com/kekkodance/ralgrum-browser-extension/master/userscript/ralgrum.user.js">Install userscript</a></td>
    </tr>
  </table>

## What it does

- Works on Deezer and SoundCloud song, album, playlist, and artist pages.
- Shows a small toast with the title, artist, and cover picture.
- One click to **Play in ralgruM** (for songs) or **Open in ralgruM** (for albums, playlists, and artists).
- On song pages, you also get quick shortcuts to the album and artist when available.
- Right-click any Deezer or SoundCloud page or link and choose **Open in ralgruM**.

<div align="center">
  <img src="screenshots/toast-deezer.png" alt="ralgruM toast on a Deezer song page with a Play in ralgruM button" width="360" />
  <img src="screenshots/toast-soundcloud.png" alt="ralgruM toast on a SoundCloud song page with a Play in ralgruM button" width="360" />
</div>

## Before you start

You need:

1. The **ralgruM Desktop app** installed on the same computer.
2. **Chrome** or **Firefox 142 or newer** for the browser add-on, or a compatible userscript manager for the userscript.
3. Access to Deezer or SoundCloud in your browser, as usual.

## Install

### Chrome

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (switch in the top-right corner).
3. Click **Load unpacked** and choose the `extension/` folder or `dist/chrome` if you ran a build.
4. Go to a Deezer or SoundCloud song page. You should see the toast in the top-right.

### Firefox (temporary add-on)

Firefox 142 or newer is required. The preferred way to install the extension is via the button above.

A temporary add-on is removed when you restart Firefox.

1. Run `npm run build` to create the `dist/firefox` folder.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on** and pick the `manifest.json` file inside `dist/firefox`.
4. Go to a Deezer or SoundCloud song page. You should see the toast in the top-right.

### Userscript manager

Install a userscript manager that works with your browser, then open [ralgrum.user.js](https://raw.githubusercontent.com/kekkodance/ralgrum-browser-extension/master/userscript/ralgrum.user.js) and confirm the installation prompt. The script updates from this GitHub file through your userscript manager.

The userscript shows the same automatic toast as the browser add-on. It does not include the toolbar settings or right-click menu; enable or disable it from your userscript manager.

### Connect it to the ralgruM app

Clicking **Play** or **Open** asks your computer to open the link in ralgruM.

- The first time, your browser may ask which app to use. Choose ralgruM and allow it to open these links.
- If nothing happens when you click, make sure the ralgruM desktop app is installed and up to date.

## How to use it

1. Go to a song, album, playlist, or artist on Deezer or SoundCloud.
2. Look for the small toast in the top-right corner.
3. Click **Play in ralgruM** or **Open in ralgruM**.
4. Click the **X** to dismiss the toast.

Other ways to use it:

- With the browser add-on, right-click the page and choose **Open in ralgruM**, or right-click a Deezer or SoundCloud link and choose **Open link in ralgruM**.
- With the browser add-on, click the ralgruM icon in your browser toolbar to open settings.

## Browser add-on settings

Click the ralgruM toolbar icon to change when the toast appears.

- **Show toast automatically** - turn the toast on or off everywhere.
- **Tracks** - show it on song pages.
- **Albums and playlists** - show it on album and playlist pages.
- **Artists** - show it on artist pages.
- **Deezer / SoundCloud** - turn it on or off for each music site.

The userscript does not have these settings. Use your userscript manager to disable or remove it.

## Privacy

- We do not track you. There are no ads, no analytics, and no Murglar servers collecting your browsing.
- To show the title and cover picture, the integration reads the page you are on. If it needs more detail, it asks Deezer (`api.deezer.com`) or SoundCloud (`soundcloud.com/oembed`) for that song, album, playlist, or artist. This happens when the toast is enabled, before you click anything.
- Cover pictures load from Deezer, SoundCloud, or their image hosts, like normal images in your browser.
- Browser add-on settings are saved in your browser and may follow your browser account if you use browser sync. The userscript has no separate settings; enable or disable it in the userscript manager. Your browsing history is not saved.
- Clicking **Play** or **Open** sends that song, album, playlist, or artist to the ralgruM app on your computer. What the app does next is up to the app.
- The music sites themselves still work exactly as before, these controls only affect the toast

## For developers

Source layout:

- `extension/` - the add-on (background, page scripts, pop-up, settings page, icons).
- `userscript/ralgrum.user.js` - generated, installable userscript bundle.
- `tests/` - checks that run with plain Node.js (`npm test` needs no extra installs; lint and format need `npm install` first).
- `scripts/` - build script that creates the Chrome and Firefox folders in `dist/` and generates the userscript bundle.

Useful commands (Node 18 or newer):

- `npm test` - run the checks.
- `npm run build` - build the Chrome and Firefox folders in `dist/` and refresh `userscript/ralgrum.user.js`. Store-upload files (ZIPs) are created manually afterwards.
- `npm run lint` - run ESLint.
- `npm run format:check` - check formatting with Prettier (`npm run format:write` fixes it).

## License

Copyright © 2026 kekkodance. All rights reserved. See LICENSE.

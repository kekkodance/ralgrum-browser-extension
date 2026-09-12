import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, test } from "node:test";

const detectorsSource = readFileSync(
  new URL("../extension/content/detectors.js", import.meta.url),
  "utf8",
);
const backgroundSource = readFileSync(
  new URL("../extension/background.js", import.meta.url),
  "utf8",
);

function backgroundWith(update, api = "chrome") {
  let listener = null;
  let menuListener = null;
  const createdMenus = [];
  const calls = [];
  const navigation =
    update || ((_id, _options, callback) => callback && callback());
  const context = { URL, URLSearchParams, Promise };

  if (api === "chrome") {
    const chrome = {
      tabs: {
        update(id, options, callback) {
          calls.push({ id, options });
          navigation(id, options, callback);
        },
      },
      runtime: {
        lastError: null,
        onInstalled: { addListener() {} },
        onMessage: {
          addListener(value) {
            listener = value;
          },
        },
      },
      storage: {
        sync: {
          get(_keys, callback) {
            callback({});
          },
          set(_items, callback) {
            callback();
          },
        },
      },
      contextMenus: {
        removeAll(callback) {
          callback();
        },
        create(entry) {
          createdMenus.push(entry);
        },
        onClicked: {
          addListener(value) {
            menuListener = value;
          },
        },
      },
    };
    context.chrome = chrome;
  } else {
    const browser = {
      tabs: {
        update(id, options) {
          calls.push({ id, options });
          return navigation(id, options);
        },
      },
      runtime: {
        onInstalled: { addListener() {} },
        onMessage: {
          addListener(value) {
            listener = value;
          },
        },
      },
      storage: {
        sync: {
          get() {
            return Promise.resolve({});
          },
          set() {
            return Promise.resolve();
          },
        },
      },
      menus: {
        removeAll() {
          return Promise.resolve();
        },
        create(entry) {
          createdMenus.push(entry);
          return Promise.resolve();
        },
        onClicked: {
          addListener(value) {
            menuListener = value;
          },
        },
      },
    };
    context.browser = browser;
  }

  vm.runInNewContext(detectorsSource, context, {
    filename: "extension/content/detectors.js",
  });
  vm.runInNewContext(backgroundSource, context, {
    filename: "extension/background.js",
  });
  return { context, listener, menuListener, calls, createdMenus };
}

describe("custom protocol background fallback", () => {
  test("reports success only after Chrome tabs.update completes", () => {
    const fixture = backgroundWith((_id, _options, callback) => callback());
    let response = null;
    const asynchronous = fixture.listener(
      { type: "RALGRUM_OPEN", url: "ralgrum://open?provider=deezer" },
      { tab: { id: 7 } },
      (value) => {
        response = value;
      },
    );
    assert.equal(asynchronous, true);
    assert.equal(response && response.ok, true);
  });

  test("reports a rejected Chrome navigation", () => {
    const fixture = backgroundWith((_id, _options, callback) => {
      fixture.context.chrome.runtime.lastError = { message: "blocked" };
      callback();
    });
    let response = null;
    fixture.listener(
      { type: "RALGRUM_OPEN", url: "ralgrum://open?provider=deezer" },
      { tab: { id: 7 } },
      (value) => {
        response = value;
      },
    );
    assert.equal(response && response.ok, false);
  });

  test("does not claim success without a sender tab", () => {
    const fixture = backgroundWith(() =>
      assert.fail("tabs.update should not run"),
    );
    let response = null;
    const asynchronous = fixture.listener(
      { type: "RALGRUM_OPEN", url: "ralgrum://open?provider=deezer" },
      {},
      (value) => {
        response = value;
      },
    );
    assert.equal(asynchronous, false);
    assert.equal(response && response.ok, false);
  });

  test("context menus use the shared detector for SoundCloud albums", () => {
    const fixture = backgroundWith((_id, _options, callback) => callback());
    fixture.menuListener(
      { pageUrl: "https://soundcloud.com/someartist/albums/some-album" },
      { id: 9 },
    );
    assert.equal(fixture.calls.length, 1);
    const link = new URL(fixture.calls[0].options.url);
    assert.equal(link.searchParams.get("provider"), "soundcloud");
    assert.equal(link.searchParams.get("type"), "album");
    assert.equal(link.searchParams.get("action"), "open");
  });
});

describe("Firefox promise APIs", () => {
  test("returns a promise response and opens through browser.tabs.update", async () => {
    const fixture = backgroundWith(() => Promise.resolve(), "browser");
    const result = fixture.listener(
      { type: "RALGRUM_OPEN", url: "ralgrum://open?provider=soundcloud" },
      { tab: { id: 11 } },
    );
    assert.equal((await result).ok, true);
    assert.equal(fixture.calls.length, 1);
  });

  test("reports a rejected browser navigation", async () => {
    const fixture = backgroundWith(
      () => Promise.reject(new Error("blocked")),
      "browser",
    );
    const result = fixture.listener(
      { type: "RALGRUM_OPEN", url: "ralgrum://open?provider=soundcloud" },
      { tab: { id: 11 } },
    );
    assert.equal((await result).ok, false);
  });

  test("browser context menus use the shared SoundCloud album parser", () => {
    const fixture = backgroundWith(() => Promise.resolve(), "browser");
    fixture.menuListener(
      { pageUrl: "https://soundcloud.com/someartist/albums/some-album" },
      { id: 12 },
    );
    assert.equal(fixture.calls.length, 1);
    assert.equal(
      new URL(fixture.calls[0].options.url).searchParams.get("type"),
      "album",
    );
  });
});

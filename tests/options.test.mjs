import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, test } from "node:test";

const optionsSource = readFileSync(
  new URL("../extension/options/options.js", import.meta.url),
  "utf8",
);
const backgroundSource = readFileSync(
  new URL("../extension/background.js", import.meta.url),
  "utf8",
);
const htmlSources = Object.fromEntries(
  ["options", "popup"].map((surface) => [
    surface,
    readFileSync(
      new URL(`../extension/${surface}/${surface}.html`, import.meta.url),
      "utf8",
    ),
  ]),
);
const defaults = {
  autoShow: true,
  showOnTrack: true,
  showOnCollection: true,
  showOnArtist: true,
  providers: { deezer: true, soundcloud: true },
};
const settle = () => new Promise((resolve) => setImmediate(resolve));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function mountView(apiName, api, surface = "options") {
  const controls = {};
  for (const match of htmlSources[surface].matchAll(/<input\b([^>]+)>/g)) {
    const attributes = match[1];
    const id = attributes.match(/\bid="([^"]+)"/)[1];
    const listeners = {};
    controls[id] = {
      checked: /\bchecked\b/.test(attributes),
      disabled: /\bdisabled\b/.test(attributes),
      addEventListener(name, listener) {
        listeners[name] = listener;
      },
      change(value) {
        if (this.disabled) return;
        this.checked = value;
        listeners.change();
      },
    };
  }
  let ready;
  const context = {
    document: {
      getElementById(id) {
        return controls[id];
      },
      addEventListener(name, listener) {
        if (name === "DOMContentLoaded") ready = listener;
      },
    },
  };
  if (api) context[apiName] = api;
  vm.runInNewContext(optionsSource, context, {
    filename: "extension/options/options.js",
  });
  const beforeReady = Object.values(controls).map(
    (control) => control.disabled,
  );
  ready();
  return { controls, beforeReady };
}

function settingsEnvironment(apiName, initial = {}) {
  let persisted = { ...structuredClone(defaults), ...structuredClone(initial) };
  let messageListener;
  let failWrite = false;
  const storageListeners = [];
  const messages = [];

  function update(patch) {
    const changes = {};
    for (const [key, value] of Object.entries(patch)) {
      changes[key] = {
        oldValue: persisted[key],
        newValue: structuredClone(value),
      };
      persisted[key] = structuredClone(value);
    }
    for (const listener of storageListeners)
      listener(structuredClone(changes), "sync");
  }

  function makeApi(view) {
    const runtime = {
      lastError: null,
      onInstalled: { addListener() {} },
      onMessage: {
        addListener(listener) {
          messageListener = listener;
        },
      },
    };
    function deliver(promise, callback) {
      if (apiName === "browser") return promise;
      promise.then(
        (value) => callback && callback(value),
        (error) => {
          runtime.lastError = { message: error.message };
          try {
            if (callback) callback();
          } finally {
            runtime.lastError = null;
          }
        },
      );
    }
    runtime.sendMessage = (message, callback) => {
      messages.push(structuredClone(message));
      let response;
      if (view.rejectMessage) {
        view.rejectMessage = false;
        response = Promise.reject(new Error("Message channel closed"));
      } else {
        response =
          apiName === "browser"
            ? Promise.resolve(messageListener(message, {}))
            : new Promise((resolve) => messageListener(message, {}, resolve));
      }
      if (view.holdResponse) {
        view.holdResponse = false;
        response = response.then((result) => {
          const held = deferred();
          view.responses.push(() => held.resolve(result));
          return held.promise;
        });
      }
      return deliver(response, callback);
    };
    return {
      runtime,
      storage: {
        onChanged: {
          addListener(listener) {
            storageListeners.push(listener);
          },
        },
        sync: {
          get(_keys, callback) {
            const snapshot = structuredClone(persisted);
            if (view && view.holdRead) {
              const held = deferred();
              view.reads.push({
                release: () => held.resolve(snapshot),
                reject: held.reject,
              });
              return deliver(held.promise, callback);
            }
            return deliver(Promise.resolve(snapshot), callback);
          },
          set(patch, callback) {
            const save = Promise.resolve().then(() => {
              if (failWrite) {
                failWrite = false;
                throw new Error("Storage quota exceeded");
              }
              update(patch);
            });
            return deliver(save, callback);
          },
        },
      },
    };
  }

  vm.runInNewContext(
    backgroundSource,
    { [apiName]: makeApi(null) },
    { filename: "extension/background.js" },
  );
  return {
    messages,
    persisted: () => structuredClone(persisted),
    update,
    failNextWrite() {
      failWrite = true;
    },
    open({ surface = "options", holdRead = false } = {}) {
      const view = {
        holdRead,
        reads: [],
        holdResponse: false,
        responses: [],
        rejectMessage: false,
      };
      return Object.assign(view, mountView(apiName, makeApi(view), surface));
    },
  };
}

describe("settings initialization", () => {
  test("both surfaces disable editing until a delayed read and preserve newer storage events", async () => {
    const env = settingsEnvironment("chrome", {
      autoShow: false,
      providers: { deezer: false, soundcloud: true },
    });
    await settle();
    const views = [
      env.open({ holdRead: true }),
      env.open({ surface: "popup", holdRead: true }),
    ];
    for (const view of views) {
      assert.deepEqual(view.beforeReady, [true, true, true, true, true, true]);
      assert.equal(view.controls.showOnArtist.disabled, true);
      view.controls.showOnArtist.change(false);
    }
    assert.deepEqual(env.messages, []);
    assert.equal(env.persisted().showOnArtist, true);
    env.update({
      showOnArtist: false,
      providers: { deezer: false, soundcloud: false },
    });
    for (const view of views) view.reads.shift().release();
    await settle();
    for (const view of views) {
      assert.equal(view.controls.autoShow.disabled, false);
      assert.equal(view.controls.autoShow.checked, false);
      assert.equal(view.controls.showOnArtist.checked, false);
      assert.equal(view.controls.deezer.checked, false);
      assert.equal(view.controls.soundcloud.checked, false);
    }
  });

  test("a failed promise read leaves controls disabled without allowing a write", async () => {
    const env = settingsEnvironment("browser");
    await settle();
    const view = env.open({ holdRead: true });
    await settle();
    view.reads.shift().reject(new Error("Sync unavailable"));
    await settle();
    view.controls.autoShow.change(false);
    assert.equal(view.controls.autoShow.disabled, true);
    assert.deepEqual(env.messages, []);
  });

  test("standalone previews enable defaults without extension APIs", () => {
    const view = mountView(null, null);
    assert.equal(view.controls.autoShow.checked, true);
    assert.equal(view.controls.autoShow.disabled, false);
    view.controls.autoShow.change(false);
    assert.equal(view.controls.autoShow.checked, false);
  });
});

describe("concurrent settings views", () => {
  test("a popup provider edit survives an unrelated change in the options page", async () => {
    const env = settingsEnvironment("chrome");
    await settle();
    const options = env.open();
    const popup = env.open({ surface: "popup" });
    await settle();
    popup.controls.deezer.change(false);
    await settle();
    assert.equal(options.controls.deezer.checked, false);
    options.controls.showOnArtist.change(false);
    await settle();
    assert.equal(env.persisted().providers.deezer, false);
    assert.equal(env.persisted().showOnArtist, false);
    assert.equal(popup.controls.showOnArtist.checked, false);
  });

  test("rapid promise-API edits retain the latest click and independent provider changes", async () => {
    const env = settingsEnvironment("browser");
    await settle();
    const options = env.open();
    const popup = env.open({ surface: "popup" });
    await settle();
    options.holdResponse = true;
    options.controls.deezer.change(false);
    await settle();
    options.controls.deezer.change(true);
    popup.controls.soundcloud.change(false);
    await settle();
    assert.equal(options.controls.deezer.checked, true);
    assert.equal(options.controls.soundcloud.checked, false);
    options.responses.shift()();
    await settle();
    assert.deepEqual(env.persisted().providers, {
      deezer: true,
      soundcloud: false,
    });
    for (const view of [options, popup]) {
      assert.equal(view.controls.deezer.checked, true);
      assert.equal(view.controls.soundcloud.checked, false);
    }
  });

  test("a delayed reply cannot replace a newer sibling edit", async () => {
    const env = settingsEnvironment("chrome");
    await settle();
    const options = env.open();
    const popup = env.open({ surface: "popup" });
    await settle();
    options.holdResponse = true;
    options.controls.showOnArtist.change(false);
    await settle();
    popup.controls.showOnArtist.change(true);
    await settle();
    options.responses.shift()();
    await settle();
    assert.equal(options.controls.showOnArtist.checked, true);
    assert.equal(env.persisted().showOnArtist, true);
  });

  test("a failed storage save restores authority and does not discard the next intent", async () => {
    const env = settingsEnvironment("browser");
    await settle();
    const view = env.open();
    await settle();
    env.failNextWrite();
    view.controls.autoShow.change(false);
    view.controls.showOnArtist.change(false);
    await settle();
    assert.equal(view.controls.autoShow.checked, true);
    assert.equal(view.controls.showOnArtist.checked, false);
    assert.equal(env.persisted().autoShow, true);
    assert.equal(env.persisted().showOnArtist, false);
  });

  for (const apiName of ["chrome", "browser"]) {
    test(`${apiName} message failures restore saved values and allow another edit`, async () => {
      const env = settingsEnvironment(apiName, {
        providers: { deezer: false, soundcloud: true },
      });
      await settle();
      const view = env.open();
      await settle();
      view.rejectMessage = true;
      view.controls.deezer.change(true);
      await settle();
      assert.equal(view.controls.deezer.checked, false);
      assert.equal(env.persisted().providers.deezer, false);
      view.controls.showOnArtist.change(false);
      await settle();
      assert.equal(env.persisted().showOnArtist, false);
    });
  }
});

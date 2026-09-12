import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, test } from "node:test";

const backgroundSource = readFileSync(
  new URL("../extension/background.js", import.meta.url),
  "utf8",
);
const defaults = {
  autoShow: true,
  showOnTrack: true,
  showOnCollection: true,
  showOnArtist: true,
  providers: { deezer: true, soundcloud: true },
};
const nextTurn = () => new Promise((resolve) => setImmediate(resolve));

function backgroundSettings(api, initial = defaults) {
  const stored = structuredClone(initial);
  const pending = [];
  const writes = [];
  const thrownErrors = new Map();
  let listener;
  let installed;
  const runtime = {
    lastError: null,
    onMessage: {
      addListener(value) {
        listener = value;
      },
    },
    onInstalled: {
      addListener(value) {
        installed = value;
      },
    },
  };

  function storageCall(method, value, callback) {
    if (thrownErrors.has(method)) {
      const error = thrownErrors.get(method);
      thrownErrors.delete(method);
      throw error;
    }
    const snapshot = structuredClone(method === "get" ? stored : value);
    let resolve;
    let reject;
    const result =
      api === "browser"
        ? new Promise((yes, no) => {
            resolve = yes;
            reject = no;
          })
        : undefined;
    pending.push({
      method,
      complete(error) {
        if (!error && method === "set") {
          Object.assign(stored, snapshot);
          writes.push(snapshot);
        }
        if (api === "chrome") {
          runtime.lastError = error ? { message: error.message } : null;
          try {
            callback(method === "get" && !error ? snapshot : undefined);
          } finally {
            runtime.lastError = null;
          }
        } else if (error) {
          reject(error);
        } else {
          resolve(method === "get" ? snapshot : undefined);
        }
      },
    });
    return result;
  }

  const namespace = {
    runtime,
    storage: {
      sync: {
        get(value, callback) {
          return storageCall("get", value, callback);
        },
        set(value, callback) {
          return storageCall("set", value, callback);
        },
      },
    },
  };
  vm.runInNewContext(
    backgroundSource,
    { [api]: namespace, Promise },
    { filename: "extension/background.js" },
  );

  function send(message) {
    if (api === "browser") {
      return Promise.resolve(listener(message, {})).then(structuredClone);
    }
    return new Promise((resolve, reject) => {
      let channelOpen = true;
      let replied = false;
      const keepAlive = listener(message, {}, (response) => {
        if (channelOpen) {
          replied = true;
          resolve(structuredClone(response));
        }
      });
      if (keepAlive !== true) {
        channelOpen = false;
        if (!replied) {
          reject(new Error("Chrome response channel closed before replying"));
        }
      }
    });
  }

  async function flush() {
    await nextTurn();
    while (pending.length) {
      pending.shift().complete();
      await nextTurn();
    }
  }

  async function pause(method) {
    await nextTurn();
    while (pending.length) {
      const request = pending.shift();
      if (request.method === method) {
        return request;
      }
      request.complete();
      await nextTurn();
    }
    throw new Error(`No pending ${method} operation`);
  }

  return {
    stored,
    writes,
    send,
    flush,
    pause,
    install() {
      installed();
    },
    throwNext(method) {
      thrownErrors.set(method, new Error("Storage unavailable"));
    },
    removeStorage() {
      delete namespace.storage;
    },
  };
}

for (const api of ["chrome", "browser"]) {
  describe(`${api} settings persistence`, () => {
    test("simultaneous provider edits both persist", async () => {
      const background = backgroundSettings(api);
      await background.flush();
      const deezer = background.send({
        type: "RALGRUM_SET_SETTING",
        key: "deezer",
        value: false,
      });
      const soundcloud = background.send({
        type: "RALGRUM_SET_SETTING",
        key: "soundcloud",
        value: false,
      });
      await background.flush();
      assert.equal((await deezer).ok, true);
      assert.deepEqual(background.stored, {
        ...defaults,
        providers: { deezer: false, soundcloud: false },
      });
      assert.deepEqual(await soundcloud, {
        ok: true,
        settings: background.stored,
      });
    });

    test("an intended scalar edit ignores stale unrelated values", async () => {
      const initial = {
        ...defaults,
        autoShow: false,
        showOnTrack: false,
        providers: { deezer: false, soundcloud: true, futureProvider: false },
        unrelated: { enabled: false },
      };
      const background = backgroundSettings(api, initial);
      await background.flush();
      const response = background.send({
        type: "RALGRUM_SET_SETTING",
        key: "showOnArtist",
        value: false,
        autoShow: true,
        showOnTrack: true,
        providers: { deezer: true, soundcloud: true },
      });
      await background.flush();
      assert.deepEqual(background.stored, { ...initial, showOnArtist: false });
      assert.deepEqual(await response, {
        ok: true,
        settings: background.stored,
      });
    });

    test("provider edits preserve unknown provider flags and unrelated fields", async () => {
      const initial = {
        ...defaults,
        showOnCollection: false,
        providers: { deezer: true, soundcloud: false, futureProvider: false },
        unrelated: "keep me",
      };
      const background = backgroundSettings(api, initial);
      await background.flush();
      const response = background.send({
        type: "RALGRUM_SET_SETTING",
        key: "deezer",
        value: false,
      });
      await background.flush();
      assert.deepEqual(background.stored, {
        ...initial,
        providers: { deezer: false, soundcloud: false, futureProvider: false },
      });
      assert.deepEqual(await response, {
        ok: true,
        settings: background.stored,
      });
    });

    test("pending startup defaults and installation cannot undo user toggles", async () => {
      const background = backgroundSettings(api, {
        providers: { deezer: false },
      });
      const firstRead = await background.pause("get");
      const autoShow = background.send({
        type: "RALGRUM_SET_SETTING",
        key: "autoShow",
        value: false,
      });
      const soundcloud = background.send({
        type: "RALGRUM_SET_SETTING",
        key: "soundcloud",
        value: false,
      });
      background.install();
      firstRead.complete();
      const defaultWrite = await background.pause("set");
      defaultWrite.complete();
      await background.flush();
      assert.equal((await autoShow).ok, true);
      assert.deepEqual(background.stored, {
        ...defaults,
        autoShow: false,
        providers: { deezer: false, soundcloud: false },
      });
      assert.deepEqual(await soundcloud, {
        ok: true,
        settings: background.stored,
      });
    });

    test("success is not reported before the write persists", async () => {
      const background = backgroundSettings(api);
      await background.flush();
      let replied = false;
      const response = background
        .send({ type: "RALGRUM_SET_SETTING", key: "deezer", value: false })
        .then((value) => {
          replied = true;
          return value;
        });
      const write = await background.pause("set");
      assert.equal(replied, false);
      assert.equal(background.stored.providers.deezer, true);
      write.complete();
      await background.flush();
      assert.deepEqual(await response, {
        ok: true,
        settings: background.stored,
      });
      assert.equal(background.stored.providers.deezer, false);
    });

    test("invalid settings messages never write storage", async () => {
      const background = backgroundSettings(api);
      await background.flush();
      const invalid = [
        { key: "providers", value: false },
        { key: "unknown", value: true },
        { key: "__proto__", value: true },
        { key: "deezer", value: "false" },
        { key: "autoShow", value: 0 },
        { value: false },
        { key: "showOnArtist" },
      ];
      const responses = invalid.map((fields) =>
        background.send({ type: "RALGRUM_SET_SETTING", ...fields }),
      );
      await background.flush();
      assert.deepEqual(
        await Promise.all(responses),
        invalid.map(() => ({ ok: false })),
      );
      assert.deepEqual(background.stored, defaults);
      assert.deepEqual(background.writes, []);
    });

    for (const method of ["get", "set"]) {
      test(`a failed ${method} reports failure and does not poison later edits`, async () => {
        const background = backgroundSettings(api);
        await background.flush();
        const response = background.send({
          type: "RALGRUM_SET_SETTING",
          key: "deezer",
          value: false,
        });
        const request = await background.pause(method);
        request.complete(new Error("Storage operation failed"));
        await background.flush();
        assert.deepEqual(await response, { ok: false });
        assert.deepEqual(background.stored, defaults);
        const recovery = background.send({
          type: "RALGRUM_SET_SETTING",
          key: "soundcloud",
          value: false,
        });
        await background.flush();
        assert.deepEqual(background.stored.providers, {
          deezer: true,
          soundcloud: false,
        });
        assert.deepEqual(await recovery, {
          ok: true,
          settings: background.stored,
        });
      });
    }

    test("failed initialization does not discard a queued user edit", async () => {
      const background = backgroundSettings(api, {});
      const firstRead = await background.pause("get");
      const response = background.send({
        type: "RALGRUM_SET_SETTING",
        key: "deezer",
        value: false,
      });
      firstRead.complete(new Error("Startup read failed"));
      await background.flush();
      assert.deepEqual(background.stored, {
        ...defaults,
        providers: { deezer: false, soundcloud: true },
      });
      assert.deepEqual(await response, {
        ok: true,
        settings: background.stored,
      });
    });

    test("synchronous storage failures report failure", async () => {
      const background = backgroundSettings(api);
      await background.flush();
      background.throwNext("set");
      const response = background.send({
        type: "RALGRUM_SET_SETTING",
        key: "showOnTrack",
        value: false,
      });
      await background.flush();
      assert.deepEqual(await response, { ok: false });
      assert.deepEqual(background.stored, defaults);
    });

    test("unavailable storage reports failure", async () => {
      const background = backgroundSettings(api);
      await background.flush();
      background.removeStorage();
      const response = background.send({
        type: "RALGRUM_SET_SETTING",
        key: "showOnCollection",
        value: false,
      });
      await background.flush();
      assert.deepEqual(await response, { ok: false });
      assert.deepEqual(background.stored, defaults);
    });
  });
}

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, test } from "node:test";

const source = readFileSync(
  new URL("../extension/content/spa-navigation.js", import.meta.url),
  "utf8",
);

function createDomFixture() {
  const observers = new Set();

  function queueMutation(record) {
    for (const observer of observers) {
      const { target, options } = observer;
      let ancestor = record.target;
      while (ancestor && ancestor !== target) {
        ancestor = ancestor.parentNode;
      }
      if (
        !ancestor ||
        (record.target !== target && !options.subtree) ||
        !options[record.type]
      ) {
        continue;
      }
      if (
        record.type === "attributes" &&
        options.attributeFilter &&
        !options.attributeFilter.includes(record.attributeName)
      ) {
        continue;
      }
      observer.records.push(record);
    }
  }

  const document = {
    createElement(tagName) {
      const attributes = new Map();
      return {
        nodeType: 1,
        tagName: tagName.toUpperCase(),
        parentNode: null,
        parentElement: null,
        childNodes: [],
        appendChild(child) {
          child.parentNode = this;
          child.parentElement = this;
          this.childNodes.push(child);
          queueMutation({
            type: "childList",
            target: this,
            addedNodes: [child],
            removedNodes: [],
          });
          return child;
        },
        setAttribute(name, value) {
          attributes.set(name, String(value));
          queueMutation({
            type: "attributes",
            target: this,
            attributeName: name,
          });
        },
        closest(selector) {
          if (!/^\.[\w-]+$/.test(selector)) {
            throw new Error("The DOM fixture supports class selectors only");
          }
          for (let node = this; node; node = node.parentElement) {
            if (node.hasClass(selector.slice(1))) {
              return node;
            }
          }
          return null;
        },
        hasClass(name) {
          return (attributes.get("class") || "").split(/\s+/).includes(name);
        },
      };
    },
    createTextNode(initialData) {
      let data = String(initialData);
      return {
        nodeType: 3,
        parentNode: null,
        parentElement: null,
        get data() {
          return data;
        },
        set data(value) {
          data = String(value);
          queueMutation({ type: "characterData", target: this });
        },
      };
    },
  };
  document.documentElement = document.createElement("html");
  document.head = document.documentElement.appendChild(
    document.createElement("head"),
  );
  document.body = document.documentElement.appendChild(
    document.createElement("body"),
  );

  return {
    document,
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        this.records = [];
      }
      observe(target, options) {
        this.target = target;
        this.options = options;
        observers.add(this);
      }
    },
    flushMutations() {
      for (const observer of observers) {
        if (observer.records.length) {
          observer.callback(observer.records.splice(0));
        }
      }
    },
  };
}

function loadCoordinator(initialHref) {
  let href = initialHref;
  let now = 0;
  let nextTimer = 1;
  const timers = new Map();
  const intervals = new Map();
  const listeners = {};
  const dom = createDomFixture();

  function setTimeoutFake(callback, delay) {
    const id = nextTimer++;
    timers.set(id, { at: now + delay, callback });
    return id;
  }
  function clearTimeoutFake(id) {
    timers.delete(id);
  }
  function setIntervalFake(callback, delay) {
    const id = nextTimer++;
    intervals.set(id, { at: now + delay, delay, callback });
    return id;
  }
  function clearIntervalFake(id) {
    intervals.delete(id);
  }
  function runDue() {
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.callback();
          dom.flushMutations();
          progressed = true;
        }
      }
      for (const interval of intervals.values()) {
        if (interval.at <= now) {
          interval.at += interval.delay;
          interval.callback();
          dom.flushMutations();
          progressed = true;
        }
      }
    }
  }
  function advance(milliseconds) {
    dom.flushMutations();
    now += milliseconds;
    runDue();
  }
  function setHref(value) {
    href = new URL(value, href).href;
  }
  function parseEntity() {
    const url = new URL(href);
    const match = url.pathname.match(/^\/album\/(\d+)\/?$/);
    return match
      ? { provider: "deezer", type: "album", id: match[1], url: href }
      : null;
  }
  const location = {};
  Object.defineProperty(location, "href", { get: () => href });
  const history = {
    pushState(_state, _title, value) {
      setHref(value);
    },
    replaceState(_state, _title, value) {
      setHref(value);
    },
  };
  const document = dom.document;
  const window = {
    location,
    history,
    document,
    addEventListener(type, callback) {
      listeners[type] = callback;
    },
    MutationObserver: dom.MutationObserver,
  };
  const context = {
    window,
    URL,
    Promise,
    setTimeout: setTimeoutFake,
    clearTimeout: clearTimeoutFake,
    setInterval: setIntervalFake,
    clearInterval: clearIntervalFake,
  };
  vm.runInNewContext(source, context, {
    filename: "content/spa-navigation.js",
  });

  function trigger(type) {
    if (listeners[type]) {
      listeners[type]();
    }
  }
  function triggerMutation() {
    document.body.appendChild(document.createElement("div"));
  }
  return {
    api: window.RalgrumSpaNavigation,
    document,
    history,
    setHref,
    trigger,
    triggerMutation,
    advance,
    parseEntity,
  };
}

describe("shared SPA navigation", () => {
  test("normalizes Deezer and SoundCloud identities without query, hash, or trailing slash changes", () => {
    const fixture = loadCoordinator("https://www.deezer.com/album/1");
    const api = fixture.api;
    assert.equal(
      api.entityKey({
        provider: "deezer",
        type: "album",
        id: "1",
        url: "https://www.deezer.com/album/1",
      }),
      "deezer:album:1",
    );
    assert.equal(
      api.entityKey({
        provider: "soundcloud",
        type: "track",
        url: "https://SOUNDCLOUD.com/user/song/?utm=1#play",
      }),
      "soundcloud:track:soundcloud.com/user/song",
    );
  });

  test("coalesces route and mutation refreshes while emitting one navigation per logical entity", () => {
    const fixture = loadCoordinator("https://www.deezer.com/album/1");
    const navigations = [];
    const refreshes = [];
    const navApi = fixture.api;
    navApi.start({
      readEntity: fixture.parseEntity,
      onNavigate: (entity, generation) =>
        navigations.push({ key: navApi.entityKey(entity), generation }),
      onRefresh: (entity, generation) =>
        refreshes.push({ key: navApi.entityKey(entity), generation }),
    });
    fixture.advance(0);
    assert.equal(navigations.length, 1);

    fixture.history.pushState({}, "", "https://www.deezer.com/album/2");
    assert.equal(navigations.length, 2);
    fixture.history.replaceState({}, "", "https://www.deezer.com/album/3");
    assert.equal(navigations.length, 3);
    fixture.setHref("https://www.deezer.com/album/4");
    fixture.trigger("popstate");
    assert.equal(navigations.length, 4);

    fixture.history.pushState(
      {},
      "",
      "https://www.deezer.com/album/4?tab=tracks#top",
    );
    assert.equal(navigations.length, 4);
    fixture.triggerMutation();
    fixture.triggerMutation();
    fixture.advance(499);
    const beforeMutationRefresh = refreshes.length;
    fixture.advance(1);
    assert.equal(refreshes.length, beforeMutationRefresh + 1);
  });

  test("refreshes existing JSON-LD text after settling without another navigation", () => {
    const fixture = loadCoordinator("https://www.deezer.com/album/1");
    const script = fixture.document.head.appendChild(
      fixture.document.createElement("script"),
    );
    const metadata = script.appendChild(
      fixture.document.createTextNode('{"followers":1234}'),
    );
    const followers = [];
    const navigations = [];
    const api = fixture.api.start({
      readEntity: fixture.parseEntity,
      onNavigate: (_entity, generation) => navigations.push(generation),
      onRefresh: () => followers.push(JSON.parse(metadata.data).followers),
    });
    fixture.advance(2000);
    followers.length = 0;
    const generation = api.generation();

    metadata.data = '{"followers":1235}';
    fixture.advance(499);
    assert.deepEqual(followers, []);
    fixture.advance(1);
    assert.deepEqual(followers, [1235]);
    fixture.advance(2400);
    assert.deepEqual(followers, [1235]);
    assert.deepEqual(navigations, [generation]);
    assert.equal(api.generation(), generation);
  });

  test("ignores toast text and element changes but refreshes metadata in the same batch without looping", () => {
    const fixture = loadCoordinator("https://www.deezer.com/album/1");
    const host = fixture.document.body.appendChild(
      fixture.document.createElement("div"),
    );
    host.setAttribute("class", "ralgrum-toast-host");
    const label = host.appendChild(fixture.document.createElement("a"));
    const toastText = label.appendChild(
      fixture.document.createTextNode("Loading"),
    );
    const script = fixture.document.head.appendChild(
      fixture.document.createElement("script"),
    );
    const metadata = script.appendChild(
      fixture.document.createTextNode('{"followers":1234}'),
    );
    const followers = [];
    fixture.api.start({
      readEntity: fixture.parseEntity,
      onNavigate() {},
      onRefresh() {
        const count = JSON.parse(metadata.data).followers;
        followers.push(count);
        toastText.data = `${count} followers`;
        label.setAttribute("href", "ralgrum://open");
      },
    });
    fixture.advance(2000);
    followers.length = 0;
    fixture.advance(2000);
    assert.deepEqual(followers, []);

    toastText.data = "Updated toast";
    label.setAttribute("href", "ralgrum://play");
    host.appendChild(fixture.document.createElement("button"));
    fixture.advance(500);
    assert.deepEqual(followers, []);

    toastText.data = "Another toast update";
    metadata.data = '{"followers":1235}';
    fixture.advance(500);
    assert.deepEqual(followers, [1235]);
    assert.equal(toastText.data, "1235 followers");
    fixture.advance(500);
    fixture.advance(500);
    assert.deepEqual(followers, [1235]);
  });

  test("cancels stale generation retries", () => {
    const fixture = loadCoordinator("https://www.deezer.com/album/1");
    const refreshes = [];
    const navApi = fixture.api;
    const api = navApi.start({
      readEntity: fixture.parseEntity,
      onNavigate() {},
      onRefresh: (entity, generation) =>
        refreshes.push({ key: navApi.entityKey(entity), generation }),
    });
    fixture.history.pushState({}, "", "https://www.deezer.com/album/2");
    fixture.history.pushState({}, "", "https://www.deezer.com/album/3");
    fixture.advance(2000);
    assert.deepEqual(
      [...new Set(refreshes.map((item) => item.key))],
      ["deezer:album:3"],
    );
    assert.ok(refreshes.every((item) => item.generation === api.generation()));
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, test } from "node:test";

const source = readFileSync(new URL("../extension/content/toast.js", import.meta.url), "utf8");
const detectorsSource = readFileSync(new URL("../extension/content/detectors.js", import.meta.url), "utf8");
const HTML_NS = "http://www.w3.org/1999/xhtml";
const SVG_NS = "http://www.w3.org/2000/svg";

function createDocument() {
  let focused = null;

  function selectorMatcher(selector) {
    if (selector === "*") return () => true;
    if (/^\.[\w-]+$/.test(selector)) {
      return (node) => node.className.split(/\s+/).includes(selector.slice(1));
    }
    if (/^[a-z][\w-]*$/.test(selector)) return (node) => node.localName === selector;
    const attribute = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(selector);
    if (attribute) {
      return (node) =>
        attribute[2] === undefined
          ? node.getAttribute(attribute[1]) !== null
          : node.getAttribute(attribute[1]) === attribute[2];
    }
    throw new Error(`Unsupported fixture selector: ${selector}`);
  }

  class Node {
    constructor(localName, namespaceURI = HTML_NS, host = null) {
      this.localName = localName;
      this.namespaceURI = namespaceURI;
      this.nodeType = host ? 11 : 1;
      this.host = host;
      this.parentNode = null;
      this.childNodes = [];
      this.style = Object.seal({ color: "" });
      this._text = "";
      this._attributes = new Map();
      this._listeners = new Map();
      this._shadowRoot = null;
      Object.seal(this);
    }
    get className() {
      return this.getAttribute("class") || "";
    }
    set className(value) {
      this.setAttribute("class", value);
    }
    get textContent() {
      return this._text + this.childNodes.map((node) => node.textContent).join("");
    }
    set textContent(value) {
      for (const child of [...this.childNodes]) this.removeChild(child);
      this._text = value == null ? "" : String(value);
    }
    set innerHTML(_value) {
      throw new Error("HTML parsing sinks are forbidden in the toast fixture");
    }
    set outerHTML(_value) {
      throw new Error("HTML parsing sinks are forbidden in the toast fixture");
    }
    insertAdjacentHTML() {
      throw new Error("HTML parsing sinks are forbidden in the toast fixture");
    }
    get shadowRoot() {
      return this._shadowRoot;
    }
    attachShadow(options) {
      assert.deepEqual(Object.keys(options), ["mode"]);
      assert.equal(options.mode, "open");
      assert.equal(this._shadowRoot, null);
      this._shadowRoot = new Node("#shadow-root", null, this);
      return this._shadowRoot;
    }
    get activeElement() {
      assert.equal(this.nodeType, 11, "Only shadow roots expose activeElement");
      return focused && this.contains(focused) ? focused : null;
    }
    setAttribute(name, value) {
      this._attributes.set(name, String(value));
    }
    getAttribute(name) {
      return this._attributes.has(name) ? this._attributes.get(name) : null;
    }
    getAttributeNames() {
      return [...this._attributes.keys()];
    }
    appendChild(node) {
      assert.ok(node instanceof Node, "appendChild requires a fixture node");
      assert.ok(!node.contains(this), "A node cannot contain itself");
      if (node.parentNode) node.parentNode.removeChild(node);
      this.childNodes.push(node);
      node.parentNode = this;
      return node;
    }
    removeChild(node) {
      const index = this.childNodes.indexOf(node);
      assert.notEqual(index, -1, "removeChild requires a direct child");
      if (node.contains(focused) || node.contains(document.activeElement)) focused = null;
      this.childNodes.splice(index, 1);
      node.parentNode = null;
      return node;
    }
    contains(node) {
      for (let current = node; current; current = current.parentNode) {
        if (current === this) return true;
      }
      return false;
    }
    matches(selector) {
      return selectorMatcher(selector)(this);
    }
    closest(selector) {
      const matches = selectorMatcher(selector);
      for (let node = this; node && node.nodeType === 1; node = node.parentNode) {
        if (matches(node)) return node;
      }
      return null;
    }
    querySelectorAll(selector) {
      const matches = selectorMatcher(selector);
      const results = [];
      function visit(parent) {
        for (const child of parent.childNodes) {
          if (matches(child)) results.push(child);
          visit(child);
        }
      }
      visit(this);
      return results;
    }
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }
    addEventListener(type, listener) {
      assert.equal(type, "click", "Only click listeners are modeled");
      if (!this._listeners.has(type)) this._listeners.set(type, []);
      this._listeners.get(type).push(listener);
    }
    focus(options = {}) {
      assert.ok(Object.keys(options).every((key) => key === "preventScroll"));
      let root = this;
      while (root.parentNode || root.host) root = root.parentNode || root.host;
      if (root !== document.documentElement) return;
      if (this.localName !== "button" && this.getAttribute("tabindex") === null) return;
      focused = this;
    }
  }

  const document = {
    documentElement: new Node("html"),
    createElement(tag) {
      return new Node(tag.toLowerCase());
    },
    createElementNS(namespace, tag) {
      assert.equal(namespace, SVG_NS, "Only SVG namespaced elements are needed");
      return new Node(tag, namespace);
    },
    querySelector(selector) {
      return this.documentElement.querySelector(selector);
    },
    get activeElement() {
      if (!focused) return null;
      let root = focused;
      while (root.parentNode) root = root.parentNode;
      return root.host || focused;
    }
  };
  return document;
}

function loadToast(runtime) {
  let nextTimer = 1;
  let now = 0;
  const timers = new Map();
  const navigations = [];
  const document = createDocument();
  const window = {
    document,
    location: {
      set href(value) {
        navigations.push(value);
      }
    }
  };
  const context = {
    window,
    document,
    Promise,
    URL,
    URLSearchParams,
    Date: { now: () => now },
    setTimeout(callback, delay) {
      const id = nextTimer++;
      timers.set(id, { at: now + delay, callback });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    }
  };
  if (runtime.chrome) {
    context.chrome = runtime.chrome;
    window.chrome = runtime.chrome;
  }
  if (runtime.browser) {
    context.browser = runtime.browser;
    window.browser = runtime.browser;
  }
  vm.runInNewContext(detectorsSource, context, { filename: "content/detectors.js" });
  vm.runInNewContext(source, context, { filename: "content/toast.js" });
  function advance(milliseconds) {
    now += milliseconds;
    let due = [...timers.entries()].filter(([, timer]) => timer.at <= now);
    while (due.length) {
      for (const [id, timer] of due) {
        timers.delete(id);
        timer.callback();
      }
      due = [...timers.entries()].filter(([, timer]) => timer.at <= now);
    }
  }
  function getHost() {
    return document.querySelector(".ralgrum-toast-host");
  }
  function getRoot() {
    return getHost()?.shadowRoot || getHost();
  }
  function query(selector) {
    return getRoot()?.querySelector(selector) || null;
  }
  function click(target) {
    if (typeof target === "string") target = query(target);
    assert.ok(target, "The click target must be rendered");
    const event = { type: "click", target, currentTarget: null };
    for (let node = target; node; node = node.parentNode) {
      event.currentTarget = node;
      for (const listener of node._listeners.get("click") || []) listener(event);
    }
  }
  return {
    toast: window.RalgrumToast,
    document,
    getHost,
    getRoot,
    query,
    navigations,
    click,
    clickDismiss: () => click(query(".rg-x").querySelector("path")),
    advance
  };
}

const entity = {
  provider: "deezer",
  type: "album",
  id: "42",
  url: "https://www.deezer.com/album/42"
};

describe("toast runtime integration", () => {
  test("uses the logo when the preview runtime is installed after the toast script", () => {
    const chrome = {};
    const fixture = loadToast({ chrome });
    chrome.runtime = { getURL: () => "chrome-extension://one/icons/icon32.png" };
    fixture.toast.show(entity, { title: "Album", subtitle: "Artist" }, []);
    assert.equal(fixture.query(".rg-logo").localName, "img");
    assert.equal(fixture.query(".rg-logo").getAttribute("src"), "chrome-extension://one/icons/icon32.png");
    assert.equal(fixture.query(".rg-logo-fallback"), null);
  });

  test("recovers the logo after rendering without an available runtime", () => {
    const chrome = {};
    const fixture = loadToast({ chrome });
    fixture.toast.show(entity, { title: "Album", subtitle: "Artist" }, []);
    assert.equal(fixture.query(".rg-logo-fallback").textContent, "R");

    chrome.runtime = { getURL: () => "chrome-extension://one/icons/icon32.png" };
    fixture.toast.show(entity, { title: "Album", subtitle: "Artist" }, []);
    assert.equal(fixture.query(".rg-logo").getAttribute("src"), "chrome-extension://one/icons/icon32.png");
    assert.equal(fixture.query(".rg-logo-fallback"), null);
  });

  test("resolves the logo through browser.runtime when Chrome is absent", () => {
    const fixture = loadToast({ browser: { runtime: { getURL: () => "moz-extension://one/icons/icon32.png" } } });
    fixture.toast.show(entity, { title: "Album", subtitle: "Artist" }, []);
    assert.equal(fixture.query(".rg-logo").getAttribute("src"), "moz-extension://one/icons/icon32.png");
  });

  test("does not render a generic collection label at an empty metadata deadline", () => {
    const fixture = loadToast({});
    fixture.toast.showOncePerPage(entity, { title: "", subtitle: "" }, []);
    fixture.advance(6000);
    assert.equal(fixture.getHost(), null);

    fixture.toast.showOncePerPage(entity, { title: "Real album", subtitle: "" }, []);
    fixture.advance(0);
    assert.equal(fixture.query(".rg-htitle").textContent, "Real album");
  });

  test("renders complete authoritative metadata without the settling delay", () => {
    const fixture = loadToast({});
    fixture.toast.showOncePerPage(entity, { title: "DOM title", subtitle: "" }, []);
    assert.equal(fixture.getHost(), null);
    fixture.toast.showOncePerPage(
      entity,
      {
        title: "API title",
        subtitle: "API artist",
        authoritative: true
      },
      []
    );
    assert.ok(fixture.getHost());
    assert.equal(fixture.query(".rg-htitle").textContent, "API title");
    assert.equal(fixture.query(".rg-hmeta").textContent, "API artist");
  });

  test("temporary hiding restores unchanged metadata on the next enabled refresh", () => {
    const fixture = loadToast({});
    const meta = { title: "Album", subtitle: "Artist" };
    fixture.toast.showOncePerPage(entity, meta, []);
    fixture.advance(800);
    assert.equal(fixture.query(".rg-htitle").textContent, "Album");

    fixture.toast.dismiss();
    fixture.advance(6000);
    assert.equal(fixture.getHost(), null);
    fixture.toast.showOncePerPage(entity, meta, []);
    assert.equal(fixture.query(".rg-htitle").textContent, "Album");
  });

  test("temporary hiding cancels a pending toast until an enabled refresh", () => {
    const fixture = loadToast({});
    const meta = { title: "Album", subtitle: "Artist" };
    fixture.toast.showOncePerPage(entity, meta, []);
    fixture.toast.dismiss();
    fixture.advance(6000);
    assert.equal(fixture.getHost(), null);

    fixture.toast.showOncePerPage(entity, meta, []);
    fixture.advance(800);
    assert.equal(fixture.query(".rg-htitle").textContent, "Album");
  });

  for (const authoritative of [true, false]) {
    test(`${authoritative ? "authoritative" : "page"} explicit-only updates add and remove the badge`, () => {
      const fixture = loadToast({});
      const track = { ...entity, type: "track", url: "https://www.deezer.com/track/42" };
      const meta = { title: "Track", subtitle: "Artist", authoritative };
      fixture.toast.showOncePerPage(track, { ...meta, explicit: false }, []);
      fixture.advance(800);
      assert.equal(fixture.query(".rg-ttitle").textContent, "Track");
      assert.equal(fixture.query(".rg-explicit"), null);

      fixture.toast.showOncePerPage(track, { ...meta, explicit: true }, []);
      assert.equal(fixture.query(".rg-explicit").textContent, "E");

      fixture.toast.showOncePerPage(track, meta, []);
      assert.equal(fixture.query(".rg-explicit").textContent, "E");

      fixture.toast.showOncePerPage(track, { ...meta, explicit: false }, []);
      assert.equal(fixture.query(".rg-explicit"), null);
    });
  }

  test("user dismissal survives temporary hiding until navigation reset", () => {
    const fixture = loadToast({});
    fixture.toast.showOncePerPage(entity, { title: "Album", subtitle: "Artist" }, []);
    fixture.advance(800);
    fixture.clickDismiss();
    assert.equal(fixture.getHost(), null);

    fixture.toast.dismiss();
    fixture.toast.showOncePerPage(entity, { title: "Album", subtitle: "Artist" }, []);
    assert.equal(fixture.getHost(), null);

    fixture.toast.showOncePerPage(entity, { title: "Album changed", subtitle: "Artist" }, []);
    assert.equal(fixture.getHost(), null);

    fixture.toast.resetForNavigation();
    fixture.toast.showOncePerPage(entity, { title: "Album changed", subtitle: "Artist" }, []);
    fixture.advance(800);
    assert.ok(fixture.getHost());
  });

  test("renders hostile track and collection metadata as literal text without parsing HTML", () => {
    const title = `</p><script>attack()</script> &amp; "quoted" '<img src=x onerror="attack()">'`;
    const subtitle = `Artist <img src=x onerror='attack()'> &lt;em&gt; & "mix"'`;
    for (const type of ["track", "album"]) {
      const fixture = loadToast({});
      fixture.toast.show({ ...entity, type, url: `https://www.deezer.com/${type}/42` }, { title, subtitle }, []);
      const titleNode = fixture.query(type === "track" ? ".rg-ttitle" : ".rg-htitle");
      const subtitleNode = fixture.query(type === "track" ? ".rg-tartist" : ".rg-hmeta");
      assert.equal(titleNode.textContent, title);
      assert.equal(subtitleNode.textContent, subtitle);
      assert.equal(fixture.query("script"), null);
      assert.equal(fixture.query("img"), null);
      for (const node of fixture.getRoot().querySelectorAll("*")) {
        assert.deepEqual(
          node.getAttributeNames().filter((name) => /^on/i.test(name)),
          []
        );
      }
    }
  });

  test("creates renderable SVG glyphs for both providers and missing track artwork", () => {
    const fixture = loadToast({});
    fixture.toast.show(
      { ...entity, type: "track", url: "https://www.deezer.com/track/42" },
      { title: "Track", subtitle: "Artist" },
      []
    );
    const music = fixture.query(".rg-art-fallback").querySelector("svg");
    const deezer = fixture.query(".rg-prov").querySelector("svg");
    const close = fixture.query(".rg-x").querySelector("svg");
    fixture.toast.show(
      { provider: "soundcloud", type: "playlist", url: "https://soundcloud.com/artist/sets/collection" },
      { title: "Collection", subtitle: "Artist" },
      []
    );
    const soundcloud = fixture.query(".rg-provcol").querySelector("svg");
    for (const glyph of [music, deezer, close, soundcloud]) {
      assert.equal(glyph.namespaceURI, SVG_NS);
      assert.equal(glyph.querySelector("path").namespaceURI, SVG_NS);
    }
    assert.equal(soundcloud.getAttribute("viewBox"), "0 0 640 512");
    assert.equal(close.getAttribute("viewBox"), "0 0 384 512");
  });

  test("primary and related controls navigate to their own original-protocol URLs", () => {
    const fixture = loadToast({});
    const related = { provider: "deezer", type: "artist", id: "7", url: "https://www.deezer.com/artist/7" };
    fixture.toast.show(entity, { title: 'Album & "Mix"', subtitle: "Artist" }, [related]);
    fixture.click(".rg-primary");
    fixture.click(".rg-secondary");
    assert.deepEqual(fixture.navigations, [
      "ralgrum://open?provider=deezer&type=album&id=42&action=open&url=https%3A%2F%2Fwww.deezer.com%2Falbum%2F42&title=Album+%26+%22Mix%22",
      "ralgrum://open?provider=deezer&type=artist&id=7&action=open&url=https%3A%2F%2Fwww.deezer.com%2Fartist%2F7"
    ]);
  });

  test("track title and SVG descendants delegate to the same play action as the primary control", () => {
    const fixture = loadToast({});
    const track = { ...entity, type: "track", url: "https://www.deezer.com/track/42" };
    fixture.toast.show(track, { title: "Track", subtitle: "Artist" }, []);
    fixture.click(".rg-ttitle");
    fixture.click(fixture.query(".rg-art-fallback").querySelector("path"));
    fixture.click(".rg-primary");
    const expected =
      "ralgrum://open?provider=deezer&type=track&id=42&action=play&url=https%3A%2F%2Fwww.deezer.com%2Ftrack%2F42&title=Track";
    assert.deepEqual(fixture.navigations, [expected, expected, expected]);
    fixture.clickDismiss();
    assert.equal(fixture.getHost(), null);
    assert.equal(fixture.navigations.length, 3);
  });

  test("metadata updates preserve focused primary and dismiss controls without focusing detached nodes", () => {
    const fixture = loadToast({});
    const meta = { title: "Album", subtitle: "Artist", authoritative: true };
    fixture.toast.showOncePerPage(entity, meta, []);
    for (const selector of [".rg-primary", ".rg-x"]) {
      const previousRoot = fixture.getRoot();
      const previousControl = fixture.query(selector);
      previousControl.focus();
      assert.equal(previousRoot.activeElement, previousControl);
      fixture.toast.showOncePerPage(entity, { ...meta, title: `Updated ${selector}` }, []);
      const control = fixture.query(selector);
      assert.notEqual(control, previousControl);
      assert.equal(fixture.getRoot().activeElement, control);
      assert.equal(fixture.document.activeElement, fixture.getHost());
      assert.equal(previousRoot.activeElement, null);
      previousControl.focus();
      assert.equal(fixture.getRoot().activeElement, control);
    }
  });

  test("a focused related action follows its URL when metadata refresh reorders buttons", () => {
    const fixture = loadToast({});
    const artist = { provider: "deezer", type: "artist", id: "7", url: "https://www.deezer.com/artist/7" };
    const playlist = { provider: "deezer", type: "playlist", id: "8", url: "https://www.deezer.com/playlist/8" };
    const meta = { title: "Album", subtitle: "Artist", authoritative: true };
    fixture.toast.showOncePerPage(entity, meta, [artist, playlist]);
    const previous = fixture.query(".rg-secondary");
    const url = previous.getAttribute("data-rg-open");
    previous.focus();
    fixture.toast.showOncePerPage(entity, { ...meta, title: "Updated album" }, [playlist, artist]);
    const focused = fixture.getRoot().activeElement;
    assert.notEqual(focused, previous);
    assert.equal(focused, fixture.getRoot().querySelectorAll(".rg-secondary")[1]);
    assert.equal(focused.getAttribute("data-rg-open"), url);
    fixture.click(focused);
    assert.deepEqual(fixture.navigations, [url]);
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, test } from "node:test";

const detectorSource = readFileSync(
  new URL("../extension/content/detectors.js", import.meta.url),
  "utf8",
);
const spaSource = readFileSync(
  new URL("../extension/content/spa-navigation.js", import.meta.url),
  "utf8",
);
const deezerSource = readFileSync(
  new URL("../extension/content/content-deezer.js", import.meta.url),
  "utf8",
);
const soundcloudSource = readFileSync(
  new URL("../extension/content/content-soundcloud.js", import.meta.url),
  "utf8",
);

function loadProvider(provider, initialHref, initialMeta = {}) {
  let href = initialHref;
  let currentGeneration = 1;
  let navigationOptions = null;
  const meta = { ...initialMeta };
  const settings = {
    autoShow: true,
    showOnTrack: true,
    showOnCollection: true,
    showOnArtist: true,
    providers: { deezer: true, soundcloud: true },
  };
  let deferSettings = false;
  const pendingSettingsReads = [];
  const shown = [];
  const toast = {
    resetCount: 0,
    dismissCount: 0,
    resetForNavigation() {
      this.resetCount++;
    },
    dismiss() {
      this.dismissCount++;
    },
    showOncePerPage(entity, values) {
      shown.push({ entity, values });
    },
  };
  const scripts = [];
  const hydrationScripts = [];
  const artistLinks = [];
  const document = {
    title: "",
    body: { innerText: "" },
    documentElement: {},
    getElementById(id) {
      return (
        scripts.concat(hydrationScripts).find((script) => script.id === id) ||
        null
      );
    },
    querySelector(selector) {
      const metaMatch = selector.match(/^meta\[(?:property|name)="([^"]+)"\]$/);
      if (
        metaMatch &&
        Object.prototype.hasOwnProperty.call(meta, metaMatch[1])
      ) {
        return { getAttribute: () => meta[metaMatch[1]] };
      }
      if (selector === 'link[rel="canonical"]' && meta.canonical) {
        return { getAttribute: () => meta.canonical };
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'script[type="application/ld+json"]') {
        return scripts;
      }
      if (selector === "script") {
        return scripts.concat(hydrationScripts);
      }
      if (selector === "script:not([type])") {
        return hydrationScripts.filter((script) => !script.type);
      }
      if (selector === 'a[href*="/artist/"]') {
        return artistLinks;
      }
      return [];
    },
  };
  const location = {};
  Object.defineProperty(location, "href", { get: () => href });
  const window = { location, document, RalgrumToast: toast };
  const context = {
    window,
    document,
    chrome: {
      storage: {
        sync: {
          get(_keys, callback) {
            const snapshot = {
              ...settings,
              providers: { ...settings.providers },
            };
            const deliver = () => callback(snapshot);
            if (deferSettings) pendingSettingsReads.push(deliver);
            else deliver();
          },
        },
      },
    },
    URL,
    URLSearchParams,
    Promise,
    console,
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
  };
  vm.runInNewContext(detectorSource, context, {
    filename: "content/detectors.js",
  });
  vm.runInNewContext(spaSource, context, {
    filename: "content/spa-navigation.js",
  });
  const stableEntityKey = window.RalgrumSpaNavigation.entityKey;
  window.RalgrumSpaNavigation = {
    entityKey: stableEntityKey,
    start(options) {
      navigationOptions = options;
      return {
        entityKey: stableEntityKey,
        isCurrent(entity, generation) {
          const current = options.readEntity();
          return (
            generation === currentGeneration &&
            stableEntityKey(current) === stableEntityKey(entity)
          );
        },
      };
    },
  };
  vm.runInNewContext(
    provider === "deezer" ? deezerSource : soundcloudSource,
    context,
    {
      filename: `content/content-${provider}.js`,
    },
  );
  return {
    context,
    window,
    document,
    meta,
    scripts,
    hydrationScripts,
    artistLinks,
    settings,
    deferSettingsReads(value = true) {
      deferSettings = value;
    },
    flushSettingsReads() {
      pendingSettingsReads.splice(0).forEach((deliver) => deliver());
    },
    shown,
    toast,
    detectors: context.window.RalgrumDetectors,
    navigationOptions,
    setHref(value) {
      href = value;
    },
    setGeneration(value) {
      currentGeneration = value;
    },
    getNavigationOptions() {
      return navigationOptions;
    },
  };
}

describe("provider SPA metadata guards", () => {
  for (const provider of ["deezer", "soundcloud"]) {
    const firstUrl =
      provider === "deezer"
        ? "https://www.deezer.com/track/41"
        : "https://soundcloud.com/user/track-a";
    const nextUrl =
      provider === "deezer"
        ? "https://www.deezer.com/track/42"
        : "https://soundcloud.com/user/track-b";
    const metadataGlobal =
      provider === "deezer"
        ? "RalgrumDeezerMetadata"
        : "RalgrumSoundCloudMetadata";

    test(`${provider} does not redisplay pending hydration after autoShow is disabled`, async () => {
      let resolveMetadata;
      const pending = new Promise((resolve) => {
        resolveMetadata = resolve;
      });
      const fixture = loadProvider(provider, nextUrl, {
        "og:url": firstUrl,
        "og:title": "Previous track",
      });
      fixture.window[metadataGlobal] = {
        peek: () => null,
        fetchFor: () => pending,
      };
      const navigation = fixture.getNavigationOptions();
      navigation.onRefresh(navigation.readEntity(), 1);
      assert.equal(fixture.shown.length, 0);

      fixture.settings.autoShow = false;
      navigation.onRefresh(navigation.readEntity(), 1);
      resolveMetadata({
        title: "Current track",
        subtitle: "Current artist",
        authoritative: true,
      });
      await Promise.resolve();
      await Promise.resolve();
      assert.equal(fixture.shown.length, 0);

      fixture.settings.autoShow = true;
      navigation.onRefresh(navigation.readEntity(), 1);
      await Promise.resolve();
      await Promise.resolve();
      assert.equal(fixture.shown.length, 1);
      assert.equal(fixture.shown[0].entity.url, nextUrl);
      assert.equal(fixture.shown[0].entity.type, "track");
      assert.equal(fixture.shown[0].values.title, "Current track");
      assert.equal(fixture.shown[0].values.subtitle, "Current artist");
    });

    test(`${provider} discards hydration when navigation occurs during its settings read`, async () => {
      let resolveMetadata;
      const pending = new Promise((resolve) => {
        resolveMetadata = resolve;
      });
      const fixture = loadProvider(provider, firstUrl);
      fixture.window[metadataGlobal] = {
        peek: () => null,
        fetchFor: () => pending,
      };
      const navigation = fixture.getNavigationOptions();
      navigation.onRefresh(navigation.readEntity(), 1);
      fixture.deferSettingsReads();
      resolveMetadata({
        title: "API A",
        subtitle: "Artist A",
        authoritative: true,
      });
      await Promise.resolve();
      await Promise.resolve();
      assert.equal(fixture.shown.length, 0);

      fixture.setHref(nextUrl);
      fixture.setGeneration(2);
      fixture.meta["og:url"] = nextUrl;
      fixture.meta["og:title"] = "Track B";
      fixture.meta["og:audio:artist"] = "Artist B";
      fixture.flushSettingsReads();
      assert.equal(fixture.shown.length, 0);

      fixture.deferSettingsReads(false);
      fixture.window[metadataGlobal].fetchFor = () => Promise.resolve(null);
      navigation.onRefresh(navigation.readEntity(), 2);
      assert.equal(fixture.shown.length, 1);
      assert.equal(fixture.shown[0].entity.url, nextUrl);
      assert.equal(fixture.shown[0].entity.type, "track");
      assert.equal(fixture.shown[0].values.title, "Track B");
      assert.equal(fixture.shown[0].values.subtitle, "Artist B");
    });
  }

  test("Deezer selects only metadata from the currently identified head source", () => {
    const currentUrl = "https://www.deezer.com/track/42";
    const previousUrl = "https://www.deezer.com/track/41";
    const fixture = loadProvider("deezer", currentUrl, {
      "og:url": currentUrl,
      "og:title": "Current OG title",
      "og:audio:artist": "Current OG artist",
      "og:image": "https://img/current-og.jpg",
      "twitter:url": previousUrl,
      "twitter:title": "Previous Twitter title",
      "twitter:audio:artist_name": "Previous Twitter artist",
      "twitter:image": "https://img/previous-twitter.jpg",
    });
    const navigation = fixture.getNavigationOptions();
    navigation.onRefresh(navigation.readEntity(), 1);
    assert.equal(fixture.shown.length, 1);
    assert.equal(fixture.shown[0].entity.url, currentUrl);
    assert.equal(fixture.shown[0].entity.type, "track");
    assert.equal(fixture.shown[0].values.title, "Current OG title");
    assert.equal(fixture.shown[0].values.subtitle, "Current OG artist");
    assert.equal(fixture.shown[0].values.artwork, "https://img/current-og.jpg");

    fixture.meta["og:url"] = previousUrl;
    fixture.meta["twitter:url"] = currentUrl;
    fixture.meta["twitter:title"] = "Current Twitter title";
    fixture.meta["twitter:audio:artist_name"] = "Current Twitter artist";
    fixture.meta["twitter:image"] = "https://img/current-twitter.jpg";
    navigation.onRefresh(navigation.readEntity(), 1);
    assert.equal(fixture.shown.length, 2);
    assert.equal(fixture.shown[1].entity.url, currentUrl);
    assert.equal(fixture.shown[1].values.title, "Current Twitter title");
    assert.equal(fixture.shown[1].values.subtitle, "Current Twitter artist");
    assert.equal(
      fixture.shown[1].values.artwork,
      "https://img/current-twitter.jpg",
    );
  });

  test("Deezer rejects prior-track state and unrelated artist links but retains current-track fallback", () => {
    const currentUrl = "https://www.deezer.com/track/42";
    const fixture = loadProvider("deezer", currentUrl, {
      "og:url": currentUrl,
      "og:title": "Current track",
      "og:audio:artist": "Current performer",
    });
    const state = {
      id: "__DZR_APP_STATE__",
      textContent: JSON.stringify({
        DATA: { SNG_ID: "41", ART_NAME: "Previous performer" },
      }),
    };
    fixture.hydrationScripts.push(state);
    fixture.artistLinks.push({
      textContent: "Unrelated artist",
      getAttribute: () => "/artist/9",
    });
    const navigation = fixture.getNavigationOptions();
    navigation.onRefresh(navigation.readEntity(), 1);
    assert.equal(fixture.shown.length, 1);
    assert.equal(fixture.shown[0].values.subtitle, "Current performer");

    delete fixture.meta["og:audio:artist"];
    navigation.onRefresh(navigation.readEntity(), 1);
    assert.equal(fixture.shown.length, 2);
    assert.equal(fixture.shown[1].values.subtitle, "");

    state.textContent = JSON.stringify({
      DATA: { SNG_ID: "42", ART_NAME: "Current state performer" },
    });
    navigation.onRefresh(navigation.readEntity(), 1);
    assert.equal(fixture.shown.length, 3);
    assert.equal(fixture.shown[2].values.subtitle, "Current state performer");
    for (const shown of fixture.shown) {
      assert.equal(shown.entity.url, currentUrl);
      assert.equal(shown.entity.type, "track");
      assert.equal(shown.values.title, "Current track");
    }
  });

  test("Deezer renders hydrated explicit status and lets authoritative clean status clear the page flag", async () => {
    const currentUrl = "https://www.deezer.com/track/42";
    const fixture = loadProvider("deezer", currentUrl, {
      "og:url": "https://www.deezer.com/track/41",
      "og:title": "Previous track",
    });
    let hydrated = {
      title: "API track",
      subtitle: "API artist",
      explicit: true,
    };
    fixture.window.RalgrumDeezerMetadata = {
      peek: () => null,
      fetchFor: () => Promise.resolve(hydrated),
    };
    const navigation = fixture.getNavigationOptions();
    navigation.onRefresh(navigation.readEntity(), 1);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(fixture.shown.length, 1);
    assert.equal(fixture.shown[0].entity.url, currentUrl);
    assert.equal(fixture.shown[0].values.title, "API track");
    assert.equal(fixture.shown[0].values.subtitle, "API artist");
    assert.equal(fixture.shown[0].values.explicit, true);

    fixture.meta["og:url"] = currentUrl;
    fixture.meta["og:title"] = "Current DOM track";
    fixture.hydrationScripts.push({
      id: "__DZR_APP_STATE__",
      textContent: JSON.stringify({
        DATA: {
          SNG_ID: "42",
          ART_NAME: "DOM artist",
          EXPLICIT_LYRICS_STATUS: 1,
        },
      }),
    });
    hydrated = {
      title: "API clean track",
      subtitle: "API artist",
      explicit: false,
    };
    navigation.onRefresh(navigation.readEntity(), 1);
    assert.equal(fixture.shown.at(-1).values.explicit, true);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(fixture.shown.at(-1).entity.url, currentUrl);
    assert.equal(fixture.shown.at(-1).entity.type, "track");
    assert.equal(fixture.shown.at(-1).values.title, "API clean track");
    assert.equal(fixture.shown.at(-1).values.explicit, false);
  });

  test("Deezer localized pages accept canonical JSON-LD only for the same entity", () => {
    const currentUrl = "https://www.deezer.com/it/album/42?utm_source=share";
    const fixture = loadProvider("deezer", currentUrl, {
      "og:url": "https://www.deezer.com/album/42",
      "og:title": "Current album",
    });
    fixture.scripts.push({
      textContent: JSON.stringify({
        "@type": "MusicAlbum",
        url: "https://www.deezer.com/album/41",
        byArtist: { name: "Previous artist" },
      }),
    });
    const navigation = fixture.getNavigationOptions();
    navigation.onRefresh(navigation.readEntity(), 1);
    assert.equal(fixture.shown.length, 1);
    assert.equal(fixture.shown[0].values.subtitle, "");

    fixture.scripts.push({
      textContent: JSON.stringify({
        "@type": "MusicAlbum",
        url: "https://www.deezer.com/album/42",
        byArtist: { name: "Canonical artist" },
      }),
    });
    navigation.onRefresh(navigation.readEntity(), 1);
    assert.equal(fixture.shown.length, 2);
    assert.equal(fixture.shown[1].entity.url, currentUrl);
    assert.equal(fixture.shown[1].entity.type, "album");
    assert.equal(fixture.shown[1].values.title, "Current album");
    assert.equal(fixture.shown[1].values.subtitle, "Canonical artist");
  });

  test("SoundCloud infers albums only from matching schema and keeps the current private URL", () => {
    const currentUrl =
      "https://soundcloud.com/user/sets/release?secret_token=s-private";
    const fixture = loadProvider("soundcloud", currentUrl, {
      "og:url": "https://soundcloud.com/user/sets/release",
      "og:title": "Current release",
      "og:audio:artist": "Current artist",
    });
    fixture.scripts.push({
      textContent: JSON.stringify([
        {
          "@type": "MusicAlbum",
          url: "https://soundcloud.com/user/sets/previous",
          byArtist: { name: "Previous artist" },
        },
        {
          "@type": "MusicAlbum",
          url: "https://example.com/user/sets/release",
          byArtist: { name: "Foreign artist" },
        },
      ]),
    });
    const navigation = fixture.getNavigationOptions();
    navigation.onRefresh(navigation.readEntity(), 1);
    assert.equal(fixture.shown.length, 1);
    assert.equal(fixture.shown[0].entity.type, "playlist");
    assert.equal(fixture.shown[0].entity.url, currentUrl);

    fixture.scripts.push({
      textContent: JSON.stringify({
        "@type": "MusicAlbum",
        url: "https://soundcloud.com/user/sets/release",
        byArtist: { name: "Current artist" },
      }),
    });
    navigation.onRefresh(navigation.readEntity(), 1);
    assert.equal(fixture.shown.length, 2);
    const album = fixture.shown[1];
    assert.equal(album.entity.type, "album");
    assert.equal(album.entity.url, currentUrl);
    assert.equal(album.values.title, "Current release");
    assert.equal(album.values.subtitle, "Current artist");
    const link = new URL(
      fixture.detectors.buildRalgrumUrl(album.entity, {
        title: album.values.title,
      }),
    );
    assert.equal(link.searchParams.get("type"), "album");
    assert.equal(link.searchParams.get("url"), currentUrl);

    const nextUrl = "https://soundcloud.com/user/sets/next?secret_token=s-next";
    fixture.setHref(nextUrl);
    fixture.setGeneration(2);
    fixture.meta["og:url"] = nextUrl;
    fixture.meta["og:title"] = "Next playlist";
    navigation.onRefresh(navigation.readEntity(), 2);
    assert.equal(fixture.shown.length, 3);
    assert.equal(fixture.shown[2].entity.type, "playlist");
    assert.equal(fixture.shown[2].entity.url, nextUrl);
    assert.equal(fixture.shown[2].values.title, "Next playlist");
  });

  test("SoundCloud explicit status follows the current track rather than other hydration entries", () => {
    const currentUrl = "https://soundcloud.com/user/current-track";
    const fixture = loadProvider("soundcloud", currentUrl, {
      "og:url": currentUrl,
      "og:title": "Current track",
      "og:audio:artist": "Current artist",
    });
    const currentTrack = {
      hydratable: "sound",
      data: { permalink_url: currentUrl, is_explicit: false },
    };
    const otherTrack = {
      hydratable: "sound",
      data: {
        permalink_url: "https://soundcloud.com/user/other-track",
        is_explicit: true,
      },
    };
    const script = {
      textContent:
        "window.__sc_hydration = " +
        JSON.stringify([otherTrack, currentTrack]) +
        ";",
    };
    fixture.hydrationScripts.push(script);
    const navigation = fixture.getNavigationOptions();
    navigation.onRefresh(navigation.readEntity(), 1);
    assert.equal(fixture.shown.length, 1);
    assert.equal(fixture.shown[0].values.explicit, false);

    currentTrack.data.is_explicit = true;
    otherTrack.data.is_explicit = false;
    script.textContent =
      "window.__sc_hydration = " +
      JSON.stringify([otherTrack, currentTrack]) +
      ";";
    navigation.onRefresh(navigation.readEntity(), 1);
    assert.equal(fixture.shown.length, 2);
    assert.equal(fixture.shown[1].values.explicit, true);

    otherTrack.data.is_explicit = true;
    script.textContent =
      "window.__sc_hydration = " + JSON.stringify([otherTrack]) + ";";
    navigation.onRefresh(navigation.readEntity(), 1);
    assert.equal(fixture.shown.length, 3);
    assert.equal(fixture.shown[2].values.explicit, false);
    for (const shown of fixture.shown) {
      assert.equal(shown.entity.url, currentUrl);
      assert.equal(shown.entity.type, "track");
      assert.equal(shown.values.title, "Current track");
      assert.equal(shown.values.subtitle, "Current artist");
    }
  });

  test("SoundCloud retries the author name after URL-valued artist metadata when oEmbed is unavailable", async () => {
    const currentUrl = "https://soundcloud.com/user/current-track";
    const fixture = loadProvider("soundcloud", currentUrl, {
      "og:url": currentUrl,
      "og:title": "Current track",
      "og:audio:artist": "https://soundcloud.com/user",
      author: "Display Artist",
    });
    fixture.window.RalgrumSoundCloudMetadata = {
      peek: () => null,
      fetchFor: () => Promise.resolve(null),
    };
    const navigation = fixture.getNavigationOptions();
    navigation.onRefresh(navigation.readEntity(), 1);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(fixture.shown.length, 1);
    assert.equal(fixture.shown[0].entity.url, currentUrl);
    assert.equal(fixture.shown[0].entity.type, "track");
    assert.equal(fixture.shown[0].values.title, "Current track");
    assert.equal(fixture.shown[0].values.subtitle, "Display Artist");
  });

  test("Deezer ignores a late entity A result after navigation to B", async () => {
    let resolveA;
    const pending = new Promise((resolve) => {
      resolveA = resolve;
    });
    const fixture = loadProvider("deezer", "https://www.deezer.com/album/1", {
      "og:url": "https://www.deezer.com/album/1",
      "og:title": "DOM A",
      "og:audio:artist": "Artist A",
    });
    fixture.window.RalgrumDeezerMetadata = {
      sameEntity: (left, right) =>
        left &&
        right &&
        left.provider === right.provider &&
        left.type === right.type &&
        left.id === right.id,
      peek: () => null,
      fetchFor: () => pending,
    };
    const first = fixture.detectors.parseDeezerUrl(
      "https://www.deezer.com/album/1",
    );
    fixture.getNavigationOptions().onRefresh(first, 1);
    fixture.setHref("https://www.deezer.com/album/2");
    fixture.meta["og:url"] = "https://www.deezer.com/album/2";
    fixture.setGeneration(2);
    resolveA({ title: "API A", subtitle: "Artist A" });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(fixture.shown.length, 1);
    assert.equal(fixture.shown[0].values.title, "DOM A");
  });

  test("Deezer cached API metadata wins over later DOM mutation regressions", async () => {
    let cached = null;
    const apiValue = {
      title: "API Album",
      subtitle: "API Artist",
      artwork: "https://img/api.jpg",
    };
    const fixture = loadProvider("deezer", "https://www.deezer.com/album/7", {
      "og:url": "https://www.deezer.com/album/7",
      "og:title": "DOM Album",
      "og:audio:artist": "DOM Artist",
    });
    fixture.window.RalgrumDeezerMetadata = {
      sameEntity: (left, right) =>
        left &&
        right &&
        left.provider === right.provider &&
        left.type === right.type &&
        left.id === right.id,
      peek: () => cached,
      fetchFor: () =>
        Promise.resolve(apiValue).then((value) => {
          cached = value;
          return value;
        }),
    };
    const entity = fixture.detectors.parseDeezerUrl(
      "https://www.deezer.com/album/7",
    );
    fixture.getNavigationOptions().onRefresh(entity, 1);
    await Promise.resolve();
    await Promise.resolve();
    fixture.meta["og:title"] = "DOM Regression";
    fixture.meta["og:audio:artist"] = "Wrong Artist";
    fixture.getNavigationOptions().onRefresh(entity, 1);
    assert.equal(fixture.shown[0].values.title, "DOM Album");
    assert.equal(fixture.shown[1].values.title, "API Album");
    assert.equal(fixture.shown[2].values.title, "API Album");
    assert.equal(fixture.shown[2].values.artwork, "https://img/api.jpg");
  });

  test("SoundCloud rejects stale head and JSON-LD data until the live head is fresh", () => {
    const fixture = loadProvider(
      "soundcloud",
      "https://soundcloud.com/user/track-b",
      {
        "og:url": "https://soundcloud.com/user/track-a",
        canonical: "https://soundcloud.com/user/track-a",
        "og:title": "Track A",
        "og:audio:artist": "Artist A",
      },
    );
    fixture.scripts.push({
      textContent: JSON.stringify({
        "@type": "MusicRecording",
        url: "https://soundcloud.com/user/track-a",
        byArtist: { name: "Artist A" },
      }),
    });
    const live = fixture.detectors.parseSoundcloudUrl(
      "https://soundcloud.com/user/track-b",
    );
    fixture.getNavigationOptions().onRefresh(live, 1);
    assert.equal(fixture.shown.length, 0);

    fixture.meta["og:url"] = "https://soundcloud.com/user/track-b";
    fixture.meta["og:title"] = "Track B";
    fixture.meta["og:audio:artist"] = "Artist B";
    fixture.getNavigationOptions().onRefresh(live, 1);
    assert.equal(fixture.shown.length, 1);
    assert.equal(fixture.shown[0].values.title, "Track B");
    assert.equal(fixture.shown[0].values.subtitle, "Artist B");
  });

  test("SoundCloud does not treat a missing head identity as fresh", () => {
    const fixture = loadProvider(
      "soundcloud",
      "https://soundcloud.com/user/track-b",
      {
        "og:title": "Stale document title",
      },
    );
    const live = fixture.detectors.parseSoundcloudUrl(
      "https://soundcloud.com/user/track-b",
    );
    fixture.getNavigationOptions().onRefresh(live, 1);
    assert.equal(fixture.shown.length, 0);
  });

  test("SoundCloud authoritative oEmbed metadata can render before stale head metadata settles", async () => {
    const fixture = loadProvider(
      "soundcloud",
      "https://soundcloud.com/user/track-b",
      {
        "og:url": "https://soundcloud.com/user/track-a",
        "og:title": "Track A",
      },
    );
    const live = fixture.detectors.parseSoundcloudUrl(
      "https://soundcloud.com/user/track-b",
    );
    fixture.window.RalgrumSoundCloudMetadata = {
      peek: () => null,
      fetchFor: () =>
        Promise.resolve({
          title: "Track B",
          subtitle: "Artist B",
          artwork: "https://img/b.jpg",
          authoritative: true,
        }),
    };
    fixture.getNavigationOptions().onRefresh(live, 1);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(fixture.shown.length, 1);
    assert.equal(fixture.shown[0].values.title, "Track B");
    assert.equal(fixture.shown[0].values.subtitle, "Artist B");
    assert.equal(fixture.shown[0].values.authoritative, true);
  });

  test("SoundCloud artist profile tabs keep the artist entity on the toast", () => {
    const artistUrl = "https://soundcloud.com/spacelaces-ids";
    const fixture = loadProvider("soundcloud", artistUrl, {
      "og:url": artistUrl,
      "og:title": "SPACELACES",
      "soundcloud:follower_count": "1200",
    });
    const navigation = fixture.getNavigationOptions();
    navigation.onRefresh(navigation.readEntity(), 1);
    assert.equal(fixture.shown.length, 1);
    assert.equal(fixture.shown[0].entity.type, "artist");
    assert.equal(fixture.shown[0].entity.url, artistUrl);
    assert.equal(fixture.shown[0].values.subtitle, "1,200 followers");

    fixture.setHref(artistUrl + "/tracks");
    fixture.meta["og:url"] = artistUrl + "/tracks";
    const afterTab = navigation.readEntity();
    const keyOf = fixture.window.RalgrumSpaNavigation.entityKey;
    assert.equal(keyOf(afterTab), keyOf(fixture.shown[0].entity));
    navigation.onRefresh(afterTab, 1);
    assert.equal(fixture.shown.length, 2);
    assert.equal(fixture.shown[1].entity.type, "artist");
    assert.equal(fixture.shown[1].entity.url, artistUrl);
    assert.equal(fixture.shown[1].values.subtitle, "1,200 followers");
  });

  test("SoundCloud cached authoritative metadata wins over later DOM mutations", () => {
    const fixture = loadProvider(
      "soundcloud",
      "https://soundcloud.com/user/track-b",
      {
        "og:url": "https://soundcloud.com/user/track-b",
        "og:title": "DOM title",
        "og:audio:artist": "DOM artist",
      },
    );
    const live = fixture.detectors.parseSoundcloudUrl(
      "https://soundcloud.com/user/track-b",
    );
    fixture.window.RalgrumSoundCloudMetadata = {
      peek: () => ({
        title: "API title",
        subtitle: "API artist",
        artwork: "https://img/api.jpg",
        authoritative: true,
      }),
      fetchFor: () => Promise.resolve(null),
    };
    fixture.getNavigationOptions().onRefresh(live, 1);
    fixture.meta["og:title"] = "Wrong DOM title";
    fixture.meta["og:audio:artist"] = "Wrong DOM artist";
    fixture.getNavigationOptions().onRefresh(live, 1);
    assert.equal(fixture.shown.length, 2);
    assert.equal(fixture.shown[0].values.title, "API title");
    assert.equal(fixture.shown[1].values.title, "API title");
    assert.equal(fixture.shown[1].values.subtitle, "API artist");
  });

  test("SoundCloud fresh page artwork survives an oEmbed placeholder", () => {
    const fixture = loadProvider(
      "soundcloud",
      "https://soundcloud.com/meddis123/sets/breakbeat-und-bassmukke",
      {
        "og:url":
          "https://soundcloud.com/meddis123/sets/breakbeat-und-bassmukke",
        "og:title": "breakbeat und bassmukke",
        "og:image":
          "https://i1.sndcdn.com/artworks-9CDAHxyyfUZtJX6y-JtpSSQ-t500x500.png",
      },
    );
    const playlist = fixture.detectors.parseSoundcloudUrl(
      "https://soundcloud.com/meddis123/sets/breakbeat-und-bassmukke",
    );
    fixture.window.RalgrumSoundCloudMetadata = {
      peek: () => ({
        title: "breakbeat und bassmukke",
        subtitle: "meddis123",
        artwork: "",
        authoritative: true,
      }),
      fetchFor: () => Promise.resolve(null),
    };
    fixture.getNavigationOptions().onRefresh(playlist, 1);
    assert.equal(fixture.shown.length, 1);
    assert.equal(
      fixture.shown[0].values.artwork,
      "https://i1.sndcdn.com/artworks-9CDAHxyyfUZtJX6y-JtpSSQ-t500x500.png",
    );
    assert.doesNotMatch(
      JSON.stringify(fixture.shown[0].values),
      /fb_placeholder/,
    );
  });

  test("SoundCloud uses the matching playlist first-track artwork from hydration", () => {
    const playlistUrl =
      "https://soundcloud.com/meddis123/sets/breakbeat-und-bassmukke";
    const firstTrackArtwork =
      "https://i1.sndcdn.com/artworks-9CDAHxyyfUZtJX6y-JtpSSQ-large.png";
    const fixture = loadProvider("soundcloud", playlistUrl, {
      "og:url": playlistUrl,
      "og:title": "breakbeat und bassmukke",
      "og:image": "https://soundcloud.com/images/fb_placeholder.png",
    });
    fixture.hydrationScripts.push({
      textContent:
        "window.__sc_hydration = " +
        JSON.stringify([
          {
            hydratable: "playlist",
            data: {
              permalink_url: playlistUrl,
              tracks: [{ artwork_url: firstTrackArtwork }],
            },
          },
        ]) +
        ";",
    });
    const playlist = fixture.detectors.parseSoundcloudUrl(playlistUrl);
    fixture.window.RalgrumSoundCloudMetadata = {
      peek: () => null,
      fetchFor: () => Promise.resolve(null),
    };
    fixture.getNavigationOptions().onRefresh(playlist, 1);
    assert.equal(fixture.shown.length, 1);
    assert.equal(fixture.shown[0].values.artwork, firstTrackArtwork);
    assert.doesNotMatch(
      JSON.stringify(fixture.shown[0].values),
      /fb_placeholder/,
    );
  });

  test("SoundCloud rejects old playlist and foreign first-track artwork", () => {
    const currentUrl = "https://soundcloud.com/meddis123/sets/current-playlist";
    const fixture = loadProvider("soundcloud", currentUrl, {
      "og:url": currentUrl,
      "og:title": "current playlist",
    });
    fixture.hydrationScripts.push({
      textContent:
        "window.__sc_hydration = " +
        JSON.stringify([
          {
            hydratable: "playlist",
            data: {
              permalink_url:
                "https://soundcloud.com/meddis123/sets/old-playlist",
              tracks: [
                { artwork_url: "https://i1.sndcdn.com/artworks-old-large.jpg" },
              ],
            },
          },
          {
            hydratable: "playlist",
            data: {
              permalink_url: currentUrl,
              tracks: [{ artwork_url: "https://images.example/foreign.jpg" }],
            },
          },
        ]) +
        ";",
    });
    const playlist = fixture.detectors.parseSoundcloudUrl(currentUrl);
    fixture.window.RalgrumSoundCloudMetadata = {
      peek: () => null,
      fetchFor: () => Promise.resolve(null),
    };
    fixture.getNavigationOptions().onRefresh(playlist, 1);
    assert.equal(fixture.shown.length, 1);
    assert.equal(fixture.shown[0].values.artwork, "");
  });

  test("SoundCloud preserves fresh artist followers when oEmbed author matches the title", () => {
    const fixture = loadProvider("soundcloud", "https://soundcloud.com/forss", {
      "og:url": "https://soundcloud.com/forss",
      "og:title": "Forss",
    });
    fixture.scripts.push({
      textContent: JSON.stringify({
        "@type": "MusicGroup",
        url: "https://soundcloud.com/forss",
        interactionStatistic: {
          interactionType: "FollowAction",
          userInteractionCount: 1234,
        },
      }),
    });
    const artist = fixture.detectors.parseSoundcloudUrl(
      "https://soundcloud.com/forss",
    );
    fixture.window.RalgrumSoundCloudMetadata = {
      peek: () => ({
        title: "Forss",
        subtitle: "",
        artwork: "https://img/forss.jpg",
        authoritative: true,
      }),
      fetchFor: () => Promise.resolve(null),
    };
    fixture.getNavigationOptions().onRefresh(artist, 1);
    assert.equal(fixture.shown.length, 1);
    assert.equal(fixture.shown[0].values.title, "Forss");
    assert.equal(fixture.shown[0].values.subtitle, "1,234 followers");
    assert.equal(fixture.shown[0].values.artwork, "https://img/forss.jpg");
  });

  test("SoundCloud ignores a late oEmbed result after navigation", async () => {
    let resolveA;
    const pending = new Promise((resolve) => {
      resolveA = resolve;
    });
    const fixture = loadProvider(
      "soundcloud",
      "https://soundcloud.com/user/track-a",
      {
        "og:url": "https://soundcloud.com/user/track-a",
        "og:title": "DOM A",
      },
    );
    fixture.window.RalgrumSoundCloudMetadata = {
      peek: () => null,
      fetchFor: () => pending,
    };
    const first = fixture.detectors.parseSoundcloudUrl(
      "https://soundcloud.com/user/track-a",
    );
    fixture.getNavigationOptions().onRefresh(first, 1);
    fixture.setHref("https://soundcloud.com/user/track-b");
    fixture.meta["og:url"] = "https://soundcloud.com/user/track-b";
    fixture.meta["og:title"] = "DOM B";
    fixture.setGeneration(2);
    resolveA({ title: "API A", subtitle: "Artist A", authoritative: true });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(fixture.shown.length, 1);
    assert.equal(fixture.shown[0].values.title, "DOM A");
  });
});

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
const metadataSource = readFileSync(
  new URL("../extension/content/soundcloud-metadata.js", import.meta.url),
  "utf8",
);

function loadMetadata(responseFactory, options = {}) {
  const calls = [];
  let now = options.now || 0;
  const location = { href: "https://soundcloud.com/user/track" };
  const window = {
    location,
    history: {},
    document: {},
    addEventListener() {},
    setInterval() {
      return 1;
    },
    clearInterval() {},
    fetch(url, requestOptions) {
      calls.push({ url, options: requestOptions });
      return responseFactory(url, requestOptions);
    },
  };
  const context = {
    window,
    URL,
    Promise,
    Date: { now: () => now },
    setTimeout,
    clearTimeout,
  };
  vm.runInNewContext(detectorSource, context, {
    filename: "content/detectors.js",
  });
  vm.runInNewContext(spaSource, context, {
    filename: "content/spa-navigation.js",
  });
  vm.runInNewContext(metadataSource, context, {
    filename: "content/soundcloud-metadata.js",
  });
  return {
    api: window.RalgrumSoundCloudMetadata,
    detectors: window.RalgrumDetectors,
    calls,
    advance(milliseconds) {
      now += milliseconds;
    },
  };
}

function entity(detectors, type, suffix = "track") {
  const path =
    type === "artist"
      ? "https://soundcloud.com/user"
      : type === "playlist"
        ? "https://soundcloud.com/user/sets/" + suffix
        : "https://soundcloud.com/user/" + suffix;
  return detectors.parseSoundcloudUrl(path);
}

function payload(overrides = {}) {
  return {
    provider_name: "SoundCloud",
    provider_url: "https://soundcloud.com",
    title: "OVERHEAT by TRVCY",
    author_name: "TRVCY",
    author_url: "https://soundcloud.com/imtrvcy",
    thumbnail_url: "https://i1.sndcdn.com/artworks-test-t500x500.jpg",
    ...overrides,
  };
}

describe("SoundCloud oEmbed metadata", () => {
  test("normalizes track, playlist, and artist metadata", async () => {
    const fixture = loadMetadata(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(payload()) }),
    );
    const track = await fixture.api.fetchFor(
      entity(fixture.detectors, "track", "overheat"),
    );
    assert.deepEqual(
      {
        title: track.title,
        subtitle: track.subtitle,
        artwork: track.artwork,
        authoritative: track.authoritative,
      },
      {
        title: "OVERHEAT",
        subtitle: "TRVCY",
        artwork: "https://i1.sndcdn.com/artworks-test-t500x500.jpg",
        authoritative: true,
      },
    );

    const playlist = fixture.api.normalize(
      payload({ title: "Uncaged by Monstercat", author_name: "Monstercat" }),
      entity(fixture.detectors, "playlist", "mix"),
    );
    assert.equal(playlist.title, "Uncaged");
    assert.equal(playlist.subtitle, "Monstercat");

    const artist = fixture.api.normalize(
      payload({ title: "Forss", author_name: "Forss" }),
      entity(fixture.detectors, "artist"),
    );
    assert.equal(artist.title, "Forss");
    assert.equal(artist.subtitle, "");

    const placeholder = fixture.api.normalize(
      payload({
        thumbnail_url: "https://soundcloud.com/images/fb_placeholder.png",
      }),
      entity(fixture.detectors, "playlist", "placeholder"),
    );
    assert.equal(placeholder.title, "OVERHEAT");
    assert.equal(placeholder.subtitle, "TRVCY");
    assert.equal(placeholder.artwork, "");
    assert.equal(
      fixture.api.isPlaceholderArtwork(
        "https://soundcloud.com/images/fb_placeholder.png",
      ),
      true,
    );
    assert.equal(
      fixture.api.isPlaceholderArtwork(
        "https://i1.sndcdn.com/images/fb_placeholder.png",
      ),
      false,
    );
  });

  test("strips only an exact trailing author suffix", () => {
    const fixture = loadMetadata(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(payload()) }),
    );
    const track = entity(fixture.detectors, "track", "song");
    assert.equal(
      fixture.api.normalize(
        payload({ title: "Stand by Me by Artist", author_name: "Artist" }),
        track,
      ).title,
      "Stand by Me",
    );
    assert.equal(
      fixture.api.normalize(
        payload({ title: "Stand by Me by Other", author_name: "Artist" }),
        track,
      ).title,
      "Stand by Me by Other",
    );
  });

  test("rejects unsafe, malformed, and provider-mismatched responses", async () => {
    const fixture = loadMetadata(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(payload({ provider_name: "Other" })),
      }),
    );
    assert.equal(
      await fixture.api.fetchFor(entity(fixture.detectors, "track")),
      null,
    );

    const unsafe = loadMetadata(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            payload({ thumbnail_url: "http://unsafe.test/image.jpg" }),
          ),
      }),
    );
    assert.equal(
      await unsafe.api.fetchFor(entity(unsafe.detectors, "track")),
      null,
    );

    const badAuthor = loadMetadata(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            payload({ author_url: "https://evil.example/author" }),
          ),
      }),
    );
    assert.equal(
      await badAuthor.api.fetchFor(entity(badAuthor.detectors, "track")),
      null,
    );

    const error = loadMetadata(() =>
      Promise.resolve({ ok: false, json: () => Promise.resolve(payload()) }),
    );
    assert.equal(
      await error.api.fetchFor(entity(error.detectors, "track")),
      null,
    );
  });

  test("does not hydrate albums from a matching playlist response", async () => {
    const fixture = loadMetadata(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(payload()) }),
    );
    const album = fixture.detectors.parseSoundcloudUrl(
      "https://soundcloud.com/user/albums/album",
    );
    assert.equal(await fixture.api.fetchFor(album), null);
    assert.equal(fixture.calls.length, 0);
    const playlist = entity(fixture.detectors, "playlist", "release");
    const playlistMetadata = await fixture.api.fetchFor(playlist);
    assert.equal(playlistMetadata.title, "OVERHEAT");
    const inferredAlbum = { ...playlist, type: "album" };
    assert.equal(await fixture.api.fetchFor(inferredAlbum), null);
    assert.equal(fixture.api.peek(inferredAlbum), null);
    assert.equal(fixture.calls.length, 1);
    assert.equal(fixture.api.peek(playlist).title, "OVERHEAT");
  });

  test("deduplicates pending requests and exposes successful values synchronously", async () => {
    let resolveResponse;
    const response = new Promise((resolve) => {
      resolveResponse = resolve;
    });
    const fixture = loadMetadata(() => response);
    const track = entity(fixture.detectors, "track", "overheat");
    const first = fixture.api.fetchFor(track);
    const second = fixture.api.fetchFor({ ...track });
    assert.strictEqual(first, second);
    await Promise.resolve();
    assert.equal(fixture.calls.length, 1);
    resolveResponse({ ok: true, json: () => Promise.resolve(payload()) });
    assert.equal((await first).title, "OVERHEAT");
    assert.equal(fixture.api.peek(track).subtitle, "TRVCY");
  });

  test("retries failures after cooldown without hammering the endpoint", async () => {
    let calls = 0;
    const fixture = loadMetadata(() => {
      calls++;
      return calls === 1
        ? Promise.reject(new Error("temporary"))
        : Promise.resolve({ ok: true, json: () => Promise.resolve(payload()) });
    });
    const track = entity(fixture.detectors, "track", "retry");
    assert.equal(await fixture.api.fetchFor(track), null);
    assert.equal(await fixture.api.fetchFor(track), null);
    assert.equal(calls, 1);
    fixture.advance(30000);
    assert.equal((await fixture.api.fetchFor(track)).title, "OVERHEAT");
    assert.equal(calls, 2);
  });

  test("bounds successful cache growth", async () => {
    let calls = 0;
    const fixture = loadMetadata(() => {
      calls++;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(payload({ title: "Track " + calls })),
      });
    });
    for (let index = 1; index <= 129; index++) {
      await fixture.api.fetchFor(
        entity(fixture.detectors, "track", "track-" + index),
      );
    }
    assert.equal(fixture.api.cacheSize(), 128);
    await fixture.api.fetchFor(entity(fixture.detectors, "track", "track-1"));
    assert.equal(calls, 130);
  });

  test("bounds retryable failure cache growth", async () => {
    const fixture = loadMetadata(() => Promise.reject(new Error("temporary")));
    for (let index = 1; index <= 129; index++) {
      await fixture.api.fetchFor(
        entity(fixture.detectors, "track", "failed-" + index),
      );
    }
    assert.equal(fixture.api.failureCacheSize(), 128);
    assert.equal(fixture.api.cacheSize(), 128);
  });
});

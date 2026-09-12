import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, test } from "node:test";

const detectorSource = readFileSync(new URL("../extension/content/detectors.js", import.meta.url), "utf8");
const metadataSource = readFileSync(new URL("../extension/content/deezer-metadata.js", import.meta.url), "utf8");

function loadMetadata(responseFactory, options = {}) {
  const calls = [];
  let now = options.now || 0;
  const context = {
    URL,
    URLSearchParams,
    Promise,
    Date: { now: () => now },
    fetch(url, options) {
      calls.push({ url, options });
      return responseFactory(url, options);
    }
  };
  vm.runInNewContext(detectorSource, context, { filename: "content/detectors.js" });
  vm.runInNewContext(metadataSource, context, { filename: "content/deezer-metadata.js" });
  return {
    api: context.RalgrumDeezerMetadata,
    detectors: context.RalgrumDetectors,
    calls,
    advance(milliseconds) {
      now += milliseconds;
    }
  };
}

function entity(detectors, type, id = "42") {
  const url = `https://www.deezer.com/${type}/${id}`;
  return detectors.parseDeezerUrl(url);
}

describe("Deezer metadata hydration", () => {
  test("normalizes track, album, playlist, and artist payloads", async () => {
    const fixture = loadMetadata(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 42,
            title: "Track",
            artist: { name: "Artist" },
            album: { cover_xl: "https://img/track.jpg" }
          })
      })
    );
    const track = await fixture.api.fetchFor(entity(fixture.detectors, "track"));
    assert.deepEqual(
      { title: track.title, subtitle: track.subtitle, artwork: track.artwork },
      {
        title: "Track",
        subtitle: "Artist",
        artwork: "https://img/track.jpg"
      }
    );

    const album = fixture.api.normalize(
      { id: 42, title: "Album", artist: { name: "Album Artist" }, cover_medium: "https://img/album.jpg" },
      entity(fixture.detectors, "album")
    );
    assert.equal(album.subtitle, "Album Artist");
    assert.equal(album.artwork, "https://img/album.jpg");

    const playlist = fixture.api.normalize(
      { id: 42, title: "Playlist", creator: { name: "Owner" }, picture_big: "https://img/playlist.jpg" },
      entity(fixture.detectors, "playlist")
    );
    assert.equal(playlist.subtitle, "Owner");

    const artist = fixture.api.normalize(
      { id: 42, name: "Artist", nb_fan: 1234, picture_medium: "https://img/artist.jpg" },
      entity(fixture.detectors, "artist")
    );
    assert.equal(artist.title, "Artist");
    assert.equal(artist.subtitle, "1,234 fans");
  });

  test("preserves explicit and clean track status without inventing an unknown status", () => {
    const fixture = loadMetadata(() => Promise.resolve(null));
    const track = entity(fixture.detectors, "track");
    const payload = { id: 42, title: "Track", artist: { name: "Artist" } };
    assert.equal(fixture.api.normalize({ ...payload, explicit_lyrics: true }, track).explicit, true);
    assert.equal(fixture.api.normalize({ ...payload, explicit_lyrics: false }, track).explicit, false);
    assert.equal(fixture.api.normalize(payload, track).explicit, undefined);
  });

  test("rejects HTTP, malformed, error, and mismatched-ID responses safely", async () => {
    const fixture = loadMetadata(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 999, title: "Wrong" })
      })
    );
    assert.equal(
      await fixture.api.fetchFor({
        provider: "deezer",
        type: "track",
        id: "42",
        url: "http://www.deezer.com/track/42"
      }),
      null
    );
    assert.equal(await fixture.api.fetchFor(entity(fixture.detectors, "track")), null);
    assert.equal(fixture.calls.length, 1);

    const errorFixture = loadMetadata(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ id: 42, title: "Should not be used" })
      })
    );
    assert.equal(await errorFixture.api.fetchFor(entity(errorFixture.detectors, "album")), null);

    const rejectedFixture = loadMetadata(() => Promise.reject(new Error("network")));
    await assert.doesNotReject(rejectedFixture.api.fetchFor(entity(rejectedFixture.detectors, "artist")));
    assert.equal(await rejectedFixture.api.fetchFor(entity(rejectedFixture.detectors, "artist")), null);
  });

  test("deduplicates and caches requests by entity type and ID", async () => {
    let calls = 0;
    const fixture = loadMetadata(() => {
      calls++;
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 42, title: "Album" }) });
    });
    const album = entity(fixture.detectors, "album");
    const first = fixture.api.fetchFor(album);
    const second = fixture.api.fetchFor({ ...album });
    assert.strictEqual(first, second);
    assert.equal((await first).title, "Album");
    assert.equal((await fixture.api.fetchFor(album)).title, "Album");
    assert.equal(calls, 1);
    assert.equal(fixture.api.cacheSize(), 1);
    assert.equal(fixture.api.peek(album).title, "Album");
  });

  test("retries failures after a cooldown without hammering the API", async () => {
    let calls = 0;
    const fixture = loadMetadata(() => {
      calls++;
      if (calls === 1) {
        return Promise.reject(new Error("temporary network failure"));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: 42, title: "Recovered album" })
      });
    });
    const album = entity(fixture.detectors, "album");

    assert.equal(await fixture.api.fetchFor(album), null);
    assert.equal(await fixture.api.fetchFor(album), null);
    assert.equal(calls, 1);

    fixture.advance(30000);
    assert.equal((await fixture.api.fetchFor(album)).title, "Recovered album");
    assert.equal(calls, 2);
  });

  test("bounds successful metadata retained during long browsing sessions", async () => {
    let calls = 0;
    const fixture = loadMetadata((url) => {
      calls++;
      const id = Number(url.split("/").pop());
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id, title: `Album ${id}` })
      });
    });

    for (let id = 1; id <= 129; id++) {
      await fixture.api.fetchFor(entity(fixture.detectors, "album", String(id)));
    }
    assert.equal(fixture.api.cacheSize(), 128);

    await fixture.api.fetchFor(entity(fixture.detectors, "album", "1"));
    assert.equal(calls, 130);
    assert.equal(fixture.api.cacheSize(), 128);
  });

  test("provides an identity guard for late SPA responses", () => {
    const fixture = loadMetadata(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
    const track = entity(fixture.detectors, "track", "42");
    const nextTrack = entity(fixture.detectors, "track", "43");
    assert.equal(fixture.api.sameEntity(track, track), true);
    assert.equal(fixture.api.sameEntity(track, nextTrack), false);
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, it } from "node:test";

const source = readFileSync(new URL("../extension/content/detectors.js", import.meta.url), "utf8");
const context = { URL, URLSearchParams };
vm.runInNewContext(source, context, { filename: "extension/content/detectors.js" });
const detectors = context.RalgrumDetectors;

describe("Deezer pages", () => {
  it("parses supported bare and locale URLs", () => {
    assert.equal(detectors.parseDeezerUrl("https://www.deezer.com/us/track/3135556").id, "3135556");
    assert.equal(detectors.parseDeezerUrl("https://www.deezer.com/track/3135556").type, "track");
    assert.equal(detectors.parseDeezerUrl("https://listen.deezer.com/album/302127").type, "album");
  });

  it("parses album, playlist, and artist entity paths", () => {
    assert.equal(detectors.parseDeezerUrl("https://www.deezer.com/album/302127").type, "album");
    assert.equal(detectors.parseDeezerUrl("https://www.deezer.com/playlist/13743145521").type, "playlist");
    assert.equal(detectors.parseDeezerUrl("https://www.deezer.com/artist/27").type, "artist");
  });

  it("requires HTTPS, an allowed host, and one exact entity path", () => {
    assert.equal(detectors.parseDeezerUrl("http://www.deezer.com/track/3135556"), null);
    assert.equal(detectors.parseDeezerUrl("https://notdeezer.com/track/3135556"), null);
    assert.equal(detectors.parseDeezerUrl("https://deezer.com.evil.example/track/3135556"), null);
    assert.equal(detectors.parseDeezerUrl("https://deezer.com.br/album/302127"), null);
    assert.equal(detectors.parseDeezerUrl("https://www.deezer.com.us/artist/27"), null);
    assert.equal(detectors.parseDeezerUrl("https://www.deezer.com/us/fr/track/3135556"), null);
    assert.equal(detectors.parseDeezerUrl("https://www.deezer.com/track/0"), null);
    assert.equal(detectors.parseDeezerUrl("https://www.deezer.com/search?q=test"), null);
  });

  it("accepts 32-digit IDs but rejects zero, leading zeroes, and longer IDs", () => {
    const longestId = "9".repeat(32);
    assert.equal(detectors.parseDeezerUrl(`https://www.deezer.com/track/${longestId}`).id, longestId);
    for (const id of ["0", "01", "1".repeat(33)]) {
      assert.equal(detectors.parseDeezerUrl(`https://www.deezer.com/track/${id}`), null, id);
    }
  });
});

describe("SoundCloud pages", () => {
  it("detects artist, track, playlist, and album shapes", () => {
    assert.equal(detectors.parseSoundcloudUrl("https://soundcloud.com/someartist").type, "artist");
    assert.equal(detectors.parseSoundcloudUrl("https://soundcloud.com/someartist/some-track").type, "track");
    assert.equal(detectors.parseSoundcloudUrl("https://soundcloud.com/someartist/sets/some-mix").type, "playlist");
    assert.equal(detectors.parseSoundcloudUrl("https://soundcloud.com/someartist/albums/some-album").type, "album");
  });

  it("requires HTTPS and rejects every reserved top-level route", () => {
    const reserved = [
      "you",
      "discover",
      "stream",
      "search",
      "upload",
      "settings",
      "charts",
      "stations",
      "pages",
      "terms",
      "imprint",
      "logout"
    ];
    for (const route of reserved) {
      assert.equal(detectors.parseSoundcloudUrl(`https://soundcloud.com/${route}`), null, route);
    }
    assert.equal(detectors.parseSoundcloudUrl("http://soundcloud.com/someartist/some-track"), null);
    assert.equal(detectors.parseSoundcloudUrl("https://soundcloud.com.evil.example/a/b"), null);
    assert.equal(detectors.parseSoundcloudUrl("https://example.com/a/b"), null);
  });
});

describe("ralgrum links", () => {
  it("defaults tracks to play and collections to open", () => {
    const track = detectors.buildRalgrumUrl({
      provider: "deezer",
      type: "track",
      id: "1",
      url: "https://www.deezer.com/track/1"
    });
    const album = detectors.buildRalgrumUrl({
      provider: "deezer",
      type: "album",
      id: "2",
      url: "https://www.deezer.com/album/2"
    });
    assert.match(track, /action=play/);
    assert.match(album, /action=open/);
  });

  it("serializes an extracted title and keeps soundcloud links url addressed", () => {
    const title = "Try & title / mix";
    const link = detectors.buildRalgrumUrl(
      { provider: "soundcloud", type: "track", id: null, title: "Fallback", url: "https://soundcloud.com/a/b" },
      { action: "play", title }
    );
    const parsed = new URL(link);
    assert.equal(parsed.protocol, "ralgrum:");
    assert.equal(parsed.searchParams.get("title"), title);
    assert.equal(parsed.searchParams.get("provider"), "soundcloud");
    assert.equal(parsed.searchParams.get("action"), "play");
  });

  it("enforces Deezer IDs even when callers bypass URL detection", () => {
    const entity = { provider: "deezer", type: "track", url: "https://www.deezer.com/track/1" };
    for (const id of [undefined, null, 0, "01", "1".repeat(33), "-1", "abc"]) {
      assert.equal(detectors.buildRalgrumUrl({ ...entity, id }), null, String(id));
    }
    const longestId = "9".repeat(32);
    const link = detectors.buildRalgrumUrl({ ...entity, id: longestId });
    assert.equal(new URL(link).searchParams.get("id"), longestId);
    assert.equal(new URL(detectors.buildRalgrumUrl({ ...entity, id: 1 })).searchParams.get("id"), "1");
  });

  it("keeps the longest whole-emoji title prefix that fits the wire limit", () => {
    const entity = detectors.parseDeezerUrl("https://www.deezer.com/track/1");
    const required = detectors.buildRalgrumUrl(entity);
    const title = "😀".repeat(200);
    const link = detectors.buildRalgrumUrl(entity, { title });
    const maxEmoji = Math.floor((2048 - Buffer.byteLength(required) - "&title=".length) / 12);
    const params = new URL(link).searchParams;
    assert.equal(params.get("title"), "😀".repeat(maxEmoji));
    assert.equal(params.get("url"), entity.url);
    assert.ok(Buffer.byteLength(link) <= 2048);
  });

  it("caps titles at 200 Unicode scalars rather than UTF-16 units", () => {
    const entity = detectors.parseDeezerUrl("https://www.deezer.com/track/1");
    entity.title = "a".repeat(199) + "😀x";
    const link = detectors.buildRalgrumUrl(entity);
    assert.equal(new URL(link).searchParams.get("title"), "a".repeat(199) + "😀");
  });

  it("preserves URLSearchParams Unicode, literal plus, and replacement semantics", () => {
    const entity = detectors.parseSoundcloudUrl("https://soundcloud.com/a/b?tag=a+b&encoded=%2B");
    const link = detectors.buildRalgrumUrl(entity, { title: "\uD800 A+B &/% é😀" });
    const params = new URL(link).searchParams;
    assert.equal(params.get("title"), "\uFFFD A+B &/% é😀");
    assert.equal(params.get("url"), entity.url);
    assert.match(link, /^[\x00-\x7f]*$/);
  });

  it("trims only the title beside a near-limit private SoundCloud URL", () => {
    const entity = detectors.parseSoundcloudUrl(
      "https://soundcloud.com/artist/track/s-private?secret_token=s-a%2Bb&tag=caf%C3%A9&pad="
    );
    const requiredLength = Buffer.byteLength(detectors.buildRalgrumUrl(entity));
    entity.url += "x".repeat(2048 - requiredLength - "&title=".length - 18);
    const link = detectors.buildRalgrumUrl(entity, { title: "😀éAz" });
    const params = new URL(link).searchParams;
    assert.equal(Buffer.byteLength(link), 2048);
    assert.equal(params.get("title"), "😀é");
    assert.equal(params.get("url"), entity.url);
    assert.equal(params.get("provider"), "soundcloud");
    assert.equal(params.get("action"), "play");
    assert.equal(params.has("id"), false);
  });

  it("omits an unfit optional title and rejects unfit required fields without shortening the URL", () => {
    const entity = detectors.parseDeezerUrl("https://www.deezer.com/track/1?ref=");
    const requiredLength = Buffer.byteLength(detectors.buildRalgrumUrl(entity));
    entity.url += "a".repeat(2048 - requiredLength);
    const link = detectors.buildRalgrumUrl(entity, { title: "Optional title" });
    assert.equal(Buffer.byteLength(link), 2048);
    assert.equal(new URL(link).searchParams.get("url"), entity.url);
    assert.equal(new URL(link).searchParams.has("title"), false);
    entity.url += "a";
    assert.equal(detectors.buildRalgrumUrl(entity), null);
    assert.equal(detectors.buildRalgrumUrl(entity, { title: "Optional title" }), null);
  });
});

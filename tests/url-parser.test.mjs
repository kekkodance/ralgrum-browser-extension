// Zero dependency tests for the detector contract.
// They mirror extension/content/detectors.js logic so they run standalone
// with node --test even before the extension folder is packaged.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
function parseDeezerUrl(url) {
  const m = String(url || "").match(/deezer\.com(?:\.[a-z]{2})?\/[a-z-]*\/?(track|album|playlist|artist)\/(\d+)/i);
  if (!m || !m[2] || m[2] === "0") {
    return null;
  }
  return { provider: "deezer", type: m[1].toLowerCase(), id: m[2], url: String(url) };
}
function parseSoundcloudUrl(url) {
  let u;
  try {
    u = new URL(String(url));
  } catch {
    return null;
  }
  if (!/(^|\.)soundcloud\.com$/i.test(u.hostname)) {
    return null;
  }
  const segs = u.pathname.split("/").filter(Boolean);
  if (segs.length === 0) {
    return null;
  }
  const reserved = ["you", "discover", "stream", "search", "upload", "settings", "charts", "stations"];
  if (reserved.includes(segs[0].toLowerCase())) {
    return null;
  }
  if (segs.length === 1) {
    return { provider: "soundcloud", type: "artist", id: null, url: String(url) };
  }
  if (segs.map((s) => s.toLowerCase()).includes("sets")) {
    return { provider: "soundcloud", type: "playlist", id: null, url: String(url) };
  }
  return { provider: "soundcloud", type: "track", id: null, url: String(url) };
}
function buildRalgrumUrl(entity, action) {
  const act = action || (entity.type === "track" ? "play" : "open");
  const p = new URLSearchParams();
  p.set("provider", entity.provider);
  p.set("type", entity.type);
  if (entity.id) {
    p.set("id", entity.id);
  }
  p.set("action", act);
  p.set("url", entity.url);
  return "ralgrum://open?" + p.toString();
}
describe("deezer pages", () => {
  it("parses track urls in locale and bare form", () => {
    assert.equal(parseDeezerUrl("https://www.deezer.com/us/track/3135556").id, "3135556");
    assert.equal(parseDeezerUrl("https://www.deezer.com/track/3135556").type, "track");
  });
  it("parses album playlist and artist", () => {
    assert.equal(parseDeezerUrl("https://www.deezer.com/album/302127").type, "album");
    assert.equal(parseDeezerUrl("https://www.deezer.com/playlist/13743145521").type, "playlist");
    assert.equal(parseDeezerUrl("https://www.deezer.com/artist/27").type, "artist");
  });
  it("rejects zero ids and non entity pages", () => {
    assert.equal(parseDeezerUrl("https://www.deezer.com/track/0"), null);
    assert.equal(parseDeezerUrl("https://www.deezer.com/search?q=test"), null);
    assert.equal(parseDeezerUrl("https://example.com/track/123"), null);
  });
});
describe("soundcloud pages", () => {
  it("detects artist track and playlist shapes", () => {
    assert.equal(parseSoundcloudUrl("https://soundcloud.com/someartist").type, "artist");
    assert.equal(parseSoundcloudUrl("https://soundcloud.com/someartist/some-track").type, "track");
    assert.equal(parseSoundcloudUrl("https://soundcloud.com/someartist/sets/some-mix").type, "playlist");
  });
  it("rejects reserved and foreign urls", () => {
    assert.equal(parseSoundcloudUrl("https://soundcloud.com/discover"), null);
    assert.equal(parseSoundcloudUrl("https://soundcloud.com/search?q=x"), null);
    assert.equal(parseSoundcloudUrl("https://example.com/a/b"), null);
  });
});
describe("ralgrum links", () => {
  it("defaults tracks to play and collections to open", () => {
    const track = buildRalgrumUrl({ provider: "deezer", type: "track", id: "1", url: "https://www.deezer.com/track/1" });
    const album = buildRalgrumUrl({ provider: "deezer", type: "album", id: "2", url: "https://www.deezer.com/album/2" });
    assert.match(track, /action=play/);
    assert.match(album, /action=open/);
  });
  it("keeps soundcloud links url addressed", () => {
    const link = buildRalgrumUrl({ provider: "soundcloud", type: "track", id: null, url: "https://soundcloud.com/a/b" });
    assert.match(link, /^ralgrum:\/\/open\?/);
    assert.match(link, /provider=soundcloud/);
  });
});

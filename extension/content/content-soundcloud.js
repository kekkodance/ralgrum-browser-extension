// SoundCloud content script: detects track/album/playlist/artist and shows toast.
// Uses URL plus JSON-LD and meta tags, observes SPA navigation.
(function () {
  "use strict";
  function getMeta(prop) {
    var el =
      document.querySelector('meta[property="' + prop + '"]') ||
      document.querySelector('meta[name="' + prop + '"]');
    return el ? el.getAttribute("content") || "" : "";
  }
  function canonicalUrl() {
    var link = document.querySelector('link[rel="canonical"]');
    var href = link ? link.getAttribute("href") || "" : "";
    return href;
  }
  function jsonLdNodes() {
    try {
      return Array.prototype.slice.call(
        document.querySelectorAll('script[type="application/ld+json"]'),
      );
    } catch (e) {
      return [];
    }
  }
  function followCountFromNode(node) {
    if (!node || typeof node !== "object") {
      return 0;
    }
    var stats = node.interactionStatistic;
    var list = Array.isArray(stats) ? stats : [stats];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item || typeof item !== "object") {
        continue;
      }
      var kind = String(item.interactionType || "");
      if (kind.toLowerCase().indexOf("follow") === -1) {
        continue;
      }
      var n = Number(item.userInteractionCount);
      if (isFinite(n) && n > 0) {
        return n;
      }
    }
    return 0;
  }
  function flatNodes(data) {
    var out = [];
    var stack = [data];
    while (stack.length > 0) {
      var node = stack.pop();
      if (!node) {
        continue;
      }
      if (Array.isArray(node)) {
        for (var i = 0; i < node.length; i++) {
          stack.push(node[i]);
        }
        continue;
      }
      if (typeof node === "object") {
        out.push(node);
        for (var k in node) {
          if (Object.prototype.hasOwnProperty.call(node, k)) {
            stack.push(node[k]);
          }
        }
      }
    }
    return out;
  }
  function nodePageUrl(node) {
    if (!node || typeof node !== "object") {
      return "";
    }
    var url = node.url || node.mainEntityOfPage || "";
    if (typeof url === "object" && url) {
      url = url["@id"] || "";
    }
    return String(url || "");
  }
  function samePage(a, b) {
    try {
      var xUrl = new URL(String(a || ""));
      var yUrl = new URL(String(b || ""));
      if (xUrl.protocol !== "https:" || yUrl.protocol !== "https:") {
        return false;
      }
      var x = xUrl.hostname.toLowerCase() + xUrl.pathname.replace(/\/+$/, "");
      var y = yUrl.hostname.toLowerCase() + yUrl.pathname.replace(/\/+$/, "");
      return x !== "" && x === y;
    } catch (e) {
      return false;
    }
  }
  function entityKey(entity) {
    if (window.RalgrumSpaNavigation && window.RalgrumSpaNavigation.entityKey) {
      return window.RalgrumSpaNavigation.entityKey(entity);
    }
    return (
      entity &&
      entity.provider +
        ":" +
        entity.type +
        ":" +
        String(entity.url || "")
          .split("#")[0]
          .split("?")[0]
          .replace(/\/+$/, "")
    );
  }
  function isPlaceholderArtwork(value) {
    var metadata = window.RalgrumSoundCloudMetadata;
    if (metadata && typeof metadata.isPlaceholderArtwork === "function") {
      try {
        return metadata.isPlaceholderArtwork(value);
      } catch (e) {
        // use the local check below
      }
    }
    try {
      var parsed = new URL(String(value || ""));
      return (
        parsed.protocol === "https:" &&
        /^(?:[a-z0-9-]+\.)*soundcloud\.com$/i.test(parsed.hostname) &&
        parsed.pathname.toLowerCase() === "/images/fb_placeholder.png"
      );
    } catch (e2) {
      return false;
    }
  }
  function usablePageArtwork(value) {
    var candidate = String(value || "").trim();
    return candidate && !isPlaceholderArtwork(candidate) ? candidate : "";
  }
  function safeTrackArtwork(value) {
    var candidate = String(value || "").trim();
    if (!candidate || isPlaceholderArtwork(candidate)) {
      return "";
    }
    try {
      var parsed = new URL(candidate);
      if (
        parsed.protocol !== "https:" ||
        !/^(?:[a-z0-9-]+\.)*sndcdn\.com$/i.test(parsed.hostname)
      ) {
        return "";
      }
      return candidate;
    } catch (e) {
      return "";
    }
  }
  var HYDRATION_ARRAY_MAX_CHARS = 2 * 1024 * 1024;
  function balancedHydrationArray(source) {
    var marker = String(source || "").indexOf("__sc_hydration");
    if (marker < 0) {
      return "";
    }
    var start = String(source).indexOf("[", marker);
    if (start < 0) {
      return "";
    }
    var endLimit = Math.min(
      String(source).length,
      start + HYDRATION_ARRAY_MAX_CHARS,
    );
    var depth = 0;
    var inString = false;
    var escaped = false;
    for (var i = start; i < endLimit; i++) {
      var character = source.charAt(i);
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }
      if (character === '"') {
        inString = true;
      } else if (character === "[") {
        depth++;
      } else if (character === "]") {
        depth--;
        if (depth === 0) {
          return source.slice(start, i + 1);
        }
      }
    }
    return "";
  }
  function hydrationArrayText() {
    try {
      var scripts = document.querySelectorAll("script");
      for (var i = 0; i < scripts.length; i++) {
        var source = scripts[i].textContent || "";
        if (source.indexOf("__sc_hydration") < 0) {
          continue;
        }
        var arrayText = balancedHydrationArray(source);
        if (arrayText) {
          return arrayText;
        }
      }
    } catch (e) {
      // ignore malformed or unavailable hydration blocks
    }
    return "";
  }
  function hydrationData(entity, detectors, kind) {
    if (!entity || !detectors) {
      return null;
    }
    var route = detectors.parseSoundcloudUrl(entity.url);
    var source = hydrationArrayText();
    if (!route || !source) {
      return null;
    }
    try {
      var entries = JSON.parse(source);
      if (!Array.isArray(entries)) {
        return null;
      }
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (
          !entry ||
          (entry.hydratable !== kind &&
            !(kind === "sound" && entry.hydratable === "track"))
        ) {
          continue;
        }
        var data = entry.data;
        if (!data || !data.permalink_url) {
          continue;
        }
        var parsed = detectors.parseSoundcloudUrl(data.permalink_url);
        if (parsed && entityKey(parsed) === entityKey(route)) {
          return data;
        }
      }
    } catch (e) {
      // ignore malformed hydration JSON
    }
    return null;
  }
  function firstTrackArtworkFromHydration(entity, detectors) {
    if (!entity || (entity.type !== "playlist" && entity.type !== "album")) {
      return "";
    }
    var data = hydrationData(entity, detectors, "playlist");
    return data && Array.isArray(data.tracks) && data.tracks.length
      ? safeTrackArtwork(data.tracks[0] && data.tracks[0].artwork_url)
      : "";
  }
  function headFresh(currentEntity, detectors) {
    try {
      var linkedUrl =
        getMeta("og:url") || getMeta("twitter:url") || canonicalUrl();
      if (!linkedUrl) {
        return false;
      }
      var linked = detectors.parseSoundcloudUrl(linkedUrl);
      var currentRoute =
        currentEntity && detectors.parseSoundcloudUrl(currentEntity.url);
      return (
        !!linked &&
        !!currentRoute &&
        entityKey(linked) === entityKey(currentRoute)
      );
    } catch (e) {
      return false;
    }
  }
  function artistName(value) {
    var candidate = typeof value === "string" ? value.trim() : "";
    return /^https?:\/\/\S*$/i.test(candidate) ? "" : candidate;
  }
  function personName(value) {
    if (!value) {
      return "";
    }
    if (typeof value === "string") {
      return artistName(value);
    }
    var list = Array.isArray(value) ? value : [value];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var name = artistName(
        typeof item === "string" ? item : item && item.name,
      );
      if (name) {
        return name;
      }
    }
    return "";
  }
  function jsonLdArtistName(pageUrl) {
    var scripts = jsonLdNodes();
    for (var i = 0; i < scripts.length; i++) {
      try {
        var data = JSON.parse(scripts[i].textContent || "null");
        var nodes = flatNodes(data);
        for (var j = 0; j < nodes.length; j++) {
          var node = nodes[j];
          var t = String(node["@type"] || "").toLowerCase();
          if (
            t !== "musicrecording" &&
            t !== "musicalbum" &&
            t !== "musicplaylist" &&
            t !== "audioobject"
          ) {
            continue;
          }
          if (
            !pageUrl ||
            !nodePageUrl(node) ||
            !samePage(nodePageUrl(node), pageUrl)
          ) {
            continue;
          }
          var name =
            personName(node.byArtist) ||
            personName(node.creator) ||
            personName(node.author) ||
            personName(node.publisher);
          if (name) {
            return name;
          }
        }
      } catch (e) {
        // skip malformed block
      }
    }
    return "";
  }
  function jsonLdFollowers(pageUrl) {
    var scripts = jsonLdNodes();
    for (var i = 0; i < scripts.length; i++) {
      try {
        var data = JSON.parse(scripts[i].textContent || "null");
        var nodes = flatNodes(data);
        for (var j = 0; j < nodes.length; j++) {
          var node = nodes[j];
          var t = String(node["@type"] || "").toLowerCase();
          if (t !== "musicgroup" && t !== "person") {
            continue;
          }
          if (
            !pageUrl ||
            !nodePageUrl(node) ||
            !samePage(nodePageUrl(node), pageUrl)
          ) {
            continue;
          }
          var n = followCountFromNode(node);
          if (n > 0) {
            return n;
          }
        }
      } catch (e) {
        // skip malformed block
      }
    }
    return 0;
  }
  function metaFollowerCount() {
    var raw = getMeta("soundcloud:follower_count");
    var n = Number(String(raw || "").trim());
    return isFinite(n) && n > 0 ? n : 0;
  }
  function pageExplicit(entity, detectors) {
    var data = hydrationData(entity, detectors, "sound");
    if (!data) {
      return false;
    }
    if (typeof data.is_explicit === "boolean") {
      return data.is_explicit;
    }
    if (typeof data.explicit === "boolean") {
      return data.explicit;
    }
    return !!(
      data.publisher_metadata && data.publisher_metadata.explicit === true
    );
  }
  function grouped(value) {
    return Number(value).toLocaleString("en-US");
  }
  function readPage(requestedEntity) {
    var detectors = window.RalgrumDetectors;
    if (!detectors) {
      return null;
    }
    var pageUrl = window.location.href;
    var entity = requestedEntity || currentEntity();
    if (!entity) {
      return null;
    }
    var fresh = headFresh(entity, detectors);
    var title = fresh
      ? getMeta("og:title") || getMeta("twitter:title") || document.title || ""
      : "";
    var artwork = fresh
      ? usablePageArtwork(getMeta("og:image")) ||
        usablePageArtwork(getMeta("twitter:image"))
      : "";
    if (
      fresh &&
      !artwork &&
      (entity.type === "playlist" || entity.type === "album")
    ) {
      artwork = firstTrackArtworkFromHydration(entity, detectors);
    }
    var subtitle = fresh
      ? artistName(getMeta("og:audio:artist")) ||
        artistName(getMeta("author")) ||
        jsonLdArtistName(pageUrl)
      : "";
    if (entity.type === "artist") {
      var followers = fresh
        ? metaFollowerCount() || jsonLdFollowers(pageUrl)
        : 0;
      subtitle = followers > 0 ? grouped(followers) + " followers" : "";
    }
    var explicit =
      fresh && entity.type === "track" && pageExplicit(entity, detectors);
    return {
      entity: entity,
      meta: {
        title: title,
        subtitle: subtitle,
        artwork: artwork,
        explicit: explicit,
      },
      related: [],
      fresh: fresh,
    };
  }
  function shouldShow(entity, settings) {
    if (!settings) {
      return true;
    }
    if (settings.providers && settings.providers.soundcloud === false) {
      return false;
    }
    if (settings.autoShow === false) {
      return false;
    }
    if (entity.type === "track" && settings.showOnTrack === false) {
      return false;
    }
    if (
      (entity.type === "album" || entity.type === "playlist") &&
      settings.showOnCollection === false
    ) {
      return false;
    }
    if (entity.type === "artist" && settings.showOnArtist === false) {
      return false;
    }
    return true;
  }
  function getSettings(done) {
    try {
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.sync
      ) {
        chrome.storage.sync.get(null, function (items) {
          done(items || {});
        });
        return;
      }
    } catch (e) {
      // fall through
    }
    done({});
  }
  var navigation = null;
  function navigationIsCurrent(entity, generation) {
    if (navigation && navigation.isCurrent && generation != null) {
      return navigation.isCurrent(entity, generation);
    }
    var current = currentEntity();
    return !!current && entityKey(current) === entityKey(entity);
  }
  function authoritativeMetadata(found, hydrated) {
    var freshBase = found && found.fresh ? found.meta : null;
    return {
      title: (hydrated && hydrated.title) || "",
      subtitle:
        (hydrated && hydrated.subtitle) ||
        (freshBase && freshBase.subtitle) ||
        "",
      artwork:
        (hydrated && hydrated.artwork) ||
        (freshBase && freshBase.artwork) ||
        "",
      explicit: !!(found && found.meta && found.meta.explicit),
      authoritative: !!(hydrated && hydrated.authoritative),
    };
  }
  var hydrationAttachments = Object.create(null);
  function showFound(found, generation) {
    if (
      !window.RalgrumToast ||
      !navigationIsCurrent(found.entity, generation)
    ) {
      return;
    }
    var metadata = window.RalgrumSoundCloudMetadata;
    var cached = null;
    if (metadata && typeof metadata.peek === "function") {
      try {
        cached = metadata.peek(found.entity);
      } catch (e) {
        cached = null;
      }
    }
    if (cached) {
      window.RalgrumToast.showOncePerPage(
        found.entity,
        authoritativeMetadata(found, cached),
        found.related,
      );
      return;
    }
    if (found.fresh) {
      if (!found.meta.subtitle) {
        debugNoSub(found.entity);
      }
      window.RalgrumToast.showOncePerPage(
        found.entity,
        found.meta,
        found.related,
      );
    }
    if (
      found.entity.type === "album" ||
      !metadata ||
      typeof metadata.fetchFor !== "function"
    ) {
      return;
    }
    var key = entityKey(found.entity);
    var attached = hydrationAttachments[key];
    if (attached) {
      attached.generation = generation;
      return;
    }
    var pending;
    try {
      pending = metadata.fetchFor(found.entity);
    } catch (e2) {
      return;
    }
    var attachment = { generation: generation, promise: null };
    hydrationAttachments[key] = attachment;
    attachment.promise = Promise.resolve(pending).then(
      function (hydrated) {
        if (hydrationAttachments[key] === attachment) {
          delete hydrationAttachments[key];
        }
        if (
          !hydrated ||
          !navigationIsCurrent(found.entity, attachment.generation)
        ) {
          return;
        }
        getSettings(function (settings) {
          if (!navigationIsCurrent(found.entity, attachment.generation)) {
            return;
          }
          var latestEntity = currentEntity();
          if (!latestEntity || entityKey(latestEntity) !== key) {
            return;
          }
          if (!shouldShow(latestEntity, settings)) {
            if (window.RalgrumToast) {
              window.RalgrumToast.dismiss();
            }
            return;
          }
          var latest = readPage(latestEntity);
          if (window.RalgrumToast && latest) {
            window.RalgrumToast.showOncePerPage(
              latestEntity,
              authoritativeMetadata(latest, hydrated),
              latest.related,
            );
          }
        });
      },
      function () {
        if (hydrationAttachments[key] === attachment) {
          delete hydrationAttachments[key];
        }
      },
    );
  }
  function maybeShow(entity, generation) {
    var found = readPage(entity);
    if (!found) {
      if (window.RalgrumToast) {
        window.RalgrumToast.dismiss();
      }
      return;
    }
    if (!found.fresh && found.entity.type === "album") {
      return;
    }
    getSettings(function (settings) {
      if (!navigationIsCurrent(found.entity, generation)) {
        return;
      }
      if (!shouldShow(found.entity, settings)) {
        if (window.RalgrumToast) {
          window.RalgrumToast.dismiss();
        }
        return;
      }
      showFound(found, generation);
    });
  }
  var lastNoSubKey = "";
  function debugNoSub(entity) {
    try {
      if (typeof console === "undefined" || !console.debug) {
        return;
      }
      var k =
        entity.provider + ":" + entity.type + ":" + (entity.id || entity.url);
      if (k === lastNoSubKey) {
        return;
      }
      lastNoSubKey = k;
      console.debug(
        "[ralgrum] no subtitle extracted for " +
          k +
          " on " +
          window.location.href,
      );
    } catch (e) {
      // ignore logging errors
    }
  }
  function currentEntity() {
    var detectors = window.RalgrumDetectors;
    var entity =
      detectors && detectors.parseSoundcloudUrl
        ? detectors.parseSoundcloudUrl(window.location.href)
        : null;
    if (
      !entity ||
      entity.type !== "playlist" ||
      !headFresh(entity, detectors) ||
      typeof detectors.parseSoundcloudFromJsonLd !== "function"
    ) {
      return entity;
    }
    var scripts = jsonLdNodes();
    for (var i = 0; i < scripts.length; i++) {
      try {
        var nodes = flatNodes(JSON.parse(scripts[i].textContent || "null"));
        for (var j = 0; j < nodes.length; j++) {
          var node = nodes[j];
          var pageUrl = nodePageUrl(node);
          if (!pageUrl || !samePage(pageUrl, entity.url)) {
            continue;
          }
          var structured = detectors.parseSoundcloudFromJsonLd(
            node,
            entity.url,
          );
          if (structured && structured.type === "album") {
            entity.type = "album";
            return entity;
          }
        }
      } catch (e) {
        // skip malformed blocks without changing route identity
      }
    }
    return entity;
  }
  if (window.RalgrumSpaNavigation && window.RalgrumSpaNavigation.start) {
    navigation = window.RalgrumSpaNavigation.start({
      readEntity: currentEntity,
      onNavigate: function () {
        if (window.RalgrumToast) {
          window.RalgrumToast.resetForNavigation();
        }
      },
      onRefresh: maybeShow,
    });
  } else {
    setTimeout(function () {
      maybeShow(currentEntity(), null);
    }, 900);
  }
})();

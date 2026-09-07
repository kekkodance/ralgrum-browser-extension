// RalgrumDetectors: pure URL and metadata parsers, no chrome APIs in here.
// Exposes a browser global so content scripts, popup, and tests share logic.
// Supported: Deezer track/album/playlist/artist pages, SoundCloud
// track/playlist(album)/artist pages.
// ralgrum URL format:
// ralgrum://open?provider=deezer&type=track&id=123&action=play&url=..&title=..
(function (root) {
  'use strict';
  var DEEZER_RE = /deezer\.com(?:\.[a-z]{2})?\/[a-z-]*\/?(track|album|playlist|artist)\/(\d+)/i;
  var DEEZER_SHORT_RE = /\/\/(?:www\.)?deezer\.com\/(track|album|playlist|artist)\/(\d+)/i;

  function normalizeType(raw) {
    raw = String(raw || '').toLowerCase();
    if (raw === 'track' || raw === 'album' || raw === 'playlist' || raw === 'artist') {
      return raw;
    }
    return null;
  }

  function parseDeezerUrl(url) {
    try {
      var m = String(url || '').match(DEEZER_RE) || String(url || '').match(DEEZER_SHORT_RE);
      if (!m) {
        return null;
      }
      var type = normalizeType(m[1]);
      var id = m[2];
      if (!type || !id || id === '0') {
        return null;
      }
      return { provider: 'deezer', type: type, id: id, url: String(url) };
    } catch (e) {
      return null;
    }
  }

  function soundcloudPathSegments(url) {
    try {
      var u = new URL(String(url));
      if (!/(^|\.)soundcloud\.com$/i.test(u.hostname)) {
        return null;
      }
      return u.pathname.split('/').filter(Boolean);
    } catch (e) {
      return null;
    }
  }

  function parseSoundcloudUrl(url) {
    var segs = soundcloudPathSegments(url);
    if (!segs || segs.length === 0) {
      return null;
    }
    var lowered = segs.map(function (s) { return s.toLowerCase(); });
    // Reserved top level pages are never entities.
    var reserved = ['you', 'discover', 'stream', 'search', 'upload', 'settings', 'charts', 'stations', 'pages', 'terms', 'imprint', 'logout'];
    if (reserved.indexOf(lowered[0]) !== -1) {
      return null;
    }
    if (segs.length === 1) {
      return { provider: 'soundcloud', type: 'artist', id: null, url: String(url) };
    }
    if (lowered[1] === 'sets' || lowered.indexOf('sets') !== -1) {
      return { provider: 'soundcloud', type: 'playlist', id: null, url: String(url) };
    }
    if (segs.length >= 3 && lowered[1] === 'albums') {
      return { provider: 'soundcloud', type: 'album', id: null, url: String(url) };
    }
    if (segs.length === 2) {
      return { provider: 'soundcloud', type: 'track', id: null, url: String(url) };
    }
    if (segs.length > 2) {
      return { provider: 'soundcloud', type: 'track', id: null, url: String(url) };
    }
    return null;
  }

  function parseSoundcloudFromJsonLd(nodes, fallbackUrl) {
    try {
      var list = Array.isArray(nodes) ? nodes : [nodes];
      for (var i = 0; i < list.length; i++) {
        var node = list[i];
        if (!node || typeof node !== 'object') {
          continue;
        }
        var t = String(node['@type'] || '').toLowerCase();
        var pageUrl = node.url || node.mainEntityOfPage || fallbackUrl;
        if (t === 'musicrecording' || t === 'audioobject') {
          return { provider: 'soundcloud', type: 'track', id: null, url: String(pageUrl || fallbackUrl) };
        }
        if (t === 'musicalbum') {
          return { provider: 'soundcloud', type: 'album', id: null, url: String(pageUrl || fallbackUrl) };
        }
        if (t === 'musicplaylist' || t === 'musicgroup' && false) {
          return { provider: 'soundcloud', type: 'playlist', id: null, url: String(pageUrl || fallbackUrl) };
        }
        if (t === 'musicgroup' || t === 'person') {
          return { provider: 'soundcloud', type: 'artist', id: null, url: String(pageUrl || fallbackUrl) };
        }
      }
    } catch (e) {
      // fall through to null
    }
    return null;
  }

  function detectFromUrl(url) {
    return parseDeezerUrl(url) || parseSoundcloudUrl(url);
  }

  function defaultActionFor(entity) {
    if (!entity) {
      return 'open';
    }
    return entity.type === 'track' ? 'play' : 'open';
  }

  function buildRalgrumUrl(entity, opts) {
    if (!entity || !entity.provider || !entity.type || !entity.url) {
      return null;
    }
    var provider = String(entity.provider).toLowerCase();
    var type = normalizeType(entity.type);
    if ((provider !== 'deezer' && provider !== 'soundcloud') || !type) {
      return null;
    }
    var action = opts && opts.action ? String(opts.action) : defaultActionFor(entity);
    if (action !== 'play' && action !== 'open') {
      action = defaultActionFor(entity);
    }
    var params = new URLSearchParams();
    params.set('provider', provider);
    params.set('type', type);
    if (entity.id) {
      params.set('id', String(entity.id));
    }
    params.set('action', action);
    params.set('url', String(entity.url));
    if (opts && opts.title) {
      params.set('title', String(opts.title));
    } else if (entity.title) {
      params.set('title', String(entity.title));
    }
    return 'ralgrum://open?' + params.toString();
  }

  function deezerArtworkFor(entity) {
    if (!entity || entity.provider !== 'deezer' || !entity.id) {
      return '';
    }
    if (entity.type === 'playlist') {
      return 'https://api.deezer.com/playlist/' + entity.id + '/image';
    }
    if (entity.type === 'album') {
      return 'https://api.deezer.com/album/' + entity.id + '/image';
    }
    return '';
  }

  var api = {
    parseDeezerUrl: parseDeezerUrl,
    parseSoundcloudUrl: parseSoundcloudUrl,
    parseSoundcloudFromJsonLd: parseSoundcloudFromJsonLd,
    detectFromUrl: detectFromUrl,
    defaultActionFor: defaultActionFor,
    buildRalgrumUrl: buildRalgrumUrl,
    deezerArtworkFor: deezerArtworkFor
  };
  root.RalgrumDetectors = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);

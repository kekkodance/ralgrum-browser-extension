// SoundCloud oEmbed metadata hydration for validated SPA entities.
(function (root) {
  'use strict';

  var cache = Object.create(null);
  var successfulKeys = [];
  var failedKeys = [];
  var FAILURE_RETRY_COOLDOWN_MS = 30000;
  var MAX_SUCCESSFUL_CACHE_ENTRIES = 128;
  var MAX_FAILURE_CACHE_ENTRIES = 128;
  var SUPPORTED_TYPES = { track: true, playlist: true, artist: true };

  function text(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function detectors() {
    return root.RalgrumDetectors || null;
  }

  function navigation() {
    return root.RalgrumSpaNavigation || null;
  }

  function soundcloudUrl(value) {
    try {
      var parsed = new URL(String(value || ''));
      if (parsed.protocol !== 'https:' || !/^(?:[a-z0-9-]+\.)*soundcloud\.com$/i.test(parsed.hostname)) {
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function validatedEntity(entity) {
    if (!entity || entity.provider !== 'soundcloud' || !SUPPORTED_TYPES[entity.type]) {
      return null;
    }
    var parser = detectors();
    var nav = navigation();
    if (!parser || typeof parser.parseSoundcloudUrl !== 'function' || !nav || typeof nav.entityKey !== 'function') {
      return null;
    }
    var parsedUrl = soundcloudUrl(entity.url);
    if (!parsedUrl) {
      return null;
    }
    var parsed = parser.parseSoundcloudUrl(entity.url);
    if (!parsed || parsed.type !== entity.type) {
      return null;
    }
    var parsedKey = nav.entityKey(parsed);
    var entityKey = nav.entityKey(entity);
    if (!parsedKey || parsedKey !== entityKey) {
      return null;
    }
    return {
      provider: 'soundcloud',
      type: parsed.type,
      url: parsed.url,
      key: parsedKey
    };
  }

  function removeSuccessfulKey(key) {
    var index = successfulKeys.indexOf(key);
    if (index >= 0) {
      successfulKeys.splice(index, 1);
    }
  }

  function removeFailureKey(key) {
    var index = failedKeys.indexOf(key);
    if (index >= 0) {
      failedKeys.splice(index, 1);
    }
  }

  function rememberSuccessfulEntry(key, entry) {
    removeFailureKey(key);
    removeSuccessfulKey(key);
    successfulKeys.push(key);
    while (successfulKeys.length > MAX_SUCCESSFUL_CACHE_ENTRIES) {
      var oldestKey = successfulKeys.shift();
      var oldestEntry = cache[oldestKey];
      if (oldestEntry && oldestEntry.status === 'success') {
        delete cache[oldestKey];
      }
    }
  }

  function rememberFailure(key, entry) {
    if (cache[key] !== entry) {
      return;
    }
    entry.status = 'failure';
    entry.failedAt = Date.now();
    removeFailureKey(key);
    failedKeys.push(key);
    while (failedKeys.length > MAX_FAILURE_CACHE_ENTRIES) {
      var oldestKey = failedKeys.shift();
      var oldestEntry = cache[oldestKey];
      if (oldestEntry && oldestEntry.status === 'failure') {
        delete cache[oldestKey];
      }
    }
  }

  function safeHttps(value) {
    try {
      var parsed = new URL(String(value || ''));
      return parsed.protocol === 'https:' && !!parsed.hostname;
    } catch (e) {
      return false;
    }
  }

  function safeSoundcloudUrl(value) {
    var parsed = soundcloudUrl(value);
    return !!parsed;
  }

  function providerUrlIsSoundcloud(value) {
    try {
      var parsed = new URL(String(value || ''));
      return parsed.protocol === 'https:' && /^(?:www\.)?soundcloud\.com$/i.test(parsed.hostname)
        && (parsed.pathname === '' || parsed.pathname === '/');
    } catch (e) {
      return false;
    }
  }

  function isPlaceholderArtwork(value) {
    try {
      var parsed = new URL(String(value || ''));
      return parsed.protocol === 'https:'
        && /^(?:[a-z0-9-]+\.)*soundcloud\.com$/i.test(parsed.hostname)
        && parsed.pathname.toLowerCase() === '/images/fb_placeholder.png';
    } catch (e) {
      return false;
    }
  }

  function stripAuthorSuffix(title, author) {
    var rawTitle = text(title);
    var rawAuthor = text(author);
    if (!rawTitle || !rawAuthor) {
      return rawTitle;
    }
    var suffix = ' by ' + rawAuthor;
    if (rawTitle.length <= suffix.length || rawTitle.slice(-suffix.length).toLowerCase() !== suffix.toLowerCase()) {
      return rawTitle;
    }
    var stripped = rawTitle.slice(0, rawTitle.length - suffix.length).trim();
    return stripped || rawTitle;
  }

  function normalize(payload, entity) {
    var valid = validatedEntity(entity);
    if (!valid || !payload || typeof payload !== 'object' || payload.error) {
      return null;
    }
    if (String(payload.provider_name || '').trim().toLowerCase() !== 'soundcloud') {
      return null;
    }
    if (!providerUrlIsSoundcloud(payload.provider_url)) {
      return null;
    }
    var rawTitle = text(payload.title);
    var author = text(payload.author_name);
    if (!rawTitle || ((valid.type === 'track' || valid.type === 'playlist') && !author)) {
      return null;
    }
    if (payload.thumbnail_url && !safeHttps(payload.thumbnail_url)) {
      return null;
    }
    if (payload.author_url && !safeSoundcloudUrl(payload.author_url)) {
      return null;
    }
    var title = stripAuthorSuffix(rawTitle, author);
    if (!title) {
      return null;
    }
    var subtitle = author && author.toLowerCase() !== title.toLowerCase() ? author : '';
    var thumbnail = text(payload.thumbnail_url);
    return {
      provider: 'soundcloud',
      type: valid.type,
      title: title,
      subtitle: subtitle,
      artwork: isPlaceholderArtwork(thumbnail) ? '' : thumbnail,
      authoritative: true
    };
  }

  function fetchFor(entity) {
    var valid = validatedEntity(entity);
    if (!valid) {
      return Promise.resolve(null);
    }
    var key = valid.key;
    var existing = cache[key];
    if (existing) {
      if (existing.status === 'success' || existing.status === 'pending') {
        return existing.promise;
      }
      if (Date.now() - existing.failedAt < FAILURE_RETRY_COOLDOWN_MS) {
        return existing.promise;
      }
      delete cache[key];
      removeFailureKey(key);
    }
    var fetchImpl = root.fetch;
    var entry = { status: 'pending', promise: null, failedAt: 0 };
    cache[key] = entry;
    if (typeof fetchImpl !== 'function') {
      entry.promise = Promise.resolve(null).then(function (result) {
        rememberFailure(key, entry);
        return result;
      });
      return entry.promise;
    }
    var endpoint = 'https://soundcloud.com/oembed?format=json&url=' + encodeURIComponent(valid.url);
    entry.promise = Promise.resolve()
      .then(function () {
        return fetchImpl(endpoint, { method: 'GET', credentials: 'omit' });
      })
      .then(function (response) {
        if (!response || response.ok !== true || typeof response.json !== 'function') {
          return null;
        }
        return response.json();
      })
      .then(function (payload) {
        return normalize(payload, valid);
      }, function () {
        return null;
      })
      .then(function (result) {
        if (result) {
          if (cache[key] === entry) {
            entry.status = 'success';
            entry.value = result;
            rememberSuccessfulEntry(key, entry);
          }
        } else {
          rememberFailure(key, entry);
        }
        return result;
      });
    return entry.promise;
  }

  function peek(entity) {
    var valid = validatedEntity(entity);
    if (!valid) {
      return null;
    }
    var entry = cache[valid.key];
    return entry && entry.status === 'success' ? entry.value : null;
  }

  function sameEntity(left, right) {
    var a = validatedEntity(left);
    var b = validatedEntity(right);
    return !!a && !!b && a.key === b.key;
  }

  root.RalgrumSoundCloudMetadata = {
    fetchFor: fetchFor,
    peek: peek,
    normalize: normalize,
    isPlaceholderArtwork: isPlaceholderArtwork,
    sameEntity: sameEntity,
    cacheSize: function () { return Object.keys(cache).length; },
    failureCacheSize: function () { return failedKeys.length; }
  };
})(typeof window !== 'undefined' ? window : globalThis);

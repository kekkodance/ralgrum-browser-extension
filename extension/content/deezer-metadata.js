// Shared Deezer metadata hydration for SPA pages.
// The module is deliberately independent from extension APIs.
(function (root) {
  'use strict';

  var cache = Object.create(null);
  var successfulKeys = [];
  var failedKeys = [];
  var FAILURE_RETRY_COOLDOWN_MS = 30000;
  var MAX_SUCCESSFUL_CACHE_ENTRIES = 128;
  var MAX_FAILURE_CACHE_ENTRIES = 128;
  var SUPPORTED_TYPES = { track: true, album: true, playlist: true, artist: true };

  function detectors() {
    return root.RalgrumDetectors || null;
  }

  function validatedEntity(entity) {
    if (!entity || entity.provider !== 'deezer' || !SUPPORTED_TYPES[entity.type]) {
      return null;
    }
    var id = String(entity.id || '');
    var parser = detectors();
    if (!/^\d+$/.test(id) || id === '0' || !parser || !parser.parseDeezerUrl) {
      return null;
    }
    var parsed = parser.parseDeezerUrl(entity.url);
    if (!parsed || parsed.type !== entity.type || parsed.id !== id) {
      return null;
    }
    return { provider: 'deezer', type: entity.type, id: id, url: parsed.url };
  }

  function sameEntity(left, right) {
    var a = validatedEntity(left);
    var b = validatedEntity(right);
    return !!a && !!b && a.type === b.type && a.id === b.id;
  }

  function text(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function nestedName(value) {
    if (!value) {
      return '';
    }
    if (typeof value === 'string') {
      return text(value);
    }
    return text(value.name);
  }

  function artwork(value) {
    var candidate = text(value);
    return /^https:\/\/\S+$/i.test(candidate) ? candidate : '';
  }

  function firstArtwork() {
    for (var i = 0; i < arguments.length; i++) {
      var value = artwork(arguments[i]);
      if (value) {
        return value;
      }
    }
    return '';
  }

  function formatFans(value) {
    var count = Number(value);
    return isFinite(count) && count >= 0 ? count.toLocaleString('en-US') + ' fans' : '';
  }

  function removeSuccessfulKey(key) {
    var index = successfulKeys.indexOf(key);
    if (index >= 0) {
      successfulKeys.splice(index, 1);
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

  function removeFailureKey(key) {
    var index = failedKeys.indexOf(key);
    if (index >= 0) {
      failedKeys.splice(index, 1);
    }
  }

  function rememberFailure(key, entry) {
    if (cache[key] === entry) {
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
  }

  function normalize(payload, entity) {
    var valid = validatedEntity(entity);
    if (!valid || !payload || typeof payload !== 'object' || payload.error) {
      return null;
    }
    if (String(payload.id || '') !== valid.id) {
      return null;
    }

    var title = '';
    var subtitle = '';
    var image = '';
    if (valid.type === 'track') {
      title = text(payload.title) || text(payload.title_short);
      subtitle = nestedName(payload.artist);
      image = firstArtwork(
        payload.album && payload.album.cover_xl,
        payload.album && payload.album.cover_big,
        payload.album && payload.album.cover_medium,
        payload.album && payload.album.cover
      );
    } else if (valid.type === 'album') {
      title = text(payload.title);
      subtitle = nestedName(payload.artist);
      image = firstArtwork(payload.cover_xl, payload.cover_big, payload.cover_medium, payload.cover);
    } else if (valid.type === 'playlist') {
      title = text(payload.title);
      subtitle = nestedName(payload.creator) || nestedName(payload.user);
      image = firstArtwork(payload.picture_xl, payload.picture_big, payload.picture_medium, payload.picture);
    } else {
      title = text(payload.name);
      subtitle = formatFans(payload.nb_fan);
      image = firstArtwork(payload.picture_xl, payload.picture_big, payload.picture_medium, payload.picture);
    }
    if (!title) {
      return null;
    }
    var normalized = {
      provider: 'deezer',
      type: valid.type,
      id: valid.id,
      title: title,
      subtitle: subtitle,
      artwork: image
    };
    if (typeof payload.explicit_lyrics === 'boolean') {
      normalized.explicit = payload.explicit_lyrics;
    }
    return normalized;
  }

  function fetchFor(entity) {
    var valid = validatedEntity(entity);
    if (!valid) {
      return Promise.resolve(null);
    }
    var key = valid.type + ':' + valid.id;
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
    var endpoint = 'https://api.deezer.com/' + valid.type + '/' + encodeURIComponent(valid.id);
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
      .then(
        function (payload) {
          return normalize(payload, valid);
        },
        function () {
          return null;
        }
      )
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
    var entry = cache[valid.type + ':' + valid.id];
    return entry && entry.status === 'success' ? entry.value : null;
  }

  root.RalgrumDeezerMetadata = {
    fetchFor: fetchFor,
    peek: peek,
    normalize: normalize,
    sameEntity: sameEntity,
    cacheSize: function () {
      return Object.keys(cache).length;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

// Deezer content script: detects track/album/playlist/artist and shows toast.
// Runs at document_idle, observes SPA navigation, respects stored settings.
(function () {
  'use strict';
  function getMeta(prop) {
    var el =
      document.querySelector('meta[property="' + prop + '"]') || document.querySelector('meta[name="' + prop + '"]');
    return el ? el.getAttribute('content') || '' : '';
  }
  function jsonLdNodes() {
    try {
      return Array.prototype.slice.call(document.querySelectorAll('script[type="application/ld+json"]'));
    } catch (e) {
      return [];
    }
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
      if (typeof node === 'object') {
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
  function personName(value) {
    if (!value) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    var list = Array.isArray(value) ? value : [value];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (typeof item === 'string' && item) {
        return item;
      }
      if (item && typeof item === 'object' && item.name) {
        return String(item.name);
      }
    }
    return '';
  }
  function nodePageUrl(node) {
    if (!node || typeof node !== 'object') {
      return '';
    }
    var url = node.url || node.mainEntityOfPage || '';
    if (typeof url === 'object' && url) {
      url = url['@id'] || '';
    }
    return String(url || '');
  }
  function jsonLdArtistName(entity) {
    var scripts = jsonLdNodes();
    for (var i = 0; i < scripts.length; i++) {
      try {
        var data = JSON.parse(scripts[i].textContent || 'null');
        var nodes = flatNodes(data);
        for (var j = 0; j < nodes.length; j++) {
          var node = nodes[j];
          var t = String(node['@type'] || '').toLowerCase();
          if (t !== 'musicrecording' && t !== 'musicalbum' && t !== 'musicplaylist' && t !== 'audioobject') {
            continue;
          }
          if (!sameEntity(window.RalgrumDetectors.parseDeezerUrl(nodePageUrl(node)), entity)) {
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
    return '';
  }
  function ogDescriptionArtist() {
    var d = getMeta('og:description') || '';
    var m = d.match(/^(.*) - (song|album) - .*$/);
    return m ? m[1].trim() : '';
  }
  function sameEntity(a, b) {
    if (window.RalgrumDeezerMetadata && window.RalgrumDeezerMetadata.sameEntity) {
      return window.RalgrumDeezerMetadata.sameEntity(a, b);
    }
    return !!a && !!b && a.provider === b.provider && a.type === b.type && String(a.id || '') === String(b.id || '');
  }
  function headFresh(currentEntity, detectors, property) {
    try {
      var u = getMeta(property) || '';
      if (!u) {
        return false;
      }
      var linked = detectors.parseDeezerUrl(u);
      if (!linked) {
        return false;
      }
      return sameEntity(linked, currentEntity);
    } catch (e) {
      return false;
    }
  }
  function h1Title() {
    try {
      var els = document.querySelectorAll('h1');
      for (var i = 0; i < els.length; i++) {
        var t = (els[i].textContent || '').trim().replace(/\s+/g, ' ');
        if (t && t.length <= 120) {
          return t;
        }
      }
    } catch (e) {
      // ignore DOM read errors
    }
    return '';
  }
  function readPage(currentEntity) {
    var detectors = window.RalgrumDetectors;
    if (!detectors) {
      return null;
    }
    var entity = currentEntity || detectors.parseDeezerUrl(window.location.href);
    if (!entity) {
      return null;
    }
    var ogFresh = headFresh(entity, detectors, 'og:url');
    var twitterFresh = headFresh(entity, detectors, 'twitter:url');
    var fresh = ogFresh || twitterFresh;
    var title = '';
    if (fresh) {
      title =
        (twitterFresh && getMeta('twitter:title')) ||
        (ogFresh && getMeta('og:title')) ||
        document.title ||
        h1Title() ||
        '';
    }
    var metaArt = (twitterFresh && getMeta('twitter:image')) || (ogFresh && getMeta('og:image')) || '';
    var artwork = metaArt || detectors.deezerArtworkFor(entity);
    function firstPerformer(properties) {
      for (var i = 0; i < properties.length; i++) {
        var value = getMeta(properties[i]).trim();
        if (value && !/^https?:\/\/\S*$/i.test(value)) {
          return value;
        }
      }
      return '';
    }
    var twitterPerformer = twitterFresh
      ? firstPerformer(['twitter:audio:artist_name', 'twitter:creator', 'twitter:description'])
      : '';
    var ogPerformer = ogFresh ? firstPerformer(['music:musician', 'og:audio:artist', 'author']) : '';
    var performer = twitterPerformer || ogPerformer || '';
    function embeddedState() {
      try {
        var stateEl = document.getElementById('__DZR_APP_STATE__');
        var scripts = Array.prototype.slice.call(document.querySelectorAll('script'));
        if (stateEl) {
          scripts.unshift(stateEl);
        }
        for (var i = 0; i < scripts.length; i++) {
          var source = scripts[i].textContent || '';
          var assignment = source.match(
            /^\s*(?:(?:var|let|const)\s+|(?:window|globalThis)\.)?__DZR_APP_STATE__\s*=\s*([\s\S]*?)\s*;?\s*$/
          );
          var nodes;
          try {
            nodes = flatNodes(JSON.parse(assignment ? assignment[1] : source));
          } catch (e) {
            continue;
          }
          for (var j = 0; j < nodes.length; j++) {
            var node = nodes[j];
            var linked = detectors.parseDeezerUrl(node.link || node.url || '');
            if (!linked) {
              var type =
                node.SNG_ID != null
                  ? 'track'
                  : node.ALB_ID != null
                    ? 'album'
                    : node.PLAYLIST_ID != null
                      ? 'playlist'
                      : node.ART_ID != null
                        ? 'artist'
                        : node.type;
              var id =
                type === 'track'
                  ? node.SNG_ID
                  : type === 'album'
                    ? node.ALB_ID
                    : type === 'playlist'
                      ? node.PLAYLIST_ID
                      : type === 'artist'
                        ? node.ART_ID
                        : null;
              if (id == null) {
                id = node.id;
              }
              if (typeof id === 'string' || typeof id === 'number') {
                linked = detectors.parseDeezerUrl('https://www.deezer.com/' + type + '/' + id);
              }
            }
            if (sameEntity(linked, entity)) {
              return node;
            }
          }
        }
      } catch (e) {
        // ignore embedded state read errors
      }
      return {};
    }
    var state = fresh ? embeddedState() : {};
    function stateStr(key) {
      return typeof state[key] === 'string' ? state[key].trim() : '';
    }
    function stateNum(key) {
      var value = state[key];
      return (typeof value === 'number' || typeof value === 'string') && /^\d+$/.test(String(value))
        ? String(value)
        : '';
    }
    function stateArtists(max) {
      var out = [];
      var artists = [state.ART_NAME, state.artist].concat(Array.isArray(state.contributors) ? state.contributors : []);
      for (var i = 0; i < artists.length && out.length < max; i++) {
        var name = personName(artists[i]).trim();
        if (name && !/^https?:\/\//i.test(name) && out.indexOf(name) === -1) {
          out.push(name);
        }
      }
      return out.join(', ');
    }
    function grouped(value) {
      var n = Number(value);
      return isFinite(n) ? n.toLocaleString('en-US') : String(value);
    }
    function visibleFans() {
      try {
        var text = (document.body && document.body.innerText) || '';
        if (!text) {
          return '';
        }
        var m = text.match(/(\d[\d., \t ]*[KMB]?)\s+fans?\b/i); // class holds a literal NBSP
        if (m && m[1] && m[1].length <= 24) {
          return (m[1] + ' fans').replace(/\s+/g, ' ').trim();
        }
      } catch (e) {
        // ignore DOM read errors
      }
      return '';
    }
    function nestedName(objKey) {
      var name = personName(state[objKey]).trim();
      return name && !/^https?:\/\//i.test(name) ? name : '';
    }
    var subtitle;
    if (entity.type === 'artist') {
      var fans = stateNum('NB_FAN') || stateNum('nb_fan');
      subtitle = fans ? grouped(fans) + ' fans' : visibleFans();
    } else if (entity.type === 'album') {
      subtitle =
        performer ||
        stateArtists(3) ||
        stateStr('ARTIST_NAME') ||
        nestedName('artist') ||
        (ogFresh ? ogDescriptionArtist() : '') ||
        '';
    } else if (entity.type === 'playlist') {
      var ogDesc = '';
      if (ogFresh) {
        var rawDesc = getMeta('og:description') || '';
        if (rawDesc && rawDesc.length <= 80) {
          ogDesc = rawDesc;
        }
      }
      subtitle =
        performer ||
        stateStr('CREATOR_NAME') ||
        stateStr('PARENT_USERNAME') ||
        stateStr('AUTHOR_NAME') ||
        nestedName('creator') ||
        stateStr('ART_NAME') ||
        nestedName('artist') ||
        ogDesc ||
        '';
    } else {
      subtitle =
        performer || stateStr('ART_NAME') || nestedName('artist') || (ogFresh ? ogDescriptionArtist() : '') || '';
    }
    if (/^https?:\/\/\S*$/i.test(subtitle)) {
      subtitle = '';
    }
    if (!subtitle) {
      subtitle = fresh ? jsonLdArtistName(entity) : '';
    }
    if (/^https?:\/\/\S*$/i.test(subtitle)) {
      subtitle = '';
    }
    var explicitRaw = stateNum('EXPLICIT_LYRICS_STATUS');
    var explicit =
      entity.type === 'track' &&
      (typeof state.explicit_lyrics === 'boolean'
        ? state.explicit_lyrics
        : explicitRaw !== '' && Number(explicitRaw) > 0);
    var related = [];
    var dbgKeys = ['ART_NAME', 'ARTIST_NAME', 'CREATOR_NAME', 'PARENT_USERNAME', 'AUTHOR_NAME', 'NB_FAN']
      .filter(function (k) {
        return Object.prototype.hasOwnProperty.call(state, k);
      })
      .join('+');
    var nameKeys = Object.keys(state)
      .filter(function (key) {
        return /^[A-Z][A-Z0-9_]*NAME[A-Z0-9_]*$/.test(key) || key === 'NB_FAN';
      })
      .slice(0, 8);
    var ldCount = 0;
    try {
      ldCount = document.querySelectorAll('script[type="application/ld+json"]').length;
    } catch (e3) {
      // ignore
    }
    var dbg =
      'keys=' +
      (dbgKeys || 'none') +
      ' ld=' +
      ldCount +
      ' fresh=' +
      (fresh ? '1' : '0') +
      ' namekeys=' +
      (nameKeys.join('+') || 'none') +
      ' title=' +
      JSON.stringify(title.slice(0, 60));
    return {
      entity: entity,
      meta: { title: title, subtitle: subtitle, artwork: artwork, explicit: explicit },
      related: related,
      dbg: dbg,
      fresh: fresh
    };
  }
  function shouldShow(entity, settings) {
    if (!settings) {
      return true;
    }
    if (settings.providers && settings.providers.deezer === false) {
      return false;
    }
    if (settings.autoShow === false) {
      return false;
    }
    if (entity.type === 'track' && settings.showOnTrack === false) {
      return false;
    }
    if ((entity.type === 'album' || entity.type === 'playlist') && settings.showOnCollection === false) {
      return false;
    }
    if (entity.type === 'artist' && settings.showOnArtist === false) {
      return false;
    }
    return true;
  }
  function getSettings(done) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
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
  function mergeMetadata(base, hydrated) {
    var merged = {
      title: (base && base.title) || '',
      subtitle: (base && base.subtitle) || '',
      artwork: (base && base.artwork) || '',
      explicit: !!(base && base.explicit)
    };
    if (hydrated) {
      if (hydrated.title) {
        merged.title = hydrated.title;
      }
      if (hydrated.subtitle) {
        merged.subtitle = hydrated.subtitle;
      }
      if (hydrated.artwork) {
        merged.artwork = hydrated.artwork;
      }
      if (typeof hydrated.explicit === 'boolean') {
        merged.explicit = hydrated.explicit;
      }
    }
    return merged;
  }
  var hydrationAttachments = Object.create(null);
  var navigation = null;
  function entityKey(entity) {
    if (navigation && navigation.entityKey) {
      return navigation.entityKey(entity);
    }
    return entity && entity.provider + ':' + entity.type + ':' + String(entity.id || entity.url || '');
  }
  function navigationIsCurrent(entity, generation) {
    if (navigation && navigation.isCurrent && generation != null) {
      return navigation.isCurrent(entity, generation);
    }
    var current =
      window.RalgrumDetectors && window.RalgrumDetectors.parseDeezerUrl
        ? window.RalgrumDetectors.parseDeezerUrl(window.location.href)
        : null;
    return sameEntity(entity, current);
  }
  function domMetadataFor(found) {
    return found && found.fresh ? found.meta : { title: '', subtitle: '', artwork: '', explicit: false };
  }
  function showFound(found, generation) {
    if (!window.RalgrumToast) {
      return;
    }
    var requestEntity = found.entity;
    if (!navigationIsCurrent(requestEntity, generation)) {
      return;
    }
    var metadata = window.RalgrumDeezerMetadata;
    var cached = null;
    if (metadata && typeof metadata.peek === 'function') {
      try {
        cached = metadata.peek(requestEntity);
      } catch (e) {
        cached = null;
      }
    }
    if (cached) {
      window.RalgrumToast.showOncePerPage(requestEntity, mergeMetadata(domMetadataFor(found), cached), found.related);
      return;
    }
    if (found.fresh) {
      window.RalgrumToast.showOncePerPage(requestEntity, found.meta, found.related);
    }
    if (!metadata || typeof metadata.fetchFor !== 'function') {
      return;
    }
    var key = entityKey(requestEntity);
    var attached = hydrationAttachments[key];
    if (attached) {
      attached.generation = generation;
      return;
    }
    var pending;
    try {
      pending = metadata.fetchFor(requestEntity);
    } catch (e) {
      return;
    }
    var attachment = { generation: generation, promise: null };
    hydrationAttachments[key] = attachment;
    attachment.promise = Promise.resolve(pending).then(
      function (hydrated) {
        if (hydrationAttachments[key] === attachment) {
          delete hydrationAttachments[key];
        }
        if (!hydrated || !navigationIsCurrent(requestEntity, attachment.generation)) {
          return;
        }
        getSettings(function (settings) {
          if (!navigationIsCurrent(requestEntity, attachment.generation) || !shouldShow(requestEntity, settings)) {
            return;
          }
          var latestEntity =
            window.RalgrumDetectors && window.RalgrumDetectors.parseDeezerUrl
              ? window.RalgrumDetectors.parseDeezerUrl(window.location.href)
              : null;
          if (!sameEntity(requestEntity, latestEntity)) {
            return;
          }
          var latest = readPage(latestEntity);
          var latestBase = domMetadataFor(latest);
          window.RalgrumToast.showOncePerPage(
            requestEntity,
            mergeMetadata(latestBase, hydrated),
            latest ? latest.related : found.related
          );
        });
      },
      function () {
        if (hydrationAttachments[key] === attachment) {
          delete hydrationAttachments[key];
        }
      }
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
    if (!found.meta.subtitle) {
      debugNoSub(found.entity, found.dbg);
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
  var lastNoSubKey = '';
  function debugNoSub(entity, extra) {
    try {
      if (typeof console === 'undefined' || !console.debug) {
        return;
      }
      var k = entity.provider + ':' + entity.type + ':' + (entity.id || entity.url);
      if (k === lastNoSubKey) {
        return;
      }
      lastNoSubKey = k;
      console.debug(
        '[ralgrum] no subtitle extracted for ' + k + ' on ' + window.location.href + (extra ? ' (' + extra + ')' : '')
      );
    } catch (e) {
      // ignore logging errors
    }
  }
  function currentEntity() {
    var detectors = window.RalgrumDetectors;
    return detectors && detectors.parseDeezerUrl ? detectors.parseDeezerUrl(window.location.href) : null;
  }
  if (window.RalgrumSpaNavigation && window.RalgrumSpaNavigation.start) {
    navigation = window.RalgrumSpaNavigation.start({
      readEntity: currentEntity,
      onNavigate: function () {
        if (window.RalgrumToast) {
          window.RalgrumToast.resetForNavigation();
        }
      },
      onRefresh: maybeShow
    });
  } else {
    setTimeout(function () {
      maybeShow(currentEntity(), null);
    }, 600);
  }
})();

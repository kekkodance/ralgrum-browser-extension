// SoundCloud content script: detects track/playlist/artist and shows toast.
// Uses URL plus JSON-LD and meta tags, observes SPA navigation.
(function () {
  'use strict';
  function getMeta(prop) {
    var el = document.querySelector('meta[property="' + prop + '"]') || document.querySelector('meta[name="' + prop + '"]');
    return el ? (el.getAttribute('content') || '') : '';
  }
  function canonicalUrl() {
    var link = document.querySelector('link[rel="canonical"]');
    var href = link ? (link.getAttribute('href') || '') : '';
    return href || window.location.href;
  }
  function jsonLdNodes() {
    try {
      return Array.prototype.slice.call(document.querySelectorAll('script[type="application/ld+json"]'));
    } catch (e) {
      return [];
    }
  }
  function jsonLdEntity(pageUrl) {
    var scripts = jsonLdNodes();
    var detectors = window.RalgrumDetectors;
    for (var i = 0; i < scripts.length; i++) {
      try {
        var data = JSON.parse(scripts[i].textContent || 'null');
        var hit = detectors.parseSoundcloudFromJsonLd(data, pageUrl);
        if (hit) {
          return hit;
        }
      } catch (e) {
        // skip malformed block
      }
    }
    return null;
  }
  function followCountFromNode(node) {
    if (!node || typeof node !== 'object') {
      return 0;
    }
    var stats = node.interactionStatistic;
    var list = Array.isArray(stats) ? stats : [stats];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item || typeof item !== 'object') {
        continue;
      }
      var kind = String(item.interactionType || '');
      if (kind.toLowerCase().indexOf('follow') === -1) {
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
      if (typeof node === 'object') {
        out.push(node);
      }
    }
    return out;
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
  function samePage(a, b) {
    var x = String(a || '').replace(/\/+$/, '');
    var y = String(b || '').replace(/\/+$/, '');
    return x !== '' && x === y;
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
  function jsonLdArtistName(pageUrl) {
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
          if (pageUrl && nodePageUrl(node) && !samePage(nodePageUrl(node), pageUrl)) {
            continue;
          }
          var name = personName(node.byArtist) || personName(node.creator) || personName(node.author);
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
  function jsonLdFollowers(pageUrl) {
    var scripts = jsonLdNodes();
    for (var i = 0; i < scripts.length; i++) {
      try {
        var data = JSON.parse(scripts[i].textContent || 'null');
        var nodes = flatNodes(data);
        for (var j = 0; j < nodes.length; j++) {
          var node = nodes[j];
          var t = String(node['@type'] || '').toLowerCase();
          if (t !== 'musicgroup' && t !== 'person') {
            continue;
          }
          if (pageUrl && nodePageUrl(node) && !samePage(nodePageUrl(node), pageUrl)) {
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
  function hydrationFollowers() {
    var best = 0;
    try {
      var scripts = Array.prototype.slice.call(document.querySelectorAll('script:not([type])'));
      for (var i = 0; i < scripts.length; i++) {
        var text = scripts[i].textContent || '';
        if (text.indexOf('followers_count') === -1) {
          continue;
        }
        var re = /"followers_count"\s*:\s*(\d+)/g;
        var m = re.exec(text);
        while (m) {
          var n = Number(m[1]);
          if (n > best) {
            best = n;
          }
          m = re.exec(text);
        }
      }
    } catch (e) {
      // ignore
    }
    return best;
  }
  function pageExplicit() {
    try {
      var scripts = Array.prototype.slice.call(document.querySelectorAll('script:not([type])'));
      for (var i = 0; i < scripts.length; i++) {
        var text = scripts[i].textContent || '';
        if (/"is_explicit"\s*:\s*true/.test(text) || /"explicit"\s*:\s*true/.test(text)) {
          return true;
        }
      }
    } catch (e) {
      // ignore
    }
    return false;
  }
  function grouped(value) {
    return Number(value).toLocaleString('en-US');
  }
  function readPage() {
    var detectors = window.RalgrumDetectors;
    if (!detectors) {
      return null;
    }
    var pageUrl = canonicalUrl();
    var entity = jsonLdEntity(pageUrl) || detectors.parseSoundcloudUrl(pageUrl) || detectors.parseSoundcloudUrl(window.location.href);
    if (!entity) {
      return null;
    }
    if (!entity.url) {
      entity.url = pageUrl;
    }
    var title = getMeta('og:title') || getMeta('twitter:title') || document.title || '';
    var artwork = getMeta('og:image') || getMeta('twitter:image') || '';
    var audioArtist = getMeta('og:audio:artist') || '';
    var ldArtist = jsonLdArtistName(pageUrl);
    var subtitle = audioArtist || ldArtist;
    if (/^https?://S*$/i.test(subtitle)) {
      subtitle = ldArtist || '';
    }
    if (entity.type === 'artist') {
      var followers = jsonLdFollowers(pageUrl) || hydrationFollowers();
      subtitle = followers > 0 ? grouped(followers) + ' followers' : '';
    }
    var explicit = entity.type === 'track' && pageExplicit();
    return { entity: entity, meta: { title: title, subtitle: subtitle, artwork: artwork, explicit: explicit }, related: [] };
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
  function maybeShow() {
    var found = readPage();
    if (!found) {
      if (window.RalgrumToast) {
        window.RalgrumToast.dismiss();
      }
      return;
    }
    getSettings(function (settings) {
      if (!shouldShow(found.entity, settings)) {
        if (window.RalgrumToast) {
          window.RalgrumToast.dismiss();
        }
        return;
      }
      if (window.RalgrumToast) {
        window.RalgrumToast.showOncePerPage(found.entity, found.meta, found.related);
      }
    });
  }
  function watchNavigation() {
    var last = window.location.href;
    setInterval(function () {
      if (window.location.href !== last) {
        last = window.location.href;
        if (window.RalgrumToast) {
          window.RalgrumToast.resetForNavigation();
        }
        setTimeout(maybeShow, 1200);
      }
    }, 750);
    var origPush = history.pushState;
    history.pushState = function () {
      var r = origPush.apply(this, arguments);
      setTimeout(maybeShow, 1200);
      return r;
    };
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(maybeShow, 900);
    });
  } else {
    setTimeout(maybeShow, 900);
  }
  setTimeout(maybeShow, 3000);
  watchNavigation();
})();

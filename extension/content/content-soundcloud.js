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
  function jsonLdEntity(pageUrl) {
    try {
      var scripts = Array.prototype.slice.call(document.querySelectorAll('script[type="application/ld+json"]'));
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
    } catch (e) {
      // ignore
    }
    return null;
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
    var subtitle = audioArtist || pageUrl;
    return { entity: entity, meta: { title: title, subtitle: subtitle, artwork: artwork }, related: [] };
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

// Deezer content script: detects track/album/playlist/artist and shows toast.
// Runs at document_idle, observes SPA navigation, respects stored settings.
(function () {
  'use strict';
  function getMeta(prop) {
    var el = document.querySelector('meta[property="' + prop + '"]') || document.querySelector('meta[name="' + prop + '"]');
    return el ? (el.getAttribute('content') || '') : '';
  }
  function readPage() {
    var detectors = window.RalgrumDetectors;
    if (!detectors) {
      return null;
    }
    var entity = detectors.parseDeezerUrl(window.location.href);
    if (!entity) {
      return null;
    }
    var title = getMeta('og:title') || document.title || '';
    var artwork = getMeta('og:image') || detectors.deezerArtworkFor(entity);
    var performer = getMeta('music:musician') || getMeta('og:audio:artist') || '';
    var stateText = '';
    try {
      var stateEl = document.getElementById('__DZR_APP_STATE__');
      if (stateEl && stateEl.textContent) {
        stateText = stateEl.textContent;
      }
    } catch (e) {
      // ignore embedded state read errors
    }
    function stateStr(key) {
      var m = stateText.match(new RegExp('"' + key + '"\\s*:\\s*"([^"]{1,120})"'));
      return m ? m[1] : '';
    }
    function stateNum(key) {
      var m = stateText.match(new RegExp('"' + key + '"\\s*:\\s*(\\d+)'));
      return m ? m[1] : '';
    }
    function grouped(value) {
      var n = Number(value);
      return isFinite(n) ? n.toLocaleString('en-US') : String(value);
    }
    var subtitle;
    if (entity.type === 'artist') {
      var fans = stateNum('NB_FAN');
      subtitle = fans ? grouped(fans) + ' fans' : '';
    } else {
      subtitle = performer || stateStr('ART_NAME') || '';
    }
    var related = [];
    try {
      if (stateText && entity.type === 'track') {
        var m = stateText.match(/"ALB_ID"\s*:\s*"(\d+)"/);
        var t = stateText.match(/"ALB_TITLE"\s*:\s*"([^"]{1,120})"/);
        if (m && m[1] && m[1] !== '0') {
          related.push({
            provider: 'deezer',
            type: 'album',
            id: m[1],
            url: 'https://www.deezer.com/album/' + m[1],
            title: t ? t[1] : ('Album ' + m[1])
          });
        }
      }
    } catch (e) {
      // ignore embedded state parse errors
    }
    return { entity: entity, meta: { title: title, subtitle: subtitle, artwork: artwork }, related: related };
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
        setTimeout(maybeShow, 800);
      }
    }, 750);
    var origPush = history.pushState;
    history.pushState = function () {
      var r = origPush.apply(this, arguments);
      setTimeout(maybeShow, 800);
      return r;
    };
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(maybeShow, 600);
    });
  } else {
    setTimeout(maybeShow, 600);
  }
  setTimeout(maybeShow, 2500);
  watchNavigation();
})();

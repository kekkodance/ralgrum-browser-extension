// Options page logic with sync storage and local fallback.
(function () {
  'use strict';
  var DEFAULTS = {
    autoShow: true,
    showOnTrack: true,
    showOnCollection: true,
    showOnArtist: true,
    providers: { deezer: true, soundcloud: true }
  };
  function store() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        return chrome.storage.sync;
      }
      if (typeof browser !== 'undefined' && browser.storage && browser.storage.sync) {
        return browser.storage.sync;
      }
    } catch (e) {
      // ignore
    }
    return null;
  }
  function load(done) {
    var s = store();
    if (!s) {
      done(DEFAULTS);
      return;
    }
    s.get(null, function (items) {
      done({
        autoShow: items.autoShow !== undefined ? items.autoShow : DEFAULTS.autoShow,
        showOnTrack: items.showOnTrack !== undefined ? items.showOnTrack : DEFAULTS.showOnTrack,
        showOnCollection: items.showOnCollection !== undefined ? items.showOnCollection : DEFAULTS.showOnCollection,
        showOnArtist: items.showOnArtist !== undefined ? items.showOnArtist : DEFAULTS.showOnArtist,
        providers: items.providers || DEFAULTS.providers
      });
    });
  }
  document.addEventListener('DOMContentLoaded', function () {
    load(function (v) {
      document.getElementById('autoShow').checked = !!v.autoShow;
      document.getElementById('showOnTrack').checked = !!v.showOnTrack;
      document.getElementById('showOnCollection').checked = !!v.showOnCollection;
      document.getElementById('showOnArtist').checked = !!v.showOnArtist;
      document.getElementById('deezer').checked = v.providers.deezer !== false;
      document.getElementById('soundcloud').checked = v.providers.soundcloud !== false;
    });
    document.getElementById('save').addEventListener('click', function () {
      var value = {
        autoShow: document.getElementById('autoShow').checked,
        showOnTrack: document.getElementById('showOnTrack').checked,
        showOnCollection: document.getElementById('showOnCollection').checked,
        showOnArtist: document.getElementById('showOnArtist').checked,
        providers: {
          deezer: document.getElementById('deezer').checked,
          soundcloud: document.getElementById('soundcloud').checked
        }
      };
      var s = store();
      var status = document.getElementById('status');
      if (!s) {
        status.textContent = 'Storage unavailable, defaults will be used.';
        return;
      }
      s.set(value, function () {
        status.textContent = 'Saved.';
        setTimeout(function () { status.textContent = ''; }, 1500);
      });
    });
  });
})();

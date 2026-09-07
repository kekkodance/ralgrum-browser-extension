// Settings logic shared by the options page and the toolbar popup.
// Every toggle persists immediately, like update_draft_and_persist.
(function () {
  'use strict';
  var DEFAULTS = {
    autoShow: true,
    showOnTrack: true,
    showOnCollection: true,
    showOnArtist: true,
    providers: { deezer: true, soundcloud: true }
  };
  var IDS = ['autoShow', 'showOnTrack', 'showOnCollection', 'showOnArtist', 'deezer', 'soundcloud'];
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
  function readValues() {
    return {
      autoShow: document.getElementById('autoShow').checked,
      showOnTrack: document.getElementById('showOnTrack').checked,
      showOnCollection: document.getElementById('showOnCollection').checked,
      showOnArtist: document.getElementById('showOnArtist').checked,
      providers: {
        deezer: document.getElementById('deezer').checked,
        soundcloud: document.getElementById('soundcloud').checked
      }
    };
  }
  function applyValues(v) {
    document.getElementById('autoShow').checked = !!v.autoShow;
    document.getElementById('showOnTrack').checked = !!v.showOnTrack;
    document.getElementById('showOnCollection').checked = !!v.showOnCollection;
    document.getElementById('showOnArtist').checked = !!v.showOnArtist;
    document.getElementById('deezer').checked = v.providers.deezer !== false;
    document.getElementById('soundcloud').checked = v.providers.soundcloud !== false;
  }
  document.addEventListener('DOMContentLoaded', function () {
    var s = store();
    function persist() {
      if (s) {
        s.set(readValues());
      }
    }
    IDS.forEach(function (id) {
      document.getElementById(id).addEventListener('change', persist);
    });
    if (!s) {
      applyValues(DEFAULTS);
      return;
    }
    s.get(null, function (items) {
      applyValues({
        autoShow: items.autoShow !== undefined ? items.autoShow : DEFAULTS.autoShow,
        showOnTrack: items.showOnTrack !== undefined ? items.showOnTrack : DEFAULTS.showOnTrack,
        showOnCollection: items.showOnCollection !== undefined ? items.showOnCollection : DEFAULTS.showOnCollection,
        showOnArtist: items.showOnArtist !== undefined ? items.showOnArtist : DEFAULTS.showOnArtist,
        providers: items.providers || DEFAULTS.providers
      });
    });
  });
})();

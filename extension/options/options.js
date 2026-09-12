// Settings logic shared by the options page and the toolbar popup.
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

  function settingValue(settings, id) {
    var provider = id === 'deezer' || id === 'soundcloud';
    var source = provider ? settings.providers : settings;
    var fallback = provider ? DEFAULTS.providers[id] : DEFAULTS[id];
    return source && typeof source[id] === 'boolean' ? source[id] : fallback;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var api = null;
    var promiseApi = false;
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.sync) {
      api = browser;
      promiseApi = true;
    } else if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      api = chrome;
    }

    var loaded = false;
    var authoritative = {};
    var pending = {};
    var queue = [];
    var saving = false;
    var revision = 0;
    var changedAt = {};
    var controls = {};

    function render() {
      IDS.forEach(function (id) {
        controls[id].checked = pending[id] ? pending[id].value : authoritative[id];
        controls[id].disabled = !loaded;
      });
    }

    function callApi(owner, method, args) {
      if (promiseApi) {
        return Promise.resolve().then(function () {
          return owner[method].apply(owner, args);
        });
      }
      return new Promise(function (resolve, reject) {
        owner[method].apply(
          owner,
          args.concat(function (result) {
            var error = api.runtime && api.runtime.lastError;
            if (error) reject(new Error(error.message || 'Extension request failed'));
            else resolve(result);
          })
        );
      });
    }

    function applySnapshot(settings, startedAt) {
      IDS.forEach(function (id) {
        // A storage event received during this request is newer than its snapshot.
        if (changedAt[id] <= startedAt) {
          authoritative[id] = settingValue(settings || {}, id);
        }
      });
    }

    function refresh() {
      var startedAt = revision;
      return callApi(api.storage.sync, 'get', [null]).then(function (settings) {
        applySnapshot(settings, startedAt);
      });
    }

    async function saveQueuedChanges() {
      if (saving) return;
      saving = true;
      while (queue.length) {
        var change = queue[0];
        var startedAt = revision;
        try {
          var response = await callApi(api.runtime, 'sendMessage', [
            {
              type: 'RALGRUM_SET_SETTING',
              key: change.key,
              value: change.value
            }
          ]);
          if (!response || response.ok !== true || !response.settings) {
            throw new Error('Setting was not saved');
          }
          applySnapshot(response.settings, startedAt);
        } catch (error) {
          // Failed writes must not leave the optimistic checkbox as a saved value.
          try {
            await refresh();
          } catch (readError) {
            // Retain the last known authoritative values if storage is unavailable.
          }
        }
        queue.shift();
        if (pending[change.key] === change) delete pending[change.key];
        render();
      }
      saving = false;
    }

    IDS.forEach(function (id) {
      controls[id] = document.getElementById(id);
      authoritative[id] = settingValue(DEFAULTS, id);
      changedAt[id] = 0;
      controls[id].addEventListener('change', function () {
        if (!loaded) {
          render();
          return;
        }
        if (!api) {
          authoritative[id] = controls[id].checked;
          return;
        }
        var change = { key: id, value: controls[id].checked };
        pending[id] = change;
        queue.push(change);
        saveQueuedChanges();
      });
    });
    render();

    if (!api) {
      // Standalone previews are editable, but never attempt persistence.
      loaded = true;
      render();
      return;
    }

    api.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'sync') return;
      revision += 1;
      IDS.forEach(function (id) {
        var key = id === 'deezer' || id === 'soundcloud' ? 'providers' : id;
        if (!Object.prototype.hasOwnProperty.call(changes, key)) return;
        var settings = {};
        settings[key] = changes[key].newValue;
        authoritative[id] = settingValue(settings, id);
        changedAt[id] = revision;
      });
      render();
    });

    refresh().then(
      function () {
        loaded = true;
        render();
      },
      function () {
        // Keep controls disabled rather than offering writes against an unread store.
        render();
      }
    );
  });
})();

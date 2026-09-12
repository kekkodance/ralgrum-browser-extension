// Shared SPA route and metadata settling coordinator.
(function (root) {
  'use strict';

  var RETRY_DELAYS_MS = [0, 350, 900, 1800];
  var MUTATION_DEBOUNCE_MS = 500;
  var POLL_INTERVAL_MS = 1200;
  var state = null;

  function normalizedSoundcloudUrl(value) {
    try {
      var parsed = new URL(String(value || ''));
      if (parsed.protocol !== 'https:' || !/^(?:[a-z0-9-]+\.)*soundcloud\.com$/i.test(parsed.hostname)) {
        return '';
      }
      var path = parsed.pathname.replace(/\/+$/, '');
      return parsed.hostname.toLowerCase() + (path || '/');
    } catch (e) {
      return '';
    }
  }

  function entityKey(entity) {
    if (!entity || !entity.provider || !entity.type) {
      return '';
    }
    var provider = String(entity.provider).toLowerCase();
    var type = String(entity.type).toLowerCase();
    if (provider === 'deezer' && /^\d+$/.test(String(entity.id || ''))) {
      return provider + ':' + type + ':' + String(entity.id);
    }
    if (provider === 'soundcloud') {
      var soundcloudUrl = normalizedSoundcloudUrl(entity.url);
      return soundcloudUrl ? provider + ':' + type + ':' + soundcloudUrl : '';
    }
    if (entity.id != null && String(entity.id) !== '') {
      return provider + ':' + type + ':' + String(entity.id);
    }
    return (
      provider +
      ':' +
      type +
      ':' +
      String(entity.url || '')
        .split('#')[0]
        .split('?')[0]
        .replace(/\/+$/, '')
    );
  }

  function createState(options) {
    var historyObject = root.history || {};
    var listeners = root;
    var generation = 0;
    var lastKey = null;
    var lastHref = '';
    var refreshTimers = [];
    var mutationTimer = 0;
    var pollTimer = 0;
    var stopped = false;

    function currentHref() {
      try {
        return String((root.location && root.location.href) || '');
      } catch (e) {
        return '';
      }
    }

    function readEntity() {
      try {
        return typeof options.readEntity === 'function' ? options.readEntity() : null;
      } catch (e) {
        return null;
      }
    }

    function clearRefreshTimers() {
      for (var i = 0; i < refreshTimers.length; i++) {
        clearTimeout(refreshTimers[i]);
      }
      refreshTimers = [];
    }

    function currentForGeneration(entity, expectedGeneration) {
      if (stopped || generation !== expectedGeneration) {
        return false;
      }
      return entityKey(readEntity()) === entityKey(entity);
    }

    function refresh(expectedGeneration) {
      if (stopped || generation !== expectedGeneration) {
        return;
      }
      var entity = readEntity();
      var key = entityKey(entity);
      if (key !== lastKey) {
        routeChanged('refresh');
        return;
      }
      try {
        if (typeof options.onRefresh === 'function') {
          options.onRefresh(entity, expectedGeneration);
        }
      } catch (e) {
        // A provider refresh must not break route observation.
      }
    }

    function scheduleRefresh(expectedGeneration, delay) {
      var timer = setTimeout(function () {
        var index = refreshTimers.indexOf(timer);
        if (index >= 0) {
          refreshTimers.splice(index, 1);
        }
        refresh(expectedGeneration);
      }, delay);
      refreshTimers.push(timer);
    }

    function scheduleSettling(expectedGeneration) {
      clearRefreshTimers();
      for (var i = 0; i < RETRY_DELAYS_MS.length; i++) {
        scheduleRefresh(expectedGeneration, RETRY_DELAYS_MS[i]);
      }
    }

    function routeChanged(reason) {
      if (stopped) {
        return;
      }
      lastHref = currentHref();
      var entity = readEntity();
      var key = entityKey(entity);
      if (key !== lastKey) {
        generation++;
        clearRefreshTimers();
        lastKey = key;
        try {
          if (typeof options.onNavigate === 'function') {
            options.onNavigate(entity, generation, reason);
          }
        } catch (e) {
          // A provider navigation callback must not disable the coordinator.
        }
        scheduleSettling(generation);
        return;
      }
      scheduleRefresh(generation, 0);
    }

    function queueMutationRefresh() {
      if (mutationTimer) {
        return;
      }
      mutationTimer = setTimeout(function () {
        mutationTimer = 0;
        routeChanged('mutation');
      }, MUTATION_DEBOUNCE_MS);
    }

    function installHistoryHook(name) {
      var original = historyObject[name];
      if (typeof original !== 'function' || original.__ralgrumSpaNavigation) {
        return;
      }
      var wrapped = function () {
        var result = original.apply(this, arguments);
        routeChanged(name);
        return result;
      };
      wrapped.__ralgrumSpaNavigation = true;
      historyObject[name] = wrapped;
    }

    function install() {
      installHistoryHook('pushState');
      installHistoryHook('replaceState');
      if (typeof listeners.addEventListener === 'function') {
        listeners.addEventListener('popstate', function () {
          routeChanged('popstate');
        });
        listeners.addEventListener('hashchange', function () {
          routeChanged('hashchange');
        });
      }
      if (typeof root.MutationObserver === 'function' && root.document && root.document.documentElement) {
        try {
          var observer = new root.MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
              var target = mutations[i].target;
              if (target && target.nodeType !== 1) {
                target = target.parentElement;
              }
              if (target && target.closest && target.closest('.ralgrum-toast-host')) {
                continue;
              }
              queueMutationRefresh();
              return;
            }
          });
          observer.observe(root.document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
            attributeFilter: ['content', 'href', 'src']
          });
        } catch (e) {
          // The bounded route retries remain available without observation.
        }
      }
      pollTimer = setInterval(function () {
        var href = currentHref();
        if (href !== lastHref) {
          routeChanged('poll');
        }
      }, POLL_INTERVAL_MS);
      routeChanged('initial');
    }

    var api = {
      entityKey: entityKey,
      isCurrent: currentForGeneration,
      generation: function () {
        return generation;
      },
      refresh: function () {
        routeChanged('manual');
      }
    };
    install();
    return {
      api: api,
      stop: function () {
        stopped = true;
        clearRefreshTimers();
        if (mutationTimer) {
          clearTimeout(mutationTimer);
          mutationTimer = 0;
        }
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = 0;
        }
      }
    };
  }

  root.RalgrumSpaNavigation = {
    entityKey: entityKey,
    start: function (options) {
      if (!state) {
        state = createState(options || {});
      }
      return state.api;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

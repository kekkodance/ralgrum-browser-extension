// Dev-only metrics harness. Loads the popup or options page in an iframe
// (?page=popup|options), reads real computed styles, and exfils them via
// document.title for headless --dump-dom verification.
(function () {
  'use strict';
  var params = new URLSearchParams(location.search);
  var page = params.get('page') || 'popup';
  var src = page === 'options'
    ? '../../extension/options/options.html'
    : '../../extension/popup/popup.html?demo=1';
  var frame = document.createElement('iframe');
  frame.style.width = page === 'options' ? '620px' : '360px';
  frame.style.height = page === 'options' ? '900px' : '500px';
  frame.style.border = 'none';
  document.body.appendChild(frame);
  function css(el, props) {
    var out = {};
    if (!el) {
      return out;
    }
    var cs = getComputedStyle(el);
    props.forEach(function (p) {
      out[p] = cs[p];
    });
    return out;
  }
  function rect(el) {
    if (!el) {
      return null;
    }
    var r = el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }
  frame.addEventListener('load', function () {
    setTimeout(function () {
      var out = { page: page };
      try {
        var d = frame.contentDocument;
        if (page === 'popup') {
          var panel = d.querySelector('.panel');
          out.panel = css(panel, ['backgroundColor', 'borderColor', 'borderRadius', 'padding']);
          var title = d.querySelector('.title');
          out.title = css(title, ['fontSize', 'fontWeight', 'color']);
          var sub = d.querySelector('.sub');
          out.sub = css(sub, ['fontSize', 'color']);
          var primary = d.querySelector('.primary');
          out.primary = css(primary, ['backgroundColor', 'borderColor', 'borderRadius', 'fontSize', 'fontWeight']);
          out.primaryRect = rect(primary);
          var secondary = d.querySelector('.secondary');
          out.secondary = css(secondary, ['backgroundColor', 'borderColor', 'borderRadius', 'fontSize']);
          out.secondaryRect = rect(secondary);
          out.titleText = title.textContent;
          out.openText = primary.textContent;
        } else {
          out.bodyBg = css(d.body, ['backgroundColor']);
          var card = d.querySelector('.card');
          out.card = css(card, ['backgroundColor', 'borderColor', 'borderRadius']);
          var label = d.querySelector('.row-label');
          out.label = css(label, ['fontSize', 'color']);
          var desc = d.querySelector('.row-desc');
          out.desc = css(desc, ['fontSize', 'color']);
          var sw = d.querySelector('.switch');
          sw.style.transition = 'none';
          sw.checked = true;
          var swOn = css(sw, ['backgroundColor', 'borderColor', 'width', 'height']);
          sw.checked = false;
          var swOff = css(sw, ['backgroundColor']);
          out.switchOn = swOn;
          out.switchOff = swOff;
          var save = d.querySelector('button.primary');
          out.save = css(save, ['backgroundColor', 'borderColor', 'borderRadius', 'fontSize']);
          out.saveRect = rect(save);
        }
      } catch (e) {
        out.error = String(e);
      }
      document.title = 'METRICS:' + JSON.stringify(out);
    }, 700);
  });
  frame.src = src;
})();

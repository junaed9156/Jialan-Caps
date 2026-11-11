/* The normal URL always opens in English. Only an explicit ?lang=zh requests Chinese.
   Hide that page briefly until translation is ready, avoiding an English flash. */
(function () {
  var html = document.documentElement;
  // The inline illustration is already visible. Never blank the hero while WebGL loads.
  try {
    var q = new URLSearchParams(location.search).get('lang');
    if (q === 'zh') {
      html.classList.add('i18n-pending', 'lang-zh');
      html.lang = 'zh-CN';
      setTimeout(function () { html.classList.remove('i18n-pending'); }, 2500);
    }
  } catch (e) { /* storage unavailable: English */ }
})();

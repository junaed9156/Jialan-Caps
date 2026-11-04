/* The normal URL always opens in English. Only an explicit ?lang=zh requests Chinese.
   Hide that page briefly until translation is ready, avoiding an English flash. */
(function () {
  var html = document.documentElement;
  // Set before first paint: the illustrated fallback must not flash before WebGL.
  // If the entry module fails to load, still leave visitors a usable illustration.
  html.dataset.heroState = 'loading';
  setTimeout(function () {
    if (html.dataset.heroState === 'loading') html.dataset.heroState = 'fallback';
  }, 8000);
  try {
    var q = new URLSearchParams(location.search).get('lang');
    if (q === 'zh') {
      html.classList.add('i18n-pending', 'lang-zh');
      html.lang = 'zh-CN';
      setTimeout(function () { html.classList.remove('i18n-pending'); }, 2500);
    }
  } catch (e) { /* storage unavailable: English */ }
})();

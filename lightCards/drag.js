"use strict";
// Light Scene Cards：カードの一覧（ページ全体）をつかんでドラッグで動かす（離すと滑る。漫画の一覧と同じ）
//   suiteCore の drag.js の dragScroll を使う。読み込み順で後になるので、出来るまで待つ
//   カードとカードの間・カードの上でつかめる。少し動かしてから離した時は、その下のリンク・ボタンを押したことにしない
(function () {
  if (window.LightCards?.dragReady) return;
  let tries = 0;
  const start = () => {
    const ds = window.Suite?.dragScroll;
    if (!ds) return ++tries < 50 && setTimeout(start, 200);
    if (window.LightCards) window.LightCards.dragReady = true;
    ds(document, document.scrollingElement || document.documentElement, {
      filter: (e) => !!e.target.closest?.(".lc-card, .row:has(> .lc-card)") && !e.target.closest?.(".lc-check, .rating-stars, .star-rating, button, .lc-tagrow"),
    });
  };
  start();
})();

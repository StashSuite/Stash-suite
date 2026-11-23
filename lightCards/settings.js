"use strict";
// Light Scene Cards：設定（保存先は localStorage → Server Store が Stash サーバーへ同期する）
// ほかのファイル（card.js / toolbar.js）とは window.LightCards でつながる。
(function () {
  if (window.LightCards) return;
  const KEY = "lightCards.v1";
  // 表示する項目（設定パネルの並び順）
  const ITEMS = [
    ["code", "品番（表紙の左下）"],
    ["duration", "長さ（表紙の右下）"],
    ["studio", "スタジオ"],
    ["date", "発売日"],
    ["size", "容量"],
    ["resolution", "画質（1080p など）"],
    ["performers", "出演者"],
    ["male", "男性の出演者も出す"],
    ["rating", "評価（★）"],
    ["playCount", "再生回数"],
    ["oCount", "O回数"],
    ["tags", "タグ数"],
    ["tagChips", "タグの名前（横型の空いた所に）"],
    ["copies", "同じ作品の別ファイル数"],
    ["organized", "整理済みの印"],
    ["progress", "続きの位置（表紙の下の線）"],
  ];
  const DEFAULTS = {
    mode: "own", // own＝このカード／valkyr＝Valkyr Scene Cards を使う
    layout: "tall", // tall＝縦型（表紙が上）／side＝横型（表紙が左・情報が右）
    sideCover: "front", // 横型の表紙：front＝パッケージの表側だけ／full＝全体
    titleLines: 2,
    sizes: { tall: 300, side: 340, cover: 190 }, // 形ごとのカードの幅の目安（px）。一覧の上のスライダーで変える
    preview: true, // 表紙にマウスを乗せたらプレビュー
    previewMode: "video", // video＝プレビュー動画（無ければ場面送り）／scrub＝マウスの左右で場面送り／source＝元の動画で場面送り
    autoTour: true, // 場面送りでマウスを止めておくと、数か所を自動で再生
    autoTourDelay: 1, // マウスを止めてから自動で再生するまでの秒数（0〜2）
    show: {
      code: true,
      duration: true,
      studio: true,
      date: true,
      size: false,
      resolution: true,
      performers: true,
      male: false,
      rating: true,
      playCount: true,
      oCount: false,
      tags: true,
      tagChips: true,
      copies: true,
      organized: false,
      progress: true,
    },
  };
  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || "null");
      if (v && typeof v === "object") return { ...DEFAULTS, ...v, show: { ...DEFAULTS.show, ...(v.show || {}) } };
    } catch {}
    return structuredClone(DEFAULTS);
  }
  let state = load();
  const listeners = new Set();
  const store = {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch, show: { ...state.show, ...(patch.show || {}) } };
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch {}
      for (const fn of listeners) fn(state);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  // ほかのタブ・Server Store の書き戻しで変わった時も反映
  addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    state = load();
    for (const fn of listeners) fn(state);
  });
  const gql = (query, variables) =>
    fetch("/graphql", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, variables }) }).then((r) => r.json());
  // 大きさのスライダーの範囲（形ごと）
  const SIZE_RANGE = { tall: [200, 520], side: [260, 640], cover: [120, 340] };
  const sizeOf = (s, layout) => (s.sizes && s.sizes[layout]) || DEFAULTS.sizes[layout];
  window.LightCards = { store, ITEMS, DEFAULTS, gql, SIZE_RANGE, sizeOf };
})();

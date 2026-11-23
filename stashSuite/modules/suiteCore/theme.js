// Suite Core：見た目のテーマ（ページの背景）とカードのスキン
//   Suite.THEMES          … テーマの一覧（key・名前・背景）
//   Suite.setTheme(key)   … テーマを変える（localStorage "suite.theme"。Server Store がサーバーへ同期）
//   カードのスキンは Light Cards の設定（lightCards.v1 の skin）を <html data-lc-skin> に写す
// Liquid Glass は後ろの色がぼけて透けて初めてガラスに見えるので、テーマは色のある背景が中心
(function () {
  "use strict";
  const S = window.Suite;
  if (!S || S.THEMES) return;
  const KEY = "suite.theme";
  S.THEMES = [
    ["midnight", "ミッドナイト（標準）", "radial-gradient(900px 700px at 0% 10%, #3a6ea538, transparent 70%), radial-gradient(800px 600px at 100% 0%, #8a4fc22b, transparent 70%), radial-gradient(1000px 700px at 50% 100%, #c2456f1f, transparent 70%), #121820"],
    ["slate", "スレート", "linear-gradient(180deg, #1b222c 0%, #131820 100%)"],
    ["obsidian", "オブシディアン", "linear-gradient(180deg, #14161a 0%, #0b0d10 100%)"],
    ["ocean", "オーシャン", "radial-gradient(80% 70% at 15% 10%, #2b6cb055 0%, transparent 65%), linear-gradient(180deg, #102033 0%, #0a121d 100%)"],
    ["mono", "モノクロ", "linear-gradient(180deg, #1c2128 0%, #111418 100%)"],
    ["violet", "バイオレット", "radial-gradient(70% 60% at 20% 10%, #8f6bff99 0%, transparent 60%), radial-gradient(70% 70% at 90% 60%, #3fa0ff80 0%, transparent 60%), linear-gradient(180deg, #241d4d 0%, #12112b 60%, #0b0a1a 100%)"],
    ["forest", "フォレスト", "radial-gradient(70% 60% at 10% 20%, #2fd6a388 0%, transparent 60%), radial-gradient(70% 70% at 100% 30%, #2f9fd677 0%, transparent 60%), linear-gradient(180deg, #0f3332 0%, #0b1d22 60%, #070f12 100%)"],
    ["rose", "ローズ", "radial-gradient(70% 60% at 85% 10%, #ffc2d688 0%, transparent 60%), radial-gradient(80% 70% at 0% 70%, #c2456f99 0%, transparent 65%), linear-gradient(180deg, #421b2e 0%, #23101b 60%, #12080e 100%)"],
    ["sunset", "サンセット", "radial-gradient(80% 70% at 100% 0%, #ffb35caa 0%, transparent 60%), radial-gradient(80% 80% at 0% 40%, #e2457aaa 0%, transparent 65%), linear-gradient(180deg, #4f2573 0%, #261742 60%, #120c1c 100%)"],
    ["aqua", "ピンク×シアン", "radial-gradient(90% 70% at 0% 58%, #ff5f8fe6 0%, #ff5f8f00 62%), linear-gradient(180deg, #0ed2e6 0%, #22b8dc 28%, #3f86c8 55%, #27315a 80%, #120c18 100%)"],
  ];
  const get = () => {
    const v = localStorage.getItem(KEY);
    return S.THEMES.some((t) => t[0] === v) ? v : "midnight";
  };
  function apply() {
    const key = get(),
      t = S.THEMES.find((x) => x[0] === key);
    document.documentElement.dataset.suiteTheme = key;
    S.css("suite-theme", `html[data-suite-theme] body{background:${t[2]} !important;background-attachment:fixed !important;}`);
  }
  S.setTheme = (key) => {
    try {
      localStorage.setItem(KEY, key);
    } catch {}
    apply();
  };
  S.getTheme = get;
  apply();

  // カードのスキン（Light Cards の設定の skin）を <html> に写す。設定が変わったら追いかける
  function syncSkin() {
    const LC = window.LightCards;
    const skin = LC?.store?.get().skin || "glass";
    if (document.documentElement.dataset.lcSkin !== skin) document.documentElement.dataset.lcSkin = skin;
  }
  syncSkin();
  addEventListener("storage", (e) => {
    if (e.key === KEY) apply();
    if (!e.key || e.key === "lightCards.v1") syncSkin();
  });
  // Light Cards は Suite Core の後に読み込まれるので、来たら購読する
  const wait = setInterval(() => {
    if (!window.LightCards?.store) return;
    clearInterval(wait);
    window.LightCards.store.subscribe(syncSkin);
    syncSkin();
  }, 300);
  setTimeout(() => clearInterval(wait), 15000);
})();

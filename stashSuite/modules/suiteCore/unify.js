// Suite Core：Stash Suiteの見た目をそろえる
//   出演者は丸（999px）、タグは四角（4px）、スタジオはその間（6px）で見分ける
//   ボタンは角 6px・選んでいる物だけ青、表紙の上の札は同じ黒の半透明・角 6px
//   星の黄色・まとめの札の青・レアリティの光は変えない
(function () {
  "use strict";
  const S = window.Suite;
  if (!S?.css) return;
  S.css(
    "suite-unify",
    `
/* 出演者：丸 */
.lc-card a.vsc-performer, #sp22 a.chip.performer { border-radius: 999px !important; }
/* タグ：四角 */
.lc-tagchip, #sp22 a.chip.tag {
  border-radius: 4px !important; background: var(--suite-raise) !important; color: #cfd8e3 !important;
  font-size: var(--suite-font-sm) !important; padding: 0 8px !important; height: 20px; line-height: 20px !important;
}
.lc-tagchip::before { content: none !important; }
/* スタジオ：その間 */
#sp22 a.chip.studio { border-radius: var(--suite-radius) !important; }

/* ボタン：角 6px、選んでいる物だけ青で塗る */
.qg-sort { border-radius: var(--suite-radius) !important; background: var(--suite-raise) !important; border-color: var(--suite-line) !important; }
.qg-sort.active { background: var(--suite-accent) !important; border-color: var(--suite-accent) !important; color: #fff !important; }
.qb-add, .qb-type { border-radius: var(--suite-radius) !important; background: var(--suite-raise) !important; border: 1px solid var(--suite-line) !important; }
.qb-type.on { background: var(--suite-accent) !important; border-color: var(--suite-accent) !important; color: #fff !important; }
/* 操作の札（まとめる など）：枠と文字だけ青 */
.qb-bundle-add { border-radius: var(--suite-radius-pill) !important; border-color: var(--suite-accent) !important; color: var(--suite-link) !important; }

/* 表紙の上の札：同じ黒の半透明・角 6px・同じ大きさ */
.lc-duration, .lc-scrape, .lc-cover-rate.corner .lc-rate, .lc-cover .sp22-card-watch {
  background: var(--suite-badge-bg) !important; border-radius: var(--suite-radius) !important; border: 0 !important;
}
.lc-duration { font-size: var(--suite-font-sm) !important; padding: 2px 6px !important; }
.lc-cover .sp22-card-watch { width: 28px !important; height: 28px !important; top: 6px !important; right: 6px !important; }
.lc-scrape { right: 40px !important; }
.lc-bundle { border-radius: var(--suite-radius) !important; background: var(--suite-accent) !important; }
`,
  );
})();

// ボタン扱いのリンクにマウスを乗せても、画面の左下に URL を出さない
// 乗せた時に href を外して data-suite-href に移す。押した時の動き（絞り込み・カードを開く）は各プラグインの処理のまま。
// 各プラグインの処理が画面を移さなかった時だけ、ここで data-suite-href へ移る
(function () {
  "use strict";
  const S = window.Suite;
  if (!S) return;
  const readSuitePref = (k, def) => {
    try {
      const o = JSON.parse(localStorage.getItem("suite.prefs") || "{}");
      return k in o ? o[k] : def;
    } catch {
      return def;
    }
  };
  const SEL = ".lc-card a.vsc-performer, .lc-tagchip, a.lc-studio, a.lc-bundle, #sp22 a.chip, .qb-item, .lc-pop a";
  document.addEventListener(
    "mouseover",
    (e) => {
      if (!readSuitePref("hideLinkUrl", false)) return;
      const a = e.target.closest?.(SEL);
      if (a && a.tagName === "A" && a.hasAttribute("href")) {
        a.dataset.suiteHref = a.getAttribute("href");
        a.removeAttribute("href");
      }
    },
    true,
  );
  // マウスが離れたら href を戻す（ほかのプラグインが a[href*="/performers/"] などで探すため）
  document.addEventListener(
    "mouseout",
    (e) => {
      const a = e.target.closest?.("a[data-suite-href]");
      if (a && !a.hasAttribute("href") && !a.contains(e.relatedTarget)) a.setAttribute("href", a.dataset.suiteHref);
    },
    true,
  );
  document.addEventListener("click", (e) => {
    const a = e.target.closest?.("a[data-suite-href]");
    if (!a || a.hasAttribute("href") || e.defaultPrevented) return;
    const before = location.href;
    setTimeout(() => {
      if (location.href === before) S.navigate(a.dataset.suiteHref);
    }, 0);
  });
  // 中ボタン・Ctrl＋クリックで新しいタブに開けるように
  document.addEventListener(
    "auxclick",
    (e) => {
      const a = e.target.closest?.("a[data-suite-href]");
      if (a && e.button === 1) window.open(a.dataset.suiteHref, "_blank");
    },
    true,
  );
  S.css("suite-nohref", "a[data-suite-href]{cursor:pointer}");
})();

// 作品のページ（/scenes/番号）を開いたら、「詳細」ではなく最初から「編集」のタブにする
// 同じ作品の中でほかのタブに移った時は、そのまま（開いた時に1回だけ）
(function () {
  "use strict";
  let opened = "";
  const check = () => {
    try { if (!JSON.parse(localStorage.getItem("suite.prefs") || "{}").autoEditTab) return; } catch { return; }
    const m = location.pathname.match(/^\/scenes\/(\d+)\/?$/);
    if (!m) return (opened = "");
    if (opened === m[1]) return;
    const tab = document.querySelector('a[data-rb-event-key="scene-edit-panel"]');
    if (!tab) return;
    opened = m[1];
    if (tab.getAttribute("aria-selected") !== "true") tab.click();
  };
  new MutationObserver(check).observe(document.documentElement, { childList: true, subtree: true });
})();

// 外部プレイヤーで開く（.m3u）＋ カードクリック時の動作切替
(function () {
  "use strict";
  const S = window.Suite;
  if (!S || S.openExternal) return;
  S.openExternal = async (id, title) => {
    if (!id) return;
    S.recordOpen?.(id);
    // ローカル環境では Stash サーバー経由で OS 既定の動画プレイヤーを直接起動（ダウンロード不要）
    const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname);
    if (isLocal) {
      try {
        const d = await S.gql('mutation($a:Map){runPluginOperation(plugin_id:"stashSuite",args:$a)}', { a: { mode: "open_external", id: String(id) } });
        if (d?.runPluginOperation === "ok") return;
      } catch {}
    }
    // リモート環境または Python 未導入時は .m3u にフォールバック
    const safeTitle = String(title || "scene-" + id).replace(/[\r\n]+/g, " ").trim();
    const url = location.origin + "/scene/" + encodeURIComponent(id) + "/stream";
    const m3u = "#EXTM3U\r\n#EXTINF:-1," + safeTitle + "\r\n" + url + "\r\n";
    const blob = new Blob([m3u], { type: "audio/x-mpegurl" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "stash-scene-" + id + ".m3u";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  window.addEventListener(
    "click",
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || !(e.target instanceof Element)) return;
      let act = "";
      try { act = JSON.parse(localStorage.getItem("suite.prefs") || "{}").cardClickAction || ""; } catch {}
      if (act !== "external") return;
      if (S.dragEndAt && performance.now() - S.dragEndAt < 400) return;
      if (e.target.closest("#sp22,#sp22-tags,#sp22-scrape,#sp22-tagadd,#twr-mini-tag-popover,button,input,select,textarea,.lc-rate,.lc-cover-rate,.lc-bundle,.lc-tagrow,.vsc-performer,.lc-studio,.gp-root,.gp-pill")) return;
      const card = e.target.closest(".lc-card, .scene-card, .wall-item");
      if (!card) return;
      const a = card.querySelector('a[href*="/scenes/"], a[data-suite-href*="/scenes/"]');
      const href = a?.getAttribute("href") || a?.dataset?.suiteHref || "";
      const m = href.match(/\/scenes\/(\d+)/);
      if (!m) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const title = card.querySelector(".lc-title, .card-section-title, h5")?.textContent?.trim() || "";
      S.openExternal(m[1], title);
    },
    true,
  );
})();

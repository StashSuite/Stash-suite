// Suite Core：Stash Suiteの設定を1つの画面にまとめる
// 上のメニューの「設定」から開く。各プラグインの設定の保存先（localStorage → Server Store がサーバーへ同期）をそのまま読み書きする。
//   カード（Light Cards）… その場で反映
//   レアリティ・表示モード … 保存すると再読み込み（読み込み時にしか設定を読まないプラグインのため）
//   おすすめ順 … その場で反映（タグの好みの細かい編集は、おすすめ順の画面を開く）
//   まとめ・自動整理 … 整備ハブのサーバー側の処理を呼ぶ
(function () {
  "use strict";
  const S = window.Suite;
  if (!S || S.settingsLoaded) return;
  S.settingsLoaded = true;
  const el = S.el;
  const readJSON = (k, d) => {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? d;
    } catch {
      return d;
    }
  };
  const writeJSON = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
    // 同じタブの中の変更は storage が届かないので、聞いているプラグインに知らせる
    window.dispatchEvent(new StorageEvent("storage", { key: k }));
  };

  // ---- 部品 ----
  function row(label, control, hint) {
    const r = el("div", "ss-row");
    const l = el("div", "ss-label", label);
    if (hint) l.append(el("small", null, hint));
    r.append(l, control);
    return r;
  }
  function choice(options, value, onChange) {
    const box = el("div", "ss-choice");
    for (const [v, label] of options) {
      const b = el("button", "ss-opt" + (String(v) === String(value) ? " on" : ""), label);
      b.type = "button";
      b.onclick = () => {
        box.querySelectorAll(".ss-opt").forEach((x) => x.classList.toggle("on", x === b));
        onChange(v);
      };
      box.append(b);
    }
    return box;
  }
  function toggle(value, onChange) {
    return choice([[true, "オン"], [false, "オフ"]], !!value, (v) => onChange(v === true || v === "true"));
  }
  function section(title, note) {
    const s = el("section", "ss-section");
    s.append(el("h3", null, title));
    if (note) s.append(el("p", "ss-note", note));
    return s;
  }
  function button(label, onClick, primary) {
    const b = el("button", "ss-btn" + (primary ? " primary" : ""), label);
    b.type = "button";
    b.onclick = onClick;
    return b;
  }
  let needReload = false;
  function markReload() {
    needReload = true;
    panel.querySelector(".ss-reload").hidden = false;
  }

  // ---- 各プラグインの設定 ----
  function cards() {
    const LC = window.LightCards;
    const s = section("カード（Light Scene Cards）", "シーン一覧のカード。その場で反映されます。");
    if (!LC) return s.append(el("p", "ss-note", "Light Scene Cards が動いていません。")), s;
    const st = LC.store.get(),
      set = (p) => LC.store.set(p);
    s.append(
      row("カードの形", choice([["tall", "縦型"], ["side", "横型"], ["cover", "表紙だけ"]], st.layout, (v) => set({ layout: v }))),
      row("題名の行数", choice([[1, "1行"], [2, "2行"], [3, "3行"]], st.titleLines, (v) => set({ titleLines: Number(v) }))),
      row("表紙にマウスを乗せたらプレビュー", toggle(st.preview, (v) => set({ preview: v }))),
      row("プレビューの種類", choice([["video", "プレビュー動画"], ["scrub", "場面送り"], ["source", "元の動画で場面送り"]], st.previewMode, (v) => set({ previewMode: v }))),
      row("止めておくと数か所を自動再生", toggle(st.autoTour, (v) => set({ autoTour: v }))),
      row("自動再生までの秒数", choice([0, 0.3, 0.5, 0.8, 1, 1.5, 2].map((n) => [n, n + "秒"]), st.autoTourDelay, (v) => set({ autoTourDelay: Number(v) }))),
    );
    const grid = el("div", "ss-checks");
    for (const [key, label] of LC.ITEMS) {
      const l = el("label", "ss-check");
      const c = el("input");
      c.type = "checkbox";
      c.checked = !!st.show[key];
      c.onchange = () => set({ show: { [key]: c.checked } });
      l.append(c, document.createTextNode(label));
      grid.append(l);
    }
    const presets = el("div", "ss-inline");
    presets.style.marginBottom = "6px";
    const applyShow = (map) => {
      set({ show: map });
      grid.querySelectorAll("input[type=checkbox]").forEach((cb, idx) => {
        const key = LC.ITEMS[idx]?.[0];
        if (key && key in map) cb.checked = !!map[key];
      });
    };
    const simpleKeys = new Set(["code", "duration", "performers", "rating", "progress"]);
    presets.append(
      button("シンプル", () => applyShow(Object.fromEntries(LC.ITEMS.map(([k]) => [k, simpleKeys.has(k)])))),
      button("標準", () => applyShow({ ...LC.DEFAULTS.show })),
      button("全部表示", () => applyShow(Object.fromEntries(LC.ITEMS.map(([k]) => [k, true])))),
    );
    const showWrap = el("div");
    showWrap.append(presets, grid);
    s.append(row("カードに出す項目", showWrap));
    return s;
  }

  // 見た目：ページの背景のテーマ・カードのスキン・Light Scene Cards のオンオフ
  function look() {
    const s = section("見た目", "背景のテーマとカードの見た目。その場で反映されます。");
    const box = el("div", "ss-themes");
    for (const [key, name, bg] of S.THEMES || []) {
      const b = el("button", "ss-theme" + (S.getTheme?.() === key ? " on" : ""));
      b.type = "button";
      const sw = el("i");
      sw.style.background = bg;
      b.append(sw, document.createTextNode(name));
      b.onclick = () => {
        S.setTheme(key);
        box.querySelectorAll(".ss-theme").forEach((x) => x.classList.toggle("on", x === b));
      };
      box.append(b);
    }
    if (S.LANGS) s.append(row("言語 / Language", choice(S.LANGS, S.getLangSetting?.() || "auto", (v) => S.setLang?.(v)), "ブラウザの言語に合わせて自動で切り替えます"));
    s.append(row("背景のテーマ", box));
    const LC = window.LightCards;
    if (LC) {
      const st = LC.store.get(),
        set = (p) => LC.store.set(p);
      s.append(
        row(
          "カードのスキン",
          choice(
            [["glass", "ガラス（表紙の色）"], ["clear", "クリア（透明）"], ["frost", "フロスト（白）"], ["vivid", "ビビッド"], ["solid", "ガラスなし（軽い）"]],
            st.skin || "glass",
            (v) => set({ skin: v }),
          ),
          "クリア・フロストは背景が透けて一番ガラスらしいが、カードが多いと少し重い",
        ),
        row("Light Scene Cards", choice([["own", "使う"], ["off", "使わない（Stash 標準のカード）"]], st.mode === "own" ? "own" : "off", (v) => set({ mode: v })), "切り替えたら一覧を開き直す"),
      );
    }
    return s;
  }

  function rarity() {
    if (!window.__sceneCardRarity && !document.getElementById("scr-launch")) return null;
    const KEY = "stash.cardRarity.v1";
    const s = section("レアリティ（カードの演出）", "評価で光り方が変わる演出。保存すると再読み込みします。");
    const v = { sceneEnabled: true, actorsEnabled: true, actorScope: "female", showUnratedActors: false, theme: "prism", intensity: "normal", motion: "top", dimLow: true, respectReducedMotion: false, ...readJSON(KEY, {}) };
    const set = (p) => {
      Object.assign(v, p);
      writeJSON(KEY, v);
      markReload();
    };
    s.append(
      row("シーンカードを光らせる", toggle(v.sceneEnabled, (x) => set({ sceneEnabled: x }))),
      row("テーマ", choice([["prism", "プリズム"], ["holo", "ホロカード"], ["neon", "ネオン"], ["jewel", "ジュエリー"], ["aurora", "オーロラ"], ["minimal", "ミニマル"]], v.theme, (x) => set({ theme: x }))),
      row("強さ", choice([["low", "弱"], ["normal", "標準"], ["high", "強"], ["max", "最大"]], v.intensity, (x) => set({ intensity: x }))),
      row("動き", choice([["off", "動かさない"], ["top", "★5だけ"], ["high", "★4以上"], ["hover", "マウスを乗せた時だけ"]], v.motion, (x) => set({ motion: x }))),
      row("★1を暗くする", toggle(v.dimLow, (x) => set({ dimLow: x }))),
      row("動きを減らす設定に従う", toggle(v.respectReducedMotion, (x) => set({ respectReducedMotion: x })), "パソコンの「視差効果を減らす」"),
      row("出演者名を評価で色分け", toggle(v.actorsEnabled, (x) => set({ actorsEnabled: x }))),
      row("色分けする出演者", choice([["female", "女性だけ"], ["female_unknown", "女性＋性別なし"], ["all", "全員"]], v.actorScope, (x) => set({ actorScope: x }))),
      row("未評価の出演者も色分け", toggle(v.showUnratedActors, (x) => set({ showUnratedActors: x }))),
    );
    return s;
  }

  function recommend() {
    if (!window.StashTagWeightedRecommendations) return null;
    const KEY = "stash.tagWeightedRecommendations.v1";
    const s = section("おすすめ順", "「好きなタグの重み ＋ 好きな出演者 ＋ 動画の評価 ＋ 未視聴・新着ボーナス」で採点し、同じ出演者が連続しないようバラけさせて並べます。おすすめボタンをもう一度押すと顔ぶれを入れ替えられます。");
    const data = readJSON(KEY, null);
    const prof = data?.profiles?.find((p) => p.id === data.activeId) || data?.profiles?.[0];
    if (!prof) return s.append(el("p", "ss-note", "おすすめ順の設定がまだありません。")), s;
    const set = (p) => {
      Object.assign(prof, p);
      writeJSON(KEY, data);
    };
    s.append(
      row("好みに合うタグの加点", choice([[0, "なし"], [1, "少し"], [2, "多め"]], prof.bonus ?? 1, (x) => set({ bonus: Number(x) }))),
      row("好きなタグだけで並べる", toggle(prof.positiveOnly !== false, (x) => set({ positiveOnly: x })), "マイナスの好みを使わない"),
      row("まだ見ていない作品だけ", toggle(prof.unplayedOnly === true, (x) => set({ unplayedOnly: x }))),
      row("評価がこれ以上の作品", choice([[0, "全部"], [40, "★2以上"], [60, "★3以上"], [80, "★4以上"]], prof.minRating || 0, (x) => set({ minRating: Number(x) }))),
      row("出演者の重み", choice([[0, "使わない"], [1.5, "少し"], [3, "標準"], [5, "強く"]], prof.actorCap ?? 3, (x) => set({ actorCap: Number(x) }))),
      row("顔ぶれの入れ替わり", choice([[0, "固定"], [1, "控えめ"], [2.5, "標準"], [5, "よく変わる"]], prof.jitterScale ?? 2.5, (x) => set({ jitterScale: Number(x) })), "高スコア帯の中で毎回違う掘り出し物を出しやすくします"),
      row("タグの好み（" + (prof.rules?.length || 0) + "個）", button("好みを編集する", () => window.StashTagWeightedRecommendations?.open?.())),
    );
    return s;
  }

  function display() {
    if (!window.__quickGenres) return null;
    const s = section("表示", "一覧の表示のしかた。");
    const mode = readJSON("viewMode.mode", "all");
    s.append(
      row(
        "顔の帯に出す人",
        choice([["mix", "ミックス"], ["page", "この一覧"], ["new", "新着"], ["rated", "評価順"]], readJSON("quickGenres.bandMode", "mix"), (x) => {
          try {
            localStorage.setItem("quickGenres.bandMode", x);
          } catch {}
          markReload();
        }),
      ),
    );
    return s;
  }

  function hub() {
    if (!window.__libraryHubLoaded) return null;
    const s = section("まとめ・自動整理（整備ハブ）", "サーバー側で動く処理です。");
    const op = (args, msg, out) => async () => {
      out.textContent = msg + "…";
      try {
        const d = await S.gql('mutation($a:Map){runPluginOperation(plugin_id:"libraryHub",args:$a)}', { a: args });
        const r = d.runPluginOperation;
        out.textContent = typeof r === "string" ? r : "済みました";
      } catch (e) {
        out.textContent = "失敗：" + e.message;
      }
    };
    const out1 = el("span", "ss-out"),
      out2 = el("span", "ss-out");
    const b1 = el("div", "ss-inline");
    b1.append(button("今すぐ自動整理", op({ mode: "auto_now" }, "始めています", out1)), out1);
    const b2 = el("div", "ss-inline");
    b2.append(button("まとめを付け直す", op({ mode: "bundles" }, "付け直しています", out2)), out2);
    s.append(
      row("新しい動画の自動整理", b1, "ふだんは取り込みの10分後に自動で動きます"),
      row("まとめ", b2, "まとめの追加・並べ替え・削除は、左パネルのお気に入りの「まとめ」で"),
    );
    fetch("/plugin/libraryHub/assets/auto_state.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((st) => {
        if (st.last_done) out1.textContent = "前回：" + st.last_done.replace("T", " ").slice(0, 16);
      })
      .catch(() => {});
    return s;
  }

  function player() {
    if (!window.__stashMiniPlayerBooted) return null;
    const s = section("ミニプレイヤー");
    const smooth = readJSON("stashMiniPlayer.smoothScenes", []);
    const out = el("span", "ss-out", smooth.length + "本");
    const box = el("div", "ss-inline");
    box.append(
      out,
      button("一覧を空にする", () => {
        writeJSON("stashMiniPlayer.smoothScenes", []);
        out.textContent = "0本";
      }),
    );
    s.append(row("「滑らか」で再生する動画", box, "ミニプレイヤーの「滑らか」ボタンで足し外しします"));
    return s;
  }

  function behavior() {
    const KEY = "suite.prefs";
    const s = section("操作・詳細", "好みに合わせてオン・オフを切り替えられます。");
    const v = { autoEditTab: false, hideLinkUrl: false, gridPlayerEnabled: true, ...readJSON(KEY, {}) };
    const set = (p) => {
      Object.assign(v, p);
      writeJSON(KEY, v);
    };
    const hasMini = !!window.__stashMiniPlayerBooted;
    const defaultAct = hasMini ? "mini" : "stash";
    const actOpts = hasMini
      ? [["mini", "ミニプレイヤー"], ["stash", "Stash 標準ページ"], ["external", "外部プレイヤー"]]
      : [["stash", "Stash 標準ページ"], ["external", "外部プレイヤー"]];
    const curAct = actOpts.some(([k]) => k === v.cardClickAction) ? v.cardClickAction : defaultAct;
    s.append(
      row("カードをクリックした時の動作", choice(actOpts, curAct, (x) => set({ cardClickAction: x })), "外部プレイヤーはローカル環境でOS既定の動画プレイヤーを直接起動します（別PC・Python未導入時は .m3u で開きます）"),
      row("動画ページを最初から「編集」タブで開く", toggle(v.autoEditTab, (x) => set({ autoEditTab: x })), "オフの時は Stash 標準どおり詳細タブを開きます"),
      row("リンクホバー時の左下URL表示を隠す", toggle(v.hideLinkUrl, (x) => set({ hideLinkUrl: x })), "オンにすると右クリックの「新しいタブで開く」等は使えなくなります"),
    );
    if (window.__quickGenres) {
      s.append(row("右上の「女優 ▸」パネルボタンを表示", toggle(v.actressPanelButton !== false, (x) => set({ actressPanelButton: x })), "オフにすると女優パネルの入口を隠します"));
    }
    if (window.ViewMode) {
      s.append(row("女／男モード切替（View Mode）を使う", toggle(v.viewModeEnabled === true, (x) => { set({ viewModeEnabled: x }); markReload(); }), "オンにすると上部に「女｜男｜両方」の切替ボタンを表示します（保存後に再読み込み）"));
    }
    return s;
  }

  function gridPlayerSec() {
    if (!window.GridPlayer) return null;
    const KEY = "suite.prefs";
    const s = section("複数再生（Grid Player）", "カードを Shift＋クリックすると最大9画面まで並べて同時再生します（音はクリックした窓だけ）。");
    const v = { gridPlayerEnabled: true, ...readJSON(KEY, {}) };
    const set = (p) => {
      Object.assign(v, p);
      writeJSON(KEY, v);
    };
    s.append(row("Shift＋クリックで複数再生を使う", toggle(v.gridPlayerEnabled !== false, (x) => set({ gridPlayerEnabled: x }))));
    return s;
  }

  // ---- 画面 ----
  const panel = el("div", "ss-panel");
  panel.hidden = true;
  let activeTab = "look";
  function open() {
    needReload = false;
    const groups = [
      ["look", "見た目・カード", [look, cards]],
      ["ops", "操作・表示", [behavior, display, gridPlayerSec]],
      ["fx", "演出・おすすめ", [rarity, recommend]],
      ["tools", "プレイヤー・整備", [player, hub]],
    ];
    const tabs = groups
      .map(([id, label, fns]) => {
        const secs = [];
        for (const fn of fns) {
          try {
            const sec = fn();
            if (sec) secs.push(sec);
          } catch (e) {
            console.warn("[Suite settings]", e);
          }
        }
        return secs.length ? { id, label, secs } : null;
      })
      .filter(Boolean);
    if (!tabs.some((x) => x.id === activeTab)) activeTab = tabs[0]?.id || "look";
    const head = el("div", "ss-head");
    head.append(el("h2", null, "Stash Suite 設定"));
    const reload = button("再読み込みして反映", () => location.reload(), true);
    reload.classList.add("ss-reload");
    reload.hidden = true;
    head.append(reload, button("閉じる", close));
    const tabBar = el("div", "ss-tabs");
    const body = el("div", "ss-body");
    const renderTab = () => {
      const cur = tabs.find((x) => x.id === activeTab) || tabs[0];
      tabBar.replaceChildren(
        ...tabs.map((tb) => {
          const b = el("button", "ss-tab" + (tb.id === cur.id ? " on" : ""), tb.label);
          b.type = "button";
          b.onclick = () => {
            activeTab = tb.id;
            renderTab();
          };
          return b;
        }),
      );
      body.replaceChildren(...(cur ? cur.secs : []));
      body.scrollTop = 0;
      S.translateAll?.();
    };
    renderTab();
    panel.replaceChildren(head, tabBar, body);
    panel.hidden = false;
    S.translateAll?.();
  }
  function close() {
    panel.hidden = true;
    if (needReload) location.reload();
  }
  panel.addEventListener("mousedown", (e) => {
    if (e.target === panel) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) {
      e.preventDefault();
      close();
    }
  });

  // 上のメニューに入口を置く（レアリティの「カード演出」の入口はこの画面に入ったので隠す）
  const launch = el("button", "ss-launch");
  launch.type = "button";
  launch.title = "Stash Suiteの設定";
  launch.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg><span>設定</span>';
  launch.onclick = () => (panel.hidden ? open() : close());
  setInterval(() => {
    const bar = document.querySelector(".navbar-buttons");
    if (bar && launch.parentElement !== bar) bar.prepend(launch);
    if (!panel.isConnected) document.body.append(panel);
  }, 1000);

  S.css(
    "suite-settings",
    `
#scr-launch{display:none!important}
.ss-launch{display:inline-flex;flex:none;white-space:nowrap;align-items:center;gap:5px;margin-right:6px;padding:4px 10px;border:1px solid var(--suite-line);border-radius:var(--suite-radius);background:var(--suite-raise);color:var(--suite-text);font-size:12px;cursor:pointer}
.ss-launch:hover{background:var(--suite-accent)}
.ss-panel{position:fixed;inset:0;z-index:2147483647;background:#0008;display:flex;justify-content:flex-end}
.ss-panel[hidden]{display:none}
.ss-head{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid var(--suite-line)}
.ss-head h2{flex:1;margin:0;font-size:18px}
.ss-body{overflow:auto;padding:6px 18px 30px}
.ss-panel>.ss-head,.ss-panel>.ss-tabs,.ss-panel>.ss-body{background:var(--suite-panel);color:var(--suite-text);width:min(580px,100vw)}
.ss-tabs{display:flex;gap:4px;padding:8px 18px;border-bottom:1px solid var(--suite-line);flex-wrap:wrap}
.ss-tab{padding:5px 12px;border:1px solid var(--suite-line);border-radius:var(--suite-radius);background:var(--suite-raise);color:var(--suite-sub);font-size:12.5px;cursor:pointer}
.ss-tab:hover{color:var(--suite-text);border-color:var(--suite-accent-hi)}
.ss-tab.on{background:var(--suite-accent);border-color:var(--suite-accent);color:#fff;font-weight:600}
.ss-panel{flex-direction:column;align-items:flex-end}
.ss-panel>.ss-body{flex:1}
.ss-section{padding:14px 0;border-bottom:1px solid var(--suite-line)}
.ss-section h3{margin:0 0 4px;font-size:15px}
.ss-note{margin:0 0 8px;color:var(--suite-sub);font-size:12px}
.ss-row{display:grid;grid-template-columns:170px 1fr;gap:10px;align-items:center;padding:6px 0}
.ss-label{font-size:13px}.ss-label small{display:block;color:var(--suite-sub);font-size:11px}
.ss-choice{display:flex;flex-wrap:wrap;gap:4px}
.ss-opt,.ss-btn{padding:4px 10px;border:1px solid var(--suite-line);border-radius:var(--suite-radius);background:var(--suite-raise);color:var(--suite-text);font-size:12px;cursor:pointer}
.ss-opt.on,.ss-btn.primary{background:var(--suite-accent);border-color:var(--suite-accent);color:#fff}
.ss-opt:hover,.ss-btn:hover{border-color:var(--suite-accent-hi)}
.ss-checks{display:grid;grid-template-columns:1fr 1fr;gap:2px 10px}
.ss-check{display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer}
.ss-inline{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ss-out{color:var(--suite-sub);font-size:12px}
`,
  );
  S.openSettings = open;
})();

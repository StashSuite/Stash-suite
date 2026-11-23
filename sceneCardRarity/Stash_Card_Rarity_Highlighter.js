(function (global) {
  "use strict";
  window.__sceneCardRarity = true;
  const VERSION = "2.5.1",
    KEY = "stash.cardRarity.v1";
  function ratingTier(value) {
    return Number.isFinite(value) && value >= 1 && value <= 100 ? Math.max(1, Math.min(5, Math.round(value / 20))) : 0;
  }
  function starValue(value) {
    return ratingTier(value) ? String(Number((value / 20).toFixed(2))) : "";
  }
  function parseBadge(text) {
    const t = String(text || "")
      .trim()
      .replace(",", ".");
    if (!/^\d+(?:\.\d+)?$/.test(t)) return { valid: false, rating: null };
    const n = Number(t);
    if (n < 0 || n > 100) return { valid: false, rating: null };
    return { valid: true, rating: n === 0 ? null : Math.round(n <= 5 ? n * 20 : n) };
  }
  const THEMES = ["prism", "holo", "neon", "jewel", "aurora", "minimal"],
    INTENSITIES = ["low", "normal", "high", "max"],
    MOTIONS = ["off", "top", "high", "hover"];
  function normalizeSettings(v = {}) {
    // 旧設定（glow / animate）からの移行
    const legacyIntensity = { low: "low", normal: "normal", high: "high" }[v.glow];
    return {
      sceneEnabled: v.sceneEnabled !== false,
      actorsEnabled: v.actorsEnabled !== false,
      actorScope: ["female", "female_unknown", "all"].includes(v.actorScope) ? v.actorScope : "female",
      showUnratedActors: v.showUnratedActors === true,
      theme: THEMES.includes(v.theme) ? v.theme : "prism",
      intensity: INTENSITIES.includes(v.intensity) ? v.intensity : legacyIntensity || "normal",
      motion: MOTIONS.includes(v.motion) ? v.motion : v.animate === true ? "hover" : "top",
      dimLow: v.dimLow !== false,
      respectReducedMotion: v.respectReducedMotion === true,
    };
  }
  function actorAllowed(actor, scope) {
    const g = String(actor?.gender || "").toUpperCase(),
      female = g === "FEMALE" || g === "TRANSGENDER_FEMALE";
    return scope === "all" || female || (scope === "female_unknown" && !g);
  }
  function objectId(href, kind, base) {
    try {
      const u = new URL(href, base);
      if (u.origin !== new URL(base).origin) return null;
      const parts = u.pathname.split("/").filter(Boolean);
      return parts[0] === kind && /^\d+$/.test(parts[1] || "") ? parts[1] : null;
    } catch {
      return null;
    }
  }
  // ---------------------------------------------------------------------------
  // エフェクトテーマ
  // どのテーマも ★5 が最も派手・★1 が最も地味（暗く沈む）という序列は共通。
  // 各段の指定：
  //   ring   … 枠のグラデーション（::before にマスクで描くので、カード背景に依存しない）
  //   w      … 枠の太さ(px)
  //   glow   … 外側の光 [色, ぼかし(px), 広がり(px)]（強さ設定で拡大縮小）
  //   accent … 評価数字などの文字色
  //   sheen  … カード上に重ねる光沢／ホログラム（::after、下に向かってフェード）
  //   ringAnim / sheenAnim … 「動き」設定で許可された段だけ再生
  // ---------------------------------------------------------------------------
  const SPIN = "from var(--scr-angle,0deg)",
    SWEEP_WHITE = "linear-gradient(115deg,transparent 38%,#ffffff70 50%,transparent 62%) 35% 0/300% 100% no-repeat",
    SWEEP_GOLD = "linear-gradient(115deg,transparent 38%,#ffe9a870 50%,transparent 62%) 35% 0/300% 100% no-repeat";
  const THEME_DEFS = {
    prism: {
      label: "プリズム",
      note: "虹色の枠が回る定番。★4金・★3紫・★2青",
      tiers: {
        5: {
          ring: `conic-gradient(${SPIN},#ff3b3b,#ffb31a,#fff35c,#3dff7a,#22d3ff,#7b5cff,#ff3bd4,#ff3b3b)`,
          w: 3,
          glow: [["#ff4bdb", 10, 2], ["#7b5cff", 22, 4], ["#22d3ff", 38, 6]],
          accent: "#fff2a6",
          sheen: SWEEP_WHITE,
          sheenOp: 0.55,
          ringAnim: "scr-spin 6s linear infinite",
          sheenAnim: "scr-sweep 3.6s ease-in-out infinite",
        },
        4: {
          ring: "linear-gradient(135deg,#fff1b8,#d4a52c 35%,#8a6413 65%,#f7d77a)",
          w: 2,
          glow: [["#e0b040", 9, 1], ["#b8860b", 18, 3]],
          accent: "#ffe28a",
          sheen: SWEEP_GOLD,
          sheenOp: 0.4,
          sheenAnim: "scr-sweep 5s ease-in-out infinite",
        },
        3: { ring: "linear-gradient(135deg,#dcbcff,#8b4fd6)", w: 2, glow: [["#8b4fd6", 8, 1], ["#6a35b8", 14, 2]], accent: "#e2b9ff" },
        2: { ring: "linear-gradient(135deg,#6d9dd0,#34587e)", w: 1.5, glow: [["#2f7fd6", 5, 0]], accent: "#b5c9dc" },
      },
    },
    holo: {
      label: "ホロカード",
      note: "トレカ風。★5ホログラム・★4金箔・★3銀箔・★2銅",
      tiers: {
        5: {
          ring: `conic-gradient(${SPIN},#ff9ad5,#ffe57a,#9dffb0,#8fe7ff,#b49bff,#ff9ad5)`,
          w: 3,
          glow: [["#b49bff", 10, 1], ["#8fe7ff", 24, 3], ["#ff9ad5", 40, 4]],
          accent: "#ffffff",
          sheen:
            "linear-gradient(115deg,transparent 18%,#ff6ad540 28%,#ffe25a40 36%,#5affa840 44%,#5ad7ff40 52%,#a35aff40 60%,transparent 70%) 35% 0/300% 100% no-repeat," +
            SWEEP_WHITE,
          sheenOp: 0.85,
          ringAnim: "scr-spin 8s linear infinite",
          sheenAnim: "scr-sweep 4.2s ease-in-out infinite",
        },
        4: {
          ring: "linear-gradient(120deg,#8a6a1f,#f9e39a 25%,#b8892a 50%,#fff6c8 70%,#9c7322)",
          w: 3,
          glow: [["#e0b84a", 8, 1], ["#c8962a", 16, 2]],
          accent: "#ffe7a3",
          sheen: SWEEP_GOLD,
          sheenOp: 0.55,
          sheenAnim: "scr-sweep 4.8s ease-in-out infinite",
        },
        3: {
          ring: "linear-gradient(120deg,#6e7680,#f2f5f8 30%,#9aa3ad 55%,#ffffff 75%,#7d858f)",
          w: 2,
          glow: [["#cfd8e3", 6, 0]],
          accent: "#e8eef5",
          sheen: SWEEP_WHITE,
          sheenOp: 0.22,
        },
        2: { ring: "linear-gradient(120deg,#5a3a22,#d39a6a 45%,#7a4d2c)", w: 2, glow: [["#b8734a", 4, 0]], accent: "#e0b08a" },
      },
    },
    neon: {
      label: "ネオン",
      note: "ネオン管の発光。★5は色が流れてまたたく",
      tiers: {
        5: {
          ring: "linear-gradient(90deg,#ff2bd6,#7a5cff,#00e5ff,#ff2bd6)",
          w: 2,
          glow: [["#ff2bd6", 7, 1], ["#00e5ff", 18, 3], ["#7a5cff", 34, 5]],
          accent: "#ffd6f7",
          ringAnim: "scr-hue 6s linear infinite, scr-flicker 7s steps(1) infinite",
        },
        4: {
          ring: "linear-gradient(#ff3ec8,#ff3ec8)",
          w: 2,
          glow: [["#ff3ec8", 6, 1], ["#ff3ec8", 16, 2]],
          accent: "#ff9ce6",
          ringAnim: "scr-breathe 3.2s ease-in-out infinite",
        },
        3: { ring: "linear-gradient(#22d8ff,#22d8ff)", w: 2, glow: [["#22d8ff", 5, 0], ["#22d8ff", 12, 1]], accent: "#9eefff" },
        2: { ring: "linear-gradient(#2f5fa8,#2f5fa8)", w: 1.5, glow: [["#2f5fa8", 4, 0]], accent: "#8fb0dd" },
      },
    },
    jewel: {
      label: "ジュエリー",
      note: "上品な宝飾調。★5ダイヤ・★4シャンパンゴールド・★3ローズゴールド・★2プラチナ",
      tiers: {
        5: {
          ring: `conic-gradient(${SPIN},#ffffff,#bfe9ff,#ffffff,#ffd6f5,#ffffff,#d9fff2,#ffffff)`,
          w: 3,
          glow: [["#e8f6ff", 6, 1], ["#a9dcff", 18, 3], ["#ffffff", 30, 3]],
          accent: "#ffffff",
          sheen:
            "radial-gradient(circle at 18% 14%,#fff 0 1.6px,transparent 3.5px),radial-gradient(circle at 80% 26%,#fff 0 1.2px,transparent 3px)," +
            "radial-gradient(circle at 62% 64%,#fff 0 1.6px,transparent 3.8px),radial-gradient(circle at 34% 48%,#fff 0 1px,transparent 2.6px)," +
            "radial-gradient(circle at 88% 70%,#fff 0 1px,transparent 2.6px)," +
            SWEEP_WHITE,
          sheenOp: 0.9,
          ringAnim: "scr-spin 10s linear infinite",
          sheenAnim: "scr-twinkle 2.8s ease-in-out infinite",
        },
        4: {
          ring: "linear-gradient(135deg,#f6e7c1,#c9a45c 40%,#f6e7c1 60%,#a8843f)",
          w: 2.5,
          glow: [["#e8cc8a", 7, 1], ["#c9a45c", 14, 2]],
          accent: "#f3dca4",
          sheen: SWEEP_GOLD,
          sheenOp: 0.3,
          sheenAnim: "scr-sweep 6s ease-in-out infinite",
        },
        3: { ring: "linear-gradient(135deg,#ffd9cf,#c98b7d 50%,#f3c1b4)", w: 2, glow: [["#e0a090", 6, 0]], accent: "#f7c9bd" },
        2: { ring: "linear-gradient(135deg,#d7dde4,#8c96a3)", w: 1.5, glow: [["#aab4c0", 3, 0]], accent: "#d7dde4" },
      },
    },
    aurora: {
      label: "オーロラ",
      note: "緑〜紫の光がゆらめく。光の広がりが大きめ",
      tiers: {
        5: {
          ring: `conic-gradient(${SPIN},#00ffa3,#00d4ff,#7b61ff,#ff5edb,#00ffa3)`,
          w: 3,
          glow: [["#00ffa3", 12, 2], ["#7b61ff", 28, 5], ["#00d4ff", 46, 8]],
          accent: "#c9fff0",
          sheen: "linear-gradient(180deg,#00ffa330,transparent 45%,#7b61ff30)",
          sheenOp: 0.9,
          ringAnim: "scr-spin 12s linear infinite",
          sheenAnim: "scr-hue 9s linear infinite",
        },
        4: {
          ring: "linear-gradient(135deg,#29e0b4,#6b6bff)",
          w: 2,
          glow: [["#29e0b4", 8, 1], ["#6b6bff", 18, 3]],
          accent: "#b8ffee",
          ringAnim: "scr-hue 10s linear infinite",
        },
        3: { ring: "linear-gradient(135deg,#1fb5a8,#2a7fd4)", w: 2, glow: [["#1fb5a8", 6, 0]], accent: "#9fe9e0" },
        2: { ring: "linear-gradient(#2b5d7a,#2b5d7a)", w: 1.5, glow: [["#2b5d7a", 4, 0]], accent: "#9cc0d6" },
      },
    },
    minimal: {
      label: "ミニマル",
      note: "細い線と上端のアクセントバーだけ。一覧の見やすさ重視",
      tiers: {
        5: {
          ring: "linear-gradient(90deg,#ff6ad5,#ffd36a,#6affc9,#6ad7ff)",
          w: 2,
          glow: [["#ffd36a", 6, 0], ["#ff6ad5", 14, 1]],
          accent: "#ffe8a8",
          sheen: "linear-gradient(90deg,#ff6ad5,#ffd36a,#6affc9,#6ad7ff) top/100% 4px no-repeat",
          sheenOp: 1,
          sheenFull: true,
          ringAnim: "scr-hue 8s linear infinite",
        },
        4: {
          ring: "linear-gradient(#d9b45a,#d9b45a)",
          w: 1.5,
          glow: [["#d9b45a", 4, 0]],
          accent: "#ecd08c",
          sheen: "linear-gradient(#d9b45a,#d9b45a) top/100% 3px no-repeat",
          sheenOp: 1,
          sheenFull: true,
        },
        3: {
          ring: "linear-gradient(#a78bd6,#a78bd6)",
          w: 1.5,
          glow: [],
          accent: "#cdb8f0",
          sheen: "linear-gradient(#a78bd6,#a78bd6) top/100% 2px no-repeat",
          sheenOp: 1,
          sheenFull: true,
        },
        2: { ring: "linear-gradient(#5f7a99,#5f7a99)", w: 1, glow: [], accent: "#b0c2d6" },
      },
    },
  };
  // ★1・未評価は全テーマ共通（★1が最も地味）
  const COMMON_TIERS = {
    1: { ring: "linear-gradient(#3a3e45,#3a3e45)", w: 1, glow: [], accent: "#7d838c" },
    0: { ring: "linear-gradient(#4f545c,#4f545c)", w: 1, glow: [], accent: "#c2c5ca" },
  };
  function glowCss(list, scale = 1, base = "0 5px 14px #0006") {
    const parts = (list || []).map(
      ([c, blur, spread]) =>
        `0 0 calc(${+(blur * scale).toFixed(2)}px * var(--scr-k)) calc(${+(spread * scale).toFixed(2)}px * var(--scr-k)) color-mix(in srgb, ${c} calc(var(--scr-a) * 100%), transparent)`,
    );
    if (base) parts.push(base);
    return parts.join(",");
  }
  // 出演者（シーンカードの出演者ラベル・ミニプレイヤーの出演者チップ・出演者ホバーカード）にも
  // 同じテーマ・同じ強さの色と光を当てる。作品カードと出演者の演出がずれないよう、正本は同じテーマ表。
  const PERFORMER_TARGETS = ":is(a.vsc-performer.scr-performer-enabled,#sp22 a.chip.performer,#sp22-performer-card,#scr-actor-popup)";
  // テーマ表をCSSに変換する（スタイルの正本はこの表。sceneCardRarity.css は共通部分のみ）
  function buildThemeCss(defs = THEME_DEFS) {
    const out = [];
    for (const [name, theme] of Object.entries(defs)) {
      const tiers = { ...COMMON_TIERS, ...theme.tiers };
      for (const [tier, t] of Object.entries(tiers)) {
        const sel = `html[data-scr-theme="${name}"] .scr-scene-enabled[data-scr-tier="${tier}"]`;
        const vars = [
          `--scr-ring:${t.ring || "none"}`,
          `--scr-ring-w:${t.w || 0}px`,
          `--scr-glow:${glowCss(t.glow)}`,
          `--scr-accent:${t.accent || "inherit"}`,
          `--scr-sheen:${t.sheen || "none"}`,
          `--scr-sheen-op:${t.sheen ? t.sheenOp ?? 0.5 : 0}`,
          `--scr-sheen-mask:${t.sheenFull ? "none" : "linear-gradient(#000 0 50%,transparent 88%)"}`,
          `--scr-ring-anim:${t.ringAnim || "none"}`,
          `--scr-sheen-anim:${t.sheenAnim || "none"}`,
        ];
        out.push(`${sel}{${vars.join(";")}}`);
        const perf = `html[data-scr-theme="${name}"] ${PERFORMER_TARGETS}[data-scr-tier="${tier}"]`;
        out.push(
          `${perf}{--scr-p-ring:${t.ring || "none"};--scr-p-accent:${t.accent || "inherit"};` +
            `--scr-p-glow:${glowCss(t.glow, 0.45, "")||"none"};--scr-p-glow-lg:${glowCss(t.glow, 0.8, "")||"none"};` +
            `--scr-p-bg:color-mix(in srgb,${t.accent || "#888"} 15%,#161b23)}`,
        );
      }
    }
    return out.join("\n");
  }
  const Core = { ratingTier, starValue, parseBadge, normalizeSettings, actorAllowed, objectId, buildThemeCss, THEME_DEFS };
  if (typeof module === "object" && module.exports) module.exports = Core;
  if (!global.document) return;
  if (global.StashCardRarity) return; // 二重読み込み防止
  function boot() {
    if (global.StashCardRarity) return;
    const document = global.document,
      TTL = 30000,
      BATCH = 60;
    let settings = normalizeSettings(),
      timer = null,
      busy = false,
      retryAt = 0;
    const cache = new Map(),
      actorTitleRecords = new WeakMap();
    let actorPopup = null,
      actorPopupTimer = null,
      actorPopupHideTimer = null,
      actorPopupAnchor = null,
      actorPopupPerson = null,
      actorPopupRefs = null,
      actorPopupHover = false,
      actorAnchorHover = false,
      actorScrollSuppressUntil = 0,
      actorOpenedAt = 0,
      actorBypass = false;
    const ACTOR_DOUBLE_GUARD = 400; // 開いた直後のもう1クリックは無視（ダブルクリックで誤ってページ移動しない）
    const actorRatingLocks = new Set();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) settings = normalizeSettings(JSON.parse(raw));
    } catch {}
    // テーマ別の色・光はテーマ表から生成（共通部分は sceneCardRarity.css）
    const style = document.createElement("style");
    style.id = "scr-theme-css";
    style.textContent = buildThemeCss();
    document.head.append(style);
    const launch = document.createElement("button");
    launch.id = "scr-launch";
    launch.type = "button";
    launch.textContent = "カード演出";
    launch.title = "カード評価の演出設定";
    launch.setAttribute("aria-label", "カード評価の演出設定");
    // 右下に常に浮かべるとカードやページ送りに重なるので、上のメニューバー（設定の歯車の左）に置く。
    // Stash がメニューバーを描き直すと消えるので、無ければ置き直す
    function placeLaunch() {
      const bar = document.querySelector(".navbar-buttons");
      if (!bar) {
        if (!launch.isConnected) document.body.append(launch);
        launch.classList.remove("in-navbar");
        return;
      }
      if (launch.parentElement === bar) return;
      bar.prepend(launch);
      launch.classList.add("in-navbar");
    }
    setInterval(placeLaunch, 1000);
    const panel = document.createElement("section");
    panel.id = "scr-settings";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "カード評価の演出");
    panel.innerHTML = `<header><strong>カード評価の演出</strong><button class="scr-close" type="button" aria-label="閉じる">×</button></header>
<h4>テーマ</h4><div class="scr-themes" role="group" aria-label="テーマ"></div>
<h4>プレビュー（左から ★5 → ★1・未評価）</h4><div class="scr-preview" aria-hidden="true"></div>
<h4>演出の強さ</h4><div class="scr-segment scr-intensity" role="group" aria-label="演出の強さ"><button type="button" data-value="low">控えめ</button><button type="button" data-value="normal">標準</button><button type="button" data-value="high">強め</button><button type="button" data-value="max">最大</button></div>
<h4>動き</h4><div class="scr-segment scr-motion" role="group" aria-label="動き"><button type="button" data-value="off">なし</button><button type="button" data-value="top">★5だけ</button><button type="button" data-value="high">★4以上</button><button type="button" data-value="hover">ホバー時</button></div>
<label><input class="scr-rm" type="checkbox">OSの「アニメーションを減らす」設定がオンなら動きを止める</label>
<label><input class="scr-dim" type="checkbox">★1のカードを暗く沈める（ホバーで元の明るさ）</label>
<label><input class="scr-scenes" type="checkbox">作品評価でカードを演出する</label>
<h4>出演者</h4>
<label><input class="scr-actors" type="checkbox">出演者名を評価で色分け・ホバーで出演者カード</label>
<label>対象<select class="scr-scope"><option value="female">女性登録のみ</option><option value="female_unknown">女性＋性別未設定</option><option value="all">すべての出演者</option></select></label>
<p>どのテーマでも ★5 が最も派手、★1 が最も地味です。中間の評価は最も近い星に丸めます（例：4.5→★5）。保存済みの評価やカードの操作は変更しません。</p>
<button class="scr-refresh" type="button">現在のカードを再確認</button><div class="scr-status" role="status"></div>`;
    document.body.append(launch, panel);
    placeLaunch();
    const q = (s) => panel.querySelector(s),
      status = q(".scr-status");
    function save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(settings));
      } catch {
        status.textContent = "設定をブラウザへ保存できませんでした。";
      }
    }
    function renderThemeButtons() {
      const box = q(".scr-themes");
      if (box.childElementCount) return;
      for (const [name, theme] of Object.entries(THEME_DEFS)) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "scr-theme";
        b.dataset.value = name;
        const sw = document.createElement("span");
        sw.className = "scr-swatch";
        sw.style.setProperty("--swatch", theme.tiers[5].ring);
        const text = document.createElement("span");
        const title = document.createElement("b");
        title.textContent = theme.label;
        const note = document.createElement("small");
        note.textContent = theme.note;
        text.append(title, note);
        b.append(sw, text);
        b.onclick = () => update({ theme: name });
        box.append(b);
      }
      const preview = q(".scr-preview");
      for (const tier of [5, 4, 3, 2, 1, 0]) {
        const c = document.createElement("div");
        c.className = "scr-sample scr-scene-enabled";
        c.dataset.scrTier = String(tier);
        const label = document.createElement("span");
        label.textContent = tier ? "★" + tier : "未";
        c.append(label);
        preview.append(c);
      }
    }
    let settingsVersion = 0; // 設定が変わったら全カードを飾り直す
    function configure() {
      settingsVersion++;
      const root = document.documentElement;
      root.dataset.scrTheme = settings.theme;
      root.dataset.scrIntensity = settings.intensity;
      root.dataset.scrMotion = settings.motion;
      root.classList.toggle("scr-dim-low", settings.dimLow);
      root.classList.toggle("scr-respect-rm", settings.respectReducedMotion);
      renderThemeButtons();
      for (const b of panel.querySelectorAll(".scr-theme")) b.setAttribute("aria-pressed", String(b.dataset.value === settings.theme));
      for (const b of panel.querySelectorAll(".scr-intensity button")) b.setAttribute("aria-pressed", String(b.dataset.value === settings.intensity));
      for (const b of panel.querySelectorAll(".scr-motion button")) b.setAttribute("aria-pressed", String(b.dataset.value === settings.motion));
      q(".scr-dim").checked = settings.dimLow;
      q(".scr-rm").checked = settings.respectReducedMotion;
      q(".scr-scenes").checked = settings.sceneEnabled;
      q(".scr-actors").checked = settings.actorsEnabled;
      q(".scr-scope").value = settings.actorScope;
    }
    function update(patch) {
      settings = normalizeSettings({ ...settings, ...patch });
      save();
      configure();
      scan();
    }
    function cardId(card) {
      const a = card.querySelector("a.scene-card-link") || card.querySelector('a[href*="/scenes/"]');
      return a ? objectId(a.href, "scenes", location.href) : null;
    }
    function cards() {
      return [...new Set(document.querySelectorAll(".valkyr-scene-card > .scene-card,.scene-card.grid-card,.lc-card"))].filter(
        (c) => !c.closest("#twr-panel,#scr-settings"),
      );
    }
    function domRating(card) {
      const badge = card.querySelector(".vsc-rating");
      if (!badge) return { valid: false, rating: null };
      const label = [...badge.children].find((e) => e.tagName === "SPAN");
      return parseBadge(label?.textContent || "");
    }
    function setActorTitle(a, text) {
      let record = actorTitleRecords.get(a);
      if (!record) {
        record = { original: a.getAttribute("title"), last: null };
        actorTitleRecords.set(a, record);
      }
      const now = a.getAttribute("title");
      if (record.last !== null && now !== record.last) record.original = now;
      const prefix = record.original ? record.original + "\n" : "";
      const full = prefix + text;
      if (now !== full) a.setAttribute("title", full);
      record.last = full;
    }
    function clearActor(a) {
      a.classList.remove("scr-performer-enabled");
      delete a.dataset.scrTier;
      delete a.dataset.scrStars;
      const record = actorTitleRecords.get(a);
      if (record && a.getAttribute("title") === record.last) {
        if (record.original === null) a.removeAttribute("title");
        else a.setAttribute("title", record.original);
      }
      actorTitleRecords.delete(a);
    }

    function cancelActorHide() {
      clearTimeout(actorPopupHideTimer);
      actorPopupHideTimer = null;
    }
    function hideActorPopup() {
      clearTimeout(actorPopupTimer);
      actorPopupTimer = null;
      cancelActorHide();
      if (actorPopupAnchor) {
        actorPopupAnchor.removeAttribute("aria-describedby");
        actorPopupAnchor.classList.remove("scr-actor-selected");
        if (actorPopupAnchor.dataset.scrPrevTitle != null) {
          actorPopupAnchor.title = actorPopupAnchor.dataset.scrPrevTitle;
          delete actorPopupAnchor.dataset.scrPrevTitle;
        }
      }
      actorPopupAnchor = null;
      actorPopupPerson = null;
      actorPopupRefs = null;
      actorPopupHover = false;
      actorAnchorHover = false;
      if (actorPopup) actorPopup.style.display = "none";
    }
    function placeActorPopup(anchor) {
      const r = anchor.getBoundingClientRect(),
        p = actorPopup.getBoundingClientRect();
      let y = r.top - p.height - 8;
      if (y < 8) y = r.bottom + 8;
      actorPopup.style.left = Math.max(8, Math.min(innerWidth - p.width, r.left + r.width / 2 - p.width / 2)) + "px";
      actorPopup.style.top = Math.max(8, Math.min(innerHeight - p.height - 8, y)) + "px";
    }
    function updateActorPopup(p) {
      if (!actorPopupRefs || String(actorPopupPerson?.id) !== String(p.id)) return;
      const busy = actorRatingLocks.has(String(p.id));
      for (const b of actorPopupRefs.stars.children) {
        b.classList.toggle("selected", (p.rating100 || 0) >= Number(b.dataset.rating));
        b.disabled = busy;
      }
      actorPopupRefs.clear.disabled = busy;
      actorPopupRefs.value.textContent = p.rating100 == null ? "未評価" : p.rating100 + "/100";
    }
    async function saveActorRating(p, rating) {
      const id = String(p.id);
      if (actorRatingLocks.has(id)) return;
      actorRatingLocks.add(id);
      updateActorPopup(p);
      if (actorPopupRefs) actorPopupRefs.status.textContent = "保存中…";
      try {
        const r = await fetch("/graphql", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: "mutation CardRarityActorRating($input:PerformerUpdateInput!){performerUpdate(input:$input){id rating100}}",
            variables: { input: { id, rating100: rating } },
          }),
        });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const d = await r.json();
        if (d.errors?.length) throw new Error(d.errors.map((e) => e.message).join("\n"));
        const v = d.data?.performerUpdate?.rating100;
        if (!d.data?.performerUpdate) throw new Error("保存結果を取得できません。");
        p.rating100 = v;
        if (actorPopupPerson && String(actorPopupPerson.id) === id && actorPopup) actorPopup.dataset.scrTier = String(ratingTier(v));
        for (const entry of cache.values()) for (const a of entry.performers || []) if (String(a.id) === id) a.rating100 = v;
        if (actorPopupPerson && String(actorPopupPerson.id) === id) {
          actorPopupPerson.rating100 = v;
          if (actorPopupRefs) actorPopupRefs.status.textContent = "出演者の評価を保存しました";
        }
        decorateAll();
      } catch (e) {
        if (actorPopupRefs) actorPopupRefs.status.textContent = "保存失敗: " + e.message;
      } finally {
        actorRatingLocks.delete(id);
        if (actorPopupPerson && String(actorPopupPerson.id) === id) updateActorPopup(actorPopupPerson);
      }
    }
    function showActorPopup(anchor, person) {
      if (!anchor.isConnected || Date.now() < actorScrollSuppressUntil) return;
      const p = person;
      if (!actorPopup) {
        actorPopup = document.createElement("div");
        actorPopup.id = "scr-actor-popup";
        actorPopup.setAttribute("role", "dialog");
        actorPopup.setAttribute("aria-label", "出演者情報と評価");
        actorPopup.addEventListener("pointerenter", () => {
          actorPopupHover = true;
          cancelActorHide();
        });
        actorPopup.addEventListener("pointerleave", () => {
          actorPopupHover = false;
        });
        document.body.append(actorPopup);
      }
      actorPopup.replaceChildren();
      actorPopupPerson = p;
      actorPopup.dataset.scrTier = String(ratingTier(p.rating100));
      const portrait = document.createElement("div");
      portrait.className = "portrait";
      if (p.image_path) {
        const img = document.createElement("img");
        img.alt = p.name || "出演者";
        img.src = p.image_path;
        img.onerror = () => {
          img.remove();
          portrait.textContent = "画像なし";
        };
        portrait.append(img);
      } else portrait.textContent = "画像なし";
      const caption = document.createElement("div");
      caption.className = "caption";
      const name = document.createElement("div");
      name.className = "name";
      name.textContent = p.name || "出演者";
      const count = document.createElement("div");
      count.className = "count";
      count.textContent = "登録 " + (Number.isFinite(p.scene_count) ? p.scene_count.toLocaleString() : "—") + "本";
      count.title = "Stash内の出演シーン数";
      const page = document.createElement("button");
      page.type = "button";
      page.className = "actor-page";
      page.textContent = "出演者ページ →";
      page.title = "出演者ページへ移動";
      page.onclick = () => {
        const a = actorPopupAnchor;
        hideActorPopup();
        if (!a?.isConnected) return;
        actorBypass = true;
        try {
          a.click();
        } finally {
          actorBypass = false;
        }
      };
      caption.append(name, count, page);
      const row = document.createElement("div");
      row.className = "actor-rating";
      const stars = document.createElement("span");
      stars.className = "actor-stars";
      for (let i = 1; i <= 5; i++) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = "★";
        b.dataset.rating = String(i * 20);
        b.title = "出演者の評価 " + i + "/5";
        b.onclick = () => saveActorRating(p, p.rating100 === i * 20 ? null : i * 20); // 同じ星で解除
        stars.append(b);
      }
      const value = document.createElement("span");
      value.className = "actor-rating-value";
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "actor-clear";
      clear.textContent = "↺";
      clear.title = "出演者の評価を解除";
      clear.onclick = () => saveActorRating(p, null);
      row.append(stars, value, clear);
      const status = document.createElement("div");
      status.className = "actor-status";
      status.setAttribute("role", "status");
      actorPopupRefs = { stars, value, clear, status };
      actorPopup.append(portrait, caption, row, status);
      actorPopup.style.display = "block";
      actorPopupAnchor = anchor;
      anchor.setAttribute("aria-describedby", actorPopup.id);
      anchor.classList.add("scr-actor-selected");
      anchor.dataset.scrPrevTitle = anchor.getAttribute("title") || "";
      anchor.title = "もう一度クリックで閉じる";
      updateActorPopup(p);
      placeActorPopup(anchor);
    }
    function actorForAnchor(anchor) {
      const id = objectId(anchor.href, "performers", location.href);
      if (!id) return null;
      for (const entry of cache.values()) {
        const p = (entry.performers || []).find((x) => String(x.id) === id);
        if (p) return p;
      }
      return null;
    }

    // 品番を表紙の左下に（タイトルが品番だけの作品は重複するので出さない）
    const norm = (t) => String(t || "").replace(/[\s_\-]/g, "").toUpperCase();
    function decorateCode(card, entry) {
      if (card.classList.contains("lc-card")) return; // Light Scene Cards は品番を自分で出す
      const host = card.querySelector(".video-section") || card;
      let badge = host.querySelector(":scope > .scr-code");
      const code = entry?.code?.trim();
      if (!code || norm(entry.title) === norm(code)) {
        badge?.remove();
        return;
      }
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "scr-code";
        host.append(badge);
      }
      if (badge.textContent !== code) badge.textContent = code;
    }
    function decorate(card) {
      const id = cardId(card),
        entry = id ? cache.get(id) : null,
        dom = domRating(card);
      decorateCode(card, entry);
      const raw = dom.valid ? dom.rating : entry?.rating100;
      card.classList.toggle("scr-scene-enabled", settings.sceneEnabled);
      card.dataset.scrTier = String(ratingTier(raw));
      card.dataset.scrRating100 = Number.isFinite(raw) ? String(raw) : "";
      const actors = new Map((entry?.performers || []).map((a) => [String(a.id), a]));
      for (const a of card.querySelectorAll("a.vsc-performer[href]")) {
        const actorId = objectId(a.href, "performers", location.href),
          actor = actors.get(actorId);
        if (!settings.actorsEnabled || !actor || !actorAllowed(actor, settings.actorScope)) {
          clearActor(a);
          continue;
        }
        const tier = ratingTier(actor.rating100);
        a.classList.add("scr-performer-enabled");
        a.dataset.scrTier = String(tier);
        a.dataset.scrStars = "";
        setActorTitle(a, "クリックで出演者情報");
      }
    }
    // 前回と同じ内容のカードは飾り直さない（スクロールや他のプラグインの変化のたびに500枚を書き換えない）
    const decorated = new WeakMap();
    function decorateAll() {
      for (const card of cards()) {
        if (!watchedCards.has(card)) {
          watchedCards.add(card);
          cardSeen.observe(card);
        }
        const id = cardId(card),
          sig = [settingsVersion, id, cache.get(id)?.at || 0, card.querySelector(".vsc-rating span")?.textContent || "", card.querySelectorAll("a.vsc-performer").length, !!card.querySelector(".scr-code"),
            // Light Scene Cards はマウスを乗せるとカードを描き直して、付けた印（クラス）を消すので、消えていたら飾り直す
            card.classList.contains("scr-scene-enabled") === settings.sceneEnabled && !!card.dataset.scrTier].join("|");
        if (decorated.get(card) === sig) continue;
        decorated.set(card, sig);
        decorate(card);
      }
      for (const card of seenCards) if (card.isConnected) fitPerformers(card);
    }

    // 出演者欄：名前は縮めず入る人数だけ並べ、残りは「+N」ボタンにまとめる（押すと残りの出演者を一覧で開く）。
    // 寸法を測るので見えているカードだけ、幅・人数が変わった時だけ測り直す
    const fitted = new WeakMap();
    function fitPerformers(card) {
      const list = card.querySelector(".vsc-performers-list"),
        entry = cache.get(cardId(card));
      if (!list) return;
      const chips = [...list.querySelectorAll(":scope > a.vsc-performer")],
        // Light Scene Cards の出演者のリンクは絞り込みの URL（/performers/番号 ではない）なので、data-performer-id で見分ける。
        // 見分けられず、表示中の出演者まで「+N」に数えていた（1人だけの作品でも「+1」）
        shownIds = new Set(chips.map((a) => a.dataset.performerId || objectId(a.getAttribute("href") || a.dataset.suiteHref || "", "performers", location.href))),
        // 出演者情報の取得前は Valkyr の「and N more」の数を使う（名前は「+N」を押した時に取りに行く）
        // Light Scene Cards が男性を出さない設定の時は、隠した男性を「+N」に数えない（空きがあるのに「+1」と出ていた）
        hideMale = card.classList.contains("lc-card") && window.LightCards?.store?.get().show?.male === false,
        extraN = entry
          ? (entry.performers || []).filter((p) => !shownIds.has(String(p.id)) && !(hideMale && /^(MALE|TRANSGENDER_MALE)$/.test(String(p.gender || "")))).length
          : +(list.querySelector(".top-meta-overflow")?.textContent.match(/\d+/)?.[0] || 0),
        key = [list.clientWidth, chips.length, extraN, entry?.at || 0].join("|");
      if (!list.clientWidth || fitted.get(list) === key) return;
      fitted.set(list, key);
      list.classList.add("scr-fitted", "scr-measuring");
      let more = list.querySelector(":scope > .scr-more");
      if (!more) {
        more = document.createElement("button");
        more.type = "button";
        more.className = "scr-more";
        more.title = "ほかの出演者を表示";
        list.append(more);
      }
      for (const a of chips) a.classList.remove("scr-chip-hidden");
      let hiddenN = 0;
      const label = () => {
        const n = hiddenN + extraN;
        more.hidden = !n;
        more.textContent = "+" + n;
      };
      label();
      for (let i = chips.length - 1; i > 0 && list.scrollWidth > list.clientWidth + 1; i--) {
        chips[i].classList.add("scr-chip-hidden");
        hiddenN++;
        label();
      }
      list.classList.remove("scr-measuring");
    }
    let morePop = null,
      moreOwner = null;
    function hideMore() {
      if (morePop) morePop.hidden = true;
      moreOwner = null;
    }
    async function showMore(btn) {
      const card = btn.closest(".scene-card"),
        list = btn.parentElement,
        id = cardId(card);
      if (!cache.has(id) && id) {
        moreOwner = btn;
        try {
          for (const scene of await queryScenes([id])) cache.set(String(scene.id), { ...scene, at: Date.now() });
        } catch (e) {
          console.warn("[Card Rarity]", e);
        }
        if (moreOwner !== btn) return; // 取得中に閉じられた
      }
      const entry = cache.get(id);
      if (!morePop) {
        morePop = document.createElement("div");
        morePop.id = "scr-more-pop";
        document.body.append(morePop);
      }
      const shown = new Set(),
        items = [];
      for (const a of list.querySelectorAll(":scope > a.vsc-performer")) {
        const id = objectId(a.href, "performers", location.href);
        if (a.classList.contains("scr-chip-hidden")) {
          const c = a.cloneNode(true);
          c.classList.remove("scr-chip-hidden", "scr-actor-selected");
          items.push(c);
        } else shown.add(id);
        shown.add(id);
      }
      for (const p of entry?.performers || []) {
        if (shown.has(String(p.id))) continue;
        const a = document.createElement("a");
        a.href = "/performers/" + p.id;
        a.className = "vsc-performer";
        a.append(Object.assign(document.createElement("span"), { textContent: p.name }));
        if (settings.actorsEnabled && actorAllowed(p, settings.actorScope)) {
          a.classList.add("scr-performer-enabled");
          a.dataset.scrTier = String(ratingTier(p.rating100));
          a.title = "クリックで出演者情報";
        }
        items.push(a);
      }
      morePop.replaceChildren(...items);
      morePop.hidden = false;
      const r = btn.getBoundingClientRect(),
        w = morePop.offsetWidth,
        h = morePop.offsetHeight;
      morePop.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + "px";
      morePop.style.top = (r.bottom + 4 + h > innerHeight - 8 ? r.top - 4 - h : r.bottom + 4) + "px";
      moreOwner = btn;
    }
    document.addEventListener(
      "click",
      (e) => {
        const btn = e.target instanceof Element ? e.target.closest(".scr-more") : null;
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        moreOwner === btn && !morePop?.hidden ? hideMore() : showMore(btn);
      },
      true,
    );
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (!moreOwner || !(e.target instanceof Element)) return;
        if (morePop?.contains(e.target) || e.target.closest(".scr-more,#scr-actor-popup")) return;
        hideMore();
      },
      true,
    );
    // 見えているカード（寸法を毎回測らず IntersectionObserver で覚える）
    const seenCards = new Set(),
      watchedCards = new WeakSet();
    const cardSeen = new IntersectionObserver((entries) => {
      for (const e of entries) e.isIntersecting ? seenCards.add(e.target) : seenCards.delete(e.target);
      schedule();
    });
    function visibleIds() {
      const ids = new Set();
      for (const card of seenCards) {
        if (!card.isConnected) {
          seenCards.delete(card);
          continue;
        }
        const id = cardId(card);
        if (id) ids.add(id);
      }
      return [...ids];
    }
    async function queryScenes(ids) {
      const controller = new AbortController(),
        timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const r = await fetch("/graphql", {
          method: "POST",
          credentials: "same-origin",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query:
              "query CardRarity($ids:[ID!]){findScenes(ids:$ids,filter:{per_page:-1}){scenes{id code title rating100 performers{id name gender rating100 image_path scene_count}}}}",
            variables: { ids },
          }),
        });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const d = await r.json();
        if (d.errors?.length) throw new Error(d.errors.map((e) => e.message).join("\n"));
        return d.data.findScenes.scenes;
      } finally {
        clearTimeout(timeout);
      }
    }
    async function refresh() {
      if (busy || Date.now() < retryAt || document.hidden) return;
      const now = Date.now(),
        ids = visibleIds().filter((id) => !cache.has(id) || now - cache.get(id).at >= TTL);
      if (!ids.length) return;
      busy = true;
      status.textContent = "出演者評価を確認中…";
      try {
        let count = 0;
        for (let i = 0; i < ids.length; i += BATCH) {
          const list = await queryScenes(ids.slice(i, i + BATCH));
          for (const scene of list) {
            cache.set(String(scene.id), { ...scene, at: Date.now() });
            count++;
          }
          decorateAll();
        }
        if (cache.size > 3000) {
          const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at);
          oldest.slice(0, cache.size - 2500).forEach(([id]) => cache.delete(id));
        }
        status.textContent = count + "件の出演者評価を確認しました。変更は約30秒ごと、画面復帰時、再確認ボタンで取得します。";
      } catch (e) {
        retryAt = Date.now() + TTL;
        status.textContent =
          "出演者評価の取得に失敗しました。作品の枠表示は維持します。\n" + (e.name === "AbortError" ? "APIタイムアウト" : e.message);
        console.warn("[Card Rarity]", e);
      } finally {
        busy = false;
      }
    }
    function scan() {
      decorateAll();
      refresh();
    }
    function schedule() {
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        scan();
      }, 140);
    }
    function forceRefresh() {
      cache.clear();
      retryAt = 0;
      schedule();
    }
    launch.onclick = () => {
      panel.style.display = panel.style.display === "block" ? "none" : "block";
    };
    q(".scr-close").onclick = () => (panel.style.display = "none");
    q(".scr-refresh").onclick = forceRefresh;
    for (const b of panel.querySelectorAll(".scr-intensity button")) b.onclick = () => update({ intensity: b.dataset.value });
    for (const b of panel.querySelectorAll(".scr-motion button")) b.onclick = () => update({ motion: b.dataset.value });
    for (const [selector, key, type] of [
      [".scr-dim", "dimLow", "boolean"],
      [".scr-rm", "respectReducedMotion", "boolean"],
      [".scr-scenes", "sceneEnabled", "boolean"],
      [".scr-actors", "actorsEnabled", "boolean"],
      [".scr-scope", "actorScope", "string"],
    ])
      q(selector).onchange = (e) => update({ [key]: type === "boolean" ? e.target.checked : e.target.value });

    // 出演者チップ：1回目のクリックでカードを固定表示、表示中にもう一度クリックで閉じる（ページへはカード内のボタン）。
    // Ctrl／Shift／Alt／中ボタンのクリックは通常のリンク動作（新しいタブ等）。
    document.addEventListener(
      "click",
      (e) => {
        if (actorBypass || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        const a = e.target instanceof Element ? e.target.closest("a.vsc-performer[href]") : null;
        if (!a) return;
        const p = actorForAnchor(a);
        if (!p) return; // 出演者情報が未取得ならそのままページへ
        if (actorPopupAnchor === a && actorPopup?.style.display === "block") {
          if (Date.now() - actorOpenedAt < ACTOR_DOUBLE_GUARD) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          // 開いている時にもう一度押すと閉じる（出演者ページへはカード内の「出演者ページ →」で）
          e.preventDefault();
          e.stopPropagation();
          hideActorPopup();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        clearTimeout(actorPopupTimer);
        showActorPopup(a, p);
        actorOpenedAt = Date.now();
      },
      true,
    );
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (actorPopup?.style.display !== "block" || !(e.target instanceof Element)) return;
        if (actorPopup.contains(e.target) || e.target.closest("a.vsc-performer[href]")) return;
        hideActorPopup();
      },
      true,
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && actorPopup?.style.display === "block") hideActorPopup();
      else if (e.key === "Escape") hideMore();
    });

    new MutationObserver((ms) => {
      if (
        ms.some((m) => {
          const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
          if (el?.closest("#scr-settings,#scr-launch")) return false;
          return (
            // Sharp Covers が表紙を縮小画像（data:）に差し替えただけの変化は無視
            (!!el?.closest(".scene-card") && !(m.type === "attributes" && m.attributeName === "src" && el.getAttribute("src")?.startsWith("data:"))) ||
            [...m.addedNodes].some(
              (n) => n.nodeType === 1 && (n.matches?.(".scene-card,.valkyr-scene-card") || n.querySelector?.(".scene-card")),
            )
          );
        })
      )
        schedule();
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["href", "src", "class"] });
    global.addEventListener(
      "scroll",
      (e) => {
        actorScrollSuppressUntil = Date.now() + 450;
        clearTimeout(actorPopupTimer);
        actorPopupTimer = null;
        actorAnchorHover = false;
        hideActorPopup();
        if (!(morePop && e.target instanceof Node && morePop.contains(e.target))) hideMore();
        // カードの見え隠れは IntersectionObserver が拾う
      },
      true,
    );
    global.addEventListener("resize", () => {
      hideActorPopup();
      hideMore();
      schedule();
    });
    global.addEventListener("popstate", schedule);
    global.addEventListener("focus", () => {
      for (const e of cache.values()) e.at = 0;
      retryAt = 0;
      schedule();
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        retryAt = 0;
        schedule();
      }
    });
    setInterval(schedule, TTL);
    global.StashCardRarity = {
      version: VERSION,
      refresh: forceRefresh,
      openSettings: () => (panel.style.display = "block"),
      setTheme: (theme) => update({ theme }),
      setIntensity: (intensity) => update({ intensity }),
      core: Core,
    };
    configure();
    scan();
    console.info("[Stash Card Rarity " + VERSION + "] 起動しました。");
  }
  if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})(typeof globalThis !== "undefined" ? globalThis : this);

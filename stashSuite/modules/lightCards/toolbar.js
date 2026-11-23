"use strict";
// Light Scene Cards：一覧の上のボタン（縦型⇔横型の切り替え・設定）、設定パネル、タグの一覧、Valkyr との切り替え。
// React の外（普通の DOM）で作る。ツールバーは Stash が描き直すので、無ければ置き直す。
(function () {
  const LC = window.LightCards;
  if (!LC || LC.toolbarReady) return;
  LC.toolbarReady = true;
  const { store, ITEMS, gql } = LC;
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const ICON_TALL =
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="1.5" y="1.5" width="5.5" height="5" rx="1" fill="currentColor"/><rect x="1.5" y="8" width="5.5" height="1.6" rx=".8" fill="currentColor"/><rect x="1.5" y="11" width="4" height="1.6" rx=".8" fill="currentColor"/><rect x="9" y="1.5" width="5.5" height="5" rx="1" fill="currentColor"/><rect x="9" y="8" width="5.5" height="1.6" rx=".8" fill="currentColor"/><rect x="9" y="11" width="4" height="1.6" rx=".8" fill="currentColor"/></svg>';
  const ICON_SIDE =
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="1" y="2" width="4" height="5" rx="1" fill="currentColor"/><rect x="6" y="2.5" width="9" height="1.5" rx=".75" fill="currentColor"/><rect x="6" y="5" width="6" height="1.5" rx=".75" fill="currentColor"/><rect x="1" y="9" width="4" height="5" rx="1" fill="currentColor"/><rect x="6" y="9.5" width="9" height="1.5" rx=".75" fill="currentColor"/><rect x="6" y="12" width="6" height="1.5" rx=".75" fill="currentColor"/></svg>';
  const ICON_GEAR =
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M9.4 1l.4 1.9c.4.2.8.4 1.2.7l1.8-.6 1.4 2.4-1.4 1.3a5 5 0 010 1.4l1.4 1.3-1.4 2.4-1.8-.6c-.4.3-.8.5-1.2.7L9.4 15H6.6l-.4-1.9a5 5 0 01-1.2-.7l-1.8.6-1.4-2.4 1.4-1.3a5 5 0 010-1.4L1.8 6.6l1.4-2.4 1.8.6c.4-.3.8-.5 1.2-.7L6.6 1h2.8zM8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"/></svg>';

  // ---- ツールバーのボタン ----
  const ICON_COVER =
    '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="1" y="1.5" width="4" height="6" rx="1" fill="currentColor"/><rect x="6" y="1.5" width="4" height="6" rx="1" fill="currentColor"/><rect x="11" y="1.5" width="4" height="6" rx="1" fill="currentColor"/><rect x="1" y="8.5" width="4" height="6" rx="1" fill="currentColor"/><rect x="6" y="8.5" width="4" height="6" rx="1" fill="currentColor"/><rect x="11" y="8.5" width="4" height="6" rx="1" fill="currentColor"/></svg>';
  const group = el("div", "lc-toolbar btn-group");
  // 形の切り替え：縦型／横型／表紙だけ（押した形になる。今の形は色が付く）
  const LAYOUTS = [
    ["tall", ICON_TALL, "縦型（表紙が上・情報が下）"],
    ["side", ICON_SIDE, "横型（表紙が左・情報が右）"],
    ["cover", ICON_COVER, "表紙だけ（情報はマウスを乗せた時に表示）"],
  ];
  const layoutBtns = LAYOUTS.map(([value, icon, title]) => {
    const b = el("button", "btn btn-secondary lc-layout-btn");
    b.type = "button";
    b.innerHTML = icon;
    b.title = title;
    b.dataset.layout = value;
    b.onclick = () => store.set({ layout: value });
    return b;
  });
  // カードの大きさ（形ごとに覚える。Stash 本体の拡大スライダーの代わり。ページを移っても戻らない）
  const sizeBox = el("label", "lc-size");
  sizeBox.title = "カードの大きさ（左で小さく・多く並ぶ／右で大きく）";
  const size = el("input");
  size.type = "range";
  size.step = "10";
  sizeBox.append(size);
  size.oninput = () => {
    const s = store.get();
    store.set({ sizes: { ...s.sizes, [s.layout]: Number(size.value) } });
  };
  const gearBtn = el("button", "btn btn-secondary lc-gear-btn");
  gearBtn.type = "button";
  gearBtn.innerHTML = ICON_GEAR;
  gearBtn.title = "カードの表示設定";
  const switchBtn = el("button", "btn btn-secondary lc-switch-btn", "軽いカードに切り替え");
  switchBtn.type = "button";
  switchBtn.title = "Light Scene Cards を有効にします（ページを読み込み直します）";
  function paintButtons() {
    const s = store.get(),
      own = s.mode === "own";
    for (const b of layoutBtns) {
      b.classList.toggle("active", b.dataset.layout === s.layout);
      b.hidden = !own;
    }
    gearBtn.hidden = sizeBox.hidden = !own;
    switchBtn.hidden = own;
    group.classList.toggle("lc-off", !own);
    const [min, max] = LC.SIZE_RANGE[s.layout] || LC.SIZE_RANGE.tall;
    size.min = min;
    size.max = max;
    if (document.activeElement !== size) size.value = LC.sizeOf(s, s.layout);
  }
  gearBtn.onclick = () => (panel.hidden ? openPanel() : (panel.hidden = true));
  switchBtn.onclick = () => { store.set({ mode: "own" }); window.ServerStore?.flush?.().finally(() => location.reload()); };
  group.append(...layoutBtns, sizeBox, gearBtn, switchBtn);

  // Stash 本体のアイコンだけのボタンに、マウスを乗せた時の説明（日本語）を付ける
  const TITLES = {
    bookmark: "保存した絞り込み（呼び出し・保存）",
    filter: "絞り込みの条件を編集",
    "caret-down": "並びの向き（クリックで逆順）",
    "caret-up": "並びの向き（クリックで逆順）",
    ellipsis: "その他の操作（まとめて編集・削除など）",
    "table-cells-large": "表示：カード",
    list: "表示：一覧表",
    square: "表示：ウォール（画像だけ）",
    tags: "表示：タガー（まとめてタグ付け）",
  };
  function labelStashButtons(bar) {
    for (const b of bar.querySelectorAll("button, a.btn")) {
      if (b.closest(".lc-toolbar")) continue;
      const icon = b.querySelector("svg")?.getAttribute("data-icon"),
        t = icon && TITLES[icon];
      if (t && !/[぀-ヿ一-鿿]/.test(b.title)) b.title = t; // 説明なし・英語だけの物に
      if (!icon && b.closest(".sort-by-select") && !b.title) b.title = "並び替えの項目を選ぶ";
    }
  }
  // シーンのカードが並ぶ一覧（シーン・出演者・スタジオ・タグ等のシーン欄）のツールバーにだけ置く
  function place() {
    const anyBar = document.querySelector(".filtered-list-toolbar");
    if (anyBar) labelStashButtons(anyBar);
    const hasCards = document.querySelector(".lc-card, .valkyr-scene-card, .scene-card");
    const bar = hasCards && document.querySelector(".filtered-list-toolbar");
    if (!bar) {
      group.remove();
      return;
    }
    if (group.parentElement !== bar) bar.append(group);
  }
  setInterval(place, 700);

  // ---- 設定パネル ----
  const panel = el("section", "lc-panel");
  panel.hidden = true;
  document.body.append(panel);
  function radio(name, value, label, current) {
    const l = el("label", "lc-radio"),
      i = el("input");
    i.type = "radio";
    i.name = name;
    i.value = value;
    i.checked = current === value;
    i.onchange = () => store.set({ [name]: value });
    l.append(i, document.createTextNode(label));
    return l;
  }
  function openPanel() {
    const s = store.get();
    panel.replaceChildren();
    const head = el("div", "lc-panel-head");
    const close = el("button", "lc-close", "×");
    close.type = "button";
    close.title = "閉じる";
    close.onclick = () => (panel.hidden = true);
    head.append(el("strong", null, "カードの表示"), close);
    panel.append(head);

    const lay = el("div", "lc-row");
    lay.append(
      el("span", "lc-label", "形"),
      radio("layout", "tall", "縦型", s.layout),
      radio("layout", "side", "横型", s.layout),
      radio("layout", "cover", "表紙だけ", s.layout),
    );
    const cov = el("div", "lc-row");
    cov.append(
      el("span", "lc-label", "横型の表紙"),
      radio("sideCover", "front", "パッケージの表側だけ", s.sideCover),
      radio("sideCover", "full", "全体", s.sideCover),
    );
    const lines = el("div", "lc-row");
    lines.append(el("span", "lc-label", "タイトル"));
    for (const n of [1, 2, 3]) {
      const l = el("label", "lc-radio"),
        i = el("input");
      i.type = "radio";
      i.name = "titleLines";
      i.checked = s.titleLines === n;
      i.onchange = () => store.set({ titleLines: n });
      l.append(i, document.createTextNode(n + "行"));
      lines.append(l);
    }
    const prev = el("label", "lc-check-row"),
      pi = el("input");
    pi.type = "checkbox";
    pi.checked = s.preview;
    pi.onchange = () => store.set({ preview: pi.checked });
    prev.append(pi, document.createTextNode("表紙にマウスを乗せたらプレビュー"));
    const pm = el("div", "lc-row");
    pm.append(
      el("span", "lc-label", "プレビュー"),
      radio("previewMode", "source", "元動画を直接再生（生成不要）", s.previewMode),
      radio("previewMode", "video", "生成済みプレビュー（大量だと生成に時間）", s.previewMode),
      radio("previewMode", "scrub", "マウスの左右で場面送り", s.previewMode),
    );
    const tour = el("label", "lc-check-row"),
      ti = el("input");
    ti.type = "checkbox";
    ti.checked = s.autoTour !== false;
    ti.onchange = () => store.set({ autoTour: ti.checked });
    tour.append(ti, document.createTextNode("場面送りでマウスを止めておくと、数か所を自動で再生"));
    // 止めてから自動再生を始めるまでの秒数
    const wait = el("div", "lc-row");
    wait.append(el("span", "lc-label", "止めてから"), ...[0, 0.3, 0.5, 0.8, 1, 1.5, 2].map((sec) => radio("autoTourDelay", sec, sec + "秒", s.autoTourDelay ?? 1)));
    panel.append(lay, cov, lines, prev, pm, tour, wait, el("div", "lc-sub", "表示する項目"));

    const grid = el("div", "lc-items");
    for (const [key, label] of ITEMS) {
      const l = el("label", "lc-check-row"),
        i = el("input");
      i.type = "checkbox";
      i.checked = !!s.show[key];
      i.onchange = () => store.set({ show: { [key]: i.checked } });
      l.append(i, document.createTextNode(label));
      grid.append(l);
    }
    panel.append(grid);

    const foot = el("div", "lc-panel-foot");
    const reset = el("button", "lc-btn", "初期設定に戻す");
    reset.type = "button";
    reset.onclick = () => {
      store.set({ ...structuredClone(LC.DEFAULTS), mode: store.get().mode });
      openPanel();
    };
    const back = el("button", "lc-btn", "Stash 標準のカードに戻す");
    back.type = "button";
    back.title = "Light Scene Cards をオフにして標準のカードに戻します（ページを読み込み直します）";
    back.onclick = () => {
      store.set({ mode: "off" });
      window.ServerStore?.flush?.().finally(() => location.reload());
    };
    foot.append(reset, back);
    panel.append(foot);
    panel.hidden = false;
    const r = gearBtn.getBoundingClientRect();
    panel.style.top = Math.round(r.bottom + 6) + "px";
    panel.style.left = Math.round(Math.max(8, Math.min(r.right - panel.offsetWidth, innerWidth - panel.offsetWidth - 8))) + "px";
  }
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (panel.hidden || !(e.target instanceof Element)) return;
      if (panel.contains(e.target) || e.target.closest(".lc-gear-btn")) return;
      panel.hidden = true;
    },
    true,
  );

  // ---- Valkyr との切り替え ----
  // 両方が有効だと Valkyr が外側でカードごとの問い合わせを続けるので、片方だけを有効にして読み込み直す
  async function switchTo(mode) {
    switchBtn.disabled = true;
    try {
      const r = await gql("mutation($m:BoolMap!){setPluginsEnabled(enabledMap:$m)}", { m: { ValkyrSceneCards: mode === "valkyr" } });
      if (r.errors) throw new Error(r.errors[0].message);
      store.set({ mode });
      await window.ServerStore?.flush?.();
      location.reload();
    } catch (e) {
      switchBtn.disabled = false;
      alert("切り替えられませんでした: " + (e.message || e));
    }
  }

  // ---- タグのクリック：ミニプレイヤーのタグと同じ（Tag Weighted Recommendations の好き嫌いポップオーバー）----
  // もう一度押すと閉じる。Ctrl／Shift／中ボタンのクリックは普通のリンク（タグページ）
  LC.tagClick = (e, tag) => {
    const twr = window.StashTagWeightedRecommendations;
    if (!twr?.openTagRating || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    e.stopPropagation();
    const a = e.currentTarget;
    if (twr.tagRatingOpenFor?.(a)) twr.closeTagRating();
    else twr.openTagRating(a, { id: String(tag.id), name: tag.name });
  };
  // 出演者：1回目で出演者のカード（ミニプレイヤーの物）、もう一度で閉じる。カードの「この出演者で絞り込む →」でこの一覧を絞り込む
  LC.performerClick = (e, p) => {
    const mini = window.StashMiniPlayer;
    if (!mini?.performerTip || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    e.stopPropagation();
    mini.performerTip(e.currentTarget, p);
  };
  // 出演者・タグのリンク先：その人・タグで絞り込んだ動画の一覧（並べ方などは今の一覧のまま）。
  // 好みの評価の「↗」・出演者のカードの「絞り込む →」はこのリンク先へ移る
  // 絞り込みの URL は共通の土台（Suite Core）に任せる
  LC.listTo = (type, item) => window.Suite.listTo(type, item);

  const TAG_TITLE = "クリックで好みを評価（もう一度で閉じる）。評価の ↗ でこのタグに絞り込む";

  // ---- タグの一覧（カードのタグ数ボタン） ----
  const pop = el("div", "lc-pop");
  pop.hidden = true;
  document.body.append(pop);
  let popOwner = null;
  LC.showTags = (btn, tags) => {
    if (popOwner === btn && !pop.hidden) {
      pop.hidden = true;
      popOwner = null;
      return;
    }
    pop.replaceChildren(
      ...tags.map((t) => {
        const a = el("a", "lc-tag", t.name);
        a.href = LC.listTo("tag", t);
        if (window.StashTagWeightedRecommendations?.openTagRating) a.title = TAG_TITLE;
        a.addEventListener("click", (e) => LC.tagClick(e, t));
        return a;
      }),
    );
    pop.hidden = false;
    popOwner = btn;
    const r = btn.getBoundingClientRect(),
      w = pop.offsetWidth,
      hh = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + "px";
    pop.style.top = (r.bottom + 4 + hh > innerHeight - 8 ? r.top - 4 - hh : r.bottom + 4) + "px";
  };
  const hidePop = () => {
    pop.hidden = true;
    popOwner = null;
  };
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (pop.hidden || !(e.target instanceof Element)) return;
      if (pop.contains(e.target) || e.target.closest(".lc-tags")) return;
      hidePop();
    },
    true,
  );
  addEventListener("scroll", (e) => (e.target instanceof Node && pop.contains(e.target) ? null : hidePop()), true);
  addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    hidePop();
    panel.hidden = true;
  });

  store.subscribe(() => {
    paintButtons();
    if (!panel.hidden) openPanel();
  });
  paintButtons();
})();

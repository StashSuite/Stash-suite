"use strict";
// View Mode：上のメニューの「女｜男｜両方」の切り替え
//   ・押すとそのモードを覚えて（serverStore でサーバーにも）、ページを読み込み直す
//     （Stash は一度読んだ一覧を覚えているので、読み込み直さないと前のモードの一覧が出る）
//   ・今のモードは上のメニューの下の帯の色でも分かる（女＝ピンク・男＝青・両方＝色なし）
(function () {
  const VM = window.ViewMode;
  if (!VM?.intercept || VM.pill) return;
  VM.pill = true;

  const MODES = [
    ["f", "女", "男系のタグ（男の娘・女装・ニューハーフ・Shemale・Ladyboy・ゲイなど）が無い動画"],
    ["m", "男", "男系のタグ（男の娘・女装・ニューハーフ・Shemale・Ladyboy・ゲイなど）が付いた動画"],
    ["all", "両方", "全部の動画"],
  ];
  const style = document.createElement("style");
  style.textContent = `
.vm-pill { display: inline-flex; flex: none; align-items: center; margin: 0 8px; border: 1px solid #3a4a5b; border-radius: 999px; overflow: hidden; background: #141b23; }
.vm-pill button { white-space: nowrap; padding: 3px 13px; border: 0; background: transparent; color: #9eacba; font: 700 13px/1.5 system-ui, sans-serif; cursor: pointer; }
.vm-pill button:hover { color: #fff; background: #223040; }
.vm-pill button.on[data-m="f"] { background: #c2456f; color: #fff; }
.vm-pill button.on[data-m="m"] { background: #2f6fc0; color: #fff; }
.vm-pill button.on[data-m="all"] { background: #4a5866; color: #fff; }
.vm-more { margin-right: 8px; padding: 0 8px; border: 0; border-radius: 6px; background: transparent; color: #6f7f90; font-size: 16px; line-height: 26px; cursor: pointer; }
.vm-more:hover { background: #223040; color: #dfe7ef; }
.vm-menu { position: fixed; z-index: 1100; display: flex; flex-direction: column; min-width: 220px; padding: 4px; border: 1px solid #3a4a5b; border-radius: 8px; background: #141b23; box-shadow: 0 8px 24px #000a; }
.vm-menu button { padding: 6px 10px; border: 0; border-radius: 5px; background: transparent; color: #dfe7ef; font: 13px system-ui, sans-serif; text-align: left; cursor: pointer; }
.vm-menu button:hover { background: #223040; }
body[data-vm="f"] .top-nav { box-shadow: inset 0 -3px 0 #c2456f; }
body[data-vm="m"] .top-nav { box-shadow: inset 0 -3px 0 #2f6fc0; }
`;
  document.head.append(style);

  function set(m) {
    if (m === VM.mode()) return;
    localStorage.setItem(VM.KEY, JSON.stringify(m));
    // サーバーへの保存を待ってから読み込み直す（serverStore は少し待ってまとめて送るので、すぐ送らせる）
    Promise.resolve(window.ServerStore?.flush?.())
      .catch(() => {})
      .finally(() => location.reload());
  }

  // 「⋯」：ふだん隠している動画（アニメ・ゴミ候補）を見る入口。目立たないよう、押した時だけ小さなメニューを出す
  const enc = (o) => JSON.stringify(o).replace(/\{/g, "(").replace(/\}/g, ")");
  function showHidden(id, name) {
    const p = new URLSearchParams();
    p.set("c", enc({ type: "tags", value: { items: [{ id, label: name }], depth: 0, excluded: [] }, modifier: "INCLUDES_ALL" }));
    history.pushState({}, "", "/scenes?" + p.toString());
    dispatchEvent(new PopStateEvent("popstate"));
  }
  function moreButton() {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "vm-more";
    b.textContent = "⋯";
    b.title = "ふだん隠している動画を見る";
    b.onclick = (e) => {
      e.stopPropagation();
      const old = document.querySelector(".vm-menu");
      if (old) return old.remove();
      const menu = document.createElement("div");
      menu.className = "vm-menu";
      for (const [label, k, name] of [
        ["アニメ・3DCG の動画を見る", "a", "整理:アニメ"],
        ["ゴミ候補の動画を見る", "j", "整理:ゴミ候補"],
      ]) {
        const id = VM.tagIds()[k];
        if (!id) continue;
        const it = document.createElement("button");
        it.type = "button";
        it.textContent = label;
        it.onclick = () => {
          menu.remove();
          showHidden(id, name);
        };
        menu.append(it);
      }
      const r = b.getBoundingClientRect();
      Object.assign(menu.style, { top: r.bottom + 4 + "px", left: Math.max(8, r.right - 220) + "px" });
      document.body.append(menu);
      setTimeout(() => addEventListener("pointerdown", (ev) => !menu.contains(ev.target) && menu.remove(), { once: true, capture: true }));
    };
    return b;
  }
  function pill() {
    const box = document.createElement("div");
    box.className = "vm-pill";
    for (const [m, label, title] of MODES) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.m = m;
      b.textContent = label;
      b.title = title;
      b.className = m === VM.mode() ? "on" : "";
      b.onclick = () => set(m);
      box.append(b);
    }
    return box;
  }

  // 上のメニューの右側のボタンの前に置く（メニューが作り直されたら置き直す）
  function place() {
    if (!VM.isEnabled?.()) {
      delete document.body.dataset.vm;
      document.querySelector(".vm-pill")?.remove();
      document.querySelector(".vm-more")?.remove();
      return;
    }
    document.body.dataset.vm = VM.mode();
    if (document.querySelector(".vm-pill")) return;
    const right = document.querySelector(".top-nav .navbar-buttons");
    const hasHidden = !!(VM.tagIds().a || VM.tagIds().j);
    if (right) right.prepend(...(hasHidden ? [pill(), moreButton()] : [pill()]));
  }
  new MutationObserver(place).observe(document.body, { childList: true, subtree: true });
  place();
})();

"use strict";
// View Mode：動画の一覧の上の段
//   ・男モードの時：「男モード全部｜日本の女装｜Shemale｜Ladyboy｜ゲイ」で、押すだけで絞り込む（子タグも含める）
//   ・アニメ・ゴミ候補を見ている間だけ「戻る」ボタン（見るのは上のメニューの「⋯」から。mode.js）
//   女／男の分け方はタグで決まる（親タグ「男系（男モード）」の下のタグ。intercept.js）ので、ここで印を付け直すことはしない
(function () {
  const VM = window.ViewMode;
  if (!VM?.intercept || VM.bar) return;
  VM.bar = true;

  const gql = (query, variables) =>
    fetch("/graphql", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, variables }) })
      .then((r) => r.json())
      .then((j) => {
        if (j.errors) throw new Error(j.errors[0].message);
        return j.data;
      });

  const style = document.createElement("style");
  style.textContent = `
.vm-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 6px 0 10px; }
.vm-bar button { padding: 3px 12px; border: 1px solid #3a4a5b; border-radius: 6px; background: #1a2430; color: #dfe7ef; font: 600 12.5px/1.5 system-ui, sans-serif; cursor: pointer; }
.vm-bar button:hover { border-color: #6fa8ff; }
.vm-bar button.on { background: #2f6fc0; border-color: #2f6fc0; color: #fff; }
.vm-bar button.vm-hidden { border-style: dashed; color: #9eacba; }
.vm-bar button.vm-hidden.on { background: #6a4a10; border-color: #ffd27a; color: #ffe2a0; border-style: solid; }
`;
  document.head.append(style);

  // 小分けのボタン（タグの名前）
  const SUBS = [
    ["日本の女装", "日本の女装・ニューハーフ"],
    ["Shemale", "Shemale"],
    ["Ladyboy", "Ladyboy"],
    ["ゲイ", "ゲイ"],
  ];
  let tags = null; // 名前 → id
  const loadTags = () =>
    (tags ||= gql('{findTags(tag_filter:{name:{value:"^(日本の女装・ニューハーフ|Shemale|Ladyboy|ゲイ)$",modifier:MATCHES_REGEX}}){tags{id name}}}').then((d) =>
      Object.fromEntries(d.findTags.tags.map((t) => [t.name, t.id])),
    ));

  // Stash の一覧の URL の絞り込み（JSON の {} を () にした形）
  const enc = (o) => JSON.stringify(o).replace(/\{/g, "(").replace(/\}/g, ")");
  function go(tag) {
    const cur = new URLSearchParams(location.search),
      p = new URLSearchParams();
    if (tag) p.set("c", enc({ type: "tags", value: { items: [{ id: tag.id, label: tag.name }], depth: -1, excluded: [] }, modifier: "INCLUDES_ALL" }));
    for (const k of ["sortby", "sortdir", "perPage", "disp", "z"]) if (cur.get(k)) p.set(k, cur.get(k));
    history.pushState({}, "", "/scenes?" + p.toString());
    dispatchEvent(new PopStateEvent("popstate"));
  }
  const current = (id) => [...new URLSearchParams(location.search).getAll("c")].some((c) => c.includes(`"id":"${id}"`));
  const button = (label, title, on, onclick, cls = "") => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.title = title;
    b.className = cls + (on ? " on" : "");
    b.onclick = onclick;
    return b;
  };

  async function bar() {
    const box = document.createElement("div");
    box.className = "vm-bar";
    if (VM.mode() === "m") {
      const t = await loadTags().catch(() => ({}));
      const anySub = SUBS.some(([, name]) => t[name] && current(t[name]));
      box.append(button("男モード全部", "絞り込みを外して、男モードの動画を全部出す", !anySub, () => go(null)));
      for (const [label, name] of SUBS)
        if (t[name]) box.append(button(label, `「${name}」の動画だけ（子タグも含める）`, current(t[name]), () => go({ id: t[name], name })));
    }
    // ふだん隠している動画（アニメ・ゴミ候補）は、上のメニューの「⋯」から見る（mode.js）。見ている間だけ、ここに戻るボタンを出す
    for (const [label, k] of [
      ["アニメを見ている（戻る）", "a"],
      ["ゴミ候補を見ている（戻る）", "j"],
    ]) {
      const id = VM.tagIds()[k];
      if (id && current(id)) box.append(button(label, "絞り込みを外して、ふだんの一覧に戻る", true, () => go(null), "vm-hidden"));
    }
    if (!box.childElementCount) return null;
    return box;
  }

  // 動画の一覧の上の操作の下に置く。URL が変わったら作り直す（押した状態を合わせる）
  let shownFor = "",
    noBar = false,
    building = false;
  async function place() {
    const onList = location.pathname.replace(/\/+$/, "") === "/scenes";
    const old = document.querySelector(".vm-bar");
    if (!onList) {
      shownFor = "";
      return old?.remove();
    }
    const key = location.search;
    const toolbar = document.querySelector(".filtered-list-toolbar");
    // 同じ URL で作り終わっていれば作り直さない（出す物が無い時＝段を出さない時も）
    if (!toolbar || building || (shownFor === key && (old || noBar))) return;
    building = true;
    try {
      const b = await bar();
      document.querySelector(".vm-bar")?.remove();
      if (b) (document.querySelector(".filtered-list-toolbar") || toolbar).after(b);
      noBar = !b;
      shownFor = key;
    } finally {
      building = false;
    }
  }
  new MutationObserver(() => place()).observe(document.body, { childList: true, subtree: true });
  addEventListener("popstate", () => setTimeout(place, 50));
  place();
})();

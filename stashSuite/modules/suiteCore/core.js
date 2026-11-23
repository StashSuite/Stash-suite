// Suite Core：Stash Suiteの共通の土台（window.Suite）
// 各プラグインはここにある物を使い、同じ処理を自分で書き直さない
//   Suite.gql(query, vars)      … GraphQL（エラーなら例外）
//   Suite.navigate(path)        … Stash の中で画面を移る（再読み込みしない）
//   Suite.listTo(kind, item)    … 出演者・スタジオ・タグ・グループで絞り込んだシーン一覧の URL（今の並び順・件数は残す）
//   Suite.el(tag, cls, text)    … 要素を作る
//   Suite.NG.test(text)         … 子どもを連想させる作品か（ng.js。正本は整備ハブの hublib.py）
//   Suite.css(id, text)         … 見た目を足す（プラグインの CSS がブラウザに古いまま残る問題を避ける）
//   色の決まり：:root の --suite-*（ボタン・強調・札・枠）
(function () {
  "use strict";
  const S = (window.Suite = window.Suite || {});
  S.version = "1.0.0";

  S.gql = async (query, variables) => {
    const r = await fetch("/graphql", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, variables: variables || {} }) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    if (j.errors?.length) throw new Error(j.errors.map((e) => e.message).join("\n"));
    return j.data;
  };

  S.navigate = (path) => {
    if (path === location.pathname + location.search) return;
    const old = history.state,
      state = { usr: null, key: Math.random().toString(36).slice(2, 10) };
    if (Number.isFinite(old?.idx)) state.idx = old.idx + 1;
    history.pushState(state, "", path);
    window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
  };

  const CRIT = {
    performer: (items) => ({ type: "performers", value: { items, excluded: [] }, modifier: "INCLUDES_ALL" }),
    studio: (items) => ({ type: "studios", value: { items, depth: 0, excluded: [] }, modifier: "INCLUDES" }),
    tag: (items) => ({ type: "tags", value: { items, depth: 0, excluded: [] }, modifier: "INCLUDES_ALL" }),
    group: (items) => ({ type: "groups", value: { items, excluded: [] }, modifier: "INCLUDES" }),
  };
  S.listTo = (kind, item) => {
    const c = (CRIT[kind] || CRIT.tag)([{ id: String(item.id), label: item.name || String(item.id) }]);
    const cur = location.pathname.replace(/\/+$/, "") === "/scenes" ? new URLSearchParams(location.search) : new URLSearchParams();
    const p = new URLSearchParams();
    p.set("c", JSON.stringify(c).replace(/\{/g, "(").replace(/\}/g, ")"));
    for (const k of ["sortby", "sortdir", "perPage", "disp", "z"]) if (cur.get(k)) p.set(k, cur.get(k));
    return "/scenes?" + p.toString();
  };

  S.el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  S.css = (id, text) => {
    let st = document.getElementById(id);
    if (!st) {
      st = document.createElement("style");
      st.id = id;
      document.head.append(st);
    }
    if (st.textContent !== text) st.textContent = text;
  };

  // 色・角・文字の大きさの決まり（各プラグインはこれを使ってそろえる）
  S.css(
    "suite-tokens",
    `:root{
  --suite-bg:#1c252e; --suite-panel:#1f2a33; --suite-raise:#2a3642; --suite-line:#3a4a57;
  --suite-text:#e6edf3; --suite-sub:#8b9aa6;
  --suite-accent:#3a6ea5; --suite-accent-hi:#4f88c6; --suite-link:#7fd4ff; --suite-star:#ffc94d;
  --suite-badge-bg:#000000a6; --suite-radius:6px; --suite-radius-pill:10px; --suite-font-sm:12px;
}`,
  );
})();

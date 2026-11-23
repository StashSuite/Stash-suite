"use strict";
// View Mode：Stash への動画・出演者の問い合わせに、選んでいるモードの絞り込みを足す
//   ・男モード：親タグ「男系（男モード）」の下のタグ（男の娘・女装・ニューハーフ・Shemale・Ladyboy・ゲイなど）が付いた動画だけ
//   ・女モード：それ以外の全部（男系のタグが無い動画）
//     印のタグは使わない（Stash のタガーで保存するとタグが置き換わって印が消えるため）。男モードに入れたいタグは、親を「男系（男モード）」にする
//   ・出演者：男モード＝男系の動画に出ている人、女モード＝男系以外の動画に出ている人（男の娘の出演者も性別は「女性」のことが多いので、性別では分けない）
//   ・「整理:アニメ」「整理:ゴミ候補」の動画は、どのモードでも出さない（そのタグで絞り込んだ時だけ出す）
//   ・効く画面：ホーム・動画の一覧・出演者の一覧（おすすめの並べ替えもこの一覧の中）と Binge のページ。
//     動画や出演者の詳しいページ・整備ハブなどの道具には効かない
//   ・このファイルは Binge のページ（/plugin/binge/assets/index.html）にも読み込ませるので、Stash の PluginApi を使わない
(function () {
  if (window.ViewMode?.intercept) return;
  const VM = (window.ViewMode = window.ViewMode || {});
  const KEY = "viewMode.mode", // "f"＝女・"m"＝男・"all"＝両方（serverStore でサーバーにも保存）
    IDS_KEY = "viewMode.tagIds2"; // 男系の親タグ・隠す印のタグの番号（名前から調べ直して覚える）
  const read = (k, d) => {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? d;
    } catch {
      return d;
    }
  };
  const isEnabled = () => !!read("suite.prefs", {}).viewModeEnabled;
  VM.isEnabled = isEnabled;
  const mode = () => {
    if (!isEnabled()) return "all";
    const m = read(KEY, "all");
    return m === "f" || m === "m" ? m : "all";
  };
  let ids = { m: null, a: null, j: null, ...read(IDS_KEY, {}) }; // m＝男系（男モード）の親タグ
  VM.mode = mode;
  VM.KEY = KEY;
  VM.tagIds = () => ids;

  const orig = window.fetch;
  // 印のタグの番号を名前から調べ直す（消して作り直した時のため）
  orig("/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: '{findTags(tag_filter:{name:{value:"^(男系（男モード）|整理:アニメ|整理:ゴミ候補)$",modifier:MATCHES_REGEX}}){tags{id name}}}' }),
  })
    .then((r) => r.json())
    .then((j) => {
      const t = j.data?.findTags?.tags || [];
      const by = (n) => t.find((x) => x.name === n)?.id;
      const next = { m: by("男系（男モード）"), a: by("整理:アニメ"), j: by("整理:ゴミ候補") };
      ids = { m: next.m || null, a: next.a || null, j: next.j || null };
      localStorage.setItem(IDS_KEY, JSON.stringify(ids));
    })
    .catch(() => {});

  // 効く画面か
  const applies = () => {
    const p = location.pathname.replace(/\/+$/, "") || "/";
    return p === "/" || p === "/scenes" || p === "/performers" || p.startsWith("/plugin/binge/");
  };
  // 男系かどうか（子タグも含める）。どのモードも「全部含む＋除外リスト（excludes）」の形にする。
  // Split Parts（分割の続きを隠す）は、条件がある時はその excludes に足すので、「除く」形（EXCLUDES）にすると続きが隠れなくなる
  const modeCond = (m, hide = []) =>
    m === "m" && ids.m
      ? { tags: { value: [ids.m], modifier: "INCLUDES_ALL", depth: -1, excludes: hide } }
      : m === "f" && ids.m
        ? { tags: { value: [], modifier: "INCLUDES_ALL", depth: -1, excludes: [ids.m, ...hide] } }
        : hide.length
          ? { tags: { value: [], modifier: "INCLUDES_ALL", depth: 0, excludes: hide } }
          : null;
  // 動画：モードの条件と、隠す物（アニメ・ゴミ候補）を出さない条件を、1 つのタグの条件にまとめる
  // （Stash は同じタグの条件を重ねると片方を無視することがあるため）。
  // 隠す物は、そのタグで絞り込んでいる時（一覧の上の「アニメ」「ゴミ候補」ボタン）だけ出す
  const sceneCond = (m, f) => {
    const asked = JSON.stringify(f || {});
    return modeCond(m, ["a", "j"].map((k) => ids[k]).filter((id) => id && !asked.includes(`"${id}"`)));
  };
  // 元の絞り込みにモードの条件を足す。Stash はタグの条件を AND で重ねると片方を無視することがあるので、
  // 元の絞り込みにタグの条件があれば、その 1 つの条件に足し込む（含める物は「全部含む」に、除く物は excludes に）。
  // 足し込めない形（「どれかを含む」で複数など）の時だけ AND でつなぐ
  const join = (cond, f) => {
    if (!cond) return f;
    if (!f || !Object.keys(f).length) return cond;
    const key = Object.keys(cond)[0]; // tags（動画）か scenes_filter（出演者）
    if (!f[key]) return { ...f, [key]: cond[key] };
    if (key !== "tags") return { ...cond, AND: f };
    let t = { ...f.tags };
    const c = cond.tags;
    if (t.modifier === "EXCLUDES") {
      // 元が「除く」：除く物を excludes に移して、モードの条件の形にまとめる
      t = { value: c.value, modifier: c.modifier, depth: t.depth, excludes: [...(t.value || []), ...(t.excludes || []), ...(c.excludes || [])] };
    } else if (t.modifier === "INCLUDES_ALL" || (t.modifier === "INCLUDES" && (t.value || []).length <= 1)) {
      t.modifier = "INCLUDES_ALL";
      t.value = [...(t.value || []), ...c.value];
      t.excludes = [...(t.excludes || []), ...(c.excludes || [])];
    } else if (!c.value.length) {
      t.excludes = [...(t.excludes || []), ...(c.excludes || [])]; // 「どれかを含む」でも、除く物だけなら足せる
    } else return { ...cond, AND: f };
    if (c.depth === -1) t.depth = -1; // 男系の親タグは子タグを含めて見る
    return { ...f, tags: t };
  };

  function rewrite(b, m) {
    const q = String(b?.query || "");
    let changed = false;
    if (/\bfindScenes\s*\(/.test(q) && /\$scene_filter\s*:/.test(q)) {
      b.variables = b.variables || {};
      const cond = sceneCond(m, b.variables.scene_filter);
      if (cond) {
        b.variables.scene_filter = join(cond, b.variables.scene_filter);
        changed = true;
      }
    }
    if (m !== "all" && ids.m && /\bfindPerformers\s*\(/.test(q) && /\$performer_filter\s*:/.test(q)) {
      b.variables = b.variables || {};
      b.variables.performer_filter = join({ scenes_filter: modeCond(m) }, b.variables.performer_filter);
      changed = true;
    }
    return changed;
  }

  window.fetch = function (input, init) {
    try {
      const m = mode(),
        url = typeof input === "string" ? input : input?.url || "";
      if (isEnabled() && /\/graphql(?:\?|$)/.test(url) && typeof init?.body === "string" && applies()) {
        const b = JSON.parse(init.body);
        const list = Array.isArray(b) ? b : [b];
        if (list.map((x) => rewrite(x, m)).some(Boolean)) init = { ...init, body: JSON.stringify(b) };
      }
    } catch {}
    return orig.call(this, input, init);
  };
  VM.intercept = true;
})();

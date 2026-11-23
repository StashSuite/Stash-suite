// Quick Genres：左サイドバーの「お気に入りボード」（ジャンル一覧の代わり）
// ・出演者・スタジオ・タグ・作品を自由に貼っておける。並びはつかんで上下にドラッグで入れ替え、× で外す
// ・貼り方：上の「＋ 追加」で種類を選んで名前を検索 → 候補をクリック。ページのリンク（カードの出演者・タグ・題名など）を
//   ここへドラッグして落としても貼れる
// ・クリック：出演者・スタジオ・タグは今の一覧をそれで絞り込み（並び順などは維持）、作品はミニプレイヤーで再生
// ・保存は localStorage "quickGenres.board"（serverStore がサーバーに同期する）
(function () {
  "use strict";
  if (window.QuickBoard) return;
  // 男モードと女モードで別のボード（「両方」は2つを合わせて見せる。そこで貼った物は女用に入る）
  const KEY = "quickGenres.board",
    KEY_M = "quickGenres.board.m";
  const mode = () => window.ViewMode?.mode?.() || "all";
  const keyFor = () => (mode() === "m" ? KEY_M : KEY);
  const TYPES = { performer: "出演者", studio: "スタジオ", tag: "タグ", scene: "作品" };
  const read = (k) => {
    try {
      const v = JSON.parse(localStorage.getItem(k) || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
  const write = (k, list) => {
    try {
      localStorage.setItem(k, JSON.stringify(list));
    } catch {}
  };
  const same = (a, b) => a.type === b.type && a.id === b.id;
  // 今のモードで見せる一覧（両方＝女用のあとに男用の残り）
  const load = () => {
    if (mode() !== "all") return read(keyFor());
    const f = read(KEY);
    return f.concat(read(KEY_M).filter((x) => !f.some((y) => same(x, y))));
  };
  // 並べ替え・追加は今のモードの物へ（両方の時は女用。男用だけにある物は女用の後ろに付けない）
  const save = (list) => {
    if (mode() !== "all") return write(keyFor(), list);
    const m = read(KEY_M);
    write(KEY, list.filter((x) => !m.some((y) => same(x, y)) || read(KEY).some((y) => same(x, y))));
  };
  // 外す時は、両方の時は女用・男用のどちらからも外す
  const removeItem = (item) => {
    for (const k of mode() === "all" ? [KEY, KEY_M] : [keyFor()]) write(k, read(k).filter((y) => !same(y, item)));
  };
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  // 共通の土台（Suite Core）の物を使う
  const gql = (...a) => window.Suite.gql(...a);
  // 共通の土台（Suite Core）の物を使う
  const navigate = (...a) => window.Suite.navigate(...a);
  const hasImage = (u) => u && !/default=true/.test(u);

  // ---- 1件の情報（名前・画像）を取る ----
  const FIND = {
    performer: ["findPerformer", "id name image_path"],
    studio: ["findStudio", "id name image_path"],
    tag: ["findTag", "id name image_path"],
    scene: ["findScene", "id title files{basename} paths{screenshot}"],
  };
  async function fetchItem(type, id) {
    const [f, fields] = FIND[type];
    const x = (await gql(`query($id:ID!){${f}(id:$id){${fields}}}`, { id }))[f];
    if (!x) return null;
    if (type === "scene") return { type, id: String(x.id), name: x.title || x.files?.[0]?.basename || "作品 " + x.id, image: x.paths?.screenshot || "" };
    return { type, id: String(x.id), name: x.name, image: hasImage(x.image_path) ? x.image_path : "" };
  }
  function add(item) {
    if (!item) return;
    const list = load();
    if (list.some((x) => x.type === item.type && x.id === item.id)) return flash(item);
    list.push(item);
    save(list);
    render();
    syncFavorites();
  }

  // ---- Stash の ❤（お気に入り）とそろえる ----
  // ボードに貼った出演者・スタジオには ❤ を付ける（Discover はこの ❤ で新作を出す）。
  // ボードから外した時は、ボードが付けた ❤ だけ外す（自分で付けていた ❤ は残す）。男用・女用どちらのボードも対象
  const FAV_KEY = "quickGenres.boardFav"; // ボードが ❤ を付けた物 ["performer:12", "studio:3"]
  let favBusy = false;
  async function syncFavorites() {
    if (favBusy) return;
    favBusy = true;
    try {
      const want = new Set([...read(KEY), ...read(KEY_M)].filter((x) => x.type === "performer" || x.type === "studio").map((x) => x.type + ":" + x.id));
      const mine = new Set(read(FAV_KEY));
      const ids = (t) => [...want].filter((k) => k.startsWith(t + ":")).map((k) => k.split(":")[1]);
      // 今の ❤ の状態を聞いて、付いていない物にだけ付ける（自分で付けていた物は「ボードが付けた」に数えない）
      for (const t of ["performer", "studio"]) {
        const list = ids(t);
        if (!list.length) continue;
        const plural = t === "performer" ? "Performers" : "Studios";
        const d = await gql(`query($ids:[ID!]){find${plural}(ids:$ids,filter:{per_page:-1}){${t}s{id favorite}}}`, { ids: list }).catch(() => null);
        for (const x of d?.["find" + plural]?.[t + "s"] || []) {
          if (x.favorite) continue;
          await gql(`mutation($i:${t === "performer" ? "PerformerUpdateInput" : "StudioUpdateInput"}!){${t}Update(input:$i){id}}`, { i: { id: x.id, favorite: true } }).catch(() => null);
          mine.add(t + ":" + x.id);
        }
      }
      for (const k of [...mine]) {
        if (want.has(k)) continue;
        const [t, id] = k.split(":");
        await gql(`mutation($i:${t === "performer" ? "PerformerUpdateInput" : "StudioUpdateInput"}!){${t}Update(input:$i){id}}`, { i: { id, favorite: false } }).catch(() => null);
        mine.delete(k);
      }
      write(FAV_KEY, [...mine]);
    } finally {
      favBusy = false;
    }
  }
  // ページのリンク（/performers/1、/scenes/2、絞り込みの URL など）から種類と ID を読む
  function parseLink(href) {
    try {
      const u = new URL(href, location.origin);
      if (u.origin !== location.origin) return null;
      const m = u.pathname.match(/^\/(performers|studios|tags|scenes)\/(\d+)/);
      if (m) return { type: m[1].slice(0, -1), id: m[2] };
      const c = u.searchParams.getAll("c").map((x) => x.replace(/\(/g, "{").replace(/\)/g, "}"));
      for (const raw of c) {
        const o = JSON.parse(raw),
          it = o.value?.items?.[0];
        const type = { performers: "performer", studios: "studio", tags: "tag" }[o.type];
        if (type && it?.id) return { type, id: String(it.id) };
      }
    } catch {}
    return null;
  }

  // ---- クリック：絞り込み／再生 ----
  function open(item) {
    if (item.type === "scene") {
      if (window.StashMiniPlayer?.open) window.StashMiniPlayer.open(item.id);
      else navigate("/scenes/" + item.id);
      return;
    }
    const lt = window.LightCards?.listTo;
    if (lt) return navigate(lt(item.type, { id: item.id, name: item.name }));
    navigate("/" + item.type + "s/" + item.id);
  }

  // ---- 表示 ----
  let section = null;
  function flash(item) {
    const n = section?.querySelector(`.qb-item[data-key="${item.type}:${item.id}"]`);
    if (!n) return;
    n.classList.remove("flash");
    void n.offsetWidth;
    n.classList.add("flash");
  }
  function build() {
    const s = el("div", "sidebar-section qg-section qb-section");
    const head = el("div", "qg-head");
    head.append(el("span", "qg-title", "お気に入り" + ({ f: "（女）", m: "（男）", all: "（女＋男）" }[mode()] || "")));
    const addBtn = el("button", "qb-add", "＋ 追加");
    addBtn.type = "button";
    addBtn.title = "出演者・スタジオ・タグ・作品を検索して貼る";
    head.append(addBtn);
    const finder = buildFinder();
    finder.hidden = true;
    addBtn.onclick = () => {
      finder.hidden = !finder.hidden;
      if (!finder.hidden) finder.querySelector("input").focus();
    };
    s.append(head, finder, el("div", "qb-list"), el("div", "qg-hint", "ページの出演者・タグ・作品のリンクをここへドラッグしても貼れます。つかんで上下に動かすと並べ替え"));
    // ページのリンクを落として貼る
    s.addEventListener("dragover", (e) => {
      if (dragging) return;
      if ([...e.dataTransfer.types].some((t) => t === "text/uri-list" || t === "text/plain")) {
        e.preventDefault();
        s.classList.add("qb-drop");
      }
    });
    s.addEventListener("dragleave", (e) => {
      if (!s.contains(e.relatedTarget)) s.classList.remove("qb-drop");
    });
    s.addEventListener("drop", async (e) => {
      s.classList.remove("qb-drop");
      if (dragging) return;
      const href = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
      const p = href && parseLink(href.split("\n")[0].trim());
      if (!p) return;
      e.preventDefault();
      add(await fetchItem(p.type, p.id).catch(() => null));
    });
    return s;
  }
  function buildFinder() {
    const box = el("div", "qb-finder");
    const types = el("div", "qb-types");
    let type = "performer";
    for (const [k, label] of Object.entries(TYPES)) {
      const b = el("button", "qb-type" + (k === type ? " on" : ""), label);
      b.type = "button";
      b.onclick = () => {
        type = k;
        types.querySelectorAll(".qb-type").forEach((x) => x.classList.toggle("on", x === b));
        search();
      };
      types.append(b);
    }
    const input = el("input", "qb-q form-control");
    input.placeholder = "名前で検索";
    const results = el("div", "qb-results");
    box.append(types, input, results);
    let timer = 0,
      seq = 0;
    input.oninput = () => {
      clearTimeout(timer);
      timer = setTimeout(search, 250);
    };
    async function search() {
      const q = input.value.trim(),
        my = ++seq;
      results.replaceChildren();
      if (!q) return;
      const plural = { performer: "Performers", studio: "Studios", tag: "Tags", scene: "Scenes" }[type];
      const fields = type === "scene" ? "id title files{basename} paths{screenshot}" : "id name image_path";
      const d = await gql(`query($q:String!){find${plural}(filter:{q:$q,per_page:12}){${type}s{${fields}}}}`, { q }).catch(() => null);
      if (my !== seq || !d) return;
      for (const x of d["find" + plural][type + "s"]) {
        const item =
          type === "scene"
            ? { type, id: String(x.id), name: x.title || x.files?.[0]?.basename || "作品 " + x.id, image: x.paths?.screenshot || "" }
            : { type, id: String(x.id), name: x.name, image: hasImage(x.image_path) ? x.image_path : "" };
        const b = el("button", "qb-result");
        b.type = "button";
        b.append(face(item), el("span", "qb-name", item.name));
        b.title = item.name + " を貼る";
        b.onclick = () => add(item);
        if (type === "studio" || type === "tag") {
          // 「まとめる」：このスタジオ・タグの作品を、一覧で1枚にまとめる
          const m = el("span", "qb-bundle-add", "まとめる");
          m.title = item.name + " の作品を一覧で1枚にまとめる";
          m.onclick = (e) => {
            e.stopPropagation();
            addBundle(type === "studio" ? { studio: item.name } : { tags: [item.name], name: item.name });
          };
          b.append(m);
        }
        results.append(b);
      }
      if (!results.children.length) results.append(el("div", "qg-empty", "見つかりません"));
      // ファイル名・題名の語でまとめる（スタジオやタグが無い系統）
      const w = el("button", "qb-result qb-words");
      w.type = "button";
      w.append(el("span", "qb-face", "≡"), el("span", "qb-name", "「" + q + "」がファイル名・題名に入った作品をまとめる"));
      w.onclick = () => addBundle({ words: [q], name: q });
      results.append(w);
    }
    return box;
  }
  function face(item) {
    const f = el("span", "qb-face qb-" + item.type);
    if (item.image) f.style.backgroundImage = `url("${item.image}")`;
    else f.textContent = { performer: "人", studio: "社", tag: "#", scene: "▶" }[item.type];
    return f;
  }
  let dragging = null,
    dragType = null;
  // ---- まとめ（整備ハブの assets/bundles.json で定義した組）----
  // ボードの一番下に「まとめ」として並べる。押すと、そのまとめの中身を全部並べる
  let bundleCache = null;
  async function bundleItems() {
    if (bundleCache && Date.now() - bundleCache.at < 60000) return bundleCache.items;
    const rules = await fetch("/plugin/libraryHub/assets/bundles.json", { cache: "no-store" }).then((r) => r.json()).catch(() => []);
    const items = [];
    for (const r of rules) {
      if (r.studio) {
        const d = await gql("query($n:String!){findStudios(studio_filter:{name:{value:$n,modifier:EQUALS}}){studios{id name scene_count image_path}}}", { n: r.studio }).catch(() => null);
        const x = d?.findStudios.studios[0];
        items.push({ rule: r, kind: "studio", id: x ? String(x.id) : null, name: r.studio, count: x?.scene_count || 0, image: x && hasImage(x.image_path) ? x.image_path : "" });
      } else if (r.tags || r.words) {
        const label = r.name || (r.tags || r.words).join("・");
        const d = await gql("query($n:String!){findTags(tag_filter:{name:{value:$n,modifier:EQUALS}}){tags{id name scene_count}}}", { n: "まとめ:" + label }).catch(() => null);
        const x = d?.findTags.tags[0];
        items.push({ rule: r, kind: "tag", id: x ? String(x.id) : null, name: x?.name || "まとめ:" + label, label, count: x?.scene_count || 0, image: "" });
      }
    }
    bundleCache = { at: Date.now(), items };
    return items;
  }
  // 決まりを保存して付け直す（整備ハブのサーバー側。数秒かかる）
  async function saveBundles(rules, msg) {
    bundleCache = { at: Date.now(), items: (bundleCache?.items || []).filter((it) => rules.includes(it.rule)).sort((x, y) => rules.indexOf(x.rule) - rules.indexOf(y.rule)) };
    render();
    const sep = section?.querySelector(".qb-sep-bundle");
    if (sep) sep.textContent = "まとめ（" + msg + "…）";
    const q = "mutation($a:Map){runPluginOperation(plugin_id:\"libraryHub\",args:$a)}";
    await gql(q, { a: { mode: "bundles_save", rules: JSON.stringify(rules) } }).catch(() => null);
    bundleCache = null;
    render();
  }
  async function addBundle(rule) {
    const items = await bundleItems();
    const key = JSON.stringify(rule);
    if (items.some((it) => JSON.stringify(it.rule) === key)) return;
    await saveBundles([...items.map((it) => it.rule), rule], "まとめています");
  }
  let bundleToken = 0,
    bundleDrag = null;
  async function renderBundles(box) {
    const my = ++bundleToken; // 描き直しが重なった時に2回並べない
    const items = await bundleItems();
    if (my !== bundleToken || !box.isConnected) return;
    const sep = el("div", "qb-sep qb-sep-bundle", "まとめ");
    box.append(sep);
    if (!items.length) box.append(el("div", "qg-empty", "「＋ 追加」で、スタジオ・タグ・語をまとめられます"));
    items.forEach((b, i) => {
      const row = el("div", "qb-item qb-bundle");
      row.draggable = true;
      row.title = (b.label || b.name) + "（" + b.count + "本）\nクリックで中身を全部並べる・つかんで上下に動かすと並べ替え";
      const f = el("span", "qb-face qb-" + (b.kind === "studio" ? "studio" : "tag"));
      if (b.image) f.style.backgroundImage = `url("${b.image}")`;
      else f.textContent = "≡";
      const x = el("button", "qb-x", "×");
      x.type = "button";
      x.title = "まとめるのをやめる（中身が一覧に戻ります）";
      x.onclick = (e) => {
        e.stopPropagation();
        saveBundles(items.filter((y) => y !== b).map((y) => y.rule), "外しています");
      };
      row.append(f, el("span", "qb-name", b.label || b.name), el("span", "qb-count", String(b.count)), x);
      row.onclick = () => {
        if (!b.id) return;
        const lt = window.LightCards?.listTo;
        navigate(lt ? lt(b.kind, { id: b.id, name: b.name }) : "/" + b.kind + "s/" + b.id);
      };
      row.addEventListener("dragstart", (e) => {
        bundleDrag = i;
        row.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/x-qb-bundle", String(i));
      });
      row.addEventListener("dragend", () => {
        bundleDrag = null;
        row.classList.remove("dragging");
        box.querySelectorAll(".over").forEach((n) => n.classList.remove("over"));
      });
      row.addEventListener("dragover", (e) => {
        if (bundleDrag == null) return;
        e.preventDefault();
        box.querySelectorAll(".over").forEach((n) => n !== row && n.classList.remove("over"));
        row.classList.add("over");
      });
      row.addEventListener("drop", (e) => {
        if (bundleDrag == null) return;
        e.preventDefault();
        e.stopPropagation();
        const rules = items.map((y) => y.rule);
        const [moved] = rules.splice(bundleDrag, 1);
        rules.splice(i, 0, moved);
        bundleDrag = null;
        saveBundles(rules, "並べ替えています");
      });
      box.append(row);
    });
  }

  function render() {
    if (!section) return;
    const box = section.querySelector(".qb-list");
    box.replaceChildren();
    const list = load();
    renderBundles(box);
    if (!list.length) box.append(el("div", "qg-empty", "まだ何もありません。「＋ 追加」から貼ってください"));
    // 種類ごとに見出しで仕切って並べる（種類の中は貼った順・並べ替えた順）
    const order = Object.keys(TYPES);
    const shown = list.map((item, i) => ({ item, i })).sort((a, b) => order.indexOf(a.item.type) - order.indexOf(b.item.type) || a.i - b.i);
    let lastType = null;
    shown.forEach(({ item, i }) => {
      if (item.type !== lastType) {
        lastType = item.type;
        box.append(el("div", "qb-sep qb-sep-" + item.type, TYPES[item.type]));
      }
      const row = el("div", "qb-item qb-t-" + item.type);
      row.dataset.key = item.type + ":" + item.id;
      row.draggable = true;
      row.title = TYPES[item.type] + "：" + item.name + "\n" + (item.type === "scene" ? "クリックで再生" : "クリックで今の一覧を絞り込む");
      const x = el("button", "qb-x", "×");
      x.type = "button";
      x.title = "ボードから外す";
      x.onclick = (e) => {
        e.stopPropagation();
        removeItem(item);
        render();
        syncFavorites();
      };
      row.append(face(item), el("span", "qb-name", item.name), x);
      row.onclick = () => open(item);
      // つかんで上下に動かして並べ替え
      row.addEventListener("dragstart", (e) => {
        dragging = i;
        dragType = item.type;
        row.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/x-qb", String(i));
      });
      row.addEventListener("dragend", () => {
        dragging = null;
        row.classList.remove("dragging");
        box.querySelectorAll(".over").forEach((n) => n.classList.remove("over"));
      });
      row.addEventListener("dragover", (e) => {
        if (dragging == null || dragType !== item.type) return; // 並べ替えは同じ種類の中だけ
        e.preventDefault();
        box.querySelectorAll(".over").forEach((n) => n !== row && n.classList.remove("over"));
        row.classList.add("over");
      });
      row.addEventListener("drop", (e) => {
        if (dragging == null || dragType !== item.type) return;
        e.preventDefault();
        e.stopPropagation();
        const l = load(),
          [moved] = l.splice(dragging, 1);
        l.splice(i, 0, moved);
        save(l);
        dragging = null;
        render();
      });
      box.append(row);
    });
  }
  // 別のブラウザで変えた分（serverStore の同期）も反映
  addEventListener("storage", (e) => (e.key === KEY || e.key === KEY_M) && render());

  window.QuickBoard = {
    // クイックジャンルが左サイドバーに置く
    mount(sidebar) {
      if (section && section.parentElement === sidebar) return section;
      section?.remove();
      section = build();
      sidebar.insertBefore(section, sidebar.querySelector(":scope > .sidebar-footer"));
      render();
      syncFavorites(); // 前から貼ってあった物・別のブラウザで貼った物の分
      return section;
    },
    unmount() {
      section?.remove();
      section = null;
    },
    add,
  };

  const style = el("style");
  style.textContent = `
.qb-add{border:1px solid #ffffff26;background:none;color:#cfd8e3;border-radius:5px;padding:0 8px;font-size:.8rem;cursor:pointer}
.qb-add:hover{background:#ffffff14}
.qb-finder{padding:4px 6px 8px;display:flex;flex-direction:column;gap:5px}
.qb-types{display:flex;gap:3px;flex-wrap:wrap}
.qb-type{border:1px solid #ffffff26;background:none;color:#aab6c2;border-radius:10px;padding:0 8px;font-size:.75rem;cursor:pointer}
.qb-type.on{background:#3a6ea5;color:#fff;border-color:#3a6ea5}
.qb-q{height:28px;font-size:.85rem}
.qb-results{display:flex;flex-direction:column;max-height:240px;overflow:auto}
.qb-result,.qb-item{display:flex;align-items:center;gap:6px;width:100%;padding:3px 6px;border:0;border-radius:5px;background:none;color:#e6edf3;text-align:left;cursor:pointer;font-size:.85rem}
.qb-result:hover,.qb-item:hover{background:#ffffff12}
.qb-list{display:flex;flex-direction:column;gap:1px;padding:0 2px}
.qb-sep{margin:8px 4px 2px;padding-bottom:2px;border-bottom:1px solid #ffffff1f;font-size:.72rem;font-weight:700;letter-spacing:.05em}
.qb-sep:first-child{margin-top:2px}
.qb-sep-bundle{color:#9fb6ff}
.qb-bundle-add{flex:none;margin-left:auto;padding:0 6px;border:1px solid #6d86c9;border-radius:9px;color:#b9c9ff;font-size:.7rem;opacity:0}
.qb-result:hover .qb-bundle-add{opacity:1}.qb-bundle-add:hover{background:#3a5fa5;color:#fff}
.qb-words .qb-name{white-space:normal;color:#b9c9ff;font-size:.78rem}.qb-count{flex:none;font-size:.72rem;color:#7d8a96}
.qb-sep-performer{color:#f2a7c3}.qb-sep-studio{color:#8fc7ff}.qb-sep-tag{color:#a8e0a0}.qb-sep-scene{color:#e6c37a}
.qb-item{position:relative}
.qb-item.over{box-shadow:0 -2px 0 #7fd4ff inset}
.qb-item.dragging{opacity:.4}
.qb-item.flash{animation:qbFlash .8s}
@keyframes qbFlash{0%,60%{background:#3a6ea566}}
.qb-face{flex:none;width:26px;height:26px;border-radius:50%;background:#2a3642 center/cover no-repeat;display:inline-flex;align-items:center;justify-content:center;font-size:.7rem;color:#8b9aa6}
.qb-scene .qb-face,.qb-face.qb-scene{border-radius:4px;width:40px}
.qb-face.qb-studio,.qb-face.qb-tag{border-radius:6px}
.qb-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qb-kind{flex:none;font-size:.68rem;color:#7d8a96}
.qb-x{flex:none;border:0;background:none;color:#8b9aa6;font-size:1rem;line-height:1;padding:0 3px;cursor:pointer;opacity:0}
.qb-item:hover .qb-x{opacity:1}
.qb-x:hover{color:#fff}
.qb-section.qb-drop{outline:2px dashed #7fd4ff;outline-offset:-2px}`;
  document.head.append(style);
})();

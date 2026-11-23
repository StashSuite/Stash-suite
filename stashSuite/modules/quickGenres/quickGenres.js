/*
 * Quick Genres（クイックジャンル）— シーン一覧の空きスペースを使うショートカット
 *
 * ・左サイドバーの下：ジャンル一覧。Tag Weighted Recommendations で +1 以上にしたタグを好きな順に表示
 *   （好みが未設定なら、よく使われているタグ）。クリックで今の一覧をそのジャンルに絞り込み（並び順は維持）、
 *   選択中をもう一度押すと解除、Shift+クリックでジャンルを追加（すべて含む）。📌 で先頭に固定。
 * ・右上（ツールバーの右の空き）：絞り込みスイッチ（未視聴・★4以上・新着7日）、
 *   好きな出演者の顔アイコン（MediaPipe の顔検出で顔の位置に合わせて切り抜く）。
 * ・左上（ツールバーの左の空き）：並び順のワンボタン切替（おすすめ・ランダム・追加日・評価・発売日）。
 */
(() => {
  "use strict";
  if (window.__quickGenres) return;
  window.__quickGenres = true;

  const PIN_KEY = "quickGenres.pins",
    MAX_GENRES = 40,
    COUNT_TTL = 5 * 60 * 1000;
  // 整理用・配信元など、ジャンルとして並べても役に立たないタグ（好みが未設定の時の候補から外す）
  const NOT_GENRE = /^(?:整理:|分割:|要確認$|あとで見る$|単体作品$|ハイビジョン$|独占配信$|サンプル動画$|4K$)/;
  // 子どもを性的に扱うと読めるタグ（学校・年齢系）はショートカットに出さない
  const UNSAFE = /学生|女子校|校生|学園|制服|ＪＫ|JK|JC|JS|J[○◯●〇]|ロリ|未成|幼|まどか☆?マギカ|リリカルなのは(?!StrikerS)|絶望先生|セーラームーン|マイメロディ|魔法少女アイ|体操服|子供|子ども|児童|小学|中学|高校|ランドセル|スク水|園児/i;

  // 共通の土台（Suite Core）の物を使う
  const gql = (...a) => window.Suite.gql(...a);
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function readPins() {
    try {
      const v = JSON.parse(localStorage.getItem(PIN_KEY) || "[]");
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return [];
    }
  }
  function writePins(pins) {
    try {
      localStorage.setItem(PIN_KEY, JSON.stringify(pins));
    } catch {}
  }
  // 共通の土台（Suite Core）の物を使う
  const navigate = (...a) => window.Suite.navigate(...a);

  // ---- 一覧の絞り込み（URL の c パラメータのうち tags の条件だけを置き換える） ----
  const isTagCriterion = (c) => c.startsWith('("type":"tags"');
  function activeTagIds() {
    if (location.pathname !== "/scenes") return [];
    const c = new URLSearchParams(location.search).getAll("c").find(isTagCriterion);
    const items = c?.match(/"items":\[(.*?)\]/)?.[1] || "";
    return [...items.matchAll(/"id":"(\d+)"/g)].map((m) => m[1]);
  }
  function genrePath(tags) {
    const params = new URLSearchParams(location.pathname === "/scenes" ? location.search : "");
    const keep = params.getAll("c").filter((c) => !isTagCriterion(c));
    params.delete("c");
    params.delete("p");
    for (const c of keep) params.append("c", c);
    if (tags.length) {
      const label = (s) => String(s).replace(/[(){}"\\]/g, "");
      const items = tags.map((t) => '("id":"' + t.id + '","label":"' + label(t.name) + '")').join(",");
      params.append("c", '("type":"tags","modifier":"INCLUDES_ALL","value":("items":[' + items + '],"excluded":[],"depth":0))');
    }
    const q = params.toString();
    return "/scenes" + (q ? "?" + q : "");
  }

  // ---- ジャンルの候補 ----
  // よく使われているタグ（好きなジャンルの後ろを埋める候補）と、タグの正式名・本数（5分キャッシュ）
  let topTags = null,
    topAt = 0;
  const tagInfo = new Map();
  async function loadTopTags() {
    if (topTags && Date.now() - topAt < COUNT_TTL) return topTags;
    const d = await gql('query QGTop{findTags(filter:{per_page:120,sort:"scenes_count",direction:DESC}){tags{id name scene_count}}}');
    for (const t of d.findTags.tags) tagInfo.set(String(t.id), t);
    topAt = Date.now();
    return (topTags = d.findTags.tags.filter((t) => !NOT_GENRE.test(t.name)).map((t) => ({ id: String(t.id), name: t.name, weight: 0, count: t.scene_count })));
  }
  // 1つずつ findTag で聞く（findTags(ids) は消えたタグが1つでもあると全体が失敗して、ジャンルが1つも出なくなるため）
  async function loadTagInfo(ids) {
    const need = [...new Set(ids.map(String))].filter((id) => /^\d+$/.test(id) && !tagInfo.has(id));
    if (!need.length) return;
    const d = await gql("query QGTagInfo{" + need.map((id, i) => "t" + i + ':findTag(id:"' + id + '"){id name scene_count}').join(" ") + "}");
    need.forEach((id, i) => d["t" + i] && tagInfo.set(id, d["t" + i]));
  }
  async function genres() {
    const twr = window.StashTagWeightedRecommendations;
    const rules = twr?.rules?.() || [];
    const pins = readPins();
    // 好みの名前はチップの文字（「#」付きなど）で保存されていることがあるので、Stash の正式名を使う
    await Promise.all([loadTopTags(), loadTagInfo([...rules.map((r) => r.id), ...pins])]);
    const info = (id) => tagInfo.get(String(id));
    const liked = rules
      .filter((r) => r.mode === "prefer" && r.weight >= 1 && info(r.id))
      .map((r) => ({ id: String(r.id), name: info(r.id).name, weight: r.weight, count: info(r.id).scene_count }));
    const skip = new Set(rules.filter((r) => r.mode !== "prefer" || r.weight < 0).map((r) => String(r.id)));
    const ids = new Set(liked.map((t) => t.id));
    const pinned = pins.filter((id) => !ids.has(id) && info(id)).map((id) => ({ id, name: info(id).name, weight: 0, count: info(id).scene_count }));
    for (const t of pinned) ids.add(t.id);
    // 好き（重み順→本数順）→ 固定 → よく使われているタグ（本数順）で埋める
    liked.sort((a, b) => b.weight - a.weight || b.count - a.count);
    const filler = topTags.filter((t) => !ids.has(t.id) && !skip.has(t.id)).map((t) => ({ ...t, filler: true }));
    let list = [...liked, ...pinned, ...filler].filter((t) => !UNSAFE.test(t.name) && !NOT_GENRE.test(t.name));
    // 固定したものを先頭へ（固定した順）
    list = [...pins.map((id) => list.find((t) => t.id === id)).filter(Boolean), ...list.filter((t) => !pins.includes(t.id))];
    return { list: list.slice(0, MAX_GENRES), fromPrefs: liked.length > 0, pins };
  }

  // ---- 本数・未視聴数（まとめて1回の問い合わせ、5分キャッシュ） ----
  const counts = new Map();
  async function loadCounts(ids) {
    const need = ids.filter((id) => !(counts.get(id)?.at > Date.now() - COUNT_TTL));
    if (!need.length) return;
    // 分割パーツの続き（Split Parts）は1本として数えるため除く
    const cont = (await window.StashSplitParts?.tags().catch(() => null))?.cont;
    const parts = need.map((id, i) => {
      const tag = 'tags:{value:["' + id + '"],modifier:INCLUDES_ALL' + (cont ? ',excludes:["' + cont + '"]' : "") + "}";
      return (
        "t" + i + ":findScenes(scene_filter:{" + tag + "},filter:{per_page:1}){count} " +
        "u" + i + ":findScenes(scene_filter:{" + tag + ",play_count:{value:0,modifier:EQUALS}},filter:{per_page:1}){count}"
      );
    });
    const d = await gql("query QGCounts{" + parts.join(" ") + "}");
    need.forEach((id, i) => counts.set(id, { total: d["t" + i].count, unwatched: d["u" + i].count, at: Date.now() }));
  }

  // ---- 左サイドバー：ジャンル一覧 ----
  let section = null,
    renderToken = 0;
  function buildSection() {
    const s = el("div", "sidebar-section qg-section");
    const head = el("div", "qg-head");
    head.append(el("span", "qg-title", "ジャンル"));
    const clear = el("button", "qg-clear", "✕ 解除");
    clear.type = "button";
    clear.title = "ジャンルの絞り込みを解除";
    clear.onclick = () => navigate(genrePath([]));
    head.append(clear);
    s.append(head, el("div", "qg-list"), el("div", "qg-hint"));
    return s;
  }
  async function renderSection() {
    if (!section) return;
    const token = ++renderToken;
    const { list, fromPrefs, pins } = await genres().catch(() => ({ list: [], fromPrefs: false, pins: [] }));
    if (token !== renderToken || !section) return;
    const active = activeTagIds();
    const box = section.querySelector(".qg-list");
    section.querySelector(".qg-clear").hidden = !active.length;
    section.querySelector(".qg-hint").textContent =
      (fromPrefs ? "上から、タグの好みで +1 以上にしたタグ（好きな順）→ よく使われているタグ。\n" : "タグの好みで +1 以上にしたタグが上に並びます（今はよく使われているタグだけ）。\n") +
      "クリックで絞り込み／もう一度で解除／Shift+クリックで追加";
    box.replaceChildren();
    if (!list.length) {
      box.append(el("div", "qg-empty", "ジャンルがありません"));
      return;
    }
    let fillerShown = false;
    for (const t of list) {
      if (t.filler && !pins.includes(t.id) && !fillerShown) {
        fillerShown = true;
        if (list.some((x) => !x.filler)) box.append(el("div", "qg-sep", "よく使われているタグ"));
      }
      const on = active.includes(t.id),
        pinned = pins.includes(t.id);
      const b = el("button", "qg-item" + (on ? " active" : "") + (pinned ? " pinned" : ""));
      b.type = "button";
      b.dataset.id = t.id;
      b.dataset.name = t.name;
      b.title = t.name + (t.weight ? "（好み +" + t.weight + "）" : "") + "\nクリックで絞り込み／Shift+クリックで追加";
      const pin = el("span", "qg-pin", "•");
      pin.title = pinned ? "固定を外す" : "先頭に固定";
      pin.onclick = (e) => {
        e.stopPropagation();
        const p = readPins().filter((x) => x !== t.id);
        if (!pinned) p.push(t.id);
        writePins(p);
        renderSection();
      };
      b.append(el("span", "qg-name", t.name), el("span", "qg-count"), pin);
      b.onclick = (e) => {
        let next;
        if (e.shiftKey) {
          // 一覧に無いタグ（Stash のフィルターで付けた条件）も残す
          next = active.filter((id) => id !== t.id).map((id) => list.find((x) => x.id === id) || { id, name: id });
          if (!on) next.push(t);
        } else next = on && active.length === 1 ? [] : [t];
        navigate(genrePath(next));
      };
      box.append(b);
    }
    try {
      await loadCounts(list.map((t) => t.id));
    } catch (e) {
      console.warn("[Quick Genres] 本数を取得できません", e);
      return;
    }
    if (token !== renderToken) return;
    for (const b of box.querySelectorAll(".qg-item")) {
      const c = counts.get(b.dataset.id);
      if (!c) continue;
      const span = b.querySelector(".qg-count");
      span.replaceChildren(String(c.total));
      if (c.unwatched) span.append(el("small", null, "未" + c.unwatched));
      b.title = b.title.split("\n")[0] + "\n" + c.total + "本（未視聴 " + c.unwatched + "本）\nクリックで絞り込み／Shift+クリックで追加";
    }
  }

  // ---- 右上：絞り込みスイッチ・この一覧をザッピング・好きな出演者 ----
  let topBox = null;
  // サイドバーの開閉（アニメーション）などで一覧の幅が変わったら置き直す
  // 一覧の幅（読むと全カードの再レイアウトになる getBoundingClientRect を使わず、ここで覚える）
  let contentWidth = 0;
  const resizeObserver = new ResizeObserver((entries) => {
    const w = Math.round(entries[entries.length - 1].contentRect.width);
    if (w === contentWidth) return; // 高さだけの変化（カードの読み込み）は無視
    contentWidth = w;
    schedule();
  });

  // URL の c パラメータ（Stash の絞り込み条件）を1種類だけ足し外しする
  function criteria() {
    return new URLSearchParams(location.pathname === "/scenes" ? location.search : "").getAll("c");
  }
  const criterionType = (c) => c.match(/^\("type":"([^"]+)"/)?.[1] || "";
  function withCriterion(type, value) {
    const params = new URLSearchParams(location.pathname === "/scenes" ? location.search : "");
    const keep = params.getAll("c").filter((c) => criterionType(c) !== type);
    params.delete("c");
    params.delete("p");
    for (const c of keep) params.append("c", c);
    if (value) params.append("c", value);
    return "/scenes?" + params.toString();
  }
  const SWITCHES = [
    { type: "play_count", label: "未視聴", title: "まだ見ていない作品だけ", value: () => '("type":"play_count","modifier":"EQUALS","value":("value":0))' },
    { type: "rating100", label: "★4以上", title: "評価が★4以上の作品だけ", value: () => '("type":"rating100","modifier":"GREATER_THAN","value":("value":79))' },
    {
      type: "created_at",
      label: "新着7日",
      title: "この7日間に Stash に入った作品だけ",
      value: () => {
        const d = new Date(Date.now() - 7 * 864e5);
        const p = (n) => String(n).padStart(2, "0");
        return '("type":"created_at","modifier":"GREATER_THAN","value":("value":"' + d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + ' 00:00"))';
      },
    },
  ];

  // 今の一覧（絞り込み・並び順そのまま）をミニプレイヤーのザッピングで流し見する
  function sceneIdsOnPage() {
    const ids = [];
    for (const a of document.querySelectorAll('.scene-card a[href*="/scenes/"]')) {
      const id = a.getAttribute("href").match(/\/scenes\/(\d+)/)?.[1];
      if (id && !ids.includes(id)) ids.push(id);
    }
    return ids;
  }
  function startZapping(btn) {
    const ids = sceneIdsOnPage();
    if (!ids.length) {
      btn.textContent = "▶ 作品がありません";
      setTimeout(() => (btn.textContent = "▶ この一覧をザッピング"), 2500);
      return;
    }
    if (window.StashMiniPlayer?.open) window.StashMiniPlayer.open(ids[0], { list: ids, zap: true });
    else navigate("/scenes/" + ids[0]);
  }

  // ---- 好きな出演者（評価の高い順、足りなければ出演数の多い順） ----
  const FACE_KEY = "quickGenres.faces", // { 出演者ID: { img, x, y, w, manual } }（x,y は顔の中心、w は顔の幅。画像に対する割合）
    PERF_MAX = 40,
    MP_BASE = "/plugin/stashSuite/assets/quickGenres/vendor/mediapipe";
  function readFaces() {
    try {
      return JSON.parse(localStorage.getItem(FACE_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }
  function writeFaces(f) {
    try {
      localStorage.setItem(FACE_KEY, JSON.stringify(f));
    } catch {}
  }
  // 顔の帯に出す出演者。モードごとに選び方を変える
  //   mix   … 評価の高い人ほど出やすいランダム（開くたび・🔀 で入れ替え）
  //   page  … 今表示している一覧に出ている人（出演本数の多い順。絞り込みに合わせて変わる）
  //   new   … 最近 Stash に入った作品の出演者
  //   rated … 評価順（同じ評価なら出演数順）
  const BAND_MODES = [
    { key: "mix", label: "ミックス", title: "評価の高い人ほど出やすいランダム（もう一度押すと入れ替え）" },
    { key: "page", label: "この一覧", title: "今表示している一覧に出ている人（絞り込みに合わせて変わる）" },
    { key: "new", label: "新着", title: "最近 Stash に入った作品の出演者" },
    { key: "rated", label: "評価順", title: "評価の高い順" },
  ];
  const BAND_MODE_KEY = "quickGenres.bandMode";
  let bandMode = (() => {
    try {
      const v = localStorage.getItem(BAND_MODE_KEY);
      return BAND_MODES.some((m) => m.key === v) ? v : "mix";
    } catch {
      return "mix";
    }
  })();
  const PERF_FIELDS = "id name alias_list gender image_path rating100 scene_count";
  const hasImage = (p) => p?.image_path && !/default=true/.test(p.image_path);
  let poolCache = null,
    poolAt = 0;
  // 女／男モード（viewMode）：男系（男モード）の下のタグが付いた動画に出ている人。
  // 男の娘の出演者も性別は「女性」で登録されていることが多いので、性別ではなく出ている動画で分ける
  let maleCache = null,
    maleAt = 0;
  async function malePerformers() {
    if (maleCache && Date.now() - maleAt < COUNT_TTL) return maleCache;
    const id = window.ViewMode?.tagIds?.().m;
    if (!id) return [];
    const d = await gql("query QGMalePerf($f:SceneFilterType){findScenes(scene_filter:$f,filter:{per_page:-1}){scenes{performers{" + PERF_FIELDS + "}}}}", {
      f: { tags: { value: [id], modifier: "INCLUDES", depth: -1 } }, // 子タグも含める
    });
    maleCache = countPerformers(d.findScenes.scenes);
    maleAt = Date.now();
    return maleCache;
  }
  const viewMode = () => window.ViewMode?.mode?.() || "all";
  // 選んだ出演者をモードに合わせる（女モードは男モードの動画に出ている人を除く。男モードはその人だけ）
  async function byMode(list) {
    const m = viewMode();
    if (m === "all") return list;
    const male = new Set((await malePerformers()).map((p) => p.id));
    return list.filter((p) => (m === "m" ? male.has(p.id) : !male.has(p.id)));
  }
  async function performerPool() {
    if (viewMode() === "m") return malePerformers(); // 男モード：男モードの動画に出ている人から選ぶ
    if (poolCache && Date.now() - poolAt < COUNT_TTL) return byMode(poolCache);
    const d = await gql(
      'query QGPool{r:findPerformers(performer_filter:{rating100:{value:0,modifier:GREATER_THAN}},filter:{per_page:300,sort:"rating",direction:DESC}){performers{' +
        PERF_FIELDS +
        '}} s:findPerformers(filter:{per_page:200,sort:"scenes_count",direction:DESC}){performers{' +
        PERF_FIELDS +
        "}}}",
    );
    const seen = new Set();
    poolCache = [...d.r.performers, ...d.s.performers].filter((p) => hasImage(p) && !seen.has(p.id) && seen.add(p.id));
    poolAt = Date.now();
    return byMode(poolCache);
  }
  // 重み付きで重複なしに n 人選ぶ（評価★5は無評価の約4倍出やすい）
  function weightedSample(list, n) {
    const keyed = list.map((p) => ({ p, k: Math.pow(Math.random(), 1 / ((p.rating100 || 25) + Math.min(p.scene_count || 0, 30))) }));
    return keyed
      .sort((a, b) => b.k - a.k)
      .slice(0, n)
      .map((x) => x.p);
  }
  function countPerformers(scenes) {
    const map = new Map();
    for (const s of scenes)
      for (const p of s.performers || []) {
        if (!hasImage(p)) continue;
        const o = map.get(p.id) || { ...p, hits: 0 };
        o.hits++;
        map.set(p.id, o);
      }
    return [...map.values()].sort((a, b) => b.hits - a.hits || (b.rating100 || 0) - (a.rating100 || 0));
  }
  async function loadBandPerformers(mode) {
    if (mode === "mix") return weightedSample(await performerPool(), PERF_MAX);
    if (mode === "rated")
      return (await performerPool())
        .filter((p) => p.rating100)
        .sort((a, b) => b.rating100 - a.rating100 || b.scene_count - a.scene_count)
        .slice(0, PERF_MAX * 2);
    if (mode === "page") {
      const ids = sceneIdsOnPage();
      if (!ids.length) return [];
      const d = await gql("query QGPagePerf($ids:[ID!]){findScenes(ids:$ids,filter:{per_page:-1}){scenes{performers{" + PERF_FIELDS + "}}}}", { ids });
      return countPerformers(d.findScenes.scenes).slice(0, PERF_MAX * 2);
    }
    // new：この14日に入った作品（新しい順に300本）の出演者
    const since = new Date(Date.now() - 14 * 864e5).toISOString();
    const d = await gql(
      'query QGNewPerf($f:SceneFilterType){findScenes(scene_filter:$f,filter:{per_page:300,sort:"created_at",direction:DESC}){scenes{performers{' + PERF_FIELDS + "}}}}",
      { f: { created_at: { value: since, modifier: "GREATER_THAN" } } },
    );
    return (await byMode(countPerformers(d.findScenes.scenes))).slice(0, PERF_MAX * 2);
  }
  // 顔の位置（MediaPipe 顔検出。1人1回だけ調べてブラウザに保存）
  let detectorPromise = null;
  function detector() {
    if (!detectorPromise)
      detectorPromise = (async () => {
        const mp = await import(MP_BASE + "/vision_bundle.mjs");
        const files = await mp.FilesetResolver.forVisionTasks(MP_BASE);
        return mp.FaceDetector.createFromOptions(files, {
          baseOptions: { modelAssetPath: MP_BASE + "/blaze_face_short_range.tflite", delegate: "CPU" },
          runningMode: "IMAGE",
          minDetectionConfidence: 0.4,
        });
      })();
    return detectorPromise;
  }
  function loadImage(src) {
    return new Promise((ok, ng) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ng(new Error("画像を読み込めません"));
      i.src = src;
    });
  }
  async function findFace(p) {
    const img = await loadImage(p.image_path);
    const det = await detector();
    let found = det.detect(img).detections;
    let scaleY = 1;
    if (!found.length) {
      // 顔が小さくて見つからない時は、上半分を切り出してもう一度
      const c = document.createElement("canvas");
      const h = Math.round(img.naturalHeight * 0.55);
      c.width = img.naturalWidth;
      c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, img.naturalWidth, h, 0, 0, img.naturalWidth, h);
      found = det.detect(c).detections;
      scaleY = h / img.naturalHeight;
    }
    const b = found.sort((a, z) => z.categories[0].score - a.categories[0].score)[0]?.boundingBox;
    if (!b) return { img: p.image_path, x: 0.5, y: 0.25, w: 0.3, guess: true, iw: img.naturalWidth, ih: img.naturalHeight };
    return {
      img: p.image_path,
      x: (b.originX + b.width / 2) / img.naturalWidth,
      y: ((b.originY + b.height / 2) / (img.naturalHeight * scaleY)) * scaleY,
      w: b.width / img.naturalWidth,
      iw: img.naturalWidth,
      ih: img.naturalHeight,
    };
  }
  // 顔が丸の中央・幅の約6割になるように背景を配置
  function paintFace(node, face, size) {
    const iw = face.iw || 2,
      ih = face.ih || 3;
    let s = (0.6 * size) / (face.w * iw);
    s = Math.max(s, size / iw, size / ih); // 丸を画像で埋めきる
    const left = Math.min(0, Math.max(size - iw * s, size / 2 - face.x * iw * s)),
      top = Math.min(0, Math.max(size - ih * s, size / 2 - face.y * ih * s));
    node.style.backgroundImage = "url(" + JSON.stringify(face.img) + ")";
    node.style.backgroundSize = iw * s + "px " + ih * s + "px";
    node.style.backgroundPosition = left + "px " + top + "px";
  }
  // ---- 顔の帯（ツールバーの下の全幅。左右にドラッグ／ホイール／◀▶でスクロール） ----
  const PERF_SIZE = 80;
  let band = null,
    perfToken = 0;
  function buildBand() {
    const b = el("div", "qg-band");
    const prev = el("button", "qg-band-arrow prev", "◀"),
      next = el("button", "qg-band-arrow next", "▶"),
      track = el("div", "qg-perfs"),
      modes = el("div", "qg-band-modes");
    for (const m of BAND_MODES) {
      const mb = el("button", "qg-band-mode", m.label);
      mb.type = "button";
      mb.dataset.mode = m.key;
      mb.title = m.title;
      mb.onclick = () => {
        if (m.key === bandMode && m.key === "mix") return renderPerformers(); // ミックスをもう一度押すと入れ替え
        bandMode = m.key;
        try {
          localStorage.setItem(BAND_MODE_KEY, bandMode);
        } catch {}
        track.scrollLeft = 0;
        renderPerformers();
      };
      modes.append(mb);
    }
    const shuffle = el("button", "qg-band-shuffle", "↻");
    shuffle.type = "button";
    shuffle.title = "顔ぶれを入れ替え（ミックス）";
    shuffle.onclick = () => {
      bandMode = "mix";
      try {
        localStorage.setItem(BAND_MODE_KEY, bandMode);
      } catch {}
      track.scrollLeft = 0;
      renderPerformers();
    };
    
    prev.type = next.type = "button";
    prev.title = "前の出演者";
    next.title = "次の出演者";
    const step = (d) => {
      track.scrollBy({ left: d * track.clientWidth * 0.8, behavior: "smooth" });
      setTimeout(arrows, 450);
    };
    prev.onclick = () => step(-1);
    next.onclick = () => step(1);
    const arrows = () => {
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    };
    track.addEventListener("scroll", arrows, { passive: true });
    // ホイールの縦回転で横に送る
    track.addEventListener(
      "wheel",
      (e) => {
        if (e.altKey || track.scrollWidth <= track.clientWidth) return;
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (!d) return;
        e.preventDefault();
        track.scrollLeft += d * (e.deltaMode === 1 ? 24 : 1);
      },
      { passive: false },
    );
    // ドラッグで送る（動かした時はクリック扱いにしない）。離すと慣性で流れる
    let drag = null,
      glide = 0;
    const stopGlide = () => cancelAnimationFrame(glide);
    track.addEventListener("pointerdown", (e) => {
      stopGlide();
      if (e.button !== 0 || e.altKey) return;
      drag = { x: e.clientX, left: track.scrollLeft, moved: false, id: e.pointerId, samples: [{ x: e.clientX, t: performance.now() }] };
    });
    track.addEventListener("wheel", stopGlide, { passive: true });
    track.addEventListener("pointermove", (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) < 6) return;
      if (!drag.moved) {
        drag.moved = true;
        try {
          track.setPointerCapture(e.pointerId);
        } catch {}
        track.classList.add("dragging");
      }
      track.scrollLeft = drag.left - dx;
      const now = performance.now();
      drag.samples.push({ x: e.clientX, t: now });
      while (drag.samples.length > 2 && now - drag.samples[0].t > 100) drag.samples.shift();
    });
    const end = () => {
      if (!drag) return;
      if (drag.moved) {
        track.dataset.dragged = String(Date.now());
        // 直近 100ms の速さで滑り出し、少しずつ減速
        const a = drag.samples[0],
          z = drag.samples[drag.samples.length - 1];
        let v = z.t - a.t > 0 ? -((z.x - a.x) / (z.t - a.t)) * 16 : 0; // 1フレームあたりの px
        if (performance.now() - z.t > 80) v = 0; // 止めてから離した時は流さない
        // 経過時間で進めるので、描画が詰まっても流れる距離は変わらない
        let last = performance.now();
        const step = (now) => {
          const f = Math.min(4, (now - last) / 16.7);
          last = now;
          if (Math.abs(v) < 0.4) return arrows();
          const before = track.scrollLeft;
          track.scrollLeft += v * f;
          if (track.scrollLeft === before) return arrows(); // 端に着いた
          v *= Math.pow(0.95, f);
          glide = requestAnimationFrame(step);
        };
        stopGlide();
        glide = requestAnimationFrame(step);
      }
      track.classList.remove("dragging");
      drag = null;
    };
    track.addEventListener("pointerup", end);
    track.addEventListener("pointercancel", end);
    track.addEventListener(
      "click",
      (e) => {
        if (Date.now() - Number(track.dataset.dragged || 0) < 300) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true,
    );
    b.append(modes, prev, track, next);
    b._arrows = arrows;
    return b;
  }
  // 「この一覧」モードは、表示している作品が変わったら選び直す
  let bandPageKey = "";
  const pageKey = () => location.search + "|" + sceneIdsOnPage().slice(0, 5).join(",");
  async function renderPerformers() {
    if (!band) return;
    const token = ++perfToken;
    bandPageKey = pageKey();
    const track = band.querySelector(".qg-perfs");
    let list;
    try {
      list = await loadBandPerformers(bandMode);
    } catch (e) {
      console.warn("[Quick Genres] 出演者を取得できません", e);
      return;
    }
    if (token !== perfToken || !band) return;
    for (const mb of band.querySelectorAll(".qg-band-mode")) mb.classList.toggle("active", mb.dataset.mode === bandMode);
    const faces = readFaces();
    track.replaceChildren();
    // 一覧のカードがまだ描かれていない時は「無い」ではなく読み込み中（カードが出たら選び直される）
    const pageEmpty = bandMode === "page" && !sceneIdsOnPage().length;
    if (!list.length)
      track.append(
        el("span", "qg-band-empty", pageEmpty ? "一覧を読み込み中…" : bandMode === "page" ? "この一覧には出演者情報のある作品がありません" : "出演者がいません"),
      );
    for (const p of list) {
      const b = el("button", "qg-perf");
      b.type = "button";
      b.dataset.id = String(p.id);
      b.title = p.name + (p.rating100 ? "（★" + p.rating100 / 20 + "）" : "") + "\nクリックで絞り込み（もう一度で解除）／Shift+クリックで追加\nAlt+ドラッグで位置、Alt+ホイールで拡大を調整";
      const ring = el("span", "qg-perf-ring"),
        face = el("span", "qg-face");
      ring.append(face);
      b.append(ring, el("span", "qg-perf-name", p.name));
      const f = faces[p.id];
      if (f && f.img === p.image_path) paintFace(face, f, PERF_SIZE);
      else face.classList.add("loading");
      b.onclick = (e) => {
        if (b.dataset.adjusted === "1") return (b.dataset.adjusted = "");
        const active = activePerformerIds(); // 押した時点の絞り込み
        const id = String(p.id),
          cur = active.filter((x) => x !== id);
        const next = e.shiftKey ? (active.includes(id) ? cur : [...cur, id]) : active.length === 1 && active[0] === id ? [] : [id];
        navigate(performerPath(next.map((x) => list.find((q) => String(q.id) === x) || { id: x, name: x })));
      };
      wireAdjust(b, face, p);
      track.append(b);
    }
    renderTop();
    band._arrows();
    // 顔の位置が未保存の人だけ、順番に調べる
    for (const p of list) {
      const f = readFaces()[p.id];
      if (f && f.img === p.image_path) continue;
      try {
        const found = await findFace(p);
        const all = readFaces();
        all[p.id] = found;
        writeFaces(all);
        if (token !== perfToken) return;
        const node = track.querySelector('.qg-perf[data-id="' + p.id + '"] .qg-face');
        if (node) {
          node.classList.remove("loading");
          paintFace(node, found, PERF_SIZE);
        }
      } catch (e) {
        console.warn("[Quick Genres] 顔の位置を調べられません", p.name, e);
      }
    }
  }
  // Alt+ドラッグで位置、Alt+ホイールで拡大を手で直す（保存して以後はそれを使う）
  function wireAdjust(btn, face, p) {
    let drag = null;
    btn.addEventListener("pointerdown", (e) => {
      if (!e.altKey || e.button !== 0) return;
      const f = readFaces()[p.id];
      if (!f) return;
      e.preventDefault();
      e.stopPropagation();
      drag = { x: e.clientX, y: e.clientY, f: { ...f } };
      btn.setPointerCapture(e.pointerId);
    });
    btn.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const f = drag.f,
        s = Math.max((0.6 * PERF_SIZE) / (f.w * f.iw), PERF_SIZE / f.iw, PERF_SIZE / f.ih);
      const moved = { ...f, x: f.x - (e.clientX - drag.x) / (f.iw * s), y: f.y - (e.clientY - drag.y) / (f.ih * s), manual: true };
      paintFace(face, moved, PERF_SIZE);
      drag.now = moved;
    });
    const end = () => {
      if (!drag) return;
      if (drag.now) {
        const all = readFaces();
        all[p.id] = drag.now;
        writeFaces(all);
        btn.dataset.adjusted = "1";
      }
      drag = null;
    };
    btn.addEventListener("pointerup", end);
    btn.addEventListener("pointercancel", end);
    btn.addEventListener(
      "wheel",
      (e) => {
        if (!e.altKey) return;
        e.preventDefault();
        e.stopPropagation();
        const all = readFaces(),
          f = all[p.id];
        if (!f) return;
        f.w = Math.min(1, Math.max(0.05, f.w * (e.deltaY > 0 ? 1.1 : 0.9)));
        f.manual = true;
        writeFaces(all);
        paintFace(face, f, PERF_SIZE);
      },
      { passive: false },
    );
  }
  function activePerformerIds() {
    const c = criteria().find((x) => criterionType(x) === "performers");
    const items = c?.match(/"items":\[(.*?)\]/)?.[1] || "";
    return [...items.matchAll(/"id":"(\d+)"/g)].map((m) => m[1]);
  }
  function performerPath(people) {
    if (!people.length) return withCriterion("performers", null);
    const label = (s) => String(s).replace(/[(){}"\\]/g, "");
    const items = people.map((p) => '("id":"' + p.id + '","label":"' + label(p.name) + '")').join(",");
    return withCriterion("performers", '("type":"performers","modifier":"INCLUDES_ALL","value":("items":[' + items + '],"excluded":[]))');
  }

  // ---- 1段目右：絞り込みスイッチ・ザッピング ----
  function buildTop() {
    const box = el("div", "qg-top");
    const histBtn = el("button", "qg-switch qg-hist-btn", "履歴");
    histBtn.type = "button";
    histBtn.title = "最後に開いた順（一瞬でも開いた動画の履歴）";
    histBtn.onclick = () => window.Suite?.toggleHistory?.();
    box.append(histBtn);
    // 「この一覧をザッピング」は使わないので出さない（ミニプレイヤーのザッピングも外した）
    const pt = el("button", "qg-panel-toggle", "女優 ▸");
    pt.type = "button";
    pt.title = "女優パネルを開く／閉じる";
    pt.onclick = () => togglePanel();
    box.append(pt);
    return box;
  }
  function renderTop() {
    const have = new Set(criteria().map(criterionType));
    for (const b of topBox?.querySelectorAll(".qg-switch") || []) {
      const on = have.has(b.dataset.type);
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    }
    const active = activePerformerIds();
    for (const b of band?.querySelectorAll(".qg-perf") || []) b.classList.toggle("active", active.includes(b.dataset.id));
  }

  // ---- 上部のレイアウト ----
  // 1段目：[並び順][Stash のツールバー（左寄せ）][件数] …… [スイッチ][ザッピング]
  // 2段目：顔の帯（全幅）。上のページ送りは隠す（一覧の下に常に出ているため）
  function placeHead(content, toolbar) {
    toolbar.classList.add("qg-toolbar");
    content.classList.remove("qg-stacked", "qg-tight");
    const stackBar = content.querySelector(":scope > .qg-stack-bar");
    if (stackBar) stackBar.remove();
    sortBox.classList.remove("labels", "compact", "qg-stuck-part");
    topBox.classList.remove("compact", "qg-stuck-part");
    // Place sortBox & topBox inside toolbar so native CSS position:sticky moves them together with zero drift
    if (sortBox.parentElement !== toolbar) toolbar.append(sortBox);
    if (topBox.parentElement !== toolbar) toolbar.append(topBox);
    toolbar.style.paddingLeft = toolbar.style.paddingRight = "";
    const tb = toolbar.getBoundingClientRect();
    const toggle = content.querySelector(":scope > .sidebar-toggle-button-container")?.getBoundingClientRect();
    const leftIn = Math.max(10, toggle ? Math.round(toggle.right - tb.left + 8) : 10);
    const rightIn = 10;
    sortBox.style.left = leftIn + "px";
    sortBox.style.right = "auto";
    sortBox.style.top = "50%";
    sortBox.style.transform = "translateY(-50%)";
    topBox.style.left = "auto";
    topBox.style.right = rightIn + "px";
    topBox.style.top = "50%";
    topBox.style.transform = "translateY(-50%)";
    toolbar.style.paddingLeft = Math.round(leftIn + sortBox.offsetWidth + 10) + "px";
    toolbar.style.paddingRight = Math.round(rightIn + topBox.offsetWidth + 10) + "px";
    const c = content.getBoundingClientRect();
    const index = content.querySelector(":scope > .pagination-index-container");
    if (index) {
      content.classList.remove("qg-index-inline");
      const flow = [...toolbar.children].filter((x) => !x.matches(".qg-sorts,.qg-top"));
      const last = Math.max(0, ...flow.map((x) => x.getBoundingClientRect().right));
      const stats = index.querySelector(".paginationIndex"),
        range = document.createRange();
      if (stats) range.selectNodeContents(stats);
      const need = (stats ? [...range.getClientRects()].reduce((w, r) => w + r.width, 0) : 240) + 24;
      const room = tb.right - rightIn - topBox.offsetWidth - last;
      if (toolbar.getBoundingClientRect().height < 60 && room > need) {
        content.classList.add("qg-index-inline");
        index.style.left = Math.round(last - c.left + 12) + "px";
        index.style.top = toolbar.offsetTop + Math.max(0, Math.round((toolbar.offsetHeight - 20) / 2)) + "px";
      } else index.style.left = index.style.top = "";
    }
  }

  // ---- 左上：並び順のワンボタン切替 ----
  // 選択中をもう一度押すと：ランダムは並べ直し、それ以外は昇順・降順を切り替え
  const SORTS = [
    { key: () => window.StashTagWeightedRecommendations?.sortKey || "twr_recommend", icon: "", label: "おすすめ", title: "おすすめ順（タグの好み）", needsTwr: true },
    { key: () => "random", icon: "", label: "ランダム", title: "ランダム（もう一度押すと並べ直し）" },
    { key: () => "created_at", icon: "", label: "追加日", title: "Stashに追加した日が新しい順" },
    { key: () => "rating", icon: "", label: "評価", title: "評価が高い順" },
    { key: () => "date", icon: "", label: "発売日", title: "発売日が新しい順" },
  ];
  let sortBox = null;
  function currentSort() {
    const params = new URLSearchParams(location.search);
    return { by: params.get("sortby") || "", dir: params.get("sortdir") || "asc" };
  }
  function sortPath(by, dir) {
    const params = new URLSearchParams(location.search);
    params.set("sortby", by);
    if (dir) params.set("sortdir", dir);
    else params.delete("sortdir");
    params.delete("p");
    return location.pathname + "?" + params.toString();
  }
  function buildSort() {
    const box = el("div", "qg-sorts");
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", "並び順");
    SORTS.forEach((s, i) => {
      const b = el("button", "qg-sort");
      b.type = "button";
      b.dataset.index = String(i);
      b.append(el("span", "qg-sort-icon", s.icon), el("span", "qg-sort-label", s.label), el("span", "qg-sort-dir"));
      b.onclick = () => {
        const key = s.key(),
          cur = currentSort(),
          on = key === "random" ? cur.by.startsWith("random") : cur.by === key;
        if (key === "random") navigate(sortPath("random_" + Math.floor(Math.random() * 1e8), null));
        else if (s.needsTwr && on) window.StashTagWeightedRecommendations?.reshuffle?.();
        else navigate(sortPath(key, on ? (cur.dir === "desc" ? "asc" : "desc") : "desc"));
      };
      box.append(b);
    });
    return box;
  }
  function renderSort() {
    const cur = currentSort();
    sortBox.querySelectorAll(".qg-sort").forEach((b) => {
      const s = SORTS[Number(b.dataset.index)],
        key = s.key(),
        on = key === "random" ? cur.by.startsWith("random") : cur.by === key;
      b.hidden = !!s.needsTwr && !window.StashTagWeightedRecommendations;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
      b.querySelector(".qg-sort-dir").textContent = on && key !== "random" ? (cur.dir === "desc" ? "↓" : "↑") : "";
      b.title = s.title + (s.needsTwr && on ? "\nもう一度押すとおすすめの顔ぶれを入れ替え" : on && key !== "random" ? "\nもう一度押すと" + (cur.dir === "desc" ? "昇順" : "降順") + "に切替" : "");
    });
  }
  // ---- 並び順を覚えておく ----
  // メニューの「シーン」等から開くと Stash の既定の並び順に戻るので、最後に使った並び順で開き直す
  const LAST_SORT_KEY = "quickGenres.lastSort";
  function rememberSort() {
    if (location.pathname !== "/scenes") return;
    const p = new URLSearchParams(location.search),
      by = p.get("sortby");
    if (!by) return;
    const v = JSON.stringify({ by: by.startsWith("random") ? "random" : by, dir: p.get("sortdir") || "", perPage: p.get("perPage") || "" });
    try {
      if (localStorage.getItem(LAST_SORT_KEY) !== v) localStorage.setItem(LAST_SORT_KEY, v);
    } catch {}
  }
  function lastSortPath(search) {
    let v = null;
    try {
      v = JSON.parse(localStorage.getItem(LAST_SORT_KEY) || "null");
    } catch {}
    if (!v?.by) return null;
    const p = new URLSearchParams(search || "");
    p.set("sortby", v.by === "random" ? "random_" + Math.floor(Math.random() * 1e8) : v.by);
    if (v.dir) p.set("sortdir", v.dir);
    else p.delete("sortdir");
    if (v.perPage && !p.get("perPage")) p.set("perPage", v.perPage);
    return "/scenes?" + p.toString();
  }
  // 並び順の指定が無い /scenes へのリンク（ナビゲーションの「シーン」など）を、最後の並び順付きに差し替える
  document.addEventListener(
    "click",
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!a) return;
      const u = new URL(a.getAttribute("href"), location.href);
      if (u.origin !== location.origin || u.pathname !== "/scenes" || u.searchParams.has("sortby")) return;
      const path = lastSortPath(u.search);
      if (!path) return;
      e.preventDefault();
      e.stopPropagation();
      navigate(path);
    },
    true,
  );
  // 並び順の指定なしで /scenes を直接開いた時も同じ
  if (location.pathname === "/scenes" && !new URLSearchParams(location.search).has("sortby")) {
    const path = lastSortPath(location.search);
    if (path) {
      history.replaceState(history.state, "", path);
      window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
    }
  }

  // ドラッグでスクロール（離すと慣性で流れる）。動かした時はクリック扱いにしない
  function dragScroll(box, axis) {
    const pos = (e) => (axis === "x" ? e.clientX : e.clientY),
      prop = axis === "x" ? "scrollLeft" : "scrollTop";
    let drag = null,
      glide = 0;
    const stop = () => cancelAnimationFrame(glide);
    box.addEventListener("pointerdown", (e) => {
      stop();
      if (e.button !== 0 || e.altKey || e.pointerType === "touch" || e.target.closest("input,select,textarea")) return;
      drag = { p: pos(e), start: box[prop], moved: false, id: e.pointerId, samples: [{ p: pos(e), t: performance.now() }] };
    });
    box.addEventListener("wheel", stop, { passive: true });
    box.addEventListener("pointermove", (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const d = pos(e) - drag.p;
      if (!drag.moved && Math.abs(d) < 6) return;
      if (!drag.moved) {
        drag.moved = true;
        try {
          box.setPointerCapture(e.pointerId);
        } catch {}
        box.classList.add("dragging");
      }
      box[prop] = drag.start - d;
      const now = performance.now();
      drag.samples.push({ p: pos(e), t: now });
      while (drag.samples.length > 2 && now - drag.samples[0].t > 100) drag.samples.shift();
    });
    const end = () => {
      if (!drag) return;
      if (drag.moved) {
        box.dataset.dragged = String(Date.now());
        const a = drag.samples[0],
          z = drag.samples[drag.samples.length - 1];
        let v = z.t - a.t > 0 ? -((z.p - a.p) / (z.t - a.t)) * 16.7 : 0;
        if (performance.now() - z.t > 80) v = 0;
        let last = performance.now();
        const step = (now) => {
          const f = Math.min(4, (now - last) / 16.7);
          last = now;
          if (Math.abs(v) < 0.4) return;
          const before = box[prop];
          box[prop] += v * f;
          if (box[prop] === before) return;
          v *= Math.pow(0.95, f);
          glide = requestAnimationFrame(step);
        };
        stop();
        glide = requestAnimationFrame(step);
      }
      box.classList.remove("dragging");
      drag = null;
    };
    box.addEventListener("pointerup", end);
    box.addEventListener("pointercancel", end);
    box.addEventListener(
      "click",
      (e) => {
        if (Date.now() - Number(box.dataset.dragged || 0) < 300) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true,
    );
  }

  // ---- 女優パネル（シーン一覧の右に開閉式。並び替え・絞り込み・評価・詳細） ----
  const PANEL_KEY = "quickGenres.panel", // { open, sort, rated, unwatched }
    PANEL_FACE = 52,
    PANEL_PAGE = 60;
  const PANEL_SORTS = [
    ["rating", "評価順"],
    ["unwatched", "未視聴が多い順"],
    ["scenes", "出演数順"],
    ["latest", "最新作が新しい順"],
    ["played", "最近見た順"],
    ["name", "名前順"],
  ];
  let panelState = (() => {
    try {
      const v = JSON.parse(localStorage.getItem(PANEL_KEY) || "{}");
      return { open: !!v.open, sort: v.sort || "rating", unrated: !!v.unrated, fresh: !!v.fresh, fav: !!v.fav, unwatched: !!v.unwatched, photo: v.photo !== false };
    } catch {
      return { open: false, sort: "rating", unrated: false, fresh: false, fav: false, unwatched: false, photo: true };
    }
  })();
  function savePanel() {
    try {
      localStorage.setItem(PANEL_KEY, JSON.stringify({ open: panelState.open, sort: panelState.sort, unrated: panelState.unrated, fresh: panelState.fresh, fav: panelState.fav, unwatched: panelState.unwatched, photo: panelState.photo }));
    } catch {}
  }
  let panel = null,
    panelData = null,
    panelAt = 0,
    panelShown = 0,
    panelQuery = "",
    panelMaleIds = new Set();
  const NON_FEMALE_RE = /男の娘|女装|ニューハーフ|シーメール|メス男子|shemale|ladyboy|transgender|transsexual|femboy|crossdress/i;
  const isNonFemale = (p) => {
    const g = String(p.gender || "").toUpperCase();
    if (g && g !== "FEMALE") return true;
    if (panelMaleIds.has(String(p.id))) return true;
    if (NON_FEMALE_RE.test(p.name || "") || (p.alias_list || []).some((a) => NON_FEMALE_RE.test(String(a)))) return true;
    return false;
  };
  // 出演者全員と、作品から集計した数字（分割パーツの続きは数えない）
  async function loadPanelData(force = false) {
    if (!force && panelData && Date.now() - panelAt < COUNT_TTL) return panelData;
    const cont = (await window.StashSplitParts?.tags().catch(() => null))?.cont;
    const d = await gql(
      "query QGPanel($f:SceneFilterType){p:findPerformers(performer_filter:{scene_count:{value:0,modifier:GREATER_THAN}},filter:{per_page:-1}){performers{" +
        PERF_FIELDS +
        "}} s:findScenes(scene_filter:$f,filter:{per_page:-1}){scenes{date created_at play_count last_played_at performers{id}}}}",
      { f: cont ? { tags: { value: [], excludes: [cont], modifier: "INCLUDES_ALL", depth: 0 } } : {} },
    );
    const stats = new Map(),
      freshSince = new Date(Date.now() - 14 * 864e5).toISOString();
    for (const s of d.s.scenes)
      for (const p of s.performers) {
        const o = stats.get(p.id) || { total: 0, unwatched: 0, fresh: 0, latest: "", played: "" };
        o.total++;
        if (!s.play_count) o.unwatched++;
        if (s.created_at > freshSince) o.fresh++;
        if (s.date && s.date > o.latest) o.latest = s.date;
        if (s.last_played_at && s.last_played_at > o.played) o.played = s.last_played_at;
        stats.set(p.id, o);
      }
    panelData = d.p.performers.map((p) => ({ ...p, ...(stats.get(p.id) || { total: 0, unwatched: 0, fresh: 0, latest: "", played: "" }) }));
    panelMaleIds = new Set((await malePerformers()).map((p) => String(p.id)));
    panelAt = Date.now();
    return panelData;
  }
  function panelList() {
    const q = panelQuery.trim().toLowerCase();
    const vm = viewMode();
    let list = panelData.filter((p) => p.total > 0 && (vm === "m" ? isNonFemale(p) : !isNonFemale(p)));
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.alias_list || []).some((a) => String(a).toLowerCase().includes(q)));
    if (panelState.photo) list = list.filter((p) => hasImage(p));
    if (panelState.fav) list = list.filter((p) => (p.rating100 || 0) >= 80);
    if (panelState.unwatched) list = list.filter((p) => p.unwatched > 0);
    if (panelState.unrated) list = list.filter((p) => !p.rating100);
    if (panelState.fresh) list = list.filter((p) => p.fresh);
    const by = {
      rating: (a, b) => (b.rating100 || 0) - (a.rating100 || 0) || (hasImage(b) ? 1 : 0) - (hasImage(a) ? 1 : 0) || b.total - a.total,
      unwatched: (a, b) => b.unwatched - a.unwatched || (b.rating100 || 0) - (a.rating100 || 0),
      scenes: (a, b) => b.total - a.total,
      latest: (a, b) => (b.latest || "").localeCompare(a.latest || ""),
      played: (a, b) => (b.played || "").localeCompare(a.played || ""),
      name: (a, b) => a.name.localeCompare(b.name, "ja"),
    }[panelState.sort];
    return list.sort(by);
  }
  // 顔の位置は顔の帯と共通（保存済みなら即、無ければ画面に入った人から順に調べる）
  const faceQueue = [];
  let faceBusy = false;
  function queueFace(p, node, size) {
    const f = readFaces()[p.id];
    if (f && f.img === p.image_path) return paintFace(node, f, size);
    if (!hasImage(p)) return node.classList.add("noimage");
    node.classList.add("loading");
    faceQueue.push({ p, node, size });
    pumpFaces();
  }
  async function pumpFaces() {
    if (faceBusy) return;
    faceBusy = true;
    while (faceQueue.length) {
      const { p, node, size } = faceQueue.shift();
      if (!node.isConnected) continue;
      try {
        let f = readFaces()[p.id];
        if (!f || f.img !== p.image_path) {
          f = await findFace(p);
          const all = readFaces();
          all[p.id] = f;
          writeFaces(all);
        }
        node.classList.remove("loading");
        paintFace(node, f, size);
      } catch {
        node.classList.remove("loading");
      }
    }
    faceBusy = false;
  }
  const panelFaceObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        panelFaceObserver.unobserve(e.target);
        const p = panelData?.find((x) => String(x.id) === e.target.dataset.id);
        if (p) queueFace(p, e.target.querySelector(".qg-face"), PANEL_FACE);
      }
    },
    { rootMargin: "200px 0px" },
  );
  async function ratePerformer(p, rating, row) {
    const value = p.rating100 === rating ? null : rating; // 同じ星をもう一度で解除
    try {
      const d = await gql("mutation QGRate($input:PerformerUpdateInput!){performerUpdate(input:$input){id rating100}}", { input: { id: String(p.id), rating100: value } });
      p.rating100 = d.performerUpdate.rating100;
      poolCache = null;
      paintStars(row.querySelector(".qgp-stars"), p);
    } catch (e) {
      console.warn("[Quick Genres] 評価を保存できません", e);
    }
  }
  function paintStars(box, p) {
    box.querySelectorAll("button").forEach((b, i) => b.classList.toggle("on", (p.rating100 || 0) >= (i + 1) * 20));
    box.title = p.rating100 ? "評価 ★" + p.rating100 / 20 + "（同じ星をもう一度で解除）" : "未評価（星をクリックで評価）";
  }
  function panelRow(p, active) {
    const row = el("div", "qgp-row" + (active.includes(String(p.id)) ? " active" : ""));
    row.dataset.id = String(p.id);
    const faceBtn = el("button", "qgp-face");
    faceBtn.type = "button";
    faceBtn.title = "クリックで絞り込み（もう一度で解除）／Shift+クリックで追加";
    const ring = el("span", "qgp-ring");
    ring.append(el("span", "qg-face"));
    faceBtn.append(ring);
    const main = el("div", "qgp-main");
    const name = el("button", "qgp-name", p.name);
    name.type = "button";
    name.title = faceBtn.title;
    const stars = el("div", "qgp-stars");
    for (let i = 1; i <= 5; i++) {
      const s = el("button", null, "★");
      s.type = "button";
      s.onclick = () => ratePerformer(p, i * 20, row);
      stars.append(s);
    }
    paintStars(stars, p);
    const meta = el("div", "qgp-meta");
    meta.textContent = "出演 " + p.total + (p.unwatched ? "・未視聴 " + p.unwatched : "") + (p.fresh ? "・新着 " + p.fresh : "") + (p.latest ? "・最新 " + p.latest : "");
    main.append(name, stars, meta);
    const actions = el("div", "qgp-actions");
    const expand = el("button", "qgp-expand", "▾");
    expand.type = "button";
    expand.title = "よく付くタグ・最近の作品";
    expand.onclick = () => toggleDetail(p, row);
    const open = el("button", "qgp-open", "↗");
    open.type = "button";
    open.title = "出演者ページへ";
    open.onclick = () => navigate("/performers/" + p.id);
    actions.append(expand, open);
    const pick = (e) => {
      const act = activePerformerIds(),
        id = String(p.id),
        cur = act.filter((x) => x !== id);
      const next = e.shiftKey ? (act.includes(id) ? cur : [...cur, id]) : act.length === 1 && act[0] === id ? [] : [id];
      navigate(performerPath(next.map((x) => panelData.find((q) => String(q.id) === x) || { id: x, name: x })));
    };
    faceBtn.onclick = pick;
    name.onclick = pick;
    row.append(faceBtn, main, actions);
    panelFaceObserver.observe(row);
    return row;
  }
  // 詳細：よく付くタグ（クリックでこの人×タグに絞り込み）、最近の作品（クリックで再生）、この人をザッピング
  async function toggleDetail(p, row) {
    const old = row.querySelector(".qgp-detail");
    if (old) {
      old.remove();
      row.classList.remove("expanded");
      return;
    }
    row.classList.add("expanded");
    const box = el("div", "qgp-detail", "読み込み中…");
    row.append(box);
    try {
      const cont = (await window.StashSplitParts?.tags().catch(() => null))?.cont;
      const f = { performers: { value: [String(p.id)], modifier: "INCLUDES" } };
      if (cont) f.tags = { value: [], excludes: [cont], modifier: "INCLUDES_ALL", depth: 0 };
      const d = await gql('query QGPerfScenes($f:SceneFilterType){findScenes(scene_filter:$f,filter:{per_page:-1,sort:"date",direction:DESC}){scenes{id title code play_count paths{screenshot} tags{id name}}}}', { f });
      const scenes = d.findScenes.scenes;
      box.replaceChildren();
      const counts = new Map();
      for (const s of scenes) for (const t of s.tags) if (!NOT_GENRE.test(t.name) && !UNSAFE.test(t.name)) counts.set(t.id, { t, n: (counts.get(t.id)?.n || 0) + 1 });
      const tags = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 10);
      if (tags.length) {
        const tbox = el("div", "qgp-tags");
        for (const { t, n } of tags) {
          const c = el("button", "qgp-tag", t.name + " " + n);
          c.type = "button";
          c.title = "この人 × " + t.name + " で絞り込み";
          c.onclick = () => {
            // この人に絞ってから、同じ履歴の中でタグも足す（戻る1回で元の一覧へ）
            navigate(performerPath([p]));
            history.replaceState(history.state, "", genrePath([{ id: t.id, name: t.name }]));
            window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
          };
          tbox.append(c);
        }
        box.append(tbox);
      }
      const thumbs = el("div", "qgp-thumbs"),
        ids = scenes.map((s) => String(s.id));
      for (const s of scenes.slice(0, 6)) {
        const b = el("button", "qgp-thumb" + (s.play_count ? "" : " unwatched"));
        b.type = "button";
        b.title = (s.code ? s.code + " " : "") + (s.title || "") + (s.play_count ? "" : "（未視聴）");
        if (s.paths?.screenshot) {
          const img = el("img");
          img.loading = "lazy";
          img.alt = "";
          img.src = s.paths.screenshot;
          b.append(img);
        }
        b.onclick = () => window.StashMiniPlayer?.open(String(s.id), { list: ids });
        thumbs.append(b);
      }
      box.append(thumbs);
      const zap = el("button", "qgp-zap", "▶ この人の作品をザッピング（未視聴から）");
      zap.type = "button";
      const order = [...scenes.filter((s) => !s.play_count), ...scenes.filter((s) => s.play_count)].map((s) => String(s.id));
      zap.disabled = !order.length;
      zap.onclick = () => window.StashMiniPlayer?.open(order[0], { list: order, zap: true });
      box.append(zap);
    } catch (e) {
      box.textContent = "読み込めませんでした：" + e.message;
    }
  }
  function buildPanel() {
    const p = el("aside", "qgp");
    p.setAttribute("aria-label", "女優パネル");
    p.innerHTML =
      '<div class="qgp-head"><span class="qgp-title">女優</span><span class="qgp-count"></span><button type="button" class="qgp-head-btn qgp-clear" hidden title="出演者の絞り込みを解除">解除</button><button type="button" class="qgp-head-btn qgp-rand" title="今の絞り込みからランダムに1人選んで表示">ランダム</button><button type="button" class="qgp-close" title="閉じる">×</button></div>' +
      '<div class="qgp-tools"><input class="qgp-search" type="search" placeholder="名前・別名で検索"><select class="qgp-sort" title="並び順"></select></div>' +
      '<div class="qgp-filters"><button type="button" class="qgp-filter" data-key="photo" title="写真がある出演者だけ表示">写真あり</button><button type="button" class="qgp-filter" data-key="fav" title="★4以上の高評価だけ">★4+</button><button type="button" class="qgp-filter" data-key="unwatched" title="未視聴作品がある人だけ">未視聴</button><button type="button" class="qgp-filter" data-key="unrated" title="まだ評価していない人だけ">未評価</button><button type="button" class="qgp-filter" data-key="fresh" title="この14日に作品が入った人だけ">新着</button><button type="button" class="qgp-refresh" title="数字を取り直す">↻</button></div>' +
      '<div class="qgp-list"></div>';
    const sort = p.querySelector(".qgp-sort");
    for (const [k, label] of PANEL_SORTS) sort.append(new Option(label, k, false, k === panelState.sort));
    sort.onchange = () => {
      panelState.sort = sort.value;
      savePanel();
      renderPanel();
    };
    p.querySelector(".qgp-close").onclick = () => togglePanel(false);
    p.querySelector(".qgp-clear").onclick = () => navigate(performerPath([]));
    p.querySelector(".qgp-rand").onclick = () => {
      const items = panelData ? panelList() : [];
      if (!items.length) return;
      const picked = items[Math.floor(Math.random() * items.length)];
      navigate(performerPath([picked]));
    };
    const search = p.querySelector(".qgp-search");
    search.addEventListener("keydown", (e) => e.stopPropagation()); // ミニプレイヤー等のキー操作に取られない
    let timer = null;
    search.oninput = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        panelQuery = search.value;
        renderPanel();
      }, 150);
    };
    for (const b of p.querySelectorAll(".qgp-filter"))
      b.onclick = () => {
        panelState[b.dataset.key] = !panelState[b.dataset.key];
        savePanel();
        renderPanel();
      };
    p.querySelector(".qgp-refresh").onclick = async () => {
      await loadPanelData(true);
      renderPanel();
    };
    // 下まで来たら続きを表示
    const list = p.querySelector(".qgp-list");
    dragScroll(list, "y");
    list.addEventListener("scroll", () => {
      if (list.scrollTop + list.clientHeight > list.scrollHeight - 300) renderPanel(true);
    });
    return p;
  }
  let panelToken = 0;
  async function renderPanel(more = false) {
    if (!panel) return;
    const token = ++panelToken;
    for (const b of panel.querySelectorAll(".qgp-filter")) b.classList.toggle("active", !!panelState[b.dataset.key]);
    const list = panel.querySelector(".qgp-list");
    if (!panelData) list.textContent = "読み込み中…";
    try {
      await loadPanelData();
    } catch (e) {
      list.textContent = "読み込めませんでした：" + e.message;
      return;
    }
    if (token !== panelToken || !panel) return;
    const items = panelList(),
      active = activePerformerIds();
    panel.querySelector(".qgp-count").textContent = items.length + "人";
    const clr = panel.querySelector(".qgp-clear");
    if (clr) clr.hidden = active.length === 0;
    if (!more) {
      list.replaceChildren();
      list.scrollTop = 0;
      panelShown = 0;
    }
    const end = Math.min(items.length, panelShown + PANEL_PAGE);
    for (let i = panelShown; i < end; i++) list.append(panelRow(items[i], active));
    panelShown = end;
    if (!items.length) list.append(el("div", "qgp-empty", "該当する出演者がいません"));
  }
  function markPanelActive() {
    if (!panel) return;
    const active = activePerformerIds();
    for (const r of panel.querySelectorAll(".qgp-row")) r.classList.toggle("active", active.includes(r.dataset.id));
    const clr = panel.querySelector(".qgp-clear");
    if (clr) clr.hidden = active.length === 0;
  }
  function togglePanel(open = !panelState.open) {
    panelState.open = open;
    savePanel();
    schedule();
  }
  const isPanelEnabled = () => {
    try { return JSON.parse(localStorage.getItem("suite.prefs") || "{}").actressPanelButton !== false; } catch { return true; }
  };
  function ensurePanel(onScenes) {
    const enabled = isPanelEnabled();
    const ptBtn = topBox?.querySelector(".qg-panel-toggle");
    if (ptBtn) ptBtn.hidden = !enabled;
    const show = onScenes && enabled && panelState.open;
    document.body.classList.toggle("qg-panel-shown", show);
    topBox?.querySelector(".qg-panel-toggle")?.classList.toggle("active", show);
    if (!show) {
      panel?.remove();
      panel = null;
      return;
    }
    if (!panel || !panel.isConnected) {
      panel = buildPanel();
      document.body.append(panel);
      renderPanel();
    } else markPanelActive();
  }

  window.addEventListener("storage", (e) => { if (!e.key || e.key === "suite.prefs" || e.key === "viewMode.mode" || e.key === "suite.lang") { headSig = ""; schedule(); if (panel) renderPanel(); } });
  document.addEventListener("transitionend", (e) => { if (e.target instanceof Element && e.target.closest(".sidebar,.sidebar-pane")) { headSig = ""; schedule(); } }, true);
  // ---- 差し込み（React の再描画で消えたら入れ直す） ----
  let lastHref = "";
  let headSig = "";
  function ensure() {
    const onScenes = location.pathname === "/scenes";
    const sidebar = onScenes ? document.querySelector(".sidebar") : null;
    if (window.QuickBoard) {
      // 左サイドバーはお気に入りボード（board.js）。ジャンル一覧は出さない
      section?.remove();
      section = null;
      if (sidebar) window.QuickBoard.mount(sidebar);
      else if (!document.querySelector(".mh-board-box .qb-section, .mh-board-box > *")) window.QuickBoard.unmount(); // ホーム（My Home）に置いている時は外さない
    } else if (!sidebar) {
      section?.remove();
      section = null;
    } else if (!section || section.parentElement !== sidebar) {
      section?.remove();
      section = buildSection();
      sidebar.insertBefore(section, sidebar.querySelector(":scope > .sidebar-footer"));
      lastHref = "";
    }
    const content = onScenes ? document.querySelector(".sidebar-pane-content") : null,
      toolbar = content?.querySelector(":scope > .filtered-list-toolbar");
    if (!toolbar) {
      for (const n of [topBox, sortBox, band]) n?.remove();
      topBox = sortBox = band = null;
    } else {
      content.classList.add("qg-host");
      if (!sortBox || !toolbar.contains(sortBox)) {
        sortBox?.remove();
        sortBox = buildSort();
        toolbar.append(sortBox);
      }
      if (!topBox || !toolbar.contains(topBox)) {
        topBox?.remove();
        topBox = buildTop();
        toolbar.append(topBox);
        resizeObserver.disconnect();
        resizeObserver.observe(content);
      }
      // 顔の帯はツールバーのすぐ下（一覧の流れの中）に置く
      const anchor = content.querySelector(":scope > .qg-stack-bar") || toolbar;
      if (!band || band.parentElement !== content || band.previousElementSibling !== anchor) {
        const fresh = !band;
        if (fresh) band = buildBand();
        anchor.after(band);
        if (fresh) renderPerformers();
      }
      renderSort();
      renderTop();
      // 位置合わせは寸法を測るので重い（500件の一覧だと1回で数十〜数百ms）。幅・URL・ツールバーの中身が変わった時だけ
      const sbW = Math.round(document.querySelector(".sidebar")?.getBoundingClientRect().width || 0);
      const sig = [contentWidth, sbW, location.href, toolbar.childElementCount, toolbar.textContent.length, content.querySelector(":scope > .pagination-index-container")?.textContent || ""].join("|");
      if (sig !== headSig) {
        headSig = sig;
        placeHead(content, toolbar);
      }
    }
    rememberSort();
    ensurePanel(onScenes);
    if (band && bandMode === "page" && pageKey() !== bandPageKey) renderPerformers();
    if (section && location.href !== lastHref) {
      lastHref = location.href;
      renderSection();
    }
  }
  let timer = null;
  function schedule() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      ensure();
    }, 200);
  }
  new MutationObserver((ms) => {
    // 自分の描画による変化では動かない
    if (ms.every((m) => (m.target.closest ? m.target : m.target.parentElement)?.closest?.(".qg-section,.qg-top,.qg-sorts,.qg-band,.qgp"))) return;
    schedule();
  }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("popstate", schedule);
  window.addEventListener("resize", schedule);
  window.addEventListener("focus", () => {
    lastHref = "";
    schedule();
  });
  schedule();

  // ---- 下にスクロールしても、一覧の上の行（左の並べ替えボタン・真ん中の操作の帯・右のスイッチ）を上のメニューのすぐ下に残す ----
  //   今どの並べ方・絞り込みか見えるように。帯は position: sticky、左右の部品（帯の行に重ねて置いた absolute）は
  //   帯が上に着いたら position: fixed にして、その時の横の位置のまま止める
  const NAV_H = 48;
  const stickStyle = document.createElement("style");
  stickStyle.textContent = `
.qg-host > .filtered-list-toolbar { position: sticky; top: ${NAV_H}px; z-index: 25; background: #202b33; }
/* 上に着いた帯は左右の端まで背景を伸ばす（帯の左右の隙間から、下を流れる顔の帯のモード切替などが透けて見えていた）。
   影で伸ばして横に切るので、ページに横スクロールは出ない */
.qg-host.qg-stuck > .filtered-list-toolbar { box-shadow: 0 0 0 100vmax #202b33; clip-path: inset(0 -100vmax); border-bottom: 1px solid #0008; }
.qg-host > .qg-sorts, .qg-host > .qg-top { z-index: 26 !important; } /* 帯（背景あり）より手前に。一番上にいる時も押せるように */
/* 左のサイドバーの開閉ボタンも帯より手前に（広い画面では帯が左端から始まって隠していた）。
   位置（position）は変えない：Stash が sticky にしてスクロールしても上に残しているので、上書きすると下にずれて流れてしまう */
.qg-host .sidebar-toggle-button { z-index: 27; }
.qg-stuck-part { position: fixed !important; z-index: 26 !important; background: #202b33; } /* top は帯の中の高さのまま（JS で入れる） */
`;
  document.head.append(stickStyle);
  function stickRow() {
    const host = document.querySelector(".qg-host"),
      bar = host?.querySelector(":scope > .filtered-list-toolbar");
    if (!host || !bar) return;
    // 帯そのものが上に貼り付いた瞬間に左右の部品も止める（親の要素で判定すると 8px 遅れて、その間ボタンが動いていた）
    // 判定はスクロール量で（貼り付く帯の位置はスクロールの直後に古い値が読めることがある）
    if (!host.classList.contains("qg-stuck")) bar.dataset.qgTop = String(bar.getBoundingClientRect().top + scrollY);
    const stuck = scrollY + NAV_H + 0.5 >= (Number(bar.dataset.qgTop) || NAV_H + 1);
    host.classList.toggle("qg-stuck", stuck);
    for (const part of host.querySelectorAll(":scope > .qg-sorts, :scope > .qg-top")) {
      if (stuck && !part.classList.contains("qg-stuck-part")) {
        // 止める前の横の位置と幅を、そのまま固定に引き継ぐ。元の書き込み（並べ方を置いた時の left など）は覚えておいて、戻す時に戻す
        // 帯の中での高さ（帯の上端からの距離）を保つ。以前は上端に揃えて 8px 跳ねていた
        const r = part.getBoundingClientRect(),
          off = Math.max(0, Math.round((bar.offsetHeight - 34) / 2));
        part.dataset.qgKeep = JSON.stringify({ left: part.style.left, right: part.style.right, width: part.style.width, top: part.style.top });
        part.classList.add("qg-stuck-part");
        Object.assign(part.style, { left: Math.round(r.left) + "px", right: "auto", width: "", top: NAV_H + off + "px" });
      } else if (!stuck && part.classList.contains("qg-stuck-part")) unstick(part);
      // 貼り付いていない間に、帯の上端からの距離を覚えておく
      if (!stuck && !part.classList.contains("qg-stuck-part")) part.dataset.qgOff = String(Math.round(part.getBoundingClientRect().top - bar.getBoundingClientRect().top));
    }
  }
  function unstick(part) {
    part.classList.remove("qg-stuck-part");
    let keep = { left: "", right: "", width: "", top: "" };
    try {
      keep = { ...keep, ...JSON.parse(part.dataset.qgKeep || "{}") };
    } catch {}
    Object.assign(part.style, keep);
    delete part.dataset.qgKeep;
  }
  window.addEventListener("scroll", stickRow, { passive: true });
  window.addEventListener("resize", () => {
    // 幅が変わったら位置を測り直す（いったん外してから止め直す）
    document.querySelectorAll(".qg-stuck-part").forEach(unstick);
    stickRow();
  });
  window.StashQuickGenres = {
    refresh: () => {
      lastHref = "";
      counts.clear();
      poolCache = null;
      renderPerformers();
      schedule();
    },
  };
})();

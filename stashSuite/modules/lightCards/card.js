"use strict";
// Light Scene Cards：カード本体。Stash が一覧の取得で渡してくれる内容（scene）だけで描くので、カードごとの問い合わせが無い。
// 縦型（表紙が上）／横型（表紙が左・情報が右）は設定 layout で切り替える。
(function () {
  const LC = window.LightCards,
    { PluginApi } = window;
  if (!LC || !PluginApi || LC.cardReady) return;
  LC.cardReady = true;
  const { React } = PluginApi,
    h = React.createElement,
    { Icon } = PluginApi.components,
    FA = PluginApi.libraries.FontAwesomeSolid,
    { Link } = PluginApi.libraries.ReactRouterDOM;

  function useSettings() {
    const [s, set] = React.useState(LC.store.get());
    React.useEffect(() => LC.store.subscribe(set), []);
    return s;
  }
  // 一覧の横幅（横型の幅を決めるのに使う）。行が1つ変わっても全カードを測らないよう、行の要素を1つだけ見張る
  const rowWidth = { value: 0, subs: new Set() };
  const rowSeen = new WeakSet();
  const rowObserver = new ResizeObserver((entries) => {
    const w = Math.round(entries[entries.length - 1].contentRect.width);
    if (w === rowWidth.value) return;
    rowWidth.value = w;
    for (const fn of rowWidth.subs) fn(w);
  });
  // 横型のタグの欄：空いた高さに丸ごと入る行数を、見えているカード1枚で測ってページ全体に設定（全カードは測らない）
  const CHIP_ROW = 18,
    CHIP_GAP = 3;
  let chipTimer = 0;
  function scheduleChipFit() {
    cancelAnimationFrame(chipTimer);
    chipTimer = requestAnimationFrame(() => {
      const wrap = [...document.querySelectorAll(".lc-side .lc-tagwrap")].find((e) => e.getBoundingClientRect().height > 0);
      if (!wrap) return;
      const rows = Math.max(0, Math.floor((wrap.clientHeight + CHIP_GAP) / (CHIP_ROW + CHIP_GAP)));
      const v = rows ? rows * CHIP_ROW + (rows - 1) * CHIP_GAP + "px" : "0px";
      if (document.documentElement.style.getPropertyValue("--lc-chip-max") !== v) document.documentElement.style.setProperty("--lc-chip-max", v);
    });
  }
  LC.store.subscribe(scheduleChipFit);
  rowWidth.subs.add(scheduleChipFit);
  function useRowWidth(ref, enabled) {
    const [w, set] = React.useState(rowWidth.value);
    React.useEffect(() => {
      if (!enabled) return;
      const row = ref.current?.parentElement;
      if (row && !rowSeen.has(row)) {
        rowSeen.add(row);
        rowObserver.observe(row);
      }
      rowWidth.subs.add(set);
      return () => rowWidth.subs.delete(set);
    }, []);
    return w;
  }
  // カードの幅：設定の「大きさ」（形ごとの目安の幅）に一番近くなる列数で、行いっぱいに並べる。
  // Stash 本体の拡大スライダーはページを移ると元に戻るので使わない（設定はサーバーに保存）
  function fitWidth(target, rowW) {
    const M = 10; // カード1枚の左右の余白
    if (!rowW) return target;
    const cols = Math.max(1, Math.round((rowW + M) / (target + M)));
    return Math.floor(rowW / cols) - M;
  }
  // プレビュー動画（横型ではカード全体に重ねる。表紙の欄は縦長で狭いため）。
  // 動画が無い作品は onMissing を呼び、シークバー用の画像（スプライト）での場面送りに切り替える
  // scrub（0〜1）を渡すと再生せず、マウスの左右の位置に合わせてプレビュー動画の中の位置を動かす（場面送り。スプライトが無い作品用）。
  // プレビュー動画は作品全体から等間隔に切り出した短い動画なので、位置の割合がほぼ作品の中の割合になる
  // source を true にすると、プレビュー動画ではなく元の動画（Stash の配信）で場面送りする（細かいが、1 回の移動に 0.3〜0.5 秒かかる）
  // auto を true にすると、場面送りでマウスを止めておいた時に自動で再生する（元の動画は全体の 8 か所を 2.5 秒ずつ、プレビュー動画はそのまま流す）
  function Preview({ scene, card, onMissing, scrub, source, auto, delay = 1 }) {
    const v = React.useRef(null),
      want = React.useRef(scrub),
      scrubbing = scrub != null,
      touring = React.useRef(false), // 自動再生の最中
      [tour, setTour] = React.useState(null), // 自動再生で今見せている位置（0〜1）
      [shown, setShown] = React.useState(!scrubbing); // 場面送り：最初の 1 コマが出るまでは透明（真っ黒の枠で表紙を隠さない）
    want.current = scrub;
    // 位置の移動中に次の移動を頼むと、1 コマも出ないまま真っ黒が続く。移動が終わってから最新のマウスの位置へ動かす
    const apply = () => {
      const el = v.current;
      if (!el || !el.duration || el.seeking) return;
      const t = Math.min(el.duration - 0.05, want.current * el.duration);
      if (Math.abs(el.currentTime - t) > 0.03) el.currentTime = t;
    };
    React.useEffect(() => {
      const el = v.current;
      if (!scrubbing || !el) return;
      const onSeeked = () => {
        setShown(true);
        if (!touring.current) apply();
      };
      el.addEventListener("loadedmetadata", apply);
      el.addEventListener("seeked", onSeeked);
      el.addEventListener("loadeddata", onSeeked);
      return () => {
        el.removeEventListener("loadedmetadata", apply);
        el.removeEventListener("seeked", onSeeked);
        el.removeEventListener("loadeddata", onSeeked);
        // 元の動画は大きいので、離れたらすぐ読み込みをやめる（要素を消しただけでは通信が続くことがある）
        el.removeAttribute("src");
        el.load();
      };
    }, [scrubbing]);
    React.useEffect(() => {
      if (scrubbing) apply();
    }, [scrub]);
    // 自動再生：マウスを止めて delay 秒（設定で選ぶ）たったら始め、動かしたらやめてマウスの位置に戻る
    React.useEffect(() => {
      const el = v.current;
      if (!auto || !scrubbing || !el) return;
      const timers = [];
      const later = (f, ms) => timers.push(setTimeout(f, ms));
      const onTime = () => touring.current && el.duration && setTour(el.currentTime / el.duration);
      el.addEventListener("timeupdate", onTime);
      later(() => {
        if (!el.duration) return;
        touring.current = true;
        if (!source) {
          // プレビュー動画は作品全体から切り出した物なので、そのまま流せば数か所を順に見せられる
          el.loop = true;
          el.play().catch(() => {});
          return;
        }
        const N = 8,
          pts = Array.from({ length: N }, (_, i) => (i + 0.5) / N);
        let i = Math.max(0, pts.findIndex((p) => p >= (want.current ?? 0)));
        const step = () => {
          if (!touring.current) return;
          const p = pts[i++ % N];
          setTour(p);
          el.currentTime = p * el.duration;
          el.play().catch(() => {});
          later(step, 2500);
        };
        step();
      }, (Number.isFinite(Number(delay)) ? Number(delay) : 1) * 1000); // 0 秒も選べる
      return () => {
        timers.forEach(clearTimeout);
        touring.current = false;
        el.removeEventListener("timeupdate", onTime);
        el.pause();
        el.loop = false;
        setTour(null);
      };
    }, [scrub, auto, delay]);
    const at = tour ?? scrub; // 帯と時刻に出す位置
    const video = h("video", {
      ref: v,
      className: "lc-preview" + (card ? " lc-preview-card" : ""),
      style: shown ? undefined : { opacity: 0 },
      src: source ? scene.paths.stream : scene.paths.preview,
      muted: true,
      autoPlay: !scrubbing,
      loop: !scrubbing,
      preload: source ? "metadata" : "auto",
      playsInline: true,
      onError: (e) => {
        e.currentTarget.style.display = "none"; // プレビュー未生成
        onMissing?.();
      },
    });
    if (!scrubbing) return video;
    const dur = scene.files?.[0]?.duration || 0;
    return h(
      React.Fragment,
      null,
      video,
      h("div", { className: "lc-sprite-pos lc-scrub-pos", style: { "--p": at * 100 + "%" } }), // 下の細い帯：作品の中のどのあたりか
      dur > 0 && h("span", { className: "lc-sprite-time lc-scrub-time" }, (tour != null ? "▶ " : "") + (clock(at * dur) || "0:00")),
    );
  }
  // スプライトでの場面送り：マウスの左右の位置（pos 0〜1）に合わせて、その時刻の小さな場面画像を見せる
  function SpriteScrub({ scene, pos, card, onEmpty }) {
    const info = PluginApi.hooks.useSpriteInfo(scene.paths?.vtt),
      box = React.useRef(null),
      [size, setSize] = React.useState(null);
    // 場面画像も無い作品（null＝読み込めなかった）は、プレビューをやめる（空の黒い枠を残さない）
    React.useEffect(() => {
      if (info === null || (info && !info.length)) onEmpty?.();
    }, [info]);
    // 枠の大きさ：出始めた瞬間は 0 のことがある（0 倍で描くと黒い枠だけになる）ので、描くたびに測り、変わっていたら直す
    React.useLayoutEffect(() => {
      const r = box.current?.getBoundingClientRect();
      if (r && r.width && (!size || Math.abs(r.width - size[0]) > 1 || Math.abs(r.height - size[1]) > 1)) setSize([r.width, r.height]);
    });
    const cues = info || [];
    const cue = cues.length ? cues[Math.min(cues.length - 1, Math.floor(pos * cues.length))] : null;
    let inner = null;
    if (cue && size) {
      // 縦型は表紙の枠を埋める（はみ出しは切る）、横型はカード全体に場面全体を収める
      const k = (card ? Math.min : Math.max)(size[0] / cue.w, size[1] / cue.h);
      inner = h("div", {
        className: "lc-sprite-img",
        style: {
          width: cue.w,
          height: cue.h,
          backgroundImage: "url(" + JSON.stringify(cue.url) + ")",
          backgroundPosition: -cue.x + "px " + -cue.y + "px",
          transform: "translate(-50%,-50%) scale(" + k + ")",
        },
      });
    }
    return h(
      "div",
      { ref: box, className: "lc-sprite" + (card ? " lc-preview-card" : "") + (cue ? "" : " empty") },
      inner,
      cue && h("div", { className: "lc-sprite-pos", style: { left: pos * 100 + "%" } }),
      cue && h("span", { className: "lc-sprite-time" }, clock(cue.start) || "0:00"),
    );
  }
  // 品番：クリックでコピー（ページは開かない）
  function CodeBadge({ code, inline }) {
    const [copied, setCopied] = React.useState(false);
    const copy = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(code);
      } catch {
        const t = Object.assign(document.createElement("textarea"), { value: code });
        document.body.append(t);
        t.select();
        document.execCommand("copy");
        t.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    };
    return h("button", { type: "button", className: "lc-code" + (inline ? " inline" : "") + (copied ? " copied" : ""), title: "クリックで品番をコピー", onClick: copy }, copied ? "コピーしました" : code);
  }
  const pad = (n) => String(n).padStart(2, "0");
  function clock(sec) {
    if (!(sec > 0)) return "";
    sec = Math.round(sec);
    const hh = Math.floor(sec / 3600),
      mm = Math.floor((sec % 3600) / 60);
    return (hh ? hh + ":" + pad(mm) : mm) + ":" + pad(sec % 60);
  }
  const gb = (b) => (b > 0 ? (b / 1024 ** 3 >= 1 ? (b / 1024 ** 3).toFixed(2) + "GB" : Math.round(b / 1024 ** 2) + "MB") : "");
  function resolution(f) {
    const p = Math.min(f?.width || 0, f?.height || 0);
    if (!p) return "";
    if (p >= 2000) return "4K";
    if (p >= 1400) return "1440p";
    if (p >= 1000) return "1080p";
    if (p >= 700) return "720p";
    return p >= 460 ? "480p" : "SD";
  }
  const fileName = (path) => String(path || "").split(/[\\/]/).pop().replace(/\.[^.]+$/, "");
  const isMale = (p) => /^(MALE|TRANSGENDER_MALE)$/.test(String(p.gender || ""));
  function sceneLink(props) {
    try {
      const l = props.queue?.makeLink?.(props.scene.id, { sceneIndex: props.index, continue: false });
      if (l) return l;
    } catch {}
    return "/scenes/" + props.scene.id;
  }

  // 表紙：マウスを乗せて少し待つとプレビュー動画。横型で「表側だけ」の時は、パッケージ画像（横長 約1.5:1）なら右側（表）だけを見せる
  function Cover({ scene, link, s, side, selecting, onToggle, preview, onEnter, onLeave, sprite, pos, scrub, source, onMissing, onEmpty, rate, rateCorner }) {
    const [wide, setWide] = React.useState(null),
      f = scene.files?.[0],
      show = s.show;
    const onLoad = (e) => {
      const r = e.currentTarget.naturalWidth / (e.currentTarget.naturalHeight || 1);
      setWide(r >= 1.38 && r <= 1.62); // DMM 等のパッケージ画像（表＋裏）
    };
    const progress = show.progress && scene.resume_time > 0 && f?.duration > 0 ? Math.min(100, (scene.resume_time / f.duration) * 100) : 0;
    // 読み込み前は表側の形で待つ（ほとんどがパッケージ画像なので、読み込み後に形が跳ねない）
    const cls = "lc-cover thumbnail-section" + (side && s.sideCover === "front" && wide !== false ? " lc-front" : "") + (wide ? " lc-pack" : "");
    return h(
      "div",
      { className: cls, onMouseEnter: onEnter, onMouseLeave: onLeave },
      h(
        Link,
        {
          to: link,
          className: "scene-card-link",
          onClick: (e) => {
            if (selecting) {
              e.preventDefault();
              onToggle(e.shiftKey);
            }
          },
        },
        h("img", { className: "scene-card-preview-image", src: scene.paths?.screenshot, alt: "", loading: "lazy", decoding: "async", onLoad }),
        preview && !sprite && h(Preview, { scene, onMissing, scrub, source, auto: s.autoTour, delay: s.autoTourDelay }),
        preview && sprite && h(SpriteScrub, { scene, pos, onEmpty }),
      ),
      show.code && scene.code && !rateCorner && h(CodeBadge, { code: scene.code }), // 縦型はスタジオの行の右端に出す
      show.duration && f?.duration > 0 && h("span", { className: "lc-duration" }, clock(f.duration)),
      progress > 0 && h("div", { className: "lc-progress", title: "続き " + clock(scene.resume_time) }, h("div", { style: { width: progress + "%" } })),
      // 表紙だけの形：下の欄が無いので、表紙にマウスを乗せると上に★を出して、その場で評価できる
      // 縦型は表紙の左下に常に出す（下の欄はタグの段に使う）
      rate && h("div", { className: "lc-cover-rate" + (rateCorner ? " corner" : "") }, h(RateStars, { scene })),
      // スタジオをまとめた1枚（まとめ:代表）：左上に「まとめ N本」。押すとそのスタジオの作品を全部並べる
      scene.tags?.some((t) => t.name === "まとめ:代表") &&
        h(BundleBadge, { group: scene.tags.find((t) => /^まとめ:/.test(t.name) && !/^まとめ:(?:代表|中身)$/.test(t.name)), studio: scene.studio }),
      // 表紙の右上：スクレイプ（縦型・表紙だけ。横型はカード全体の右上に配置）
      !side && h(ScrapeBtn, { scene }),
    );
  }

  function ScrapeBtn({ scene }) {
    if (!window.StashMiniPlayer?.scrape) return null;
    return h(
      "button",
      {
        type: "button",
        className: "lc-scrape",
        title: "この作品をスクレイプ（ミニプレイヤーのスクレイプ画面を開く）",
        onClick: (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.StashMiniPlayer.scrape(scene.id, scene.code || "");
        },
      },
      h(
        "svg",
        { viewBox: "0 0 24 24", width: 15, height: 15, "aria-hidden": "true", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" },
        h("path", { d: "M4 20 15 9M14 4v3M18 6l-2 2M20 10h-3M9 4l1 2M20 15l-2-1" }),
      ),
    );
  }

  // 情報がまだ無い作品（スタジオ・出演者・タグのどれも無い）：空いた所に「Google で探す」を出し、新しいタブで検索する
  // 検索する語は品番（無ければファイル名から推測した品番、それも無ければファイル名）
  function EmptyHint({ scene, f }) {
    if (scene.studio || scene.performers?.length || scene.tags?.some((t) => !LC.isHousekeeping(t))) return null;
    const name = fileName(f?.path);
    // 「ABC-123」の形（ハイフンあり）を先に探す。整備ハブの guessCode は先頭の [..] をサイト名として外すので、
    // 「[HFD-03] … Nose Hook 360」で HFD-03 を落として HOOK-360 を拾ってしまう
    const strict = (t) => String(t || "").match(/(?:^|[^a-z0-9])(\d{0,3}[a-z]{2,6}-\d{2,5})(?![0-9])/i)?.[1].toUpperCase();
    const code = scene.code || strict(scene.title) || strict(name) || window.LibraryHub?.guessCode?.(name)?.code || "";
    const q = code || name || scene.title || "";
    return h(
      "div",
      { className: "lc-empty" },
      h("span", null, "情報なし"),
      q &&
        h(
          "a",
          {
            href: "https://www.google.com/search?q=" + encodeURIComponent(q),
            target: "_blank",
            rel: "noopener noreferrer",
            title: "「" + q + "」を Google で検索（新しいタブ）",
            onClick: (e) => e.stopPropagation(),
          },
          (code ? code : "Google") + " で探す",
        ),
    );
  }

  function Performers({ scene, s }) {
    if (!s.show.performers) return null;
    const list = (scene.performers || []).filter((p) => s.show.male || !isMale(p));
    if (!list.length) return null;
    // 女性を先に（Card Rarity の出演者の色分けと「+N」のまとめはこのリストに効く）
    list.sort((a, b) => isMale(a) - isMale(b));
    return h(
      "div",
      { className: "lc-performers vsc-performers-list" },
      // クリックで出演者のカード（もう一度で閉じる。カードの「絞り込む →」でこの人に絞り込んだ一覧へ）
      list.map((p) =>
        h(
          Link,
          {
            key: p.id,
            to: LC.listTo ? LC.listTo("performer", p) : "/performers/" + p.id,
            className: "vsc-performer",
            "data-performer-id": p.id, // リンク先は絞り込みの URL なので、Card Rarity が誰を表示済みか分かるように
            title: p.name + "（クリックで出演者のカード・もう一度で閉じる）",
            onClick: (e) => LC.performerClick?.(e, p),
          },
          h("span", null, p.name),
        ),
      ),
    );
  }

  // 見た目はここから入れる（プラグインの CSS がブラウザに古いまま残っていても出るように）
  const rateStyle = document.createElement("style");
  rateStyle.textContent = `
.lc-rate { cursor: pointer; }
.lc-rate.open { gap: 0; }
.lc-rate-star { padding: 0 1px; color: #5a6878; font-size: 15px; line-height: 1; transition: color 0.08s, transform 0.08s; }
.lc-rate-star.on { color: #ffc94d; }
.lc-rate-star:hover { transform: scale(1.2); }
.lc-cover-rate { position: absolute; z-index: 6; top: 6px; left: 50%; transform: translateX(-50%); padding: 2px 8px; border-radius: 10px; background: #000000b8; color: #e8eef5; font-size: 12px; opacity: 0; transition: opacity 0.12s; }
.lc-card:hover .lc-cover-rate { opacity: 1; }
/* 縦型：外枠は左下の透明な当たり判定（表紙全体に乗せただけでは出さない）。中の黒い札だけ見せる */
.lc-cover-rate.corner { top: auto; bottom: 0; left: 0; transform: none; padding: 6px; min-width: 120px; min-height: 34px; display: flex; align-items: flex-end; line-height: 1; background: none; border-radius: 0; opacity: 1; }
.lc-cover-rate.corner .lc-rate { padding: 2px 6px !important; border-radius: 10px; background: #0000008c !important; opacity: 0; transition: opacity 0.12s; }
.lc-cover-rate.corner:hover .lc-rate, .lc-cover-rate.corner .lc-rate.rated { opacity: 1; }
.lc-cover-rate.corner .lc-rate-star:hover { transform: none; } /* 拡大しない（ぶれの元） */
.lc-cover-rate .lc-rate { margin: 0; padding: 0; min-height: 0; gap: 0; background: none !important; } /* 表紙の上では枠を重ねない（ずれの元） */
.lc-meta .lc-mstat { display: inline-flex; align-items: center; gap: 3px; }
.lc-meta .lc-mstat svg { width: 11px; height: 11px; opacity: .8; }
/* 右上の「あとで見る」の左に並べる */
.lc-scrape { position: absolute; z-index: 7; top: 6px; right: 44px; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 6px; background: #000000a6; color: #e8eef5; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0; transition: opacity 0.12s, background 0.12s; }
.lc-card:hover .lc-scrape { opacity: 1; }
.lc-scrape:hover { background: #3a6ea5; }
/* 表紙の直下の a は全面に広げる決まり（.lc-cover > a）があるので、大きさを打ち消す */
.lc-cover > a.lc-bundle { display: inline-block; width: auto; height: auto; }
.lc-bundle { position: absolute; z-index: 7; top: 6px; left: 6px; padding: 2px 8px; border-radius: 4px; background: #3a6ea5e6; color: #fff !important; font: 600 12px/1.5 system-ui, sans-serif; text-decoration: none !important; }
.lc-bundle:hover { background: #4f88c6; }
.lc-studio-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.lc-studio-row .lc-studio { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lc-code.inline { position: static; flex: none; margin-left: auto; background: #ffffff14; color: #cfd8e3; font-size: 11px; line-height: 1.5; }
.lc-rate-done { color: #ffc94d; font-size: 16px; line-height: 1; }
.lc-rate-done > span { display: inline-block; padding: 0 1px; }
.lc-cover-rate .lc-rate-star { display: inline-block; font-size: 16px; line-height: 1; padding: 0 1px; } /* 評価済みの★と同じ大きさ（マウスを乗せても伸び縮みしない） */
.lc-empty { display: flex; align-items: center; gap: 8px; margin-top: 4px; padding: 5px 8px; border: 1px dashed #ffffff1f; border-radius: 6px; color: var(--lc-muted); font-size: 12px; }
.lc-empty > span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lc-empty > a { flex: none; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 2px 10px; border: 1px solid var(--suite-accent, #3a6ea5); border-radius: 999px; background: none; color: var(--suite-link, #7fd4ff); font-size: 12px; cursor: pointer; transition: background 0.12s, color 0.12s; }
.lc-empty > a:hover { background: var(--suite-accent, #3a6ea5); color: #fff; }
.lc-tagrow { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; white-space: nowrap; cursor: grab; margin-top: 4px; }
.lc-tagrow::-webkit-scrollbar { display: none; }
.lc-tagrow .lc-tagchip { flex: none; }
/* 表紙だけ：プレビューはカードの外に浮かぶので、「あとで見る」を隠さない */
.lc-card.lc-coveronly.lc-previewing .sp22-card-watch { opacity: 1 !important; pointer-events: auto !important; }
`;
  document.head.append(rateStyle);
  // カードの評価：ふだんは「★ 4」、マウスを乗せると★が 5 つ並び、押した★の数でその場で評価する（同じ★をもう一度押すと評価を消す）
  function RateStars({ scene }) {
    const [r100, setR100] = React.useState(scene.rating100 ?? null),
      [open, setOpen] = React.useState(false),
      [hover, setHover] = React.useState(0),
      [busy, setBusy] = React.useState(false);
    React.useEffect(() => setR100(scene.rating100 ?? null), [scene.rating100]);
    const v = r100 == null ? 0 : Math.round((r100 / 20) * 10) / 10;
    const rate = async (e, n) => {
      e.preventDefault();
      e.stopPropagation();
      if (busy) return;
      const next = Math.round(v) === n ? null : n * 20;
      setBusy(true);
      try {
        const j = await LC.gql("mutation($i:SceneUpdateInput!){sceneUpdate(input:$i){id rating100}}", { i: { id: scene.id, rating100: next } });
        if (j.errors) throw new Error(j.errors[0].message);
        setR100(next);
        scene.rating100 = next; // カードの光の段階（data-scr-tier）も描き直しで新しい評価になるように
        const card = e.target.closest?.(".lc-card");
        if (card && LC.rarityOn()) card.dataset.scrTier = String(LC.rarityTier(next));
      } catch (err) {
        console.warn("[Light Scene Cards] 評価できませんでした", err);
      } finally {
        setBusy(false);
      }
    };
    return h(
      "span",
      {
        className: "lc-stat vsc-rating lc-rate" + (v ? " rated" : "") + (open ? " open" : ""),
        onMouseEnter: () => setOpen(true),
        onMouseLeave: () => (setOpen(false), setHover(0)),
        title: open ? "押した★の数で評価（同じ★をもう一度押すと評価を消す）" : "マウスを乗せて評価",
      },
      // 未評価は「★ 0」ではなく、薄い★を5つ（そのまま押して評価できる）
      open || !v
        ? [1, 2, 3, 4, 5].map((n) =>
            h(
              "span",
              {
                key: n,
                className: "lc-rate-star" + (n <= (hover || Math.round(v)) ? " on" : ""),
                onMouseEnter: () => setHover(n),
                onClick: (e) => rate(e, n),
              },
              "★",
            ),
          )
        : v
          ? h("span", { className: "lc-rate-done", title: "評価 " + v + "（マウスを乗せて変更）" }, Array.from({ length: Math.max(1, Math.round(v)) }, (_, i) => h("span", { key: i }, "★"))) // 評価済みは黄色の★を数だけ
          : [h(Icon, { key: "i", icon: FA.faStar }), h("span", { key: "v" }, "0")],
    );
  }

  // レアリティ（Scene Card Rarity）：評価の段階 1〜5（未評価は 0）。設定でシーンカードの演出が切られていれば付けない
  LC.rarityTier = (v) => (Number.isFinite(v) && v >= 1 && v <= 100 ? Math.max(1, Math.min(5, Math.round(v / 20))) : 0);
  LC.rarityOn = () => {
    try {
      return JSON.parse(localStorage.getItem("stash.cardRarity.v1") || "{}").sceneEnabled !== false;
    } catch {
      return true;
    }
  };
  // 整理用の印（親タグ「整理用」の下：整理:○○・分割:○○・男系）はカードのタグの段に出さない（作品のページには出る）
  LC.isHousekeeping = (t) => /^(?:整理:|分割:|まとめ:)/.test(t.name || "") || t.name === "男系（男モード）";
  const bundleCounts = new Map();
  // group：タグでまとめた組（まとめ:グループ名 など）。無ければスタジオでまとめた物
  function BundleBadge({ group, studio }) {
    const key = group ? "t" + group.id : "s" + studio?.id;
    const [n, setN] = React.useState(bundleCounts.get(key) || 0);
    React.useEffect(() => {
      if (bundleCounts.has(key) || (!group && !studio)) return;
      const qy = group ? ["query($id:ID!){findTag(id:$id){scene_count}}", "findTag"] : ["query($id:ID!){findStudio(id:$id){scene_count}}", "findStudio"];
      LC.gql(qy[0], { id: group ? group.id : studio.id }).then((j) => {
        const c = j?.data?.[qy[1]]?.scene_count || 0;
        bundleCounts.set(key, c);
        setN(c);
      });
    }, [key]);
    if (!group && !studio) return null;
    return h(
      Link,
      {
        className: "lc-bundle",
        to: group ? (LC.listTo ? LC.listTo("tag", group) : "/tags/" + group.id) : LC.listTo ? LC.listTo("studio", studio) : "/studios/" + studio.id,
        title: (group ? group.name.replace(/^まとめ:/, "") : studio.name) + " の作品を全部並べる",
        onClick: (e) => e.stopPropagation(),
      },
      "まとめ " + (n ? n + "本" : "") + " ›",
    );
  }
  function TagRow({ tags }) {
    const ref = React.useRef(null);
    React.useEffect(() => {
      const ds = window.Suite?.dragScroll,
        el = ref.current;
      if (ds && el && !el.dataset.drag) {
        el.dataset.drag = "1";
        ds(el, el, { axis: "x" });
      }
    }, []);
    // 好みの重み（おすすめ順のタグ設定）が重い順。設定の無いタグは 0、必須は先頭、除外は最後
    const w = (t) => {
      const r = window.StashTagWeightedRecommendations?.tagWeight?.(t.id);
      return !r ? 0 : r.mode === "excluded" ? -99 : r.mode === "required" ? 99 : Number(r.weight) || 0;
    };
    const sorted = tags.filter((t) => !LC.isHousekeeping(t)).sort((a, b) => w(b) - w(a));
    return h(
      "div",
      { className: "lc-tagrow", ref },
      sorted.map((t) =>
        h(
          Link,
          {
            key: t.id,
            to: LC.listTo ? LC.listTo("tag", t) : "/tags/" + t.id,
            className: "lc-tagchip",
            title: t.name + "（クリックで好みを評価・もう一度で閉じる。評価の ↗ でこのタグに絞り込む）",
            onClick: (e) => LC.tagClick?.(e, t),
          },
          t.name.replace(/^#/, ""),
        ),
      ),
    );
  }
  // 再生回数・O回数・整理済み・別ファイル数（縦型は日付などの行に入れる。下に段を足すとカードが縦に伸び、行ごと間延びするため）
  function Stats({ scene, s }) {
    const show = s.show,
      out = [];
    if (show.playCount && scene.play_count) out.push(h("span", { key: "p", className: "lc-mstat", title: "再生回数" }, h(Icon, { icon: FA.faEye }), scene.play_count));
    if (show.oCount && scene.o_counter) out.push(h("span", { key: "o", className: "lc-mstat", title: "O回数" }, h("svg", { viewBox: "0 0 24 24", width: 11, height: 11, fill: "currentColor", "aria-hidden": "true" }, h("path", { d: "M12 2.8c-.3 0-.6.1-.8.4C9.4 5.6 5.5 10.6 5.5 14.6a6.5 6.5 0 0 0 13 0c0-4-3.9-9-5.7-11.4-.2-.3-.5-.4-.8-.4z" })), scene.o_counter));
    if (show.organized && scene.organized) out.push(h("span", { key: "g", className: "lc-mstat", title: "整理済み" }, h(Icon, { icon: FA.faBox })));
    if (show.copies && scene.files?.length > 1)
      out.push(h("span", { key: "c", className: "lc-mstat", title: "同じ作品のファイルが " + scene.files.length + " 個" }, h(Icon, { icon: FA.faCopy }), scene.files.length));
    return out;
  }
  function Footer({ scene, s, noRate }) {
    const show = s.show,
      parts = [];
    if (show.rating && !noRate) parts.push(h(RateStars, { key: "r", scene }));
    if (show.playCount && scene.play_count) parts.push(h("span", { key: "p", className: "lc-stat", title: "再生回数" }, h(Icon, { icon: FA.faEye }), scene.play_count));
    if (show.oCount && scene.o_counter) parts.push(h("span", { key: "o", className: "lc-stat", title: "O回数" }, h("svg", { viewBox: "0 0 24 24", width: 11, height: 11, fill: "currentColor", "aria-hidden": "true" }, h("path", { d: "M12 2.8c-.3 0-.6.1-.8.4C9.4 5.6 5.5 10.6 5.5 14.6a6.5 6.5 0 0 0 13 0c0-4-3.9-9-5.7-11.4-.2-.3-.5-.4-.8-.4z" })), scene.o_counter));
    if (show.organized && scene.organized) parts.push(h("span", { key: "g", className: "lc-stat", title: "整理済み" }, h(Icon, { icon: FA.faBox })));
    const right = [];
    if (show.copies && scene.files?.length > 1)
      right.push(h("span", { key: "c", className: "lc-stat", title: "同じ作品のファイルが " + scene.files.length + " 個" }, h(Icon, { icon: FA.faCopy }), scene.files.length));
    // 縦型は下の段にタグを並べるので、タグ数のボタンは出さない
    if (show.tags && !noRate && scene.tags?.length)
      right.push(
        h(
          "button",
          {
            key: "t",
            type: "button",
            className: "lc-stat lc-tags",
            title: "タグを表示",
            onClick: (e) => {
              e.preventDefault();
              LC.showTags?.(e.currentTarget, scene.tags);
            },
          },
          h(Icon, { icon: FA.faTag }),
          scene.tags.length,
        ),
      );
    if (!parts.length && !right.length) return null;
    return h("div", { className: "lc-footer" }, parts, h("span", { className: "lc-gap" }), right);
  }

  function LightCard(props) {
    const s = useSettings(),
      root = React.useRef(null),
      rowW = useRowWidth(root, !!props.width), // 一覧（幅の指定あり）のときだけ行の幅を見る
      { scene, selecting, selected, onSelectedChanged } = props,
      f = scene.files?.[0],
      link = sceneLink(props),
      // 幅の指定が無いのはトップページの横スクロール（カルーセル）。そこは常に縦型
      side = s.layout === "side" && !!props.width,
      coverOnly = s.layout === "cover" && !!props.width, // 表紙だけ（情報はマウスを乗せた時に重ねて出す）
      toggle = (shift) => onSelectedChanged?.(!selected, shift);
    const meta = [
      s.show.date && scene.date,
      s.show.size && gb(f?.size),
      s.show.resolution && resolution(f),
      !s.show.duration && clock(f?.duration),
    ].filter(Boolean);
    // カルーセルは中身の幅で並べるので、Stash の拡大段階ごとの幅（240/320/480/640）を使う
    const width = props.width
      ? fitWidth(LC.sizeOf(s, side ? "side" : coverOnly ? "cover" : "tall"), rowW)
      : [240, 320, 480, 640][props.zoomIndex ?? 1] || 320;
    // プレビュー：表紙にマウスを乗せて少し待つと始まり、表紙から離れたら止まる（どの形でも同じ）。
    // 見せる場所：縦型は表紙の枠／横型はカード全体（ほぼ16:9）／表紙だけはカードの上に浮かぶ16:9の窓
    const [preview, setPreview] = React.useState(false),
      [sprite, setSprite] = React.useState(false), // 動画が無く、場面画像で送る
      [pos, setPos] = React.useState(0.5),
      [float, setFloat] = React.useState(null), // 表紙だけ：浮かぶ窓の位置
      timer = React.useRef(0);
    React.useEffect(() => () => clearTimeout(timer.current), []);
    React.useEffect(() => {
      if (side) scheduleChipFit(); // まとめて1回だけ測る（requestAnimationFrame で束ねる）
    }, [side, width]);
    React.useEffect(() => {
      if (!preview || !coverOnly) return setFloat(null);
      // カードに重ならない所に出す（カードの上に出るタイトル・出演者を隠さない）：上 → 下 → 右 → 左。どこにも入らなければ上に重ねる
      const r = root.current.getBoundingClientRect(),
        w = Math.min(Math.max(r.width * 2.2, 360), 560),
        hh = (w * 9) / 16,
        G = 8,
        cx = Math.max(G, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - G)),
        cy = Math.max(G, Math.min(r.top + r.height / 2 - hh / 2, innerHeight - hh - G)),
        nav = document.querySelector(".navbar")?.getBoundingClientRect().bottom || 0;
      const spots = [
        r.top - hh - G >= nav + G && { left: cx, top: r.top - hh - G },
        r.bottom + hh + G <= innerHeight - G && { left: cx, top: r.bottom + G },
        r.right + w + G <= innerWidth - G && { left: r.right + G, top: cy },
        r.left - w - G >= G && { left: r.left - w - G, top: cy },
      ].filter(Boolean);
      setFloat({ ...(spots[0] || { left: cx, top: Math.max(nav + G, r.top) }), width: w, height: hh });
      const off = () => stopPreview();
      addEventListener("scroll", off, true);
      return () => removeEventListener("scroll", off, true);
    }, [preview, coverOnly]);
    // 設定「マウスの左右で場面送り」：場面画像（スプライト）があればそれで、無ければプレビュー動画を止めて位置を動かす
    // 設定「元の動画で場面送り」：場面画像・プレビュー動画を使わず、元の動画の位置を動かす（試し用）
    const sourceMode = s.previewMode === "source",
      scrubMode = s.previewMode === "scrub" || sourceMode;
    const missing = React.useRef({ v: false, s: false }); // 読み込めなかった物（v＝プレビュー動画、s＝場面画像）
    const startPreview = () => {
      if (!s.preview || !scene.paths?.preview) return;
      missing.current = { v: false, s: false };
      setSprite(s.previewMode === "scrub" && !!scene.paths?.vtt);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setPreview(true), 250);
    };
    const stopPreview = () => {
      clearTimeout(timer.current);
      setPreview(false);
    };
    // 場面送りの位置：マウスの左右の位置。横型はプレビューがカード全体に重なるのでカード全体、ほかは表紙の上
    const onMove = (e) => {
      if (!(sprite || scrubMode) || !preview) return;
      const r = (side ? e.currentTarget : e.currentTarget.querySelector(".lc-cover")).getBoundingClientRect(),
        p = Math.max(0, Math.min(0.999, (e.clientX - r.left) / r.width));
      if (Math.abs(p - pos) > 0.004) setPos(p);
    };
    // プレビュー動画が無い時は場面画像へ、場面画像が無い時はプレビュー動画へ。両方とも無ければプレビューをやめる
    const onMissing = () => {
      missing.current.v = true;
      if (!missing.current.s && scene.paths?.vtt) setSprite(true);
      else stopPreview();
    };
    const onSpriteEmpty = () => {
      missing.current.s = true;
      if (!missing.current.v) setSprite(false);
      else stopPreview();
    };
    const scrub = scrubMode && !sprite ? pos : undefined;
    return h(
      "div",
      {
        ref: root,
        className:
          "lc-card scene-card " + (side ? "lc-side" : coverOnly ? "lc-tall lc-coveronly" : "lc-tall") + (selected ? " lc-selected" : "") + (preview ? " lc-previewing" : "") +
          (LC.rarityOn() ? " scr-scene-enabled" : ""),
        // レアリティの光（Scene Card Rarity の見た目）：段階はカード自身が持つ（描き直しても光が消えない）
        "data-scr-tier": LC.rarityOn() ? String(LC.rarityTier(scene.rating100)) : undefined,
        style: { width, "--lc-title-lines": s.titleLines },
        onMouseMove: (sprite || scrubMode) && preview ? onMove : undefined,
        // 横型（プレビューがカード全体に重なる）・表紙だけ（マウスを乗せると下に題名などの欄が出る）は、カードから出たら止める
        onMouseLeave: side || coverOnly ? stopPreview : undefined,
      },
      // Liquid Glass：表紙を大きくぼかしてカードの地に透かす（::before/::after は Card Rarity が使うので専用の要素）
      scene.paths?.screenshot && h("div", { className: "lc-ambient", "aria-hidden": "true", style: { backgroundImage: "url(" + JSON.stringify(scene.paths.screenshot) + ")" } }),
      side && preview && !sprite && h(Preview, { scene, card: true, onMissing, scrub, source: sourceMode, auto: s.autoTour, delay: s.autoTourDelay }),
      side && preview && sprite && h(SpriteScrub, { scene, pos, card: true, onEmpty: onSpriteEmpty }),
      float &&
        PluginApi.ReactDOM.createPortal(
          h("div", { className: "lc-float", style: float }, sprite ? h(SpriteScrub, { scene, pos, card: true, onEmpty: onSpriteEmpty }) : h(Preview, { scene, card: true, onMissing, scrub, source: sourceMode, auto: s.autoTour, delay: s.autoTourDelay })),
          document.body,
        ),
      h(
        "div",
        { className: "card-controls lc-check" + (selecting ? " on" : "") },
        h("input", {
          type: "checkbox",
          className: "card-check",
          checked: !!selected,
          title: "選択",
          onChange: () => {},
          onClick: (e) => {
            e.stopPropagation();
            toggle(e.shiftKey);
          },
        }),
      ),
      side && h(ScrapeBtn, { scene }),
      h(Cover, {
        scene,
        link,
        s,
        side,
        selecting,
        onToggle: toggle,
        preview: !side && !coverOnly && preview,
        onEnter: startPreview,
        onLeave: side || coverOnly ? undefined : stopPreview,
        sprite,
        pos,
        scrub,
        source: sourceMode,
        onMissing,
        onEmpty: onSpriteEmpty,
        rate: (coverOnly || !side) && s.show.rating,
        rateCorner: !side && !coverOnly,
      }),
      h(
        "div",
        { className: "lc-info" },
        // 横型はスタジオと発売日などを1行にまとめ、空いた所にタグを並べる（情報の欄の空きを減らす）
        side
          ? h(
              "div",
              { className: "lc-head" },
              // 大事な順に並べ、入らない物は折り返して隠れる（…で切らない）：スタジオ ＞ 発売日 ＞ 容量・画質
              s.show.studio && scene.studio && h(Link, { className: "lc-studio", to: LC.listTo ? LC.listTo("studio", scene.studio) : "/studios/" + scene.studio.id, title: scene.studio.name + "（クリックでこのスタジオに絞り込む）" }, scene.studio.name),
              s.show.date && scene.date && h("span", { className: "lc-head-date" }, scene.date),
              meta.filter((m) => m !== scene.date).map((m, i) => h("span", { key: i, className: "lc-head-spec" }, m)),
            )
          : !coverOnly
            ? // 縦型：スタジオと、右端に品番（クリックでコピー）
              ((s.show.studio && scene.studio) || (s.show.code && scene.code)) &&
              h(
                "div",
                { className: "lc-studio-row" },
                s.show.studio && scene.studio
                  ? h(Link, { className: "lc-studio", to: LC.listTo ? LC.listTo("studio", scene.studio) : "/studios/" + scene.studio.id, title: scene.studio.name + "（クリックでこのスタジオに絞り込む）" }, scene.studio.name)
                  : h("span", { className: "lc-studio" }),
                s.show.code && scene.code && h(CodeBadge, { code: scene.code, inline: true }),
              )
            : s.show.studio && scene.studio && h(Link, { className: "lc-studio", to: LC.listTo ? LC.listTo("studio", scene.studio) : "/studios/" + scene.studio.id, title: scene.studio.name + "（クリックでこのスタジオに絞り込む）" }, scene.studio.name),
        h(Link, { className: "lc-title", to: link, title: scene.title || fileName(f?.path) }, scene.title || fileName(f?.path)),
        !side && (meta.length > 0 || Stats({ scene, s }).length > 0) && h("div", { className: "lc-meta" }, meta.map((m, i) => h("span", { key: i }, m)), Stats({ scene, s })),
        h(Performers, { scene, s }),
        !coverOnly && h(EmptyHint, { scene, f }),
        side &&
          s.show.tagChips &&
          scene.tags?.length > 0 &&
          // 外枠が空いた高さいっぱいに広がり、中は「丸ごと入る行数」の高さで切る（行の途中で切れない。残りは下の段のタグ数ボタンから）
          h(
            "div",
            { className: "lc-tagwrap" },
            h(
              "div",
              { className: "lc-tagchips" },
              scene.tags.filter((t) => !LC.isHousekeeping(t)).map((t) =>
                h(
                  Link,
                  {
                    key: t.id,
                    to: LC.listTo ? LC.listTo("tag", t) : "/tags/" + t.id,
                    className: "lc-tagchip",
                    title: t.name + "（クリックで好みを評価・もう一度で閉じる。評価の ↗ でこのタグに絞り込む）",
                    onClick: (e) => LC.tagClick?.(e, t),
                  },
                  t.name.replace(/^#/, ""), // 前に「#」を付けて出すので、名前の「#」は重ねない
                ),
              ),
            ),
          ),
        // 縦型：下の欄にタグを1行で並べる。つかんで横にドラッグ（離すと滑る。ミニプレイヤーと同じ）
        !side && s.show.tagChips && scene.tags?.length > 0 && h(TagRow, { tags: scene.tags }),
        side && h(Footer, { scene, s, noRate: false }),
      ),
    );
  }
  LC.LightCard = LightCard;

  // ランダム・おすすめ順で並べている間は ★1 の動画を出さない（Stash の URL の絞り込みでは「★1以外か未評価」が書けないので、描かないことで外す）
  const hideLowRated = (scene) =>
    scene.rating100 != null && scene.rating100 <= 20 && /^(random|twr_recommend)/.test(new URLSearchParams(location.search).get("sortby") || "");

  PluginApi.patch.instead("SceneCard", function (props, ctx, Original) {
    if (props?.scene && hideLowRated(props.scene)) return null;
    if (LC.store.get().mode !== "own" || !props?.scene) return h(Original, props);
    return h(LightCard, props);
  });
})();

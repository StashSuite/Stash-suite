/*
 * Sharp Covers — シーンカードのカバー画像を高品質に縮小し直す
 *
 * 大きなカバー（例 2184×1468）をカード（例 274×154）へブラウザ任せで縮小すると、Chrome は処理を簡略化するため
 * 細い線や文字がギザギザになる。画面に入ったカードだけ、表示サイズ（×画面の拡大率）ちょうどに
 * createImageBitmap の高品質縮小で作り直し、軽くシャープをかけて差し替える。
 * ・作った画像は IndexedDB に保存し、次に表示する時は描画される前に差し替える（読み込み直後の切り替わりを見せない）。
 * ・元の画像ファイルは変更しない。
 * ・Stash の CSP は img-src に blob: を許可していないので、data: URL で差し替える。
 * ・元のURLは data-src に残す（ミニプレイヤーが画像からシーンIDを読むため）。
 * ・カードの大きさが変わったら作り直す。
 * ・読み込み・縮小・シャープ・JPEG 変換は Web Worker（lib/resizeWorker.js）で行い、スクロールを止めない。
 *   Worker が使えない環境では何もしない（元の画像のまま）。
 */
(() => {
  "use strict";
  if (window.__sharpCovers) return;
  window.__sharpCovers = true;
  if (typeof createImageBitmap !== "function") return;

  const SELECTOR = "img.scene-card-preview-image",
    REDO_RATIO = 1.15, // カードの大きさがこれ以上変わったら作り直す（縮小の設定は lib/resizeWorker.js）
    WORKERS = 2,
    CONCURRENCY = 4,
    MEMORY_MAX = 600,
    STORE_MAX = 800, // IndexedDB に残す枚数（1枚あたり約30KB → 最大約25MB）
    DB_NAME = "sharpCovers",
    DB_STORE = "covers";

  const cache = new Map(), // キー → data URL（"元URL|表示幅px"）
    made = new WeakMap(), // img → 差し替えた data URL
    pending = new Set(),
    queue = [];
  let running = 0;

  const replaced = (img) => !!made.get(img) && img.getAttribute("src") === made.get(img);
  function original(img) {
    return replaced(img) ? img.dataset.src || "" : img.getAttribute("src") || "";
  }
  function boxWidth(img) {
    const w = img.getBoundingClientRect().width * (window.devicePixelRatio || 1);
    return w >= 8 ? Math.round(w) : 0;
  }
  const keyOf = (src, box) => src + "|" + box;
  function remember(key, url) {
    cache.delete(key);
    cache.set(key, url);
    if (cache.size > MEMORY_MAX) cache.delete(cache.keys().next().value);
  }

  // ---- IndexedDB（失敗しても動作は続ける） ----
  let db = null;
  const dbReady = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
      req.onsuccess = () => resolve((db = req.result));
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  async function loadStore() {
    if (!(await dbReady)) return;
    await new Promise((resolve) => {
      const rows = [];
      const req = db.transaction(DB_STORE).objectStore(DB_STORE).openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (c) {
          rows.push([c.key, c.value]);
          c.continue();
          return;
        }
        rows.sort((a, b) => a[1].at - b[1].at);
        const extra = rows.length - STORE_MAX;
        if (extra > 0) {
          const st = db.transaction(DB_STORE, "readwrite").objectStore(DB_STORE);
          for (const [k] of rows.slice(0, extra)) st.delete(k);
        }
        for (const [k, v] of rows.slice(Math.max(0, extra)).slice(-MEMORY_MAX)) cache.set(k, v.url);
        resolve();
      };
      req.onerror = () => resolve();
    });
  }
  function save(key, url) {
    if (!db) return;
    try {
      db.transaction(DB_STORE, "readwrite").objectStore(DB_STORE).put({ url, at: Date.now() }, key);
    } catch {}
  }

  // ---- 作り直し（Worker に任せる） ----
  const WORKER_URL = "/plugin/stashSuite/assets/sharpCovers/lib/resizeWorker.js";
  let workers = [],
    turn = 0,
    seq = 0;
  const waits = new Map();
  // Stash の CSP は worker-src blob: だけを許可しているので、スクリプトを読んで blob: URL から作る
  const workersReady = (async () => {
    const code = await (await fetch(WORKER_URL)).text();
    const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    for (let i = 0; i < WORKERS; i++) {
      const w = new Worker(url, { name: "sharpCovers-" + i });
      w.onmessage = ({ data }) => {
        const p = waits.get(data.id);
        waits.delete(data.id);
        if (p) data.error ? p.reject(new Error(data.error)) : p.resolve(data);
      };
      w.onerror = (e) => {
        console.debug("[Sharp Covers] Worker を使えないため停止します", e.message);
        workers = [];
        for (const p of waits.values()) p.reject(new Error("worker"));
        waits.clear();
      };
      workers.push(w);
    }
  })().catch((e) => {
    console.debug("[Sharp Covers] Worker を作れないため停止します", e);
    workers = [];
  });
  async function resizeInWorker(src, width, height) {
    await workersReady;
    if (!workers.length) throw new Error("worker");
    return new Promise((resolve, reject) => {
      const id = ++seq;
      waits.set(id, { resolve, reject });
      workers[turn++ % workers.length].postMessage({ id, src: new URL(src, location.href).href, width, height });
    });
  }
  function apply(img, src, box, url) {
    img.dataset.src = src;
    img.dataset.scBox = String(box);
    made.set(img, url);
    img.src = url;
  }
  async function processImage(img) {
    const src = original(img);
    if (!src || src.startsWith("data:")) return;
    const box = boxWidth(img);
    if (!box) return;
    if (replaced(img) && Math.abs(Number(img.dataset.scBox || 0) / box - 1) < REDO_RATIO - 1) return;
    const key = keyOf(src, box);
    let url = cache.get(key);
    if (!url) {
      const r = img.getBoundingClientRect(),
        dpr = window.devicePixelRatio || 1;
      const out = await resizeInWorker(src, Math.round(r.width * dpr), Math.round(r.height * dpr));
      if (!img.isConnected || original(img) !== src) return;
      if (out.keep) {
        // 縮小がゆるい画像は元のまま（作り直し済みなら元に戻す）
        if (replaced(img)) img.src = src;
        return;
      }
      url = out.url;
      remember(key, url);
      save(key, url);
    }
    if (!img.isConnected || original(img) !== src) return;
    apply(img, src, box, url);
  }
  function pump() {
    while (running < CONCURRENCY && queue.length) {
      const img = queue.shift();
      running++;
      processImage(img)
        .catch((e) => console.debug("[Sharp Covers]", e))
        .finally(() => {
          pending.delete(img);
          running--;
          pump();
        });
    }
  }
  function enqueue(img) {
    if (pending.has(img)) return;
    pending.add(img);
    queue.push(img);
    pump();
  }
  // 作り直し済みならその場で差し替える（MutationObserver から呼ぶので描画前に間に合う）
  function applyCached(img) {
    const src = original(img);
    if (!src || replaced(img)) return false;
    const box = boxWidth(img),
      url = box && cache.get(keyOf(src, box));
    if (!url) return false;
    apply(img, src, box, url);
    return true;
  }

  const visible = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) enqueue(e.target);
    },
    { rootMargin: "600px 0px" },
  );
  const resized = new ResizeObserver((entries) => {
    for (const e of entries) {
      const img = e.target,
        box = Number(img.dataset.scBox || 0);
      if (!box) continue;
      const need = e.contentRect.width * (window.devicePixelRatio || 1);
      if (need > 0 && Math.abs(box / need - 1) >= REDO_RATIO - 1) enqueue(img);
    }
  });
  const watched = new WeakSet();
  function watch(img) {
    applyCached(img);
    if (watched.has(img)) return;
    watched.add(img);
    visible.observe(img);
    resized.observe(img);
  }
  function scan(root = document) {
    if (root.matches?.(SELECTOR)) watch(root);
    root.querySelectorAll?.(SELECTOR).forEach(watch);
  }
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === "attributes") {
        // Stash が別のシーンの画像に差し替えた時は作り直す
        const img = m.target;
        const s = img.getAttribute("src") || "";
        if (img.matches(SELECTOR) && s && s !== made.get(img)) {
          delete img.dataset.scBox;
          img.dataset.src = s;
          if (!applyCached(img) && watched.has(img)) {
            visible.unobserve(img);
            visible.observe(img);
          }
        }
      } else for (const n of m.addedNodes) if (n.nodeType === 1) scan(n);
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
  loadStore().then(() => scan());
  scan();
  window.StashSharpCovers = {
    cacheSize: () => cache.size,
    refresh: () => document.querySelectorAll(SELECTOR).forEach(enqueue),
    // 保存した縮小画像をすべて消す（設定を変えた後など）
    clear: async () => {
      cache.clear();
      if (await dbReady) db.transaction(DB_STORE, "readwrite").objectStore(DB_STORE).clear();
    },
  };
})();

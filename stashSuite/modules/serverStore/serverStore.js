"use strict";
// Server Store：Stash Suiteがブラウザ（localStorage）に置いていた設定・記録を Stash サーバーに保存する。
// 各プラグインは今まで通り localStorage を読み書きするだけでよい：
//  - 読み込み時：サーバーの内容を localStorage に書き戻してから他のプラグインが動く（yml の requires で先に読み込まれる）
//  - 書き込み時：対象のキーだけを拾ってサーバーへ送る（まとめて1秒後、ページを閉じる時は即時）
//  - 初回：サーバーに無く、このブラウザにだけあるキーはサーバーへ移す
// 保存先は Stash の設定（config.yml の plugins.serverStore.data、JSON 文字列1つ）。
(function () {
  if (window.ServerStore) return;
  const PLUGIN = "stashSuite";
  // 同期するキー（前方一致）。キャッシュ（作り直せる物）は同期しない
  const PREFIXES = ["stashMiniPlayer.", "stashPopupPlayer.", "quickGenres.", "stash.tagWeightedRecommendations.", "stash.cardRarity.", "lightCards.", "libraryHub.", "mangaViewer.", "viewMode.", "searchHistory.", "myHome.", "suite."];
  // 顔の記憶（出演者ごとにサーバーへ別保存）／整備ハブの「元に戻す」（反映前のデータ。大きく、ブラウザごとで足りる）
  // 顔の帯の顔の位置（quickGenres.faces）は小さい（80人で約12KB）ので同期する：別のブラウザで開いた時に顔検出（14MB）を読み込み直さない
  const EXCLUDE = ["stashMiniPlayer.faceMemory.", "libraryHub.undo"];
  const synced = (k) => typeof k === "string" && PREFIXES.some((p) => k.startsWith(p)) && !EXCLUDE.some((p) => k.startsWith(p));

  const proto = Storage.prototype;
  const rawSet = proto.setItem,
    rawRemove = proto.removeItem;

  function gql(query, variables, opts = {}) {
    return fetch("/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      keepalive: !!opts.keepalive,
    }).then((r) => r.json());
  }
  const READ = 'query{configuration{plugins(include:["stashSuite","serverStore"])}}';
  const parse = (cfg) => {
    try {
      const d = cfg?.data?.configuration?.plugins?.[PLUGIN]?.data || cfg?.data?.configuration?.plugins?.serverStore?.data;
      return d ? JSON.parse(d) || {} : {};
    } catch {
      return {};
    }
  };

  // 起動時はサーバーの内容が揃ってから他のプラグインに進ませたいので同期通信（ローカルのサーバーなので一瞬）
  let server = {};
  let ok = false;
  try {
    const x = new XMLHttpRequest();
    x.open("POST", "/graphql", false);
    x.setRequestHeader("Content-Type", "application/json");
    x.send(JSON.stringify({ query: READ }));
    if (x.status === 200) {
      server = parse(JSON.parse(x.responseText));
      ok = true;
    }
  } catch (e) {
    console.warn("[Server Store] サーバーから読めませんでした（このブラウザの内容で動きます）", e);
  }

  const pending = new Map(); // key -> 値（null は削除）
  if (ok) {
    for (const [k, v] of Object.entries(server)) if (synced(k) && localStorage.getItem(k) !== v) rawSet.call(localStorage, k, v);
    // 移行：このブラウザにだけある値をサーバーへ
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (synced(k) && !(k in server)) pending.set(k, localStorage.getItem(k));
    }
  }

  let timer = 0,
    sending = null;
  async function flush(keepalive = false) {
    clearTimeout(timer);
    timer = 0;
    if (!pending.size) return;
    if (sending && !keepalive) {
      await sending.catch(() => {});
      return flush();
    }
    const batch = new Map(pending);
    pending.clear();
    sending = (async () => {
      // 別のブラウザが書いた分を消さないよう、最新を読んでから変わったキーだけ反映する
      const latest = keepalive ? server : parse(await gql(READ));
      for (const [k, v] of batch) v === null ? delete latest[k] : (latest[k] = v);
      const r = await gql("mutation($v:Map!){configurePlugin(plugin_id:\"" + PLUGIN + "\",input:$v)}", { v: { data: JSON.stringify(latest) } }, { keepalive });
      if (r.errors) throw new Error(r.errors[0].message);
      server = latest;
    })();
    try {
      await sending;
    } catch (e) {
      for (const [k, v] of batch) if (!pending.has(k)) pending.set(k, v); // 次の機会にもう一度
      console.warn("[Server Store] サーバーへ保存できませんでした。あとで再試行します", e);
      timer = setTimeout(flush, 10000);
    } finally {
      sending = null;
    }
  }
  const schedule = () => {
    if (!timer) timer = setTimeout(flush, 5000); // ページ送りのたびに送らないよう、5 秒まとめる（閉じる時は pagehide ですぐ送る）
  };

  proto.setItem = function (k, v) {
    const same = this === localStorage && synced(k) && this.getItem(k) === String(v);
    rawSet.call(this, k, v);
    if (this === localStorage && synced(k) && !same) {
      pending.set(k, String(v));
      schedule();
    }
  };
  proto.removeItem = function (k) {
    rawRemove.call(this, k);
    if (this === localStorage && synced(k)) {
      pending.set(k, null);
      schedule();
    }
  };
  addEventListener("pagehide", () => flush(true));
  if (pending.size) schedule();

  window.ServerStore = { flush, ready: ok, gql };
})();

// Suite Core：一瞬でも開いた動画の履歴（最後に開いた順）
//   ・保存先：localStorage "suite.openHistory"（Server Store で Stash サーバーへ自動同期）
//   ・記録元：ミニプレイヤー / シーン詳細ページ(/scenes/番号) / 外部プレイヤー / Grid Player
(function () {
  "use strict";
  const S = window.Suite;
  if (!S || S.recordOpen) return;
  const KEY = "suite.openHistory",
    MAX = 100,
    el = S.el;

  const load = () => {
    try {
      const a = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(a) ? a : [];
    } catch {
      return [];
    }
  };
  const save = (list) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    } catch {}
  };
  S.recordOpen = (id) => {
    id = String(id || "").trim();
    if (!/^\d+$/.test(id)) return;
    const list = load().filter((x) => String(x.id) !== id);
    list.unshift({ id, at: Date.now() });
    save(list);
    if (!panel.hidden) render();
  };

  // シーン詳細ページ（/scenes/番号）を開いた瞬間も記録
  let lastPathId = "";
  const watchPath = () => {
    const m = location.pathname.match(/^\/scenes\/(\d+)\/?$/);
    const id = m ? m[1] : "";
    if (id && id !== lastPathId) {
      lastPathId = id;
      S.recordOpen(id);
    } else if (!id) lastPathId = "";
  };
  new MutationObserver(watchPath).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener("popstate", watchPath);
  watchPath();

  const fmtWhen = (ts) => {
    const diff = Math.max(0, Date.now() - ts);
    if (diff < 60000) return "たった今";
    if (diff < 3600000) return Math.floor(diff / 60000) + "分前";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "時間前";
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const panel = el("div", "shist-panel");
  panel.hidden = true;
  let token = 0;

  function openScene(id, title, e) {
    if (e && (e.ctrlKey || e.metaKey || e.button === 1)) {
      window.open("/scenes/" + id, "_blank");
      return;
    }
    let act = "";
    try { act = JSON.parse(localStorage.getItem("suite.prefs") || "{}").cardClickAction || ""; } catch {}
    if (act === "external") {
      S.openExternal?.(id, title);
    } else if (act !== "stash" && window.StashMiniPlayer?.open) {
      close();
      window.StashMiniPlayer.open(String(id));
    } else {
      close();
      S.navigate("/scenes/" + id);
    }
  }

  async function render() {
    const my = ++token;
    const list = load();
    const head = el("div", "shist-head");
    head.append(el("h2", null, "開いた履歴（" + list.length + "件）"));
    if (list.length) {
      const clr = el("button", "ss-btn", "すべて消す");
      clr.type = "button";
      clr.onclick = () => {
        if (!confirm("開いた履歴をすべて消しますか？")) return;
        save([]);
        render();
      };
      head.append(clr);
    }
    const closeBtn = el("button", "ss-btn", "閉じる");
    closeBtn.type = "button";
    closeBtn.onclick = close;
    head.append(closeBtn);

    const body = el("div", "shist-body");
    if (!list.length) {
      body.append(el("p", "shist-empty", "まだ履歴がありません。動画を開くとここに新しい順で記録されます。"));
      panel.replaceChildren(head, body);
      return;
    }
    body.append(el("p", "shist-empty", "読み込み中…"));
    panel.replaceChildren(head, body);

    try {
      const ids = list.map((x) => x.id);
      const d = await S.gql("query SuiteHist($ids:[ID!]){findScenes(ids:$ids,filter:{per_page:-1}){scenes{id title code paths{screenshot} files{basename duration} performers{name}}}}", { ids });
      if (my !== token || panel.hidden) return;
      const byId = new Map((d?.findScenes?.scenes || []).map((s) => [String(s.id), s]));
      const rows = list.filter((x) => byId.has(String(x.id)));
      body.replaceChildren();
      if (!rows.length) {
        body.append(el("p", "shist-empty", "表示できる履歴がありません。"));
        return;
      }
      for (const item of rows) {
        const sc = byId.get(String(item.id));
        const title = sc.title || sc.files?.[0]?.basename || "Scene " + sc.id;
        const row = el("div", "shist-row");
        const main = el("button", "shist-main");
        main.type = "button";
        main.onclick = (e) => openScene(sc.id, title, e);
        main.onauxclick = (e) => { if (e.button === 1) openScene(sc.id, title, e); };
        const img = el("img", "shist-thumb");
        img.loading = "lazy";
        img.alt = "";
        img.src = sc.paths?.screenshot || "";
        const info = el("div", "shist-info");
        info.append(el("div", "shist-title", title));
        const metaParts = [fmtWhen(item.at), sc.code, (sc.performers || []).slice(0, 2).map((p) => p.name).join(" / ")].filter(Boolean);
        info.append(el("div", "shist-meta", metaParts.join(" ・ ")));
        main.append(img, info);

        const del = el("button", "shist-del", "×");
        del.type = "button";
        del.title = "この履歴を消す";
        del.onclick = (e) => {
          e.stopPropagation();
          save(load().filter((x) => String(x.id) !== String(sc.id)));
          render();
        };
        row.append(main, del);
        body.append(row);
      }
    } catch (e) {
      if (my !== token) return;
      body.replaceChildren(el("p", "shist-empty", "読み込みに失敗しました：" + (e.message || e)));
    }
  }

  function open() {
    panel.hidden = false;
    render();
  }
  function close() {
    panel.hidden = true;
  }
  panel.addEventListener("mousedown", (e) => { if (e.target === panel) close(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) {
      e.preventDefault();
      close();
    }
  });

  setInterval(() => {
    if (!panel.isConnected) document.body.append(panel);
  }, 1000);

  S.css(
    "suite-history",
    `
.shist-panel{position:fixed;inset:0;z-index:2147483647;background:#0008;display:flex;flex-direction:column;align-items:flex-end}
.shist-panel[hidden]{display:none}
.shist-head,.shist-body{background:var(--suite-panel);color:var(--suite-text);width:min(480px,100vw)}
.shist-head{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid var(--suite-line)}
.shist-head h2{flex:1;margin:0;font-size:17px}
.shist-body{flex:1;overflow:auto;padding:8px 12px 24px}
.shist-empty{color:var(--suite-sub);font-size:13px;padding:18px 8px;text-align:center}
.shist-row{display:flex;align-items:center;gap:6px;padding:4px;border-radius:var(--suite-radius)}
.shist-row:hover{background:var(--suite-raise)}
.shist-main{flex:1;min-width:0;display:flex;align-items:center;gap:10px;padding:4px;border:0;background:none;color:inherit;text-align:left;cursor:pointer}
.shist-thumb{width:96px;height:56px;flex:none;object-fit:cover;border-radius:5px;background:#0b1016}
.shist-info{flex:1;min-width:0}
.shist-title{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.35}
.shist-meta{margin-top:3px;font-size:11.5px;color:var(--suite-sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.shist-del{width:26px;height:26px;flex:none;border:0;border-radius:5px;background:transparent;color:var(--suite-sub);font-size:15px;cursor:pointer}
.shist-del:hover{background:#ffffff18;color:#fff}
`,
  );
  S.openHistory = open;
  S.toggleHistory = () => (panel.hidden ? open() : close());
})();

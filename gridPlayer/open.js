// Grid Player：カードを Shift＋クリックした時に、その作品を並べて再生に足す
//   Stash の「Shift＋クリックで選ぶ」より先に受け取る（一覧の選択はチェック欄で今までどおりできる）
//   直接再生できない形式（wmv など）は Stash に WebM へ変換させて流す
(function () {
  "use strict";
  const S = window.Suite,
    G = window.GridPlayer;
  if (!S || !G) return;

  const sceneId = (target) => {
    const card = target.closest?.(".lc-card, .scene-card, .wall-item");
    if (!card) return null;
    const a = card.querySelector('a[href*="/scenes/"]');
    const m = a?.getAttribute("href")?.match(/\/scenes\/(\d+)/) || a?.dataset.suiteHref?.match(/\/scenes\/(\d+)/);
    return m ? m[1] : null;
  };

  async function open(id) {
    const d = await S.gql("query($id:ID!){findScene(id:$id){id title files{basename duration} resume_time paths{stream} sceneStreams{url mime_type label}}}", { id });
    const sc = d.findScene;
    if (!sc) return;
    const streams = sc.sceneStreams || [];
    const direct = !streams.length || streams.some((x) => x.label === "Direct stream" || /\/stream(?:\?|$)/.test(x.url));
    const webm = streams.find((x) => x.mime_type === "video/webm");
    S.recordOpen?.(sc.id);
    G.add({
      id: sc.id,
      title: sc.title || sc.files?.[0]?.basename || "scene " + sc.id,
      src: direct || !webm ? sc.paths.stream : webm.url,
      directSrc: sc.paths.stream,
      webmSrc: webm?.url || null,
      duration: sc.files?.[0]?.duration || 0,
      tx: direct || !webm ? null : { duration: sc.files?.[0]?.duration || 0 },
      start: sc.resume_time >= 15 ? sc.resume_time : 0,
    });
  }

  window.addEventListener(
    "click",
    (e) => {
      try { if (JSON.parse(localStorage.getItem("suite.prefs") || "{}").gridPlayerEnabled === false) return; } catch {}
      if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.button !== 0) return;
      // チェック欄・ボタン・入力欄の Shift＋クリックはそのまま（範囲選択など）
      if (e.target.closest?.("input, button, select, textarea, label, .lc-rate, .lc-tagrow, .lc-bundle")) return;
      const id = sceneId(e.target);
      if (!id) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      open(id).catch((err) => console.warn("[Grid Player]", err));
    },
    true,
  );
})();

// Search History — Stash の検索窓（.search-term-input）に最近の検索を出す
// ・打ち終わって 1.5 秒たった言葉（2文字以上）か、Enter した言葉を覚える
// ・検索窓をクリックすると、すぐ下に新しい順で出る。選ぶとその言葉で検索、× で1件消す
// ・保存は localStorage の "searchHistory.list"（serverStore がサーバーに同期する）
(function () {
  "use strict";
  if (window.__searchHistory) return;
  window.__searchHistory = true;

  const KEY = "searchHistory.list",
    MAX = 30;
  const load = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch (e) {
      return [];
    }
  };
  const save = (list) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    } catch (e) {}
  };
  function remember(q) {
    q = (q || "").trim();
    if (q.length < 2) return;
    // 打っている途中の言葉（「巨」→「巨乳」）は、直前の物を置き換える
    const list = load().filter((x) => x !== q);
    if (list[0] && q.startsWith(list[0]) && Date.now() - lastAt < 15000) list.shift();
    lastAt = Date.now();
    save([q, ...list]);
  }
  let lastAt = 0;

  const style = document.createElement("style");
  style.textContent = `
.sh-pop{position:fixed;z-index:2000;min-width:220px;max-width:420px;max-height:60vh;overflow:auto;background:#1f2a33;border:1px solid #3a4a57;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,.5);padding:4px 0;font-size:.9rem}
.sh-row{display:flex;align-items:center;gap:6px;padding:5px 10px;cursor:pointer;color:#e6edf3}
.sh-row:hover{background:#2f3f4c}
.sh-row .sh-q{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sh-row .sh-x{border:0;background:none;color:#8b9aa6;cursor:pointer;padding:0 4px;font-size:1rem;line-height:1}
.sh-row .sh-x:hover{color:#fff}
.sh-head{padding:3px 10px;color:#8b9aa6;font-size:.75rem}`;
  document.head.append(style);

  const pop = document.createElement("div");
  pop.className = "sh-pop";
  pop.hidden = true;
  document.body.append(pop);
  let owner = null;

  // React が持っている入力欄なので、値は元の setter で入れて input を起こす
  function setValue(input, v) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function render() {
    const list = load(),
      cur = (owner.value || "").trim();
    pop.textContent = "";
    if (!list.length) return hide();
    const head = document.createElement("div");
    head.className = "sh-head";
    head.textContent = "最近の検索";
    pop.append(head);
    for (const q of list) {
      const row = document.createElement("div");
      row.className = "sh-row";
      row.title = q;
      const t = document.createElement("span");
      t.className = "sh-q";
      t.textContent = q;
      const x = document.createElement("button");
      x.type = "button";
      x.className = "sh-x";
      x.textContent = "×";
      x.title = "この履歴を消す";
      x.onmousedown = (e) => e.preventDefault();
      x.onclick = (e) => {
        e.stopPropagation();
        save(load().filter((y) => y !== q));
        render();
      };
      row.onmousedown = (e) => e.preventDefault(); // 入力欄からフォーカスを外さない
      row.onclick = () => {
        setValue(owner, q);
        remember(q);
        hide();
      };
      if (q === cur) row.style.fontWeight = "bold";
      row.append(t, x);
      pop.append(row);
    }
    const r = owner.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(r.left, innerWidth - 430)) + "px";
    pop.style.top = r.bottom + 2 + "px";
    pop.style.minWidth = Math.max(220, r.width) + "px";
    pop.hidden = false;
  }
  function hide() {
    pop.hidden = true;
  }

  const isSearch = (el) => el && el.tagName === "INPUT" && el.closest(".search-term-input");
  let timer = 0;
  document.addEventListener("mousedown", (e) => {
    if (isSearch(e.target)) {
      owner = e.target;
      if (pop.hidden) setTimeout(render, 0);
      else hide(); // 開いている時にもう一度クリックで閉じる
    } else if (!pop.contains(e.target)) hide();
  });
  document.addEventListener("input", (e) => {
    if (!isSearch(e.target)) return;
    clearTimeout(timer);
    const el = e.target;
    timer = setTimeout(() => remember(el.value), 1500);
    if (!pop.hidden && owner === el) hide(); // 打ち始めたら邪魔しない
  });
  document.addEventListener("keydown", (e) => {
    if (!isSearch(e.target)) return;
    if (e.key === "Enter") remember(e.target.value);
    if (e.key === "Escape") hide();
  });
  addEventListener("scroll", hide, true);
  addEventListener("resize", hide);
})();

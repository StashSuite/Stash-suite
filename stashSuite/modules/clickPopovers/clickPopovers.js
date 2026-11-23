/*
 * Click Popovers — Stash の HoverPopover（カードのタグ数ボタン等）をクリック式にする
 *
 * ・対象：カードの「タグ／出演者／グループ／マーカー／ギャラリー数」ボタン、Valkyr Scene Cards の「…」一覧
 *   → クリックで開閉。外側クリック・Esc・スクロールで閉じる。同時に開くのは1つだけ。上側に表示（入らなければ下）。
 * ・Valkyr Scene Cards の出演者ホバー（年齢・国籍）は止める（出演者カードは Scene Card Rarity がクリックで出す）。
 * ・それ以外の HoverPopover はホバーのまま、下向きのものだけ上向きにする。
 */
(() => {
  "use strict";
  if (window.__clickPopovers) return;
  window.__clickPopovers = true;
  const api = window.PluginApi;
  if (!api?.patch?.instead || !api.libraries?.Bootstrap) return console.warn("[Click Popovers] PluginApi が見つかりません。");
  const React = api.React,
    h = React.createElement,
    { Overlay, Popover } = api.libraries.Bootstrap;
  const CLICK = /\b(?:tag|performer|group|movie|marker|gallery|image|scene|studio|other)-count\b|\boverflow-popover\b/;

  let closeCurrent = null; // 開いているポップアップを閉じる関数（同時に1つだけ）

  function ClickPopover({ className, content, children, target }) {
    const [show, setShow] = React.useState(false),
      ref = React.useRef(null);
    const close = React.useCallback(() => setShow(false), []);
    React.useEffect(() => {
      if (!show) return;
      if (closeCurrent && closeCurrent !== close) closeCurrent();
      closeCurrent = close;
      const inside = (t) => t instanceof Node && (ref.current?.contains(t) || (t instanceof Element && t.closest(".cp-popover")));
      const down = (e) => !inside(e.target) && close();
      const key = (e) => e.key === "Escape" && close();
      const scroll = (e) => !inside(e.target) && close();
      document.addEventListener("pointerdown", down, true);
      document.addEventListener("keydown", key, true);
      window.addEventListener("scroll", scroll, true);
      return () => {
        if (closeCurrent === close) closeCurrent = null;
        document.removeEventListener("pointerdown", down, true);
        document.removeEventListener("keydown", key, true);
        window.removeEventListener("scroll", scroll, true);
      };
    }, [show, close]);
    const toggle = (e) => {
      if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      setShow((v) => !v);
    };
    return h(
      React.Fragment,
      null,
      h("div", { className: [className, "cp-trigger", show ? "cp-open" : ""].filter(Boolean).join(" "), ref, onClick: toggle }, children),
      ref.current &&
        h(
          Overlay,
          { show, placement: "top", flip: true, target: target?.current ?? ref.current },
          h(Popover, { id: "popover", className: "hover-popover-content cp-popover" }, content),
        ),
    );
  }

  function childClass(children) {
    return String((React.isValidElement(children) && children.props?.className) || "");
  }

  api.patch.instead("HoverPopover", function (props, _, Original) {
    const cls = String(props.className || "");
    if (CLICK.test(cls)) return h(ClickPopover, props);
    if (/\bvsc-performer\b/.test(childClass(props.children))) return props.children;
    return h(Original, props.placement === "bottom" ? { ...props, placement: "top" } : props);
  });
})();

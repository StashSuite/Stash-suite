"use strict";
// Suite：つかんでドラッグで動かす（離すと滑る）。window.Suite.dragScroll(つかむ所, 動かす箱, {axis, filter})
//   ドラッグを終えた時刻を Suite.dragEndAt に残す（直後のクリックを無視したい他のプラグイン用）
(function () {
  const S = (window.Suite = window.Suite || {});
  if (S.dragScroll) return;
  const SKIP = "input, textarea, select, .mv-slider";
  // 慣性（スマホのスワイプに合わせた値）：DECEL＝1ms ごとに残す速さ（iPhone の標準 0.998。1に近いほど長く滑る）、
  // MAX_V＝はじく速さの上限、MIN_V＝これより遅くなったら止める（どちらも px/ms）
  const DECEL = 0.998,
    MAX_V = 9,
    MIN_V = 0.02;

  // listen＝つかむ所、box＝動かす箱（ページ全体なら document.scrollingElement）
  // axis：x／y、filter：つかんでよい所か（無ければ listen の中すべて）
  // 慣性はスマホのスワイプと同じ考え方：
  //   ・離す直前 0.1 秒の動きで速さを測る（止めてから離したら滑らない）
  //   ・滑りは時間あたり一定の割合で減る（1ms ごとに速さの DECEL を残す。PC の重さで距離が変わらない）
  //   ・滑っている間に同じ向きへもう一度はじくと上乗せ／押さえるとその場で止まる（そのクリックは押したことにしない）
  function dragScroll(listen, box, { axis = "y", filter } = {}) {
    let glide = 0,
      glideV = 0; // 滑っている速さ（px/ms。指の動きの向き）
    const read = () => (axis === "x" ? box.scrollLeft : box.scrollTop);
    const write = (v) => (axis === "x" ? (box.scrollLeft = v) : (box.scrollTop = v));
    const stop = () => {
      cancelAnimationFrame(glide);
      glide = 0;
      glideV = 0;
    };
    // 離した直後のクリックを捨てる。ほかのプラグイン（ミニプレイヤーの「表紙のクリックで開く」など）が先にクリックを拾う時のため、
    // ドラッグを終えた時刻を S.dragEndAt に残す（そちらで「直後のクリックは無視」できるように）
    const swallowClick = () => {
      S.dragEndAt = performance.now();
      addEventListener("click", (c) => (c.stopPropagation(), c.preventDefault()), { capture: true, once: true });
    };
    listen.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.pointerType === "touch" || e.target.closest?.(SKIP) || (filter && !filter(e))) return;
      const wasGliding = !!glide,
        carry = glideV;
      stop();
      const start = axis === "x" ? e.clientX : e.clientY,
        from = read();
      let moved = false;
      const samples = [{ p: start, t: e.timeStamp }];
      const move = (m) => {
        const p = axis === "x" ? m.clientX : m.clientY;
        if (!moved && Math.abs(p - start) > 6) {
          moved = true;
          document.documentElement.classList.add("suite-grabbing");
          getSelection()?.removeAllRanges();
        }
        samples.push({ p, t: m.timeStamp });
        while (samples.length > 2 && m.timeStamp - samples[0].t > 100) samples.shift();
        if (!moved) return;
        m.preventDefault();
        write(from - (p - start));
      };
      const up = (u) => {
        removeEventListener("pointermove", move, true);
        removeEventListener("pointerup", up, true);
        removeEventListener("pointercancel", up, true);
        document.documentElement.classList.remove("suite-grabbing");
        if (!moved) {
          if (wasGliding) swallowClick(); // 滑っているのを押さえて止めただけ
          return;
        }
        swallowClick(); // 離した直後のクリックは捨てる
        const a = samples[0],
          b = samples[samples.length - 1];
        // 最後に動いてから 60ms 以上止めていたら滑らせない
        let v = u.timeStamp - b.t > 60 || b.t - a.t < 8 ? 0 : (b.p - a.p) / (b.t - a.t);
        if (v && carry && Math.sign(v) === Math.sign(carry)) v += carry * 0.8; // 続けてはじくと加速
        v = Math.max(-MAX_V, Math.min(MAX_V, v));
        if (Math.abs(v) < MIN_V) return;
        // scrollTop は整数に丸められるので、位置は自分で小数のまま持つ
        let pos = read(),
          prevT = performance.now();
        glideV = v;
        const step = (now) => {
          const dt = Math.min(48, now - prevT);
          prevT = now;
          pos -= glideV * dt;
          write(pos);
          // 端に着いた（動かなくなった）ら止める
          if (Math.abs(read() - pos) > 2) return stop();
          glideV *= Math.pow(DECEL, dt);
          if (Math.abs(glideV) < MIN_V) return stop();
          glide = requestAnimationFrame(step);
        };
        glide = requestAnimationFrame(step);
      };
      addEventListener("pointermove", move, true);
      addEventListener("pointerup", up, true);
      addEventListener("pointercancel", up, true);
    });
    // 画像・リンクをつかんだ時に、ブラウザの「ドラッグで持ち出す」が始まらないように
    listen.addEventListener("dragstart", (e) => {
      if (!filter || filter(e)) e.preventDefault();
    });
    // ホイールで回した時は滑りを止める
    listen.addEventListener("wheel", stop, { passive: true });
  }

  S.dragScroll = dragScroll;
})();

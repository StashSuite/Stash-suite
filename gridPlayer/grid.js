// Grid Player：最大9画面の同時再生プレイヤー（window.GridPlayer）
//   ・右寄せ（左端ドラッグで幅変更可）⇔ ウィンドウ全面 ⇔ 全画面（フルスクリーン）
//   ・一括操作：一括再生/停止・全員ランダム位置へ・全部消音・ループ・枠いっぱい切替（contain/cover）
//   ・各タイル：再生/停止・±10秒・シークバー・速度・音量・拡大（ダブルクリックでも可）・外部プレイヤー/詳細へ・閉じる
//   ・キー操作：Space（再生/停止）・←/→（±10秒）・M（全消音）・F（全画面）・Esc（戻る/しまう）
(function () {
  "use strict";
  const S = window.Suite;
  if (!S || window.GridPlayer) return;
  const MAX = 9;
  const el = S.el;
  const WIDTH_KEY = "gridPlayer.dockWidth";
  const SMOOTH_KEY = "stashMiniPlayer.smoothScenes";
  const readSmooth = () => {
    try {
      const a = JSON.parse(localStorage.getItem(SMOOTH_KEY) || "[]");
      return Array.isArray(a) ? a.map(String) : [];
    } catch {
      return [];
    }
  };
  const writeSmooth = (list) => {
    try {
      localStorage.setItem(SMOOTH_KEY, JSON.stringify([...new Set(list.map(String))]));
    } catch {}
  };
  const isSmoothId = (id) => readSmooth().includes(String(id));

  const ICO_VOL_ON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>';
  const ICO_VOL_OFF = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
  const ICO_EXPAND = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  const ICO_EXT = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

  let root = null,
    pill = null,
    tiles = [],
    focus = null,
    hidden = false,
    mode = "dock", // "dock"（右寄せ） | "wide"（ブラウザ全面） | "full"（OS全画面）
    coverFit = false,
    loopAll = true,
    dockVw = (() => {
      try {
        const v = Number(localStorage.getItem(WIDTH_KEY));
        return v >= 20 && v <= 75 ? v : 32;
      } catch {
        return 32;
      }
    })();

  let lastSound = [];
  const activeTile = () => focus || tiles.find((t) => !t.video.muted) || tiles[0] || null;

  function applyDockWidth() {
    document.documentElement.style.setProperty("--gp-w", dockVw + "vw");
  }
  applyDockWidth();

  function drawTopState() {
    if (!root) return;
    const muteBtn = root.querySelector(".gp-muteall");
    if (muteBtn) muteBtn.textContent = tiles.some((t) => !t.video.muted) ? "全消音" : "音戻す";
    const playBtn = root.querySelector(".gp-playall");
    if (playBtn) playBtn.textContent = tiles.some((t) => !t.video.paused) ? "全停止" : "全再生";
    const fitBtn = root.querySelector(".gp-fit");
    if (fitBtn) {
      fitBtn.textContent = coverFit ? "全体表示" : "枠いっぱい";
      fitBtn.classList.toggle("on", coverFit);
    }
    const wideBtn = root.querySelector(".gp-wide");
    if (wideBtn) {
      wideBtn.textContent = mode === "wide" ? "右寄せ" : "全面";
      wideBtn.classList.toggle("on", mode === "wide");
    }
    const fsBtn = root.querySelector(".gp-fs");
    if (fsBtn) {
      fsBtn.textContent = mode === "full" ? "全画面解除" : "全画面";
      fsBtn.classList.toggle("on", mode === "full");
    }
  }

  async function toggleFullscreen() {
    if (!root) return;
    if (document.fullscreenElement === root) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    mode = "full";
    layout();
    try {
      await root.requestFullscreen();
    } catch {
      mode = "wide";
      layout();
    }
  }

  function build() {
    root = el("div", "gp-root");
    const resizer = el("div", "gp-resizer");
    resizer.title = "ドラッグで幅を変更";
    resizer.addEventListener("pointerdown", (e) => {
      if (mode !== "dock") return;
      e.preventDefault();
      try { resizer.setPointerCapture(e.pointerId); } catch {}
      const move = (ev) => {
        const vw = Math.round(((window.innerWidth - ev.clientX) / window.innerWidth) * 100);
        dockVw = Math.max(20, Math.min(75, vw));
        applyDockWidth();
      };
      const up = () => {
        resizer.removeEventListener("pointermove", move);
        resizer.removeEventListener("pointerup", up);
        try { localStorage.setItem(WIDTH_KEY, String(dockVw)); } catch {}
      };
      resizer.addEventListener("pointermove", move);
      resizer.addEventListener("pointerup", up);
    });

    const bar = el("div", "gp-bar");
    const count = el("span", "gp-count");

    const playAll = el("button", "gp-btn gp-playall", "全停止");
    playAll.type = "button";
    playAll.title = "すべての動画を一括再生／一時停止";
    playAll.onclick = () => {
      const anyPlaying = tiles.some((t) => !t.video.paused);
      tiles.forEach((t) => (anyPlaying ? t.video.pause() : t.video.play().catch(() => {})));
      drawTopState();
    };

    const muteAll = el("button", "gp-btn gp-muteall", "全消音");
    muteAll.type = "button";
    muteAll.title = "全部消音／直前の音を戻す（M）";
    muteAll.onclick = () => {
      const anyOn = tiles.some((t) => !t.video.muted);
      if (anyOn) {
        lastSound = tiles.filter((t) => !t.video.muted);
        tiles.forEach((t) => (t.video.muted = true));
      } else {
        const back = lastSound.filter((t) => tiles.includes(t));
        (back.length ? back : tiles.slice(0, 1)).forEach((t) => (t.video.muted = false));
      }
      drawTopState();
    };

    const randAll = el("button", "gp-btn", "ランダム位置");
    randAll.type = "button";
    randAll.title = "すべての動画をランダムな再生位置へジャンプ";
    randAll.onclick = () => {
      for (const t of tiles) {
        const d = t.dur();
        if (d > 20) t.jump(d * (0.1 + Math.random() * 0.8));
      }
    };

    const fitBtn = el("button", "gp-btn gp-fit", "枠いっぱい");
    fitBtn.type = "button";
    fitBtn.title = "黒帯なしで枠いっぱいに敷き詰める／全体表示を切替";
    fitBtn.onclick = () => {
      coverFit = !coverFit;
      root.classList.toggle("gp-cover", coverFit);
      drawTopState();
    };

    const wideBtn = el("button", "gp-btn gp-wide", "全面");
    wideBtn.type = "button";
    wideBtn.title = "ブラウザ画面いっぱいに広げる／右寄せに戻す";
    wideBtn.onclick = () => {
      if (document.fullscreenElement === root) document.exitFullscreen().catch(() => {});
      mode = mode === "wide" ? "dock" : "wide";
      layout();
    };

    const fsBtn = el("button", "gp-btn gp-fs", "全画面");
    fsBtn.type = "button";
    fsBtn.title = "OS全画面表示（F / Escで解除）";
    fsBtn.onclick = () => toggleFullscreen();

    const hide = el("button", "gp-btn", "しまう");
    hide.type = "button";
    hide.title = "一時停止して右下にしまう";
    hide.onclick = () => setHidden(true);

    const closeAll = el("button", "gp-btn gp-danger", "全部閉じる");
    closeAll.type = "button";
    closeAll.onclick = () => [...tiles].forEach(remove);

    document.addEventListener("fullscreenchange", () => {
      if (document.fullscreenElement !== root && mode === "full") {
        mode = "dock";
        layout();
      }
    });

    bar.append(
      el("span", "gp-title", "並べて再生"),
      count,
      el("span", "gp-gap"),
      playAll,
      muteAll,
      randAll,
      fitBtn,
      wideBtn,
      fsBtn,
      hide,
      closeAll,
    );
    root.append(resizer, el("div", "gp-hot"), bar, el("div", "gp-grid"));
    root.addEventListener("volumechange", drawTopState, true);
    root.addEventListener("play", drawTopState, true);
    root.addEventListener("pause", drawTopState, true);

    pill = el("button", "gp-pill");
    pill.type = "button";
    pill.onclick = () => setHidden(false);
    document.body.append(root, pill);

    // キーボードショートカット（Grid Player が見えている時だけ）
    document.addEventListener("keydown", (e) => {
      if (!root || root.hidden || !tiles.length) return;
      if (e.target instanceof Element && e.target.closest("input,textarea,select,[contenteditable]")) return;
      if (document.querySelector("#sp22:not(.minimized)")) return;
      if (e.key === "Escape") {
        if (focus) {
          e.preventDefault();
          focus = null;
          layout();
        } else if (mode === "wide") {
          e.preventDefault();
          mode = "dock";
          layout();
        }
        return;
      }
      if (mode === "dock" && !(e.target instanceof Node && root.contains(e.target))) return;
      const t = activeTile();
      if (e.key === " ") {
        e.preventDefault();
        if (t) t.video.paused ? t.video.play().catch(() => {}) : t.video.pause();
      } else if (e.key === "ArrowLeft" && t) {
        e.preventDefault();
        t.jump(t.cur() - (e.shiftKey ? 30 : 10));
      } else if (e.key === "ArrowRight" && t) {
        e.preventDefault();
        t.jump(t.cur() + (e.shiftKey ? 30 : 10));
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        muteAll.click();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      }
    });
  }

  function layout() {
    if (!root) return;
    root.querySelector(".gp-count").textContent = tiles.length + " / " + MAX;
    const grid = root.querySelector(".gp-grid");
    const list = focus ? [focus] : tiles;
    const n = list.length;
    const cols = n <= 1 ? 1 : n === 2 ? (mode === "dock" && dockVw < 42 ? 1 : 2) : n <= 4 ? 2 : 3;
    const rows = Math.max(1, Math.ceil(n / cols));
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    for (const t of tiles) {
      t.box.style.display = !focus || t === focus ? "" : "none";
      t.box.classList.toggle("gp-focused", focus === t);
    }
    root.hidden = hidden || !tiles.length;
    root.classList.toggle("gp-full", mode === "wide" || mode === "full");
    root.classList.toggle("gp-osfs", mode === "full");
    root.classList.toggle("gp-cover", coverFit);
    if (root.hidden && document.fullscreenElement === root) document.exitFullscreen().catch(() => {});
    document.documentElement.classList.toggle("gp-docked", !root.hidden && mode === "dock");
    pill.hidden = !hidden || !tiles.length;
    pill.textContent = "並べて再生に戻る（" + tiles.length + "）";
    drawTopState();
  }

  function setHidden(v) {
    hidden = v;
    for (const t of tiles) (v ? t.video.pause() : t.video.play().catch(() => {}));
    layout();
  }

  function sound(t) {
    for (const x of tiles) {
      x.video.muted = x !== t;
      x.box.classList.toggle("gp-sound", x === t);
    }
    drawTopState();
  }

  function remove(t) {
    t.video.pause();
    t.video.removeAttribute("src");
    t.video.load();
    t.box.remove();
    tiles = tiles.filter((x) => x !== t);
    if (focus === t) focus = null;
    if (t.box.classList.contains("gp-sound") && tiles[0]) sound(tiles[0]);
    if (!tiles.length) mode = "dock";
    layout();
  }

  const SPEEDS = [1, 1.25, 1.5, 2, 0.5];

  function add(sc) {
    if (!root) build();
    hidden = false;
    const same = tiles.find((t) => t.id === sc.id);
    if (same) {
      sound(same);
      return layout();
    }
    if (tiles.length >= MAX) remove(tiles[0]);
    const box = el("div", "gp-tile");
    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.loop = loopAll;
    video.preload = "auto";
    const directUrl = sc.directSrc || sc.src;
    const webmUrl = sc.webmSrc ? sc.webmSrc.replace(/([?&])start=[^&]*&?/, "$1").replace(/[?&]$/, "") : null;
    const totalDur = sc.duration || sc.tx?.duration || 0;
    let smoothOn = !!sc.tx || (!!webmUrl && isSmoothId(sc.id));
    let tx = smoothOn && webmUrl ? { base: webmUrl, duration: totalDur, offset: 0 } : sc.tx ? { base: sc.src.replace(/([?&])start=[^&]*&?/, "$1").replace(/[?&]$/, ""), duration: sc.tx.duration, offset: 0 } : null;
    const cur = () => (tx ? tx.offset : 0) + (video.currentTime || 0);
    const dur = () => (tx ? tx.duration : video.duration) || totalDur || 0;
    const jump = (sec) => {
      const d = dur();
      sec = Math.max(0, Math.min(sec, d > 1 ? d - 1 : 0));
      if (!tx) return void (video.currentTime = sec);
      tx.offset = sec;
      video.src = tx.base + (tx.base.includes("?") ? "&" : "?") + "start=" + sec.toFixed(1);
      video.play().catch(() => {});
    };
    if (tx) jump(sc.start || 0);
    else {
      video.src = directUrl;
      if (sc.start) video.addEventListener("loadedmetadata", () => jump(Math.min(sc.start, (video.duration || 0) - 5)), { once: true });
    }

    const head = el("div", "gp-head");
    const title = el("span", "gp-name", sc.title);
    title.title = sc.title;
    const extBtn = el("button", "gp-hbtn");
    extBtn.type = "button";
    extBtn.innerHTML = ICO_EXT;
    extBtn.title = "外部プレイヤーで開く（Ctrl+クリックで詳細ページ）";
    extBtn.onclick = (e) => {
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) window.open("/scenes/" + sc.id, "_blank");
      else S.openExternal?.(sc.id, sc.title);
    };
    const zoomBtn = el("button", "gp-hbtn");
    zoomBtn.type = "button";
    zoomBtn.innerHTML = ICO_EXPAND;
    zoomBtn.title = "この動画だけ拡大／元に戻す（ダブルクリックでも可）";
    const x = el("button", "gp-x", "×");
    x.type = "button";
    x.title = "このウィンドウを閉じる";
    head.append(title, extBtn, zoomBtn, x);

    const foot = el("div", "gp-foot");
    const play = el("button", "gp-ctl", "❚❚");
    play.type = "button";
    play.title = "再生・一時停止";
    const back10 = el("button", "gp-ctl gp-skip", "-10");
    back10.type = "button";
    back10.title = "10秒戻る";
    const fwd10 = el("button", "gp-ctl gp-skip", "+10");
    fwd10.type = "button";
    fwd10.title = "10秒進む";
    const seek = el("div", "gp-seek");
    const fill = el("div", "gp-fill");
    const knob = el("div", "gp-knob");
    seek.append(fill, knob);
    const clock = el("span", "gp-clock", "");
    const speedBtn = el("button", "gp-ctl gp-spd", "1x");
    speedBtn.type = "button";
    speedBtn.title = "再生速度を切替";
    let spdIdx = 0;
    speedBtn.onclick = () => {
      spdIdx = (spdIdx + 1) % SPEEDS.length;
      video.playbackRate = SPEEDS[spdIdx];
      speedBtn.textContent = SPEEDS[spdIdx] + "x";
    };
    const smoothBtn = el("button", "gp-ctl gp-smooth" + (smoothOn ? " on" : ""), "滑らか");
    smoothBtn.type = "button";
    smoothBtn.title = "ガクガク対策：Stashに変換させて滑らかに再生（ミニプレイヤーと設定共有）";
    if (!webmUrl) smoothBtn.hidden = true;
    smoothBtn.onclick = () => {
      if (!webmUrl) return;
      const pos = cur();
      const wasPaused = video.paused;
      smoothOn = !smoothOn;
      smoothBtn.classList.toggle("on", smoothOn);
      const list = readSmooth().filter((x) => x !== String(sc.id));
      if (smoothOn) list.push(String(sc.id));
      writeSmooth(list);
      if (smoothOn) {
        tx = { base: webmUrl, duration: dur(), offset: pos };
        video.src = webmUrl + (webmUrl.includes("?") ? "&" : "?") + "start=" + pos.toFixed(1);
      } else {
        tx = null;
        video.src = directUrl;
        video.addEventListener("loadedmetadata", () => {
          video.currentTime = Math.min(pos, Math.max(0, (video.duration || 0) - 1));
          if (!wasPaused) video.play().catch(() => {});
        }, { once: true });
      }
      if (!wasPaused) video.play().catch(() => {});
    };
    const mute = el("button", "gp-ctl gp-mute");
    mute.type = "button";
    mute.innerHTML = ICO_VOL_OFF;
    mute.title = "このウィンドウの消音を切り替え";
    const vol = document.createElement("input");
    vol.type = "range";
    vol.className = "gp-vol";
    vol.min = "0";
    vol.max = "1";
    vol.step = "0.02";
    vol.value = "0.5";
    vol.title = "音量";
    video.volume = 0.5;
    foot.append(play, back10, fwd10, seek, clock, smoothBtn, speedBtn, mute, vol);
    box.append(video, head, foot);

    const t = { id: sc.id, box, video, cur, dur, jump };
    zoomBtn.onclick = (e) => {
      e.stopPropagation();
      focus = focus === t ? null : t;
      layout();
    };
    x.onclick = (e) => {
      e.stopPropagation();
      remove(t);
    };
    foot.addEventListener("click", (e) => e.stopPropagation());
    play.onclick = () => (video.paused ? video.play().catch(() => {}) : video.pause());
    back10.onclick = () => jump(cur() - 10);
    fwd10.onclick = () => jump(cur() + 10);
    video.addEventListener("play", () => (play.textContent = "❚❚"));
    video.addEventListener("pause", () => (play.textContent = "▶"));
    const drawSound = () => {
      mute.innerHTML = video.muted || video.volume === 0 ? ICO_VOL_OFF : ICO_VOL_ON;
      box.classList.toggle("gp-sound", !video.muted);
    };
    video.addEventListener("volumechange", drawSound);
    mute.onclick = () => (video.muted = !video.muted);
    vol.oninput = () => {
      video.volume = Number(vol.value);
      video.muted = false;
    };
    // 映像上でホイール → 音量調整
    video.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const next = Math.max(0, Math.min(1, video.volume + (e.deltaY < 0 ? 0.08 : -0.08)));
        video.volume = next;
        vol.value = String(next);
        if (next > 0) video.muted = false;
      },
      { passive: false },
    );

    const fmt = (s) => (s >= 3600 ? Math.floor(s / 3600) + ":" : "") + String(Math.floor((s % 3600) / 60)).padStart(s >= 3600 ? 2 : 1, "0") + ":" + String(Math.floor(s % 60)).padStart(2, "0");
    const draw = (sec) => {
      const d = dur();
      if (!d) return;
      fill.style.width = knob.style.left = Math.min(100, (sec / d) * 100) + "%";
      clock.textContent = fmt(sec) + " / " + fmt(d);
    };
    let dragging = null;
    const at = (cx) => {
      const r = seek.getBoundingClientRect();
      return Math.max(0, Math.min(1, (cx - r.left) / r.width)) * dur();
    };
    seek.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      if (!dur()) return;
      dragging = at(e.clientX);
      draw(dragging);
      if (!tx) jump(dragging);
      try { seek.setPointerCapture(e.pointerId); } catch {}
      const move = (ev) => {
        dragging = at(ev.clientX);
        draw(dragging);
        if (!tx) jump(dragging);
      };
      const up = () => {
        seek.removeEventListener("pointermove", move);
        seek.removeEventListener("pointerup", up);
        if (tx) jump(dragging);
        dragging = null;
      };
      seek.addEventListener("pointermove", move);
      seek.addEventListener("pointerup", up);
    });
    video.addEventListener("timeupdate", () => dragging == null && draw(cur()));

    let clickTimer = null;
    video.addEventListener("click", () => {
      clearTimeout(clickTimer);
      clickTimer = setTimeout(() => sound(t), 220);
    });
    video.addEventListener("dblclick", () => {
      clearTimeout(clickTimer);
      focus = focus === t ? null : t;
      layout();
    });
    root.querySelector(".gp-grid").append(box);
    tiles.push(t);
    if (tiles.length === 1) sound(t);
    layout();
  }

  window.GridPlayer = { add, count: () => tiles.length, MAX };

  S.css(
    "grid-player",
    `
:root{--gp-w:32vw}
.gp-root{position:fixed;top:0;right:0;bottom:0;width:var(--gp-w);z-index:2147483640;display:flex;flex-direction:column;background:#000;border-left:1px solid var(--suite-line)}
.gp-root.gp-full{left:0;width:auto;border-left:0}
html.gp-docked body{padding-right:var(--gp-w)}
html.gp-docked .navbar.fixed-top{right:var(--gp-w)}
html.gp-docked .filtered-list-toolbar{position:static!important}
.gp-root[hidden]{display:none}
.gp-resizer{position:absolute;top:0;left:-4px;bottom:0;width:8px;z-index:35;cursor:ew-resize}
.gp-root.gp-full .gp-resizer{display:none}
.gp-hot{display:none;position:absolute;top:0;left:0;right:0;height:14px;z-index:31}
.gp-bar{position:relative;z-index:30;flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:5px;min-height:36px;padding:5px 10px;background:var(--suite-panel);border-bottom:1px solid var(--suite-line);color:var(--suite-text);font-size:12.5px}
.gp-root.gp-osfs .gp-hot{display:block}
.gp-root.gp-osfs .gp-bar{position:absolute;top:0;left:0;right:0;opacity:0;pointer-events:none;transition:opacity .15s}
.gp-root.gp-osfs .gp-hot:hover+.gp-bar,.gp-root.gp-osfs .gp-bar:hover{opacity:1;pointer-events:auto}
.gp-title{font-weight:600}.gp-count{color:var(--suite-sub);font-size:12px}.gp-gap{flex:1}
.gp-btn{padding:3px 9px;border:1px solid var(--suite-line);border-radius:var(--suite-radius);background:var(--suite-raise);color:var(--suite-text);font-size:11.5px;cursor:pointer;white-space:nowrap}
.gp-btn:hover{border-color:var(--suite-accent-hi)}
.gp-btn.on{background:var(--suite-accent);border-color:var(--suite-accent);color:#fff}
.gp-btn.gp-danger:hover{border-color:#e05252;background:#5c2020;color:#fff}
.gp-grid{flex:1;display:grid;gap:2px;min-height:0}
.gp-tile{position:relative;min-width:0;min-height:0;background:#000;outline:2px solid transparent;outline-offset:-2px;overflow:hidden}
.gp-tile.gp-sound{outline-color:var(--suite-accent-hi)}
.gp-tile video{width:100%;height:100%;object-fit:contain;display:block;cursor:pointer}
.gp-root.gp-cover .gp-tile video{object-fit:cover}
.gp-head,.gp-foot{position:absolute;left:0;right:0;display:flex;align-items:center;gap:5px;padding:4px 8px;opacity:0;transition:opacity .15s;color:#fff;font-size:11.5px}
.gp-head{top:0;background:linear-gradient(180deg,#000d,transparent)}
.gp-foot{bottom:0;padding:14px 8px 6px;background:linear-gradient(0deg,#000e,#0009 70%,transparent)}
.gp-tile:hover .gp-head,.gp-tile:hover .gp-foot{opacity:1}
.gp-name{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-weight:500}
.gp-hbtn,.gp-x{width:24px;height:24px;display:inline-grid;place-items:center;padding:0;border:1px solid #fff4;border-radius:50%;background:#000a;color:#fff;cursor:pointer;line-height:1}
.gp-hbtn:hover{border-color:var(--suite-accent-hi);background:#1b3048cc}
.gp-x:hover{background:#a33;border-color:#f66}
.gp-seek{flex:1;min-width:40px;height:16px;cursor:pointer;position:relative;touch-action:none}
.gp-seek::before{content:"";position:absolute;left:0;right:0;top:5px;height:6px;background:#fff3;border-radius:3px}
.gp-knob{position:absolute;top:2px;width:12px;height:12px;margin-left:-6px;border-radius:50%;background:#fff;box-shadow:0 0 3px #000}
.gp-ctl{min-width:26px;height:24px;display:inline-flex;align-items:center;justify-content:center;padding:0 6px;border:1px solid #fff4;border-radius:var(--suite-radius);background:#000a;color:#fff;font-size:11.5px;cursor:pointer;white-space:nowrap}
.gp-ctl:hover{border-color:var(--suite-accent-hi)}
.gp-ctl.on{background:var(--suite-accent);border-color:var(--suite-accent);color:#fff}
.gp-vol{width:64px;accent-color:var(--suite-accent-hi);cursor:pointer}
.gp-fill{position:absolute;left:0;top:5px;height:6px;background:var(--suite-accent-hi);border-radius:3px}
.gp-clock{font-variant-numeric:tabular-nums;white-space:nowrap;font-size:11px}
.gp-pill{position:fixed;right:16px;bottom:16px;z-index:2147483640;padding:8px 14px;border:1px solid var(--suite-accent-hi);border-radius:var(--suite-radius);background:var(--suite-accent);color:#fff;font-size:13px;cursor:pointer;box-shadow:0 4px 16px #0008}
.gp-pill[hidden]{display:none}
`,
  );
})();

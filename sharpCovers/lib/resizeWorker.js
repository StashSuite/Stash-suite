// Sharp Covers の縮小処理（Web Worker）。画像の読み込み・高品質縮小・シャープ・JPEG 変換をすべてここで行い、
// 一覧の描画やスクロールを止めない。
// 受け取る：{id, src, width, height}（表示の箱の大きさ・画面の拡大率込み）、返す：{id, url}（data URL）/ {id, keep:true}（縮小不要）/ {id, error}
"use strict";
const MIN_RATIO = 1.4, // 元画像が必要サイズのこの倍率以下なら何もしない（縮小がゆるく、ギザギザが出にくい）
  SHARPEN = 0.3, // 縮小後のシャープの強さ（0で無し。上げすぎると輪郭が白く縁取られる）
  QUALITY = 0.93;

// 縮小でなまった輪郭を戻す軽いアンシャープ（3×3）
function sharpen(ctx, w, h, amount) {
  if (amount <= 0 || w < 3 || h < 3) return;
  const src = ctx.getImageData(0, 0, w, h),
    s = src.data,
    out = ctx.createImageData(w, h),
    d = out.data,
    c = 1 + 4 * amount;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        d[i] = s[i];
        d[i + 1] = s[i + 1];
        d[i + 2] = s[i + 2];
      } else
        for (let k = 0; k < 3; k++)
          d[i + k] = c * s[i + k] - amount * (s[i + k - 4] + s[i + k + 4] + s[i + k - w * 4] + s[i + k + w * 4]);
      d[i + 3] = 255;
    }
  ctx.putImageData(out, 0, 0);
}

async function resize({ src, width, height }) {
  const res = await fetch(src, { credentials: "same-origin" });
  if (!res.ok) throw new Error("画像を読み込めません: " + src);
  const full = await createImageBitmap(await res.blob());
  const nw = full.width,
    nh = full.height,
    scale = Math.max(width / nw, height / nh), // object-fit: cover で箱を覆う大きさ
    w = Math.max(1, Math.round(nw * scale)),
    h = Math.max(1, Math.round(nh * scale));
  if (nw < w * MIN_RATIO) {
    full.close();
    return { keep: true };
  }
  const small = await createImageBitmap(full, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" });
  full.close();
  const canvas = new OffscreenCanvas(w, h),
    ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(small, 0, 0);
  small.close();
  sharpen(ctx, w, h, SHARPEN);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: QUALITY });
  return { url: new FileReaderSync().readAsDataURL(blob) };
}

self.onmessage = async ({ data }) => {
  try {
    self.postMessage({ id: data.id, ...(await resize(data)) });
  } catch (e) {
    self.postMessage({ id: data.id, error: String(e?.message || e) });
  }
};

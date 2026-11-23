Server Store v1.0.0 — Stash Suiteの設定・記録を Stash サーバーに保存

■ 何をするか
- Stash Mini Player・Quick Genres・Tag Weighted Recommendations・Scene Card Rarity が
  ブラウザ（localStorage）に置いていた設定や記録を、Stash サーバーの設定（config.yml の plugins → serverStore）に保存します。
- どのブラウザ・PCから開いても同じ状態になり、ブラウザのデータを消しても失われません。
- 各プラグインは yml の requires でこのプラグインの後に読み込まれます（このプラグインを無効にすると、各プラグインは以前のようにブラウザだけに保存します）。

■ 移行
- 最初に開いたブラウザで、そのブラウザにだけある値がサーバーへ移ります。
  2台目以降のブラウザは、サーバーの値で上書きされます（サーバーに無い項目だけ、そのブラウザの値が移ります）。

■ 対象外（ブラウザに残る物）
（2026-11-01：顔の帯の顔の位置 quickGenres.faces は同期するようにした。約12KBと小さく、別のブラウザで顔検出（14MB）を読み直さずに済むため）
- 自作でないプラグイン（AscensionI18n・stashDiscover・libraryHub・multiView など）の保存内容。

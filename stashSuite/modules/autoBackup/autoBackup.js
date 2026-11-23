"use strict";
// Auto Backup：Stash を開いた時、前回のバックアップから7日以上たっていればデータベースのバックアップを取る。
// 前回の日時は suite.autoBackupLast に保存（Server Store 経由で Stash サーバーへ自動同期）。
(function () {
  const KEY = "suite.autoBackupLast",
    EVERY = 7 * 24 * 3600 * 1000,
    START_DELAY = 60 * 1000;
  const gql = (query, variables) =>
    fetch("/graphql", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, variables }) }).then((r) => r.json());
  const getLast = () => { try { return Number(localStorage.getItem(KEY) || 0); } catch { return 0; } };
  const setLast = (v) => { try { localStorage.setItem(KEY, String(v)); } catch {} };

  async function run() {
    const last = getLast();
    if (Date.now() - last < EVERY) return;
    setLast(Date.now());
    const r = await gql("mutation{backupDatabase(input:{download:false})}");
    if (r.errors) {
      setLast(last);
      console.warn("[Auto Backup] バックアップに失敗しました", r.errors);
    } else console.info("[Auto Backup] データベースのバックアップを取りました");
  }
  setTimeout(() => run().catch((e) => console.warn("[Auto Backup]", e)), START_DELAY);
})();

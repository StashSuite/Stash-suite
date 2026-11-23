"use strict";
// Auto Backup：Stash を開いた時、前回のバックアップから7日以上たっていればデータベースのバックアップを取る。
// 前回の日時は Stash の設定（plugins.autoBackup.last）に置くので、ブラウザや機器が変わっても重複しない。
// 古いバックアップは消さない（消すかどうかはご本人が決める）。
(function () {
  const PLUGIN = "autoBackup",
    EVERY = 7 * 24 * 3600 * 1000,
    START_DELAY = 60 * 1000; // 開いた直後の読み込みと重ならないよう1分待つ
  const gql = (query, variables) =>
    fetch("/graphql", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, variables }) }).then((r) => r.json());
  const setLast = (t) => gql('mutation($v:Map!){configurePlugin(plugin_id:"' + PLUGIN + '",input:$v)}', { v: { last: String(t) } });

  async function run() {
    const cfg = await gql('query{configuration{plugins(include:["' + PLUGIN + '"])}}');
    const last = Number(cfg?.data?.configuration?.plugins?.[PLUGIN]?.last || 0);
    if (Date.now() - last < EVERY) return;
    await setLast(Date.now()); // 先に書いて、ほかのタブが同時に取らないようにする
    const r = await gql("mutation{backupDatabase(input:{download:false})}");
    if (r.errors) {
      await setLast(last); // 失敗したら次に開いた時にもう一度
      console.warn("[Auto Backup] バックアップに失敗しました", r.errors);
    } else console.info("[Auto Backup] データベースのバックアップを取りました");
  }
  setTimeout(() => run().catch((e) => console.warn("[Auto Backup]", e)), START_DELAY);
})();

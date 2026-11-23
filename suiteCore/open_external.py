import json
import os
import subprocess
import sys
import urllib.request


def main():
    raw = sys.stdin.read()
    data = json.loads(raw) if raw.strip() else {}
    args = data.get("args") or {}
    if args.get("mode") != "open_external":
        print(json.dumps({"output": "ignored"}))
        return
    scene_id = str(args.get("id") or "").strip()
    if not scene_id.isdigit():
        print(json.dumps({"error": "invalid scene id"}))
        return
    conn = data.get("server_connection") or {}
    host = conn.get("Host") or "localhost"
    if host in ("0.0.0.0", "::", ""):
        host = "localhost"
    url = f"{conn.get('Scheme') or 'http'}://{host}:{conn.get('Port') or 9999}/graphql"
    q = {"query": "query($id:ID!){findScene(id:$id){files{path}}}", "variables": {"id": scene_id}}
    req = urllib.request.Request(url, json.dumps(q).encode("utf-8"), {"Content-Type": "application/json"})
    c = conn.get("SessionCookie") or {}
    if c.get("Name"):
        req.add_header("Cookie", f"{c['Name']}={c.get('Value', '')}")
    res = json.loads(urllib.request.urlopen(req, timeout=15).read())
    files = ((res.get("data") or {}).get("findScene") or {}).get("files") or []
    path = files[0].get("path") if files else None
    if not path or not os.path.isfile(path):
        print(json.dumps({"error": "file not found"}))
        return
    if os.name == "nt":
        os.startfile(path)
    elif sys.platform == "darwin":
        subprocess.Popen(["open", path], start_new_session=True, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        subprocess.Popen(["xdg-open", path], start_new_session=True, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(json.dumps({"output": "ok"}))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"error": str(e)}))

#!/usr/bin/env python3
"""Pixel Pet server — 127.0.0.1:4304. Serves live page + /api/data."""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", 4304))


def rd(rel):
    with open(os.path.join(HERE, rel), encoding="utf-8") as f:
        return f.read()


def load_payload():
    pets_path = os.path.join(HERE, "data", "pets.json")
    items_path = os.path.join(HERE, "data", "items.json")
    pets = json.load(open(pets_path, encoding="utf-8")) if os.path.isfile(pets_path) else {}
    items = json.load(open(items_path, encoding="utf-8")) if os.path.isfile(items_path) else {}
    return {
        "version": pets.get("version", 1),
        "label": pets.get("label", "EXAMPLE"),
        "pets": pets.get("pets", []),
        "hats": pets.get("hats", []),
        "xpPerLevel": pets.get("xpPerLevel", []),
        "items": items,
        "foods": items.get("foods", []),
    }


def page():
    payload = load_payload()
    data_js = json.dumps(payload, ensure_ascii=False)
    html = rd("web/index.html")
    html = html.replace("/*__CSS__*/", rd("web/app.css"))
    html = html.replace("/*__DATA__*/ null /*__/DATA__*/", data_js)
    html = html.replace(
        "/*__APP__*/", rd("web/app.js").replace("</script", "<\\/script")
    )
    return html


class H(BaseHTTPRequestHandler):
    def send(self, code, body, ctype):
        b = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        path = self.path.split("?")[0]
        try:
            if path in ("/", "/index.html", "/pixel-pet.html"):
                self.send(200, page(), "text/html; charset=utf-8")
            elif path == "/api/data":
                self.send(
                    200,
                    json.dumps(load_payload()),
                    "application/json",
                )
            elif path == "/health":
                self.send(
                    200,
                    json.dumps({"ok": True, "port": PORT, "app": "pixel-pet"}),
                    "application/json",
                )
            else:
                self.send(404, "not found", "text/plain")
        except Exception as ex:
            self.send(500, f"error: {ex}", "text/plain")

    def log_message(self, fmt, *args):
        print(f"[pixel-pet] {args[0]}")


if __name__ == "__main__":
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    print(f"Pixel Pet http://127.0.0.1:{PORT}/")
    httpd.serve_forever()

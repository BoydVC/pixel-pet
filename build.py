#!/usr/bin/env python3
"""Inline web/ + data/*.json into one offline file: dist/pixel-pet.html."""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def rd(rel):
    with open(os.path.join(HERE, rel), encoding="utf-8") as f:
        return f.read()


def main():
    pets_path = os.path.join(HERE, "data", "pets.json")
    items_path = os.path.join(HERE, "data", "items.json")
    with open(pets_path, encoding="utf-8") as f:
        pets = json.load(f)
    with open(items_path, encoding="utf-8") as f:
        items = json.load(f)
    payload = {
        "version": pets.get("version", 1),
        "label": pets.get("label", "EXAMPLE"),
        "pets": pets.get("pets", []),
        "hats": pets.get("hats", []),
        "xpPerLevel": pets.get("xpPerLevel", []),
        "items": items,
        "foods": items.get("foods", []),
    }
    data_js = json.dumps(payload, ensure_ascii=False)
    html = rd("web/index.html")
    html = html.replace("/*__CSS__*/", rd("web/app.css"))
    html = html.replace("/*__DATA__*/ null /*__/DATA__*/", data_js)
    app = rd("web/app.js").replace("</script", "<\\/script")
    html = html.replace("/*__APP__*/", app)
    os.makedirs(os.path.join(HERE, "dist"), exist_ok=True)
    out = os.path.join(HERE, "dist", "pixel-pet.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print(
        f"built {out} ({os.path.getsize(out):,} bytes) · "
        f"pets={len(payload['pets'])} hats={len(payload['hats'])}"
    )


if __name__ == "__main__":
    main()

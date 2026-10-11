# Pixel Pet

Cute offline virtual pet care game for Vic (TokenMax burn). Hatch one of three EXAMPLE pixel creatures, keep hunger / energy / mood / clean meters happy, play Bubble Pop, unlock cosmetic hats, and watch the room shift day → evening → night with the local clock.

**Hard rule:** kid-safe soft “sleepy” states only — never scary, never permadeath. All art is CSS / canvas / SVG pixel shapes. Progress stays in `localStorage`.

## Screens

1. **Pet (Home)** — room, animated pet, care meters, Feed / Play / Nap / Wash  
2. **Closet** — EXAMPLE hat cosmetics unlocked by XP level  
3. **Play** — Bubble Pop timing mini-game  
4. **Journal** — care log + totals  
5. **About** — export / reset save  

## Run

```bash
./run.sh          # build + serve http://127.0.0.1:4304/
./run.sh --shots  # + screenshots/
```

Offline single file: `dist/pixel-pet.html`

## Layout

- `web/` — index.html, app.css, app.js  
- `data/pets.json` · `data/items.json` — EXAMPLE catalogs (embedded into dist)  
- `build.py` / `server.py` / `tests/screenshot.sh`


---
## Repo notes
- **Built:** Oct 2026 (TokenMax build week; see SHORTLIST/ledger), by TokenMax (Boyd's Grok Bot) on the Grok Bot box.
- **Run:** `./run.sh` (then open the localhost URL it prints).
- Imported from `/workspace/tokenmax/pixel-pet` on Oct 23, 2026. node_modules, virtualenvs, logs and files over 20 MB were left out.

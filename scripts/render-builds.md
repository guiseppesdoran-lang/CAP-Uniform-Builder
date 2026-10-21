# render-builds

Headless renders of the SVG uniform engine. Needs Chrome at the macOS default path (or set `CHROME=`); no npm packages.

- `node scripts/render-builds.cjs --all --out DIR [--ppi 40]` renders the standard matrix: every uniform in RULES x male/female x C/SSgt, C/Maj, SMSgt, Capt, Col (combinations a uniform is not offered to are skipped and listed in `summary.json`). Each has 7 ribbons (one with devices), 2 badges, a cord for cadets where allowed, and the name shown.
- `node scripts/render-builds.cjs builds.json --out DIR` renders `[{"name":"x","build":{uniform,gender,membership,rank,opt,ribbonSel:[[id,value]],badgeIds,medalSel,name,command,cord,patches,militaryBadges}}]`. Options: `--only REGEX` (filter names), `--pad 0.4` (inches around the scene), `--jobs 4` (Chrome tabs).
- Output in DIR: `<name>.png` (scene bounds plus pad at `--ppi` px per inch), `<name>.scene.json`, `index.html` (contact sheet, red = "No artwork for"), `summary.json` (notes, missing artwork, timing, failures). `RB_DEBUG=1` prints progress.
- Reading `<name>.scene.json`: all lengths are inches on the garment, x to the right and y down from the garment's top-left, so a layer at x=11.5, y=10.8, w=0.8, h=0.3 spans that box. `layers[]` are the engine's pieces (`key`, `role`, `id`, `x`, `y`, `w`, `h`, `rotate`, `z`; larger `z` draws on top); `bounds` is the scene box and `viewBox` is the PNG frame (bounds plus pad), so pixel = (inch - viewBox origin) x ppi. `notes` are the engine's messages (the same ones that appear in the UI).
- The scene is composed in node (as tests/engine.test.cjs does) and again in the page; a layer-count mismatch is reported in `warnings`.

from pathlib import Path
import re
toast = Path("C:/Users/Kekko/Desktop/ralgrum-browser-integration/extension/content/toast.js")
lines = toast.read_text(encoding="utf-8").splitlines(keepends=True)
lines = [ln for ln in lines if not ln.startswith("  var DEEZER_PATH") and not ln.startswith("  var SOUNDCLOUD_PATH") and not ln.startswith("  var XMARK_PATH") and not ln.startswith("  var MUSIC_PATH")]
def path_of(svg_file):
    text = Path(svg_file).read_text(encoding="utf-8")
    m = re.search(r'd="([^"]+)"', text)
    return m.group(1)
SPACE = chr(32)
def chunks(data, width):
    parts = data.split(SPACE)
    out = []
    cur = ""
    for tok in parts:
        add = (SPACE if cur else "") + tok
        if len(cur) + len(add) > width:
            out.append(cur)
            cur = tok
        else:
            cur = cur + add
    if cur:
        out.append(cur)
    return out
NL = chr(10)
def assignment(name, data):
    lines = chunks(data, 160)
    head = "  var " + name + " = "
    body = (NL + "    + ").join("'" + c + "'" for c in lines) + ";"
    return head + body + NL
REF = "C:/Users/Kekko/Desktop/ralgrum-refactor/assets/icons/fontawesome-free-7.3.1"
block = ""
block += assignment("DEEZER_PATH", path_of(REF + "/brands/deezer.svg"))
block += assignment("SOUNDCLOUD_PATH", path_of(REF + "/brands/soundcloud.svg"))
block += assignment("XMARK_PATH", path_of(REF + "/solid/xmark.svg"))
block += assignment("MUSIC_PATH", path_of(REF + "/solid/music.svg"))
joined = "".join(lines)
anchor = "  var SHOWN = {};" + NL
joined = joined.replace(anchor, anchor + block, 1)
toast.write_text(joined, encoding="utf-8")
print("injected ok")

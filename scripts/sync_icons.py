from PIL import Image
import base64
from pathlib import Path
root = Path("C:/Users/Kekko/Desktop/ralgrum-browser-integration/extension/icons")
app_icon = Image.open("C:/Users/Kekko/Desktop/ralgrum-refactor/assets/app-icon.png")
print("source:", app_icon.size, app_icon.mode)
for size in (16, 32, 48, 128):
    small = app_icon.resize((size, size), Image.LANCZOS)
    small.save(root / ("icon" + str(size) + ".png"))
    print("wrote icon" + str(size) + ".png")
raw = (root / "icon128.png").read_bytes()
b64 = base64.b64encode(raw).decode("ascii")
svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">'
svg += '<image width="128" height="128" href="data:image/png;base64,' + b64 + '"/>'
svg += "</svg>" + chr(10)
(root / "icon.svg").write_text(svg, encoding="utf-8")
print("wrote icon.svg from real artwork")

from pathlib import Path
import re
toast = Path("C:/Users/Kekko/Desktop/ralgrum-browser-integration/extension/content/toast.js").read_text(encoding="utf-8")
line = [ln for ln in toast.splitlines() if "return /^https" in ln][0]
print("isWebUrl line:", line.strip())
REF = "C:/Users/Kekko/Desktop/ralgrum-refactor/assets/icons/fontawesome-free-7.3.1"
for name, src in (("DEEZER_PATH", REF + "/brands/deezer.svg"), ("SOUNDCLOUD_PATH", REF + "/brands/soundcloud.svg"), ("XMARK_PATH", REF + "/solid/xmark.svg"), ("MUSIC_PATH", REF + "/solid/music.svg")):
    disk = re.search(r'd="([^"]+)"', Path(src).read_text(encoding="utf-8")).group(1)
    m = re.search(r"var " + name + r" = (.*?);", toast, re.S)
    injected = m.group(1).replace(" ", "").replace(chr(10), "").replace("+", "").replace("'", "")
    disk_flat = disk.replace(" ", "")
    print(name, "disk:", len(disk), "injected:", len(injected), "match:", injected == disk_flat)

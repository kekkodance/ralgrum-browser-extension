from PIL import Image, ImageDraw
import os
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, "..", "extension", "icons")
os.makedirs(out, exist_ok=True)
for size in (16, 32, 48, 128):
    img = Image.new("RGBA", (size, size), (18, 18, 21, 255))
    dr = ImageDraw.Draw(img)
    rr = max(2, size // 4)
    dr.ellipse([size // 2 - rr, size // 4 - rr // 2, size // 2 + rr, size // 4 + rr + rr // 2], fill=(99, 102, 241, 255))
    dr.rectangle([size // 2 + rr // 3, size // 5, size // 2 + rr, size * 3 // 4], fill=(250, 250, 250, 255))
    dr.rectangle([size // 4, size * 3 // 4, size * 3 // 4, size * 3 // 4 + max(1, size // 12)], fill=(255, 85, 0, 255))
    target = os.path.join(out, "icon%d.png" % size)
    img.save(target)
    print("wrote", target)

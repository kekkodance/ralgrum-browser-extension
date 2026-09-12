import argparse
import base64
from pathlib import Path

CHECKOUT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = CHECKOUT_ROOT.parent / "ralgrum-refactor" / "assets" / "app-icon.png"
DEFAULT_OUTPUT_DIR = CHECKOUT_ROOT / "extension" / "icons"


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Resize the desktop app artwork for the browser extension."
    )
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    args = parser.parse_args(argv)

    # Importing the helper should neither require Pillow nor regenerate assets.
    from PIL import Image

    with Image.open(args.source) as app_icon:
        print("source:", app_icon.size, app_icon.mode)
        args.output_dir.mkdir(parents=True, exist_ok=True)
        for size in (16, 32, 48, 128):
            with app_icon.resize((size, size), Image.Resampling.LANCZOS) as small:
                small.save(args.output_dir / ("icon" + str(size) + ".png"))
            print("wrote icon" + str(size) + ".png")
    raw = (args.output_dir / "icon128.png").read_bytes()
    b64 = base64.b64encode(raw).decode("ascii")
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">'
    svg += '<image width="128" height="128" href="data:image/png;base64,' + b64 + '"/>'
    svg += "</svg>\n"
    (args.output_dir / "icon.svg").write_text(svg, encoding="utf-8")
    print("wrote icon.svg from real artwork")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

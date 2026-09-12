import argparse
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

from inject_paths import (
    DEFAULT_SOURCE_DIR,
    DEFAULT_TOAST,
    PATH_SOURCES,
    injected_paths,
    path_of,
)


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Verify the exact SVG path data embedded in toast.js."
    )
    parser.add_argument("--toast", type=Path, default=DEFAULT_TOAST)
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE_DIR)
    args = parser.parse_args(argv)
    try:
        injected = injected_paths(args.toast.read_bytes().decode("utf-8"))
        matches = True
        for name, relative in PATH_SOURCES.items():
            disk = path_of(args.source_dir / relative)
            value = injected.get(name)
            match = value == disk
            print(
                name,
                "disk:",
                len(disk),
                "injected:",
                len(value) if value is not None else "missing",
                "match:",
                match,
            )
            matches = matches and match
        return 0 if matches else 1
    except (OSError, ValueError, ET.ParseError) as error:
        print(f"verify_paths: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

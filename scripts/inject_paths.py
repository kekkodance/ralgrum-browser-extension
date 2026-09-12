import argparse
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

CHECKOUT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TOAST = CHECKOUT_ROOT / "extension" / "content" / "toast.js"
DEFAULT_SOURCE_DIR = (
    CHECKOUT_ROOT.parent
    / "ralgrum-refactor"
    / "assets"
    / "icons"
    / "fontawesome-free-7.3.1"
)
PATH_SOURCES = {
    "DEEZER_PATH": "brands/deezer.svg",
    "SOUNDCLOUD_PATH": "brands/soundcloud.svg",
    "XMARK_PATH": "solid/xmark.svg",
    "MUSIC_PATH": "solid/music.svg",
}
STRING_LITERAL = re.compile(
    r"'(?:(?:[^'\\\r\n])|(?:\\[\s\S]))*'|\"(?:(?:[^\"\\\r\n])|(?:\\[\s\S]))*\""
)
STRING_EXPRESSION = (
    r"(?:"
    + STRING_LITERAL.pattern
    + r")(?:\s*\+\s*(?:"
    + STRING_LITERAL.pattern
    + r"))*"
)
PATH_DECLARATION = re.compile(
    r"(?m)^(?P<indent>[ \t]*)(?:var|let|const)[ \t]+"
    r"(?P<name>" + "|".join(PATH_SOURCES) + r")\b\s*=\s*"
    r"(?P<expression>(?:" + STRING_EXPRESSION + r"))\s*;"
)
PATH_START = re.compile(
    r"(?m)^[ \t]*(?:var|let|const)[ \t]+(?P<name>" + "|".join(PATH_SOURCES) + r")\b"
)


def path_of(svg_file):
    for element in ET.parse(svg_file).getroot().iter():
        if element.tag.rsplit("}", 1)[-1] == "path" and "d" in element.attrib:
            return element.attrib["d"]
    raise ValueError(f"No SVG path data in {svg_file}")


def chunks(data, width):
    if width <= 0:
        raise ValueError("Chunk width must be positive")
    # Splitting inside a token is safe: concatenation must restore every byte,
    # including the whitespace between two unsigned coordinates.
    return [data[start : start + width] for start in range(0, len(data), width)] or [""]


def assignment(name, data, newline="\n", indent="  "):
    body = (newline + indent + "  + ").join(
        json.dumps(part) for part in chunks(data, 160)
    )
    return indent + "var " + name + " = " + body + ";" + newline


def string_value(expression):
    """Decode concatenated JavaScript strings, not their whitespace-free source."""
    if not re.fullmatch(r"(?:" + STRING_EXPRESSION + r")", expression):
        raise ValueError("Expected a concatenation of JavaScript string literals")
    result = []
    escapes = {
        "b": "\b",
        "f": "\f",
        "n": "\n",
        "r": "\r",
        "t": "\t",
        "v": "\v",
        "0": "\0",
    }
    for match in STRING_LITERAL.finditer(expression):
        text = match.group()[1:-1]
        index = 0
        while index < len(text):
            character = text[index]
            index += 1
            if character != "\\":
                result.append(character)
                continue
            escape = text[index]
            index += 1
            if escape in "\r\n\u2028\u2029":
                if escape == "\r" and text[index : index + 1] == "\n":
                    index += 1
                continue
            if escape in ("u", "x"):
                if escape == "u" and text[index : index + 1] == "{":
                    end = text.find("}", index + 1)
                    digits = text[index + 1 : end] if end >= 0 else ""
                    index = end + 1
                else:
                    end = index + (4 if escape == "u" else 2)
                    digits = text[index:end]
                    if len(digits) != end - index:
                        raise ValueError("Incomplete JavaScript escape")
                    index = end
                if not re.fullmatch(r"[0-9a-fA-F]+", digits):
                    raise ValueError("Invalid JavaScript escape")
                result.append(chr(int(digits, 16)))
            elif escape in "123456789" or (
                escape == "0" and text[index : index + 1].isdigit()
            ):
                raise ValueError(
                    "Legacy octal escapes are not supported in SVG path strings"
                )
            else:
                result.append(escapes.get(escape, escape))
    # JSON-generated astral characters use UTF-16 surrogate pairs in JavaScript.
    return (
        "".join(result)
        .encode("utf-16-le", "surrogatepass")
        .decode("utf-16-le", "surrogatepass")
    )


def path_declarations(source):
    declarations = {}
    for match in PATH_DECLARATION.finditer(source):
        name = match.group("name")
        if name in declarations:
            raise ValueError(f"Duplicate declaration for {name}")
        declarations[name] = match
    for start in PATH_START.finditer(source):
        match = declarations.get(start.group("name"))
        if match is None or match.start() != start.start():
            raise ValueError(f"Unsupported initializer for {start.group('name')}")
    return declarations


def injected_paths(source):
    return {
        name: string_value(match.group("expression"))
        for name, match in path_declarations(source).items()
    }


def inject(source, paths):
    declarations = path_declarations(source)
    newline = "\r\n" if "\r\n" in source else "\n"
    replacements = []
    for name, match in declarations.items():
        replacement = assignment(name, paths[name], newline, match.group("indent"))
        replacements.append((match.start(), match.end(), replacement[: -len(newline)]))
    missing = [name for name in PATH_SOURCES if name not in declarations]
    if missing:
        anchor = re.search(
            r"(?m)^(?P<indent>[ \t]*)var[ \t]+SHOWN\s*=\s*\{\s*\};[^\r\n]*(?:\r?\n|$)",
            source,
        )
        if anchor is None:
            raise ValueError("Cannot locate SHOWN declaration for missing SVG paths")
        block = "" if anchor.group().endswith("\n") else newline
        block += "".join(
            assignment(name, paths[name], newline, anchor.group("indent"))
            for name in missing
        )
        replacements.append((anchor.end(), anchor.end(), block))
    # Replace complete declarations in place, preserving all unrelated code,
    # comments and line endings rather than dropping just their first lines.
    for start, end, replacement in sorted(replacements, reverse=True):
        source = source[:start] + replacement + source[end:]
    return source


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Update toast SVG paths from Font Awesome source icons."
    )
    parser.add_argument("--toast", type=Path, default=DEFAULT_TOAST)
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE_DIR)
    args = parser.parse_args(argv)
    try:
        paths = {
            name: path_of(args.source_dir / relative)
            for name, relative in PATH_SOURCES.items()
        }
        source = args.toast.read_bytes().decode("utf-8")
        updated = inject(source, paths).encode("utf-8")
        args.toast.write_bytes(updated)
    except (OSError, ValueError, ET.ParseError) as error:
        parser.exit(1, f"inject_paths: {error}\n")
    print(f"Injected SVG paths into {args.toast}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

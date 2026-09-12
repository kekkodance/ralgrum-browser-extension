import base64
import importlib.util
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tempfile
import unittest
import zlib

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
SCRIPT_NAMES = ("inject_paths.py", "verify_paths.py", "sync_icons.py")
PATH_SOURCES = {
    "DEEZER_PATH": "brands/deezer.svg",
    "SOUNDCLOUD_PATH": "brands/soundcloud.svg",
    "XMARK_PATH": "solid/xmark.svg",
    "MUSIC_PATH": "solid/music.svg",
}


class AssetScriptsTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.checkout = self.root / "disposable checkout"
        self.scripts = self.checkout / "scripts"
        self.scripts.mkdir(parents=True)
        for name in SCRIPT_NAMES:
            shutil.copyfile(SCRIPTS / name, self.scripts / name)
        self.toast = self.checkout / "extension" / "content" / "toast.js"
        self.toast.parent.mkdir(parents=True)
        self.sources = (
            self.root
            / "ralgrum-refactor"
            / "assets"
            / "icons"
            / "fontawesome-free-7.3.1"
        )
        self.cwd = self.root / "unrelated working directory"
        self.cwd.mkdir()
        self.guard = self.cwd / "extension" / "content" / "toast.js"
        self.guard.parent.mkdir(parents=True)
        self.guard.write_bytes(b"unrelated checkout must remain untouched\r\n")
        spec = importlib.util.spec_from_file_location(
            "asset_inject_fixture", self.scripts / "inject_paths.py"
        )
        self.injector = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.injector)

    def run_script(self, name, *args):
        return subprocess.run(
            [sys.executable, "-B", str(self.scripts / name), *map(str, args)],
            cwd=self.cwd,
            capture_output=True,
            text=True,
            check=False,
        )

    def write_sources(self, data, root=None):
        root = root or self.sources
        for relative in PATH_SOURCES.values():
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(
                '<svg xmlns="http://www.w3.org/2000/svg"><path id="artwork" d="'
                + data
                + '"/></svg>',
                encoding="utf-8",
            )

    def test_width_160_preserves_coordinate_separators(self):
        data = "M0 0 L" + "1 2 " * 40
        expression = self.injector.assignment("DEEZER_PATH", data)
        self.assertEqual(
            self.injector.injected_paths(expression), {"DEEZER_PATH": data}
        )
        self.assertEqual("".join(self.injector.chunks(data, 160)), data)

    def test_multiline_replacement_is_lossless_and_idempotent_from_another_cwd(self):
        data = "M0 0 L" + "1 2 " * 40
        self.write_sources(data)
        prefix = '(function () {\r\n  var SHOWN = {};\r\n  const unrelated = "keep; this";\r\n'
        suffix = '  function untouched() { return "same code"; }\r\n})();\r\n'
        old_paths = "".join(
            "  var " + name + " = 'M999 9'\r\n    + ' 999 9'; // keep " + name + "\r\n"
            for name in PATH_SOURCES
        )
        self.toast.write_bytes((prefix + old_paths + suffix).encode("utf-8"))
        first = self.run_script("inject_paths.py")
        self.assertEqual(first.returncode, 0, first.stderr)
        result = self.toast.read_bytes()
        text = result.decode("utf-8")
        self.assertTrue(text.startswith(prefix))
        self.assertTrue(text.endswith(suffix))
        self.assertNotIn("999 9", text)
        for name in PATH_SOURCES:
            self.assertEqual(text.count("var " + name + " ="), 1)
            self.assertIn("; // keep " + name + "\r\n", text)
        self.assertEqual(
            self.injector.injected_paths(text), {name: data for name in PATH_SOURCES}
        )
        self.assertNotIn(b"\n", result.replace(b"\r\n", b""))
        second = self.run_script("inject_paths.py")
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertEqual(self.toast.read_bytes(), result)
        self.assertEqual(
            self.guard.read_bytes(), b"unrelated checkout must remain untouched\r\n"
        )
        verified = self.run_script("verify_paths.py")
        self.assertEqual(verified.returncode, 0, verified.stdout + verified.stderr)

    def test_explicit_paths_override_checkout_defaults(self):
        self.toast.write_bytes(b"default destination must remain untouched")
        alternate = self.cwd / "alternate.js"
        alternate.write_text("  var SHOWN = {};\n", encoding="utf-8")
        source_dir = self.cwd / "source icons"
        self.write_sources("M1 20", source_dir)
        injected = self.run_script(
            "inject_paths.py", "--toast", alternate, "--source-dir", source_dir
        )
        self.assertEqual(injected.returncode, 0, injected.stderr)
        self.assertEqual(
            self.injector.injected_paths(alternate.read_text(encoding="utf-8")),
            {name: "M1 20" for name in PATH_SOURCES},
        )
        self.assertEqual(
            self.toast.read_bytes(), b"default destination must remain untouched"
        )
        verified = self.run_script(
            "verify_paths.py", "--toast", alternate, "--source-dir", source_dir
        )
        self.assertEqual(verified.returncode, 0, verified.stdout + verified.stderr)

    def test_verifier_rejects_merged_coordinates(self):
        self.write_sources("M1 20")
        self.toast.write_text(
            "".join(
                "  var " + name + " = 'M12'\n    + ' 0';\n" for name in PATH_SOURCES
            ),
            encoding="utf-8",
        )
        result = self.run_script("verify_paths.py")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.toast.write_text(
            "".join(
                "  var " + name + " = 'M1'\n    + \"\\x20\\u00320\";\n"
                for name in PATH_SOURCES
            ),
            encoding="utf-8",
        )
        corrected = self.run_script("verify_paths.py")
        self.assertEqual(corrected.returncode, 0, corrected.stdout + corrected.stderr)

    def test_unsupported_initializer_fails_without_modifying_toast(self):
        self.write_sources("M1 20")
        original = b"  var SHOWN = {};\n  var DEEZER_PATH = computePath();\n"
        self.toast.write_bytes(original)
        result = self.run_script("inject_paths.py")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.toast.read_bytes(), original)

    def test_importing_helpers_neither_reads_assets_nor_writes_outputs(self):
        before = {
            path.relative_to(self.root): path.read_bytes()
            for path in self.root.rglob("*")
            if path.is_file()
        }
        result = subprocess.run(
            [
                sys.executable,
                "-B",
                "-c",
                "import sys; sys.path.insert(0, sys.argv[1]); sys.modules['PIL'] = None; import inject_paths, verify_paths, sync_icons",
                str(self.scripts),
            ],
            cwd=self.cwd,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        after = {
            path.relative_to(self.root): path.read_bytes()
            for path in self.root.rglob("*")
            if path.is_file()
        }
        self.assertEqual(after, before)

    def test_icon_sync_only_writes_invoked_checkout_or_explicit_directory(self):
        try:
            from PIL import Image
        except ImportError:
            self.skipTest("Pillow is required to exercise the icon resizing helper")

        def png_chunk(kind, payload):
            return (
                struct.pack(">I", len(payload))
                + kind
                + payload
                + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)
            )

        source = self.root / "ralgrum-refactor" / "assets" / "app-icon.png"
        source.parent.mkdir(parents=True)
        source.write_bytes(
            b"\x89PNG\r\n\x1a\n"
            + png_chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0))
            + png_chunk(b"IDAT", zlib.compress(b"\x00\x19\x32\x4b\xff"))
            + png_chunk(b"IEND", b"")
        )
        default_output = self.checkout / "extension" / "icons"
        first = self.run_script("sync_icons.py")
        self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
        for size in (16, 32, 48, 128):
            with Image.open(default_output / f"icon{size}.png") as image:
                self.assertEqual(image.size, (size, size))
                self.assertEqual(
                    image.convert("RGBA").getpixel((0, 0)), (25, 50, 75, 255)
                )
        svg = (default_output / "icon.svg").read_text(encoding="utf-8")
        embedded = svg.split("base64,", 1)[1].split('"', 1)[0]
        self.assertEqual(
            base64.b64decode(embedded), (default_output / "icon128.png").read_bytes()
        )
        original_outputs = {
            path.name: path.read_bytes() for path in default_output.iterdir()
        }
        alternate_source = self.cwd / "explicit-source.png"
        shutil.copyfile(source, alternate_source)
        source.unlink()
        alternate_output = self.cwd / "explicit icons"
        second = self.run_script(
            "sync_icons.py",
            "--source",
            alternate_source,
            "--output-dir",
            alternate_output,
        )
        self.assertEqual(second.returncode, 0, second.stdout + second.stderr)
        self.assertEqual(
            {path.name: path.read_bytes() for path in alternate_output.iterdir()},
            original_outputs,
        )
        self.assertEqual(
            {path.name: path.read_bytes() for path in default_output.iterdir()},
            original_outputs,
        )
        self.assertEqual(
            self.guard.read_bytes(), b"unrelated checkout must remain untouched\r\n"
        )


if __name__ == "__main__":
    unittest.main()

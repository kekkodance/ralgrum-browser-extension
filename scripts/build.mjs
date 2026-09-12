// Zero dependency build: emits dist/chrome and dist/firefox from extension/ (v2).
// Usage: node scripts/build.mjs
import {
  cpSync,
  copyFileSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "extension");
const dist = join(root, "dist");
function emit(variant, manifestName) {
  const out = join(dist, variant);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(src, out, {
    recursive: true,
    filter: (p) => {
      const base = p.split(/[\\/]/).pop();
      if (base.startsWith("_")) {
        return false;
      }
      return (
        !p.endsWith("manifest.json") && !p.endsWith("manifest.firefox.json")
      );
    },
  });
  copyFileSync(join(src, manifestName), join(out, "manifest.json"));
  const note =
    "Built from extension/ on " +
    new Date().toISOString() +
    " for " +
    variant +
    ".\n";
  writeFileSync(join(out, "BUILD.txt"), note);
  console.log("built " + out);
}
mkdirSync(dist, { recursive: true });
emit("chrome", "manifest.json");
emit("firefox", "manifest.firefox.json");
console.log("done. Zip dist/chrome and dist/firefox for store uploads.");

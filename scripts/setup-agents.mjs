// Links each agent's skills folder to the shared `.agents/skills`.
// Usage: node scripts/setup-agents.mjs [provider...]  (default: all)
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, ".agents", "skills");

const providers = {
  claude: ".claude/skills",
  codex: ".codex/skills",
  gemini: ".gemini/skills",
  cursor: ".cursor/skills",
  opencode: ".opencode/skills",
};

const requested = process.argv.slice(2);
const names = requested.length ? requested : Object.keys(providers);

for (const name of names) {
  const rel = providers[name];
  if (!rel) {
    console.error(
      `unknown provider: ${name} (${Object.keys(providers).join(", ")})`,
    );
    process.exitCode = 1;
    continue;
  }

  const link = path.join(root, rel);
  const target = path.relative(path.dirname(link), source);
  const stat = fs.lstatSync(link, { throwIfNoEntry: false });

  if (stat?.isSymbolicLink()) {
    if (path.resolve(path.dirname(link), fs.readlinkSync(link)) === source)
      continue;
    fs.unlinkSync(link);
  } else if (stat?.isDirectory() && fs.readdirSync(link).length === 0) {
    fs.rmdirSync(link);
  } else if (stat) {
    console.warn(`skip ${rel}: exists and is not a symlink; move it and rerun`);
    continue;
  }

  fs.mkdirSync(path.dirname(link), { recursive: true });
  // Junctions need no admin rights on Windows and take an absolute target.
  if (process.platform === "win32") fs.symlinkSync(source, link, "junction");
  else fs.symlinkSync(target, link, "dir");
  console.log(`linked ${rel} -> ${path.relative(root, source)}`);
}

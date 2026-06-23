import { existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

if (!existsSync(".git")) {
  process.exit(0);
}

const huskyBin = join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "husky.cmd" : "husky",
);

execFileSync(huskyBin, {
  shell: process.platform === "win32",
  stdio: "inherit",
});

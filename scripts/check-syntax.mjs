import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const sourceDir = "src";
const sourceFiles = (await readdir(sourceDir))
  .filter((file) => file.endsWith(".js"))
  .sort();

if (sourceFiles.length === 0) {
  console.error("No JavaScript source files found in src/");
  process.exit(1);
}

for (const file of sourceFiles) {
  const sourcePath = join(sourceDir, file);
  const result = spawnSync(process.execPath, ["--check", sourcePath], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Syntax check passed for ${sourceFiles.length} source files.`);

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const run = (command, args) => {
    const result = spawnSync(command, args, { cwd: root, stdio: "inherit", windowsHide: true });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
};
if (process.platform !== "win32") throw new Error("The service installer distribution is built on Windows.");
run("cargo", ["build", "--manifest-path", "src-tauri/Cargo.toml", "--bin", "mgo-folder-protection", "--features", "folder-protection-service", "--release"]);
run(process.execPath, [path.join(root, "node_modules/@tauri-apps/cli/tauri.js"), "build", ...process.argv.slice(2)]);

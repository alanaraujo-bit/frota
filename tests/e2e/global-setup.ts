import { execFileSync } from "node:child_process";
import { E2E_DB } from "../../playwright.config";

export default function globalSetup() {
  execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "tests/e2e/setup-db.ts", E2E_DB], { stdio: "inherit" });
}

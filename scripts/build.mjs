import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const distRoot = resolve(projectRoot, "dist");
if (dirname(distRoot) !== projectRoot || basename(distRoot) !== "dist") {
  throw new Error("Unexpected build output path");
}

const [html, client, worker] = await Promise.all([
  readFile(resolve(projectRoot, "worker/page.html"), "utf8"),
  readFile(resolve(projectRoot, "worker/shared-client.js"), "utf8"),
  readFile(resolve(projectRoot, "worker/index.js"), "utf8"),
]);
if (!html.includes("</body>") || !worker.includes('import page from "./page.js";')) {
  throw new Error("Cookbook source is incomplete");
}

await rm(distRoot, { recursive: true, force: true });
await mkdir(resolve(distRoot, "server"), { recursive: true });
await mkdir(resolve(distRoot, ".openai"), { recursive: true });
const bundledPage = html.replace("</body>", `<script>${client}</script></body>`);
const bundledWorker = worker.replace('import page from "./page.js";', `const page = ${JSON.stringify(bundledPage)};`);
await writeFile(resolve(distRoot, "server/index.js"), bundledWorker);
await cp(resolve(projectRoot, ".openai/hosting.json"), resolve(distRoot, ".openai/hosting.json"));
await cp(resolve(projectRoot, "drizzle"), resolve(distRoot, "drizzle"), { recursive: true });
console.log(`Built ${distRoot}`);

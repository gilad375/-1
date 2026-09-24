import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
let html = await readFile(resolve(root, "worker/page.html"), "utf8");
const client = await readFile(resolve(root, "worker/shared-client.js"), "utf8");
html = html.replace("</body>", `<script>${client}</script></body>`);
const worker = await readFile(resolve(root, "worker/index.js"), "utf8");
const bundled = worker.replace('import page from "./page.js";', `const page = ${JSON.stringify(html)};`);
await writeFile(resolve(root, "dist/server/index.js"), bundled);

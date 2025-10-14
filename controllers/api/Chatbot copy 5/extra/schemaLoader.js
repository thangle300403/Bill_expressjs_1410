import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function loadSchema() {
    return await readFile(join(__dirname, "schema.txt"), "utf-8");
}

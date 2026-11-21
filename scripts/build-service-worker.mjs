import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('dist');
const template = await readFile(new URL('./service-worker.js', import.meta.url), 'utf8');
const entries = await readdir(output, { recursive: true, withFileTypes: true });
const files = entries
  .filter((entry) => entry.isFile() && entry.name !== 'sw.js')
  .map((entry) => resolve(entry.parentPath, entry.name).slice(output.length + 1))
  .sort();
const version = createHash('sha256').update(template);
for (const path of files) {
  version.update(path).update(await readFile(resolve(output, path)));
}

await writeFile(resolve(output, 'sw.js'), template
  .replace("'__FIT30_VERSION__'", JSON.stringify(version.digest('hex').slice(0, 16)))
  .replace("['__FIT30_ASSETS__']", JSON.stringify(files)));
console.log(`Prepared Fit30 offline cache with ${files.length} app files.`);

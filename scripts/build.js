import { mkdir, readdir, readFile, copyFile, rm, lstat } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
if (relative(root, output) !== 'dist') throw new Error('Unexpected build output directory.');
// Only this package's generated dist directory is removed.
if (await lstat(output).then(info => info.isSymbolicLink(), () => false)) throw new Error('dist must not be a symbolic link.');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const copied = [];
async function copy(source, destination) {
  const info = await lstat(source);
  if (info.isSymbolicLink()) throw new Error('SDK source must not contain symbolic links.');
  if (info.isDirectory()) {
    await mkdir(destination, { recursive: true });
    for (const name of await readdir(source)) await copy(join(source, name), join(destination, name));
  } else if (/\.(js|d\.ts)$/.test(source)) { await copyFile(source, destination); copied.push(relative(output, destination)); }
}
for (const path of ['index.js', 'index.d.ts', 'client.js', 'sdk-error.js', 'resources', 'parsers', 'transport']) {
  await copy(resolve(root, 'src', path), resolve(output, path));
}
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
console.log(`${pkg.name}@${pkg.version}: built ${copied.length} SDK files.`);

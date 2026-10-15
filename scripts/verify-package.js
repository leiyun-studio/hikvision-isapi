import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli || !npmCli.endsWith('.js')) throw new Error('Run this script with npm run pack:verify.');
function run(command, args, cwd = root) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolveRun(output) : reject(new Error(output || `Command exited ${code}`)));
  });
}
const packed = await run(process.execPath, [npmCli, 'pack', '--json']);
const [manifest] = JSON.parse(packed.slice(packed.indexOf('[\n')));
assert.equal(manifest.name, '@lystudio/hikvision-isapi');
assert.ok(manifest.files.every(file => file.path.startsWith('dist/')
  || /^docs\/wiki\/[^/]+\.md$/.test(file.path)
  || ['README.md', 'README.zh-CN.md', 'LICENSE', 'docs/WIKI-PUBLISHING.md', 'package.json'].includes(file.path)));
for (const path of ['README.md', 'README.zh-CN.md', 'LICENSE', 'docs/wiki/Home.md', 'docs/wiki/Home-zh-CN.md']) {
  assert.ok(manifest.files.some(file => file.path === path), `Missing packaged documentation: ${path}`);
}
const directory = await mkdtemp(join(tmpdir(), 'hikvision-package-'));
try {
  await writeFile(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  await run(process.execPath, [npmCli, 'install', '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund', join(root, manifest.filename)], directory);
  const installed = JSON.parse(await readFile(join(directory, 'node_modules/@lystudio/hikvision-isapi/package.json'), 'utf8'));
  assert.equal(installed.dependencies.fastify, undefined);
  assert.equal(installed.license, 'MIT');
  await writeFile(join(directory, 'smoke.mjs'), `
    import assert from 'node:assert/strict';
    import http from 'node:http';
    import { once } from 'node:events';
    import { HikvisionClient, parseXml } from '@lystudio/hikvision-isapi';
    const server = http.createServer((request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ UserInfoSearch: { responseStatusStrg: 'OK', totalMatches: 1, UserInfo: [{ employeeNo: '0001' }] } }));
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    try {
      const client = new HikvisionClient({ baseUrl: 'http://127.0.0.1:' + server.address().port, username: 'fixture', password: 'fixture' });
      const page = await client.users.search();
      assert.equal(page.items[0].employeeNo, '0001');
      assert.equal(parseXml('<id>0001</id>').id, '0001');
    } finally { await new Promise(resolve => server.close(resolve)); }
  `);
  await run(process.execPath, ['smoke.mjs'], directory);
  await writeFile(join(directory, 'consumer.mts'), `
    import { HikvisionClient } from '@lystudio/hikvision-isapi';
    const client = new HikvisionClient({ baseUrl: 'http://localhost', username: 'fixture', password: 'fixture' });
    const bytes: Buffer = await client.images.download('/LOCALS/test.jpg');
    const text: string = await client.images.download(bytes, { as: 'base64' });
    for await (const event of client.events.iterate()) { console.log(event.images, text); }
    // @ts-expect-error IDs must remain strings.
    client.users.delete(1);
  `);
  await writeFile(join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
    target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true,
    types: ['node'], typeRoots: [join(root, 'node_modules/@types')],
  }, files: ['consumer.mts'] }));
  await run(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--project', join(directory, 'tsconfig.json')]);
  console.log(`${manifest.filename}: ${manifest.entryCount} files, installed import, mock request and TypeScript consumer verified.`);
} finally {
  const child = relative(resolve(tmpdir()), resolve(directory));
  if (!child.startsWith('hikvision-package-') || child.includes('..') || child.includes('/') || child.includes('\\')) throw new Error('Unexpected temporary directory.');
  await rm(directory, { recursive: true, force: true });
}

// Invoke with the target Node/npm on PATH via `npm exec -- node ...`.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const npmCli = process.env.npm_execpath;
assert.ok(npmCli?.endsWith('.js'), 'Run through npm exec so npm_execpath identifies the target npm CLI.');
function run(args, cwd) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, args, { cwd, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Runtime installation probe exceeded 120 seconds')); }, 120000);
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); code === 0 ? resolveRun(output) : reject(new Error(output)); });
  });
}
const directory = await mkdtemp(join(tmpdir(), 'hikvision-runtime-install-'));
try {
  await writeFile(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  const npmVersion = (await run([npmCli, '--version'], directory)).trim();
  const archive = join(root, `lystudio-hikvision-isapi-${pkg.version}.tgz`);
  await run([npmCli, 'install', '--engine-strict', '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund', archive], directory);
  await writeFile(join(directory, 'smoke.cjs'), `
    const assert = require('node:assert/strict');
    const http = require('node:http');
    (async () => {
      const { HikvisionClient, parseXml } = await import('@lystudio/hikvision-isapi');
      assert.equal(parseXml('<id>0001</id>').id, '0001');
      const sockets = new Set();
      const server = http.createServer((request, response) => {
        if (request.url.includes('hang')) return;
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ deviceName: 'fixture' }));
      });
      server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      try {
        const client = new HikvisionClient({ baseUrl: 'http://127.0.0.1:' + server.address().port, username: 'fixture', password: 'fixture', timeout: 1000 });
        assert.equal((await client.device.getInfo()).data.deviceName, 'fixture');
        const started = Date.now();
        await assert.rejects(client.request({ path: '/ISAPI/hang' }), error => error.code === 'TIMEOUT');
        assert.ok(Date.now() - started < 3000);
        const controller = new AbortController();
        const request = client.request({ path: '/ISAPI/hang', signal: controller.signal });
        controller.abort();
        await assert.rejects(request, error => error.code === 'ABORTED');
      } finally {
        for (const socket of sockets) socket.destroy();
        await new Promise(resolve => server.close(resolve));
      }
      console.log('Installed package: CommonJS dynamic import, XML, HTTP, timeout and abort passed.');
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `);
  const smoke = await run(['smoke.cjs'], directory);
  const report = { node: process.version, npm: npmVersion, platform: process.platform, arch: process.arch,
    sdkVersion: pkg.version, engineStrict: true, freshProductionInstall: true,
    passed: true, smoke: smoke.trim(), testedAt: new Date().toISOString() };
  if (process.argv[2]) await writeFile(resolve(process.argv[2]), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  const child = relative(resolve(tmpdir()), resolve(directory));
  if (!/^hikvision-runtime-install-[^/\\]+$/.test(child)) throw new Error('Unexpected temporary directory');
  await rm(directory, { recursive: true, force: true });
}

// Runs unchanged SDK code under the invoking Node version. No real devices are used.
// Only the test runner and fixture teardown are adapted for older Node versions.
import assert from 'node:assert';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const errorInfo = error => ({ name: error.name, code: error.code, message: error.message });
const report = {
  node: process.version, platform: process.platform, arch: process.arch,
  sdkVersion: JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version,
  testedAt: new Date().toISOString(),
  scope: 'Built SDK with installed dependency tree; simulated devices only. No SDK polyfills or transformations.',
  harness: 'Sequential test/after adapter; fixture sockets tracked for legacy teardown. Web console and TypeScript tooling excluded.',
  features: {
    AbortController: typeof globalThis.AbortController,
    abortTimeout: typeof globalThis.AbortSignal?.timeout,
    abortAny: typeof globalThis.AbortSignal?.any,
    performance: typeof globalThis.performance,
    replaceAll: typeof String.prototype.replaceAll,
  },
  syntaxFailures: [], tests: [],
};
async function checkSyntax(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await checkSyntax(path);
    else if (entry.name.endsWith('.js')) {
      const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8', windowsHide: true });
      if (result.status !== 0) report.syntaxFailures.push({
        file: relative(root, path).replace(/\\/g, '/'),
        error: (result.stderr || '').split(/\r?\n/).find(line => line.startsWith('SyntaxError:')) || 'Syntax check failed',
      });
    }
  }
}
await checkSyntax(join(root, 'dist'));
try {
  const xml = await import('fast-xml-parser');
  assert.strictEqual(new xml.XMLParser({ parseTagValue: false }).parse('<id>0001</id>').id, '0001');
  report.xmlDependency = { passed: true };
} catch (error) { report.xmlDependency = { passed: false, error: errorInfo(error) }; }
try {
  await import(pathToFileURL(join(root, 'dist/index.js')).href);
  report.sdkImport = { passed: true };
} catch (error) { report.sdkImport = { passed: false, error: errorInfo(error) }; }
try { await import('node:timers/promises'); report.timerPromises = true; }
catch { report.timerPromises = false; }

if (report.sdkImport.passed) {
  const directory = await mkdtemp(join(tmpdir(), 'hikvision-compat-'));
  try {
    const runnerPath = join(directory, 'runner.mjs');
    await writeFile(runnerPath, 'export const cases = []; export function test(name, fn) { cases.push({ name, fn }); }');
    const fixturePath = join(directory, 'device.mjs');
    let fixture = await readFile(join(root, 'test-support/device.js'), 'utf8');
    assert.ok(fixture.includes('server.closeAllConnections();'));
    fixture = fixture.replace("  server.listen(0, '127.0.0.1');", `  const sockets = new Set();
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  server.listen(0, '127.0.0.1');`).replace('server.closeAllConnections();', 'for (const socket of sockets) socket.destroy();');
    await writeFile(fixturePath, fixture);
    for (const name of ['sdk.test.js', 'events-stream.test.js', 'batch-time.test.js', 'cancellation.test.js']) {
      let source = await readFile(join(root, 'test', name), 'utf8');
      source = source.replace("'node:test'", JSON.stringify(pathToFileURL(runnerPath).href));
      source = source.replace(/(['"])(\.\.\/[^'"]+)\1/g, (_, quote, specifier) => {
        const target = specifier === '../test-support/device.js' ? fixturePath
          : resolve(root, 'test', specifier.replace('../src/', '../dist/'));
        return JSON.stringify(pathToFileURL(target).href);
      });
      const target = join(directory, name.replace('.js', '.mjs'));
      await writeFile(target, source);
      await import(pathToFileURL(target).href);
    }
    const { cases, test } = await import(pathToFileURL(runnerPath).href);
    const { deviceFixture, json } = await import(pathToFileURL(fixturePath).href);
    const { HikvisionClient } = await import(pathToFileURL(join(root, 'dist/index.js')).href);
    const clientFor = device => new HikvisionClient({ baseUrl: device.baseUrl, username: 'admin', password: 'fixture-password' });
    test('request with caller AbortSignal', async t => {
      const device = await deviceFixture(t, (_, response) => json(response, { ok: true }));
      const result = await clientFor(device).request({ path: '/ISAPI/probe', signal: new AbortController().signal });
      assert.strictEqual(result.data.ok, true);
    });
    test('in-flight request cancellation reports ABORTED', async t => {
      const controller = new AbortController();
      const device = await deviceFixture(t, () => controller.abort());
      await assert.rejects(clientFor(device).request({ path: '/ISAPI/probe', signal: controller.signal }),
        error => error.code === 'ABORTED');
    });
    test('subscription with caller AbortSignal closes cleanly', async t => {
      const controller = new AbortController();
      const device = await deviceFixture(t, (_, response) => {
        response.writeHead(200, { 'Content-Type': 'multipart/mixed; boundary=probe' });
        response.write('--probe\r\n');
        controller.abort();
      });
      for await (const message of clientFor(device).events.subscribe({ signal: controller.signal })) void message;
      assert.strictEqual(controller.signal.aborted, true);
    });
    for (const entry of cases) {
      const cleanups = []; let timer; let failure;
      try {
        await Promise.race([
          Promise.resolve().then(() => entry.fn({ after: fn => cleanups.push(fn) })),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Probe exceeded 10 seconds')), 10000); }),
        ]);
      } catch (error) { failure = errorInfo(error); }
      finally {
        clearTimeout(timer);
        for (const cleanup of cleanups.reverse()) {
          try { await cleanup(); } catch (error) { failure = failure || errorInfo(error); }
        }
      }
      report.tests.push({ name: entry.name, passed: !failure, ...(failure ? { error: failure } : {}) });
    }
  } finally {
    const child = relative(resolve(tmpdir()), resolve(directory));
    if (!/^hikvision-compat-[^/\\]+$/.test(child)) throw new Error('Unexpected temporary directory');
    await rm(directory, { recursive: true, force: true });
  }
}
report.summary = {
  passed: report.tests.filter(item => item.passed).length,
  failed: report.tests.filter(item => !item.passed).length,
  blocked: !report.sdkImport.passed,
};
if (process.argv[2]) await writeFile(resolve(process.argv[2]), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.summary.blocked || report.summary.failed || !report.xmlDependency.passed) process.exitCode = 1;

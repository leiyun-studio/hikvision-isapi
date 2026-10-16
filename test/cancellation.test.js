import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { HikvisionClient } from '../src/index.js';
import { deviceFixture, json, success } from '../test-support/device.js';

const clientFor = device => new HikvisionClient({ baseUrl: device.baseUrl, username: 'admin', password: 'fixture-password', timeout: 1000 });
function trackClose(response) {
  return new Promise(resolve => response.once('close', resolve));
}
async function within(promise, ms = 2500) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Deadline exceeded')), ms); })]); }
  finally { clearTimeout(timer); }
}

test('pre-aborted requests send nothing and release caller listeners', async t => {
  const device = await deviceFixture(t, (_, response) => success(response));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(clientFor(device).device.getInfo({ signal: controller.signal }), error => error.code === 'ABORTED');
  assert.equal(device.calls.length, 0);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('caller listeners are removed after successful requests, device errors and Digest replays', async t => {
  const device = await deviceFixture(t, (call, response) => {
    if (call.path.includes('fail')) json(response, { statusCode: 6, statusString: 'Error', subStatusCode: 'badParameters' });
    else success(response);
  });
  const client = clientFor(device); const controller = new AbortController();
  for (let index = 0; index < 15; index++) {
    await client.request({ path: '/ISAPI/probe', signal: controller.signal });
    await assert.rejects(client.request({ path: '/ISAPI/fail', signal: controller.signal }), error => error.code === 'DEVICE_ERROR');
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  }
  assert.equal(device.calls.filter(call => call.authorized).length, 30);
});

test('timeout terminates a response body after headers and marks writes unknown', async t => {
  let closed;
  const device = await deviceFixture(t, (_, response) => {
    closed = trackClose(response);
    response.writeHead(200, { 'Content-Type': 'application/json' }); response.write('{');
  });
  const controller = new AbortController();
  await within(assert.rejects(clientFor(device).users.create({ employeeNo: '001' }, { signal: controller.signal }),
    error => error.code === 'TIMEOUT' && error.outcome === 'unknown'));
  await within(closed);
  assert.equal(device.calls.filter(call => call.authorized).length, 1);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('timeout also bounds a stalled Digest challenge body', async t => {
  let closed;
  const device = await deviceFixture(t, (_, response) => {
    closed = trackClose(response);
    response.writeHead(401, { 'WWW-Authenticate': 'Digest realm="fixture", nonce="nonce", qop="auth"' });
    response.write('challenge');
  }, { authenticate: false });
  await within(assert.rejects(clientFor(device).device.getInfo(), error => error.code === 'TIMEOUT'));
  await within(closed);
  assert.equal(device.calls.length, 1);
});

test('abort stops an in-flight batch write without starting the next item', async t => {
  const controller = new AbortController(); let closed;
  const device = await deviceFixture(t, (_, response) => {
    closed = trackClose(response);
    response.writeHead(200, { 'Content-Type': 'application/json' }); response.write('{');
    setImmediate(() => controller.abort());
  });
  const result = await within(clientFor(device).users.createMany([{ employeeNo: '001' }, { employeeNo: '002' }], { signal: controller.signal }));
  assert.equal(result.unknown, 1); assert.equal(result.skipped, 1);
  assert.equal(result.results[0].error.code, 'ABORTED');
  await within(closed);
  assert.equal(device.calls.filter(call => call.authorized).length, 1);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('subscription idle timeout destroys the socket and releases caller listeners', async t => {
  let closed;
  const device = await deviceFixture(t, (_, response) => {
    closed = trackClose(response);
    response.writeHead(200, { 'Content-Type': 'multipart/mixed; boundary=probe' }); response.write('--probe\r\n');
  });
  const controller = new AbortController();
  await within(assert.rejects(async () => {
    for await (const message of clientFor(device).events.subscribe({ idleTimeout: 1000, signal: controller.signal })) void message;
  }, error => error.code === 'TIMEOUT'));
  await within(closed);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test('subscription non-200 response body remains bounded by connection timeout', async t => {
  const device = await deviceFixture(t, (_, response) => {
    response.writeHead(503, { 'Content-Type': 'text/plain' }); response.write('unavailable');
  });
  await within(assert.rejects(async () => {
    for await (const part of clientFor(device).stream()) void part;
  }, error => error.code === 'TIMEOUT'));
});

test('cancelling subscription backoff stops reconnects and releases listeners', async t => {
  const controller = new AbortController();
  const device = await deviceFixture(t, (_, response) => {
    response.writeHead(200, { 'Content-Type': 'multipart/mixed; boundary=probe' });
    response.end('--probe--\r\n');
  });
  const stream = clientFor(device).events.subscribe({ reconnect: true, reconnectDelay: 2000, signal: controller.signal });
  const timer = setTimeout(() => controller.abort(), 300);
  try { await within(stream.next()); } finally { clearTimeout(timer); }
  assert.equal(device.calls.filter(call => call.authorized).length, 1);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

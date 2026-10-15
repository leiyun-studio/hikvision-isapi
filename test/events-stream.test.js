import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HikvisionClient } from '../src/index.js';
import { MultipartDecoder } from '../src/parsers/multipart.js';
import { deviceFixture, jpeg } from '../test-support/device.js';

const boundary = 'event-test-boundary';
function part(type, bytes) {
  return Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: ${type}\r\nContent-Length: ${bytes.length}\r\n\r\n`), bytes, Buffer.from('\r\n')]);
}
function message(pictures = 1) { return Buffer.from(JSON.stringify({ EventNotificationAlert: { eventType: 'AccessControllerEvent',
  AccessControllerEvent: { employeeNoString: '0001', serialNo: 10, picturesNumber: pictures } } })); }

test('multipart 在每个字节边界分片时仍保留图片中的 boundary 字节', () => {
  const photo = Buffer.concat([jpeg, Buffer.from(`\r\n--${boundary}`), Buffer.from([0, 255])]);
  const input = Buffer.concat([part('application/json', message()), part('image/jpeg', photo), Buffer.from(`--${boundary}--\r\n`)]);
  const decoder = new MultipartDecoder(`multipart/mixed; boundary="${boundary}"`);
  const result = [];
  for (const byte of input) result.push(...decoder.push(Buffer.from([byte])));
  decoder.finish();
  assert.equal(result.length, 2); assert.deepEqual(result[1].bytes, photo);
});

test('multipart 截断和非法 Content-Length 明确失败', () => {
  const decoder = new MultipartDecoder(`multipart/mixed; boundary=${boundary}`);
  decoder.push(part('application/json', message()).subarray(0, -5));
  assert.throws(() => decoder.finish(), error => error.code === 'TRUNCATED_RESPONSE');
  const oversized = new MultipartDecoder(`multipart/mixed; boundary=${boundary}`, 10);
  assert.throws(() => oversized.push(Buffer.from(`--${boundary}\r\nContent-Length: 1000000\r\n\r\n`)), error => error.code === 'RESPONSE_TOO_LARGE');
});

test('实时订阅把声明图片数的事件与图片配对，支持保存内嵌图片字节', async t => {
  const fixture = await deviceFixture(t, (_, response) => {
    response.writeHead(200, { 'Content-Type': `multipart/mixed; boundary=${boundary}` });
    response.end(Buffer.concat([part('application/json', message()), part('image/jpeg', jpeg), Buffer.from(`--${boundary}--\r\n`)]));
  });
  const client = new HikvisionClient({ baseUrl: fixture.baseUrl, username: 'admin', password: 'fixture-password' });
  const results = [];
  for await (const item of client.events.subscribe()) results.push(item);
  assert.equal(results.length, 1); assert.equal(results[0].complete, true);
  assert.equal(results[0].event.AccessControllerEvent.employeeNoString, '0001');
  assert.deepEqual(await client.images.download(results[0].images[0]), jpeg);
});

test('未声明图片归属时，图片作为独立记录上报，不按时间猜测', async t => {
  const fixture = await deviceFixture(t, (_, response) => {
    response.writeHead(200, { 'Content-Type': `multipart/mixed; boundary=${boundary}` });
    response.end(Buffer.concat([part('application/json', message(0)), part('image/jpeg', jpeg), Buffer.from(`--${boundary}--\r\n`)]));
  });
  const client = new HikvisionClient({ baseUrl: fixture.baseUrl, username: 'admin', password: 'fixture-password' });
  const results = [];
  for await (const item of client.events.subscribe()) results.push(item);
  assert.deepEqual(results.map(item => item.kind), ['event', 'image']);
  assert.equal(results[0].images.length, 0);
});

test('退出实时迭代会关闭连接，不留下后台订阅', async t => {
  let resolveClosed;
  const closed = new Promise(resolve => { resolveClosed = resolve; });
  const fixture = await deviceFixture(t, (_, response) => {
    response.writeHead(200, { 'Content-Type': `multipart/mixed; boundary=${boundary}` });
    response.write(part('application/json', message(0)));
    response.once('close', resolveClosed);
  });
  const client = new HikvisionClient({ baseUrl: fixture.baseUrl, username: 'admin', password: 'fixture-password' });
  for await (const item of client.events.subscribe()) { assert.equal(item.kind, 'event'); break; }
  let timer;
  await Promise.race([closed, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Connection not closed')), 1000); })]).finally(() => clearTimeout(timer));
});

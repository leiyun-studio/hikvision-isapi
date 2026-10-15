import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWebExample } from '../examples/web/app.js';
import { deviceFixture, jpeg, json, success } from '../test-support/device.js';
import { sdkExample } from '../examples/web/public/sdk-example.js';
import { actions } from '../examples/web/actions.js';

test('所有页面接口的示例代码可执行，批量与 NTP 参数映射为 SDK 签名', async () => {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const action of actions) {
    const calls = [];
    class FakeClient {
      constructor() { return new Proxy({}, { get: (_, resource) => new Proxy({}, { get: (_, method) => async (...args) => { calls.push({ action: `${resource}.${method}`, args }); return {}; } }) }); }
    }
    const code = sdkExample(action.id, action.example, { baseUrl: 'https://device.test:8443', username: 'test-admin' });
    assert.match(code, /password: process.env.HIKVISION_PASSWORD/);
    assert.match(code, /https:\/\/device.test:8443/);
    await new AsyncFunction('HikvisionClient', 'process', 'console', code.replace(/^import[^\n]+\n/, ''))(FakeClient, { env: { HIKVISION_PASSWORD: 'not-in-example' } }, { log() {} });
    assert.equal(calls.length, 1); assert.equal(calls[0].action, action.id);
    if (action.id.endsWith('Many')) assert.deepEqual(calls[0].args[0], action.example.items ?? action.example.ids);
    if (action.id === 'device.setNtpServer') assert.deepEqual(calls[0].args, [action.example.id, action.example.config]);
    assert.ok(!code.includes('not-in-example'));
  }
});

test('网页批量写入保留确认、阻止服务器文件读取并返回汇总结果', async t => {
  const device = await deviceFixture(t, (_, response) => success(response));
  const app = buildWebExample(); t.after(() => app.close());
  const connection = { baseUrl: device.baseUrl, username: 'admin', password: 'fixture-password' };
  const payload = { connection, action: 'cards.setMany', params: { items: [{ cardNo: '0001', employeeNo: '001' }, { cardNo: '0002', employeeNo: '002' }], options: { concurrency: 1 } } };
  assert.equal((await app.inject({ method: 'POST', url: '/api/sdk', payload })).statusCode, 400);
  const badFaces = { connection, action: 'faces.setMany', confirmed: true, params: { items: [{ employeeNo: '001', image: { type: 'file', path: 'private.jpg' } }] } };
  assert.equal((await app.inject({ method: 'POST', url: '/api/sdk', payload: badFaces })).statusCode, 400);
  assert.equal(device.calls.length, 0);
  const response = await app.inject({ method: 'POST', url: '/api/sdk', payload: { ...payload, confirmed: true } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().result.succeeded, 2);
  assert.equal((await app.inject('/sdk-example.js')).statusCode, 200);
  assert.match((await app.inject('/')).body, /id="sdk-code"/);
});

test('网页连接断开会取消正在下发的批量请求，后续条目不发送', { timeout: 5000 }, async t => {
  let started; let closed;
  const requestStarted = new Promise(resolve => { started = resolve; });
  const requestClosed = new Promise(resolve => { closed = resolve; });
  const device = await deviceFixture(t, (_, response) => { response.once('close', closed); started(); });
  const app = buildWebExample(); t.after(() => app.close());
  await app.listen({ host: '127.0.0.1', port: 0 });
  const controller = new AbortController();
  const request = fetch(`http://127.0.0.1:${app.server.address().port}/api/sdk`, { method: 'POST', signal: controller.signal,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      connection: { baseUrl: device.baseUrl, username: 'admin', password: 'fixture-password' },
      action: 'users.createMany', confirmed: true, params: { items: [{ employeeNo: '001' }, { employeeNo: '002' }] },
    }) });
  const rejected = assert.rejects(request, error => error.name === 'AbortError');
  await requestStarted; controller.abort();
  await rejected; await requestClosed;
  assert.equal(device.calls.filter(call => call.authorized).length, 1);
});

test('网页 SDK 操作受白名单和写入确认限制，确认后调用原生 URL 人脸接口', async t => {
  const device = await deviceFixture(t, (_, response) => success(response));
  const app = buildWebExample(); t.after(() => app.close());
  const connection = { baseUrl: device.baseUrl, username: 'admin', password: 'fixture-password' };
  const request = (action, params, confirmed = false) => app.inject({ method: 'POST', url: '/api/sdk', payload: { connection, action, params, confirmed } });
  assert.ok((await app.inject('/api/actions')).json().some(item => item.id === 'faces.set' && item.write));
  assert.equal((await request('request', {})).statusCode, 400);
  assert.equal((await request('doors.control', { doorId: 1, command: 'open' })).statusCode, 400);
  assert.equal((await request('faces.set', { employeeNo: '0001', image: { type: 'file', path: 'forbidden.jpg' } }, true)).statusCode, 400);
  assert.equal(device.calls.length, 0);
  const response = await request('faces.set', { employeeNo: '0001', image: { type: 'url', url: 'https://images.invalid/face.jpg' } }, true);
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(device.calls.at(-1).body).faceURL, 'https://images.invalid/face.jpg');
  assert.ok(!response.body.includes(connection.password));
});

test('网页通过 SDK 返回保留原始字段的历史分页与可显示的图片字节', async t => {
  const device = await deviceFixture(t, (call, response) => {
    if (call.method === 'GET') { response.writeHead(200, { 'Content-Type': 'image/jpeg' }); response.end(jpeg); return; }
    json(response, { AcsEvent: { responseStatusStrg: 'OK', totalMatches: 1,
      InfoList: [{ serialNo: 123, employeeNoString: '0001', pictureURL: '/LOCALS/test.jpg', custom: 'preserved' }] } });
  });
  const app = buildWebExample(); t.after(() => app.close());
  const connection = { baseUrl: device.baseUrl, username: 'admin', password: 'fixture-password' };
  const request = (action, params) => app.inject({ method: 'POST', url: '/api/sdk', payload: { connection, action, params } });
  const page = (await request('events.search', { pageSize: 20 })).json().result;
  assert.equal(page.items[0].raw.custom, 'preserved');
  for (const as of ['buffer', 'base64']) {
    const response = await request('images.download', { source: page.items[0].images[0], as });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().result.encoding, 'base64');
    assert.deepEqual(Buffer.from(response.json().result.data, 'base64'), jpeg);
  }
});

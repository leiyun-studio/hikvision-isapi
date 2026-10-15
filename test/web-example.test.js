import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { HikvisionClient } from '../src/client.js';
import { parseChallenge } from '../src/transport/digest.js';
import { buildWebExample } from '../examples/web/app.js';
import { buildBaseUrl } from '../examples/web/public/connection.js';

test('地址输入保留自定义端口、HTTPS 和完整 baseUrl，支持 IPv6', () => {
  assert.equal(buildBaseUrl({ mode: 'url', baseUrl: ' https://device.test:8443/ ' }), 'https://device.test:8443/');
  assert.equal(buildBaseUrl({ mode: 'address', protocol: 'http:', hostname: '192.168.0.75', port: '8080' }), 'http://192.168.0.75:8080');
  assert.equal(buildBaseUrl({ mode: 'address', protocol: 'https:', hostname: 'device.test', port: '8443' }), 'https://device.test:8443');
  assert.equal(buildBaseUrl({ mode: 'address', protocol: 'http:', hostname: '::1', port: '8000' }), 'http://[::1]:8000');
  assert.throws(() => buildBaseUrl({ mode: 'address', protocol: 'http:', hostname: 'example.test', port: '65536' }), /端口/);
});

async function mockDevice(t) {
  const calls = [];
  const hash = value => createHash('md5').update(value).digest('hex');
  const server = http.createServer((request, response) => {
    calls.push({ path: request.url, authorization: request.headers.authorization });
    const challenge = 'Digest realm="test-device", nonce="test-nonce", qop="auth", algorithm=MD5';
    if (!request.headers.authorization) {
      response.writeHead(401, { 'WWW-Authenticate': challenge }); response.end(); return;
    }
    const auth = parseChallenge(request.headers.authorization);
    const expected = hash(`${hash('admin:test-device:test-password')}:test-nonce:${auth.nc}:${auth.cnonce}:auth:${hash(`GET:${request.url}`)}`);
    if (auth.response !== expected || auth.uri !== request.url) {
      response.writeHead(401, { 'WWW-Authenticate': challenge }); response.end('Unauthorized'); return;
    }
    if (request.url.startsWith('/ISAPI/unsupported')) {
      response.writeHead(200, { 'Content-Type': 'application/xml' });
      response.end('<ResponseStatus><statusCode>4</statusCode><statusString>Invalid Operation</statusString><subStatusCode>notSupport</subStatusCode></ResponseStatus>');
    } else if (request.url.startsWith('/ISAPI/redirect')) {
      response.writeHead(302, { Location: '/other-target' }); response.end();
    } else {
      response.writeHead(200, { 'Content-Type': 'application/xml' });
      response.end('<DeviceInfo><model>DEMO-TERMINAL</model><firmwareVersion>V1.0</firmwareVersion></DeviceInfo>');
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, calls };
}

test('网页通过 SDK 的 Digest 认证访问非 80 端口，保留 XML 与查询参数', async t => {
  const device = await mockDevice(t);
  const app = buildWebExample(); t.after(() => app.close());
  const response = await app.inject({ method: 'POST', url: '/api/request', payload: {
    connection: { baseUrl: device.baseUrl, username: 'admin', password: 'test-password' },
    path: '/ISAPI/System/deviceInfo?format=xml',
  } });
  assert.equal(response.statusCode, 200);
  const data = response.json();
  assert.equal(data.ok, true);
  assert.equal(data.result.format, 'xml');
  assert.match(data.result.data, /DEMO-TERMINAL/);
  assert.equal(device.calls.length, 2);
  assert.equal(device.calls[1].path, '/ISAPI/System/deviceInfo?format=xml');
  assert.ok(!response.body.includes('test-password'));
});

test('错误密码和 HTTP 200 的设备业务错误分别报告', async t => {
  const device = await mockDevice(t);
  const app = buildWebExample(); t.after(() => app.close());
  for (const [password, path, expected] of [
    ['incorrect-secret', '/ISAPI/System/deviceInfo', 'AUTHENTICATION_FAILED'],
    ['test-password', '/ISAPI/unsupported', 'UNSUPPORTED'],
  ]) {
    const response = await app.inject({ method: 'POST', url: '/api/request', payload: {
      connection: { baseUrl: device.baseUrl, username: 'admin', password }, path,
    } });
    assert.equal(response.statusCode, 502);
    assert.equal(response.json().error.code, expected);
    assert.ok(!response.body.includes(password));
  }
  assert.equal(device.calls.length, 4, '错误密码不重复尝试认证');
});

test('拒绝跨站调用、含凭据 URL 和离开 ISAPI 的路径', async t => {
  const app = buildWebExample(); t.after(() => app.close());
  const payload = { connection: { baseUrl: 'http://127.0.0.1:9999', username: 'admin', password: 'secret-for-test' }, path: '/ISAPI/System/deviceInfo' };
  assert.equal((await app.inject({ method: 'POST', url: '/api/request', headers: { origin: 'https://example.invalid' }, payload })).statusCode, 403);
  for (const path of ['http://example.invalid/ISAPI/test', '/ISAPI/../outside', '/ISAPI/test#fragment']) {
    const response = await app.inject({ method: 'POST', url: '/api/request', payload: { ...payload, path } });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.code, 'INVALID_ARGUMENT');
  }
  assert.throws(() => new HikvisionClient({ ...payload.connection, baseUrl: 'http://admin:secret-for-test@localhost' }), /账号密码请单独填写/);
});

test('SDK 不跟随设备重定向，不向新路径传递认证', async t => {
  const device = await mockDevice(t);
  const client = new HikvisionClient({ baseUrl: device.baseUrl, username: 'admin', password: 'test-password' });
  await assert.rejects(client.request({ path: '/ISAPI/redirect' }), error => error.code === 'REDIRECT');
  assert.equal(device.calls.length, 2);
  assert.ok(device.calls.every(call => call.path === '/ISAPI/redirect'));
});

test('HTML 示例的静态资源可用，默认表单不包含设备密码', async t => {
  const app = buildWebExample(); t.after(() => app.close());
  const index = await app.inject('/');
  assert.equal(index.statusCode, 200);
  assert.match(index.body, /Base URL/);
  assert.match(index.body, /IP \/ 主机 \+ 端口/);
  assert.match(index.body, /type="password"/);
  assert.equal((await app.inject('/app.js')).statusCode, 200);
  assert.equal((await app.inject('/connection.js')).statusCode, 200);
  assert.equal((await app.inject('/style.css')).statusCode, 200);
});

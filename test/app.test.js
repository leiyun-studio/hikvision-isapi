import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';

test('应用无需额外配置即可返回健康状态', async t => {
  const app = buildApp();
  t.after(() => app.close());
  const response = await app.inject('/health');
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok' });
});

test('未处理的错误不会向调用方泄露内部细节', async t => {
  const app = buildApp();
  t.after(() => app.close());
  app.get('/test-error', async () => { throw new Error('internal implementation detail'); });
  const response = await app.inject('/test-error');
  assert.equal(response.statusCode, 500);
  assert.equal(response.json().error, 'REQUEST_ERROR');
  assert.ok(!response.body.includes('internal implementation detail'));
});

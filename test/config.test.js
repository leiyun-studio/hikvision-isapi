import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config/env.js';

test('监听配置支持默认值和环境变量', () => {
  assert.deepEqual(loadConfig({}), { server: { host: '127.0.0.1', port: 3000 } });
  assert.deepEqual(loadConfig({ SERVER_HOST: '0.0.0.0', SERVER_PORT: '4000' }),
    { server: { host: '0.0.0.0', port: 4000 } });
});

test('无效的监听配置在启动前报错', () => {
  for (const port of ['abc', '', '0', '-1', '65536', '1.5']) {
    assert.throws(() => loadConfig({ SERVER_PORT: port }), /SERVER_PORT/);
  }
  for (const host of ['', ' ', 'local host']) {
    assert.throws(() => loadConfig({ SERVER_HOST: host }), /SERVER_HOST/);
  }
});

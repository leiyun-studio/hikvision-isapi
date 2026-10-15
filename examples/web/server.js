import { buildWebExample } from './app.js';

const port = Number(process.env.WEB_EXAMPLE_PORT ?? 3050);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('WEB_EXAMPLE_PORT 必须为 1–65535。');
const app = buildWebExample();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); });
try {
  await app.listen({ host: '127.0.0.1', port });
  console.log(`ISAPI 测试台：http://127.0.0.1:${port}`);
} catch (error) {
  console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已被占用，请设置 WEB_EXAMPLE_PORT。` : '测试台启动失败。');
  process.exitCode = 1;
}

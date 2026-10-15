export function loadConfig(env = process.env) {
  const host = (env.SERVER_HOST ?? '127.0.0.1').trim();
  if (!host || /\s/.test(host)) throw new Error('SERVER_HOST 必须是有效的主机地址。');

  const port = Number(env.SERVER_PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SERVER_PORT 必须是 1 到 65535 的整数。');
  }
  return { server: { host, port } };
}

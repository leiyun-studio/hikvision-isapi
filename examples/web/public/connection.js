export function buildBaseUrl({ mode, baseUrl, protocol, hostname, port }) {
  if (mode === 'url') return baseUrl.trim();
  if (!['http:', 'https:'].includes(protocol)) throw new Error('请选择 HTTP 或 HTTPS。');
  const number = Number(port);
  if (!Number.isInteger(number) || number < 1 || number > 65535) throw new Error('端口必须在 1–65535 之间。');
  let host = hostname.trim();
  if (!host || /[/?#@\s]/.test(host)) throw new Error('主机只填写 IP 或域名，协议和端口请在对应字段设置。');
  if (host.includes(':') && !host.startsWith('[')) host = `[${host}]`;
  return `${protocol}//${host}:${number}`;
}

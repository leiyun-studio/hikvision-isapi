import http from 'node:http';
import { createHash } from 'node:crypto';
import { once } from 'node:events';

export const jpeg = Buffer.from([255, 216, 255, 224, 0, 7, 13, 10, 0, 72, 75, 255, 217]);
export async function deviceFixture(t, handler, { algorithm = 'MD5', authenticate = true } = {}) {
  const calls = [];
  const realm = 'fixture-realm'; const nonce = 'fixture-nonce';
  const hash = value => createHash(algorithm.startsWith('SHA-256') ? 'sha256' : 'md5').update(value).digest('hex');
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    try {
      for await (const chunk of request) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const auth = {};
      for (const match of (request.headers.authorization ?? '').matchAll(/(\w+)=(?:"([^"\r\n]*)"|([^,\s]+))/g)) auth[match[1]] = match[2] ?? match[3];
      let ha1 = hash(`admin:${realm}:fixture-password`);
      if (algorithm.endsWith('-sess')) ha1 = hash(`${ha1}:${nonce}:${auth.cnonce}`);
      const expected = hash(`${ha1}:${nonce}:${auth.nc}:${auth.cnonce}:auth:${hash(`${request.method}:${request.url}`)}`);
      const authorized = !authenticate || (auth.username === 'admin' && auth.uri === request.url && auth.response === expected);
      const call = { method: request.method, path: request.url, headers: request.headers, body, authorized };
      calls.push(call);
      if (!authorized) {
        response.writeHead(401, { 'WWW-Authenticate': `Digest realm="${realm}", nonce="${nonce}", algorithm=${algorithm}, qop="auth"` });
        response.end('Unauthorized'); return;
      }
      await handler(call, response, request);
    } catch (error) { if (!response.destroyed) { response.statusCode = 500; response.end('fixture error'); } }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return { server, calls, baseUrl: `http://127.0.0.1:${server.address().port}` };
}
export function json(response, value) { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); }
export function success(response) { json(response, { statusCode: 1, statusString: 'OK' }); }

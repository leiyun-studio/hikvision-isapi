import http from 'node:http';
import https from 'node:https';
import { HikvisionError } from '../sdk-error.js';

export function openResponse(url, { method = 'GET', body, headers = {}, signal, tls = {} } = {}) {
  return new Promise((resolve, reject) => {
    const abortError = () => Object.assign(new Error('The request was aborted'), { name: 'AbortError', code: 'ABORT_ERR' });
    if (signal?.aborted) { reject(abortError()); return; }
    let response;
    const request = (url.protocol === 'https:' ? https : http).request(url, {
      method, agent: false,
      headers: { Accept: 'application/json, application/xml, */*',
        ...(body === undefined ? {} : { 'Content-Length': body.length }), ...headers },
      ...(url.protocol === 'https:' ? { rejectUnauthorized: tls.rejectUnauthorized !== false,
        ...(tls.ca ? { ca: tls.ca } : {}) } : {}),
    }, incoming => {
      response = incoming;
      incoming.once('error', reject);
      incoming.once('end', cleanup);
      incoming.once('close', cleanup);
      resolve(incoming);
    });
    const abort = () => {
      const error = abortError();
      request.destroy(error);
      response?.destroy(error);
    };
    const cleanup = () => signal?.removeEventListener('abort', abort);
    request.once('error', error => { cleanup(); reject(error); });
    request.once('close', () => { if (!response) cleanup(); });
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    request.end(body);
  });
}

export async function readResponse(response, maxBytes = 16 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of response) {
      size += chunk.length;
      if (size > maxBytes) throw new HikvisionError('RESPONSE_TOO_LARGE', '设备响应超过大小限制。');
      chunks.push(chunk);
    }
    if (!response.complete) throw new HikvisionError('TRUNCATED_RESPONSE', '设备响应未接收完整。');
    return { status: response.statusCode, headers: response.headers, bytes: Buffer.concat(chunks) };
  } finally { if (!response.complete) response.destroy(); }
}

export async function getResponse(url, options = {}) {
  return readResponse(await openResponse(url, options), options.maxBytes);
}

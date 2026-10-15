import { HikvisionError } from './sdk-error.js';
import { digestAuthorization, parseChallenge } from './transport/digest.js';
import { openResponse, readResponse } from './transport/http.js';
import { decodeResponse, getBusinessError } from './parsers/response.js';
import { createResources } from './resources/index.js';

export class HikvisionClient {
  #baseUrl; #username; #password; #timeout; #tls; #maxResponseBytes; #maxImageBytes;

  constructor({ baseUrl, username, password, timeout = 15_000, tls = {}, maxResponseBytes = 16 * 1024 * 1024,
    maxImageBytes = 10 * 1024 * 1024 } = {}) {
    let url;
    try { url = new URL(baseUrl); } catch { throw new HikvisionError('INVALID_ARGUMENT', '请输入完整的 http:// 或 https:// baseUrl。'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new HikvisionError('INVALID_ARGUMENT', 'baseUrl 只能包含协议、主机和端口，账号密码请单独填写。');
    }
    if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password
      || /[\r\n\0]/.test(username + password)) throw new HikvisionError('INVALID_ARGUMENT', '请输入有效的设备用户名和密码。');
    if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 300_000) throw new HikvisionError('INVALID_ARGUMENT', '超时时间必须在 1000–300000 毫秒之间。');
    for (const size of [maxResponseBytes, maxImageBytes]) {
      if (!Number.isSafeInteger(size) || size < 1 || size > 64 * 1024 * 1024) throw new HikvisionError('INVALID_ARGUMENT', '大小限制必须在 1–64 MiB 之间。');
    }
    this.#baseUrl = url; this.#username = username.trim(); this.#password = password;
    this.#timeout = timeout; this.#tls = { rejectUnauthorized: tls.rejectUnauthorized !== false, ca: tls.ca };
    this.#maxResponseBytes = maxResponseBytes; this.#maxImageBytes = maxImageBytes;
    Object.assign(this, createResources(this));
  }

  get baseUrl() { return this.#baseUrl.origin; }
  get maxImageBytes() { return this.#maxImageBytes; }

  #url(path, allowExternal = false) {
    if (typeof path !== 'string' || !path || path.length > 8192 || /[\s\x00-\x1f\x7f#\\]/.test(path)) {
      throw new HikvisionError('INVALID_ARGUMENT', '请求路径不能包含空格、控制字符或片段。');
    }
    let url;
    try { url = new URL(path, this.#baseUrl); } catch { throw new HikvisionError('INVALID_ARGUMENT', '图片地址或设备路径无效。'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) throw new HikvisionError('INVALID_ARGUMENT', '仅支持不含账号密码的 HTTP/HTTPS 地址。');
    if (!allowExternal && (url.origin !== this.#baseUrl.origin || !['/ISAPI/', '/LOCALS/'].some(prefix => url.pathname.startsWith(prefix)))) {
      throw new HikvisionError('INVALID_ARGUMENT', '请求路径必须位于当前设备的 /ISAPI/ 或 /LOCALS/ 下。');
    }
    return url;
  }

  async #authenticate(url, options) {
    const tls = url.origin === this.#baseUrl.origin ? this.#tls : { rejectUnauthorized: true };
    let response = await openResponse(url, { ...options, tls });
    if (response.statusCode !== 401 || url.origin !== this.#baseUrl.origin) return response;
    let challenge;
    try { challenge = parseChallenge(response.headers['www-authenticate']); }
    finally { await readResponse(response, this.#maxResponseBytes); }
    for (let attempt = 0; attempt < 2; attempt++) {
      const authorization = digestAuthorization(challenge, { username: this.#username, password: this.#password,
        method: options.method, uri: url.pathname + url.search });
      response = await openResponse(url, { ...options, headers: { ...options.headers, Authorization: authorization }, tls });
      if (response.statusCode !== 401 || attempt === 1) return response;
      let next;
      try { next = parseChallenge(response.headers['www-authenticate']); } catch { return response; }
      if (next.stale !== 'true') return response;
      await readResponse(response, this.#maxResponseBytes);
      challenge = next;
    }
    return response;
  }

  #error(error, timeout, signal, method) {
    if (error instanceof HikvisionError) {
      if (!['GET', 'HEAD'].includes(method) && ['TRUNCATED_RESPONSE', 'RESPONSE_TOO_LARGE', 'INVALID_RESPONSE'].includes(error.code)) error.outcome = 'unknown';
      return error;
    }
    let result;
    if (signal?.aborted) result = new HikvisionError('ABORTED', '请求已取消。');
    else if (timeout.aborted) result = new HikvisionError('TIMEOUT', '设备请求超时，请检查地址、端口及设备服务状态。');
    else if (/CERT|TLS|SSL|SELF_SIGNED|VERIFY|ALTNAME/.test(error.code ?? '')) result = new HikvisionError('TLS_ERROR', 'HTTPS 连接或证书校验失败。');
    else result = new HikvisionError('NETWORK_ERROR', '无法连接设备或响应意外中断。');
    if (!['GET', 'HEAD'].includes(method)) result.outcome = 'unknown';
    return result;
  }

  async request({ path, method = 'GET', body, contentType, responseType = 'auto', signal, maxBytes } = {}) {
    const url = this.#url(path);
    return this.#requestUrl(url, { method, body, contentType, responseType, signal, maxBytes });
  }

  async #requestUrl(url, { method = 'GET', body, contentType, responseType = 'auto', signal, maxBytes } = {}) {
    if (typeof method !== 'string') throw new HikvisionError('INVALID_ARGUMENT', 'HTTP 方法必须是字符串。');
    method = method.toUpperCase();
    if (!['GET', 'POST', 'PUT', 'DELETE', 'HEAD'].includes(method)) throw new HikvisionError('INVALID_ARGUMENT', '不支持的 HTTP 方法。');
    if (!['auto', 'json', 'xml', 'text', 'buffer'].includes(responseType)) throw new HikvisionError('INVALID_ARGUMENT', '不支持的响应格式。');
    let input;
    if (body !== undefined) {
      if (['GET', 'HEAD'].includes(method)) throw new HikvisionError('INVALID_ARGUMENT', 'GET/HEAD 请求不应包含请求体。');
      if (typeof body === 'string' || body instanceof Uint8Array) input = Buffer.from(body);
      else {
        try { input = Buffer.from(JSON.stringify(body)); }
        catch { throw new HikvisionError('INVALID_ARGUMENT', '请求体不是可序列化的 JSON。'); }
        contentType ??= 'application/json; charset=utf-8';
      }
      if (input.length > this.#maxResponseBytes) throw new HikvisionError('REQUEST_TOO_LARGE', '请求体超过大小限制。');
    }
    if (contentType && (typeof contentType !== 'string' || /[\r\n]/.test(contentType))) throw new HikvisionError('INVALID_ARGUMENT', 'Content-Type 无效。');
    if (maxBytes !== undefined && (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > this.#maxResponseBytes)) throw new HikvisionError('INVALID_ARGUMENT', '响应大小限制无效。');
    const timeout = AbortSignal.timeout(this.#timeout);
    const combined = signal ? AbortSignal.any([timeout, signal]) : timeout;
    const started = performance.now();
    try {
      const response = await readResponse(await this.#authenticate(url, { method, body: input, signal: combined,
        headers: contentType ? { 'Content-Type': contentType } : {} }), maxBytes ?? this.#maxResponseBytes);
      const type = response.headers['content-type'] ?? 'application/octet-stream';
      const decoded = decodeResponse(response.bytes, type);
      const result = { status: response.status, contentType: type, format: decoded.format,
        elapsedMs: Math.round(performance.now() - started), bytes: response.bytes.length, data: decoded.data };
      if (response.status === 401) throw new HikvisionError('AUTHENTICATION_FAILED', '设备认证失败，请检查设备账号和密码。', { response: result });
      if (response.status >= 300 && response.status < 400) throw new HikvisionError('REDIRECT', '设备要求跳转，请确认协议和目标地址。', { response: result });
      const business = getBusinessError(decoded.data);
      if (response.status < 200 || response.status >= 300 || business) {
        const unsupported = response.status === 404 || /notSupport|notImplemented/i.test(business?.subStatusCode ?? '');
        throw new HikvisionError(unsupported ? 'UNSUPPORTED' : 'DEVICE_ERROR', business?.subStatusCode ? `设备返回错误：${business.subStatusCode}` : `设备返回 HTTP ${response.status}。`, { ...business, response: result });
      }
      if (responseType !== 'auto') Object.assign(result, decodeResponse(response.bytes, type, responseType));
      return result;
    } catch (error) { throw this.#error(error, timeout, signal, method); }
  }

  /** Download from the same device by default. External URLs require explicit opt-in; device credentials are never forwarded. */
  async downloadBytes(path, { allowExternal = false, signal, maxBytes = this.#maxImageBytes } = {}) {
    const url = this.#url(path, allowExternal);
    const result = await this.#requestUrl(url, { responseType: 'buffer', signal, maxBytes: Math.min(maxBytes, this.#maxResponseBytes) });
    return result;
  }

  async *stream({ path = '/ISAPI/Event/notification/alertStream', signal, idleTimeout = 60_000 } = {}) {
    const url = this.#url(path);
    if (!Number.isInteger(idleTimeout) || idleTimeout < 1000) throw new HikvisionError('INVALID_ARGUMENT', '流空闲超时至少 1000 毫秒。');
    const controller = new AbortController();
    const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    const timer = setTimeout(() => controller.abort(), this.#timeout); timer.unref();
    let response;
    try {
      response = await this.#authenticate(url, { method: 'GET', signal: combined });
      clearTimeout(timer);
      if (response.statusCode !== 200) {
        const raw = await readResponse(response, this.#maxResponseBytes);
        throw new HikvisionError(raw.status === 401 ? 'AUTHENTICATION_FAILED' : 'DEVICE_ERROR', `事件流返回 HTTP ${raw.status}。`);
      }
      response.setTimeout(idleTimeout, () => controller.abort());
      yield { headers: response.headers };
      for await (const chunk of response) yield { chunk };
    } catch (error) {
      if (signal?.aborted) return;
      if (controller.signal.aborted) throw new HikvisionError('TIMEOUT', '事件流连接或空闲等待超时。');
      throw this.#error(error, controller.signal, signal, 'GET');
    } finally { clearTimeout(timer); response?.destroy(); controller.abort(); }
  }
}

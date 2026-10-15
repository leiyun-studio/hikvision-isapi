import { HikvisionError } from '../sdk-error.js';

export class MultipartDecoder {
  #buffer = Buffer.alloc(0); #marker; #headers; #limit; #started = false; #closed = false;
  constructor(contentType, maxPartBytes = 10 * 1024 * 1024) {
    const match = /boundary\s*=\s*(?:"([^"\r\n]+)"|([^;\s\r\n]+))/i.exec(contentType ?? '');
    const boundary = match?.[1] ?? match?.[2];
    if (!boundary || boundary.length > 200) throw new HikvisionError('INVALID_RESPONSE', '事件流缺少有效的 multipart boundary。');
    this.#marker = Buffer.from('--' + boundary); this.#limit = maxPartBytes;
  }
  push(chunk) {
    if (this.#closed) return [];
    this.#buffer = Buffer.concat([this.#buffer, chunk]);
    const parts = [];
    while (true) {
      if (!this.#headers) {
        const index = this.#buffer.indexOf(this.#marker);
        if (index < 0) {
          if (this.#buffer.length > 65536) throw new HikvisionError('INVALID_RESPONSE', '事件流头部过大。');
          break;
        }
        if (index > 0) this.#buffer = this.#buffer.subarray(index);
        if (this.#buffer.length < this.#marker.length + 2) break;
        this.#started = true;
        const suffix = this.#buffer.subarray(this.#marker.length, this.#marker.length + 2).toString('ascii');
        if (suffix === '--') { this.#closed = true; this.#buffer = Buffer.alloc(0); break; }
        if (suffix !== '\r\n') throw new HikvisionError('INVALID_RESPONSE', '事件流 boundary 格式错误。');
        const end = this.#buffer.indexOf('\r\n\r\n', this.#marker.length);
        if (end < 0) {
          if (this.#buffer.length > 65536) throw new HikvisionError('INVALID_RESPONSE', '事件流头部过大。');
          break;
        }
        const headers = {};
        for (const line of this.#buffer.subarray(this.#marker.length + 2, end).toString('utf8').split('\r\n')) {
          const colon = line.indexOf(':');
          if (colon < 1) throw new HikvisionError('INVALID_RESPONSE', '事件流分段头部无效。');
          headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
        }
        if (headers['content-length'] !== undefined && (!/^\d+$/.test(headers['content-length']) || Number(headers['content-length']) > this.#limit)) {
          throw new HikvisionError('RESPONSE_TOO_LARGE', '事件流分段 Content-Length 无效或过大。');
        }
        this.#headers = headers;
        this.#buffer = this.#buffer.subarray(end + 4);
      }
      let end;
      if (this.#headers['content-length'] !== undefined) {
        end = Number(this.#headers['content-length']);
        if (this.#buffer.length < end + 2) break;
        if (this.#buffer.subarray(end, end + 2).toString() !== '\r\n') throw new HikvisionError('INVALID_RESPONSE', '事件流分段长度与边界不匹配。');
      } else {
        end = this.#buffer.indexOf(Buffer.concat([Buffer.from('\r\n'), this.#marker]));
        if (end < 0) break;
      }
      if (end > this.#limit) throw new HikvisionError('RESPONSE_TOO_LARGE', '事件流分段过大。');
      parts.push({ headers: this.#headers, bytes: Buffer.from(this.#buffer.subarray(0, end)) });
      this.#headers = undefined;
      this.#buffer = this.#buffer.subarray(end + 2);
    }
    if (this.#buffer.length > this.#limit + 65536) throw new HikvisionError('RESPONSE_TOO_LARGE', '事件流缓冲超过限制。');
    return parts;
  }
  finish() {
    if (!this.#started || this.#headers || (!this.#closed && this.#buffer.toString().trim())) {
      throw new HikvisionError('TRUNCATED_RESPONSE', '事件流在完整分段结束前关闭。');
    }
  }
}

import { setTimeout as delay } from 'node:timers/promises';
import { identifier, object, position, page, iterate } from './common.js';
import { imageInfo, imageReferences } from './images.js';
import { MultipartDecoder } from '../parsers/multipart.js';
import { decodeResponse, parseXml } from '../parsers/response.js';
import { HikvisionError } from '../sdk-error.js';

function eventRecord(record) { return { ...record, images: imageReferences(record), raw: record }; }
export function eventsResource(client) {
  const search = async (options = {}) => {
    const { startTime, endTime, major = 0, minor = 0, includePictures = true, employeeNo, signal, filters = {} } = options;
    for (const time of [startTime, endTime]) if (time !== undefined && (typeof time !== 'string' || !Number.isFinite(Date.parse(time)))) {
      throw new HikvisionError('INVALID_ARGUMENT', '时间必须是有效的 ISO 日期时间字符串。');
    }
    if (startTime && endTime && Date.parse(startTime) > Date.parse(endTime)) throw new HikvisionError('INVALID_ARGUMENT', '开始时间不能晚于结束时间。');
    if (![major, minor].every(value => Number.isInteger(value) && value >= 0) || typeof includePictures !== 'boolean') throw new HikvisionError('INVALID_ARGUMENT', 'major/minor 必须是非负整数，includePictures 必须是布尔值。');
    const cond = { ...object(filters), major, minor, picEnable: includePictures, ...position(options),
      ...(startTime ? { startTime } : {}), ...(endTime ? { endTime } : {}) };
    if (employeeNo !== undefined) cond.employeeNoString = identifier(employeeNo, 'employeeNo');
    const response = await client.request({ method: 'POST', path: '/ISAPI/AccessControl/AcsEvent?format=json', body: { AcsEventCond: cond }, signal });
    const result = page(response, 'AcsEvent', ['InfoList', 'MatchList'], options.offset ?? 0, cond.searchID);
    result.items = result.items.map(eventRecord);
    return result;
  };
  return Object.freeze({ search, iterate: options => iterate(search, options),
    capabilities: (options = {}) => client.request({ path: '/ISAPI/AccessControl/AcsEvent/capabilities?format=json', signal: options.signal }),
    subscribe: options => subscribe(client, options),
  });
}

async function* subscribe(client, { signal, reconnect = false, maxReconnects = 5, reconnectDelay = 1000,
  idleTimeout = 60000 } = {}) {
  if (typeof reconnect !== 'boolean' || !Number.isInteger(maxReconnects) || maxReconnects < 0 || maxReconnects > 1000
    || !Number.isInteger(reconnectDelay) || reconnectDelay < 0 || reconnectDelay > 60000) throw new HikvisionError('INVALID_ARGUMENT', '事件订阅重连参数无效。');
  let retries = 0;
  while (!signal?.aborted) {
    let pending;
    let count = 0;
    let size = 0;
    try {
      let decoder;
      for await (const packet of client.stream({ signal, idleTimeout })) {
        if (packet.headers) { decoder = new MultipartDecoder(packet.headers['content-type'], client.maxImageBytes); continue; }
        for (const part of decoder.push(packet.chunk)) {
          const contentType = part.headers['content-type'] ?? '';
          if (/^(application\/(?:json|xml)|text\/xml)/i.test(contentType)) {
            if (pending) yield { ...pending, complete: false };
            const decoded = decodeResponse(part.bytes, contentType);
            if (decoded.format !== 'json' && decoded.format !== 'xml') throw new HikvisionError('INVALID_RESPONSE', '实时事件未返回有效的 JSON 或 XML。');
            const data = decoded.format === 'xml' ? parseXml(decoded.data) : decoded.data;
            const event = data?.EventNotificationAlert ?? data;
            if (!event || typeof event !== 'object' || Array.isArray(event)) throw new HikvisionError('INVALID_RESPONSE', '实时事件不是有效对象。');
            const expected = Number(event?.AccessControllerEvent?.picturesNumber ?? event?.picturesNumber ?? 0);
            if (!Number.isInteger(expected) || expected < 0 || expected > 10) throw new HikvisionError('INVALID_RESPONSE', '事件声明的图片数量无效。');
            pending = { kind: 'event', event, raw: decoded.data,
              images: [...imageReferences(event), ...imageReferences(event.AccessControllerEvent)] };
            count = expected; size = part.bytes.length;
            if (count === 0) { yield { ...pending, complete: true }; pending = undefined; }
          } else if (/^image\//i.test(contentType)) {
            const info = imageInfo(part.bytes);
            const image = { type: 'inline', data: part.bytes, contentType: info.contentType,
              filename: /filename="([^"]+)"/i.exec(part.headers['content-disposition'] ?? '')?.[1] };
            if (pending && count > 0) {
              size += part.bytes.length;
              if (size > 32 * 1024 * 1024) throw new HikvisionError('RESPONSE_TOO_LARGE', '带图事件总大小超过 32 MiB。');
              pending.images.push(image); count--;
              if (count === 0) { yield { ...pending, complete: true }; pending = undefined; }
            } else yield { kind: 'image', images: [image], complete: true };
          }
        }
      }
      decoder?.finish();
      if (pending) yield { ...pending, complete: false };
      if (!reconnect || signal?.aborted) return;
    } catch (error) {
      if (signal?.aborted) return;
      if (pending) yield { ...pending, complete: false };
      if (!reconnect || !['NETWORK_ERROR', 'TIMEOUT', 'TRUNCATED_RESPONSE'].includes(error.code)) throw error;
      if (retries >= maxReconnects) throw error;
    }
    if (retries++ >= maxReconnects) return;
    try { await delay(Math.min(reconnectDelay * 2 ** Math.min(retries - 1, 6), 60000), undefined, { signal }); }
    catch (error) { if (signal?.aborted) return; throw error; }
  }
}

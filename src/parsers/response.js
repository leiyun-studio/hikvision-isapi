import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { HikvisionError } from '../sdk-error.js';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', removeNSPrefix: true,
  parseTagValue: false, parseAttributeValue: false, trimValues: false, processEntities: false });

export function parseXml(text) {
  if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(text) || XMLValidator.validate(text) !== true) {
    throw new HikvisionError('INVALID_RESPONSE', 'XML 格式不正确或包含不支持的实体定义。');
  }
  return parser.parse(text);
}

export function decodeResponse(bytes, contentType = '', responseType = 'auto') {
  const text = bytes.toString('utf8');
  if (responseType === 'buffer') return { data: bytes, format: 'binary' };
  if (responseType === 'text' || responseType === 'xml') return { data: text, format: responseType === 'xml' ? 'xml' : 'text' };
  if (responseType === 'json' || /json/i.test(contentType) || /^\s*[\[{]/.test(text)) {
    try { return { data: JSON.parse(text), format: 'json' }; } catch {
      if (responseType === 'json') throw new HikvisionError('INVALID_RESPONSE', '设备没有返回有效 JSON。');
    }
  }
  if (/xml/i.test(contentType) || /^\s*<(?:\?|\w)/.test(text)) return { data: text, format: 'xml' };
  if (/^(image\/|application\/octet-stream)/i.test(contentType)) return { data: bytes, format: 'binary' };
  return { data: text, format: 'text' };
}

export function getBusinessError(data) {
  let value = data;
  if (typeof value === 'string' && /<(?:\w+:)?ResponseStatus\b/.test(value)) value = parseXml(value);
  const status = value && typeof value === 'object' && !Buffer.isBuffer(value) ? value.ResponseStatus ?? value : undefined;
  const success = Number(status?.statusCode) === 1 || (Number(status?.statusCode) === 0 && /^ok$/i.test(status?.statusString ?? ''));
  if (status?.statusCode !== undefined && status.statusString !== undefined && !success) {
    return { deviceStatus: Number(status.statusCode), subStatusCode: status.subStatusCode, deviceErrorCode: status.errorCode };
  }
}

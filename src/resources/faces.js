import { randomBytes } from 'node:crypto';
import { identifier, object, position, page, iterate } from './common.js';
import { imageInput } from './images.js';
import { HikvisionError } from '../sdk-error.js';
import { runBatch, deleteBatch } from './batch.js';

function library({ libraryId = '1', faceLibType = 'blackFD' } = {}) {
  identifier(libraryId, 'libraryId');
  if (!['blackFD', 'staticFD'].includes(faceLibType)) throw new HikvisionError('INVALID_ARGUMENT', 'faceLibType 必须为 blackFD 或 staticFD。');
  return { FDID: libraryId, faceLibType };
}
export function facesResource(client) {
  const search = async (options = {}) => {
    const { employeeNo, signal, filters = {} } = options;
    const cond = { ...object(filters), ...library(options), ...position(options) };
    if (employeeNo !== undefined) cond.FPID = identifier(employeeNo, 'employeeNo');
    const response = await client.request({ method: 'POST', path: '/ISAPI/Intelligent/FDLib/FDSearch?format=json', body: cond, signal });
    return page(response, ['FDSearch', 'FDSearchResult', null], ['MatchList', 'FaceInfo'], options.offset ?? 0, cond.searchID);
  };
  const set = async ({ employeeNo, image, signal, metadata = {}, ...options } = {}, create = false) => {
    const data = { ...object(metadata), ...library(options), FPID: identifier(employeeNo, 'employeeNo') };
    const path = create ? '/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json' : '/ISAPI/Intelligent/FDLib/FDSetUp?format=json';
    if (image?.type === 'url' && (image.fetchBy ?? 'device') === 'device') {
      let url;
      try { url = new URL(image.url); } catch { throw new HikvisionError('INVALID_ARGUMENT', '人脸图片 URL 无效。'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) throw new HikvisionError('INVALID_ARGUMENT', '人脸图片 URL 必须是 HTTP/HTTPS 地址。');
      return client.request({ method: create ? 'POST' : 'PUT', path, body: { ...data, faceURL: image.url }, signal });
    }
    if (image?.type === 'url' && image.fetchBy !== 'sdk') throw new HikvisionError('INVALID_ARGUMENT', 'fetchBy 必须为 device 或 sdk。');
    const bytes = await imageInput(client, image, signal);
    delete data.faceURL;
    const boundary = 'hikvision-' + randomBytes(18).toString('hex');
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="FaceDataRecord"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="FaceImage"; filename="face.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      bytes, Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    return client.request({ method: create ? 'POST' : 'PUT', path, body, contentType: `multipart/form-data; boundary=${boundary}`, signal });
  };
  const remove = (ids, options = {}) => {
    const params = new URLSearchParams({ format: 'json', ...library(options) });
    return client.request({ method: 'PUT', path: `/ISAPI/Intelligent/FDLib/FDSearch/Delete?${params}`,
      body: { FPID: ids.map(value => ({ value })) }, signal: options.signal });
  };
  return Object.freeze({ search, iterate: options => iterate(search, options),
    set: options => set(options), create: options => set(options, true),
    capabilities: (options = {}) => client.request({ path: '/ISAPI/Intelligent/FDLib/capabilities?format=json', signal: options.signal }),
    delete: (employeeNo, options) => remove([identifier(employeeNo, 'employeeNo')], options),
    setMany: (items, options) => runBatch(items, item => object(item).employeeNo, (item, signal) => set({ ...item, signal }), options),
    deleteMany: (ids, options = {}) => {
      library(options);
      return deleteBatch(ids, (values, signal) => remove(values, { ...options, signal }),
        (id, signal) => remove([id], { ...options, signal }), options);
    },
  });
}

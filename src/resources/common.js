import { randomUUID, createHash } from 'node:crypto';
import { HikvisionError } from '../sdk-error.js';

export function identifier(value, name = '标识') {
  if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value) > 128 || /[\x00-\x1f\x7f]/.test(value)) {
    throw new HikvisionError('INVALID_ARGUMENT', `${name}必须是非空字符串，不能使用数字替代。`);
  }
  return value;
}
export function object(value, name = '参数') {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value instanceof Uint8Array) throw new HikvisionError('INVALID_ARGUMENT', `${name}必须是对象。`);
  return value;
}
export function position({ offset = 0, pageSize = 30, searchID = randomUUID().replaceAll('-', '') } = {}) {
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) {
    throw new HikvisionError('INVALID_ARGUMENT', 'offset 必须为非负整数，pageSize 必须在 1–1000 之间。');
  }
  identifier(searchID, 'searchID');
  return { searchID, searchResultPosition: offset, maxResults: pageSize };
}
export function asObject(response) {
  if (response.format !== 'json' || !response.data || typeof response.data !== 'object' || Array.isArray(response.data)) {
    throw new HikvisionError('INVALID_RESPONSE', '此接口未返回预期的 JSON 对象。', { response });
  }
  return response.data;
}
export function page(response, root, lists, offset, searchID) {
  const raw = asObject(response);
  const roots = Array.isArray(root) ? root : [root];
  const result = roots.map(key => key === null ? raw : raw[key]).find(value => value && typeof value === 'object'
    && !Array.isArray(value) && (value.responseStatusStrg !== undefined || value.totalMatches !== undefined || lists.some(key => Array.isArray(value[key]))));
  if (!result) throw new HikvisionError('INVALID_RESPONSE', '响应缺少有效的查询结果。', { response });
  let items = lists.map(key => result[key]).find(value => value !== undefined) ?? [];
  if (!Array.isArray(items)) throw new HikvisionError('INVALID_RESPONSE', '查询响应列表格式不正确。', { response });
  const state = result.responseStatusStrg;
  if (state !== undefined && !['OK', 'MORE', 'NO MATCH'].includes(state)) throw new HikvisionError('INVALID_RESPONSE', '未知的设备查询状态。', { response });
  const total = result.totalMatches === undefined ? undefined : Number(result.totalMatches);
  if (total !== undefined && (!Number.isSafeInteger(total) || total < 0)) throw new HikvisionError('INVALID_RESPONSE', '设备返回的总数无效。', { response });
  const hasMore = state === 'MORE' || (state === undefined && total !== undefined && offset + items.length < total);
  if (hasMore && items.length === 0) throw new HikvisionError('PAGINATION_ERROR', '设备报告还有数据，但返回空分页。');
  return { items, total, hasMore, searchID: result.searchID ?? searchID, nextPosition: offset + items.length, raw, response };
}
export async function* iterate(search, options = {}) {
  const { maxPages = 10000, ...filters } = options;
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100000) throw new HikvisionError('INVALID_ARGUMENT', 'maxPages 必须在 1–100000 之间。');
  const searchID = options.searchID ?? randomUUID().replaceAll('-', '');
  let offset = options.offset ?? 0;
  const seen = new Set();
  for (let index = 0; index < maxPages; index++) {
    const result = await search({ ...filters, searchID, offset });
    if (result.items.length) {
      const signature = createHash('sha256').update(JSON.stringify(result.items)).digest('hex');
      if (seen.has(signature)) throw new HikvisionError('PAGINATION_ERROR', '设备重复返回已读取的分页。');
      seen.add(signature);
    }
    for (const item of result.items) {
      if (options.signal?.aborted) throw new HikvisionError('ABORTED', '查询已取消。');
      yield item;
    }
    if (!result.hasMore) return;
    if (result.nextPosition <= offset) throw new HikvisionError('PAGINATION_ERROR', '设备分页位置没有前进。');
    offset = result.nextPosition;
  }
  throw new HikvisionError('PAGINATION_ERROR', '查询超过 maxPages，请缩小查询范围或调整上限。');
}

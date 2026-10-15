import { HikvisionError } from '../sdk-error.js';
import { identifier, object } from './common.js';

export function batchItems(items, getId) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 10000) {
    throw new HikvisionError('INVALID_ARGUMENT', '批量参数必须为包含 1–10000 项的数组。');
  }
  const ids = items.map(item => identifier(getId(item), '批量条目标识'));
  if (new Set(ids).size !== ids.length) throw new HikvisionError('INVALID_ARGUMENT', '同一次批量操作不能包含重复标识。');
  return ids;
}

function optionsFor(options) {
  object(options, '批量选项');
  const { concurrency = 1, stopOnError = false, signal } = options;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8 || typeof stopOnError !== 'boolean'
    || (signal !== undefined && !(signal instanceof AbortSignal))) {
    throw new HikvisionError('INVALID_ARGUMENT', 'concurrency 必须为 1–8 的整数，stopOnError 必须为布尔值，signal 必须为 AbortSignal。');
  }
  return { concurrency, stopOnError, signal };
}
function errorInfo(error) {
  return { code: error.code ?? 'BATCH_ITEM_ERROR', message: error.message ?? '批量条目执行失败。',
    ...(error.outcome ? { outcome: error.outcome } : {}),
    ...(error.subStatusCode ? { subStatusCode: error.subStatusCode } : {}),
    ...(error.response ? { response: error.response } : {}) };
}
function summary(strategy, results, signal, response) {
  const counts = { succeeded: 0, accepted: 0, failed: 0, unknown: 0, skipped: 0 };
  for (const result of results) counts[result.status]++;
  return { strategy, total: results.length, ...counts, aborted: signal?.aborted ?? false, results,
    ...(response ? { response } : {}) };
}

export async function runBatch(items, getId, worker, options = {}) {
  const ids = batchItems(items, getId);
  const { concurrency, stopOnError, signal } = optionsFor(options);
  const results = new Array(items.length);
  let next = 0; let stopped = false;
  async function run() {
    while (next < items.length && !stopped && !signal?.aborted) {
      const index = next++;
      try {
        const response = await worker(items[index], signal);
        results[index] = { index, id: ids[index], status: 'succeeded', response };
      } catch (error) {
        results[index] = { index, id: ids[index], status: error.outcome === 'unknown' ? 'unknown' : 'failed', error: errorInfo(error) };
        if (stopOnError) stopped = true;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  for (let index = 0; index < results.length; index++) {
    results[index] ??= { index, id: ids[index], status: 'skipped', reason: signal?.aborted ? 'aborted' : 'stopped' };
  }
  return summary('individual', results, signal);
}

// Native deletion returns a group acknowledgement, not per-ID completion results.
export async function deleteBatch(ids, nativeDelete, individualDelete, options = {}) {
  batchItems(ids, id => id);
  const { signal } = optionsFor(options);
  const strategy = options.strategy ?? 'native';
  if (!['native', 'individual'].includes(strategy)) throw new HikvisionError('INVALID_ARGUMENT', 'strategy 必须为 native 或 individual。');
  if (strategy === 'individual') {
    const result = await runBatch(ids, id => id, (id, itemSignal) => individualDelete(id, itemSignal), options);
    // The underlying delete endpoints may still be asynchronous even for one ID.
    for (const item of result.results) if (item.status === 'succeeded') item.status = 'accepted';
    return summary(strategy, result.results, signal);
  }
  if (signal?.aborted) return summary(strategy, ids.map((id, index) => ({ id, index, status: 'skipped', reason: 'aborted' })), signal);
  try {
    const response = await nativeDelete(ids, signal);
    return summary(strategy, ids.map((id, index) => ({ id, index, status: 'accepted' })), signal, response);
  } catch (error) {
    // A group-level device error may follow partial work; do not invent per-ID failures.
    const status = error.outcome === 'unknown' || error.code === 'DEVICE_ERROR' ? 'unknown' : 'failed';
    return summary(strategy, ids.map((id, index) => ({ id, index, status, error: errorInfo(error) })), signal);
  }
}

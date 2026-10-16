import { HikvisionError } from '../sdk-error.js';

// Explicit ownership avoids AbortSignal.any/timeout and lets us release timers
// and caller listeners as soon as an operation completes (including on Node 16).
export function cancellationScope(caller, timeoutMs) {
  if (caller !== undefined && !(caller instanceof AbortSignal)) {
    throw new HikvisionError('INVALID_ARGUMENT', 'signal 必须为 AbortSignal。');
  }
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  const timeout = () => { timedOut = true; cancel(); };
  if (caller?.aborted) cancel();
  else caller?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(timeout, timeoutMs);
  timer.unref();
  return {
    signal: controller.signal,
    get timedOut() { return timedOut; },
    timeout,
    clearTimer() { clearTimeout(timer); },
    dispose() {
      clearTimeout(timer);
      caller?.removeEventListener('abort', cancel);
    },
  };
}

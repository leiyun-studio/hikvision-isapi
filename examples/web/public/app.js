import { buildBaseUrl } from './connection.js';
import { sdkExample } from './sdk-example.js';

const $ = id => document.getElementById(id);
const connectionForm = $('connection-form');
const requestForm = $('request-form');
let activeController;
let responseText = '';
let responseFormat = 'txt';

function updateAddressMode() {
  const address = connectionForm.elements.addressMode.value === 'address';
  $('url-fields').hidden = address;
  $('base-url').disabled = address;
  $('address-fields').hidden = !address;
  for (const id of ['protocol', 'hostname', 'device-port']) $(id).disabled = !address;
}
for (const control of connectionForm.elements.addressMode) control.addEventListener('change', updateAddressMode);
$('protocol').addEventListener('change', () => {
  if (['80', '443'].includes($('device-port').value)) $('device-port').value = $('protocol').value === 'https:' ? '443' : '80';
});
$('toggle-password').addEventListener('click', () => {
  const show = $('password').type === 'password';
  $('password').type = show ? 'text' : 'password';
  $('toggle-password').textContent = show ? '隐藏' : '显示';
  $('toggle-password').setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
});

function connectionOptions() {
  const baseUrl = buildBaseUrl({ mode: connectionForm.elements.addressMode.value, baseUrl: $('base-url').value,
    protocol: $('protocol').value, hostname: $('hostname').value, port: $('device-port').value });
  return { baseUrl, username: $('username').value.trim(), password: $('password').value,
    timeout: Number($('timeout').value) * 1000, allowSelfSigned: $('allow-self-signed').checked };
}

function setState(state, message) {
  const labels = { loading: '请求中', success: '请求成功', error: '请求失败' };
  $('connection-state').textContent = labels[state];
  $('connection-state').className = `tag ${state}`;
  $('request-status').textContent = message;
  $('request-status').className = `request-status ${state === 'error' ? 'error' : ''}`;
}

async function send(path, endpoint = '/api/request', operation = {}) {
  if (activeController) return;
  if (!connectionForm.reportValidity()) return;
  let connection;
  try { connection = connectionOptions(); } catch (error) { setState('error', error.message); return; }
  $('connect-button').disabled = true;
  $('send-button').disabled = true;
  $('sdk-button').disabled = true;
  $('image-preview').hidden = true;
  $('image-preview').removeAttribute('src');
  $('copy-response').disabled = true;
  $('save-response').disabled = true;
  $('response-meta').hidden = true;
  $('response-body').hidden = true;
  $('empty-state').hidden = false;
  $('empty-state').querySelector('h3').textContent = '正在等待设备响应';
  $('empty-state').querySelector('p').textContent = '首次请求会自动完成 Digest 认证。';
  setState('loading', `正在请求 ${path}`);
  activeController = new AbortController();
  const timer = setTimeout(() => activeController?.abort(), operation.action?.endsWith('Many') ? 125000 : connection.timeout + 5000);
  try {
    const response = await fetch(endpoint, { method: 'POST', signal: activeController.signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connection, ...(endpoint === '/api/request' ? { path } : operation) }) });
    const payload = await response.json();
    const result = payload.result;
    if (result && typeof result.status === 'number' && typeof result.format === 'string') {
      $('response-meta').hidden = false;
      $('http-status').textContent = `HTTP ${result.status}`;
      $('http-status').className = `tag ${payload.ok ? 'success' : 'error'}`;
      $('response-format').textContent = result.contentType;
      $('elapsed').textContent = `${result.elapsedMs} ms`;
      $('response-size').textContent = `${result.bytes.toLocaleString()} B`;
      responseFormat = result.format === 'xml' ? 'xml' : result.format === 'json' ? 'json' : 'txt';
      responseText = typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);
    } else {
      responseFormat = 'json';
      responseText = JSON.stringify(payload.error ? payload : result ?? payload, null, 2);
      if (result?.encoding === 'base64') {
        const mime = result.data.startsWith('/9j/') ? 'image/jpeg' : result.data.startsWith('iVBOR') ? 'image/png' : 'image/webp';
        $('image-preview').src = `data:${mime};base64,${result.data}`;
        $('image-preview').hidden = false;
      }
    }
    $('empty-state').hidden = true;
    $('response-body').hidden = false;
    $('response-body').textContent = responseText;
    $('copy-response').disabled = false;
    $('save-response').disabled = false;
    setState(payload.ok ? 'success' : 'error', payload.ok ? '已收到设备响应。' : payload.error?.message ?? '请求失败。');
    if (payload.ok && result?.results && typeof result.total === 'number') {
      setState(result.failed || result.unknown || result.skipped ? 'error' : 'success',
        `批量结果：成功 ${result.succeeded}，已受理 ${result.accepted}，失败 ${result.failed}，结果未知 ${result.unknown}，未执行 ${result.skipped}。`);
    }
  } catch (error) {
    $('empty-state').hidden = true;
    $('response-body').hidden = false;
    $('response-body').textContent = '';
    setState('error', error.name === 'AbortError' ? '请求超时，请检查设备地址和网络。' : '无法连接本地测试服务，请确认启动命令仍在运行。');
  } finally {
    clearTimeout(timer);
    activeController = undefined;
    $('connect-button').disabled = false;
    $('send-button').disabled = false;
    $('sdk-button').disabled = false;
  }
}

connectionForm.addEventListener('submit', event => { event.preventDefault(); void send('/ISAPI/System/deviceInfo'); });
requestForm.addEventListener('submit', event => { event.preventDefault(); void send($('request-path').value.trim()); });
for (const button of document.querySelectorAll('[data-path]')) {
  button.addEventListener('click', () => {
    $('request-path').value = button.dataset.path;
    for (const preset of document.querySelectorAll('[data-path]')) preset.classList.toggle('active', preset === button);
  });
}
$('request-path').addEventListener('input', () => {
  for (const preset of document.querySelectorAll('[data-path]')) preset.classList.toggle('active', preset.dataset.path === $('request-path').value.trim());
});
$('copy-response').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(responseText); $('request-status').textContent = '响应已复制。'; }
  catch { $('request-status').textContent = '浏览器未允许复制，请在响应区域手动选择文本。'; }
});
$('save-response').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([responseText], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `isapi-response.${responseFormat}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener('pagehide', () => activeController?.abort());
updateAddressMode();

let actions = [];
function updateAction() {
  const action = actions.find(item => item.id === $('sdk-action').value);
  if (!action) return;
  const example = action.id === 'device.setTime' ? { ...action.example, localTime: new Date().toISOString() } : action.example;
  $('sdk-params').value = JSON.stringify(example, null, 2);
  $('write-confirmation').hidden = !action.write;
  $('confirm-write').checked = false;
  $('face-upload').hidden = !['faces.set', 'faces.create'].includes(action.id);
  $('face-file').value = '';
  updateCode();
}
function updateCode() {
  const action = actions.find(item => item.id === $('sdk-action').value);
  if (!action) return;
  try {
    const params = JSON.parse($('sdk-params').value);
    if (!params || Array.isArray(params) || typeof params !== 'object') throw new Error();
    let baseUrl;
    try { baseUrl = connectionOptions().baseUrl; } catch { /* Use the example address until a valid address is entered. */ }
    $('sdk-code').textContent = sdkExample(action.id, params, { baseUrl, username: $('username').value.trim() || 'admin' });
    $('copy-sdk-code').disabled = false;
    $('sdk-code-status').textContent = '代码随参数更新。设备密码使用环境变量 HIKVISION_PASSWORD。';
  } catch {
    $('sdk-code').textContent = '';
    $('copy-sdk-code').disabled = true;
    $('sdk-code-status').textContent = '参数 JSON 无效，请修正后查看示例代码。';
  }
}
$('sdk-params').addEventListener('input', updateCode);
connectionForm.addEventListener('input', updateCode);
connectionForm.addEventListener('change', updateCode);
$('copy-sdk-code').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('sdk-code').textContent); $('sdk-code-status').textContent = 'SDK 示例代码已复制。'; }
  catch { $('sdk-code-status').textContent = '复制失败，可在代码区域手动选择复制。'; }
});
$('sdk-action').addEventListener('change', updateAction);
$('sdk-form').addEventListener('submit', event => {
  event.preventDefault();
  const action = actions.find(item => item.id === $('sdk-action').value);
  if (!action) return;
  if (action.write && !$('confirm-write').checked) { setState('error', '请先勾选允许修改设备的确认项。'); return; }
  let params;
  try {
    params = JSON.parse($('sdk-params').value);
    if (!params || Array.isArray(params) || typeof params !== 'object') throw new Error();
  } catch { setState('error', '调用参数必须是有效的 JSON 对象。'); return; }
  void send(action.id, '/api/sdk', { action: action.id, params, confirmed: $('confirm-write').checked });
  $('confirm-write').checked = false;
});
$('face-file').addEventListener('change', async () => {
  const file = $('face-file').files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { setState('error', '人脸图片不能超过 10 MiB。'); return; }
  try {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const params = JSON.parse($('sdk-params').value);
    params.image = { type: 'base64', data };
    $('sdk-params').value = JSON.stringify(params, null, 2);
    updateCode();
  } catch { setState('error', '读取图片失败，请先检查 JSON 参数。'); }
});
fetch('/api/actions').then(response => {
  if (!response.ok) throw new Error();
  return response.json();
}).then(result => {
  actions = result;
  $('sdk-action').replaceChildren(...actions.map(action => {
    const option = document.createElement('option'); option.value = action.id;
    option.textContent = `${action.label}${action.write ? ' · 写入' : ''}`; return option;
  }));
  updateAction();
}).catch(() => setState('error', '接口列表加载失败，请刷新页面。'));

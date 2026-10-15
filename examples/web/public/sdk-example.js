// Returns code as text only. No generated code is executed by the browser.
export function sdkExample(action, params, { baseUrl = 'http://192.168.0.75:80', username = 'admin' } = {}) {
  let args = 'params';
  const method = action.split('.')[1];
  if (['createMany', 'updateMany', 'setMany'].includes(method)) args = 'params.items, params.options';
  else if (method === 'deleteMany') args = 'params.ids, params.options';
  else if (action === 'users.update') args = 'params.employeeNo, params.data';
  else if (action === 'cards.update') args = 'params.cardNo, params.data';
  else if (action === 'users.delete') args = 'params.employeeNo';
  else if (action === 'cards.delete') args = 'params.cardNo';
  else if (action === 'faces.delete') args = 'params.employeeNo, params';
  else if (action === 'doors.control') args = 'params.doorId, params.command';
  else if (action === 'device.getNtpServer') args = 'params.id';
  else if (action === 'device.setNtpServer') args = 'params.id, params.config';
  else if (action === 'device.setNtpServers') args = 'params.servers';
  else if (action === 'images.download') args = 'params.source, { as: params.as, allowExternal: params.allowExternal, ...(params.as === "file" ? { filePath: "./images/download.jpg" } : {}) }';
  const safeParams = JSON.stringify(params, (key, value) => key === 'data' && typeof value === 'string' && value.length > 4096 ? '<JPEG_BASE64>' : value, 2);
  const hints = [];
  if (action.startsWith('device.setNtp')) hints.push('// 设置 NTP 地址后，如需启用自动校时，再调用：\n// await client.device.setTime({ timeMode: "NTP", timeZone: "CST-8:00:00" });');
  if (method === 'deleteMany') hints.push('// accepted 表示设备已受理，需再查询确认删除完成；不要对 unknown 项直接重试。');
  return `import { HikvisionClient } from '@lystudio/hikvision-isapi';\n\nconst client = new HikvisionClient({\n  baseUrl: ${JSON.stringify(baseUrl)},\n  username: ${JSON.stringify(username)},\n  password: process.env.HIKVISION_PASSWORD,\n});\n\nconst params = ${safeParams};\nconst result = await client.${action}(${args});\nconsole.log(result);${hints.length ? '\n\n' + hints.join('\n') : ''}`;
}

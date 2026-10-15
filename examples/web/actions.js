import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { HikvisionError } from '../../src/index.js';

const entries = [
  ['device.getInfo', '设备 · 基本信息', false, {}],
  ['device.getTime', '设备 · 时间', false, {}],
  ['device.setTime', '设备 · 设置时间 / 校时模式', true, { timeMode: 'manual', localTime: new Date().toISOString(), timeZone: 'CST-8:00:00' }],
  ['device.getNtpServers', '设备 · NTP 服务器列表', false, {}],
  ['device.getNtpServer', '设备 · 查询 NTP 配置', false, { id: '1' }],
  ['device.setNtpServer', '设备 · 设置 NTP 服务器', true, { id: '1', config: { addressingFormatType: 'hostname', hostName: 'ntp.example.com', portNo: 123, synchronizeInterval: 60 } }],
  ['device.setNtpServers', '设备 · 替换 NTP 服务器列表', true, { servers: [{ id: '1', addressingFormatType: 'ipaddress', ipAddress: '192.168.0.1', portNo: 123, synchronizeInterval: 60 }] }],
  ['device.capabilities', '设备 · 能力集', false, { resource: 'accessControl' }],
  ['users.search', '人员 · 查询', false, { offset: 0, pageSize: 20 }],
  ['users.count', '人员 · 数量', false, {}],
  ['users.capabilities', '人员 · 能力集', false, {}],
  ['users.create', '人员 · 新增', true, { employeeNo: 'test001', name: '测试人员', userType: 'normal', Valid: { enable: false } }],
  ['users.update', '人员 · 修改', true, { employeeNo: 'test001', data: { name: '测试人员' } }],
  ['users.delete', '人员 · 删除', true, { employeeNo: 'test001' }],
  ['users.createMany', '人员 · 批量新增', true, { items: [{ employeeNo: 'test001', name: '测试人员一', userType: 'normal', Valid: { enable: false } }, { employeeNo: 'test002', name: '测试人员二', userType: 'normal', Valid: { enable: false } }], options: { concurrency: 1, stopOnError: false } }],
  ['users.updateMany', '人员 · 批量修改', true, { items: [{ employeeNo: 'test001', name: '修改姓名一' }, { employeeNo: 'test002', name: '修改姓名二' }], options: { concurrency: 1 } }],
  ['users.setMany', '人员 · 批量设置', true, { items: [{ employeeNo: 'test001', name: '测试人员', userType: 'normal', Valid: { enable: false } }], options: { concurrency: 1 } }],
  ['users.deleteMany', '人员 · 批量删除', true, { ids: ['test001', 'test002'], options: { strategy: 'native' } }],
  ['users.getDeleteProgress', '人员 · 删除处理进度', false, {}],
  ['cards.search', '卡片 · 查询', false, { offset: 0, pageSize: 20 }],
  ['cards.count', '卡片 · 数量', false, {}],
  ['cards.capabilities', '卡片 · 能力集', false, {}],
  ['cards.create', '卡片 · 新增', true, { employeeNo: 'test001', cardNo: '00001234', cardType: 'normalCard' }],
  ['cards.update', '卡片 · 修改', true, { cardNo: '00001234', data: { employeeNo: 'test001', cardType: 'normalCard' } }],
  ['cards.delete', '卡片 · 删除', true, { cardNo: '00001234' }],
  ['cards.set', '卡片 · 设置', true, { employeeNo: 'test001', cardNo: '00001234', cardType: 'normalCard' }],
  ['cards.setMany', '卡片 · 批量设置', true, { items: [{ employeeNo: 'test001', cardNo: '00001234', cardType: 'normalCard' }, { employeeNo: 'test002', cardNo: '00001235', cardType: 'normalCard' }], options: { concurrency: 1 } }],
  ['cards.createMany', '卡片 · 批量新增', true, { items: [{ employeeNo: 'test001', cardNo: '00001234', cardType: 'normalCard' }], options: { concurrency: 1 } }],
  ['cards.updateMany', '卡片 · 批量修改', true, { items: [{ cardNo: '00001234', cardType: 'normalCard' }], options: { concurrency: 1 } }],
  ['cards.deleteMany', '卡片 · 批量删除', true, { ids: ['00001234', '00001235'], options: { strategy: 'native' } }],
  ['faces.search', '人脸 · 查询', false, { employeeNo: 'test001', libraryId: '1', pageSize: 20 }],
  ['faces.capabilities', '人脸 · 能力集', false, {}],
  ['faces.set', '人脸 · 设置 / 更新', true, { employeeNo: 'test001', libraryId: '1', image: { type: 'url', url: 'https://example.com/face.jpg', fetchBy: 'device' } }],
  ['faces.create', '人脸 · 新增', true, { employeeNo: 'test001', libraryId: '1', image: { type: 'url', url: 'https://example.com/face.jpg', fetchBy: 'device' } }],
  ['faces.delete', '人脸 · 删除', true, { employeeNo: 'test001', libraryId: '1' }],
  ['faces.setMany', '人脸 · 批量设置', true, { items: [{ employeeNo: 'test001', libraryId: '1', image: { type: 'url', url: 'https://example.com/face1.jpg', fetchBy: 'device' } }, { employeeNo: 'test002', libraryId: '1', image: { type: 'url', url: 'https://example.com/face2.jpg', fetchBy: 'device' } }], options: { concurrency: 1 } }],
  ['faces.deleteMany', '人脸 · 批量删除', true, { ids: ['test001', 'test002'], options: { libraryId: '1', strategy: 'native' } }],
  ['doors.getStatus', '门 · 状态', false, {}],
  ['doors.capabilities', '门 · 控制能力集', false, {}],
  ['doors.control', '门 · 控制', true, { doorId: 1, command: 'open' }],
  ['events.capabilities', '事件 · 查询能力集', false, {}],
  ['events.search', '事件 · 历史记录', false, { startTime: new Date(Date.now() - 3600000).toISOString(), endTime: new Date().toISOString(), pageSize: 20, includePictures: true }],
  ['images.download', '图片 · 下载', false, { source: '/ISAPI/你的图片路径', as: 'base64' }],
];
export const actions = entries.map(([id, label, write, example]) => ({ id, label, write, example }));

export async function executeAction(client, action, params, { signal } = {}) {
  const [resource, method] = action.split('.');
  // File inputs refer to the SDK host. The web example accepts uploads as Base64 instead.
  if (resource === 'faces' && ['set', 'create'].includes(method) && !['url', 'base64'].includes(params.image?.type)) {
    throw new HikvisionError('INVALID_ARGUMENT', '网页人脸下发请使用 URL、Base64 或选择本地 JPEG 文件。');
  }
  if (action === 'faces.setMany' && (!Array.isArray(params.items) || params.items.some(item => !['url', 'base64'].includes(item?.image?.type)))) {
    throw new HikvisionError('INVALID_ARGUMENT', '网页批量人脸下发每项只支持 URL 或 Base64 图片。');
  }
  if (params.options !== undefined && (!params.options || typeof params.options !== 'object' || Array.isArray(params.options))) {
    throw new HikvisionError('INVALID_ARGUMENT', 'options 必须为对象。');
  }
  if (['createMany', 'updateMany', 'setMany'].includes(method)) return client[resource][method](params.items, { ...params.options, signal });
  if (method === 'deleteMany') return client[resource][method](params.ids, { ...params.options, signal });
  if (action === 'device.getNtpServer') return client.device.getNtpServer(params.id, { signal });
  if (action === 'device.setNtpServer') return client.device.setNtpServer(params.id, params.config, { signal });
  if (action === 'device.setNtpServers') return client.device.setNtpServers(params.servers, { signal });
  if (action === 'device.setTime') return client.device.setTime(params, { signal });
  if (action === 'users.update') return client.users.update(params.employeeNo, params.data, { signal });
  if (action === 'cards.update') return client.cards.update(params.cardNo, params.data, { signal });
  if (action === 'users.delete') return client.users.delete(params.employeeNo, { signal });
  if (action === 'cards.delete') return client.cards.delete(params.cardNo, { signal });
  if (action === 'faces.delete') return client.faces.delete(params.employeeNo, { ...params, signal });
  if (action === 'doors.control') return client.doors.control(params.doorId, params.command, { signal });
  if (['users', 'cards'].includes(resource) && ['create', 'set'].includes(method)) return client[resource][method](params, { signal });
  if (action === 'images.download') {
    const { source, as = 'buffer', allowExternal = false } = params;
    if (as === 'file') {
      const bytes = await client.images.download(source, { allowExternal, signal });
      const extension = bytes[0] === 255 ? 'jpg' : bytes[0] === 137 ? 'png' : 'webp';
      const filePath = fileURLToPath(new URL(`./downloads/${randomUUID()}.${extension}`, import.meta.url));
      return { as, filePath: await client.images.download(bytes, { as, filePath }) };
    }
    const result = await client.images.download(source, { as, allowExternal, signal });
    return { as, encoding: 'base64', data: Buffer.isBuffer(result) ? result.toString('base64') : result,
        note: as === 'buffer' ? 'SDK 返回 Buffer；网页接口使用 Base64 传输。' : undefined };
  }
  return client[resource][method]({ ...params, signal });
}

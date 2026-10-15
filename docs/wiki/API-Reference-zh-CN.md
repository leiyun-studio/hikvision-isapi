# API 参考

[Wiki 首页](Home-zh-CN.md) · [English](API-Reference.md)

## 接口分组

| 分组 | 方法 |
| --- | --- |
| `device` | `getInfo()`、`getTime()`、`setTime()`、`getNtpServers()`、`getNtpServer()`、`setNtpServer()`、`setNtpServers()`、`capabilities()` |
| `users` | `search()`、`iterate()`、`count()`、`capabilities()`、`create()`、`set()`、`update()`、`delete()`、`createMany()`、`setMany()`、`updateMany()`、`deleteMany()`、`getDeleteProgress()` |
| `cards` | `search()`、`iterate()`、`count()`、`capabilities()`、`create()`、`set()`、`update()`、`delete()`、`createMany()`、`setMany()`、`updateMany()`、`deleteMany()` |
| `faces` | `search()`、`iterate()`、`capabilities()`、`set()`、`create()`、`delete()`、`setMany()`、`deleteMany()` |
| `doors` | `getStatus()`、`capabilities()`、`control()`、`open()`、`close()` |
| `events` | `search()`、`iterate()`、`capabilities()`、`subscribe()` |
| `images` | `download()` |
| 通用 | `request()`、`downloadBytes()`、`stream()` |

普通设备操作返回 `{ status, contentType, format, elapsedMs, bytes, data }`。查询返回 `{ items, total, hasMore, searchID, nextPosition, raw, response }`，其中 `raw` 和 `response` 保留原始响应内容。设备扩展字段不会被统一模型过滤。

## 人员和卡片

```js
const page = await client.users.search({ employeeNo: '0001', pageSize: 20 });
for await (const user of client.users.iterate({ pageSize: 30 })) {
  console.log(user.employeeNo, user.name);
}

// 以下操作会修改设备，需要业务侧明确触发。
await client.users.create({
  employeeNo: '0001', name: '测试人员', userType: 'normal',
  Valid: { enable: true, beginTime: '2026-10-15T00:00:00', endTime: '2027-10-15T23:59:59' },
  doorRight: '1', RightPlan: [{ doorNo: 1, planTemplateNo: '1' }],
});
await client.users.update('0001', { name: '修改姓名' });
await client.cards.create({ employeeNo: '0001', cardNo: '00001234', cardType: 'normalCard' });
await client.cards.update('00001234', { employeeNo: '0001' });
await client.cards.delete('00001234');
await client.users.delete('0001');
```

工号、卡号、人脸库编号始终使用字符串，保留前导零。人员权限、有效期和计划模板应按设备能力填写，SDK 不自动创建权限计划。删除人员调用 `UserInfoDetail/Delete`，部分固件异步处理，返回成功不等于关联数据已全部删除完成，可再查询确认。

分页使用 `offset`、`pageSize`、`searchID`；继续某次查询可使用上一页的 `nextPosition` 和 `searchID`。`iterate()` 自动复用查询 ID 并推进位置，检测空 MORE、重复分页和 `maxPages` 上限，避免无休止拉取。页大小最终受设备能力限制。

## 门控制、原始请求和错误

```js
await client.doors.open(1);
await client.doors.control(1, 'alwaysClose'); // open / close / alwaysOpen / alwaysClose

const result = await client.request({
  method: 'POST', path: '/ISAPI/AccessControl/AcsEvent?format=json',
  body: { AcsEventCond: { searchID: 'custom-query-1', searchResultPosition: 0, maxResults: 20, major: 0, minor: 0 } },
});
```

`request()` 支持 JSON 对象、XML 字符串、Buffer / Uint8Array（可自行构造 multipart），使用 `contentType` 指定格式。`responseType` 支持 `auto/json/xml/text/buffer`；XML 默认保留原文，`parseXml()` 可解析且保留前导零。响应默认上限 16 MiB，可通过 `maxResponseBytes` 配置，上限 64 MiB。所有请求都可传 `signal`。

```js
try {
  await client.users.update('0001', { name: '修改姓名' });
} catch (error) {
  if (!(error instanceof HikvisionError)) throw error;
  console.error(error.code, error.subStatusCode, error.outcome);
  // error.response 保留设备响应；不要把其中个人信息直接写入公开日志。
}
```

常见错误码：`INVALID_ARGUMENT`、`AUTHENTICATION_FAILED`、`UNSUPPORTED_AUTH`、`UNSUPPORTED`、`DEVICE_ERROR`、`NETWORK_ERROR`、`TIMEOUT`、`ABORTED`、`TLS_ERROR`、`INVALID_RESPONSE`、`PAGINATION_ERROR`、`INVALID_IMAGE`、`IMAGE_UNAVAILABLE`、`FILE_EXISTS`。HTTP 200 中的设备错误也会抛出。

写入不会因网络错误自动重试。非 GET/HEAD 请求在超时、中断或无法确认响应结果时带 `outcome: 'unknown'`，表示设备可能已经处理，应先查询再决定是否重试。Digest 的 401 认证交互会重发同一份缓冲请求体。

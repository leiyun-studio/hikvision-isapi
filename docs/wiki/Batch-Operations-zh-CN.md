# 批量人员、卡片和人脸

[Wiki 首页](Home-zh-CN.md) · [English](Batch-Operations.md)

## 批量人员、卡片和人脸

```js
const created = await client.users.createMany([
  { employeeNo: '0001', name: '人员一', userType: 'normal', Valid: { enable: false } },
  { employeeNo: '0002', name: '人员二', userType: 'normal', Valid: { enable: false } },
], { concurrency: 1, stopOnError: false });

await client.users.updateMany([
  { employeeNo: '0001', name: '新姓名一' },
  { employeeNo: '0002', name: '新姓名二' },
]);
await client.cards.setMany([
  { employeeNo: '0001', cardNo: '00001234', cardType: 'normalCard' },
  { employeeNo: '0002', cardNo: '00001235', cardType: 'normalCard' },
]);
await client.faces.setMany([
  { employeeNo: '0001', image: { type: 'url', url: 'https://your-host.example/1.jpg' } },
  { employeeNo: '0002', image: { type: 'file', path: './2.jpg' } },
]);

const deleted = await client.users.deleteMany(['0001', '0002']);
await client.cards.deleteMany(['00001234', '00001235']);
await client.faces.deleteMany(['0001', '0002'], { libraryId: '1' });
console.log(created.results, deleted.accepted);
console.log((await client.users.getDeleteProgress()).data);
```

新增、修改、设置通过 SDK 逐项调用单项接口，默认串行；`concurrency` 可设为 1–8，结果顺序始终与输入一致。`set()` / `setMany()` 使用 `SetUp` 接口，不通过先查再写猜测新增或更新；设备是否支持需按能力确认。批量修改的每项将 ID 与修改字段放在同一对象中。

删除默认 `strategy: 'native'`，一次请求携带完整的 `EmployeeNoList`、`CardNoList` 或 `FPID` 列表。原生列表上限由设备决定，SDK 不会在出错后自动拆分重发。若设备只支持单项删除，可显式指定 `{ strategy: 'individual', concurrency: 1 }`；异步删除固件仍可能要求等待前一次处理完成，人员可查询 `getDeleteProgress()`。人脸原生批量删除的所有 ID 使用同一 `libraryId` 和 `faceLibType`。

每批接受 1–10000 项，ID 必须是唯一的字符串。SDK 执行的批量操作不是事务，不能自动回滚。返回值为：

```js
const exampleResult = {
  strategy: 'individual', total: 3,
  succeeded: 1, accepted: 0, failed: 1, unknown: 0, skipped: 1,
  aborted: false,
  results: [
    { index: 0, id: '0001', status: 'succeeded', response: /* 设备响应 */ {} },
    { index: 1, id: '0002', status: 'failed', error: { code: 'DEVICE_ERROR', message: '...' } },
    { index: 2, id: '0003', status: 'skipped', reason: 'stopped' },
  ],
};
```

`succeeded` 表示单项请求成功；删除的 `accepted` 表示已受理，**不保证该 ID 已经删除完成**。原生批量删除仅收到组级响应，因此整体设备错误标记为 `unknown`，不能据此判断哪些 ID 已删除。网络中断、写入超时等结果不明也标记为 `unknown`；先查询确认，不应直接重发。

默认某项失败后继续其他项。`stopOnError: true` 会停止尚未开始的任务，已启动的并发请求仍等待各自结果；`signal` 可取消整个队列，返回已获得的结果与未执行项。批量数据或选项整体无效时抛出 `INVALID_ARGUMENT`，设备单项错误汇总进 `results`，调用者需要检查计数，不能只判断 Promise 是否成功。

接口结构依据海康[明眸门禁协议](https://open.hikvision.com/hardware/v2/08%E5%8D%8F%E8%AE%AE%E9%80%8F%E4%BC%A0/%E6%98%8E%E7%9C%B8%E9%97%A8%E7%A6%81.html)。人员 `Record/Modify` 的请求主体是单个人员对象；删除支持 ID 列表。并非所有操作都能把单条请求体直接改成数组。

# 历史门禁事件和图片

[Wiki 首页](Home-zh-CN.md) · [English](Events-and-Images.md)

## 历史门禁事件和图片

```js
for await (const event of client.events.iterate({
  startTime: '2026-10-15T10:00:00+08:00',
  endTime: '2026-10-15T11:00:00+08:00',
  major: 0, minor: 0, includePictures: true, pageSize: 30,
})) {
  console.log(event.employeeNoString, event.time, event.raw);
  const image = event.images.find(item => item.type === 'url');
  if (!image) continue;

  const bytes = await client.images.download(image); // Buffer
  const base64 = await client.images.download(image, { as: 'base64' }); // 纯 Base64 字符串
  const localPath = await client.images.download(image, {
    as: 'file', filePath: `./images/${event.serialNo}.jpg`,
  }); // SDK 所在机器上的绝对路径
}
```

`images.download()` 也接受图片 URL 字符串、Buffer 或实时事件的内嵌图片对象。支持 JPEG、PNG、WebP 文件头识别，默认不覆盖已有文件；需要覆盖时显式传 `overwrite: true`。默认仅请求同一设备的 `/ISAPI/`、`/LOCALS/` 路径，签名查询参数保留。不同主机或端口的图片地址需要显式 `allowExternal: true`，外部请求不会携带设备凭据。

`includePictures` 会映射为 `picEnable`，它不能使设备生成已经不存在的图片。设备没有返回 URL 或二进制时，`images` 可能为空；只有文件名时返回 `type: 'reference'`，下载会抛 `IMAGE_UNAVAILABLE`，SDK 不猜测下载接口或按时间配图。历史截图与人员底库照片含义不同，SDK 不自动替换。

## 实时事件

```js
const controller = new AbortController();
process.once('SIGINT', () => controller.abort());

for await (const message of client.events.subscribe({
  signal: controller.signal,
  reconnect: true, maxReconnects: 5, reconnectDelay: 1000, idleTimeout: 60_000,
})) {
  console.log(message.kind, message.event, message.complete);
  for (const image of message.images) {
    if (image.type === 'inline') {
      const bytes = await client.images.download(image);
      // 按业务事件标识保存 bytes；不要仅按时间关联图片。
    }
  }
}
```

订阅解析 `/ISAPI/Event/notification/alertStream` 的 multipart JSON/XML 和图片分段。设备声明 `picturesNumber` 时按分段顺序收集对应图片，未声明归属的图片以独立 `kind: 'image'` 返回；`complete: false` 表示声明图片未收齐。设备没有发送图片时无法补造。`break` 或取消会关闭连接。

默认不重连；启用后仅对网络中断、超时和截断有限重连，最多 `maxReconnects` 次，延迟按指数增加至 60 秒。它不保证消息恰好一次送达，也不保证离线补传，业务需要按设备事件标识去重和补查。低层 `stream()` 可读取原始响应头与 Buffer 分块。

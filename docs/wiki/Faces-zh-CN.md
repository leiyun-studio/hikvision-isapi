# 人脸：URL、Buffer、Base64、本地文件

[Wiki 首页](Home-zh-CN.md) · [English](Faces.md)

## 人脸：URL、Buffer、Base64、本地文件

```js
// 原生 URL 下发：设备自行下载图片，设备必须能访问此 URL。
await client.faces.set({
  employeeNo: '0001', libraryId: '1',
  image: { type: 'url', url: 'https://your-host.example/face.jpg', fetchBy: 'device' },
});

// SDK 下载后通过 multipart 发送：适用于设备无法访问图片 URL 的情况。
await client.faces.set({
  employeeNo: '0001',
  image: { type: 'url', url: 'https://your-host.example/face.jpg', fetchBy: 'sdk' },
});

await client.faces.set({ employeeNo: '0001', image: jpegBuffer });
await client.faces.set({ employeeNo: '0001', image: { type: 'base64', data: jpegBase64 } });
await client.faces.set({ employeeNo: '0001', image: { type: 'file', path: './face.jpg' } });
const page = await client.faces.search({ employeeNo: '0001', libraryId: '1' });
await client.faces.delete('0001', { libraryId: '1' });
```

`set()` 使用 `PUT FDSetUp`，`create()` 使用 `POST FaceDataRecord`。URL 默认 `fetchBy: 'device'`。`libraryId` 默认 `'1'`、`faceLibType` 默认 `'blackFD'`，需要按目标设备实际库配置调整；其他字段可传 `metadata`。人脸输入要求 JPEG，SDK 不自动裁剪或转码；图片头校验不能代替设备的人脸质量检测。默认图片大小上限 10 MiB，可通过 `maxImageBytes` 配置。

URL 方式与对应接口依据海康的[明眸门禁 ISAPI 文档](https://open.hikvision.com/hardware/v2/08%E5%8D%8F%E8%AE%AE%E9%80%8F%E4%BC%A0/%E6%98%8E%E7%9C%B8%E9%97%A8%E7%A6%81.html)封装；具体设备是否支持、是否还需其他字段，应先查询能力集并实测。

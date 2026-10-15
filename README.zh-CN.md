# @lystudio/hikvision-isapi

[English](README.md) | **简体中文**

面向海康门禁设备的 Node.js ISAPI SDK。通过 JavaScript API 管理人员、卡片、人脸、门控制、设备时间和门禁事件，提供 TypeScript 类型声明。

## 功能特性

- 支持 HTTP/HTTPS、自定义端口及 Digest 认证。
- 人员、卡片管理；支持 URL、Buffer、Base64、本地 JPEG 文件下发人脸。
- 批量操作提供逐项结果、受控并发和取消能力。
- 历史事件查询、自动分页与实时订阅。
- 图片下载支持 `Buffer`、Base64、本地文件路径三种输出。
- 手动设置设备时间和配置 NTP 校时。
- 本地 HTML 测试台，可编辑参数并生成 SDK 示例代码。

## 环境与兼容性

- Node.js **22 或以上**，使用 ES Modules，附带 TypeScript 类型声明。
- 设备支持 ISAPI，运行 SDK 的机器能够访问设备，账号具备相应权限。
- 接口支持情况和必填字段随型号、固件变化，请先读取能力集并验证目标设备。

SDK 直接连接设备，不负责建立跨 NAT 的网络连接。门禁图片能否获取，取决于设备是否返回可用的图片地址或二进制数据。

## 安装

```sh
npm install @lystudio/hikvision-isapi
```

## 快速开始

业务项目的 `package.json` 设置 `"type": "module"` 后可使用 `.js`，也可使用 `.mjs`。先配置环境变量 `HIKVISION_BASE_URL`、`HIKVISION_USERNAME`、`HIKVISION_PASSWORD`。

```js
import { HikvisionClient, parseXml } from '@lystudio/hikvision-isapi';

const client = new HikvisionClient({
  baseUrl: process.env.HIKVISION_BASE_URL, // 例如 http://192.168.1.100:8080
  username: process.env.HIKVISION_USERNAME,
  password: process.env.HIKVISION_PASSWORD,
  timeout: 15_000,
});

const info = await client.device.getInfo();
console.log(info.format === 'xml' ? parseXml(info.data) : info.data);

const page = await client.users.search({ pageSize: 20 });
console.log(page.items);
```

## 使用示例

以下示例复用快速开始中的 `client`，人脸下发会写入设备。

```js
for await (const user of client.users.iterate({ pageSize: 30 })) {
  console.log(user.employeeNo, user.name);
}

// 替换为设备可访问的真实 JPEG 地址。
await client.faces.set({
  employeeNo: '0001',
  image: { type: 'url', url: 'https://images.example.com/face.jpg', fetchBy: 'device' },
});

const events = await client.events.search({
  startTime: '2026-10-15T00:00:00+08:00',
  endTime: '2026-10-15T23:59:59+08:00',
  includePictures: true,
});
console.log(events.items);
```

工号和卡号使用字符串，保留前导零。批量删除返回已受理不代表删除完成。写入遇到网络错误不会自动重试；出现 `outcome: 'unknown'` 时应先查询设备状态。

## HTML 测试台

在源码仓库中使用 `npm ci` 安装开发依赖，然后执行：

```sh
npm run example:web
```

打开 **http://127.0.0.1:3050**，输入 `baseUrl` 或 IP/主机名及端口、账号和密码。选择操作后显示可编辑的 JSON 参数与可复制的 SDK 示例。写入操作需要明确确认，测试台不持久化账号密码。Fastify 为开发依赖，测试台不属于 SDK 运行时。

## 文档

完整用法见[在线中文 Wiki](https://github.com/leiyun-studio/hikvision-isapi/wiki/Home-zh-CN)，也提供 [English Wiki](https://github.com/leiyun-studio/hikvision-isapi/wiki)。仓库和 npm 包内同时保留[本地文档](docs/wiki/Home-zh-CN.md)。

| 指南 | 内容 |
| --- | --- |
| [客户端配置](docs/wiki/Configuration-zh-CN.md) | 配置项、认证、TLS、响应格式 |
| [API 参考](docs/wiki/API-Reference-zh-CN.md) | 接口分组、增删改查、分页、原始请求与错误 |
| [批量操作](docs/wiki/Batch-Operations-zh-CN.md) | 原生批量删除、SDK 队列、部分成功结果 |
| [人脸管理](docs/wiki/Faces-zh-CN.md) | URL 与二进制下发、人脸库配置 |
| [事件与图片](docs/wiki/Events-and-Images-zh-CN.md) | 历史查询、订阅、图片下载与缺图说明 |
| [设备时间](docs/wiki/Device-Time-zh-CN.md) | 手动时间与 NTP |
| [网页测试台](docs/wiki/Web-Console-zh-CN.md) | 交互测试与示例代码 |
| [开发指南](docs/wiki/Development-zh-CN.md) | 目录结构、验证与贡献流程 |

Wiki 源文件随仓库维护，可按[发布指南](docs/WIKI-PUBLISHING.md)同步到独立的 GitHub Wiki 仓库。

## 开发与贡献

```sh
npm ci
npm run check          # 自动化测试、类型检查与构建
npm run pack:verify    # 在独立项目中验证安装、导入和类型
```

修改公共 API 时，请同步类型声明、示例、测试及两种语言的文档。反馈设备问题时，请提供型号、固件、SDK 版本及脱敏后的请求和响应。自动化测试使用本地模拟设备，通过测试不等于兼容所有固件。

## 许可证

本项目采用 [MIT 许可证](LICENSE)。

# 运行环境兼容性

[Wiki 首页](Home-zh-CN.md) · [English](Compatibility.md)

## SDK 与开发工具分开要求

| 使用方式 | Node.js 要求 |
| --- | --- |
| 业务项目安装 SDK | 16.20.2 或以上 |
| 源码开发、构建、类型检查和完整测试 | 22 或以上 |
| Fastify 网页测试台 | 22 或以上 |

发布包包含预构建的 JavaScript。业务项目安装 SDK 不需要 Fastify、仓库测试框架或 SDK 构建工具。包内附带 TypeScript 声明，TypeScript 编译器兼容性与 Node 运行环境是两个维度。

## 已验证版本

Windows x64 环境下，Node **16.20.2、18.0.0、20.0.0、22.0.0、24.9.0** 均通过相同的 36 项核心用例。覆盖 Digest 认证、业务请求、人脸及图片、分页、批量操作、时间/NTP、实时订阅、取消、超时以及监听器和连接清理。

SDK 自行管理取消信号转发及超时定时器，不再依赖 `AbortSignal.any()`。超时或取消时会显式终止 HTTP 请求与响应流，覆盖 Digest 认证阶段及响应体读取过程。

当前不支持 Node 14：仍存在不受支持的语法和运行时 API。此前的 Node 14 报告作为历史基线保留，不表示已完成适配。

验证使用本地模拟设备，不代表覆盖全部设备型号、固件、操作系统或未来 Node 版本。仓库附带 Windows/Linux 多版本 CI 配置；本地验证结果不代表远程 CI 已执行。

## CommonJS 项目

SDK 使用 ESM 发布，Node 16 的 CommonJS 项目可在 async 函数中动态导入：

```js
async function main() {
  const { HikvisionClient } = await import('@lystudio/hikvision-isapi');
  const client = new HikvisionClient({
    baseUrl: process.env.HIKVISION_BASE_URL,
    username: process.env.HIKVISION_USERNAME,
    password: process.env.HIKVISION_PASSWORD,
  });
  console.log((await client.device.getInfo()).data);
}
main().catch(console.error);
```

当前不提供独立的同步 `require()` 构建。浏览器页面需要通过 Node 后端调用 SDK，无法直接使用 Node 的 HTTP/文件系统接口。

## 复现

使用 Node 22+ 执行 `npm ci` 和 `npm run build`，再切换到目标运行时执行 `node scripts/probe-node-compatibility.js`。验证脚本只适配旧版测试脚手架，不向 SDK 注入 polyfill 或进行转译。

源码仓库的 `docs/compatibility/` 保存了详细 JSON 结果和安装验证命令。低版本兼容用于存量项目接入，新部署仍建议使用处于维护期的 Node 版本。

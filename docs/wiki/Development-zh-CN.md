# 开发与贡献

[Wiki 首页](Home-zh-CN.md) · [English](Development.md)

## 本地开发

源码开发和构建工具使用 Node.js 22 或以上；业务项目安装 SDK 后可在 Node.js 16.20.2 或以上运行。在源码仓库执行：

```sh
npm ci
npm run check
npm run example:web
```

`npm run check` 依次运行测试、公共类型检查并构建 `dist/`。测试使用模拟设备，不需要真实设备账号。

## 打包验证

```sh
npm pack
npm run pack:verify
```

第一个命令按当前版本生成 `lystudio-hikvision-isapi-0.1.0.tgz`。验证脚本会重新打包，在独立临时项目中安装，检查导入、模拟请求及 TypeScript 消费端。上述命令不会发布包。

在其他业务项目安装：

```sh
npm install /path/to/lystudio-hikvision-isapi-0.1.0.tgz
```

包内包含生成的 SDK 和文档。Fastify 是开发依赖，网页服务、设备凭据和测试数据不进入发布包。

## 目录结构

```text
src/index.js             SDK 公共导出
src/index.d.ts           公共类型声明
src/client.js            客户端与传输调度
src/resources/           人员、卡片、人脸、事件、时间、图片及批量操作
src/transport/           HTTP 与 Digest
src/parsers/             响应及 multipart 解析
examples/basic.js        只读连接示例
examples/subscribe.js    实时订阅示例
examples/web/            Fastify + HTML 测试台
test/                    模拟设备测试
type-tests/              TypeScript 消费端检查
docs/wiki/               双语 Wiki 源文件
dist/                    生成的 SDK
```

`src/app.js`、`src/server.js` 中的独立健康检查服务不属于 SDK 发布包。该服务的 `npm start` 命令读取 `.env`，需要使用时可复制 `.env.example`。

## 运行源码示例

先配置环境变量 `HIKVISION_BASE_URL`、`HIKVISION_USERNAME`、`HIKVISION_PASSWORD`，然后运行：

```sh
node examples/basic.js
node examples/subscribe.js
```

基础示例读取设备信息和人员，订阅示例使用 Ctrl+C 停止。账号密码不要写进提交文件。

## 贡献流程

1. 尽可能使用本地模拟设备复现问题。
2. 同步修改 SDK 实现和公共类型声明。
3. 为行为变化增加必要测试，涉及失败或取消时覆盖相应路径。
4. 同步中英文文档及示例。
5. 执行 `npm run check`；涉及包或公共 API 时执行 `npm run pack:verify`。

设备问题请附型号、固件、SDK/Node 版本、期望行为及脱敏的请求响应。分享前移除账号密码、会话 Cookie、人员记录与人脸数据。

## 发布信息

项目采用 MIT 许可证，仓库和 npm 包内均包含 `LICENSE`。每次发布前更新版本与发布说明。源码仓库为 [leiyun-studio/hikvision-isapi](https://github.com/leiyun-studio/hikvision-isapi)，问题反馈请使用仓库的 [Issues](https://github.com/leiyun-studio/hikvision-isapi/issues)。

Wiki 源文件与代码一起维护。GitHub Wiki 使用独立仓库，源码仓库中的 `docs/WIKI-PUBLISHING.md` 提供手动发布流程，仅推送主仓库不会自动发布 Wiki 页面。

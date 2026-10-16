# Node.js compatibility validation / Node.js 兼容性验证

Validated on 2026-10-16, Windows x64, SDK 0.1.0 with the Node 16 compatibility changes. The SDK now declares `node >=16.20.2`. Development tooling and the Fastify console continue to require Node 22+.

2026-10-16 在 Windows x64 上验证 SDK 0.1.0 的 Node 16 兼容改动。SDK 声明支持 `node >=16.20.2`，开发工具与 Fastify 测试台仍使用 Node 22+。

## Results / 结果

| Runtime | Core cases / 核心用例 | Report |
| --- | --- | --- |
| Node 16.20.2 | 36 passed / 全部通过 | [JSON](node-16.20.2.json) |
| Node 18.0.0 | 36 passed / 全部通过 | [JSON](node-18.0.0.json) |
| Node 20.0.0 | 36 passed / 全部通过 | [JSON](node-20.0.0.json) |
| Node 22.0.0 | 36 passed / 全部通过 | [JSON](node-22.0.0.json) |
| Node 24.9.0 | 36 passed / 全部通过 | [JSON](node-24.9.0.json) |

The full development suite also passes 48 tests on Node 24.9.0, followed by TypeScript checking and a build. The runtime matrix is a focused SDK suite and does not count web-console tests.

Node 24.9.0 上完整开发测试为 48 项，通过后完成类型检查与构建。多版本矩阵使用聚焦 SDK 的核心用例，不包含网页测试台测试。

## Installation / 安装验证

Node **16.20.2 + npm 8.19.4** successfully installs the local npm archive into an isolated project with `--engine-strict --omit=dev --ignore-scripts`. The installed package passes CommonJS dynamic import, XML parsing, HTTP reading, request timeout, and caller cancellation checks. See the [installation report](install-node-16.20.2.json).

在独立临时项目中，使用 Node **16.20.2 + npm 8.19.4** 和上述参数安装本地压缩包成功。安装后的包通过 CommonJS 动态导入、XML、HTTP 读取、请求超时和取消验证。没有通过关闭 engine 检查绕过版本要求。

## Changes / 实现改动

- Own the operation's timeout timer and caller-signal listener, and release both when finished; remove reliance on `AbortSignal.any()` and `AbortSignal.timeout()`.
- On timeout or abort, explicitly destroy the HTTP request and response stream, including after headers and during Digest challenge reads.
- Bound non-200 event-stream response bodies with the connection deadline.
- Preserve uncertain-write reporting and avoid replaying failed writes as network retries.

改动集中在取消信号与 HTTP 传输层：自行管理定时器和监听器、显式中断请求与响应流，并保证 Digest 及事件订阅异常响应仍受超时限制。人员、卡片、人脸等业务接口保持原有调用方式。

New regressions exercise listener cleanup after repeated successful/error requests, pre-aborted requests, stalled response and authentication bodies, in-flight batch cancellation, subscription idle deadlines, and cancellation during reconnect backoff.

新增回归覆盖重复成功/失败后的监听器清理、提前取消、响应体与认证阶段挂起、批量执行中取消、订阅空闲超时及重连等待时取消。

## Historical baseline / 历史基线

Before adaptation, Node 16 passed 24 of 28 cases and failed four timeout/cancellation cases: [baseline report](node-16.20.2-before.json). Node 14 failed to import because of `??=` syntax and also lacked required APIs: [Node 14 baseline](node-14.21.3.json).

适配前 Node 16 为 24/28 通过，四项失败集中在超时与取消。Node 14 的历史报告显示导入及 API 障碍，当前仍不支持 Node 14；该报告不是本次改动后的复测结果。

## Method and limits / 方法与范围

The probe executes built `dist/` code with the installed dependency tree. It reuses `sdk.test.js`, `events-stream.test.js`, `batch-time.test.js`, and `cancellation.test.js`, plus three caller-signal checks. Only test scaffolding is adapted: a sequential runner replaces `node:test`, and the fixture tracks sockets for legacy teardown. No runtime polyfills or transformations are injected into the SDK by the probe.

验证直接运行构建产物，复用四个核心测试文件并增加三个 signal 检查。为适配旧运行时，只替换测试执行器及模拟服务器的清理方式，不向 SDK 注入补丁或进行转译。

All device requests target local simulated servers. These checks do not certify device firmware, every Node patch release, older TypeScript compilers, or all operating systems. The checked-in GitHub Actions matrix covers Windows/Linux, but local reports do not imply remote CI has run. A separate synchronous CommonJS bundle is not included; legacy CommonJS applications can use dynamic import.

所有设备请求均指向本地模拟服务器，不代表认证全部固件、所有 Node 小版本、旧 TypeScript 编译器或全部操作系统。已添加 Windows/Linux CI 配置，本地报告不表示远程 CI 已运行。当前没有独立同步 CommonJS 构建，CommonJS 项目可使用动态导入。

## Reproduce / 复现

Use Node 22+ to install development dependencies and build:

先使用 Node 22+ 安装开发依赖并构建：

```sh
npm ci
npm run check
npm run pack:verify
```

Run each target runtime without replacing the globally installed Node:

通过 npm 缓存调用指定运行时，不替换系统全局 Node：

```sh
npm exec --yes --package=node@16.20.2 -- node scripts/probe-node-compatibility.js docs/compatibility/node-16.20.2.json
npm exec --yes --package=node@18.0.0 -- node scripts/probe-node-compatibility.js docs/compatibility/node-18.0.0.json
npm exec --yes --package=node@20.0.0 -- node scripts/probe-node-compatibility.js docs/compatibility/node-20.0.0.json
npm exec --yes --package=node@22.0.0 -- node scripts/probe-node-compatibility.js docs/compatibility/node-22.0.0.json
npm exec --yes --package=node@24.9.0 -- node scripts/probe-node-compatibility.js docs/compatibility/node-24.9.0.json
```

After packing, verify a fresh production install with legacy npm:

打包后验证旧 npm 的全新生产依赖安装：

```sh
npm exec --yes --package=node@16.20.2 --package=npm@8.19.4 -- npm exec -- node scripts/verify-runtime-install.js docs/compatibility/install-node-16.20.2.json
```

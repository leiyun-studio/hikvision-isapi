# HTML 测试台

[English guide](../../docs/wiki/Web-Console.md) · [中文 Wiki](../../docs/wiki/Web-Console-zh-CN.md) · [项目首页](../../README.zh-CN.md)

使用 Node.js 22 或以上，在仓库中执行 `npm install` 和 `npm run example:web`，打开 <http://127.0.0.1:3050>。核心 SDK 的最低运行版本为 Node.js 16.20.2，与测试台的开发依赖分开。默认仅监听本机。自定义端口可在 PowerShell 使用 `$env:WEB_EXAMPLE_PORT='3051'`。

连接支持完整 `baseUrl`，或协议、IP/主机、端口分开输入；账号密码不保存在浏览器或文件中。HTTPS 默认验证证书，测试自签名设备时可勾选允许不受信任证书。

选择“SDK 接口测试”中的接口，编辑 JSON 参数并调用。覆盖设备信息、能力集、人员、卡片、人脸、门状态/控制、历史事件、图片下载。写入接口需要每次勾选确认；默认预设不会自行发送请求。人脸可传 URL（`fetchBy: device/sdk`），也可选择本地 JPEG，由浏览器转成 Base64。

同时支持人员批量新增/修改/删除、人脸批量设置/删除、卡片批量设置/删除，以及设备时间、校时模式和 NTP 参数配置。批量请求显示成功、已受理、失败、结果未知和未执行数量；默认串行，原生批量删除返回“已受理”时需继续查询确认完成。测试台单次操作最多运行 120 秒，页面断开时取消正在执行的请求并停止后续任务；已送达设备的写入无法撤回。

选择接口后，下方显示可复制的 Node.js SDK 示例。修改 JSON 参数、设备地址或用户名时，代码同步更新；设备密码使用 `process.env.HIKVISION_PASSWORD`。较大的 Base64 图片用占位符展示，需要自行补入数据。设置 NTP 地址后，可选择“设置时间 / 校时模式”，传 `{"timeMode":"NTP","timeZone":"CST-8:00:00"}` 开启自动校时。

图片 `as: buffer/base64/file` 与 SDK 对应：Buffer 在网页接口中用 Base64 传输，页面显示图片预览；file 模式由 SDK 保存到 `examples/web/downloads/`，返回测试服务机器上的路径，不接受任意服务器文件路径。原始请求面板仅允许 GET。实时订阅见 `examples/subscribe.js`。

测试台用于本地调试，需要运行它的电脑能访问设备，不提供账号管理或远程部署功能。SDK 使用示例中的公共入口导入；npm 发布包仅包含 SDK，不包含本页面或 Fastify 服务。

# 海康 ISAPI SDK Wiki

[English](Home.md) · **简体中文**

本文档介绍 `@lystudio/hikvision-isapi`，用于直接调用海康门禁设备 ISAPI。要求 Node.js 22 或以上，使用 JavaScript ES Modules，并提供 TypeScript 类型声明。

## 入门顺序

1. 使用 `npm install @lystudio/hikvision-isapi` 安装 SDK；源码构建方式见[开发指南](Development-zh-CN.md)。
2. [创建客户端](Configuration-zh-CN.md)，填写设备地址与账号密码。
3. 在[网页测试台](Web-Console-zh-CN.md)读取能力集，先验证只读操作。
4. 根据业务需求使用各资源接口。

## 文档目录

- [客户端配置](Configuration-zh-CN.md)
- [API 参考](API-Reference-zh-CN.md)
- [批量操作](Batch-Operations-zh-CN.md)
- [人脸管理](Faces-zh-CN.md)
- [事件与图片](Events-and-Images-zh-CN.md)
- [设备时间与 NTP](Device-Time-zh-CN.md)
- [网页测试台](Web-Console-zh-CN.md)
- [开发与贡献](Development-zh-CN.md)

## 阅读约定

除创建客户端示例外，代码片段默认已有 `client`。示例日期、工号、图片地址及服务器地址需按实际情况替换。新增、修改、删除、开门和校时示例执行后会改变设备状态。

工号、卡号等标识使用字符串。SDK 保留设备扩展字段，接口支持情况以设备型号及固件为准；模拟测试不能替代目标设备验证。

SDK 不负责建立与内网设备的网络连接，也无法补造设备未提供的事件图片。详见[事件与图片](Events-and-Images-zh-CN.md)及 [API 参考](API-Reference-zh-CN.md)。

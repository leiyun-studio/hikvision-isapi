# 创建客户端

[Wiki 首页](Home-zh-CN.md) · [English](Configuration.md)

## 配置项

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `baseUrl` | 必填 | HTTP/HTTPS origin，可带自定义端口；不接受路径、查询参数、片段或内嵌凭据 |
| `username`、`password` | 必填 | 非空设备账号密码 |
| `timeout` | 15000 | 毫秒，包含认证和响应读取，范围 1000–300000 |
| `maxResponseBytes` | 16 MiB | 缓冲响应上限，最大 64 MiB |
| `maxImageBytes` | 10 MiB | 图片大小上限，最大 64 MiB |
| `tls.ca` | 系统信任 | 自定义 CA 证书 |
| `tls.rejectUnauthorized` | true | 是否验证设备证书 |

外部图片下载始终验证 TLS。取消操作不会撤回已送达设备的写入。

## 创建客户端

```js
import { HikvisionClient, HikvisionError, parseXml } from '@lystudio/hikvision-isapi';

const client = new HikvisionClient({
  baseUrl: 'http://192.168.0.75:80', // 支持 HTTPS、域名、IPv6、自定义端口
  username: process.env.HIKVISION_USERNAME,
  password: process.env.HIKVISION_PASSWORD,
  timeout: 15_000,                 // 毫秒，包含认证交互和响应读取
});

const info = await client.device.getInfo();
console.log(info.data);            // JSON 对象或 XML 原文
if (info.format === 'xml') console.log(parseXml(info.data));
```

每个客户端对应一台设备，账号密码保留在实例私有字段。默认校验 HTTPS 证书，可通过 `tls.ca` 配置设备 CA；测试自签名设备可显式设置 `tls: { rejectUnauthorized: false }`。设备凭据不会发送给外部图片服务器，也不会跟随重定向。

SDK 使用 Digest 认证，支持 MD5、SHA-256、SHA-512-256 及其 sess 形式、`qop=auth` 或无 qop；不支持 Basic、auth-int 或 userhash。当前 mock 测试验证了 MD5、SHA-256 和对应 sess 形式。

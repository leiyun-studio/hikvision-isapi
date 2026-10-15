# 设备时间与 NTP

[Wiki 首页](Home-zh-CN.md) · [English](Device-Time.md)

## 设备时间与 NTP

```js
console.log((await client.device.getTime()).data);
await client.device.setTime({
  timeMode: 'manual',
  localTime: '2026-10-15T10:30:00+08:00',
  timeZone: 'CST-8:00:00',
});

console.log((await client.device.getNtpServers()).data);
console.log((await client.device.getNtpServer('1')).data);
await client.device.setNtpServer('1', {
  addressingFormatType: 'hostname', hostName: 'ntp.example.com',
  portNo: 123, synchronizeInterval: 60,
});
// 配置服务器与开启校时是两个操作；前一步成功后再切换模式。
await client.device.setTime({ timeMode: 'NTP', timeZone: 'CST-8:00:00' });

// 支持多服务器的设备可整体替换列表。
await client.device.setNtpServers([
  { id: '1', addressingFormatType: 'ipaddress', ipAddress: '192.168.0.1', portNo: 123, synchronizeInterval: 60 },
]);
```

时间设置使用 `PUT /ISAPI/System/time`，发送 XML `Time`。手动时间必须带时区，SDK 保留输入值，不自动转换为本机时区。`timeZone` 使用设备支持的 POSIX 格式，示例 `CST-8:00:00` 对应 UTC+8，不能直接替换为 `Asia/Shanghai`。建议先读取设备时间配置确认格式。

NTP 使用 `/ISAPI/System/time/ntpServers` 及 `/{id}` 的 GET/PUT，发送 XML `NTPServerList` 或 `NTPServer`，依据 Hikvision 的 [ISAPI General Application Developer Guide（镜像）](https://raw.githubusercontent.com/loozhengyuan/hikvision-sdk/master/resources/isapi.pdf)。`synchronizeInterval` 单位是**分钟**，默认 60；端口默认 123。IP 模式填写 `ipAddress` 或 `ipv6Address`，域名模式填写 `hostName`。NTP 配置本身不会自动切换 `timeMode`，也不代表设备已经完成时间同步；配置后可再次读取时间核对。测试前将示例 NTP 地址替换为设备可达的真实时间服务器。

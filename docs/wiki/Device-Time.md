# Device time and NTP

[Wiki home](Home.md) · [简体中文](Device-Time-zh-CN.md)

## Manual time

```js
console.log((await client.device.getTime()).data);
await client.device.setTime({
  timeMode: 'manual',
  localTime: '2026-10-15T10:30:00+08:00',
  timeZone: 'CST-8:00:00',
});
```

The SDK uses `PUT /ISAPI/System/time` with XML `Time`. Manual time requires an explicit timezone offset and is preserved without conversion to the SDK host's timezone. Use a current intended time rather than copying the example date unchanged.

`timeZone` uses the device's POSIX format. The example `CST-8:00:00` represents UTC+8; an IANA name such as `Asia/Shanghai` is not a direct substitute. Read the device configuration before choosing a value.

## Configure NTP

```js
console.log((await client.device.getNtpServers()).data);
console.log((await client.device.getNtpServer('1')).data);

await client.device.setNtpServer('1', {
  addressingFormatType: 'hostname',
  hostName: 'ntp.example.com',
  portNo: 123,
  synchronizeInterval: 60,
});
await client.device.setTime({ timeMode: 'NTP', timeZone: 'CST-8:00:00' });
```

Replace the hostname with a time server reachable from the device. Configuring a server does not automatically switch to NTP mode; do so explicitly after the server update succeeds. An accepted configuration does not prove synchronization occurred. Read time again to verify it.

| Field | Rules |
| --- | --- |
| Server ID | Positive numeric string, 1–6 digits; default read ID is '1' |
| `addressingFormatType` | `hostname` or `ipaddress` |
| `hostName` | For hostname mode |
| `ipAddress` / `ipv6Address` | One address for IP mode |
| `portNo` | Default 123; range 1–65535 |
| `synchronizeInterval` | **Minutes**, default 60; range 1–10800 |

`getNtpServers/setNtpServers` use `/ISAPI/System/time/ntpServers`; single-server methods use `/{id}`. Payloads are XML `NTPServerList` or `NTPServer`.

## Replace the server list

```js
await client.device.setNtpServers([
  { id: '1', addressingFormatType: 'ipaddress', ipAddress: '192.168.1.1',
    portNo: 123, synchronizeInterval: 60 },
]);
```

This replaces the list, not an append operation. The SDK accepts 1–32 unique IDs; the device may support fewer. Use the device's actual address and capabilities. These configuration APIs are covered by simulated-device tests, not a compatibility guarantee for every firmware.

import { isIP } from 'node:net';
import { HikvisionError } from '../sdk-error.js';
import { object, identifier } from './common.js';

const invalid = message => { throw new HikvisionError('INVALID_ARGUMENT', message); };
function text(value, name, max = 256) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) invalid(`${name}必须是有效的非空字符串。`);
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
function xml(root, fields) {
  return `<${root} version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">${fields}</${root}>`;
}
function timeXml(config) {
  object(config, '时间配置');
  const { timeMode, localTime, timeZone } = config;
  if (!['manual', 'NTP'].includes(timeMode)) invalid('timeMode 必须为 manual 或 NTP。');
  if (timeMode === 'manual' && localTime === undefined) invalid('手动校时必须填写 localTime。');
  if (localTime !== undefined && (typeof localTime !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(localTime)
    || !Number.isFinite(Date.parse(localTime)))) invalid('localTime 必须为包含时区的 ISO 时间，例如 2026-10-15T10:30:00+08:00。');
  return xml('Time', `<timeMode>${timeMode}</timeMode>`
    + (localTime === undefined ? '' : `<localTime>${text(localTime, 'localTime')}</localTime>`)
    + (timeZone === undefined ? '' : `<timeZone>${text(timeZone, 'timeZone')}</timeZone>`));
}
function ntpId(id) {
  identifier(id, 'NTP 服务器 ID');
  if (!/^\d{1,6}$/.test(id) || Number(id) < 1) invalid('NTP 服务器 ID 必须为正整数形式的字符串，例如 "1"。');
  return id;
}
function ntpXml(id, config) {
  ntpId(id); object(config, 'NTP 配置');
  const { addressingFormatType, hostName, ipAddress, ipv6Address, portNo = 123, synchronizeInterval = 60 } = config;
  if (!['hostname', 'ipaddress'].includes(addressingFormatType)) invalid('addressingFormatType 必须为 hostname 或 ipaddress。');
  if (!Number.isInteger(portNo) || portNo < 1 || portNo > 65535) invalid('NTP 端口必须为 1–65535 的整数。');
  if (!Number.isInteger(synchronizeInterval) || synchronizeInterval < 1 || synchronizeInterval > 10800) invalid('NTP 校时间隔必须为 1–10800 分钟的整数。');
  let address;
  if (addressingFormatType === 'hostname') {
    if (typeof hostName !== 'string' || /[\s/:<>]/.test(hostName) || ipAddress !== undefined || ipv6Address !== undefined) invalid('hostname 模式只填写 hostName，不包含协议、路径或端口。');
    address = `<hostName>${text(hostName, 'hostName', 253)}</hostName>`;
  } else {
    if (hostName !== undefined || (ipAddress !== undefined) === (ipv6Address !== undefined)) invalid('ipaddress 模式只填写 ipAddress 或 ipv6Address 中的一项。');
    const value = ipAddress ?? ipv6Address;
    if (typeof value !== 'string' || isIP(value) !== (ipAddress === undefined ? 6 : 4)) invalid('NTP IP 地址格式不正确。');
    const tag = ipAddress === undefined ? 'ipv6Address' : 'ipAddress';
    address = `<${tag}>${text(value, tag)}</${tag}>`;
  }
  return xml('NTPServer', `<id>${id}</id><addressingFormatType>${addressingFormatType}</addressingFormatType>${address}`
    + `<portNo>${portNo}</portNo><synchronizeInterval>${synchronizeInterval}</synchronizeInterval>`);
}

export function deviceResource(client) {
  const put = (path, body, options = {}) => client.request({ method: 'PUT', path, body,
    contentType: 'application/xml; charset=utf-8', signal: options.signal });
  return Object.freeze({
    getInfo: (options = {}) => client.request({ path: '/ISAPI/System/deviceInfo', signal: options.signal }),
    getTime: (options = {}) => client.request({ path: '/ISAPI/System/time', signal: options.signal }),
    setTime: (config, options) => put('/ISAPI/System/time', timeXml(config), options),
    getNtpServers: (options = {}) => client.request({ path: '/ISAPI/System/time/ntpServers', signal: options.signal }),
    getNtpServer: (id = '1', options = {}) => client.request({ path: `/ISAPI/System/time/ntpServers/${ntpId(id)}`, signal: options.signal }),
    setNtpServer: (id, config, options) => put(`/ISAPI/System/time/ntpServers/${ntpId(id)}`, ntpXml(id, config), options),
    setNtpServers: (servers, options) => {
      if (!Array.isArray(servers) || servers.length < 1 || servers.length > 32) invalid('NTP 服务器列表必须包含 1–32 项。');
      const ids = servers.map(server => ntpId(object(server).id));
      if (new Set(ids).size !== ids.length) invalid('NTP 服务器 ID 不能重复。');
      return put('/ISAPI/System/time/ntpServers', xml('NTPServerList', servers.map(server => ntpXml(server.id, server)).join('')), options);
    },
    capabilities: ({ resource = 'system', signal } = {}) => {
      if (!['system', 'accessControl'].includes(resource)) invalid('resource 必须为 system 或 accessControl。');
      return client.request({ path: resource === 'system' ? '/ISAPI/System/capabilities' : '/ISAPI/AccessControl/capabilities', signal });
    },
  });
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { HikvisionClient, parseXml } from '../src/index.js';
import { deviceFixture, json, success } from '../test-support/device.js';

const clientFor = device => new HikvisionClient({ baseUrl: device.baseUrl, username: 'admin', password: 'fixture-password' });

test('批量新增限制并发、保持结果顺序并保留部分失败，失败条目不重发', async t => {
  let active = 0; let maximum = 0;
  const device = await deviceFixture(t, async (call, response) => {
    active++; maximum = Math.max(maximum, active);
    const person = JSON.parse(call.body).UserInfo;
    await delay(person.employeeNo === '001' ? 40 : 5);
    active--;
    if (person.employeeNo === '002') json(response, { statusCode: 6, statusString: 'Invalid Content', subStatusCode: 'employeeNoAlreadyExist' });
    else success(response);
  });
  const result = await clientFor(device).users.createMany(['001', '002', '003'].map(employeeNo => ({ employeeNo, name: employeeNo })), { concurrency: 2 });
  assert.equal(maximum, 2);
  assert.deepEqual(result.results.map(item => [item.id, item.status]), [['001', 'succeeded'], ['002', 'failed'], ['003', 'succeeded']]);
  assert.equal(result.succeeded, 2); assert.equal(result.failed, 1);
  assert.equal(result.results[1].error.subStatusCode, 'employeeNoAlreadyExist');
  assert.equal(device.calls.filter(call => call.authorized).length, 3);
});

test('批量修改、卡片设置、人脸设置使用正确单项接口和数据，重复 ID 在下发前拒绝', async t => {
  const device = await deviceFixture(t, (_, response) => success(response));
  const client = clientFor(device);
  await assert.rejects(client.users.updateMany([{ employeeNo: '001' }, { employeeNo: '001' }]), error => error.code === 'INVALID_ARGUMENT');
  assert.equal(device.calls.length, 0);
  await client.users.updateMany([{ employeeNo: '001', name: '修改' }]);
  await client.cards.setMany([{ cardNo: '000123', employeeNo: '001', cardType: 'normalCard' }]);
  await client.faces.setMany([{ employeeNo: '001', image: { type: 'url', url: 'https://images.invalid/1.jpg' } }]);
  const calls = device.calls.filter(call => call.authorized);
  assert.deepEqual(calls.map(call => [call.method, call.path]), [
    ['PUT', '/ISAPI/AccessControl/UserInfo/Modify?format=json'],
    ['PUT', '/ISAPI/AccessControl/CardInfo/SetUp?format=json'],
    ['PUT', '/ISAPI/Intelligent/FDLib/FDSetUp?format=json'],
  ]);
  assert.equal(JSON.parse(calls[1].body).CardInfo.cardNo, '000123');
  assert.equal(JSON.parse(calls[2].body).faceURL, 'https://images.invalid/1.jpg');
});

test('原生批量删除一次发送 ID 列表，整体受理不伪装为逐项完成', async t => {
  const device = await deviceFixture(t, (call, response) => {
    if (call.method === 'GET') json(response, { UserInfoDetailDeleteProcess: { status: 'processing' } });
    else success(response);
  });
  const client = clientFor(device);
  const ids = ['001', '002'];
  const results = [await client.users.deleteMany(ids), await client.cards.deleteMany(ids), await client.faces.deleteMany(ids, { libraryId: '2' })];
  for (const result of results) { assert.equal(result.accepted, 2); assert.equal(result.succeeded, 0); assert.equal(result.strategy, 'native'); }
  const calls = device.calls.filter(call => call.authorized);
  assert.equal(calls.length, 3);
  assert.deepEqual(JSON.parse(calls[0].body), { UserInfoDetail: { mode: 'byEmployeeNo', EmployeeNoList: [{ employeeNo: '001' }, { employeeNo: '002' }] } });
  assert.deepEqual(JSON.parse(calls[1].body), { CardInfoDelCond: { CardNoList: [{ cardNo: '001' }, { cardNo: '002' }] } });
  assert.deepEqual(JSON.parse(calls[2].body), { FPID: [{ value: '001' }, { value: '002' }] });
  assert.match(calls[2].path, /FDID=2/);
  const progress = await client.users.getDeleteProgress();
  assert.equal(progress.data.UserInfoDetailDeleteProcess.status, 'processing');
});

test('个别固件可显式逐项删除；原生组错误保留未知状态且不自动重试', async t => {
  const device = await deviceFixture(t, (call, response) => {
    const list = JSON.parse(call.body).CardInfoDelCond.CardNoList;
    if (list.length > 1) json(response, { statusCode: 3, statusString: 'Device Error', subStatusCode: 'deviceError' });
    else success(response);
  });
  const client = clientFor(device);
  const native = await client.cards.deleteMany(['001', '002']);
  assert.equal(native.unknown, 2); assert.equal(native.failed, 0);
  assert.equal(device.calls.filter(call => call.authorized).length, 1);
  const individual = await client.cards.deleteMany(['003', '004'], { strategy: 'individual' });
  assert.equal(individual.accepted, 2); assert.equal(individual.strategy, 'individual');
  assert.equal(device.calls.filter(call => call.authorized).length, 3);
});

test('批量 stopOnError、取消与网络结果未知不会继续发送尚未开始的条目', async t => {
  const device = await deviceFixture(t, (_, response) => response.destroy());
  const client = clientFor(device);
  const result = await client.users.createMany([{ employeeNo: '001' }, { employeeNo: '002' }], { stopOnError: true });
  assert.equal(result.unknown, 1); assert.equal(result.skipped, 1);
  assert.equal(result.results[0].error.outcome, 'unknown');
  const controller = new AbortController(); controller.abort();
  const cancelled = await client.cards.setMany([{ employeeNo: '001', cardNo: '000123' }], { signal: controller.signal });
  assert.equal(cancelled.aborted, true); assert.equal(cancelled.skipped, 1);
  assert.equal(device.calls.filter(call => call.authorized).length, 1);
});

test('时间设置保持时区和秒值；NTP 地址、端口、分钟间隔与模式分别配置', async t => {
  const device = await deviceFixture(t, (_, response) => success(response));
  const client = clientFor(device);
  await client.device.setTime({ timeMode: 'manual', localTime: '2026-10-15T10:30:45+08:00', timeZone: 'CST-8:00:00' });
  await client.device.setNtpServer('1', { addressingFormatType: 'hostname', hostName: 'ntp.example.com', portNo: 123, synchronizeInterval: 120 });
  await client.device.setTime({ timeMode: 'NTP', timeZone: 'CST-8:00:00' });
  await client.device.getNtpServers();
  await client.device.getNtpServer('1');
  await client.device.setNtpServers([{ id: '1', addressingFormatType: 'ipaddress', ipAddress: '192.168.0.1' }, { id: '2', addressingFormatType: 'ipaddress', ipv6Address: '2001:db8::1' }]);
  const calls = device.calls.filter(call => call.authorized);
  const time = parseXml(calls[0].body.toString()).Time;
  assert.equal(time.localTime, '2026-10-15T10:30:45+08:00'); assert.equal(time.timeZone, 'CST-8:00:00');
  const ntp = parseXml(calls[1].body.toString()).NTPServer;
  assert.equal(ntp.synchronizeInterval, '120'); assert.equal(ntp.hostName, 'ntp.example.com');
  assert.equal(ntp.portNo, '123'); assert.equal(ntp.id, '1');
  assert.equal(parseXml(calls[2].body.toString()).Time.timeMode, 'NTP');
  assert.deepEqual(calls.slice(3).map(call => [call.method, call.path]), [
    ['GET', '/ISAPI/System/time/ntpServers'], ['GET', '/ISAPI/System/time/ntpServers/1'], ['PUT', '/ISAPI/System/time/ntpServers'],
  ]);
  assert.equal(parseXml(calls[5].body.toString()).NTPServerList.NTPServer[1].ipv6Address, '2001:db8::1');
  assert.throws(() => client.device.setTime({ timeMode: 'manual', localTime: '2026-10-15T10:30:45' }), error => error.code === 'INVALID_ARGUMENT');
  assert.throws(() => client.device.setNtpServer('../2', { addressingFormatType: 'hostname', hostName: 'ntp.example.com' }), error => error.code === 'INVALID_ARGUMENT');
  assert.throws(() => client.device.setNtpServer('1', { addressingFormatType: 'ipaddress', ipAddress: 'invalid' }), error => error.code === 'INVALID_ARGUMENT');
  assert.equal(device.calls.filter(call => call.authorized).length, 6);
});

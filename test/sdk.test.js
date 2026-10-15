import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { HikvisionClient, parseXml } from '../src/index.js';
import { deviceFixture, jpeg, json, success } from '../test-support/device.js';

const clientFor = fixture => new HikvisionClient({ baseUrl: fixture.baseUrl, username: 'admin', password: 'fixture-password' });

test('人脸查询接受平铺和带根节点的 JSON，查询 FPID 使用字符串', async t => {
  for (const root of [null, 'FDSearch', 'FDSearchResult']) {
    const fixture = await deviceFixture(t, (_, response) => {
      const result = { responseStatusStrg: 'OK', totalMatches: 1, MatchList: [{ FPID: '0001', faceURL: '/LOCALS/face.jpg' }] };
      json(response, root ? { [root]: result } : result);
    });
    const result = await clientFor(fixture).faces.search({ employeeNo: '0001' });
    assert.equal(result.items[0].FPID, '0001');
    assert.equal(JSON.parse(fixture.calls.at(-1).body).FPID, '0001');
  }
});

for (const algorithm of ['MD5', 'SHA-256', 'MD5-sess', 'SHA-256-sess']) {
  test(`Digest ${algorithm} 支持并发请求且请求体保持完整`, async t => {
    const fixture = await deviceFixture(t, (call, response) => json(response, { method: call.method, body: JSON.parse(call.body) }), { algorithm });
    const client = clientFor(fixture);
    const results = await Promise.all([1, 2, 3].map(index => client.request({ method: 'POST', path: '/ISAPI/fixture', body: { index, name: '测试' } })));
    assert.deepEqual(results.map(result => result.data.body.index), [1, 2, 3]);
    assert.equal(fixture.calls.length, 6);
  });
}

test('人员与卡片 CRUD 保持工号/卡号字符串，按指定 ID 删除', async t => {
  const fixture = await deviceFixture(t, (_, response) => success(response));
  const client = clientFor(fixture);
  await client.users.create({ employeeNo: '0001', name: '测试人员', doorRight: '1' });
  await client.users.update('0001', { name: '修改姓名' });
  await client.users.delete('0001');
  await client.cards.create({ employeeNo: '0001', cardNo: '00001234', cardType: 'normalCard' });
  await client.cards.update('00001234', { cardType: 'normalCard' });
  await client.cards.delete('00001234');
  const calls = fixture.calls.filter(call => call.authorized);
  assert.equal(calls[0].method, 'POST');
  assert.equal(JSON.parse(calls[0].body).UserInfo.employeeNo, '0001');
  assert.deepEqual(JSON.parse(calls[2].body), { UserInfoDetail: { mode: 'byEmployeeNo', EmployeeNoList: [{ employeeNo: '0001' }] } });
  assert.equal(JSON.parse(calls[3].body).CardInfo.cardNo, '00001234');
  assert.deepEqual(JSON.parse(calls[5].body), { CardInfoDelCond: { CardNoList: [{ cardNo: '00001234' }] } });
  assert.throws(() => client.users.delete(1), /字符串/);
  assert.throws(() => client.cards.create({ employeeNo: '1', cardNo: 1234 }), /字符串/);
});

test('事件迭代复用 searchID、推进位置、保留扩展字段和图片 URL', async t => {
  const fixture = await deviceFixture(t, (call, response) => {
    const condition = JSON.parse(call.body).AcsEventCond;
    const first = condition.searchResultPosition === 0;
    json(response, { AcsEvent: { searchID: condition.searchID, responseStatusStrg: first ? 'MORE' : 'OK', totalMatches: 3,
      InfoList: first ? [{ serialNo: 10, employeeNoString: '0001', pictureURL: '/LOCALS/a.jpeg', extraField: 'kept' }, { serialNo: 11 }]
        : [{ serialNo: 12, thermalPicUrl: '/LOCALS/b.jpeg' }] } });
  });
  const client = clientFor(fixture); const events = [];
  for await (const event of client.events.iterate({ pageSize: 2, includePictures: true })) events.push(event);
  const conditions = fixture.calls.filter(call => call.authorized).map(call => JSON.parse(call.body).AcsEventCond);
  assert.deepEqual(conditions.map(condition => condition.searchResultPosition), [0, 2]);
  assert.equal(conditions[0].searchID, conditions[1].searchID);
  assert.equal(conditions[0].picEnable, true);
  assert.ok(!('pageSize' in conditions[0]));
  assert.equal(events[0].extraField, 'kept');
  assert.equal(events[0].raw.employeeNoString, '0001');
  assert.equal(events[0].images[0].url, '/LOCALS/a.jpeg');
  assert.equal(events[1].images.length, 0);
});

test('人员和卡片查询归一化分页，空 MORE 与重复分页被拒绝', async t => {
  const fixture = await deviceFixture(t, (call, response) => {
    const users = call.path.includes('UserInfo');
    const prefix = users ? 'UserInfo' : 'CardInfo';
    json(response, { [`${prefix}Search`]: { responseStatusStrg: 'MORE', totalMatches: 100, [prefix]: users ? [{ employeeNo: '0001' }] : [] } });
  });
  const client = clientFor(fixture);
  await assert.rejects(client.cards.search(), error => error.code === 'PAGINATION_ERROR');
  await assert.rejects(async () => { for await (const person of client.users.iterate()) void person; }, error => error.code === 'PAGINATION_ERROR');
});

test('人脸 URL 直传由设备下载，不访问图片服务器', async t => {
  const fixture = await deviceFixture(t, (_, response) => success(response));
  const client = clientFor(fixture);
  await client.faces.set({ employeeNo: '0001', libraryId: '2', image: { type: 'url', url: 'https://images.invalid/face.jpg?token=signed', fetchBy: 'device' } });
  const call = fixture.calls.find(call => call.authorized);
  assert.equal(call.method, 'PUT');
  assert.equal(call.path, '/ISAPI/Intelligent/FDLib/FDSetUp?format=json');
  assert.deepEqual(JSON.parse(call.body), { FDID: '2', faceLibType: 'blackFD', FPID: '0001', faceURL: 'https://images.invalid/face.jpg?token=signed' });
});

test('SDK 获取外部图片时不转发设备凭据，multipart 在 Digest 重发后仍保持二进制', async t => {
  const imageHost = await deviceFixture(t, (_, response) => { response.writeHead(200, { 'Content-Type': 'image/jpeg' }); response.end(jpeg); }, { authenticate: false });
  const device = await deviceFixture(t, (_, response) => success(response));
  await clientFor(device).faces.set({ employeeNo: '0001', image: { type: 'url', url: imageHost.baseUrl + '/face.jpg', fetchBy: 'sdk' } });
  assert.equal(imageHost.calls[0].headers.authorization, undefined);
  assert.deepEqual(device.calls[0].body, device.calls[1].body);
  assert.ok(device.calls[1].body.includes(jpeg));
  assert.match(device.calls[1].headers['content-type'], /^multipart\/form-data; boundary=/);
  assert.match(device.calls[1].body.toString(), /name="FaceDataRecord"/);
  assert.match(device.calls[1].body.toString(), /name="FaceImage"/);
});

test('人脸支持 Buffer、Base64、本地文件输入，删除按库和 FPID 定位', async t => {
  const fixture = await deviceFixture(t, (_, response) => success(response));
  const client = clientFor(fixture);
  const directory = await mkdtemp(join(tmpdir(), 'hikvision-image-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = await client.images.download(jpeg, { as: 'file', filePath: join(directory, 'face.jpg') });
  for (const image of [jpeg, { type: 'base64', data: jpeg.toString('base64') }, { type: 'file', path }]) {
    await client.faces.set({ employeeNo: '0001', image });
  }
  await client.faces.delete('0001', { libraryId: '2' });
  const last = fixture.calls.filter(call => call.authorized).at(-1);
  assert.match(last.path, /FDID=2/); assert.deepEqual(JSON.parse(last.body), { FPID: [{ value: '0001' }] });
});

test('图片下载三种模式保持相同字节，文件不被意外覆盖，JSON 错误不保存为图片', async t => {
  const fixture = await deviceFixture(t, (call, response) => {
    if (call.path.includes('error')) { json(response, { statusCode: 6, statusString: 'Invalid Content', subStatusCode: 'badParameters' }); return; }
    response.writeHead(200, { 'Content-Type': 'image/jpeg' }); response.end(jpeg);
  });
  const client = clientFor(fixture); const directory = await mkdtemp(join(tmpdir(), 'hikvision-download-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const url = fixture.baseUrl + '/LOCALS/pic.jpg?signature=a%2Fb';
  assert.deepEqual(await client.images.download(url), jpeg);
  assert.equal(await client.images.download(url, { as: 'base64' }), jpeg.toString('base64'));
  const path = await client.images.download(url, { as: 'file', filePath: join(directory, 'photo.jpg') });
  assert.ok(isAbsolute(path)); assert.deepEqual(await readFile(path), jpeg);
  await assert.rejects(client.images.download(url, { as: 'file', filePath: path }), error => error.code === 'FILE_EXISTS');
  assert.deepEqual(await readFile(path), jpeg);
  await assert.rejects(client.images.download('/LOCALS/error'), error => error.code === 'DEVICE_ERROR');
  await assert.rejects(client.images.download('http://different.invalid/photo.jpg'), error => error.code === 'INVALID_ARGUMENT');
  assert.ok(fixture.calls.some(call => call.path.endsWith('signature=a%2Fb')));
});

test('XML 解析保留前导零，拒绝 DTD；不支持能力与业务错误可区分', async t => {
  assert.equal(parseXml('<User><employeeNo>0001</employeeNo></User>').User.employeeNo, '0001');
  assert.throws(() => parseXml('<!DOCTYPE x [<!ENTITY e SYSTEM "file:///secret">]><x>&e;</x>'), error => error.code === 'INVALID_RESPONSE');
  const fixture = await deviceFixture(t, (_, response) => json(response, { statusCode: 4, statusString: 'Invalid Operation', subStatusCode: 'notSupport' }));
  await assert.rejects(clientFor(fixture).device.capabilities(), error => error.code === 'UNSUPPORTED' && error.deviceStatus === 4);
});

test('门控制发送官方 XML；写入超时不重试并报告结果未知', async t => {
  const fixture = await deviceFixture(t, (call, response) => { if (call.path.includes('/door/')) success(response); });
  const client = new HikvisionClient({ baseUrl: fixture.baseUrl, username: 'admin', password: 'fixture-password', timeout: 1000 });
  await client.doors.open(2);
  const control = fixture.calls.find(call => call.authorized);
  assert.equal(control.path, '/ISAPI/AccessControl/RemoteControl/door/2');
  assert.match(control.body.toString(), /<cmd>open<\/cmd>/);
  await assert.rejects(client.users.create({ employeeNo: '0001', name: 'test' }), error => error.code === 'TIMEOUT' && error.outcome === 'unknown');
  assert.equal(fixture.calls.filter(call => call.authorized && call.path.includes('UserInfo/Record')).length, 1);
});

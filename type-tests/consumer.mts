import { HikvisionClient, HikvisionError, type AccessEvent } from '../src/index.js';
import type { Buffer } from 'node:buffer';

const client = new HikvisionClient({ baseUrl: 'http://device.test:8080', username: 'admin', password: 'fixture' });
async function usage() {
  await client.users.create({ employeeNo: '0001', name: '测试' });
  await client.users.update('0001', { doorRight: '1' });
  const batch = await client.users.createMany([{ employeeNo: '0001' }], { concurrency: 2 });
  const count: number = batch.succeeded; void count;
  await client.users.updateMany([{ employeeNo: '0001', name: '修改' }]);
  await client.users.deleteMany(['0001'], { strategy: 'native' });
  await client.cards.setMany([{ employeeNo: '0001', cardNo: '000123' }]);
  await client.faces.setMany([{ employeeNo: '0001', image: { type: 'file', path: './face.jpg' } }]);
  await client.faces.deleteMany(['0001'], { libraryId: '1', strategy: 'individual' });
  await client.device.setTime({ timeMode: 'manual', localTime: '2026-10-15T10:30:00+08:00', timeZone: 'CST-8:00:00' });
  await client.device.setNtpServer('1', { addressingFormatType: 'hostname', hostName: 'ntp.example.com', synchronizeInterval: 60 });
  // @ts-expect-error Manual time setting requires localTime.
  await client.device.setTime({ timeMode: 'manual' });
  // @ts-expect-error Batch IDs must remain strings.
  await client.cards.deleteMany([123]);
  // @ts-expect-error NTP IP mode requires an IP address.
  await client.device.setNtpServer('1', { addressingFormatType: 'ipaddress', hostName: 'ntp.example.com' });
  await client.cards.create({ employeeNo: '0001', cardNo: '000123' });
  await client.faces.set({ employeeNo: '0001', image: { type: 'url', url: 'https://example.invalid/face.jpg', fetchBy: 'device' } });
  const binary: Buffer = await client.images.download('/LOCALS/photo.jpeg');
  const encoded: string = await client.images.download(binary, { as: 'base64' });
  const path: string = await client.images.download(binary, { as: 'file', filePath: './photo.jpg' });
  for await (const event of client.events.iterate({ includePictures: true, pageSize: 30 })) {
    const typed: AccessEvent = event; void typed;
  }
  for await (const notification of client.events.subscribe({ signal: new AbortController().signal })) void notification;
  // @ts-expect-error IDs must preserve string values, including leading zeroes.
  await client.users.delete(123);
  // @ts-expect-error File mode requires an explicit destination.
  await client.images.download(binary, { as: 'file' });
  void [encoded, path];
}
void usage; void HikvisionError;

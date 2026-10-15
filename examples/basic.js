import { HikvisionClient, parseXml } from '../src/index.js';

const client = new HikvisionClient({
  baseUrl: process.env.HIKVISION_BASE_URL,
  username: process.env.HIKVISION_USERNAME,
  password: process.env.HIKVISION_PASSWORD,
});
const info = await client.device.getInfo();
console.log(info.format === 'xml' ? parseXml(info.data) : info.data);
const users = await client.users.search({ pageSize: 10 });
console.log({ total: users.total, count: users.items.length, users: users.items });

// Installed package: import { HikvisionClient } from '@lystudio/hikvision-isapi';
// Mutating operations are deliberately not executed by this connection example.

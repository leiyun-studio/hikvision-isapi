import { HikvisionClient } from '../src/index.js';

const client = new HikvisionClient({
  baseUrl: process.env.HIKVISION_BASE_URL,
  username: process.env.HIKVISION_USERNAME,
  password: process.env.HIKVISION_PASSWORD,
});
const controller = new AbortController();
process.once('SIGINT', () => controller.abort());
process.once('SIGTERM', () => controller.abort());
for await (const message of client.events.subscribe({ signal: controller.signal, reconnect: true, maxReconnects: 5 })) {
  // Never stringify binary pictures into logs. Event fields can contain personal data.
  console.log({ kind: message.kind, complete: message.complete, event: message.event,
    images: message.images.map(image => image.type === 'inline'
      ? { type: image.type, bytes: image.data.length, contentType: image.contentType } : image) });
}

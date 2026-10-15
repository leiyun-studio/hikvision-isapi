# Events and images

[Wiki home](Home.md) · [简体中文](Events-and-Images-zh-CN.md)

## Historical events

```js
const page = await client.events.search({
  startTime: '2026-10-15T10:00:00+08:00',
  endTime: '2026-10-15T11:00:00+08:00',
  major: 0, minor: 0, includePictures: true, pageSize: 30,
});
for (const event of page.items) {
  console.log(event.employeeNoString, event.time, event.images);
}
```

Use `events.iterate()` with the same options for automatic pagination. The SDK queries `AcsEvent` and maps `includePictures` to `picEnable`. Vendor fields are preserved; `event.raw` contains the original record.

## Image references and output modes

| Image type | Meaning |
| --- | --- |
| `url` | Downloadable URL returned by the device |
| `inline` | Binary data received in a subscription |
| `reference` | A filename/file ID without a known download URL |

```js
import { randomUUID } from 'node:crypto';

const image = page.items.flatMap(event => event.images)
  .find(item => item.type === 'url' || item.type === 'inline');

if (image) {
  const bytes = await client.images.download(image); // Buffer
  const base64 = await client.images.download(bytes, { as: 'base64' });
  const localPath = await client.images.download(bytes, {
    as: 'file', filePath: './images/' + randomUUID() + '.jpg',
  });
  console.log(bytes.length, base64.length, localPath);
}
```

`images.download()` also accepts URL strings, Buffer, and Uint8Array. It recognizes JPEG, PNG, and WebP headers. Base64 output is a plain string without a data-URL prefix. File mode returns an absolute path on the SDK host and does not overwrite existing files unless `overwrite: true` is set. Choose a filename extension matching the actual data; saving does not transcode it.

Same-origin `/ISAPI/` and `/LOCALS/` URLs are allowed by default. For a different host or port, explicitly set `allowExternal: true`; credentials are not forwarded. Signed query parameters are preserved and redirects are not followed.

## Real-time subscription

```js
const controller = new AbortController();
process.once('SIGINT', () => controller.abort());

for await (const message of client.events.subscribe({
  signal: controller.signal,
  reconnect: true, maxReconnects: 5, reconnectDelay: 1000, idleTimeout: 60_000,
})) {
  console.log(message.kind, message.event, message.complete);
  for (const image of message.images) {
    if (image.type === 'inline') {
      const bytes = await client.images.download(image);
      // Persist with the event's identifiers, not just its timestamp.
      console.log(bytes.length);
    }
  }
}
```

The SDK parses multipart JSON/XML and images from `/ISAPI/Event/notification/alertStream`. When a device declares `picturesNumber`, parts are collected in order. Images without a declared association are emitted as separate `kind: 'image'` messages. `complete: false` means declared pictures were not all received. Breaking out of iteration or cancelling closes the connection.

Reconnection is off by default. When enabled, eligible network failures, timeouts, and truncated streams trigger bounded reconnects with exponential delay capped at 60 seconds. This does not guarantee exactly-once delivery or offline backfill. Applications must persist events, deduplicate using device event identifiers, and reconcile history where available. Low-level `client.stream()` exposes headers and raw chunks.

## Missing pictures

`includePictures: true` cannot restore a picture that the device does not provide. A record may have an empty `images` array even when authentication succeeded. A filename-only `reference` raises `IMAGE_UNAVAILABLE` on download; the SDK does not guess paths or match pictures by timestamp.

Local device storage, historical ISAPI responses, and live event uploads are distinct behaviors. Confirm them independently for the model and firmware. Neither a successful subscription nor a visible device-web photo proves historical snapshots can be retrieved through every API.

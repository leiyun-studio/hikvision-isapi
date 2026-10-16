# @lystudio/hikvision-isapi

**English** | [简体中文](README.zh-CN.md)

A Node.js SDK for Hikvision access control devices over ISAPI. Manage people, cards, faces, doors, device time, and access events through a JavaScript API with TypeScript declarations.

## Features

- HTTP/HTTPS with custom ports and Digest authentication.
- Person and card management; face enrollment from URLs, buffers, Base64, or local JPEG files.
- Batch operations with per-item results, bounded concurrency, and cancellation.
- Historical event queries, automatic pagination, and real-time subscriptions.
- Image downloads as `Buffer`, Base64, or a local file path.
- Manual device time and NTP configuration.
- A local HTML test console with editable parameters and generated SDK examples.

## Requirements and compatibility

- SDK runtime: Node.js **16.20.2 or later**; ES Modules. TypeScript declarations are included.
- Source development, build tools, and the web console: Node.js **22 or later**.
- An ISAPI-capable device reachable from the SDK host, with an authorized device account.
- Endpoint support and required fields vary by model and firmware. Check capabilities and validate your target device.

The SDK connects directly to the device; it does not establish connectivity across NAT. Event images are available only when the device provides a usable image reference or binary data.

Core runtime checks cover Node 16, 18, 20, 22, and 24. See [compatibility](docs/wiki/Compatibility.md) for tested versions and limits. CommonJS applications can load the SDK using `await import('@lystudio/hikvision-isapi')` inside an async function; a separate `require()` build is not provided.

## Installation

```sh
npm install @lystudio/hikvision-isapi
```

## Quick start

Use a `.js` file with `"type": "module"` in your application's `package.json`, or use `.mjs`. Set `HIKVISION_BASE_URL`, `HIKVISION_USERNAME`, and `HIKVISION_PASSWORD` in your environment.

```js
import { HikvisionClient, parseXml } from '@lystudio/hikvision-isapi';

const client = new HikvisionClient({
  baseUrl: process.env.HIKVISION_BASE_URL, // e.g. http://192.168.1.100:8080
  username: process.env.HIKVISION_USERNAME,
  password: process.env.HIKVISION_PASSWORD,
  timeout: 15_000,
});

const info = await client.device.getInfo();
console.log(info.format === 'xml' ? parseXml(info.data) : info.data);

const page = await client.users.search({ pageSize: 20 });
console.log(page.items);
```

## Usage

These snippets reuse `client` from the quick start. Face enrollment writes to the device.

```js
for await (const user of client.users.iterate({ pageSize: 30 })) {
  console.log(user.employeeNo, user.name);
}

// Replace with a JPEG URL that the device can reach.
await client.faces.set({
  employeeNo: '0001',
  image: { type: 'url', url: 'https://images.example.com/face.jpg', fetchBy: 'device' },
});

const events = await client.events.search({
  startTime: '2026-10-15T00:00:00+08:00',
  endTime: '2026-10-15T23:59:59+08:00',
  includePictures: true,
});
console.log(events.items);
```

Keep employee numbers and card numbers as strings to preserve leading zeros. Batch deletion acknowledgements do not prove completion. Writes are not automatically retried after network failures; check device state when an error reports `outcome: 'unknown'`.

## Web test console

From a source checkout, install development dependencies with `npm ci`, then run:

```sh
npm run example:web
```

Open **http://127.0.0.1:3050**. Enter a `baseUrl` or an IP/hostname and port, then credentials. Select an operation for editable JSON parameters and copyable SDK code. Writes require explicit confirmation. Credentials are not persisted. Fastify is a development dependency; the console is not part of the SDK runtime.

## Documentation

Start with the [online Wiki](https://github.com/leiyun-studio/hikvision-isapi/wiki), also available in [简体中文](https://github.com/leiyun-studio/hikvision-isapi/wiki/Home-zh-CN). A [local copy](docs/wiki/Home.md) is included in the repository and npm package.

| Guide | Contents |
| --- | --- |
| [Configuration](docs/wiki/Configuration.md) | Options, authentication, TLS, response formats |
| [API reference](docs/wiki/API-Reference.md) | Resources, CRUD, pagination, raw requests, errors |
| [Batch operations](docs/wiki/Batch-Operations.md) | Native deletion, SDK batching, partial results |
| [Faces](docs/wiki/Faces.md) | URL and binary enrollment, face libraries |
| [Events and images](docs/wiki/Events-and-Images.md) | History, subscriptions, downloads, missing images |
| [Device time](docs/wiki/Device-Time.md) | Manual time and NTP |
| [Web console](docs/wiki/Web-Console.md) | Interactive testing and generated examples |
| [Development](docs/wiki/Development.md) | Repository structure, checks, contribution workflow |

Wiki sources live in this repository. See [publishing the GitHub Wiki](docs/WIKI-PUBLISHING.md) to synchronize them to the separate Wiki repository.

## Development and contributing

```sh
npm ci
npm run check          # Tests, TypeScript checks, and build
npm run pack:verify    # Verify installation, imports, and types in an isolated project
```

Public API changes should include matching types, examples, tests, and both language versions of the documentation. Report device issues with the model, firmware, SDK version, and a redacted request/response. Tests use local simulated devices; passing them does not establish compatibility with every firmware version.

## License

Licensed under the [MIT License](LICENSE).

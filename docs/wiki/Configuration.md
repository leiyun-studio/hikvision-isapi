# Client configuration

[Wiki home](Home.md) · [简体中文](Configuration-zh-CN.md)

## Create a client

```js
import { HikvisionClient, parseXml } from '@lystudio/hikvision-isapi';

const client = new HikvisionClient({
  baseUrl: process.env.HIKVISION_BASE_URL,
  username: process.env.HIKVISION_USERNAME,
  password: process.env.HIKVISION_PASSWORD,
  timeout: 15_000,
});
const response = await client.device.getInfo();
console.log(response.format === 'xml' ? parseXml(response.data) : response.data);
```

Each instance represents one device. `baseUrl` is an HTTP/HTTPS origin, such as `http://192.168.1.100:8080` or `https://[::1]:8443`. Paths, query strings, fragments, and embedded credentials are not accepted.

| Option | Default | Meaning |
| --- | --- | --- |
| `baseUrl` | Required | Device origin, including any non-default port |
| `username`, `password` | Required | Nonempty device credentials |
| `timeout` | 15000 | Milliseconds for authentication and the complete response; 1000–300000 |
| `maxResponseBytes` | 16 MiB | Buffered response limit; maximum 64 MiB |
| `maxImageBytes` | 10 MiB | Image size limit; maximum 64 MiB |
| `tls.ca` | System trust | Custom CA certificate(s) |
| `tls.rejectUnauthorized` | true | Whether to verify the device certificate |

HTTPS verifies certificates by default. For a self-signed device, configure its CA using `tls.ca`. Explicit `rejectUnauthorized: false` is available for testing. External image downloads always verify TLS.

## Authentication and transport

Digest supports MD5, SHA-256, SHA-512-256 and their sess variants, with `qop=auth` or no qop. Basic, auth-int, and userhash are not supported. Local tests cover MD5, SHA-256, and their sess variants.

Credentials remain in private client fields. Requests do not follow redirects; device credentials are never forwarded to an external image host. Writes are not automatically retried after network errors. Digest authentication may replay the same buffered request body following a 401 challenge.

Use an `AbortSignal` to cancel a request. For a write with an uncertain outcome, cancellation does not undo work already accepted by the device.

## Response types

Normal operations return:

```js
// Shape only; values depend on the request.
const response = {
  status: 200, contentType: 'application/json', format: 'json',
  elapsedMs: 12, bytes: 42, data: {},
};
```

`format` is `json`, `xml`, `text`, or `binary`. XML remains text; use `parseXml()` to parse it while preserving string identifiers and leading zeros. HTTP 200 responses containing device errors still throw.

Search operations return `{ items, total, hasMore, searchID, nextPosition, raw, response }`; `total` can be absent. Vendor fields remain available in the returned records and raw response. See [API reference](API-Reference.md).

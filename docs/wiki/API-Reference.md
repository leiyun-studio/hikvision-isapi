# API reference

[Wiki home](Home.md) · [简体中文](API-Reference-zh-CN.md)

Examples assume a configured `client`; see [configuration](Configuration.md). CRUD, face enrollment, time configuration, and door commands modify device state.

## Resources

| Resource | Methods |
| --- | --- |
| `device` | `getInfo`, `getTime`, `setTime`, `getNtpServers`, `getNtpServer`, `setNtpServer`, `setNtpServers`, `capabilities` |
| `users` | `search`, `iterate`, `count`, `capabilities`, `create`, `set`, `update`, `delete`, `createMany`, `setMany`, `updateMany`, `deleteMany`, `getDeleteProgress` |
| `cards` | `search`, `iterate`, `count`, `capabilities`, `create`, `set`, `update`, `delete`, `createMany`, `setMany`, `updateMany`, `deleteMany` |
| `faces` | `search`, `iterate`, `capabilities`, `create`, `set`, `delete`, `setMany`, `deleteMany` |
| `doors` | `getStatus`, `capabilities`, `control`, `open`, `close` |
| `events` | `search`, `iterate`, `capabilities`, `subscribe` |
| `images` | `download` |
| Client | `request`, `downloadBytes`, `stream` |

All request options support an `AbortSignal`. The installed `dist/index.d.ts` is the full signature reference. Topic guides cover [batch operations](Batch-Operations.md), [faces](Faces.md), [events and images](Events-and-Images.md), and [time](Device-Time.md).

## People and cards

```js
const page = await client.users.search({ employeeNo: '0001', pageSize: 20 });
await client.users.create({
  employeeNo: '0001', name: 'Example Person', userType: 'normal',
  Valid: { enable: true, beginTime: '2026-10-15T00:00:00', endTime: '2027-10-15T23:59:59' },
  doorRight: '1', RightPlan: [{ doorNo: 1, planTemplateNo: '1' }],
});
await client.users.update('0001', { name: 'Updated Name' });
await client.cards.create({ employeeNo: '0001', cardNo: '00001234', cardType: 'normalCard' });
await client.cards.update('00001234', { employeeNo: '0001' });
await client.cards.delete('00001234');
await client.users.delete('0001');
```

Employee numbers, card numbers, and face library IDs must be strings. Permission fields, validity periods, and plan templates depend on device configuration; the SDK does not create permission plans.

`create()` uses `Record`, `update()` uses `Modify`, and `set()` uses `SetUp`. The SDK does not implement set by guessing whether an item already exists. Person deletion uses `UserInfoDetail/Delete`; some firmware processes it asynchronously. Use `users.getDeleteProgress()` and subsequent queries to confirm completion.

## Pagination

`search()` accepts `offset` (default 0), `pageSize` (default 30), `searchID`, `filters`, and `signal`. Resource-specific filters include `employeeNo`, `cardNo`, and event time/type filters. Vendor-specific conditions can be passed through `filters`.

```js
const first = await client.users.search({ pageSize: 20 });
if (first.hasMore) {
  const next = await client.users.search({
    pageSize: 20, searchID: first.searchID, offset: first.nextPosition,
  });
  console.log(next.items);
}

for await (const user of client.users.iterate({ pageSize: 30, maxPages: 10000 })) {
  console.log(user.employeeNo);
}
```

`iterate()` reuses the search ID and advances the position. Empty MORE responses, repeated pages, and exceeding `maxPages` raise pagination errors. SDK page sizes range from 1 to 1000; the device may impose a lower limit.

## Doors

```js
console.log((await client.doors.getStatus()).data);
await client.doors.open(1);
await client.doors.close(1);
await client.doors.control(1, 'alwaysClose');
```

Supported commands: `open`, `close`, `alwaysOpen`, `alwaysClose`. Door IDs are integers from 1 to 65535; the actual device must expose that door.

## Raw requests

```js
const response = await client.request({
  method: 'POST',
  path: '/ISAPI/AccessControl/AcsEvent?format=json',
  body: {
    AcsEventCond: {
      searchID: 'custom-query-1', searchResultPosition: 0, maxResults: 20,
      major: 0, minor: 0,
    },
  },
});
console.log(response.data);
```

Paths must use the device origin and `/ISAPI/` or `/LOCALS/`. Methods are GET, POST, PUT, DELETE, and HEAD. Bodies accept JSON objects, XML strings, Buffer, or Uint8Array; use `contentType` for non-JSON payloads. GET and HEAD do not accept a body.

`responseType` accepts `auto/json/xml/text/buffer`. `downloadBytes(path, options)` returns a buffered response; `stream(options)` yields response headers followed by Buffer chunks. For image conversion and parsed event streams, prefer the resource helpers.

## Errors and retries

```js
import { HikvisionError } from '@lystudio/hikvision-isapi';

try {
  await client.users.update('0001', { name: 'Updated Name' });
} catch (error) {
  if (!(error instanceof HikvisionError)) throw error;
  console.error(error.code, error.subStatusCode, error.outcome);
}
```

| Error | Typical next step |
| --- | --- |
| `INVALID_ARGUMENT` | Check IDs, options, and payload types |
| `AUTHENTICATION_FAILED`, `UNSUPPORTED_AUTH` | Check account and device authentication mode |
| `UNSUPPORTED`, `DEVICE_ERROR` | Inspect `subStatusCode` and device capabilities |
| `NETWORK_ERROR`, `TIMEOUT`, `TLS_ERROR` | Check reachability, timeout, and certificate trust |
| `ABORTED` | Handle cancellation |
| `INVALID_RESPONSE`, `TRUNCATED_RESPONSE`, `RESPONSE_TOO_LARGE` | Inspect response format and size limits |
| `PAGINATION_ERROR` | Inspect query progression and device results |
| `INVALID_IMAGE`, `IMAGE_UNAVAILABLE` | Check image data or returned references |
| `FILE_EXISTS`, `FILE_ERROR` | Check local output path and overwrite policy |

`error.response` preserves the device response; it may contain personal data. Non-GET/HEAD requests whose results cannot be confirmed expose `outcome: 'unknown'`. Query device state before retrying. No network retry or transaction rollback is implicit.

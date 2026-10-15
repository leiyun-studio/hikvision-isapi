# Batch operations

[Wiki home](Home.md) · [简体中文](Batch-Operations-zh-CN.md)

## Supported operations

| Resource | SDK per-item operations | Native list deletion |
| --- | --- | --- |
| People | `createMany`, `setMany`, `updateMany` | `deleteMany` with EmployeeNoList |
| Cards | `createMany`, `setMany`, `updateMany` | `deleteMany` with CardNoList |
| Faces | `setMany` | `deleteMany` with FPID |

Each batch accepts 1–10000 items with unique string IDs. This SDK limit is not a promise that a device accepts that many IDs in one request. Native list limits depend on firmware.

## Examples

```js
const created = await client.users.createMany([
  { employeeNo: '0001', name: 'Person One', userType: 'normal', Valid: { enable: false } },
  { employeeNo: '0002', name: 'Person Two', userType: 'normal', Valid: { enable: false } },
], { concurrency: 1, stopOnError: false });

await client.users.updateMany([
  { employeeNo: '0001', name: 'Updated One' },
  { employeeNo: '0002', name: 'Updated Two' },
]);
await client.cards.setMany([
  { employeeNo: '0001', cardNo: '00001234', cardType: 'normalCard' },
  { employeeNo: '0002', cardNo: '00001235', cardType: 'normalCard' },
]);
await client.faces.setMany([
  { employeeNo: '0001', image: { type: 'url', url: 'https://images.example.com/1.jpg' } },
  { employeeNo: '0002', image: { type: 'file', path: './2.jpg' } },
]);
const deleted = await client.users.deleteMany(['0001', '0002']);
await client.cards.deleteMany(['00001234', '00001235']);
await client.faces.deleteMany(['0001', '0002'], { libraryId: '1' });
console.log(created.results, deleted.accepted);
console.log((await client.users.getDeleteProgress()).data);
```

Replace the example images and person permission fields with values supported by the target device.

## Options and execution

- `concurrency`: 1–8, default 1. Results preserve input order.
- `stopOnError`: default false. When true, stop scheduling new work after an error; in-flight requests finish.
- `signal`: cancel the queue and return collected results plus skipped items.
- Deletion `strategy`: default `native`; choose `individual` explicitly for per-ID calls.

Native deletion sends the entire list in one request. There is no automatic splitting or retry with a different strategy after an error. Face deletion uses the same `libraryId` and `faceLibType` for all IDs in that batch.

Some devices delete asynchronously. Even individual mode may require waiting for a previous deletion to finish; `users.getDeleteProgress()` exposes the device's progress but does not poll automatically. Batches are not transactions and cannot roll back successful writes.

## Results

`BatchResult` contains `strategy`, `total`, `succeeded`, `accepted`, `failed`, `unknown`, `skipped`, `aborted`, and ordered `results`. Native deletion also includes its group `response` when available.

| Item status | Meaning |
| --- | --- |
| `succeeded` | A create, update, or set request succeeded |
| `accepted` | A deletion was acknowledged; completion for this ID is unconfirmed |
| `failed` | The item failed with a known error |
| `unknown` | The SDK cannot determine whether the write took effect |
| `skipped` | Work was not started due to cancellation or stop-on-error |

Each result has `index`, `id`, `status`, and optionally `response`, `error`, or `reason`. A native deletion device error can affect only some IDs, so a group-level device error marks those results unknown rather than inventing per-ID outcomes.

Invalid overall input rejects with `INVALID_ARGUMENT`. Individual execution errors are aggregated: a fulfilled Promise does not mean the whole batch succeeded. Inspect all counters and verify uncertain writes before retrying.

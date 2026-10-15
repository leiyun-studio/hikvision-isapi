# Face enrollment

[Wiki home](Home.md) · [简体中文](Faces-zh-CN.md)

Examples assume an existing person and a configured client.

## URL enrollment

```js
await client.faces.set({
  employeeNo: '0001', libraryId: '1',
  image: { type: 'url', url: 'https://images.example.com/face.jpg', fetchBy: 'device' },
});
```

The default `fetchBy: 'device'` sends the native `faceURL` field. The device must support URL enrollment and be able to reach that URL. Replace the example address with an accessible JPEG image.

To download on the SDK host and then upload multipart data:

```js
await client.faces.set({
  employeeNo: '0001',
  image: { type: 'url', url: 'https://images.example.com/face.jpg', fetchBy: 'sdk' },
});
```

External downloads do not receive device credentials and do not follow redirects.

## Binary inputs

```js
import { readFile } from 'node:fs/promises';

const jpegBuffer = await readFile('./face.jpg');
await client.faces.set({ employeeNo: '0001', image: jpegBuffer });
await client.faces.set({
  employeeNo: '0001',
  image: { type: 'base64', data: jpegBuffer.toString('base64') },
});
await client.faces.set({
  employeeNo: '0001', image: { type: 'file', path: './face.jpg' },
});
```

Buffer and Uint8Array are supported. Base64 can be a pure Base64 string or an image data URL. File paths refer to the SDK host, not the device.

Binary enrollment requires JPEG. The SDK does not crop, resize, or transcode images; checking file headers does not replace device face-quality validation. The default image limit is 10 MiB, configurable through `maxImageBytes`.

## Library, search, and deletion

```js
const page = await client.faces.search({ employeeNo: '0001', libraryId: '1' });
console.log(page.items);
await client.faces.delete('0001', { libraryId: '1' });
```

`set()` uses `PUT FDLib/FDSetUp`, while `create()` uses `POST FDLib/FaceDataRecord`. Defaults are `libraryId: '1'` and `faceLibType: 'blackFD'`; use the actual device library, with `staticFD` also accepted. Additional fields can be provided through `metadata`.

Search uses `FDSearch`; deletion uses `FDSearch/Delete`. Library IDs and employee IDs are strings. Read `faces.capabilities()` before relying on a particular input mode. See [batch operations](Batch-Operations.md) for `setMany()` and `deleteMany()`.

A face library photo is not an access-event snapshot. The SDK does not substitute one for the other.

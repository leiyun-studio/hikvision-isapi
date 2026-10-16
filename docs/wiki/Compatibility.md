# Runtime compatibility

[Wiki home](Home.md) · [简体中文](Compatibility-zh-CN.md)

## Runtime versus development tools

| Usage | Node.js requirement |
| --- | --- |
| Installed SDK | 16.20.2 or later |
| Source development, build, TypeScript checks, full test suite | 22 or later |
| Fastify web test console | 22 or later |

The published package contains prebuilt JavaScript. Installing it in an application does not require Fastify, the repository test runner, or the SDK's build tools. TypeScript declarations are included; TypeScript compiler compatibility is a separate concern from the Node runtime.

## Verified versions

On Windows x64, the same 36 core cases passed on Node **16.20.2, 18.0.0, 20.0.0, 22.0.0, and 24.9.0**. Tests cover Digest authentication, resource requests, face/image handling, pagination, batches, time/NTP, subscriptions, caller cancellation, deadlines, and listener/socket cleanup.

The SDK owns cancellation timers and caller-signal forwarding instead of relying on `AbortSignal.any()`. Timeout and abort handlers explicitly terminate HTTP requests and response streams, including during Digest authentication and body reads.

Node 14 is not supported: the existing code uses syntax and runtime APIs unavailable there. The original Node 14 probe remains a historical baseline, not a current support claim.

These tests use local simulated devices. They do not establish compatibility with all device models, firmware versions, operating systems, or future Node versions. The repository includes a CI matrix for Windows/Linux and the listed runtimes; local results do not imply that CI has already run remotely.

## CommonJS applications

The SDK is distributed as ESM. Node 16 CommonJS applications can use dynamic import inside an async function:

```js
async function main() {
  const { HikvisionClient } = await import('@lystudio/hikvision-isapi');
  const client = new HikvisionClient({
    baseUrl: process.env.HIKVISION_BASE_URL,
    username: process.env.HIKVISION_USERNAME,
    password: process.env.HIKVISION_PASSWORD,
  });
  console.log((await client.device.getInfo()).data);
}
main().catch(console.error);
```

A separate synchronous `require()` build is not provided. Browser code calls the SDK through a Node backend; it cannot use Node HTTP/filesystem APIs directly.

## Reproduce

Use Node 22+ to run `npm ci` and `npm run build`. Then execute `node scripts/probe-node-compatibility.js` using the target runtime. The probe adapts only test scaffolding for older Node releases; it runs the built SDK without injected polyfills or transpilation.

The source repository's `docs/compatibility/` contains detailed JSON results and installation verification instructions. Legacy runtime support enables existing applications to integrate the SDK; new deployments should use a maintained Node release.

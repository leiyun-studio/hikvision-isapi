# Web test console

[Wiki home](Home.md) · [简体中文](Web-Console-zh-CN.md)

## Run locally

From the source repository:

```sh
npm ci
npm run example:web
```

Open **http://127.0.0.1:3050**. The server listens on loopback. To change the port in PowerShell:

```powershell
$env:WEB_EXAMPLE_PORT = '3051'
npm run example:web
```

The npm SDK package does not include the web console or Fastify server; use the source repository to run this example.

## Test an operation

1. Enter a complete `baseUrl`, or choose protocol, IP/hostname, and port separately.
2. Enter the device username and password.
3. Select an SDK operation; the page supplies editable JSON parameters.
4. Review the generated Node.js example. It updates with the operation, parameters, address, and username.
5. Submit the request. Writes require a confirmation checkbox each time.

Credentials are not persisted. Generated examples use `process.env.HIKVISION_PASSWORD` rather than embedding the password. Large Base64 values are replaced with a placeholder that must be filled in before running the copied example.

The console includes people, cards, faces, batch operations, device information/capabilities, doors, history, images, and time/NTP settings. The raw request panel accepts GET only. Use `examples/subscribe.js` from the repository for live subscriptions.

## Pictures and file paths

Face enrollment accepts URL modes and browser-selected JPEG files, converted to Base64. Bulk face input accepts URLs/Base64; the web endpoint does not read arbitrary server files.

Buffer outputs are transported to the browser as Base64 for preview. File outputs are saved with generated names under `examples/web/downloads/`, on the machine running the test server. They are not paths on the device or the browser user's filesystem.

## Execution limits

The web backend accepts bodies up to 20 MiB and bounds one operation to 120 seconds. A browser disconnect cancels its request and stops unscheduled batch items. Writes already delivered to the device cannot be undone.

The console is a local development tool, without account management for remote hosting. Its host must be able to reach the device. SDK-level timeout and image limits still apply.

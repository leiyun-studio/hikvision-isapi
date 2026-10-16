# Development and contributing

[Wiki home](Home.md) · [简体中文](Development-zh-CN.md)

## Local setup

Use Node.js 22 or later for source development and build tooling. Applications using the installed SDK can run on Node.js 16.20.2 or later. From a source checkout:

```sh
npm ci
npm run check
npm run example:web
```

`npm run check` runs tests, checks public TypeScript declarations, and builds `dist/`. Tests use simulated devices and do not require real-device credentials.

## Package verification

```sh
npm pack
npm run pack:verify
```

The first command generates `lystudio-hikvision-isapi-0.1.0.tgz` for the current version. The verification script builds a package, installs it into an isolated temporary project, and checks imports, a simulated request, and a TypeScript consumer. No publication occurs.

In another application:

```sh
npm install /path/to/lystudio-hikvision-isapi-0.1.0.tgz
```

The package contains the generated SDK and documentation. Fastify is a development dependency. The web server, device credentials, and test fixtures are excluded.

## Layout

```text
src/index.js             Public SDK exports
src/index.d.ts           Public TypeScript declarations
src/client.js            Client and transport orchestration
src/resources/           People, cards, faces, events, time, images, batches
src/transport/           HTTP and Digest
src/parsers/             Response and multipart parsers
examples/basic.js        Read-only connection example
examples/subscribe.js    Live events example
examples/web/            Fastify + HTML test console
test/                    Simulated-device tests
type-tests/              TypeScript consumer checks
docs/wiki/               Bilingual Wiki sources
dist/                    Generated SDK
```

The separate health-check app in `src/app.js` and `src/server.js` is not part of the SDK package. Its `npm start` command reads `.env`; copy `.env.example` if using that app.

## Examples from the source tree

Set `HIKVISION_BASE_URL`, `HIKVISION_USERNAME`, and `HIKVISION_PASSWORD` in your environment, then run:

```sh
node examples/basic.js
node examples/subscribe.js
```

The basic example reads device information and users. The subscription example stops with Ctrl+C. Keep credentials outside committed files.

## Contribution workflow

1. Reproduce with a local fixture where possible.
2. Update SDK code and the public declarations together.
3. Add tests for meaningful behavior changes, including failures and cancellation when relevant.
4. Keep English and Chinese documentation and examples consistent.
5. Run `npm run check` and, for package/API changes, `npm run pack:verify`.

Device reports should include the model, firmware, SDK/Node versions, expected behavior, and redacted request/response details. Remove credentials, session cookies, personal records, and face data before sharing.

## Release metadata

The package uses the MIT License, included as `LICENSE` in the repository and npm archive. Before each release, update the package version and release notes. The source repository is [leiyun-studio/hikvision-isapi](https://github.com/leiyun-studio/hikvision-isapi); report issues through its [issue tracker](https://github.com/leiyun-studio/hikvision-isapi/issues).

Keep Wiki sources in sync with code. GitHub's Wiki uses a separate repository; the source repository contains `docs/WIKI-PUBLISHING.md` with manual publication instructions. Pushing the main repository alone does not publish those Wiki pages.

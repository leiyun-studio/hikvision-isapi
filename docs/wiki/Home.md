# Hikvision ISAPI SDK Wiki

**English** · [简体中文](Home-zh-CN.md)

This Wiki documents `@lystudio/hikvision-isapi`, a Node.js 22+ SDK for direct ISAPI access to Hikvision access control devices. It uses JavaScript ES Modules and includes TypeScript declarations.

## Start here

1. Install the SDK with `npm install @lystudio/hikvision-isapi`. For source builds, see the [development guide](Development.md).
2. [Configure a client](Configuration.md) with the device origin and credentials.
3. Read device capabilities and try read-only operations in the [web console](Web-Console.md).
4. Use the resource guides for your application.

## Guides

- [Client configuration](Configuration.md)
- [API reference](API-Reference.md)
- [Batch operations](Batch-Operations.md)
- [Face enrollment](Faces.md)
- [Events and images](Events-and-Images.md)
- [Device time and NTP](Device-Time.md)
- [Web test console](Web-Console.md)
- [Development and contributing](Development.md)

## Conventions

Examples use an existing `client` unless they show its creation. Replace sample dates, IDs, image URLs, and server addresses with your own test values. Mutating examples change device state when run.

Identifiers such as employee numbers and card numbers are strings. Device fields are retained rather than normalized into a model that discards vendor data. Support depends on the device model and firmware; mock tests do not certify device compatibility.

The SDK does not establish network connectivity to private devices or manufacture missing event images. See [events and images](Events-and-Images.md) and [error handling](API-Reference.md#errors-and-retries).

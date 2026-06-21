<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![npm](https://img.shields.io/npm/v/@kud/androidtv-remote?style=flat-square&color=CB3837)
![MIT](https://img.shields.io/badge/licence-MIT-22C55E?style=flat-square)

**Control Android TV / Google TV devices over the Android TV Remote v2 protocol**

[Features](#-features) • [Quick Start](#-quick-start) • [API Reference](#-api-reference) • [Development](#-development)

</div>

## 🌟 Features

- 🔑 **First-class pairing** — handles the full certificate-based TLS pairing flow and persists credentials for reconnect
- ⌨️ **Native text input** — `sendText()` uses IME injection to type arbitrary strings, no keycode mapping required
- 📺 **Full key control** — send any Android key via `RemoteKeyCode` constants (navigation, media, DPAD, volume, and more)
- 📡 **State events** — subscribe to `powered`, `volume`, `current_app`, and `unpaired` with typed payloads
- 🪶 **Lean dependencies** — `crypto-js`, `systeminformation`, and `core-js` dropped; relies only on `node-forge` and `protobufjs`
- 🔇 **Silent by default** — all internal logging is suppressed unless `debug: true` is set, so it fits cleanly inside a larger application
- 🏷️ **Typed API** — full TypeScript types exported; `on()`, `once()`, and `emit()` are all narrowed to the event map

## 🚀 Quick Start

```sh
npm install @kud/androidtv-remote
```

### Pair a new device

```js
import { createAndroidRemote } from "@kud/androidtv-remote"

const remote = createAndroidRemote("192.168.1.42")

remote.on("secret", () => {
  // The TV shows a pairing PIN — read it from stdin and submit
  remote.sendCode("123456")
})

remote.on("ready", () => {
  console.log("paired and connected")
  remote.sendPower()
})

await remote.start()

// Persist the certificate so you skip pairing next time
const cert = remote.getCertificate()
```

### Reconnect with a saved certificate

```js
import { createAndroidRemote } from "@kud/androidtv-remote"

const remote = createAndroidRemote("192.168.1.42", {
  cert: { key: savedKey, cert: savedCert },
})

remote.on("ready", () => {
  remote.sendText("Hello, TV!")
})

await remote.start()
```

## 📖 API Reference

### `createAndroidRemote(host, options?)`

Factory function that returns an `AndroidRemote` instance — an `EventEmitter` extended with control methods.

```ts
import { createAndroidRemote } from "@kud/androidtv-remote"

const remote = createAndroidRemote("192.168.1.42", options)
```

#### Options

| Option         | Type                            | Default              | Description                                                   |
| -------------- | ------------------------------- | -------------------- | ------------------------------------------------------------- |
| `cert`         | `{ key: string; cert: string }` | —                    | Previously obtained certificate. Skips pairing when provided. |
| `pairing_port` | `number`                        | `6467`               | TCP port for the pairing handshake.                           |
| `remote_port`  | `number`                        | `6466`               | TCP port for the remote control session.                      |
| `service_name` | `string`                        | `"androidtv-remote"` | Name sent to the TV during pairing.                           |
| `manufacturer` | `string`                        | —                    | Device manufacturer reported during pairing.                  |
| `model`        | `string`                        | —                    | Device model reported during pairing.                         |
| `debug`        | `boolean`                       | `false`              | Enable verbose internal logging.                              |

### Methods

| Method                         | Returns            | Description                                                   |
| ------------------------------ | ------------------ | ------------------------------------------------------------- |
| `start()`                      | `Promise<boolean>` | Connect to the TV. Triggers pairing if no certificate is set. |
| `sendCode(code)`               | `boolean`          | Submit the PIN displayed on the TV during pairing.            |
| `sendKey(keyCode, direction?)` | `void`             | Send a key press. Use `RemoteKeyCode` constants.              |
| `sendPower()`                  | `void`             | Toggle the TV power state.                                    |
| `sendAppLink(link)`            | `void`             | Launch an app via its deep-link URI.                          |
| `sendText(text)`               | `void`             | Inject arbitrary text via IME (no keycode mapping).           |
| `getCertificate()`             | `Certificate`      | Return the current `{ key, cert }` pair for persistence.      |
| `stop()`                       | `void`             | Close all connections.                                        |

### Events

| Event         | Payload                                              | Fired when                                          |
| ------------- | ---------------------------------------------------- | --------------------------------------------------- |
| `secret`      | —                                                    | The TV is showing a pairing PIN. Call `sendCode()`. |
| `ready`       | —                                                    | Connected and ready for commands.                   |
| `powered`     | `boolean`                                            | TV power state changed.                             |
| `volume`      | `{ level: number; maximum: number; muted: boolean }` | Volume state changed.                               |
| `current_app` | `string`                                             | Foreground app changed (package name).              |
| `unpaired`    | —                                                    | The TV rejected or revoked the certificate.         |
| `error`       | `Error`                                              | A protocol-level error occurred.                    |

### `RemoteKeyCode`

An enum of Android key codes. Common entries:

```ts
import { RemoteKeyCode } from "@kud/androidtv-remote"

remote.sendKey(RemoteKeyCode.KEYCODE_HOME)
remote.sendKey(RemoteKeyCode.KEYCODE_BACK)
remote.sendKey(RemoteKeyCode.KEYCODE_DPAD_UP)
remote.sendKey(RemoteKeyCode.KEYCODE_MEDIA_PLAY_PAUSE)
remote.sendKey(RemoteKeyCode.KEYCODE_VOLUME_UP)
```

### `RemoteDirection`

Direction constants for `sendKey()` — defaults to `SHORT` (a normal press). Use `START_LONG` / `END_LONG` to bracket a long press:

```ts
import { RemoteKeyCode, RemoteDirection } from "@kud/androidtv-remote"

remote.sendKey(RemoteKeyCode.KEYCODE_DPAD_UP) // SHORT by default
remote.sendKey(RemoteKeyCode.KEYCODE_DPAD_DOWN, RemoteDirection.START_LONG)
remote.sendKey(RemoteKeyCode.KEYCODE_DPAD_DOWN, RemoteDirection.END_LONG)
```

### `setDebug(enabled)`

Enable or disable verbose logging globally (affects all instances):

```ts
import { setDebug } from "@kud/androidtv-remote"

setDebug(true)
```

## 🔧 Development

```
androidtv-remote/
├── src/
│   ├── index.ts                        # Public API and factory
│   ├── types.ts                        # Shared TypeScript types
│   ├── device-info.ts                  # Device metadata sent during pairing
│   ├── logger.ts                       # Debug-gated logger
│   ├── certificate/
│   │   └── certificate-generator.ts   # TLS cert generation via node-forge
│   ├── pairing/
│   │   ├── pairing-manager.ts         # Pairing session state machine
│   │   ├── pairing-message-manager.ts
│   │   └── pairingmessage.proto
│   └── remote/
│       ├── remote-manager.ts          # Remote control session
│       ├── remote-message-manager.ts  # Key/text encoding
│       └── remotemessage.proto
└── dist/                              # Compiled output (tsup)
```

```sh
git clone https://github.com/kud/androidtv-remote.git
cd androidtv-remote
npm install
npm run build
```

### Scripts

| Script                | Description                            |
| --------------------- | -------------------------------------- |
| `npm run build`       | Compile TypeScript to `dist/` via tsup |
| `npm run build:watch` | Recompile on file changes              |
| `npm run typecheck`   | Type-check without emitting            |
| `npm test`            | Run tests with tsx                     |
| `npm run clean`       | Remove `dist/`                         |

## 🏗 Tech Stack

| Package      | Role                                                |
| ------------ | --------------------------------------------------- |
| `node-forge` | TLS certificate generation and mutual TLS           |
| `protobufjs` | Encode/decode Android TV Remote v2 protocol buffers |
| `tsup`       | Zero-config TypeScript bundler                      |
| `tsx`        | TypeScript test runner                              |

## Credits

Derived from [androidtv-remote](https://github.com/louis49/androidtv-remote) by [louis49](https://github.com/louis49) (MIT). The reverse-engineered Android TV Remote v2 protocol and `.proto` schemas originate from that project. This library is a TypeScript rewrite with a functional API, native text input support, and a leaner dependency footprint.

---

MIT © [kud](https://github.com/kud)

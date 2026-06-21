# @kud/androidtv-remote

Control **Android TV / Google TV** devices over the Android TV Remote v2 protocol — pairing, key presses, app launches, and text input — from Node.js.

A modern TypeScript + native-ESM rewrite of [louis49/androidtv-remote](https://github.com/louis49/androidtv-remote) (MIT), which has been unmaintained since 2022. This fork adds native text input (`sendText`), drops heavy dependencies, ships proper types, and targets Node 22+.

## Install

```sh
npm install @kud/androidtv-remote
```

## Usage

```ts
import {
  createAndroidRemote,
  RemoteKeyCode,
  RemoteDirection,
} from "@kud/androidtv-remote"

const remote = createAndroidRemote("192.168.1.42", {
  service_name: "my-app",
  // cert: savedCert,   // omit on first run to trigger pairing
})

remote.on("secret", async () => {
  remote.sendCode(await promptUserForPin()) // PIN shown on the TV
})

remote.on("ready", () => {
  remote.sendKey(RemoteKeyCode.KEYCODE_HOME, RemoteDirection.SHORT)
  remote.sendText("interstellar") // type into a focused search box
})

remote.on("powered", (on) => console.log("power:", on))
remote.on("volume", (v) => console.log("volume:", v))
remote.on("current_app", (pkg) => console.log("app:", pkg))

await remote.start()
const cert = remote.getCertificate() // persist this to skip pairing next time
```

## API

### `createAndroidRemote(host, options)`

- `host` — the TV's IP address.
- `options.cert` — `{ key, cert }` from a previous pairing; omit to pair.
- `options.pairing_port` — default `6467`.
- `options.remote_port` — default `6466`.
- `options.service_name` — name shown on the TV during pairing.
- `options.manufacturer` / `options.model` — client device identity (defaults derived from `node:os`).
- `options.debug` — set `true` to enable protocol logging (silent by default).

### Methods

- `start(): Promise<boolean>` — pair (if no cert) then open the remote connection.
- `sendCode(code)` — answer the `secret` event with the PIN from the TV.
- `sendKey(keyCode, direction?)` — send a key press (see `RemoteKeyCode` / `RemoteDirection`).
- `sendPower()` — toggle power.
- `sendAppLink(link)` — launch an app via its deep link.
- `sendText(text)` — type text into the focused field.
- `getCertificate()` — the `{ key, cert }` to persist for reconnects.
- `stop()` — close the connection.

### Events

`secret` · `ready` · `powered(boolean)` · `volume({level, maximum, muted})` · `current_app(string)` · `unpaired` · `error(Error)`

## Credits

Derived from [louis49/androidtv-remote](https://github.com/louis49/androidtv-remote) by louis49 (MIT). The reverse-engineered protocol and `.proto` schemas originate there; this package modernises the implementation and is maintained going forward.

## License

MIT

import tls from "node:tls"
import EventEmitter from "node:events"
import * as messages from "./remote-message-manager.js"
import { log } from "../logger.js"
import type { Certificate } from "../types.js"

interface RemoteResponse {
  remotePingRequest?: { val1: number }
  remoteConfigure?: unknown
  remoteSetActive?: unknown
  remoteImeKeyInject?: { appInfo: { appPackage: string } }
  remoteImeBatchEdit?: { imeCounter: number; fieldCounter: number }
  remoteImeShowRequest?: unknown
  remoteVoiceBegin?: unknown
  remoteVoicePayload?: unknown
  remoteVoiceEnd?: unknown
  remoteStart?: { started: boolean }
  remoteSetVolumeLevel?: {
    volumeLevel: number
    volumeMax: number
    volumeMuted: boolean
  }
  remoteSetPreferredAudioDevice?: unknown
  remoteError?: unknown
  toJSON(): unknown
}

interface RemoteManager extends EventEmitter {
  start(): Promise<boolean>
  sendPower(): void
  sendKey(keyCode: number, direction?: number): void
  sendAppLink(link: string): void
  sendText(text: string): void
  stop(): void
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

const createRemoteManager = (
  host: string,
  port: number,
  certs: Certificate,
): RemoteManager => {
  const emitter = new EventEmitter()
  let client: tls.TLSSocket | undefined
  let chunks = Buffer.from([])
  let error: NodeJS.ErrnoException | null = null
  let imeCounter = 0
  let fieldCounter = 0
  let stopped = false

  const start = (): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const options: tls.ConnectionOptions = {
        key: certs.key,
        cert: certs.cert,
        port,
        host,
        rejectUnauthorized: false,
      }

      log.debug("Start Remote Connect")
      client = tls.connect(options, () => {})

      client.on("timeout", () => {
        log.debug("timeout")
        client?.destroy()
      })

      // The TV pings every ~5s; 10s without data means the link is dead.
      client.setTimeout(10000)

      client.on("secureConnect", () => {
        log.debug(host + " Remote secureConnect")
        resolve(true)
      })

      client.on("data", (data) => {
        chunks = Buffer.concat([chunks, Buffer.from(data)])

        if (chunks.length > 0 && chunks.readInt8(0) === chunks.length - 1) {
          const message = messages.parse(chunks) as unknown as RemoteResponse

          if (!message.remotePingRequest) {
            log.debug(host + " Receive : " + JSON.stringify(message.toJSON()))
          }

          if (message.remoteConfigure) {
            client?.write(messages.createRemoteConfigure())
            emitter.emit("ready")
          } else if (message.remoteSetActive) {
            client?.write(messages.createRemoteSetActive(622))
          } else if (message.remotePingRequest) {
            client?.write(
              messages.createRemotePingResponse(message.remotePingRequest.val1),
            )
          } else if (message.remoteImeKeyInject) {
            emitter.emit(
              "current_app",
              message.remoteImeKeyInject.appInfo.appPackage,
            )
          } else if (message.remoteImeBatchEdit) {
            imeCounter = message.remoteImeBatchEdit.imeCounter
            fieldCounter = message.remoteImeBatchEdit.fieldCounter
          } else if (message.remoteImeShowRequest) {
            log.debug("Receive IME SHOW REQUEST")
          } else if (message.remoteVoiceBegin) {
            // voice input not implemented
          } else if (message.remoteVoicePayload) {
            // voice input not implemented
          } else if (message.remoteVoiceEnd) {
            // voice input not implemented
          } else if (message.remoteStart) {
            emitter.emit("powered", message.remoteStart.started)
          } else if (message.remoteSetVolumeLevel) {
            emitter.emit("volume", {
              level: message.remoteSetVolumeLevel.volumeLevel,
              maximum: message.remoteSetVolumeLevel.volumeMax,
              muted: message.remoteSetVolumeLevel.volumeMuted,
            })
          } else if (message.remoteSetPreferredAudioDevice) {
            // ignored
          } else if (message.remoteError) {
            emitter.emit(
              "error",
              new Error("Remote error: " + JSON.stringify(message.remoteError)),
            )
          } else {
            log.debug("What else ?")
          }
          chunks = Buffer.from([])
        }
      })

      client.on("close", async (hasError) => {
        log.info(host + " Remote Connection closed ", hasError)
        // An explicit stop() must not trigger the auto-reconnect ladder below.
        if (stopped) return
        if (hasError) {
          reject(
            new Error(error?.code ?? "Remote connection closed with error"),
          )
          if (error?.code === "ECONNRESET") {
            emitter.emit("unpaired")
          } else if (error?.code === "ECONNREFUSED") {
            await wait(1000)
            await start().catch((e) => log.error(e))
          } else if (error?.code === "EHOSTDOWN") {
            // device is off — do not reconnect
          } else {
            await wait(1000)
            await start().catch((e) => log.error(e))
          }
        } else {
          await wait(1000)
          await start().catch((e) => log.error(e))
        }
      })

      client.on("error", (err: NodeJS.ErrnoException) => {
        log.error(host, err)
        error = err
      })
    })

  const sendPower = (): void => {
    client?.write(
      messages.createRemoteKeyInject(
        messages.RemoteDirection.SHORT,
        messages.RemoteKeyCode.KEYCODE_POWER,
      ),
    )
  }

  const sendKey = (
    keyCode: number,
    direction: number = messages.RemoteDirection.SHORT,
  ): void => {
    client?.write(messages.createRemoteKeyInject(direction, keyCode))
  }

  const sendAppLink = (link: string): void => {
    client?.write(messages.createRemoteAppLinkLaunchRequest(link))
  }

  const sendText = (text: string): void => {
    client?.write(
      messages.createRemoteImeBatchEdit(imeCounter, fieldCounter, text),
    )
  }

  const stop = (): void => {
    stopped = true
    client?.destroy()
  }

  return Object.assign(emitter, {
    start,
    sendPower,
    sendKey,
    sendAppLink,
    sendText,
    stop,
  })
}

export { createRemoteManager }
export type { RemoteManager }

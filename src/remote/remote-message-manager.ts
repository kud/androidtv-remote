import protobuf from "protobufjs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { deviceInfo } from "../device-info.js"
import { log } from "../logger.js"

const directory = dirname(fileURLToPath(import.meta.url))
const root = protobuf.loadSync(join(directory, "remotemessage.proto"))
const RemoteMessage = root.lookupType("remote.RemoteMessage")

const RemoteKeyCode = root.lookupEnum("remote.RemoteKeyCode").values
const RemoteDirection = root.lookupEnum("remote.RemoteDirection").values

const create = (payload: Record<string, unknown>): Uint8Array => {
  if (!payload.remotePingResponse) {
    log.debug("Create Remote " + JSON.stringify(payload))
  }
  const errMsg = RemoteMessage.verify(payload)
  if (errMsg) throw new Error(errMsg)
  const message = RemoteMessage.create(payload)
  const array = RemoteMessage.encodeDelimited(message).finish()
  if (!payload.remotePingResponse) {
    log.debug("Sending " + JSON.stringify(message.toJSON()))
  }
  return array
}

const createRemoteConfigure = (): Uint8Array =>
  create({
    remoteConfigure: {
      code1: 622,
      deviceInfo: {
        model: deviceInfo.model,
        vendor: deviceInfo.manufacturer,
        unknown1: 1,
        unknown2: "1",
        packageName: "androidtv-remote",
        appVersion: "1.0.0",
      },
    },
  })

const createRemoteSetActive = (active: number): Uint8Array =>
  create({ remoteSetActive: { active } })

const createRemotePingResponse = (val1: number): Uint8Array =>
  create({ remotePingResponse: { val1 } })

const createRemoteKeyInject = (
  direction: number,
  keyCode: number,
): Uint8Array => create({ remoteKeyInject: { keyCode, direction } })

const createRemoteImeBatchEdit = (
  imeCounter: number,
  fieldCounter: number,
  text: string,
): Uint8Array => {
  const cursor = text.length
  return create({
    remoteImeBatchEdit: {
      imeCounter,
      fieldCounter,
      editInfo: [
        {
          insert: 1,
          textFieldStatus: { start: cursor, end: cursor, value: text },
        },
      ],
    },
  })
}

const createRemoteAppLinkLaunchRequest = (appLink: string): Uint8Array =>
  create({ remoteAppLinkLaunchRequest: { appLink } })

const parse = (buffer: Buffer): protobuf.Message =>
  RemoteMessage.decodeDelimited(buffer)

export {
  RemoteKeyCode,
  RemoteDirection,
  createRemoteConfigure,
  createRemoteSetActive,
  createRemotePingResponse,
  createRemoteKeyInject,
  createRemoteImeBatchEdit,
  createRemoteAppLinkLaunchRequest,
  parse,
}

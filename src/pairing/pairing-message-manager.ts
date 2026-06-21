import protobuf from "protobufjs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { deviceInfo } from "../device-info.js"

const directory = dirname(fileURLToPath(import.meta.url))
const root = protobuf.loadSync(join(directory, "pairingmessage.proto"))
const PairingMessage = root.lookupType("pairing.PairingMessage")
const RoleType = root.lookupEnum("RoleType").values
const EncodingType = root.lookupEnum(
  "pairing.PairingEncoding.EncodingType",
).values

const Status = root.lookupEnum("pairing.PairingMessage.Status").values

const create = (payload: object): Uint8Array => {
  const errMsg = PairingMessage.verify(payload)
  if (errMsg) throw new Error(errMsg)
  return PairingMessage.encodeDelimited(PairingMessage.create(payload)).finish()
}

const createPairingRequest = (serviceName: string): Uint8Array =>
  create({
    pairingRequest: { serviceName, clientName: deviceInfo.model },
    status: Status.STATUS_OK,
    protocolVersion: 2,
  })

const createPairingOption = (): Uint8Array =>
  create({
    pairingOption: {
      preferredRole: RoleType.ROLE_TYPE_INPUT,
      inputEncodings: [
        { type: EncodingType.ENCODING_TYPE_HEXADECIMAL, symbolLength: 6 },
      ],
    },
    status: Status.STATUS_OK,
    protocolVersion: 2,
  })

const createPairingConfiguration = (): Uint8Array =>
  create({
    pairingConfiguration: {
      clientRole: RoleType.ROLE_TYPE_INPUT,
      encoding: {
        type: EncodingType.ENCODING_TYPE_HEXADECIMAL,
        symbolLength: 6,
      },
    },
    status: Status.STATUS_OK,
    protocolVersion: 2,
  })

const createPairingSecret = (secret: number[]): Uint8Array =>
  create({
    pairingSecret: { secret },
    status: Status.STATUS_OK,
    protocolVersion: 2,
  })

const parse = (buffer: Buffer): protobuf.Message =>
  PairingMessage.decodeDelimited(buffer)

export {
  Status,
  createPairingRequest,
  createPairingOption,
  createPairingConfiguration,
  createPairingSecret,
  parse,
}

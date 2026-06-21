import tls from "node:tls"
import { createHash } from "node:crypto"
import EventEmitter from "node:events"
import * as messages from "./pairing-message-manager.js"
import { log } from "../logger.js"
import type { Certificate } from "../types.js"

interface PairingResponse {
  status: number
  pairingRequestAck?: unknown
  pairingOption?: unknown
  pairingConfigurationAck?: unknown
  pairingSecretAck?: unknown
  toJSON(): unknown
}

interface PairingManager extends EventEmitter {
  start(): Promise<boolean>
  sendCode(code: string): boolean
  stop(): void
}

// Signed-byte hex parse, ported verbatim from upstream. Both the code and the
// digest run through this, so the >127 → negative conversion must stay exact.
const hexStringToBytes = (q: string): number[] => {
  const bytes: number[] = []
  for (let i = 0; i < q.length; i += 2) {
    let byte = parseInt(q.substring(i, i + 2), 16)
    if (byte > 127) {
      byte = -(~byte & 0xff) - 1
    }
    bytes.push(byte)
  }
  return bytes
}

const createPairingManager = (
  host: string,
  port: number,
  certs: Certificate,
  serviceName: string,
): PairingManager => {
  const emitter = new EventEmitter()
  let client: tls.TLSSocket | undefined
  let chunks = Buffer.from([])

  const sendCode = (code: string): boolean => {
    log.debug("Sending code:", code)
    const codeBytes = hexStringToBytes(code)
    if (!client) return false

    // RSA cert details. Node types modulus/exponent as optional, but both are
    // always present for the RSA certs used in pairing.
    type RsaCertificate = { modulus: string; exponent: string }
    const clientCertificate = client.getCertificate() as RsaCertificate
    const serverCertificate =
      client.getPeerCertificate() as unknown as RsaCertificate

    // SHA-256 over both certs' moduli/exponents plus the user code. Ported from
    // upstream's crypto-js to native node:crypto — identical byte segments,
    // proven equivalent in test/digest.test.ts.
    const sha256 = createHash("sha256")
    sha256.update(Buffer.from(clientCertificate.modulus, "hex"))
    sha256.update(Buffer.from("0" + clientCertificate.exponent.slice(2), "hex"))
    sha256.update(Buffer.from(serverCertificate.modulus, "hex"))
    sha256.update(Buffer.from("0" + serverCertificate.exponent.slice(2), "hex"))
    sha256.update(Buffer.from(code.slice(2), "hex"))

    const hashArray = hexStringToBytes(sha256.digest("hex"))
    if (hashArray[0] !== codeBytes[0]) {
      client.destroy(new Error("Bad Code"))
      return false
    }
    client.write(messages.createPairingSecret(hashArray))
    return true
  }

  const start = (): Promise<boolean> =>
    new Promise((resolve, reject) => {
      const options: tls.ConnectionOptions = {
        key: certs.key,
        cert: certs.cert,
        port,
        host,
        rejectUnauthorized: false,
      }

      log.debug("Start Pairing Connect")
      client = tls.connect(options, () => {
        log.debug(host + " Pairing connected")
      })

      client.on("secureConnect", () => {
        log.debug(host + " Pairing secure connected")
        client?.write(messages.createPairingRequest(serviceName))
      })

      client.on("data", (data) => {
        chunks = Buffer.concat([chunks, Buffer.from(data)])

        if (chunks.length > 0 && chunks.readInt8(0) === chunks.length - 1) {
          const message = messages.parse(chunks) as unknown as PairingResponse

          log.debug("Receive : " + Array.from(chunks))
          log.debug("Receive : " + JSON.stringify(message.toJSON()))

          if (message.status !== messages.Status.STATUS_OK) {
            client?.destroy(new Error(String(message.status)))
          } else if (message.pairingRequestAck) {
            client?.write(messages.createPairingOption())
          } else if (message.pairingOption) {
            client?.write(messages.createPairingConfiguration())
          } else if (message.pairingConfigurationAck) {
            emitter.emit("secret")
          } else if (message.pairingSecretAck) {
            log.debug(host + " Paired!")
            client?.destroy()
          } else {
            log.debug(host + " What Else ?")
          }
          chunks = Buffer.from([])
        }
      })

      client.on("close", (hasError) => {
        log.debug(host + " Pairing Connection closed", hasError)
        if (hasError) {
          reject(new Error("Pairing connection closed with error"))
        } else {
          resolve(true)
        }
      })

      client.on("error", (error) => {
        log.error(error)
      })
    })

  const stop = (): void => {
    client?.destroy()
  }

  return Object.assign(emitter, { start, sendCode, stop })
}

export { createPairingManager }
export type { PairingManager }

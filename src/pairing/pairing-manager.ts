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

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

// Transient connect-stage failures worth retrying: a dozing TV (Wi-Fi
// power-save) drops off the network and reports these until it wakes. Anything
// past a live TLS session — a wrong PIN, a rejected pairing — is terminal.
const RETRYABLE_CONNECT_CODES = new Set([
  "EHOSTUNREACH",
  "EHOSTDOWN",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ECONNRESET",
])
const MAX_CONNECT_ATTEMPTS = 5
const RETRY_DELAY_MS = 1000

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

  const connectOnce = (): Promise<boolean> =>
    new Promise((resolve, reject) => {
      chunks = Buffer.from([])
      let sockError: NodeJS.ErrnoException | null = null
      let secure = false

      // `family` is a net-level lookup option that tls.connect forwards to the
      // underlying socket; it isn't in tls.ConnectionOptions, so widen the type.
      const options: tls.ConnectionOptions & { family?: number } = {
        key: certs.key,
        cert: certs.cert,
        port,
        host,
        // Android TVs are reachable over IPv4 on the LAN. Pin the lookup to IPv4
        // so a resolved hostname can't yield a scopeless IPv6 link-local address,
        // which routes to loopback and fails EHOSTUNREACH under Happy Eyeballs.
        family: 4,
        rejectUnauthorized: false,
      }

      log.debug("Start Pairing Connect")
      client = tls.connect(options, () => {
        log.debug(host + " Pairing connected")
      })

      client.on("secureConnect", () => {
        secure = true
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
        if (!hasError) {
          resolve(true)
          return
        }
        // Retry only when the TLS session never came up — a transient network
        // blink. Once `secure`, we're mid-protocol and any failure (wrong PIN,
        // rejected pairing) must surface rather than silently reconnect.
        const err = new Error("Pairing connection closed with error")
        Object.assign(err, {
          code: sockError?.code,
          retryable:
            !secure &&
            sockError?.code !== undefined &&
            RETRYABLE_CONNECT_CODES.has(sockError.code),
        })
        reject(err)
      })

      client.on("error", (error) => {
        sockError = error as NodeJS.ErrnoException
        log.error(error)
      })
    })

  // Ride out a dozing TV's power-save window: reconnect on transient connect
  // failures before surfacing the friendly "could not connect" to the caller.
  const start = async (): Promise<boolean> => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await connectOnce()
      } catch (error) {
        const { retryable, code } = error as {
          retryable?: boolean
          code?: string
        }
        if (!retryable || attempt >= MAX_CONNECT_ATTEMPTS) throw error
        log.debug(
          `${host} Pairing connect failed (${code}); retry ${attempt}/${MAX_CONNECT_ATTEMPTS - 1} in ${RETRY_DELAY_MS}ms`,
        )
        await wait(RETRY_DELAY_MS)
      }
    }
  }

  const stop = (): void => {
    client?.destroy()
  }

  return Object.assign(emitter, { start, sendCode, stop })
}

export { createPairingManager }
export type { PairingManager }

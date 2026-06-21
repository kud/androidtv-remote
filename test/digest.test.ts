import test from "node:test"
import assert from "node:assert/strict"
import { createHash, randomBytes } from "node:crypto"
import CryptoJS from "crypto-js"

// Proves the pairing-secret digest is byte-identical between the upstream
// crypto-js implementation and the native node:crypto port. The segments must
// match exactly: RSA moduli (even-length hex) and exponents padded to even via
// "0" + exponent — the input domain the real pairing flow produces.

const oldDigest = (
  clientMod: string,
  clientExp: string,
  serverMod: string,
  serverExp: string,
  code: string,
): string => {
  const sha256 = CryptoJS.algo.SHA256.create()
  sha256.update(CryptoJS.enc.Hex.parse(clientMod))
  sha256.update(CryptoJS.enc.Hex.parse("0" + clientExp.slice(2)))
  sha256.update(CryptoJS.enc.Hex.parse(serverMod))
  sha256.update(CryptoJS.enc.Hex.parse("0" + serverExp.slice(2)))
  sha256.update(CryptoJS.enc.Hex.parse(code.slice(2)))
  return sha256.finalize().toString()
}

const newDigest = (
  clientMod: string,
  clientExp: string,
  serverMod: string,
  serverExp: string,
  code: string,
): string => {
  const sha256 = createHash("sha256")
  sha256.update(Buffer.from(clientMod, "hex"))
  sha256.update(Buffer.from("0" + clientExp.slice(2), "hex"))
  sha256.update(Buffer.from(serverMod, "hex"))
  sha256.update(Buffer.from("0" + serverExp.slice(2), "hex"))
  sha256.update(Buffer.from(code.slice(2), "hex"))
  return sha256.digest("hex")
}

// The real input domain: every hashed segment is even-length hex. RSA moduli
// are 256 bytes (512 chars). The exponent is 65537 = 0x10001 for both node-forge
// (our cert) and Android TV (the server cert), and "0" + "10001" = "010001" is
// even. Odd-length segments never reach this code, so crypto-js's partial-byte
// handling and Buffer.from's truncation never diverge in practice.
const RSA_EXPONENT = "0x10001"

test("crypto-js and node:crypto produce identical pairing digests", () => {
  for (let i = 0; i < 300; i++) {
    const clientMod = randomBytes(256).toString("hex").toUpperCase()
    const serverMod = randomBytes(256).toString("hex").toUpperCase()
    const code = "0x" + randomBytes(3).toString("hex")
    assert.equal(
      newDigest(clientMod, RSA_EXPONENT, serverMod, RSA_EXPONENT, code),
      oldDigest(clientMod, RSA_EXPONENT, serverMod, RSA_EXPONENT, code),
    )
  }
})

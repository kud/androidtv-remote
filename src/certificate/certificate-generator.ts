import forge from "node-forge"
import { randomBytes } from "node:crypto"
import type { Certificate } from "../types.js"

// Self-signed RSA-2048 client certificate for TLS mutual auth. The cert is
// identity-bearing: the TV ties pairing to it, so reconnects must reuse the
// exact same cert. Ported 1:1 from upstream — node-forge unchanged on purpose.
const generateCertificate = (
  name: string,
  country: string,
  state: string,
  locality: string,
  organisation: string,
  organisationalUnit: string,
): Certificate => {
  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = "01" + randomBytes(19).toString("hex")
  cert.validity.notBefore = new Date()
  const notAfter = new Date()
  notAfter.setUTCFullYear(2099)
  cert.validity.notAfter = notAfter

  cert.setSubject([
    { name: "commonName", value: name },
    { name: "countryName", value: country },
    { shortName: "ST", value: state },
    { name: "localityName", value: locality },
    { name: "organizationName", value: organisation },
    { shortName: "OU", value: organisationalUnit },
  ])
  cert.sign(keys.privateKey, forge.md.sha256.create())

  return {
    cert: forge.pki.certificateToPem(cert),
    key: forge.pki.privateKeyToPem(keys.privateKey),
  }
}

export { generateCertificate }

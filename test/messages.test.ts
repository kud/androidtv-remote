import test from "node:test"
import assert from "node:assert/strict"
import {
  createRemoteKeyInject,
  createRemoteAppLinkLaunchRequest,
  createRemoteImeBatchEdit,
  createRemotePingResponse,
  parse,
} from "../src/remote/remote-message-manager.js"
import { RemoteKeyCode, RemoteDirection, createAndroidRemote } from "../src/index.js"
import { generateCertificate } from "../src/certificate/certificate-generator.js"

const decode = (bytes: Uint8Array) =>
  parse(Buffer.from(bytes)).toJSON() as Record<string, any>

test("key inject round-trips through the protobuf codec", () => {
  const msg = decode(
    createRemoteKeyInject(RemoteDirection.SHORT as number, RemoteKeyCode.KEYCODE_HOME as number),
  )
  assert.equal(msg.remoteKeyInject.keyCode, "KEYCODE_HOME")
  assert.equal(msg.remoteKeyInject.direction, "SHORT")
})

test("app link, ping and text messages encode and decode", () => {
  assert.equal(
    decode(createRemoteAppLinkLaunchRequest("https://example.com/app"))
      .remoteAppLinkLaunchRequest.appLink,
    "https://example.com/app",
  )
  assert.equal(decode(createRemotePingResponse(7)).remotePingResponse.val1, 7)
  const ime = decode(createRemoteImeBatchEdit(1, 2, "hello")).remoteImeBatchEdit
  assert.equal(ime.editInfo[0].textFieldStatus.value, "hello")
  assert.equal(ime.editInfo[0].textFieldStatus.end, 5)
})

test("public API exposes key codes and a controller before connecting", () => {
  assert.ok(Object.keys(RemoteKeyCode).length > 100)
  const remote = createAndroidRemote("127.0.0.1")
  assert.equal(remote.sendCode("ABCDEF"), false)
  assert.deepEqual(remote.getCertificate(), { key: "", cert: "" })
  assert.doesNotThrow(() => remote.stop())
})

test("generateCertificate returns a PEM pair", () => {
  const { cert, key } = generateCertificate("t", "CNT", "ST", "LOC", "O", "OU")
  assert.match(cert, /BEGIN CERTIFICATE/)
  assert.match(key, /BEGIN RSA PRIVATE KEY/)
})

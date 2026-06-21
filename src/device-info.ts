import os from "node:os"

// Client identity sent to the TV in pairing and remote-configure handshakes.
// Replaces the old `systeminformation` dependency — that fetched manufacturer/
// model asynchronously in a constructor, so a fast pairing could read undefined.
// This is synchronous and overridable via AndroidRemote options.
const deviceInfo = {
  manufacturer: "unknown",
  model: os.hostname() || "androidtv-remote",
}

const setDeviceInfo = (info: {
  manufacturer?: string
  model?: string
}): void => {
  if (info.manufacturer) deviceInfo.manufacturer = info.manufacturer
  if (info.model) deviceInfo.model = info.model
}

export { deviceInfo, setDeviceInfo }

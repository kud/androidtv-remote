interface Certificate {
  key: string
  cert: string
}

interface VolumeState {
  level: number
  maximum: number
  muted: boolean
}

interface AndroidRemoteOptions {
  cert?: Partial<Certificate>
  pairing_port?: number
  remote_port?: number
  service_name?: string
  manufacturer?: string
  model?: string
  debug?: boolean
}

// Event payload map — gives consumers typed `.on(...)` without casts.
interface AndroidRemoteEvents {
  secret: []
  ready: []
  powered: [boolean]
  volume: [VolumeState]
  current_app: [string]
  unpaired: []
  error: [Error]
}

export type {
  Certificate,
  VolumeState,
  AndroidRemoteOptions,
  AndroidRemoteEvents,
}

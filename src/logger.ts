// Protocol logging is silent by default. The old upstream sprayed console.debug
// on every message, forcing consumers to monkey-patch console to quieten it.
// Here a single `debug` flag (set from AndroidRemote options) gates all output.
let enabled = false

const setDebug = (value: boolean): void => {
  enabled = value
}

const log = {
  debug: (...args: unknown[]): void => {
    if (enabled) console.debug(...args)
  },
  info: (...args: unknown[]): void => {
    if (enabled) console.info(...args)
  },
  error: (...args: unknown[]): void => {
    if (enabled) console.error(...args)
  },
}

export { log, setDebug }

import { defineConfig } from "tsup"
import { copyFileSync } from "node:fs"

// The .proto schemas are loaded at runtime via protobufjs.loadSync, resolved
// relative to import.meta.url. After bundling, that resolves to dist/, so both
// protos must sit there next to the bundle. tsx (dev) resolves them from src/.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "node22",
  outDir: "dist",
  onSuccess: async () => {
    copyFileSync(
      "src/pairing/pairingmessage.proto",
      "dist/pairingmessage.proto",
    )
    copyFileSync("src/remote/remotemessage.proto", "dist/remotemessage.proto")
  },
})

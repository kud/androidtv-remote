import { createInterface } from "node:readline/promises"
import { stdin, stdout, argv } from "node:process"
import { createAndroidRemote, RemoteKeyCode } from "@kud/androidtv-remote"

// Real-device smoke test:  npx tsx example/remote.ts <TV_IP>
const host = argv[2]
if (!host) {
  console.error("usage: tsx example/remote.ts <TV_IP>")
  process.exit(1)
}

const rl = createInterface({ input: stdin, output: stdout })
const remote = createAndroidRemote(host, {
  service_name: "androidtv-remote-example",
})

remote.on("secret", async () => {
  const code = await rl.question("Enter the PIN shown on the TV: ")
  remote.sendCode(code.trim())
})

remote.on("powered", (on) => console.log("· powered:", on))
remote.on("volume", (v) => console.log("· volume:", v))
remote.on("current_app", (pkg) => console.log("· current_app:", pkg))
remote.on("error", (e) => console.log("· error:", e.message))
remote.on("unpaired", () => console.log("· unpaired"))

remote.on("ready", async () => {
  console.log("\n✓ ready — running checkpoint sequence")
  remote.sendKey(RemoteKeyCode.KEYCODE_HOME)
  await new Promise((r) => setTimeout(r, 1500))
  console.log(
    "  sent HOME — now open a search field on the TV, then press Enter here",
  )
  await rl.question("")
  remote.sendText("interstellar")
  console.log('  sent text "interstellar" — check the TV search box')
  await rl.question("Press Enter to finish…")
  remote.stop()
  rl.close()
  process.exit(0)
})

console.log(`Connecting to ${host} …`)
await remote.start()

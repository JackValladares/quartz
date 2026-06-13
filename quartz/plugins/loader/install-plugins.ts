#!/usr/bin/env node
import fs from "fs"
import path from "path"
import YAML from "yaml"
import { styleText } from "util"
import {
  installPlugin,
  installNativeDeps,
  parsePluginSource,
  regeneratePluginIndex,
} from "./gitLoader.js"
import { QuartzPluginsJson } from "./types.js"

const CONFIG_YAML_PATH = path.join(process.cwd(), "quartz.config.yaml")
const DEFAULT_CONFIG_YAML_PATH = path.join(process.cwd(), "quartz.config.default.yaml")

function resolveConfigPath(): string {
  if (fs.existsSync(CONFIG_YAML_PATH)) return CONFIG_YAML_PATH
  if (fs.existsSync(DEFAULT_CONFIG_YAML_PATH)) return DEFAULT_CONFIG_YAML_PATH
  throw new Error("Could not find quartz.config.yaml or quartz.config.default.yaml")
}

async function main() {
  const configPath = resolveConfigPath()
  const json = YAML.parse(fs.readFileSync(configPath, "utf-8")) as QuartzPluginsJson
  const enabledEntries = json.plugins.filter((e) => e.enabled)

  console.log(`Installing ${enabledEntries.length} plugin(s)...`)

  const allNativeDeps = new Map<string, Map<string, string>>()
  let failures = 0

  for (const entry of enabledEntries) {
    try {
      const spec = parsePluginSource(entry.source)
      const result = await installPlugin(spec, { verbose: true })
      if (result.nativeDeps.size > 0) {
        allNativeDeps.set(spec.name, result.nativeDeps)
      }
    } catch (err) {
      failures++
      console.error(
        styleText("red", `✗`),
        `Failed to install plugin: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  if (allNativeDeps.size > 0) {
    installNativeDeps(allNativeDeps, { verbose: true })
  }

  await regeneratePluginIndex({ verbose: true })

  if (failures > 0) {
    console.error(`✗ ${failures}/${enabledEntries.length} plugin(s) failed to install`)
    process.exit(1)
  }

  console.log("✓ All plugins installed successfully")
}

main().catch((err) => {
  console.error("Failed to install plugins:", err)
  process.exit(1)
})
